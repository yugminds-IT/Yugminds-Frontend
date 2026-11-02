"use client";

import { useEffect, useState } from "react";
import { Award, BookOpen, Check, Clock, Video } from "lucide-react";

const TABS = [
  { name: "Courses", Icon: BookOpen },
  { name: "Live 1:1 classes", Icon: Video },
  { name: "Certificates", Icon: Award },
];
const LESSONS: [string, string, "done" | "now" | "next"][] = [
  ["Meet the board", "Watched", "done"],
  ["Blink an LED", "Quiz passed", "done"],
  ["Read a sensor", "In progress", "now"],
  ["Build the robot", "Up next", "next"],
];
const SLOTS = ["Tue 5:00 pm", "Wed 6:30 pm", "Sat 10:00 am"];
const MS = 4500;

/* A preview of what an Academy account holds: a course in progress, a live class to book, a certificate to earn. The
   tabs take turns on their own; a click picks one and stops the turns. Reduced motion never advances. */
export default function AcademyShowcase() {
  const [tab, setTab] = useState(0);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (picked || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setTab((t) => (t + 1) % TABS.length), MS);
    return () => clearTimeout(id);
  }, [tab, picked]);

  return (
    <div className="lg-show" aria-label="A preview of an Academy account">
      <div className="lg-show-tabs" role="tablist">
        {TABS.map(({ name, Icon }, i) => (
          <button key={name} type="button" role="tab" id={`ac-tab-${i}`} aria-selected={tab === i} aria-controls="ac-pane" onClick={() => { setPicked(true); setTab(i); }}>
            <Icon size={15} aria-hidden="true" />{name}
          </button>
        ))}
      </div>
      <div className="lg-pane" id="ac-pane" role="tabpanel" aria-labelledby={`ac-tab-${tab}`} key={tab}>
        {tab === 0 && (
          <ul className="lg-tasks">
            {LESSONS.map(([name, note, state], i) => (
              <li key={name} style={{ "--i": i } as React.CSSProperties}>
                <span className={state === "done" ? "lg-tick lg-tick--done" : state === "now" ? "lg-tick lg-tick--now" : "lg-tick"}>
                  {state === "done" ? <Check size={14} aria-hidden="true" /> : <small>{i + 1}</small>}
                </span>
                <div><b>{name}</b><small>{note}</small></div>
              </li>
            ))}
          </ul>
        )}
        {tab === 1 && (
          <div className="lg-book" style={{ "--i": 0 } as React.CSSProperties}>
            <b>Book a RoboCoders tutor</b>
            <div className="lg-slots">
              {SLOTS.map((s, i) => <span key={s} data-on={i === 1}>{s}</span>)}
            </div>
            <p><Clock size={14} aria-hidden="true" /> Your joining link appears 10 minutes before the class.</p>
          </div>
        )}
        {tab === 2 && (
          <div className="lg-cert" style={{ "--i": 0 } as React.CSSProperties}>
            <span><Award size={26} aria-hidden="true" /></span>
            <div><b>Build your first robot</b><small>Certificate of completion</small></div>
            <em><Check size={14} aria-hidden="true" /> Verifiable</em>
          </div>
        )}
      </div>
    </div>
  );
}
