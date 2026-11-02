"use client";

import { useEffect, useRef, useState } from "react";
import { Bot } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS = 6; // classes one trainer can take in a day
const PER_SECTION = 40; // students in a section; each section has one RoboCoders class a week
const MIN = 100;
const MAX = 2000;
const SCENES: [number, number][] = [[240, 1], [480, 2], [900, 3], [1500, 5], [2000, 5]];
const SCENE_MS = 4200;
const RESUME_MS = 14000;

/* Turns a school's size and the days it offers into a plan: sections, trainers and trainer-days. One trainer takes six
   classes a day. If the sections fit, they fill the offered days one after another (a bigger school needs more days
   of the trainer). If they do not fit even with every offered day full, the plan adds trainers who teach side by side. */
function plan(students: number, days: number) {
  const sections = Math.max(1, Math.ceil(students / PER_SECTION));
  const capacity = days * PERIODS;
  const trainers = Math.ceil(sections / capacity);
  const daysUsed = trainers > 1 ? days : Math.ceil(sections / PERIODS);
  const cells = trainers > 1 ? capacity : sections;
  // sections spread over the cells in use: floor each, and the first few take one more
  const load = (k: number) => (k < cells ? Math.floor(sections / cells) + (k < sections % cells ? 1 : 0) : 0);
  const fewerDays = Math.min(5, Math.ceil(sections / PERIODS));
  return { sections, trainers, daysUsed, trainerDays: daysUsed * trainers, load, fewerDays };
}

/* The schools hero: plan a school's week. Set how many students and how many days the school can give, and the
   timetable fills: sections (classes), trainer-days and how many trainers we send. It runs through examples on its own
   (from a small school on one day to a large one on five) and a person's input takes over, resuming after a pause. This
   is an example plan; the real one is agreed in the consultation. Reduced motion never advances the examples. */
export default function SchoolTimetable() {
  const [students, setStudents] = useState(SCENES[1][0]);
  const [days, setDays] = useState(SCENES[1][1]);
  const [scene, setScene] = useState(1);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (picked || !inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => {
      const n = (scene + 1) % SCENES.length;
      setScene(n);
      setStudents(SCENES[n][0]);
      setDays(SCENES[n][1]);
    }, SCENE_MS);
    return () => clearTimeout(id);
  }, [scene, picked, inView]);

  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, students, days]);

  const p = plan(students, days);
  const note =
    p.trainers > 1
      ? `${p.sections} sections need more than one trainer can teach in ${days} ${days === 1 ? "day" : "days"}, so we send ${p.trainers} trainers who teach side by side. More days would bring it down.`
      : `${p.sections} sections fit one trainer: ${p.daysUsed} ${p.daysUsed === 1 ? "day" : "days"} a week on site.`;

  return (
    <div className="bs sc-tt" ref={box}>
      <div className="bs-bar">
        <span>Plan your school&apos;s week</span>
        <em>{p.sections} sections</em>
      </div>

      <div className="sc-tt-body">
        <div className="sc-ctrl">
          <label className="sc-range">
            <span>Students <b>{students.toLocaleString("en-IN")}</b></span>
            <input type="range" min={MIN} max={MAX} step={20} value={students} onChange={(e) => { setPicked(true); setStudents(Number(e.target.value)); }} aria-label="Number of students" />
          </label>
          <div className="sc-days" role="group" aria-label="Days a week the school can give">
            <span>Days a week</span>
            <div>
              {[1, 2, 3, 4, 5].map((d) => (
                <button key={d} type="button" aria-pressed={days === d} onClick={() => { setPicked(true); setDays(d); }}>{d}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="sc-grid" role="img" aria-label={`Example timetable for ${students} students over ${days} days: ${p.sections} sections, ${p.trainers} ${p.trainers === 1 ? "trainer" : "trainers"}, ${p.trainerDays} trainer-days.`} key={`${p.sections}-${days}`}>
          <span />
          {DAYS.map((d, i) => <b key={d} data-off={i >= days}>{d}</b>)}
          {Array.from({ length: PERIODS }, (_, per) => (
            <div key={per} className="sc-row">
              <small>P{per + 1}</small>
              {DAYS.map((d, di) => {
                const offered = di < days;
                // fill one day after another while one trainer is enough, otherwise every offered cell is in use
                const k = di * PERIODS + per;
                const load = offered ? p.load(k) : 0;
                return (
                  <span key={d} className="sc-cell" data-off={!offered} data-on={load > 0} data-multi={load > 1} style={{ "--k": k } as React.CSSProperties}>
                    {load > 0 && <><Bot size={15} aria-hidden="true" />{load > 1 && <i>x{load}</i>}</>}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        <dl className="sc-out" aria-live="polite">
          <div><dt>{p.sections}</dt><dd>sections</dd></div>
          <div><dt>{p.trainers}</dt><dd>{p.trainers === 1 ? "trainer" : "trainers"}</dd></div>
          <div><dt>{p.trainerDays}</dt><dd>trainer-{p.trainerDays === 1 ? "day" : "days"} a week</dd></div>
        </dl>
        <p className="sc-note">{note} <span>An example: {PER_SECTION} students a section, {PERIODS} classes a day, one class a week per section.</span></p>
      </div>
    </div>
  );
}
