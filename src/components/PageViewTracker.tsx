"use client";

import { useEffect } from "react";
import { brandFromHostname } from "@/lib/brand-host";

/** Counts one visit per browser session; localhost/dev hosts are skipped. */
export default function PageViewTracker() {
  useEffect(() => {
    const enabled =
      brandFromHostname(window.location.hostname) !== null ||
      process.env.NEXT_PUBLIC_TRACK_PAGEVIEWS === "true";
    if (!enabled || sessionStorage.getItem("visit-counted")) return;
    sessionStorage.setItem("visit-counted", "1");
    navigator.sendBeacon("/api/visits");
  }, []);

  return null;
}
