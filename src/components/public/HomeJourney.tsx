"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Cpu, Gamepad2, ImageIcon, Pause, Play, Radar, Route, Share2, Cog } from "lucide-react";
import "./droid.css";

const STEPS = [
  { name: "Learn", text: "Guided lessons, textbooks and video tutorials explain each idea." },
  { name: "Build", text: "Students assemble a robot or write code for a real project." },
  { name: "Show", text: "Every project goes into a portfolio they can share." },
  { name: "Certify", text: "Finish a course, earn a certificate and keep lifetime access to the material." },
];
const STEP_MS = [1500, 1500, 1500, 2300];

function Visual({ i }: { i: number }) {
  if (i === 0) {
    return (
      <div className="jv jv-learn" aria-hidden="true">
        <div className="jv-video"><span><Play size={14} /></span><i><b /></i></div>
        <em /><em />
      </div>
    );
  }
  if (i === 1) {
    return (
      <div className="jv jv-build" aria-hidden="true">
        {[[Cpu, "Board"], [Cog, "Motors"], [Radar, "Sensors"]].map(([I, l], k) => {
          const Icon = I as typeof Cpu;
          return <span key={l as string} style={{ "--k": k } as React.CSSProperties}><Icon size={18} />{l as string}</span>;
        })}
        <strong><Check size={14} /></strong>
      </div>
    );
  }
  if (i === 2) {
    return (
      <div className="jv jv-show" aria-hidden="true">
        {[Gamepad2, Route, ImageIcon].map((Icon, k) => (
          <span key={k} style={{ "--k": k } as React.CSSProperties}><Icon size={18} /></span>
        ))}
        <strong><Share2 size={13} /> Shared</strong>
      </div>
    );
  }
  return (
    <div className="jv jv-cert" aria-hidden="true">
      <Image src="/certificate-of-completion.png" alt="" width={2000} height={1414} sizes="260px" />
      <span className="jv-shine" />
    </div>
  );
}

/* From first lesson to certificate, as a journey: a small droid rolls along a track through the four steps, and each
   step's card comes alive as the droid arrives. It loops on its own (held off screen, or paused by the
   button), and any step can be picked. */
export default function HomeJourney() {
  const [step, setStep] = useState(0);
  const [moving, setMoving] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); setStep(3); }
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || !inView || userPaused) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS[step]);
    return () => clearTimeout(id);
  }, [step, still, inView, userPaused]);

  // the ball only turns while the droid is travelling
  useEffect(() => {
    setMoving(true);
    const id = setTimeout(() => setMoving(false), 450);
    return () => clearTimeout(id);
  }, [step]);

  const pos = (step * 2 + 1) * 12.5;
  const state = (i: number) => (still ? "done" : i === step ? "active" : i < step ? "done" : "todo");

  return (
    <section className="rh-sec" aria-labelledby="rh-path">
      <div className="rh-wrap">
        <div className="rh-jr-head">
          <div className="rh-head">
            <h2 id="rh-path">From first lesson to certificate.</h2>
            <p className="rh-lede">Four steps every student follows, whatever the track.</p>
          </div>
          <div className="rh-photo rh-jr-photo">
            <Image src="/Kids Dong Robotics.png" alt="Students building robots together at a long table" fill sizes="(max-width: 960px) 100vw, 420px" />
          </div>
        </div>

        <div className="rh-jr" ref={box}>
          <div className="rh-jr-track" aria-hidden="true">
            <span className="rh-jr-line"><i style={{ transform: `scaleX(${pos / 100})` }} /></span>
            {STEPS.map((s, i) => (
              <span key={s.name} className="rh-jr-node" data-state={state(i)} style={{ left: `${(i * 2 + 1) * 12.5}%` }}>
                {state(i) === "done" ? <Check size={16} /> : i + 1}
              </span>
            ))}
            <div className="droid-mini rh-jr-droid" data-moving={moving} style={{ transform: `translate(calc(${pos}cqw - 50%), -100%)` }}>
              <div className="droid__head-container">
                <div className="droid__antenna" />
                <div className="droid__antenna" />
                <div className="droid__head" />
              </div>
              <div className="droid__body" />
            </div>
          </div>

          <ol className="rh-jr-steps">
            {STEPS.map((s, i) => (
              <li key={s.name}>
                <button type="button" className="rh-jr-card" data-state={state(i)} aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)}>
                  <span className="rh-jr-n" aria-hidden="true">{i + 1}</span>
                  <h3>{s.name}</h3>
                  <p>{s.text}</p>
                  <Visual i={i} />
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="rh-jr-tools">
          <button
            type="button"
            className="rh-ticker-btn"
            aria-pressed={userPaused}
            aria-label={userPaused ? "Resume the journey" : "Pause the journey"}
            onClick={() => setUserPaused((p) => !p)}
          >
            {userPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </section>
  );
}
