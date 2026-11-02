"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Brain, Check, ExternalLink, Layers, MonitorPlay, Pause, Play, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { brandHref } from "@/lib/brand-host";

const STUDIO_URL = "https://rcstudio.yugminds.org";
const VERSIONS = {
  school: { label: "At school", badge: "Offline", note: "The offline version, for schools. It works without an internet connection.", tags: ["Ages 8+", "Works offline", "For schools"] },
  home: { label: "At home", badge: "Online", note: "The online version, for students who practise at home.", tags: ["Ages 8+", "Runs online", "Practise at home"] },
} as const;
type Version = keyof typeof VERSIONS;

const BLOCKS = ["when flag clicked", "set GPIO 2 high", "wait 1 second"];
const STATUS = ["Ready", "Running the program", "Running the program", "Running the program", "Sending to the board", "LED on: it works"];
// how long each step lasts (ms); the last one is the hold before the loop restarts
const STEP_MS = [700, 800, 800, 800, 1000, 3200];
const LAST = STEP_MS.length - 1;

const FEATURES = [
  { Icon: Layers, text: "Blocks, Python, AI and robot control in one app" },
  { Icon: MonitorPlay, text: "Step-by-step lessons with live visual feedback" },
  { Icon: Brain, text: "Easy to start, deep enough for years of projects" },
];
const SIM_POINTS = ["LEDs, buttons, sensors and motors to wire up", "Live pin readings, so mistakes show before a part burns", "Same pins as the real board"];

/* The software section as one workflow: write a program in Studio, send it, and watch the circuit work in the Simulator.
   The run loops on its own while on screen; "Run again" replays it from the start and the button holds it. Below, the
   two products in words, with the Studio version switch (offline for schools, online at home). Reduced motion shows the
   finished run. */
export default function ProductsSoftware() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [still, setStill] = useState(false);
  const [v, setV] = useState<Version>("school");
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
    if (still || paused || !inView) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEP_MS.length), STEP_MS[step]);
    return () => clearTimeout(id);
  }, [step, still, paused, inView]);

  const on = step >= 5;
  const sending = step === 4;
  const cur = VERSIONS[v];

  return (
    <div ref={box}>
      <div className="bs sw-bench">
        <div className="bs-bar">
          <span>Write it, then test it</span>
          <em aria-live="polite">{STATUS[step]}</em>
        </div>

        <div className="sw-body" role="img" aria-label="A program in RoboCoders Studio runs, is sent to the board, and the LED lights in the Simulator.">
          <div className="sw-win" aria-hidden="true">
            <div className="sw-win-bar"><i /><i /><i /><span>RoboCoders Studio</span></div>
            <div className="sw-code">
              {BLOCKS.map((b, i) => (
                <b key={b} className={i === 0 ? "sw-blk sw-blk--hat" : "sw-blk"} data-state={step === i + 1 ? "active" : step > i + 1 ? "done" : "todo"}>{b}</b>
              ))}
            </div>
          </div>

          <div className="sw-flow" aria-hidden="true" data-on={sending || on}>
            <span>Upload</span>
            <div className="sw-flow-line">{sending && <i key="packet" />}</div>
          </div>

          <div className="sw-sim" aria-hidden="true">
            <em className="sw-run" data-on={on}>{on ? "Running" : "Waiting"}</em>
            <svg viewBox="0 0 240 150">
              <rect className="sw-board" x="6" y="8" width="52" height="134" rx="6" />
              <text className="sw-t" x="24" y="76" transform="rotate(-90 24 76)">ESP32</text>
              <text className="sw-t sw-t--pin" x="52" y="53" textAnchor="end">GPIO 2</text>
              <rect className="sw-pin" x="56" y="49" width="7" height="7" />
              <text className="sw-t sw-t--pin" x="52" y="123" textAnchor="end">GND</text>
              <rect className="sw-pin" x="56" y="119" width="7" height="7" />
              <rect className="sw-bread" x="82" y="8" width="152" height="134" rx="8" />
              <path className="sw-wire" data-on={on} d="M63 52 H112" />
              <rect className="sw-res" x="112" y="45" width="36" height="14" rx="7" />
              <path className="sw-wire" data-on={on} d="M148 52 H190 V78" />
              <path className="sw-wire sw-wire--gnd" d="M190 112 V122 H63" />
              <circle className="sw-glow" data-on={on} cx="190" cy="95" r="26" />
              <circle className="sw-led" data-on={on} cx="190" cy="95" r="13" />
            </svg>
          </div>
        </div>

        <div className="bs-foot">
          <p className="sw-hint">Program in Studio. Test the circuit in the Simulator. Then build it for real.</p>
          <div className="sw-ctrl">
            <button type="button" className="bs-steps-btn" onClick={() => { setStep(0); setPaused(false); }} aria-label="Run the program again"><RotateCcw size={14} aria-hidden="true" /> Run again</button>
            <button type="button" className="bs-pause" aria-pressed={paused} aria-label={paused ? "Resume the demo" : "Pause the demo"} onClick={() => setPaused((p) => !p)}>
              {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      <div className="sw-info">
        <article>
          <h3>RoboCoders Studio</h3>
          <p>Software for block coding, Python, AI experiments and robot control.</p>
          <div className="pv-switch" role="group" aria-label="Studio version">
            {(Object.keys(VERSIONS) as Version[]).map((k) => (
              <button key={k} type="button" aria-pressed={v === k} onClick={() => setV(k)}>
                {k === "school" ? <WifiOff size={14} aria-hidden="true" /> : <Wifi size={14} aria-hidden="true" />} {VERSIONS[k].label} <span>{VERSIONS[k].badge}</span>
              </button>
            ))}
          </div>
          <p className="sw-note" aria-live="polite">{cur.note}</p>
          <ul className="sw-feats">
            {FEATURES.map(({ Icon, text }) => <li key={text}><span className="rh-chip-ico"><Icon size={14} aria-hidden="true" /></span>{text}</li>)}
          </ul>
          <ul className="rh-tags">{cur.tags.map((t) => <li key={t} className="rh-tag">{t}</li>)}</ul>
          {v === "home" && (
            <a className="rh-link" href={STUDIO_URL} target="_blank" rel="noopener noreferrer">
              Open Studio online <ExternalLink size={14} aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} />
            </a>
          )}
        </article>

        <article id="simulator" className="pd-anchor">
          <h3>RoboCoders Simulator <span className="rh-sm-new">New</span></h3>
          <p>Wire circuits on a virtual ESP32 and breadboard, and test them before you build.</p>
          <ul className="sw-feats">
            {SIM_POINTS.map((t) => <li key={t}><span className="rh-chip-ico"><Check size={14} aria-hidden="true" /></span>{t}</li>)}
          </ul>
          <Link href={brandHref("/robocoders/contact")} className="rh-btn rh-btn--primary">Get early access</Link>
        </article>
      </div>
    </div>
  );
}
