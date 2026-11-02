"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const STEPS = ["Chassis", "Motors", "Wheels", "Board", "Sensor", "Code"];
const STEP_MS = [1300, 1300, 1300, 1300, 1300, 5200];
const LAST = STEPS.length - 1;

const from = (t: string) => ({ "--from": t }) as React.CSSProperties;

/* The about hero's one moment: a robot assembles itself part by part on a bench, then comes alive and drives up to an
   obstacle. It mirrors what a class does (learn the parts, build, make it think). It loops while on screen, pauses
   with the button, any step can be picked, and reduced motion shows the finished robot. */
export default function AboutBuildStage() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); setStep(LAST); }
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || !inView || paused) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS[step]);
    return () => clearTimeout(id);
  }, [step, still, inView, paused]);

  const on = (n: number) => step >= n;
  const run = step === LAST;

  return (
    <div className="bs" ref={box}>
      <div className="bs-bar">
        <span>Build bench</span>
        <em>{run ? "Running" : `Step ${step + 1} of ${STEPS.length}`}</em>
      </div>

      <div className="bs-stage">
        <svg viewBox="0 0 600 400" role="img" aria-label="A robot assembling on a bench: chassis, motors, wheels, control board and distance sensor, then driving up to an obstacle.">
          <line x1="20" y1="372" x2="580" y2="372" className="bs-floor" />
          <g className="bs-obstacle" data-on={run}><rect x="520" y="312" width="48" height="60" rx="6" /><path d="M530 332h28M530 346h28" /></g>

          <g className="bs-rig" data-run={run}>
            <g className="bs-part" data-on={on(0)} style={from("translate(0,70px)")}>
              <rect x="150" y="236" width="300" height="70" rx="18" className="bs-shell" />
              <path d="M178 252h244" className="bs-trim" />
            </g>
            <g className="bs-part" data-on={on(1)} style={from("translate(0,-60px)")}>
              <rect x="168" y="292" width="48" height="36" rx="7" className="bs-motor" />
              <rect x="384" y="292" width="48" height="36" rx="7" className="bs-motor" />
            </g>
            <g className="bs-part" data-on={on(2)} style={from("translate(-140px,0)")}>
              <g className="bs-spin" data-run={run}>
                <circle cx="192" cy="332" r="38" className="bs-tyre" /><circle cx="192" cy="332" r="13" className="bs-hub" />
                <path d="M192 300v64M160 332h64" className="bs-spoke" />
              </g>
            </g>
            <g className="bs-part" data-on={on(2)} style={from("translate(140px,0)")}>
              <g className="bs-spin" data-run={run}>
                <circle cx="408" cy="332" r="38" className="bs-tyre" /><circle cx="408" cy="332" r="13" className="bs-hub" />
                <path d="M408 300v64M376 332h64" className="bs-spoke" />
              </g>
            </g>
            <g className="bs-part" data-on={on(3)} style={from("translate(0,-90px)")}>
              <rect x="226" y="176" width="140" height="60" rx="9" className="bs-board" />
              <rect x="262" y="190" width="40" height="32" rx="4" className="bs-chip" />
              <path d="M240 186v-8M256 186v-8M340 186v-8M356 186v-8M240 236v8M256 236v8M340 236v8M356 236v8" className="bs-pin" />
              <circle cx="334" cy="206" r="5" className="bs-led" data-run={run} />
            </g>
            <g className="bs-part" data-on={on(4)} style={from("translate(70px,0)")}>
              <rect x="392" y="186" width="68" height="46" rx="9" className="bs-board" />
              <circle cx="414" cy="209" r="13" className="bs-eye" /><circle cx="438" cy="209" r="13" className="bs-eye" />
              <circle cx="414" cy="209" r="5" className="bs-pupil" /><circle cx="438" cy="209" r="5" className="bs-pupil" />
            </g>
            <g className="bs-waves" data-run={run}>
              <path d="M474 192q18 17 0 34" /><path d="M490 180q28 29 0 58" /><path d="M506 168q38 41 0 82" />
            </g>
          </g>
        </svg>

        <div className="bs-code" data-on={run} aria-hidden="true">
          <p><b>if</b> distance &lt; 20</p>
          <p>&nbsp;&nbsp;stop()</p>
          <p>&nbsp;&nbsp;turn(&quot;right&quot;)</p>
        </div>
      </div>

      <div className="bs-foot">
        <ol className="bs-steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" data-state={i === step ? "active" : i < step ? "done" : "todo"} aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}>
                {s}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="bs-pause" aria-pressed={paused} aria-label={paused ? "Resume the build" : "Pause the build"} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
