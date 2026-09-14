"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SYNC_DEBOUNCE_MS = 5_000;

type SubscriptionMap = Record<string, number>; // releaseId -> thresholdPercentage

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

// Registers the service worker, establishes (or reuses) this device's Push
// subscription, and keeps its per-release alert thresholds in sync with the
// server - batching any local changes into a single request after a short
// idle period instead of firing one request per checkbox/select change.
export function usePushSubscriptionSync(notificationPermission: NotificationPermission) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionMap>({});
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pushSubscriptionRef = useRef<PushSubscription | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedRef = useRef(false);

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
    if (!vapidPublicKey) {
      setError(new Error("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY is not configured"));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
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

        const params = new URLSearchParams({
          clientId,
          endpoint: pushSubscription.endpoint,
        });
        const res = await fetch(`/api/subscriptions?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to load subscriptions (${res.status})`);
        const data: { subscriptions: { releaseId: string; thresholdPercentage: number }[] } = await res.json();

        if (cancelled) return;
        const hydrated: SubscriptionMap = {};
        for (const sub of data.subscriptions) {
          hydrated[sub.releaseId] = sub.thresholdPercentage;
        }
        hasHydratedRef.current = true;
        setSubscriptions(hydrated);
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
  }, [notificationPermission]);

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

  return { subscriptions, setReleaseSubscription, isReady, error };
}
