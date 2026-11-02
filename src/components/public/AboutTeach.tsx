"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, Hammer, Globe, Rocket, Sparkles, Code2, Bot } from "lucide-react";

const LANES: [string, number, number][] = [
  ["Never coded", 2, 3],
  ["Tried block coding", 22, 2.5],
  ["Knows some Python", 46, 1.8],
  ["Just curious", 8, 2.8],
];
const TOPICS = [
  { Icon: Code2, name: "Coding", d: 0.2 },
  { Icon: Bot, name: "Robotics", d: 0.9 },
  { Icon: Sparkles, name: "AI and ML", d: 1.6 },
];

/* One scene per principle, all plain CSS animations that restart when the scene mounts. Resting styles are the finished
   state, so with reduced motion (animations off) every scene simply shows its end result. */
function Build() {
  return (
    <>
      <svg className="th-svg" viewBox="0 0 560 190" aria-hidden="true">
        <g className="th-fade" style={{ "--d": "0s" } as React.CSSProperties}>
          <rect x="40" y="65" width="60" height="60" rx="9" className="th-part" />
          <path d="M60 85h20M70 75v20" className="th-mark" />
          <path d="M60 110h20" className="th-mark" />
        </g>
        <path className="th-wire" style={{ "--d": "0.33s" } as React.CSSProperties} pathLength={1} d="M100 95H190" />
        <g className="th-fade" style={{ "--d": "0.72s" } as React.CSSProperties}>
          <path d="M190 95l10-18 14 36 14-36 14 36 14-36 10 18" className="th-zig" />
        </g>
        <path className="th-wire" style={{ "--d": "1.1s" } as React.CSSProperties} pathLength={1} d="M266 95H378" />
        <circle className="th-glow" cx="400" cy="95" r="46" />
        <circle className="th-led" cx="400" cy="95" r="22" />
        <path className="th-wire" style={{ "--d": "1.49s" } as React.CSSProperties} pathLength={1} d="M400 117V165H70V125" />
      </svg>
      <p className="th-cap th-cap--late">Build the circuit. Watch it light.</p>
    </>
  );
}

function Open() {
  return (
    <>
      <ul className="th-lanes">
        {LANES.map(([name, start, dur]) => (
          <li key={name}>
            <span>{name}</span>
            <div className="th-track">
              <i className="th-dot" style={{ "--s": `${start}%`, "--dur": `${dur}s` } as React.CSSProperties} />
              <b className="th-flag" style={{ "--dur": `${dur}s` } as React.CSSProperties} />
            </div>
          </li>
        ))}
      </ul>
      <p className="th-cap th-cap--late">Everyone starts where they are. Everyone reaches a first project.</p>
    </>
  );
}

function Current() {
  return (
    <>
      <div className="th-topics">
        {TOPICS.map(({ Icon, name, d }) => (
          <div key={name} className="th-topic" style={{ "--d": `${d}s` } as React.CSSProperties}>
            <span className="rh-chip-ico"><Icon size={18} /></span>
            <b>{name}</b>
            <i /><i />
            <em>Updated</em>
          </div>
        ))}
      </div>
      <p className="th-cap th-cap--late">The curriculum is refreshed as the technology changes.</p>
    </>
  );
}

function Paced() {
  return (
    <>
      <div className="th-pace">
        <div className="th-pace-row"><span>Student</span><div className="th-bar"><i /></div><em>Done</em></div>
        <p className="th-bub th-bub--s">Stuck on loops.</p>
        <p className="th-bub th-bub--t">Let&apos;s try it together.</p>
      </div>
      <p className="th-cap th-cap--late">A tutor steps in when a student needs it, then steps back.</p>
    </>
  );
}

const ITEMS = [
  { Icon: Hammer, title: "Build, not just read", text: "Every lesson ends with something that works: a program, a circuit or a robot that moves.", scene: <Build />, label: "A circuit being wired up: battery, resistor and LED, which then lights." },
  { Icon: Globe, title: "Open to everyone", text: "No background or prior experience needed. We start where each student is.", scene: <Open />, label: "Four students starting from different points and all reaching their first project." },
  { Icon: Rocket, title: "Always current", text: "We update the curriculum as AI, robotics and software change.", scene: <Current />, label: "Coding, robotics and AI cards each marked as updated." },
  { Icon: GraduationCap, title: "Paced to the student", text: "Each student moves at their own speed, with a tutor who tracks their progress.", scene: <Paced />, label: "A student stuck on loops, a tutor helping, and the student finishing." },
];
const MS = 4200; // the slowest scene (the "open to everyone" race) ends at 3.4s, then a beat

/* The four teaching principles as tabs, with a bench below that acts each one out. Tabs take turns on their own while
   the section is on screen (the bar on the open tab shows when); a click picks one and stops the turns. */
export default function AboutTeach() {
  const [tab, setTab] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // On phones the tabs are a swipeable row: slide the open one into view (sideways only, never the page)
  useEffect(() => {
    const row = box.current?.querySelector<HTMLElement>(".th-tabs");
    const btn = row?.querySelectorAll("button")[tab];
    if (!row || !btn || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: btn.offsetLeft - 16, behavior: "smooth" });
  }, [tab]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const item = ITEMS[tab];
  const auto = !picked && !still;

  return (
    <div ref={box}>
      <ul className="th-tabs" role="tablist" aria-label="How we teach">
        {ITEMS.map(({ Icon, title, text }, i) => (
          <li key={title} role="presentation">
            <button type="button" role="tab" id={`th-tab-${i}`} aria-selected={tab === i} aria-controls="th-panel" onClick={() => { setPicked(true); setTab(i); }}>
              <span className="rh-chip-ico"><Icon size={18} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{text}</p>
              {tab === i && auto && (
                <i
                  key={`bar-${tab}`}
                  className="th-bar-run"
                  style={{ animationDuration: `${MS}ms`, animationPlayState: inView ? "running" : "paused" }}
                  onAnimationEnd={() => setTab((t) => (t + 1) % ITEMS.length)}
                  aria-hidden="true"
                />
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="bs th-stage" id="th-panel" role="tabpanel" aria-labelledby={`th-tab-${tab}`}>
        <div className="bs-bar">
          <span>Principle in action</span>
          <em>{item.title}</em>
        </div>
        <div className="th-scene" key={tab} role="img" aria-label={item.label}>
          {item.scene}
        </div>
      </div>
    </div>
  );
}
