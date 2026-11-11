"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Brain, Code2 } from "lucide-react";
import { useStill } from "./useStill";
import "./droid.css";

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const MODULES = [
  { name: "Coding", Icon: Code2 },
  { name: "AI and ML", Icon: Brain },
  { name: "Robotics", Icon: Bot },
];
const STAGES = [
  {
    name: "Grades 1 to 3", from: 1, to: 3,
    lead: "Starts with the basics of computers.",
    mods: [
      { title: "Scratch Jr.", text: "Snap blocks together to make characters move.", tags: [] },
      { title: "Drawing and interactive apps", text: "See how computers learn by drawing and playing with apps.", tags: [] },
      { title: "The Junior Robotics Kit", text: "Press a button and make lights and sounds happen. No code needed.", tags: ["Junior Robotics Kit", "Play Kit too"] },
    ],
  },
  {
    name: "Grades 4 to 7", from: 4, to: 7,
    lead: "Blocks first, then real hardware.",
    mods: [
      { title: "Scratch", text: "Build games and animations from code blocks.", tags: [] },
      { title: "AI and machine learning", text: "Teach a model with examples and test what it predicts.", tags: [] },
      { title: "The ESP32 kit", text: "Wire sensors and motors to an ESP32 board and program it.", tags: ["ESP32 kit"] },
    ],
  },
  {
    name: "Grades 8 to 12", from: 8, to: 12,
    lead: "Text code and bigger builds.",
    mods: [
      { title: "Python", text: "Write real text programs.", tags: [] },
      { title: "AI and ML with other tools", text: "Go past the basics with more tools.", tags: [] },
      { title: "The advanced ESP32 kit", text: "Take on bigger robots with more sensors and control.", tags: ["Advanced ESP32 kit"] },
    ],
  },
];
const stageOf = (g: number) => STAGES.findIndex((s) => g >= s.from && g <= s.to);
const MODULE_MS = 2300;
const RESUME_MS = 12000;

/* What students learn, across the school years. In every class the year runs the same three modules in order: coding,
   then AI and ML, then robotics. What changes is the tools, by stage. A droid walks the grades while the three modules
   of the current stage light up one after another, then it crosses into the next stage. Picking a grade or stage holds
   that stage (its modules keep cycling) and the walk resumes after a pause. Reduced motion never moves. */
export default function SchoolLearn() {
  const [stage, setStage] = useState(0);
  const [mod, setMod] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const still = useStill();
  const [moving, setMoving] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || !inView) return;
    const id = setTimeout(() => {
      if (mod < 2) setMod(mod + 1);
      else {
        setMod(0);
        if (!picked) setStage((s) => (s + 1) % STAGES.length);
      }
    }, MODULE_MS);
    return () => clearTimeout(id);
  }, [mod, stage, picked, still, inView]);

  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, stage]);

  const cur = STAGES[stage];
  // the droid walks the stage's grades as its three modules go by: first grade, middle, last grade
  const span = cur.to - cur.from + 1;
  const grade = cur.from + Math.round((mod * (span - 1)) / 2);
  const pos = ((grade - 0.5) / 12) * 100;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    setMoving(true);
    const id = setTimeout(() => setMoving(false), 500);
    return () => clearTimeout(id);
  }, [grade]);

  const pickGrade = (g: number) => { setPicked(true); setStage(stageOf(g)); setMod(0); };
  const pickStage = (i: number) => { setPicked(true); setStage(i); setMod(0); };

  return (
    <div className="sx" ref={box}>
      <div className="sx-track" role="group" aria-label="School grades">
        <span className="sx-line" aria-hidden="true"><i style={{ transform: `scaleX(${(grade - 1) / 11})` }} /></span>
        <ol>
          {GRADES.map((g) => (
            <li key={g}>
              <button type="button" data-state={g === grade ? "active" : g < grade ? "done" : "todo"} aria-label={`Grade ${g}`} aria-current={g === grade ? "step" : undefined} onClick={() => pickGrade(g)}>{g}</button>
            </li>
          ))}
        </ol>
        <div className="droid-mini sx-droid" data-moving={moving} aria-hidden="true" style={{ transform: `translate(calc(${pos}cqw - 50%), -100%)` }}>
          <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
          <div className="droid__body" />
        </div>
        <ul className="sx-bands" aria-label="Grade groups">
          {STAGES.map((s, i) => (
            <li key={s.name} style={{ flexGrow: s.to - s.from + 1 }} data-on={i === stage}>
              <button type="button" onClick={() => pickStage(i)} aria-pressed={i === stage}>{s.name}</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sx-card" key={stage} aria-live="polite">
        <div className="sx-card-head">
          <h3>{cur.name}</h3>
          <p>{cur.lead}</p>
          <small>Every class runs the same three modules in a year, in this order.</small>
        </div>
        <ol className="sx-mods">
          {cur.mods.map((m, i) => {
            const { name, Icon } = MODULES[i];
            return (
              <li key={name} data-state={i < mod ? "done" : i === mod ? "active" : "todo"} style={{ "--i": i } as React.CSSProperties}>
                <span className="sx-mod-n">{i + 1}</span>
                <span className="sx-mod-name"><Icon size={16} aria-hidden="true" /> {name}</span>
                <h4>{m.title}</h4>
                <p>{m.text}</p>
                {m.tags.length > 0 && <ul className="sx-mod-tags">{m.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
              </li>
            );
          })}
        </ol>
      </div>

      <p className="sx-foot">
        Tutors match each class to its level. <Link href="/robocoders/programs" className="rh-link">See the programs</Link>
      </p>
    </div>
  );
}
