"use client";

import { useEffect, useRef, useState } from "react";
import { Award, Bell, Brain, Bot, Check, Code2, Pause, Play } from "lucide-react";
import "./droid.css";

const MODULES = [
  { name: "Coding", Icon: Code2, made: "A game they coded" },
  { name: "AI and ML", Icon: Brain, made: "A model that spots shapes" },
  { name: "Robotics", Icon: Bot, made: "A robot that follows a line" },
];
const CHIPS = ["Coding", "AI and ML", "Robotics", "Certificate"];
// where the droid stands at each step: the start, then each finished module, then the certificate
const POS = [5, 30, 57, 84, 95];
const STEP_MS = [1300, 2300, 2300, 2300, 4200];
const LAST = 4;

/* The parents hero: a child's year, seen from the parent's side. The year runs three modules in order, coding, then AI
   and ML, then robotics. The droid rolls along the year; each time a module finishes a project lands in the portfolio
   and a progress report goes to the parent, and at the end the certificate is earned. It loops while on screen, a chip
   jumps to a step, and the button holds it. Reduced motion shows the finished year. */
export default function ParentsProgress() {
  const [step, setStep] = useState(0);
  const [moving, setMoving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); setStep(LAST); }
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || !inView || paused) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % (LAST + 1)), STEP_MS[step]);
    return () => clearTimeout(id);
  }, [step, still, inView, paused]);

  useEffect(() => {
    setMoving(true);
    const id = setTimeout(() => setMoving(false), 650);
    return () => clearTimeout(id);
  }, [step]);

  const reports = Math.min(step, 3);
  // step k means k modules are done, so the last module name is MODULES[k - 1]
  const status = step === 0 ? "The year begins" : step >= LAST ? "Year complete" : `${MODULES[step - 1].name} done`;
  const pos = POS[step];

  return (
    <div className="bs pr-sim" ref={box}>
      <div className="bs-bar">
        <span>Your child&apos;s year</span>
        <em aria-live="polite">{status}</em>
      </div>

      <div className="pr-body" role="img" aria-label="A child's year in three modules, coding, AI and ML, then robotics: a project joins the portfolio and a progress report reaches the parent after each one, and a certificate is earned at the end.">
        <div className="pr-rail" aria-hidden="true">
          <span className="pr-line"><i style={{ transform: `scaleX(${(pos - POS[0]) / (POS[LAST] - POS[0])})` }} /></span>
          {MODULES.map(({ name, Icon }, i) => (
            <div key={name} className="pr-node" data-state={step > i ? "done" : step === i && step < LAST ? "active" : "todo"} style={{ left: `${POS[i + 1]}%` }}>
              <span>{step > i ? <Check size={16} /> : <Icon size={16} />}</span>
              <b>{name}</b>
            </div>
          ))}
          <div className="pr-flag" data-on={step === LAST} style={{ left: `${POS[LAST]}%` }}><Award size={16} /></div>
          <div className="droid-mini pr-droid" data-moving={moving} style={{ transform: `translate(calc(${pos}cqw - 50%), -100%)` }}>
            <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
            <div className="droid__body" />
          </div>
        </div>

        <ul className="pr-tiles" aria-hidden="true">
          {MODULES.map(({ made }, i) => (
            <li key={made} data-on={step > i}>
              <b>{made}</b>
              <em>{step > i ? "In the portfolio" : "Coming up"}</em>
            </li>
          ))}
        </ul>

        <div className="pr-rows" aria-hidden="true">
          <p className="pr-report" data-on={reports > 0} key={reports}><Bell size={14} /> {reports > 0 ? `Progress report ${reports} of 3 sent to you` : "Progress reports reach you as modules finish"}</p>
          <p className="pr-cert" data-on={step === LAST}>{step === LAST ? <Check size={14} /> : <Award size={14} />} Certificate of completion <em>{step === LAST ? "Earned" : "At the end of the year"}</em></p>
        </div>
      </div>

      <div className="bs-foot">
        <ol className="bs-steps">
          {CHIPS.map((c, i) => (
            <li key={c}>
              <button type="button" data-state={step === i + 1 ? "active" : step > i + 1 ? "done" : "todo"} aria-pressed={step === i + 1} onClick={() => setStep(i + 1)}>{c}</button>
            </li>
          ))}
        </ol>
        <button type="button" className="bs-pause" aria-pressed={paused} aria-label={paused ? "Resume the demo" : "Pause the demo"} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
