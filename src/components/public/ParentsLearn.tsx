"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Brain, Code2 } from "lucide-react";
import "./droid.css";

const MODULES = [
  { name: "Coding", Icon: Code2 },
  { name: "AI and ML", Icon: Brain },
  { name: "Robotics", Icon: Bot },
];
const BANDS = [
  {
    name: "Grades 1 to 3", from: 1, to: 3,
    lead: "Starts with the basics of computers, then three short, playful modules.",
    mods: [
      { title: "Scratch Jr.", text: "Snap blocks together to make a character move.", flow: ["Move", "Jump", "Say"], tag: "" },
      { title: "Drawing and interactive apps", text: "See how a computer learns by drawing and playing with apps.", flow: ["Draw it", "Computer guesses", "Try again"], tag: "" },
      { title: "The Junior Robotics Kit", text: "Press a button and make lights and sounds happen. No code needed.", flow: ["Press", "Board", "Light or sound"], tag: "Junior Robotics Kit" },
    ],
  },
  {
    name: "Grades 4 to 7", from: 4, to: 7,
    lead: "Block coding, then real hardware.",
    mods: [
      { title: "Scratch", text: "Build games and animations from code blocks.", flow: ["when flag clicked", "repeat 10", "move 10 steps"], tag: "" },
      { title: "AI and machine learning", text: "Teach a model with examples and test what it predicts.", flow: ["Examples", "Train", "Predict"], tag: "" },
      { title: "The ESP32 kit", text: "Wire sensors and motors to an ESP32 board and program it.", flow: ["ESP32 board", "Sensor", "Motor"], tag: "ESP32 kit" },
    ],
  },
  {
    name: "Grades 8 to 12", from: 8, to: 12,
    lead: "Text code and bigger builds.",
    mods: [
      { title: "Python", text: "Write real text programs.", flow: ["for i in range(4):", "robot.forward()", "robot.turn(90)"], tag: "" },
      { title: "AI and ML with other tools", text: "Go past the basics with more tools.", flow: ["Collect data", "Use a tool", "Check the results"], tag: "" },
      { title: "The advanced ESP32 kit", text: "Take on bigger robots with more sensors and control.", flow: ["ESP32 board", "Sensors", "Motors", "Wi-Fi"], tag: "Advanced ESP32 kit" },
    ],
  },
];
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const bandOf = (g: number) => BANDS.findIndex((b) => g >= b.from && g <= b.to);
const MODULE_MS = 2600;
const RESUME_MS = 12000;

/* What a child learns, by class. Every class runs the same three modules in a year, in this order (coding, then AI and
   ML, then robotics); what changes is the tools. Pick your child's grade and the year lays out: each module with what
   they do and a small flow that lights up step by step. With nobody touching it, it goes through the grade groups
   on its own and resumes after a pause. Reduced motion never advances. */
export default function ParentsLearn() {
  const [band, setBand] = useState(0);
  const [mod, setMod] = useState(0);
  const [chosen, setChosen] = useState(2);
  const [moving, setMoving] = useState(false);
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
    if (still || !inView) return;
    const id = setTimeout(() => {
      if (mod < 2) setMod(mod + 1);
      else {
        setMod(0);
        if (!picked) {
          setBand((b) => (b + 1) % BANDS.length);
        }
      }
    }, MODULE_MS);
    return () => clearTimeout(id);
  }, [mod, band, picked, still, inView]);

  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, chosen]);

  const cur = BANDS[band];
  // on its own the droid walks the group's grades as the three modules go by; once a grade is picked it stays there
  const span = cur.to - cur.from + 1;
  const grade = picked ? chosen : cur.from + Math.round((mod * (span - 1)) / 2);
  const pos = ((grade - 0.5) / 12) * 100;

  useEffect(() => {
    setMoving(true);
    const id = setTimeout(() => setMoving(false), 500);
    return () => clearTimeout(id);
  }, [grade]);

  // On phones the three modules are a swipeable row: slide the open one into view (sideways only, never the page)
  useEffect(() => {
    const row = box.current?.querySelector<HTMLElement>(".pl-mods");
    const li = row?.children[mod] as HTMLElement | undefined;
    if (!row || !li || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: li.offsetLeft - 20, behavior: "smooth" });
  }, [mod, band]);

  const pick = (g: number) => { setPicked(true); setChosen(g); setBand(bandOf(g)); setMod(0); };
  const pickBand = (i: number) => pick(BANDS[i].from);

  return (
    <div className="pl sx" ref={box}>
      <div className="sx-track" role="group" aria-label="Your child's class">
        <span className="sx-line" aria-hidden="true"><i style={{ transform: `scaleX(${(grade - 1) / 11})` }} /></span>
        <ol>
          {GRADES.map((g) => (
            <li key={g}>
              <button type="button" data-state={g === grade ? "active" : g < grade ? "done" : "todo"} aria-label={`Grade ${g}`} aria-current={g === grade ? "step" : undefined} onClick={() => pick(g)}>{g}</button>
            </li>
          ))}
        </ol>
        <div className="droid-mini sx-droid" data-moving={moving} aria-hidden="true" style={{ transform: `translate(calc(${pos}cqw - 50%), -100%)` }}>
          <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
          <div className="droid__body" />
        </div>
        <ul className="sx-bands" aria-label="Grade groups">
          {BANDS.map((b, i) => (
            <li key={b.name} style={{ flexGrow: b.to - b.from + 1 }} data-on={i === band}>
              <button type="button" onClick={() => pickBand(i)} aria-pressed={i === band}>{b.name}</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="pl-card" key={`${band}-${grade}`} aria-live="polite">
        <div className="pl-head">
          <h3>Grade {grade}</h3>
          <p>{cur.name}. {cur.lead}</p>
          <small>Every class runs these three modules in a year, in this order.</small>
        </div>
        <ol className="pl-mods">
          {cur.mods.map((m, i) => {
            const { name, Icon } = MODULES[i];
            const state = i < mod ? "done" : i === mod ? "active" : "todo";
            return (
              <li key={name} data-state={state} style={{ "--i": i } as React.CSSProperties}>
                <span className="pl-n">{i + 1}</span>
                <span className="pl-kind"><Icon size={16} aria-hidden="true" /> {name}</span>
                <h4>{m.title}</h4>
                <p>{m.text}</p>
                <ol className="pl-flow" data-run={state === "active"} aria-hidden="true">
                  {m.flow.map((f, k) => <li key={f} style={{ "--k": k } as React.CSSProperties}>{f}</li>)}
                </ol>
                {m.tag && <span className="pl-tag">{m.tag}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
