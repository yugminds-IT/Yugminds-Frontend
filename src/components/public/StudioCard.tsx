"use client";

import { useState } from "react";
import { ExternalLink, Wifi, WifiOff } from "lucide-react";

const TABS = ["Blocks", "Python", "AI", "Robot"];
const STUDIO_URL = "https://rcstudio.yugminds.org";

const VERSIONS = {
  school: {
    label: "At school",
    badge: "Offline",
    note: "The offline version, for schools. It works without an internet connection.",
    tags: ["Ages 8+", "Works offline", "For schools"],
  },
  home: {
    label: "At home",
    badge: "Online",
    note: "The online version, for students who practise at home.",
    tags: ["Runs online", "Practise at home"],
  },
} as const;
type Version = keyof typeof VERSIONS;

/* The app window: tabs for blocks, Python, AI and robot control cycling on a loop, and a badge for the version. */
export function StudioArt({ v }: { v: Version }) {
  return (
    <div className="pv-window" aria-hidden="true">
      <div className="pv-bar">
        <i /><i /><i />
        <span>RoboCoders Studio</span>
        <em data-v={v}>
          {v === "school" ? <WifiOff size={12} aria-hidden="true" /> : <Wifi size={12} aria-hidden="true" />} {VERSIONS[v].badge}
        </em>
      </div>
      <div className="pv-tabs">
        {TABS.map((t, i) => <span key={t} style={{ "--i": i } as React.CSSProperties}>{t}</span>)}
      </div>
      <div className="pv-panes">
        <div className="pv-pane" style={{ "--i": 0 } as React.CSSProperties}>
          <b className="blk blk-g">when flag clicked</b>
          <b className="blk blk-b">move 10 steps</b>
          <b className="blk blk-b">turn 90 degrees</b>
        </div>
        <div className="pv-pane pv-code" style={{ "--i": 1 } as React.CSSProperties}>
          <code><u>for</u> i <u>in</u> range(4):</code>
          <code>&nbsp;&nbsp;robot.forward()</code>
          <code>&nbsp;&nbsp;robot.turn(90)</code>
        </div>
        <div className="pv-pane pv-ai" style={{ "--i": 2 } as React.CSSProperties}>
          {[["Cat", 91], ["Dog", 6], ["Bird", 3]].map(([l, n]) => (
            <p key={l}><span>{l}</span><i><b style={{ width: `${n}%` }} /></i><em>{n}%</em></p>
          ))}
        </div>
        <div className="pv-pane pv-robot" style={{ "--i": 3 } as React.CSSProperties}>
          <span>forward</span><span>left</span><span>right</span><span>stop</span>
        </div>
      </div>
    </div>
  );
}

/* RoboCoders Studio comes in two versions: offline for schools, online for practising at home. The switch changes the
   badge on the app window, the note and the tags, and the online version links to the Studio site. */
export default function StudioCard() {
  const [v, setV] = useState<Version>("school");
  const cur = VERSIONS[v];
  return (
    <article className="rh-pv">
      <div className="rh-pv-art">
        <StudioArt v={v} />
      </div>
      <div className="rh-pv-body">
        <h3>RoboCoders Studio</h3>
        <p>Software for block coding, Python, AI experiments and robot control.</p>
        <div className="pv-switch" role="group" aria-label="Studio version">
          {(Object.keys(VERSIONS) as Version[]).map((k) => (
            <button key={k} type="button" aria-pressed={v === k} onClick={() => setV(k)}>
              {VERSIONS[k].label} <span>{VERSIONS[k].badge}</span>
            </button>
          ))}
        </div>
        <p className="pv-note" aria-live="polite">{cur.note}</p>
        <ul className="rh-tags">
          {cur.tags.map((t) => <li key={t} className="rh-tag">{t}</li>)}
        </ul>
        {v === "home" && (
          <a className="rh-link pv-open" href={STUDIO_URL} target="_blank" rel="noopener noreferrer">
            Open Studio online <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}
