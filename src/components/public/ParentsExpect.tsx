"use client";

import { useEffect, useRef, useState } from "react";
import { Award, Check, HeartHandshake, LifeBuoy, Package, Rocket, Sprout } from "lucide-react";

const ITEMS = [
  { Icon: Rocket, title: "Skills for tomorrow", text: "Coding, robotics and problem-solving skills that carry into school and later careers.", cap: "Skills grow module by module" },
  { Icon: HeartHandshake, title: "Confidence from real projects", text: "Children build things that work, and that shows in how they talk about their ideas.", cap: "Confidence grows with each project" },
  { Icon: Award, title: "A portfolio and a certificate", text: "Every course ends with projects to show and a certificate anyone can verify online.", cap: "Projects to show, a certificate to prove it" },
  { Icon: Sprout, title: "No experience needed", text: "Programs run from complete beginner to advanced, and tutors match the challenge to your child.", cap: "Tutors match the level" },
  { Icon: LifeBuoy, title: "Help if they fall behind", text: "One-on-one guidance sessions and recorded class materials, so no child is left behind.", cap: "Extra help when it is needed" },
  { Icon: Package, title: "Kits provided", text: "For robotics we provide the kits and materials, and send an equipment list when you enrol.", cap: "Kits arrive with an equipment list" },
];
const DWELL = 4.5;
const RESUME_MS = 12000;

/* A small looping scene for each thing a parent can expect. CSS only; each restarts when its item opens. */
function Scene({ i }: { i: number }) {
  if (i === 0) {
    return (
      <ul className="sl-bars" aria-hidden="true">
        <li><span>Coding</span><div><i className="sl-b1" /></div></li>
        <li><span>Robotics</span><div><i className="sl-b2" /></div></li>
        <li><span>Problem-solving</span><div><i className="sl-b3" /></div></li>
      </ul>
    );
  }
  if (i === 1) {
    return (
      <div className="pe-conf" aria-hidden="true">
        <div className="pe-meter"><b>Confidence</b><div><i /></div></div>
        <div className="pe-says"><p className="pe-say">I built this!</p></div>
        <div className="pe-projects"><i className="pe-j1" /><i className="pe-j2" /><i className="pe-j3" /></div>
      </div>
    );
  }
  if (i === 2) {
    return (
      <div className="pe-port" aria-hidden="true">
        <div className="pe-frame"><span className="pe-pj1">Game</span><span className="pe-pj2">Model</span><span className="pe-pj3">Robot</span></div>
        <div className="pe-cert"><Award size={22} /><div><b>Certificate of completion</b><small>Verified online</small></div><em><Check size={14} /></em></div>
      </div>
    );
  }
  if (i === 3) {
    return (
      <div className="pe-ladder" aria-hidden="true">
        <p className="pe-l3">Advanced</p>
        <p className="pe-l2">Some experience</p>
        <p className="pe-l1">Complete beginner</p>
        <span className="pe-pick">Your child starts here</span>
      </div>
    );
  }
  if (i === 4) {
    return (
      <div className="pe-help" aria-hidden="true">
        <div className="pe-track"><i /></div>
        <p className="pe-stuck">Stuck on loops</p>
        <p className="pe-aid pe-aid1">One-on-one guidance session</p>
        <p className="pe-aid pe-aid2">Recorded class to rewatch</p>
        <p className="pe-back">Back on track</p>
      </div>
    );
  }
  return (
    <div className="sg-crate" aria-hidden="true">
      <div className="sg-tiles"><i className="sg-t1">Board</i><i className="sg-t2">Sensors</i><i className="sg-t3">Motors</i></div>
      <div className="sg-box" />
      <p className="sg-ready">Equipment list on enrolment</p>
    </div>
  );
}

/* What a parent can expect, as a list with a scene for the open item and a strip that fills as you go. The spotlight
   goes down the six items, pointing at one takes over, and the switching resumes after a pause. Reduced motion never
   advances and the scenes show a finished frame. */
export default function ParentsExpect() {
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
    <div className="sg" ref={box}>
      <ul className="sg-list">
        {ITEMS.map(({ Icon, title, text }, i) => (
          <li key={title} data-state={i === active ? "active" : i < active ? "done" : "todo"}>
            <button type="button" onClick={() => pick(i)} onMouseEnter={() => pick(i)} onFocus={() => pick(i)} aria-expanded={i === active}>
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
          <span>What to expect</span>
          <em aria-live="polite">{active === ITEMS.length - 1 ? "All set" : `${active + 1} of ${ITEMS.length}`}</em>
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
