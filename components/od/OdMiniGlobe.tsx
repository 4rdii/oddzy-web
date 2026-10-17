"use client";

import type { GlobeCountry } from "./odGlobe";
import { OdGlobe } from "./OdGlobe";

/** The small risk globe on section and subtopic pages (no controls, no labels for the top five). */
export function OdMiniGlobe({ countries, focus, zoom = 1.9, metric = "risk" }: { countries: GlobeCountry[]; focus: string[]; zoom?: number; metric?: "vol" | "risk" }) {
  return <OdGlobe countries={countries} focus={focus} mini zoom={zoom} metric={metric} />;
}
