"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { KitArt, PlayArt } from "./HomeProducts";
import JuniorArt from "./JuniorArt";
import { SimArt } from "./SimulatorCard";
import { StudioArt } from "./StudioCard";

const OPTIONS = [
  { task: "Code on a screen", short: "Code", name: "RoboCoders Studio", href: "#studio", Art: () => <StudioArt v="school" />, text: "Block coding, Python, AI experiments and robot control in one app.", tags: ["Ages 8+", "Offline or online"] },
  { task: "Test a circuit first", short: "Test", name: "RoboCoders Simulator", href: "#simulator", Art: SimArt, text: "Wire LEDs, buttons and sensors on a virtual ESP32, with live pin readings.", tags: ["Same pins as the real board"] },
  { task: "Build a real robot", short: "Build", name: "Robotics Kit, ESP32 Edition", href: "#robotics-kit", Art: KitArt, text: "A custom ESP32 board, sensors, motors and chassis with 40+ guided projects.", tags: ["40+ projects", "Block and C coding"] },
  { task: "Start robotics with no code", short: "Junior", name: "Junior Robotics Kit", href: "#junior-kit", Art: JuniorArt, text: "Plug a button, LEDs and a buzzer into a board and make things happen. Made for grades 1 to 3.", tags: ["Grades 1 to 3", "No code needed"] },
  { task: "Learn without a screen", short: "Play", name: "RoboCoders Play Kit", href: "#play-kit", Art: PlayArt, text: "Lay out direction cards and the robot follows them, step by step.", tags: ["Screen-free", "Learn by playing"] },
];
const DWELL = 5.2; // seconds: a little over one full loop (5s) of the product's own animation

/* The products hero: pick what you want to do and the product that does it plays its own animation. Studio cycles its
   tabs, the Simulator lights an LED, the kit sends signals to its parts, the Play Kit's robot follows its cards. They
   take turns while on screen (the bar under the title shows when), a chip jumps to one, and the button holds it. */
export default function ProductsFinder() {
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

  const { task, name, href, Art, text, tags } = OPTIONS[active];

  return (
    <div className="bs pd-find" ref={box}>
      <div className="bs-bar">
        <span>What do you want to do?</span>
        <em>Product {active + 1} of {OPTIONS.length}</em>
        <i
          key={`bar-${active}`}
          className="pg-bar"
          style={{ animationDuration: `${DWELL}s`, animationPlayState: inView && !paused ? "running" : "paused" }}
          onAnimationEnd={() => setActive((a) => (a + 1) % OPTIONS.length)}
          aria-hidden="true"
        />
      </div>

      <div className="rh-pv-art pd-stage" key={active} role="img" aria-label={`${name}: ${text}`}>
        <Art />
      </div>

      <div className="pd-info" aria-live="polite">
        <div>
          <h3>{task}</h3>
          <p className="pd-info-name">{name}</p>
          <p>{text}</p>
          <ul className="pd-info-tags">{tags.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <a href={href} className="pd-info-go">See it</a>
      </div>

      <div className="bs-foot">
        <ol className="bs-steps">
          {OPTIONS.map((o, i) => (
            <li key={o.name}>
              <button type="button" data-state={i === active ? "active" : "todo"} aria-pressed={i === active} onClick={() => setActive(i)}>
                {o.short}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="bs-pause" aria-pressed={paused} aria-label={paused ? "Resume switching between products" : "Pause switching between products"} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
