"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SYNC_DEBOUNCE_MS = 5_000;

type SubscriptionMap = Record<string, number>; // releaseId -> thresholdPercentage

/** When a release's alert last fired, and the stock % it fired at. */
export type SentAlert = { sentAt: string; percentage: number | null };
type SentAlertMap = Record<string, SentAlert>; // releaseId -> last alert sent

/** An alert this device was sent but hadn't seen in the app when it loaded. */
export type UnseenAlert = {
  id: string;
  releaseId: string;
  kind: "STOCK" | "RESTOCK";
  percentage: number;
  sentAt: string;
};

type SubscriptionsResponse = {
  subscriptions: {
    releaseId: string;
    thresholdPercentage: number;
    notifiedAt: string | null;
    notifiedPercentage: number | null;
  }[];
  unseenAlerts?: UnseenAlert[];
};

const CLIENT_ID_STORAGE_KEY = "superraretracker.clientId";

function getClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;

  const clientId = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  return clientId;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function fetchDeviceState(clientId: string, endpoint: string): Promise<SubscriptionsResponse> {
  const params = new URLSearchParams({ clientId, endpoint });
  const res = await fetch(`/api/subscriptions?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to load subscriptions (${res.status})`);
  return res.json();
}

/** Marks alerts seen on the server. If it fails they show again next time, which is the safe way round. */
async function markAlertsSeen(clientId: string, endpoint: string, alertIds: string[]) {
  try {
    const res = await fetch("/api/alerts/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, endpoint, alertIds }),
    });
    if (!res.ok) return;
    // Nothing unseen left on this device, so clear the app icon's badge.
    await navigator.clearAppBadge?.().catch(() => {});
  } catch {
    // Offline or the like: try again on the next load.
  }
}

// Registers the service worker, establishes (or reuses) this device's Push
// subscription, and keeps its per-release alert thresholds in sync with the
// server - batching any local changes into a single request after a short
// idle period instead of firing one request per checkbox/select change.
export function usePushSubscriptionSync(notificationPermission: NotificationPermission) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionMap>({});
  const [sentAlerts, setSentAlerts] = useState<SentAlertMap>({});
  // Alerts shown this visit. They're marked seen on the server as soon as they
  // arrive, but stay here until dismissed or the app is reopened.
  const [unseenAlerts, setUnseenAlerts] = useState<UnseenAlert[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pushSubscriptionRef = useRef<PushSubscription | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedRef = useRef(false);

  // Shows new alerts (skipping ones already on screen) and marks them seen straight away.
  const addUnseenAlerts = useCallback((alerts: UnseenAlert[]) => {
    const clientId = clientIdRef.current;
    const endpoint = pushSubscriptionRef.current?.endpoint;
    if (alerts.length > 0 && clientId && endpoint) {
      void markAlertsSeen(clientId, endpoint, alerts.map((alert) => alert.id));
    }
    if (alerts.length === 0) return;
    setUnseenAlerts((prev) => {
      const known = new Set(prev.map((alert) => alert.id));
      const added = alerts.filter((alert) => !known.has(alert.id));
      return added.length > 0 ? [...prev, ...added] : prev;
    });
  }, []);

  // Set up the service worker + push subscription once notifications are allowed,
  // then hydrate local state from whatever this device is already subscribed to.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    if (typeof Notification === "undefined" || notificationPermission !== "granted") {
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
    let cancelled = false;

    (async () => {
      try {
        if (!vapidPublicKey) {
          throw new Error("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY is not configured");
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const existing = await registration.pushManager.getSubscription();
        const pushSubscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
          }));

        if (cancelled) return;
        pushSubscriptionRef.current = pushSubscription;
        const clientId = getClientId();
        clientIdRef.current = clientId;

        const data = await fetchDeviceState(clientId, pushSubscription.endpoint);

        if (cancelled) return;
        const hydrated: SubscriptionMap = {};
        const sent: SentAlertMap = {};
        for (const sub of data.subscriptions) {
          hydrated[sub.releaseId] = sub.thresholdPercentage;
          if (sub.notifiedAt) sent[sub.releaseId] = { sentAt: sub.notifiedAt, percentage: sub.notifiedPercentage };
        }
        hasHydratedRef.current = true;
        setSubscriptions(hydrated);
        setSentAlerts(sent);
        addUnseenAlerts(data.unseenAlerts ?? []);
        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to set up push notifications"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [notificationPermission, addUnseenAlerts]);

  // Coming back to the app: pick up alerts that arrived while it was in the
  // background. Only alerts and "last sent" captions are refreshed, so
  // alert-level changes still waiting to sync aren't overwritten.
  useEffect(() => {
    if (!isReady) return;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const clientId = clientIdRef.current;
      const endpoint = pushSubscriptionRef.current?.endpoint;
      if (!clientId || !endpoint) return;
      try {
        const data = await fetchDeviceState(clientId, endpoint);
        setSentAlerts((prev) => {
          const next = { ...prev };
          for (const sub of data.subscriptions) {
            if (sub.notifiedAt) next[sub.releaseId] = { sentAt: sub.notifiedAt, percentage: sub.notifiedPercentage };
          }
          return next;
        });
        addUnseenAlerts(data.unseenAlerts ?? []);
      } catch {
        // Not worth an error banner; the next return or reload tries again.
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [isReady, addUnseenAlerts]);

  const syncNow = useCallback(async (current: SubscriptionMap) => {
    const pushSubscription = pushSubscriptionRef.current;
    const clientId = clientIdRef.current;
    if (!pushSubscription || !clientId) return;

    const json = pushSubscription.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) return;

    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          endpoint: pushSubscription.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          subscriptions: Object.entries(current).map(([releaseId, thresholdPercentage]) => ({
            releaseId,
            thresholdPercentage,
          })),
        }),
      });
      if (!res.ok) throw new Error(`Failed to sync subscriptions (${res.status})`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to sync subscriptions"));
    }
  }, []);

  // Debounce: wait for a quiet period before sending the accumulated changes as one request.
  const scheduleSync = useCallback(
    (next: SubscriptionMap) => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        syncNow(next);
      }, SYNC_DEBOUNCE_MS);
    },
    [syncNow],
  );

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const setReleaseSubscription = useCallback(
    (releaseId: string, thresholdPercentage: number | null) => {
      // A new level (or untracking) re-arms the alert on the server, so forget the last one sent.
      setSentAlerts((prev) => {
        if (!(releaseId in prev)) return prev;
        const next = { ...prev };
        delete next[releaseId];
        return next;
      });
      setSubscriptions((prev) => {
        const next = { ...prev };
        if (thresholdPercentage === null) {
          delete next[releaseId];
        } else {
          next[releaseId] = thresholdPercentage;
        }
        // Only schedule a server sync once we've loaded the device's existing state,
        // so hydration itself doesn't trigger a redundant write.
        if (hasHydratedRef.current) {
          scheduleSync(next);
        }
        return next;
      });
    },
    [scheduleSync],
  );

  /**
   * Sends a real push to this device through the server, the same way stock
   * alerts travel. Throws with a message to show when it can't.
   */
  const sendTestAlert = useCallback(async () => {
    const pushSubscription = pushSubscriptionRef.current;
    const clientId = clientIdRef.current;
    const json = pushSubscription?.toJSON();
    if (!pushSubscription || !clientId || !json?.keys?.p256dh || !json.keys.auth) {
      throw new Error("Still setting up alerts on this device. Try again in a moment.");
    }

    const res = await fetch("/api/subscriptions/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        endpoint: pushSubscription.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      }),
    });
    if (!res.ok) {
      const data: { error?: string } = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Couldn’t send a test alert. Check your device’s notification settings, then try again.");
    }
  }, []);

  /** Hides alerts for the rest of this visit (they're already marked seen). */
  const dismissAlerts = useCallback((alertIds: string[]) => {
    const dismissed = new Set(alertIds);
    setUnseenAlerts((prev) => prev.filter((alert) => !dismissed.has(alert.id)));
  }, []);

  return {
    subscriptions,
    sentAlerts,
    unseenAlerts,
    dismissAlerts,
    setReleaseSubscription,
    sendTestAlert,
    isReady,
    error,
  };
}
