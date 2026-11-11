"use client";

import { useEffect, useRef, useState } from "react";
import { MousePointerClick, Power } from "lucide-react";

/* The Junior Robotics Kit (grades 1 to 3), shown as an experience rather than a manual: press a button, watch a light or
   a buzzer respond, and discover that each input only talks to the output with the same number. The board is a
   stylised drawing; nothing here lists parts, connectors, pins or build steps. */

const X = [190, 280, 370, 460]; // socket centres
const PAIR = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const OUTS = [
  { id: "red", label: "Red light", color: "#ef4444" },
  { id: "green", label: "Green light", color: "#22c55e" },
  { id: "buzzer", label: "Buzzer", color: "#f4c242" },
] as const;
type Out = (typeof OUTS)[number]["id"];

// A short demo that plays on its own until someone touches a control.
const DEMO = [
  { power: false, ip: 0, op: 0, out: "red", press: false, say: "Start with the board OFF." },
  { power: true, ip: 0, op: 0, out: "red", press: false, say: "Button in 1, light in 1. Switch the board ON." },
  { power: true, ip: 0, op: 0, out: "red", press: true, say: "Press the button. The light glows." },
  { power: true, ip: 0, op: 2, out: "red", press: true, say: "Move the light to 3. Press again. Nothing happens." },
  { power: true, ip: 0, op: 0, out: "buzzer", press: true, say: "Back to a matching pair, with a buzzer. It beeps." },
] as const;
const DEMO_MS = 2300;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function JuniorKit() {
  const [power, setPower] = useState(false);
  const [ip, setIp] = useState(0);
  const [op, setOp] = useState(0);
  const [out, setOut] = useState<Out>("red");
  const [press, setPress] = useState(false);
  const [demo, setDemo] = useState(true);
  const [d, setD] = useState(0);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    if (reduced()) { setStill(true); setDemo(false); setPower(true); setPress(true); }
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!demo || still || !inView) return;
    const s = DEMO[d];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    setPower(s.power); setIp(s.ip); setOp(s.op); setOut(s.out); setPress(s.press);
    const id = setTimeout(() => setD((n) => (n + 1) % DEMO.length), DEMO_MS);
    return () => clearTimeout(id);
  }, [demo, d, still, inView]);

  const manual = () => { if (demo) { setDemo(false); setPress(false); } };
  const hold = (v: boolean) => { manual(); setPress(v); };

  const match = ip === op;
  const active = power && press && match;
  const outInfo = OUTS.find((o) => o.id === out)!;
  const isLight = out !== "buzzer";
  const says =
    demo && !still ? DEMO[d].say
    : !power ? "The board is OFF. Switch it ON."
    : !press ? "Press and hold the button."
    : match ? (isLight ? "The light glows." : "The buzzer beeps.")
    : `Nothing happens. Input ${ip + 1} only works with output ${ip + 1}.`;

  return (
    <div className="jk" ref={box}>
      <div className="bs jk-bench">
        <div className="bs-bar">
          <span>Junior Robotics Kit</span>
          <em>{demo && !still ? "Watch" : "Your turn"}</em>
        </div>

        <svg className="jk-board" viewBox="0 0 640 380" role="img" aria-label="A stylised kit board with a push button plugged into an input and a light or buzzer plugged into an output.">
          <rect className="jk-pcb" x="130" y="40" width="400" height="300" rx="18" />
          {X.map((x, i) => (
            <line key={i} className="jk-pair" x1={x} y1="290" x2={x} y2="90" stroke={PAIR[i]} data-on={i === ip && power} />
          ))}
          {power && press && <line className="jk-signal" x1={X[ip]} y1="290" x2={X[ip]} y2={match ? 90 : 200} stroke={PAIR[ip]} />}
          {power && press && !match && (
            <g className="jk-stop" transform={`translate(${X[ip]} 190)`}><circle r="13" /><path d="M-6 -6 L6 6 M6 -6 L-6 6" /></g>
          )}
          {X.map((x, i) => (
            <g key={i}>
              <rect className="jk-sock" data-pair={i === op} x={x - 32} y="54" width="64" height="36" rx="6" />
              <text className="jk-lbl jk-lbl--in" x={x} y="77" textAnchor="middle">Out {i + 1}</text>
              <rect className="jk-sock" data-pair={i === ip} x={x - 32} y="290" width="64" height="36" rx="6" />
              <text className="jk-lbl jk-lbl--in" x={x} y="313" textAnchor="middle">In {i + 1}</text>
            </g>
          ))}

          <g className="jk-sw" data-on={power} role="switch" aria-checked={power} aria-label="Board power" tabIndex={0}
             onClick={() => { manual(); setPower((p) => !p); }} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), manual(), setPower((p) => !p))}>
            <rect className="jk-sw-track" x="146" y="58" width="52" height="30" rx="15" />
            <circle className="jk-sw-knob" cx="161" cy="73" r="10" style={{ transform: `translateX(${power ? 22 : 0}px)` }} />
          </g>

          <path className="jk-wire" d={`M52 360 V374 H${X[ip]} V330`} data-flow={power && press} />
          <g className="jk-btn" data-down={press} role="button" tabIndex={0} aria-label="Push button. Press and hold." aria-pressed={press}
             onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerCancel={() => hold(false)} onPointerLeave={() => press && !demo && setPress(false)}
             onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), hold(true))} onKeyUp={() => hold(false)}>
            <rect className="jk-mod" x="12" y="280" width="80" height="80" rx="10" />
            <circle className="jk-btn-ring" cx="52" cy="318" r="22" />
            <circle className="jk-btn-cap" cx="52" cy="318" r="15" />
          </g>

          <path className="jk-wire" d={`M588 52 V16 H${X[op]} V56`} data-flow={active} />
          <g className="jk-out">
            <rect className="jk-mod" x="546" y="52" width="84" height="84" rx="10" />
            {isLight ? (
              <>
                {active && <circle className="jk-glow" cx="588" cy="94" r="30" fill={outInfo.color} />}
                <circle className="jk-led" cx="588" cy="94" r="17" fill={active ? outInfo.color : "#3a2a2a"} stroke={outInfo.color} />
              </>
            ) : (
              <>
                <circle className="jk-buz" cx="588" cy="94" r="20" />
                <circle cx="588" cy="94" r="5" fill="#0b1b3a" />
                {active && [0, 1, 2].map((k) => <path key={k} className="jk-wave" style={{ animationDelay: `${k * 0.25}s` }} d={`M${616 + k * 4} ${82 - k * 3} q${8 + k * 2} ${12 + k * 3} 0 ${24 + k * 6}`} />)}
              </>
            )}
          </g>
        </svg>

        <div className="jk-say" aria-live="polite" data-state={!power ? "off" : press ? (match ? "ok" : "bad") : "idle"}>
          <span aria-hidden="true">{!power ? <Power size={16} /> : press && match ? "✓" : press ? "✕" : <MousePointerClick size={16} />}</span>
          <p>{says}</p>
          {!demo && <button type="button" onClick={() => { setDemo(true); setD(0); }}>Watch the demo again</button>}
        </div>

        <div className="jk-ctl bs-foot">
          <fieldset><legend>Board</legend>
            <button type="button" className="jk-pill" aria-pressed={power} onClick={() => { manual(); setPower((p) => !p); }}><Power size={14} aria-hidden="true" /> {power ? "ON" : "OFF"}</button>
          </fieldset>
          <fieldset><legend>Button in</legend>
            {X.map((_, i) => <button key={i} type="button" className="jk-pill" aria-pressed={ip === i} style={{ "--c": PAIR[i] } as React.CSSProperties} onClick={() => { manual(); setIp(i); }}>{i + 1}</button>)}
          </fieldset>
          <fieldset><legend>Output in</legend>
            {X.map((_, i) => <button key={i} type="button" className="jk-pill" aria-pressed={op === i} style={{ "--c": PAIR[i] } as React.CSSProperties} onClick={() => { manual(); setOp(i); }}>{i + 1}</button>)}
          </fieldset>
          <fieldset><legend>Output</legend>
            {OUTS.map((o) => <button key={o.id} type="button" className="jk-pill" aria-pressed={out === o.id} onClick={() => { manual(); setOut(o.id); }}>{o.label}</button>)}
          </fieldset>
          <button type="button" className="rh-btn rh-btn--primary jk-hold" aria-pressed={press}
            onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerCancel={() => hold(false)} onPointerLeave={() => setPress(false)}
            onKeyDown={(e) => (e.key === " " || e.key === "Enter") && hold(true)} onKeyUp={() => hold(false)} onBlur={() => setPress(false)}>
            Press and hold the button
          </button>
        </div>
      </div>
    </div>
  );
}

export default JuniorKit;
