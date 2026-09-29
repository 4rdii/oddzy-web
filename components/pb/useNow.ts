"use client";

import { useSyncExternalStore } from "react";

/**
 * A ticking clock for countdowns and "updated N minutes ago", as an external
 * store: null during SSR and hydration (so server and client HTML agree), then
 * the current time, re-read every `ms`. One timer per interval, shared.
 *
 * `subscribe` and `getSnapshot` MUST be stable per interval, and subscribing
 * must not change the snapshot. An inline subscribe made React resubscribe on
 * every render, and each resubscribe refreshed `now` — a new snapshot, another
 * render, another resubscribe: "Maximum update depth exceeded" (React #185)
 * whenever the clock moved between renders.
 */
type Store = {
  now: number;
  subs: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  subscribe: (cb: () => void) => () => void;
  get: () => number;
};

const stores = new Map<number, Store>();

function store(ms: number): Store {
  const hit = stores.get(ms);
  if (hit) return hit;
  const s: Store = {
    now: Date.now(),
    subs: new Set(),
    timer: null,
    subscribe(cb) {
      s.subs.add(cb);
      if (!s.timer) {
        s.timer = setInterval(() => {
          s.now = Date.now();
          s.subs.forEach((f) => f());
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
    get: () => s.now,
  };
  stores.set(ms, s);
  return s;
}

const serverSnapshot = () => null;

export function useNow(ms = 1000): number | null {
  const s = store(ms);
  return useSyncExternalStore(s.subscribe, s.get, serverSnapshot);
}
