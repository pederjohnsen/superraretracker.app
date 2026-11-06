"use client";

import { useCallback, useSyncExternalStore } from "react";

// A value kept in localStorage, such as the platform filter, so it's still set
// on the next visit. Storage can be unavailable (private mode), so every read
// and write falls back to the default quietly.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredState<T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: string) => value is T,
): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const stored = read(key);
      return stored !== null && isValid(stored) ? stored : defaultValue;
    },
    () => defaultValue,
  );

  const setValue = useCallback(
    (next: T) => {
      try {
        if (next === defaultValue) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        // Storage is blocked, so the value can't change; nothing else to do.
      }
      listeners.forEach((listener) => listener());
    },
    [key, defaultValue],
  );

  return [value, setValue];
}
