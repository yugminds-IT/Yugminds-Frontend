"use client";

import { useEffect, type RefObject } from "react";

/**
 * Fixed banners sit on top of the page, so they would cover whatever is under them. While one is showing, this keeps
 * the portal shell (.sd) padded by the banner's real height (it can wrap to several lines on a phone).
 */
export function useBannerSpace(ref: RefObject<HTMLElement | null>, edge: "top" | "bottom", active: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const root = document.documentElement;
    const prop = `--sd-banner-${edge}`;
    const set = () => root.style.setProperty(prop, `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(prop);
    };
  }, [ref, edge, active]);
}
