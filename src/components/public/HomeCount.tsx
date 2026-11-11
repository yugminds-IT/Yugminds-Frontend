"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Counts up once, when the number scrolls into view. Server render and reduced motion both show the final number.
export default function HomeCount({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    setN(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1400);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return (
    <>
      <span ref={ref} aria-hidden="true">{n}{suffix}</span>
      <span className="sr-only">{to}{suffix}</span>
    </>
  );
}
