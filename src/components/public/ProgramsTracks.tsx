"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Brain, Code2, Cpu } from "lucide-react";
import { brandHref } from "@/lib/brand-host";

const TRACKS = [
  {
    name: "Coding fundamentals",
    Icon: Code2,
    text: "Block and text programming that builds the logic behind every app and game.",
    topics: [
      ["Block programming in Scratch and Scratch Jr.", "A game where a sprite moves and reacts"],
      ["Text programming in Python", "A program you type, run and fix"],
      ["Apps and video games", "A small app or game to share"],
      ["Computational thinking", "A big problem broken into steps"],
    ],
  },
  {
    name: "Robotics and electronics",
    Icon: Cpu,
    text: "Arduino, ESP32 and sensors. Students wire, program and test robots that move.",
    topics: [
      ["Wiring and testing circuits", "A circuit that lights an LED"],
      ["Programming ESP32 and Arduino boards", "A program that drives the motors"],
      ["Reading sensors", "Readings your robot can act on"],
      ["Robots that follow lines and avoid obstacles", "A robot that finds its own way"],
    ],
  },
  {
    name: "AI and machine learning",
    Icon: Brain,
    text: "Machine learning and neural network basics, taught by building apps that decide.",
    topics: [
      ["Collecting and labelling examples", "A labelled set of examples"],
      ["Training a model", "A model that gets more accurate"],
      ["Predicting on new inputs", "Answers for things it hasn't seen"],
      ["Neural network basics", "An idea of how the model decides"],
    ],
  },
];
const DWELL = 4.4; // seconds each track stays open before the next one starts: every step lit by about 2s, then a beat to read
const META = ["Ages 6 to 18", "8 to 12 weeks", "Beginner to advanced"];

/* What is inside each track, as a syllabus: pick a track and its topics lay themselves out in order, each with what the
   student makes at that point. The simulations are in the hero; this is the detail behind them. Arrow keys move
   between tracks. */
export default function ProgramsTracks() {
  const [t, setT] = useState(0);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const cur = TRACKS[t];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const auto = !picked && !still;
  const last = cur.topics.length - 1;
  const shown = still ? last : step;

  // the steps light up one after another, 1 to 4; once a person has picked a track they keep looping
  useEffect(() => {
    if (still || !inView) return;
    if (step < last) {
      const id = setTimeout(() => setStep((s) => s + 1), step === 0 ? 600 : 700);
      return () => clearTimeout(id);
    }
    if (picked) {
      const id = setTimeout(() => setStep(0), 1800);
      return () => clearTimeout(id);
    }
  }, [step, last, inView, picked, still]);

  const go = (i: number) => { setT(i); setStep(0); };

  const pick = (i: number, focus = false) => {
    setPicked(true);
    go(i);
    if (focus) refs.current[i]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = TRACKS.length;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); pick((i + 1) % n, true); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); pick((i + n - 1) % n, true); }
  };

  return (
    <section id="tracks" className="rh-sec pg-lab" aria-labelledby="pg-tracks">
      <div className="rh-wrap">
        <div className="rh-head">
          <h2 id="pg-tracks">Three tracks. One habit: build something.</h2>
          <p className="rh-lede">Every track runs 8 to 12 weeks, from beginner to advanced. Pick one to see what students cover and make.</p>
        </div>

        <div className="pg-explore" ref={box}>
          <div className="pg-tabs" role="tablist" aria-label="Tracks" aria-orientation="vertical">
            {TRACKS.map(({ name, Icon, text }, i) => (
              <button
                key={name}
                ref={(el) => { refs.current[i] = el; }}
                type="button"
                role="tab"
                id={`pg-tab-${i}`}
                aria-selected={t === i}
                aria-controls="pg-syl"
                tabIndex={t === i ? 0 : -1}
                onClick={() => pick(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="rh-chip-ico"><Icon size={18} aria-hidden="true" /></span>
                <h3>{name}</h3>
                <p>{text}</p>
                {t === i && auto && (
                  <i
                    key={`bar-${t}`}
                    className="pg-tab-bar"
                    style={{ animationDuration: `${DWELL}s`, animationPlayState: inView ? "running" : "paused" }}
                    onAnimationEnd={() => go((t + 1) % TRACKS.length)}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="pg-syl" id="pg-syl" role="tabpanel" aria-labelledby={`pg-tab-${t}`}>
            <div className="pg-syl-head">
              <b>What you cover and make</b>
              <ul className="rh-tags">
                {META.map((m) => <li key={m} className="rh-tag">{m}</li>)}
              </ul>
            </div>
            <ol className="pg-topics" key={t}>
              {cur.topics.map(([topic, make], i) => (
                <li key={topic} data-state={i < shown ? "done" : i === shown ? "active" : "todo"} style={{ "--i": i } as React.CSSProperties}>
                  <span>{i + 1}</span>
                  <div>
                    <h4>{topic}</h4>
                    <p>You make: {make}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="rh-actions pg-syl-go">
              <Link href={brandHref("/robocoders/online-classes")} className="rh-btn rh-btn--primary">Book a trial class</Link>
              <Link href={brandHref("/robocoders/for-parents")} className="rh-btn rh-btn--ghost">See plans for parents</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
