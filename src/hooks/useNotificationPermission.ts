"use client";

import { useSyncExternalStore } from "react";

// The Notification API has no change event, but the Permissions API does where
// it's supported. Components can also call refresh() after requestPermission().

const listeners = new Set<() => void>();
let permissionStatus: PermissionStatus | undefined;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && !permissionStatus && typeof navigator !== "undefined" && navigator.permissions) {
    navigator.permissions
      .query({ name: "notifications" })
      .then((status) => {
        permissionStatus = status;
        status.addEventListener("change", notify);
      })
      .catch(() => {
        // Not supported (older Safari); refresh() still works.
      });
  }
  return () => listeners.delete(listener);
}

function getSnapshot(): NotificationPermission {
  return typeof Notification !== "undefined" ? Notification.permission : "default";
}

function getServerSnapshot(): NotificationPermission {
  return "default";
}

export function useNotificationPermission() {
  const permission = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { permission, refresh: notify };
}
