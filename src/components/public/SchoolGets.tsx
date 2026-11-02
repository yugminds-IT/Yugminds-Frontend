"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Headset, Package, Rocket, Tag, User } from "lucide-react";

const ITEMS = [
  { Icon: BookOpen, title: "A program that fits your timetable", text: "Weekly clubs, semester modules or full STEM periods, planned around your academic calendar.", cap: "Planned around your calendar" },
  { Icon: User, title: "Trained instructors", text: "Certified educators teach on their own or alongside your staff.", cap: "On their own, or with your staff" },
  { Icon: Package, title: "Kits, textbooks and LMS included", text: "Your school launches with everything ready to run.", cap: "Everything arrives ready to run" },
  { Icon: Rocket, title: "Project-based learning", text: "Hands-on classes where every student builds something and finishes with a certificate.", cap: "Build, show, certify" },
  { Icon: Tag, title: "Start small or go school-wide", text: "Flexible pricing, from a pilot program to a full rollout.", cap: "From one class to the whole school" },
  { Icon: Headset, title: "24/7 tech support", text: "Help with troubleshooting so classes run smoothly.", cap: "Help when a class needs it" },
];
const DWELL = 4.5;
const RESUME_MS = 12000;

/* A small looping scene for each thing the school gets. They are CSS only and restart when their item opens. */
function Scene({ i }: { i: number }) {
  if (i === 0) {
    return (
      <div className="sg-tt" aria-hidden="true">
        {Array.from({ length: 15 }, (_, k) => <i key={k} data-pick={k === 7} />)}
        <p>Your slot</p>
      </div>
    );
  }
  if (i === 1) {
    return (
      <div className="sg-tr" aria-hidden="true">
        <div className="sg-people"><span className="sg-av" /><span className="sg-av sg-av--b" /></div>
        <div className="sg-kids">{Array.from({ length: 8 }, (_, k) => <i key={k} />)}</div>
        <p className="sg-cap-a">Teaches on their own</p>
        <p className="sg-cap-b">Teaches alongside your staff</p>
      </div>
    );
  }
  if (i === 2) {
    return (
      <div className="sg-crate" aria-hidden="true">
        <div className="sg-tiles"><i className="sg-t1">Kits</i><i className="sg-t2">Textbooks</i><i className="sg-t3">LMS</i></div>
        <div className="sg-box" />
        <p className="sg-ready">Ready to run</p>
      </div>
    );
  }
  if (i === 3) {
    return (
      <div className="sg-proj" aria-hidden="true">
        <span className="sg-p1">Build</span><b /><span className="sg-p2">Show</span><b /><span className="sg-p3">Certificate</span>
      </div>
    );
  }
  if (i === 4) {
    return (
      <div className="sg-grow" aria-hidden="true">
        <div className="sg-dots">{Array.from({ length: 12 }, (_, k) => <i key={k} className={k < 1 ? "sg-d1" : k < 4 ? "sg-d2" : "sg-d3"} />)}</div>
        <p className="sg-g1">Pilot: one class</p>
        <p className="sg-g2">A few classes</p>
        <p className="sg-g3">Full rollout</p>
      </div>
    );
  }
  return (
    <div className="sg-help" aria-hidden="true">
      <div className="sg-clock"><span>24/7</span></div>
      <div className="sg-chat">
        <p className="sg-m1">The kit isn&apos;t connecting.</p>
        <p className="sg-m2">Fixed. Back to class.</p>
      </div>
    </div>
  );
}

/* What a school gets, as a launch checklist. A spotlight goes down the six items while a scene on the right plays the
   open one; every item you have passed is ticked in the strip underneath, so by the last one the school is "ready to
   launch". Pointing at an item takes over, and the automatic switching resumes after a pause. */
export default function SchoolGets() {
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, active]);

  const auto = !picked && !still;
  const last = ITEMS.length - 1;

  return (
    <div className="sg" ref={box}>
      <ul className="sg-list">
        {ITEMS.map(({ Icon, title, text }, i) => (
          <li key={title} data-state={i === active ? "active" : i < active ? "done" : "todo"}>
            <button type="button" onClick={() => { setPicked(true); setActive(i); }} onMouseEnter={() => { setPicked(true); setActive(i); }} onFocus={() => { setPicked(true); setActive(i); }} aria-expanded={i === active}>
              <span className="rh-chip-ico"><Icon size={16} aria-hidden="true" /></span>
              <span className="sg-name">{title}</span>
            </button>
            <div className="sg-note"><p>{text}</p></div>
            {i === active && auto && inView && (
              <i key={`b-${i}`} className="sg-bar" style={{ animationDuration: `${DWELL}s` }} onAnimationEnd={() => setActive((a) => (a + 1) % ITEMS.length)} aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>

      <div className="bs sg-bench">
        <div className="bs-bar">
          <span>Launch checklist</span>
          <em aria-live="polite">{active === last ? "Ready to launch" : `${active + 1} of ${ITEMS.length}`}</em>
        </div>
        <div className="sg-screen" key={active} role="img" aria-label={ITEMS[active].cap}>
          <Scene i={active} />
        </div>
        <ol className="sg-strip" aria-hidden="true">
          {ITEMS.map(({ title }, i) => (
            <li key={title} data-state={i < active ? "done" : i === active ? "active" : "todo"}>{i < active ? <Check size={12} /> : i + 1}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
