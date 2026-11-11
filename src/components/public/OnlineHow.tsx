"use client";

import { useEffect, useRef, useState } from "react";
import { Award, BookOpen, CalendarCheck, Check, Gift, PlayCircle, ShieldCheck, UserPlus } from "lucide-react";
import "./droid.css";

const STEPS = [
  { title: "Create a free account", text: "Sign up in a minute. One account for courses, live classes and certificates.", Icon: UserPlus },
  { title: "Start with something free", text: "Take a free demo course or claim your free 1:1 trial class with a tutor.", Icon: Gift },
  { title: "Learn your way", text: "Self-paced video courses with quizzes, or live 1:1 classes at times that suit you.", Icon: BookOpen },
  { title: "Earn certificates", text: "Finish a course to get a verifiable RoboCoders certificate.", Icon: Award },
];
const MS = 6500;
const RESUME_MS = 12000;

/* From sign-up to certificate. A droid walks the four steps; each step plays a short scene of what you do there
   (fill in the form, pick a free way in, learn, get the certificate). The walk loops while on screen; picking a step
   holds it and the walk resumes after a pause. Scenes play once and rest finished, so reduced motion shows the result. */
export default function OnlineHow() {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const [moving, setMoving] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || picked || !inView) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), MS);
    return () => clearTimeout(id);
  }, [step, still, picked, inView]);

  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, step]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    setMoving(true);
    const id = setTimeout(() => setMoving(false), 600);
    return () => clearTimeout(id);
  }, [step]);

  const pick = (i: number) => { setPicked(true); setStep(i); };
  const cur = STEPS[step];

  return (
    <div className="oh" ref={box}>
      <div className="oh-track" role="group" aria-label="How it works">
        <span className="oh-line" aria-hidden="true"><i style={{ transform: `scaleX(${step / 3})` }} /></span>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button type="button" data-state={i === step ? "active" : i < step ? "done" : "todo"} aria-current={i === step ? "step" : undefined} onClick={() => pick(i)}>
                <span>{i < step ? <Check size={16} aria-hidden="true" /> : i + 1}</span>
                <b>{s.title}</b>
              </button>
            </li>
          ))}
        </ol>
        <div className="droid-mini oh-droid" data-moving={moving} aria-hidden="true" style={{ transform: `translate(calc(${(step + 0.5) * 25}cqw - 50%), -100%)` }}>
          <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
          <div className="droid__body" />
        </div>
      </div>

      <div className="oh-card" key={step} aria-live="polite">
        <div className="oh-copy">
          <small>Step {step + 1} of {STEPS.length}</small>
          <h3>{cur.title}</h3>
          <p>{cur.text}</p>
        </div>
        <div className="bs oh-bench">
          <div className="bs-bar"><span>RoboCoders Online</span><em>{cur.title}</em></div>
          <div className="oh-scene" aria-hidden="true">
            {step === 0 && (
              <div className="oh-form">
                <p><small>Name</small><span className="oh-type" style={{ "--n": 5 } as React.CSSProperties}>Aarav</span></p>
                <p><small>Email</small><span className="oh-type oh-type--2" style={{ "--n": 15 } as React.CSSProperties}>aarav@email.com</span></p>
                <span className="oh-go">Create account</span>
                <span className="oh-ok"><Check size={16} /> Welcome, Aarav</span>
              </div>
            )}
            {step === 1 && (
              <div className="oh-pair">
                <div className="oh-opt"><PlayCircle size={26} /><b>Free demo course</b><em>Free</em></div>
                <div className="oh-opt oh-opt--2"><CalendarCheck size={26} /><b>Free 1:1 trial class</b><em>Free</em></div>
                <span className="oh-ok">No payment needed</span>
              </div>
            )}
            {step === 2 && (
              <div className="oh-learn">
                <div className="oh-row"><PlayCircle size={18} /><span>Lesson 3: Loops</span><div className="oh-prog"><i /></div></div>
                <div className="oh-row oh-row--2"><CalendarCheck size={18} /><span>Live 1:1 class, Sat 10:00</span><em>Booked</em></div>
                <span className="oh-ok"><Check size={16} /> Quiz passed</span>
              </div>
            )}
            {step === 3 && (
              <div className="oh-cert">
                <p className="oh-cert-k">Certificate of completion</p>
                <p className="oh-cert-n">Aarav</p>
                <p className="oh-cert-c">Intro to coding</p>
                <span className="oh-seal"><Award size={30} /></span>
                <span className="oh-ok"><ShieldCheck size={16} /> Verifiable online</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
