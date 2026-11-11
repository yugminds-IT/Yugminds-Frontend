"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const BEATS = [
  { name: "The gap", text: "Students were eager to learn technology. The programs on offer were too theoretical to prepare them for the future.", chip: "Curious students" },
  { name: "The answer", text: "YugMinds started RoboCoders so every class ends with something the student built: a program, a circuit or a robot.", chip: "Real parts, real projects" },
  { name: "Today", text: "We teach over 2,000 students across 20+ partner schools. Our tutors bring industry experience and a love of teaching, so students don't just learn. They make things.", chip: "2,000+ students, 20+ schools" },
];

/* The story told as three beats. As each beat scrolls to the middle of the screen it lights up, the line fills down to
   it, and the photo beside it changes: it starts grey (the gap) and turns to colour once the answer arrives. The photo
   stays in view while the beats scroll. Reduced motion shows every beat finished and the photo in colour. */
export default function AboutStory() {
  const [active, setActive] = useState(0);
  const [still, setStill] = useState(false);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); setActive(BEATS.length - 1); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-40% 0px -40% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="rh-wrap">
      <h2 id="ab-story" className="ab-story-h">Students wanted to learn technology. Classes didn&apos;t let them build it.</h2>
      <div className="ab-story">
        <div className="ab-story-media">
          <div className="rh-photo ab-story-photo" data-stage={active}>
            <Image src={`/${encodeURI("About Us.jpg")}`} alt="A tutor helping two students assemble a robot" fill sizes="(max-width: 960px) 100vw, 58vw" />
            <span key={active} className="ab-story-chip">{BEATS[active].chip}</span>
          </div>
        </div>

        <ol className="ab-beats">
          {BEATS.map((b, i) => (
            <li
              key={b.name}
              ref={(el) => { refs.current[i] = el; }}
              data-i={i}
              data-state={still || i < active ? "done" : i === active ? "active" : "todo"}
              className="ab-beat"
            >
              <h3>{b.name}</h3>
              <p>{b.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
