"use client";

import { useSyncExternalStore } from "react";

/**
 * A ticking clock for countdowns and "updated N minutes ago", as an external
 * store: null during SSR and hydration (so server and client HTML agree), then
 * the current time, re-read every `ms`. One timer per interval, shared.
 */
const stores = new Map<number, { now: number; subs: Set<() => void>; timer: ReturnType<typeof setInterval> | null }>();

function store(ms: number) {
  let s = stores.get(ms);
  if (!s) {
    s = { now: Date.now(), subs: new Set(), timer: null };
    stores.set(ms, s);
  }
  return s;
}

export function useNow(ms = 1000): number | null {
  return useSyncExternalStore(
    (cb) => {
      const s = store(ms);
      s.subs.add(cb);
      if (!s.timer) {
        s.now = Date.now();
        s.timer = setInterval(() => {
          s!.now = Date.now();
          s!.subs.forEach((f) => f());
        }, ms);
      }
      return () => {
        s.subs.delete(cb);
        if (!s.subs.size && s.timer) {
          clearInterval(s.timer);
          s.timer = null;
        }
      };
    },
    () => store(ms).now,
    () => null,
  );
}
