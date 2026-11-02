"use client";

import { useEffect, useRef, useState } from "react";
import { Code2, Lightbulb, Puzzle } from "lucide-react";
import "./droid.css";

const TABS = [
  { id: "mission", name: "Our mission", text: "To give every student the coding and robotics skills to create, think critically and solve real problems.", ms: 5600 },
  { id: "vision", name: "Our vision", text: "A world where every student can grow into a confident creator in the digital age.", ms: 4800 },
];
const SKILLS = [
  { Icon: Code2, name: "Create", sub: "Code, circuits and robots" },
  { Icon: Lightbulb, name: "Think critically", sub: "Test an idea, find the bug" },
  { Icon: Puzzle, name: "Solve real problems", sub: "Build something that helps" },
];
const POS = [12, 38, 63, 88];
const COLS = 8;
const ROWS = 4;
const TOTAL = COLS * ROWS;
// dots light in a diagonal wave from the top left
const RANK = Array.from({ length: TOTAL }, (_, i) => i)
  .sort((a, b) => (a % COLS) + Math.floor(a / COLS) - ((b % COLS) + Math.floor(b / COLS)) || a - b)
  .reduce<number[]>((r, idx, rank) => ((r[idx] = rank), r), []);

/* Mission and vision as two scenes. Mission: a droid rolls through the three things the mission promises (create,
   think, solve). Vision: a class of students lights up one by one until every one of them is a creator. The scenes
   take turns on their own (the progress bar on the open card shows when), pause off screen, and a click
   picks one and stops the turns. Reduced motion shows both scenes finished and never advances. */
export default function AboutWhy() {
  const [tab, setTab] = useState(0);
  const [step, setStep] = useState(0);
  const [lit, setLit] = useState(0);
  const [moving, setMoving] = useState(false);
  const [inView, setInView] = useState(false);
  const [picked, setPicked] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); setStep(3); setLit(TOTAL); }
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const live = !still && inView;

  // mission: the droid visits each skill, holds at the end, then rolls back to the start
  useEffect(() => {
    if (!live || tab !== 0) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % POS.length), step === 3 ? 1600 : 1000);
    return () => clearTimeout(id);
  }, [live, tab, step]);

  // vision: one dot every 50ms, a pause when everyone is lit, then it starts over
  useEffect(() => {
    if (!live || tab !== 1) return;
    const id = setTimeout(() => setLit((n) => (n >= TOTAL ? 0 : n + 1)), lit >= TOTAL ? 1600 : 50);
    return () => clearTimeout(id);
  }, [live, tab, lit]);

  // the ball only turns while the droid travels
  useEffect(() => {
    setMoving(true);
    const id = setTimeout(() => setMoving(false), 450);
    return () => clearTimeout(id);
  }, [step]);

  const choose = (i: number, byUser: boolean) => {
    if (byUser) setPicked(true);
    if (i === tab) return;
    setTab(i);
    if (!still) { setStep(0); setLit(0); }
  };

  const pos = POS[step];
  const nodeState = (i: number) => (step > i + 1 ? "done" : step === i + 1 ? "active" : "todo");

  return (
    <div className="rh-wrap ab-why" ref={box}>
      <div className="ab-why-copy">
        <h2 id="ab-why">Why we exist.</h2>
        <ul className="ab-why-list">
          {TABS.map((t, i) => (
            <li key={t.id} data-open={tab === i}>
              <button type="button" id={`ab-${t.id}-btn`} aria-expanded={tab === i} aria-controls={`ab-${t.id}`} onClick={() => choose(i, true)}>
                <h3>{t.name}</h3>
              </button>
              <div className="ab-why-panel" id={`ab-${t.id}`} role="region" aria-labelledby={`ab-${t.id}-btn`}>
                <p>{t.text}</p>
              </div>
              {tab === i && !picked && !still && (
                <i
                  key={`bar-${tab}`}
                  className="ab-why-bar"
                  style={{ animationDuration: `${t.ms}ms`, animationPlayState: live ? "running" : "paused" }}
                  onAnimationEnd={() => choose((tab + 1) % TABS.length, false)}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="bs ab-sim" role="img" aria-label={tab === 0 ? "A droid rolling through three skills: create, think critically and solve real problems." : "A class of students lighting up one by one until all of them are confident creators."}>
        <div className="bs-bar">
          <span>{tab === 0 ? "Our mission, in class" : "Our vision, at scale"}</span>
          <em>{tab === 0 ? "Create. Think. Solve." : `${lit} of ${TOTAL} students`}</em>
        </div>

        <div className="ab-sim-body">
          <div className="ab-scene" data-on={tab === 0} aria-hidden="true">
            <div className="ab-track">
              <span className="ab-line"><i style={{ transform: `scaleX(${(pos - POS[0]) / (POS[3] - POS[0])})` }} /></span>
              <span className="ab-start" style={{ left: `${POS[0]}%` }} />
              {SKILLS.map(({ Icon, name, sub }, i) => (
                <div key={name} className="ab-node" data-state={nodeState(i)} style={{ left: `${POS[i + 1]}%` }}>
                  <span><Icon size={20} /></span>
                  <b>{name}</b>
                  <small>{sub}</small>
                </div>
              ))}
              <div className="droid-mini ab-droid" data-moving={moving} style={{ transform: `translate(calc(${pos}cqw - 50%), -100%)` }}>
                <div className="droid__head-container">
                  <div className="droid__antenna" />
                  <div className="droid__antenna" />
                  <div className="droid__head" />
                </div>
                <div className="droid__body" />
              </div>
            </div>
          </div>

          <div className="ab-scene" data-on={tab === 1} aria-hidden="true">
            <div className="ab-class" data-all={lit >= TOTAL}>
              {RANK.map((rank, i) => (
                <span key={i} data-lit={rank < lit} />
              ))}
            </div>
            <p className="ab-class-cap">Every student, a confident creator.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
