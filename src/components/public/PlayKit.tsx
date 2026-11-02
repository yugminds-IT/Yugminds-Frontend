"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, CornerUpLeft, CornerUpRight, Play, RotateCcw, Star, Trash2, Undo2, type LucideIcon } from "lucide-react";
import "./droid.css";

type Move = "forward" | "left" | "right" | "uturn";
const CARDS: Record<Move, { label: string; Icon: LucideIcon; turn: number }> = {
  forward: { label: "Forward", Icon: ArrowUp, turn: 0 },
  left: { label: "Left", Icon: CornerUpLeft, turn: -90 },
  right: { label: "Right", Icon: CornerUpRight, turn: 90 },
  uturn: { label: "U-Turn", Icon: Undo2, turn: 180 },
};
const SIZE = 5;
const MAX_CARDS = 12;
const START = { x: 0, y: 4, rot: 0 };
const GOAL = { x: 4, y: 0 };
const ROCKS = [{ x: 2, y: 1 }, { x: 2, y: 3 }, { x: 4, y: 3 }];
const STEP = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
const FACING = ["up", "right", "down", "left"];
// the demo's route: up the left edge, turn right, along the top row to the star
const DEMO: Move[] = ["forward", "forward", "forward", "forward", "right", "forward", "forward", "forward", "forward"];
const STEPS = [
  { name: "Lay out the cards", text: "Kids arrange direction cards (Forward, Left, Right, U-Turn) in the order they want." },
  { name: "The robot reads them", text: "Place a card on the robot and it recognises the command. No screen, no typing." },
  { name: "Watch it move", text: "Right card, it turns right. U-Turn card, it turns around. Kids see their logic come alive." },
];

type Robot = typeof START;
type Status = "idle" | "running" | "win" | "crash" | "done";
const MESSAGES: Record<Status, string> = {
  idle: "Tap cards to build a path, then press Run.",
  running: "The droid is reading your cards.",
  win: "You reached the star.",
  crash: "The droid bumped into a rock. Change the cards and try again.",
  done: "Out of cards. The droid didn't reach the star yet.",
};

function apply(r: Robot, m: Move): Robot {
  if (m !== "forward") return { ...r, rot: r.rot + CARDS[m].turn };
  const { dx, dy } = STEP[(((r.rot / 90) % 4) + 4) % 4];
  return { ...r, x: r.x + dx, y: r.y + dy };
}
const blocked = ({ x, y }: Robot) => x < 0 || y < 0 || x >= SIZE || y >= SIZE || ROCKS.some((k) => k.x === x && k.y === y);

/* The Play Kit as a simulator. The droid stands on a 5 by 5 board; cards go into a path and Run plays them one by one:
   Forward steps ahead, the others turn on the spot. While nobody has touched it, a demo lays out a route, runs it and
   starts over. Tapping any card takes over. The three steps beside it light up with what the droid is doing. */
export default function PlayKit({ bare = false, onWin, title = "Play Kit simulator" }: { bare?: boolean; onWin?: () => void; title?: string }) {
  const [program, setProgram] = useState<Move[]>([]);
  const [robot, setRobot] = useState<Robot>(START);
  const [step, setStep] = useState<number | null>(null);
  const [phase, setPhase] = useState<"read" | "move">("read");
  const [status, setStatus] = useState<Status>("idle");
  const [demo, setDemo] = useState(true);
  const [inView, setInView] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const robotRef = useRef<Robot>(START);
  const running = step !== null;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // play the cards: a short read of each card, then the droid moves
  useEffect(() => {
    if (step === null) return;
    const t1 = setTimeout(() => {
      const next = apply(robotRef.current, program[step]);
      if (blocked(next)) { setStatus("crash"); setStep(null); return; }
      robotRef.current = next;
      setRobot(next);
      setPhase("move");
    }, 380);
    const t2 = setTimeout(() => {
      const r = robotRef.current;
      if (r.x === GOAL.x && r.y === GOAL.y) { setStatus("win"); setStep(null); }
      else if (step + 1 >= program.length) { setStatus("done"); setStep(null); }
      else { setPhase("read"); setStep(step + 1); }
    }, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step, program]);

  // a win only counts once a person has taken over from the demo (the Academy's Lesson One listens for it)
  useEffect(() => { if (status === "win" && !demo) onWin?.(); }, [status, demo]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetBoard = () => { setStep(null); robotRef.current = START; setRobot(START); setStatus("idle"); setPhase("read"); };
  const run = () => { robotRef.current = START; setRobot(START); setStatus("running"); setPhase("read"); setStep(0); };

  // the demo, until a person takes over (and never with reduced motion)
  useEffect(() => {
    if (!demo || !inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (running) return;
    let id: ReturnType<typeof setTimeout>;
    if (status === "win" || status === "done" || status === "crash") {
      id = setTimeout(() => { setProgram([]); resetBoard(); }, 2600);
    } else if (program.length < DEMO.length) {
      id = setTimeout(() => setProgram((p) => [...p, DEMO[p.length]]), 480);
    } else {
      id = setTimeout(run, 700);
    }
    return () => clearTimeout(id);
  }, [demo, inView, running, status, program.length]);

  const take = () => { if (demo) { setDemo(false); setProgram([]); resetBoard(); } };
  const add = (m: Move) => {
    if (running) return;
    if (demo) { setDemo(false); setProgram([m]); resetBoard(); return; }
    if (program.length >= MAX_CARDS) return;
    setProgram((p) => [...p, m]);
    if (status !== "idle") resetBoard();
  };
  const removeAt = (i: number) => { if (running) return; take(); setProgram((p) => p.filter((_, k) => k !== i)); if (status !== "idle") resetBoard(); };

  const stage = status === "win" ? 2 : running ? (phase === "read" ? 1 : 2) : 0;
  const facing = FACING[(((robot.rot / 90) % 4) + 4) % 4];
  const cx = (n: number) => (n + 0.5) * 20;

  return (
    <div className="pk" ref={box} data-bare={bare}>
      {!bare && <ol className="pk-steps" aria-label="How the Play Kit works">
        {STEPS.map((s, i) => (
          <li key={s.name} data-state={i < stage ? "done" : i === stage ? "active" : "todo"}>
            <span>{i + 1}</span>
            <div><b>{s.name}</b><p>{s.text}</p></div>
          </li>
        ))}
      </ol>}

      <div className="bs pk-bench">
        <div className="bs-bar">
          <span>{title}</span>
          <em aria-live="polite">{demo ? "Demo: tap a card to play" : MESSAGES[status]}</em>
        </div>

        <div className="pk-body">
          <div className="pk-board" role="img" aria-label={`A five by five board. The droid is facing ${facing}. The goal is the star in the top right corner.`}>
            {ROCKS.map((k) => <span key={`${k.x}${k.y}`} className="pk-rock" style={{ left: `${k.x * 20}%`, top: `${k.y * 20}%` }} />)}
            <span className="pk-goal" style={{ left: `${GOAL.x * 20}%`, top: `${GOAL.y * 20}%` }}><Star size="60%" fill="currentColor" aria-hidden="true" /></span>
            <div
              className="droid-mini pk-droid"
              data-moving={phase === "move" && running}
              data-flip={facing === "left"}
              style={{ transform: `translate(calc(${cx(robot.x)}cqw - 50%), calc(${cx(robot.y)}cqw - 3.75em))` }}
              aria-hidden="true"
            >
              <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
              <div className="droid__body" />
            </div>
            {status === "win" && <span className="pk-win" aria-hidden="true">Star!</span>}
          </div>

          <div className="pk-ctl">
            <div className="pk-cards" role="group" aria-label="Direction cards">
              {(Object.keys(CARDS) as Move[]).map((m) => {
                const { Icon, label } = CARDS[m];
                return (
                  <button key={m} type="button" onClick={() => add(m)} disabled={running || (!demo && program.length >= MAX_CARDS)}>
                    <Icon size={22} aria-hidden="true" /><span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pk-path">
              <b>Your path ({program.length}/{MAX_CARDS})</b>
              <ul>
                {program.length === 0 && <li className="pk-empty">Your cards will appear here</li>}
                {program.map((m, i) => {
                  const { Icon, label } = CARDS[m];
                  return (
                    <li key={`${i}-${m}`} data-active={step === i}>
                      <button type="button" onClick={() => removeAt(i)} aria-label={`Remove card ${i + 1}: ${label}`} disabled={running}><Icon size={16} aria-hidden="true" /></button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="pk-actions">
              <button type="button" className="rh-btn rh-btn--primary" onClick={() => { if (demo) setDemo(false); if (program.length) { resetBoard(); run(); } }} disabled={running || (!demo && program.length === 0)}>
                <Play size={16} aria-hidden="true" /> Run
              </button>
              <button type="button" className="rh-btn rh-btn--ghost" onClick={() => { take(); resetBoard(); }}><RotateCcw size={16} aria-hidden="true" /> Reset</button>
              <button type="button" className="rh-btn rh-btn--ghost" onClick={() => { take(); setProgram([]); resetBoard(); }} disabled={running || (!demo && program.length === 0)}><Trash2 size={16} aria-hidden="true" /> Clear</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
