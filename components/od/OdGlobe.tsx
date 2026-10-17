"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { GlobeCountry, OdGlobeEngine } from "./odGlobe";

export type OdGlobeHandle = { zoomBy: (k: number) => void };

/**
 * React host for the redesign's dotted globe (odGlobe.ts, loaded lazily).
 * Fills its positioned parent.
 */
export const OdGlobe = forwardRef<
  OdGlobeHandle,
  {
    countries: GlobeCountry[];
    metric?: "vol" | "risk";
    region?: string;
    /** Country ids; the first is primary, the rest are joined to it by arcs. */
    focus?: string[];
    mini?: boolean;
    zoom?: number;
    onHover?: (id: string | null) => void;
    onSelect?: (id: string | null) => void;
  }
>(function OdGlobe({ countries, metric = "vol", region = "all", focus = [], mini = false, zoom = 1, onHover, onSelect }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const eng = useRef<OdGlobeEngine | null>(null);
  const cb = useRef({ onHover, onSelect });
  cb.current = { onHover, onSelect };
  const props = { metric, region, focus, mini, zoom };
  const propsRef = useRef(props);
  propsRef.current = props;

  useImperativeHandle(ref, () => ({ zoomBy: (k) => eng.current?.zoomBy(k) }), []);

  useEffect(() => {
    let dead = false;
    import("./odGlobe").then(({ OdGlobeEngine }) => {
      if (dead || !host.current) return;
      eng.current = new OdGlobeEngine(host.current, propsRef.current, countries, (type, id) =>
        type === "hover" ? cb.current.onHover?.(id) : cb.current.onSelect?.(id),
      );
    });
    return () => {
      dead = true;
      eng.current?.destroy();
      eng.current = null;
    };
    // The engine is built once; prop changes go through update() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    eng.current?.setCountries(countries);
  }, [countries]);

  const focusKey = focus.join(",");
  useEffect(() => {
    eng.current?.update(propsRef.current);
  }, [metric, region, focusKey, mini, zoom]);

  return <div ref={host} aria-hidden style={{ position: "absolute", inset: 0 }} />;
});
