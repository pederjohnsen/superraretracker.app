"use client";

import { useSyncExternalStore } from "react";

// One shared clock for every "Checked 4 min ago" caption, ticking each minute.
const TICK_MS = 60_000;

let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function tick() {
  now = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    tick();
    timer = setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  // Cached between ticks, as useSyncExternalStore requires.
  if (!now) now = Date.now();
  return now;
}

// The server can't know the viewer's clock, so it renders no relative times.
function getServerSnapshot() {
  return null;
}

/** The current time in ms, updated every minute; null during server render. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
