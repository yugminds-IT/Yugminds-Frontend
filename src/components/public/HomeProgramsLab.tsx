"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import "./droid.css";
import Link from "next/link";

const TRACKS = [
  {
    id: "coding",
    name: "Coding fundamentals",
    text: "Block and text programming that builds the logic behind every app and game.",
    note: "Blocks run a sprite",
    dwell: 4.6, // seconds: one full run of the script, then a beat on "Done!"
  },
  {
    id: "robotics",
    name: "Robotics and electronics",
    text: "Arduino, ESP32 and sensors. Students wire, program and test robots that move.",
    note: "A robot follows a line",
    dwell: 7.2, // one full lap of the line (663 units at 95 units a second)
  },
  {
    id: "ai",
    name: "AI and machine learning",
    text: "Machine learning and neural network basics, taught by building apps that decide.",
    note: "A model recognises shapes",
    dwell: 6.3, // one loop through collect, train and predict (13 ticks of 470ms)
  },
] as const;

const META = ["Ages 6 to 18", "8 to 12 weeks", "Beginner to advanced"];

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Coding: a real run. Each step lights the block being executed and the sprite does exactly that: move, then turn, four
   times round. The trail draws behind it and a counter shows the repeat. */
const CORNERS: [number, number][] = [[60, 50], [180, 50], [180, 150], [60, 150], [60, 50]];
const STEPS = 10; // flag, then (move, turn) x 4, then done
export function CodingSim({ running = true }: { running?: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    if (reduced()) { setStep(STEPS - 1); return; }
    if (!running) return;
    const id = setTimeout(() => setStep((n) => (n + 1) % (STEPS + 2)), step === STEPS - 1 ? 800 : step >= STEPS ? 260 : 340);
    return () => clearTimeout(id);
  }, [step, running]);
  const s = Math.min(step, STEPS - 1);
  const moves = s < 1 ? 0 : Math.min(4, Math.ceil(s / 2));
  const turns = s < 1 ? 0 : Math.min(4, Math.floor(s / 2));
  const done = s === STEPS - 1;
  const [x, y] = CORNERS[moves];
  const active = s === 0 ? "flag" : done ? "none" : s % 2 === 1 ? "move" : "turn";
  const reset = step >= STEPS;
  return (
    <div className="sim sim-coding">
      <div className="sim-blocks" aria-hidden="true">
        <span className="sb sb-hat" data-on={active === "flag"}>when flag clicked</span>
        <div className="sb-wrap" data-on={s > 0 && !done}>
          <span className="sb sb-c">repeat 4 <em>{s < 1 ? 0 : Math.min(4, Math.floor((s + 1) / 2))}/4</em></span>
          <span className="sb sb-in" data-on={active === "move"}>move 10 steps</span>
          <span className="sb sb-in" data-on={active === "turn"}>turn 90 degrees</span>
        </div>
        <span className="sb-done" data-on={done}>Done!</span>
      </div>
      <div className="sim-box" aria-hidden="true">
        <svg className="sim-stage" viewBox="0 0 240 200">
          <rect className="sim-floor" x="1" y="1" width="238" height="198" rx="14" />
          {!reset && CORNERS.slice(0, 4).map((c, k) => {
            const n = CORNERS[k + 1];
            return moves > k ? <line key={k} className="sim-draw" x1={c[0]} y1={c[1]} x2={n[0]} y2={n[1]} /> : null;
          })}
        </svg>
        <div
          className="droid-mini"
          data-flip={!reset && turns % 4 === 2}
          style={{ transform: `translate(calc(${((reset ? 60 : x) / 240) * 100}cqw - 50%), calc(${((reset ? 50 : y) / 240) * 100}cqw - 3.75em))`, transition: reset ? "none" : undefined }}
        >
          <div className="droid__head-container">
            <div className="droid__antenna" />
            <div className="droid__antenna" />
            <div className="droid__head" />
          </div>
          <div className="droid__body" />
        </div>
      </div>
    </div>
  );
}

/* Robotics: a robot follows a curved line, and a readout shows what its sensors and motors are doing. The robot's position
   comes from the path itself and the readout from how sharply the path is bending there. */
export function RoboticsSim({ running = true }: { running?: boolean }) {
  const path = useRef<SVGPathElement>(null);
  const bot = useRef<SVGGElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const dist = useRef(0);
  useEffect(() => {
    const p = path.current, b = bot.current, r = root.current;
    if (!p || !b || !r) return;
    const len = p.getTotalLength();
    const q = (sel: string) => r.querySelector<HTMLElement>(sel)!;
    const lm = q("[data-lm]"), rm = q("[data-rm]"), say = q("[data-say]"), sl = q("[data-sl]"), sr = q("[data-sr]");
    const place = (t: number) => {
      const at = (d: number) => p.getPointAtLength(((d % len) + len) % len);
      const a = at(t), n = at(t + 3), f = at(t + 26);
      const ang = (Math.atan2(n.y - a.y, n.x - a.x) * 180) / Math.PI;
      b.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${ang})`);
      const ahead = (Math.atan2(f.y - n.y, f.x - n.x) * 180) / Math.PI;
      let turn = ahead - ang;
      turn = ((turn + 540) % 360) - 180; // positive = bending right on screen
      const k = Math.max(-1, Math.min(1, turn / 40));
      const left = 70 + 30 * k, right = 70 - 30 * k;
      lm.style.transform = `scaleX(${left / 100})`;
      rm.style.transform = `scaleX(${right / 100})`;
      // text and data attributes force layout and style work, so only touch them when they change
      const text = k > 0.25 ? "Turning right" : k < -0.25 ? "Turning left" : "Going straight";
      if (say.textContent !== text) say.textContent = text;
      const onL = String(k < -0.12), onR = String(k > 0.12);
      if (sl.dataset.on !== onL) sl.dataset.on = onL;
      if (sr.dataset.on !== onR) sr.dataset.on = onR;
    };
    if (reduced()) { place(len * 0.18); return; }
    place(dist.current);
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      dist.current += ((now - last) / 1000) * 95;
      last = now;
      place(dist.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return (
    <div className="sim sim-robotics" ref={root}>
      <svg className="sim-stage" viewBox="0 0 320 200" aria-hidden="true">
        <rect className="sim-floor" x="1" y="1" width="318" height="198" rx="14" />
        <path ref={path} className="sim-line" d="M44 135 C44 62 112 44 150 86 S256 134 276 72 S208 34 162 130 S60 168 44 135 Z" />
        <g ref={bot} className="sim-bot">
          <path className="sim-beam" d="M14 0 L52 -22 A52 52 0 0 1 52 22 Z" />
          <rect x="-14" y="-10" width="28" height="20" rx="5" />
          <circle className="sim-sensor" cx="13" cy="-6" r="3" />
          <circle className="sim-sensor" cx="13" cy="6" r="3" />
          <rect className="sim-wheel" x="-10" y="-13" width="12" height="4" rx="2" />
          <rect className="sim-wheel" x="-10" y="9" width="12" height="4" rx="2" />
        </g>
      </svg>
      <div className="sim-hud" aria-hidden="true">
        <p data-say>Going straight</p>
        <dl>
          <div><dt>Left sensor</dt><dd><i data-sl="false" /></dd></div>
          <div><dt>Right sensor</dt><dd><i data-sr="false" /></dd></div>
          <div><dt>Left motor</dt><dd className="bar"><b data-lm /></dd></div>
          <div><dt>Right motor</dt><dd className="bar"><b data-rm /></dd></div>
        </dl>
      </div>
    </div>
  );
}

/* AI and ML: the whole story in three steps. Collect labelled examples, train while accuracy climbs, then predict new
   shapes. The numbers are an illustration. */
const LABELS = ["Circle", "Square", "Triangle"];
const SHAPE_BARS = [[94, 4, 2], [3, 92, 5], [6, 5, 89]];
const STAGES = ["Collect", "Train", "Predict"];
function Shape({ k }: { k: number }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {k === 0 && <circle cx="50" cy="50" r="32" />}
      {k === 1 && <rect x="20" y="20" width="60" height="60" rx="4" />}
      {k === 2 && <path d="M50 16 L84 80 H16 Z" />}
    </svg>
  );
}
export function AiSim({ running = true }: { running?: boolean }) {
  // tick counts 0.. : collect 0-3, train 4-6, predict 7-12 (a new shape every 2 ticks)
  const [tick, setTick] = useState(reduced() ? 9 : 0);
  useEffect(() => {
    if (reduced() || !running) return;
    const id = setInterval(() => setTick((n) => (n + 1) % 13), 470);
    return () => clearInterval(id);
  }, [running]);
  const stage = tick < 4 ? 0 : tick < 7 ? 1 : 2;
  const shown = Math.min(9, tick * 3);
  const pred = Math.floor(Math.max(0, tick - 7) / 2) % 3;
  const acc = tick < 4 ? 0 : Math.min(1, (tick - 3) / 3);
  return (
    <div className="sim sim-ai">
      <ol className="sim-steps" aria-hidden="true">
        {STAGES.map((n, i) => <li key={n} data-on={stage === i} data-done={stage > i}><span>{i + 1}</span>{n}</li>)}
      </ol>
      <div className="sim-ai-body" aria-hidden="true">
        {stage === 0 && (
          <div className="sim-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="sim-ex" data-show={i < shown}><Shape k={i % 3} /><em>{LABELS[i % 3]}</em></div>
            ))}
          </div>
        )}
        {stage === 1 && (
          <div className="sim-train">
            <svg viewBox="0 0 200 110">
              <path className="sim-axis" d="M10 100 H190 M10 100 V10" />
              <path className="sim-curve" d="M10 96 C50 90 70 50 100 38 S160 20 190 16" style={{ strokeDashoffset: 1 - acc }} pathLength={1} />
            </svg>
            <p>Accuracy <strong>{Math.round(35 + acc * 59)}%</strong></p>
          </div>
        )}
        {stage === 2 && (
          <div className="sim-predict">
            <div className="sim-card">
              <div key={pred} className="sim-shape"><Shape k={pred} /></div>
              <span className="sim-scan" key={`s${pred}`} />
            </div>
            <ul className="sim-bars">
              {LABELS.map((l, k) => (
                <li key={l} data-top={k === pred}>
                  <span>{l}</span>
                  <i><b style={{ transform: `scaleX(${SHAPE_BARS[pred][k] / 100})` }} /></i>
                  <em>{SHAPE_BARS[pred][k]}%</em>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeProgramsLab() {
  const [active, setActive] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const box = useRef<HTMLDivElement>(null);

  // The rotation starts when the lab scrolls into view and holds while it is off screen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = inView && !userPaused;
  const pick = (i: number, focus = false) => {
    setActive(i);
    if (focus) refs.current[i]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = TRACKS.length;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); pick((i + 1) % n, true); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); pick((i + n - 1) % n, true); }
  };

  return (
    <section className="rh-sec" aria-labelledby="rh-programs">
      <div className="rh-wrap">
        <div className="rh-head">
          <h2 id="rh-programs">Three tracks. One habit: build something.</h2>
          <p className="rh-lede">Pick a track to see what students do in it.</p>
        </div>

        <div className="rh-lab" ref={box}>
          <div className="rh-lab-tabs" role="tablist" aria-label="Programs" aria-orientation="vertical">
            {TRACKS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => { refs.current[i] = el; }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active === i}
                aria-controls="rh-lab-panel"
                tabIndex={active === i ? 0 : -1}
                className="rh-lab-tab"
                onClick={() => pick(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <h3>{t.name}</h3>
                <p>{t.text}</p>
                <span className="rh-lab-track" aria-hidden="true">
                  {active === i && (
                    <span
                      className="rh-lab-fill"
                      data-running={running}
                      style={{ "--dwell": `${t.dwell}s` } as React.CSSProperties}
                      onAnimationEnd={() => setActive((a) => (a + 1) % TRACKS.length)}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="rh-lab-panel" role="tabpanel" id="rh-lab-panel" aria-labelledby={`tab-${TRACKS[active].id}`}>
            <div className="rh-lab-screen" key={TRACKS[active].id}>
              {active === 0 && <CodingSim running={inView} />}
              {active === 1 && <RoboticsSim running={inView} />}
              {active === 2 && <AiSim running={inView} />}
            </div>
            <div className="rh-lab-bar">
              <p className="rh-lab-note">Simulation {active + 1} of {TRACKS.length}: {TRACKS[active].note}</p>
              <button
                type="button"
                className="rh-ticker-btn"
                aria-pressed={userPaused}
                aria-label={userPaused ? "Resume switching between tracks" : "Pause switching between tracks"}
                onClick={() => setUserPaused((p) => !p)}
              >
                {userPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
              </button>
            </div>
            <ul className="rh-lab-meta">
              {META.map((m) => <li key={m} className="rh-tag">{m}</li>)}
            </ul>
          </div>
        </div>

        <p className="rh-more">
          <Link href="/robocoders/programs" className="rh-link">See every program</Link>
        </p>
      </div>
    </section>
  );
}
