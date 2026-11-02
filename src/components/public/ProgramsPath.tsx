"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { AiSim, CodingSim, RoboticsSim } from "./HomeProgramsLab";

const TRACKS = [
  { name: "Coding", note: "Blocks run a sprite", dwell: 4.6, Sim: CodingSim },
  { name: "Robotics", note: "A robot follows a line", dwell: 7.2, Sim: RoboticsSim },
  { name: "AI and ML", note: "A model recognises shapes", dwell: 6.3, Sim: AiSim },
];

/* The programs hero's one moment: the three tracks as live simulations. Each is a real run (the sprite does exactly
   what the lit block says, the robot's motors follow the bend in the line, the model trains then predicts). They take
   turns while the hero is on screen, the bar under the title shows when the next one starts, a chip jumps to a track,
   and the button holds the current one. Reduced motion shows each simulation's finished frame and never advances. */
export default function ProgramsPath() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { Sim, dwell, note } = TRACKS[active];

  return (
    <div className="bs pg-sim" ref={box}>
      <div className="bs-bar">
        <span>Try a track</span>
        <em>Simulation {active + 1} of {TRACKS.length}</em>
        <i
          key={`bar-${active}`}
          className="pg-bar"
          style={{ animationDuration: `${dwell}s`, animationPlayState: inView && !paused ? "running" : "paused" }}
          onAnimationEnd={() => setActive((a) => (a + 1) % TRACKS.length)}
          aria-hidden="true"
        />
      </div>

      <div className="rh-lab-screen pg-screen" key={active} role="img" aria-label={`${TRACKS[active].name} simulation: ${note}`}>
        <Sim />
      </div>

      <div className="bs-foot">
        <ol className="bs-steps">
          {TRACKS.map((t, i) => (
            <li key={t.name}>
              <button type="button" data-state={i === active ? "active" : "todo"} aria-pressed={i === active} onClick={() => setActive(i)}>
                {t.name}
              </button>
            </li>
          ))}
        </ol>
        <p className="pg-note">{note}</p>
        <button type="button" className="bs-pause" aria-pressed={paused} aria-label={paused ? "Resume switching between tracks" : "Pause switching between tracks"} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
