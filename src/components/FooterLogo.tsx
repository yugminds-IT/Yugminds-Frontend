"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/* The logo is one PNG, so its moving parts (the robot's head, its eyes, the </> core) are clipped
   copies of the same file stacked over a base with those parts cut out. Clip values are in % of
   the 803x341 artwork; see .rf-mark in robo-home.css. */
export default function FooterLogo() {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const img = { src: "/robocoders-logo.png", width: 803, height: 341 };
  return (
    <span ref={ref} className="rf-logo" data-on={on}>
      <span className="rf-mark">
        <Image {...img} alt="RoboCoders — An EdTech initiative by YugMinds" className="rf-mark-base" />
        <span className="rf-mark-head" aria-hidden="true">
          <Image {...img} alt="" className="rf-mark-face" />
          <Image {...img} alt="" className="rf-mark-eyes" />
        </span>
        <Image {...img} alt="" aria-hidden="true" className="rf-mark-core" />
      </span>
    </span>
  );
}
