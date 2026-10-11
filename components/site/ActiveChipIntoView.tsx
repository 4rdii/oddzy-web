"use client";

import { useEffect } from "react";

/**
 * The PolyBaaz phone nav is a horizontally scrolling chip row, and the current
 * page's chip can sit off-screen (on /world it is the fifth of six). Bring it
 * into view once on load, without moving the page vertically.
 */
export function ActiveChipIntoView({ selector }: { selector: string }) {
  useEffect(() => {
    const chip = document.querySelector<HTMLElement>(`${selector} [aria-current="page"]`);
    chip?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selector]);
  return null;
}
