"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, Check, Lock } from "lucide-react";
import PlayKit from "../public/PlayKit";

const LESSONS = [
  { title: "Move the robot", text: "Cards and directions" },
  { title: "Repeat with loops", text: "Do more with less" },
  { title: "Read a sensor", text: "Make it react" },
  { title: "Build your first robot", text: "Put it together" },
];

/* The Academy's signature: lesson one, playable. The lesson list sits on paper beside the Play Kit board. Steering the
   droid to the star completes the lesson: the rail fills, lesson two opens as "next", and an invitation to save it appears. */
export default function LessonOne() {
  const [done, setDone] = useState(false);
  const count = done ? 1 : 0;

  return (
    <div className="ac-lesson">
      <aside className="ac-rail" aria-label="Course lessons">
        <h2>First course: Robot basics</h2>
        <div>
          <p className="ac-rail-count"><span>{count} of {LESSONS.length} lessons</span><span>{count * 25}%</span></p>
          <div className="ac-rail-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={count * 25} aria-label="Course progress">
            <i style={{ "--p": `${count * 25}%` } as React.CSSProperties} />
          </div>
        </div>
        <ol>
          {LESSONS.map((l, i) => {
            const state = i === 0 ? (done ? "done" : "active") : i === 1 && done ? "active" : "locked";
            return (
              <li key={l.title} data-state={state}>
                <span aria-hidden="true">{state === "done" ? <Check size={15} /> : state === "locked" ? <Lock size={13} /> : i + 1}</span>
                <div>
                  <b>{l.title}</b>
                  <small>{state === "active" && i === 1 ? "Next: sign up to open it" : l.text}</small>
                </div>
              </li>
            );
          })}
        </ol>
      </aside>

      <div className="ac-stage">
        <PlayKit bare title="Lesson 1: Move the robot" onWin={() => setDone(true)} />
        {done && (
          <div className="ac-done" role="status">
            <Award size={24} aria-hidden="true" />
            <p>Lesson 1 complete. Save your progress with a free account.</p>
            <Link href="/academy/signup" className="rh-btn rh-btn--primary">Create free account</Link>
          </div>
        )}
      </div>
    </div>
  );
}
