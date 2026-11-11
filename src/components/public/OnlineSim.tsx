"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Clock, GraduationCap, Play } from "lucide-react";
import "./droid.css";

const Droid = ({ className }: { className: string }) => (
  <div className={`droid-mini ${className}`} aria-hidden="true">
    <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
    <div className="droid__body" />
  </div>
);

const SCENES = ["Self-paced course", "Live 1:1 class"];
const MS = 8000;

/* The online classes hero: the two ways to learn, played as short loops. Self-paced: a lesson plays, a quiz question is
   answered, the lesson completes. Live: the joining link opens, then a tutor and a learner talk. The scenes take turns
   while on screen; picking one holds it. Resting styles are the finished state, so reduced motion shows the result. */
export default function OnlineSim() {
  const [scene, setScene] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(true);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || picked || !inView) return;
    const id = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), MS);
    return () => clearTimeout(id);
  }, [scene, still, picked, inView]);

  return (
    <div className="bs ol-sim" ref={box}>
      <div className="bs-bar">
        <span>RoboCoders Online</span>
        <em>{SCENES[scene]}</em>
      </div>

      <div className="ol-body" key={scene} role="img" aria-label={scene === 0 ? "A self-paced lesson playing, a quiz question answered, and the lesson completing." : "A live one-on-one class: the joining link opens, then a tutor and a learner talk."}>
        {scene === 0 ? (
          <div className="ol-a" aria-hidden="true">
            <div className="ol-player">
              <div className="ol-vid">
                <ul className="ol-code"><li>repeat 4</li><li>move 10 steps</li></ul>
                <div className="ol-run"><Droid className="ol-droid" /></div>
                <i className="ol-floor" />
              </div>
              <span className="ol-play"><Play size={16} /></span>
              <div className="ol-prog"><i /></div>
              <small>Lesson 3: Loops</small>
            </div>
            <div className="ol-quiz">
              <p>Which block repeats an action?</p>
              <ul>
                <li>move 10 steps</li>
                <li className="ol-pick">repeat 4 <Check size={14} /></li>
                <li>turn 90 degrees</li>
              </ul>
            </div>
            <p className="ol-done"><Check size={16} /> Lesson complete</p>
          </div>
        ) : (
          <div className="ol-b" aria-hidden="true">
            <p className="ol-note"><Clock size={14} /> Joining link opens 10 minutes before <em><i />Live now</em></p>
            <div className="ol-room">
              <div className="ol-tiles">
                <div className="ol-tile">
                  <span className="ol-av"><GraduationCap size={22} /></span>
                  <b>Tutor</b>
                  <p className="ol-bub ol-bub--a">What do you want to build today?</p>
                </div>
                <div className="ol-tile">
                  <span className="ol-av ol-av--me"><Bot size={22} /></span>
                  <b>You</b>
                  <p className="ol-bub ol-bub--b">A robot that moves!</p>
                </div>
              </div>
              <div className="ol-share">
                <small>Shared screen</small>
                <ul className="ol-blocks">
                  <li className="ol-k1">when flag clicked</li>
                  <li className="ol-k2">repeat 4</li>
                  <li className="ol-k3">move 10 steps</li>
                </ul>
                <div className="ol-stage"><div className="ol-go"><Droid className="ol-droid" /></div><i className="ol-floor" /></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bs-foot">
        <ol className="bs-steps">
          {SCENES.map((s, i) => (
            <li key={s}>
              <button type="button" data-state={i === scene ? "active" : "todo"} aria-pressed={i === scene} onClick={() => { setPicked(true); setScene(i); }}>
                {s}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
