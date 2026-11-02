"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import { brandHref } from "@/lib/brand-host";

const ROUTES = [
  {
    title: "Book a free trial class",
    text: "One free 1:1 live class per learner. Pick a tutor and a time, no payment needed.",
    href: "/robocoders/online-classes",
    path: "/online-classes",
    icon: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
  },
  {
    title: "Bring RoboCoders to your school",
    text: "Kits, textbooks and classroom packages, with demos for your team before you start.",
    href: "/robocoders/for-schools",
    path: "/for-schools",
    icon: <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Zm3.5 2v4.5c1.5 1.3 3.4 2 5.5 2s4-.7 5.5-2v-4.5" />,
  },
  {
    title: "Explore programs",
    text: "Ages 6 to 18, from block coding and Scratch to Arduino robotics and AI.",
    href: "/robocoders/programs",
    path: "/programs",
    icon: <path d="M5 4.5h10.5L19 8v11.5H5v-15Zm4 6h6m-6 4h6" />,
  },
  {
    title: "Sign in to the LMS",
    text: "Students and teachers, your courses, projects and class links live here.",
    href: brandHref("/lms/login"),
    path: "/lms/login",
    icon: <path d="M10 8V5.5h9v13h-9V16M4 12h10m-3.5-3.5L14 12l-3.5 3.5" />,
  },
];

export default function ContactRoutes() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.dataset.arm = "";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.in = "";
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="rh-sec ct-routes" aria-labelledby="ct-routes-h">
      <div className="rh-wrap">
        <div className="rh-head ct-routes-head">
          <h2 id="ct-routes-h">Know where you&apos;re headed?</h2>
          <p className="rh-lede">
            These pages answer most questions faster than an email. If yours isn&apos;t here,{" "}
            <a href="#message" className="rh-link">the form is just below</a>.
          </p>
        </div>
        <ul className="ct-route-list">
          {ROUTES.map((r, i) => (
            <li key={r.path} style={{ "--i": i } as CSSProperties}>
              <Link href={r.href} className="ct-door" data-lead={i === 0 ? "" : undefined}>
                <span className="ct-door-ic" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {r.icon}
                  </svg>
                </span>
                <b>{r.title}</b>
                <small>{r.text}</small>
                <span className="ct-door-go">
                  <span className="ct-door-path">{r.path}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14m-5-5 5 5-5 5" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
