"use client";

import { useEffect, useState } from "react";
import { Award, BookOpen, Check, ClipboardList } from "lucide-react";

const TABS = [
  { name: "Courses", Icon: BookOpen },
  { name: "Assignments", Icon: ClipboardList },
  { name: "Certificates", Icon: Award },
];
const COURSES: [string, number][] = [["Coding Fundamentals", 80], ["Robotics and Electronics", 45], ["AI and Machine Learning", 20]];
const MS = 4500;

/* A preview of what is behind the sign-in: courses with progress, assignments to hand in, certificates earned. The tabs
   take turns on their own; a click picks one and stops the turns. Reduced motion never advances. */
export default function LoginShowcase() {
  const [tab, setTab] = useState(0);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (picked || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setTab((t) => (t + 1) % TABS.length), MS);
    return () => clearTimeout(id);
  }, [tab, picked]);

  return (
    <div className="lg-show" aria-label="A preview of the student portal">
      <div className="lg-show-tabs" role="tablist">
        {TABS.map(({ name, Icon }, i) => (
          <button key={name} type="button" role="tab" id={`lg-tab-${i}`} aria-selected={tab === i} aria-controls="lg-pane" onClick={() => { setPicked(true); setTab(i); }}>
            <Icon size={15} aria-hidden="true" />{name}
          </button>
        ))}
      </div>
      <div className="lg-pane" id="lg-pane" role="tabpanel" aria-labelledby={`lg-tab-${tab}`} key={tab}>
        {tab === 0 && (
          <ul className="lg-courses">
            {COURSES.map(([name, pct], i) => (
              <li key={name} style={{ "--i": i, "--p": `${pct}%` } as React.CSSProperties}>
                <span>{name}</span>
                <div className="lg-meter"><i /></div>
                <b>{pct}%</b>
              </li>
            ))}
          </ul>
        )}
        {tab === 1 && (
          <ul className="lg-tasks">
            <li style={{ "--i": 0 } as React.CSSProperties}><span className="lg-tick lg-tick--done"><Check size={14} aria-hidden="true" /></span><div><b>Loops challenge</b><small>Submitted</small></div></li>
            <li style={{ "--i": 1 } as React.CSSProperties}><span className="lg-tick" /><div><b>Line-following robot</b><small>Due Friday</small></div></li>
            <li style={{ "--i": 2 } as React.CSSProperties}><span className="lg-tick" /><div><b>Shape quiz</b><small>Due next week</small></div></li>
          </ul>
        )}
        {tab === 2 && (
          <div className="lg-cert" style={{ "--i": 0 } as React.CSSProperties}>
            <span><Award size={26} aria-hidden="true" /></span>
            <div><b>Coding Fundamentals</b><small>Certificate of completion</small></div>
            <em><Check size={14} aria-hidden="true" /> Verified</em>
          </div>
        )}
      </div>
    </div>
  );
}
