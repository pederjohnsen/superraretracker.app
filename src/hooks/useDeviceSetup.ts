"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

// What the setup screen needs to know about this device: what it is, whether
// the app is installed, whether Android offered an install prompt, and the
// notification permission. The step shown is picked from these facts.

export type DeviceKind = "ios" | "android" | "desktop";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STANDALONE_QUERY = "(display-mode: standalone)";

// Chrome can fire beforeinstallprompt before React mounts, so listen from the
// moment this module loads and keep the event for the Install button.
let installPrompt: BeforeInstallPromptEvent | null = null;
let installedThisVisit = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // Show our own button instead of Chrome's mini bar.
    installPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installedThisVisit = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const standalone = window.matchMedia(STANDALONE_QUERY);
  standalone.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    standalone.removeEventListener("change", listener);
  };
}

function detectDevice(): DeviceKind {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, so tell them apart by touch.
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// One string snapshot so useSyncExternalStore can compare it cheaply.
function getSnapshot() {
  return [detectDevice(), isStandalone(), installPrompt !== null, installedThisVisit, typeof Notification !== "undefined"].join("|");
}

function getServerSnapshot() {
  return "";
}

export type DeviceSetup = {
  /** False during the server render and hydration, when none of this is known. */
  ready: boolean;
  device: DeviceKind;
  /** Opened as an installed app (home screen icon). */
  installed: boolean;
  /** Android offered to install; the Install button can show its prompt. */
  canPromptInstall: boolean;
  /** Installed during this visit; the person needs to open the app from the home screen. */
  installedThisVisit: boolean;
  /** This browser has the Notification API (iPhone Safari only does once installed). */
  notificationsSupported: boolean;
  permission: NotificationPermission;
  promptInstall: () => Promise<void>;
  requestPermission: () => Promise<void>;
  recheckPermission: () => void;
};

export function useDeviceSetup(): DeviceSetup {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { permission, refresh } = useNotificationPermission();

  // Coming back from the device's settings: check again without a tap.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const promptInstall = useCallback(async () => {
    const event = installPrompt;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    // A prompt can only be used once; Chrome sends a new one if it's allowed again.
    installPrompt = null;
    notify();
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
    refresh();
  }, [refresh]);

  const [device, installed, canPromptInstall, justInstalled, notificationsSupported] = snapshot.split("|");
  return {
    ready: snapshot !== "",
    device: (device || "desktop") as DeviceKind,
    installed: installed === "true",
    canPromptInstall: canPromptInstall === "true",
    installedThisVisit: justInstalled === "true",
    notificationsSupported: notificationsSupported === "true",
    permission,
    promptInstall,
    requestPermission,
    recheckPermission: refresh,
  };
}
