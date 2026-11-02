"use client";

import { useEffect, useRef, useState } from "react";
import { Check, GraduationCap, Landmark } from "lucide-react";
import "./droid.css";

const STEPS = [
  { name: "Consultation", text: "We learn what your school needs.", more: "A short call about your students, the days you can give and what you want them to learn." },
  { name: "Customize", text: "We shape the program to your timetable.", more: "We turn it into a plan: how many sections, which days, and how many trainers." },
  { name: "Setup", text: "Kits, software and instructors get ready.", more: "Kits, textbooks and LMS access are prepared, and your instructors are briefed." },
  { name: "Launch", text: "Classes start and we track progress with you.", more: "The first class runs, then we share progress with you as the weeks go on." },
];
const DWELL = 6;
const RESUME_MS = 12000;

/* One looping scene per step, CSS only, restarting when the step opens. */
function Scene({ i }: { i: number }) {
  if (i === 0) {
    return (
      <div className="sl-call" aria-hidden="true">
        <div className="sl-tiles">
          <div><span><Landmark size={26} /></span><b>Your school</b></div>
          <div><span className="sl-av--us"><GraduationCap size={26} /></span><b>RoboCoders team</b></div>
        </div>
        <ul className="sl-notes">
          <li className="sl-n1"><Check size={14} /> Students: about 800</li>
          <li className="sl-n2"><Check size={14} /> Days a week: 3</li>
          <li className="sl-n3"><Check size={14} /> Goal: coding and robotics</li>
        </ul>
      </div>
    );
  }
  if (i === 1) {
    return (
      <div className="sl-plan" aria-hidden="true">
        <div className="sl-grid">
          {Array.from({ length: 15 }, (_, k) => <i key={k} className={k === 1 ? "sl-c1" : k === 7 ? "sl-c2" : k === 13 ? "sl-c3" : undefined} />)}
        </div>
        <p className="sl-chip">Plan ready: 12 sections, 3 days</p>
      </div>
    );
  }
  if (i === 2) {
    return (
      <ul className="sl-bars" aria-hidden="true">
        <li><span>Kits packed</span><div><i className="sl-b1" /></div></li>
        <li><span>Software and LMS ready</span><div><i className="sl-b2" /></div></li>
        <li><span>Instructors briefed</span><div><i className="sl-b3" /></div></li>
      </ul>
    );
  }
  return (
    <div className="sl-class" aria-hidden="true">
      <div className="sl-room">
        <div className="droid-mini sl-droid">
          <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
          <div className="droid__body" />
        </div>
        <div className="sl-kids">{Array.from({ length: 10 }, (_, k) => <i key={k} />)}</div>
        <p className="sl-first">First class</p>
      </div>
      <div className="sl-chart">
        <b>Progress, week by week</b>
        <div><i className="sl-w1" /><i className="sl-w2" /><i className="sl-w3" /><i className="sl-w4" /></div>
      </div>
    </div>
  );
}

/* How a school launches, as four steps with a scene for each: the call that captures what the school needs, the plan
   dropping into the timetable, the setup bars filling, and the first class with progress tracked. The steps take turns
   while on screen (an amber bar shows when), pointing at one takes over and the switching resumes after a pause.
   Reduced motion never advances. */
export default function SchoolLaunch() {
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
  const pick = (i: number) => { setPicked(true); setActive(i); };

  return (
    <div className="sl" ref={box}>
      <ol className="sl-steps" aria-label="How a school launches">
        {STEPS.map((s, i) => (
          <li key={s.name} data-state={i < active ? "done" : i === active ? "active" : "todo"}>
            <button type="button" onClick={() => pick(i)} onMouseEnter={() => pick(i)} onFocus={() => pick(i)} aria-current={i === active ? "step" : undefined}>
              <span>{i < active ? <Check size={16} aria-hidden="true" /> : i + 1}</span>
              <div>
                <b>{s.name}</b>
                <p>{s.text}</p>
                <small>{s.more}</small>
              </div>
            </button>
            {i === active && auto && inView && (
              <i key={`b-${i}`} className="sl-bar" style={{ animationDuration: `${DWELL}s` }} onAnimationEnd={() => setActive((a) => (a + 1) % STEPS.length)} aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      <div className="bs sl-bench">
        <div className="bs-bar">
          <span>Step {active + 1}: {STEPS[active].name}</span>
          <em>{active === STEPS.length - 1 ? "Classes running" : "In progress"}</em>
        </div>
        <div className="sl-screen" key={active} role="img" aria-label={STEPS[active].more}>
          <Scene i={active} />
        </div>
      </div>
    </div>
  );
}
