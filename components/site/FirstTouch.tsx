"use client";

import { useEffect } from "react";
import { captureFirstTouch } from "@/lib/track";

/** Remembers where a visitor first came from (lib/track captureFirstTouch). Renders nothing. */
export function FirstTouch() {
  useEffect(() => {
    captureFirstTouch();
  }, []);
  return null;
}
