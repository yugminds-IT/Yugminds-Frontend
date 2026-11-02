"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Add a book by adding a line here. The level filters are built from the levels in this list.
const BOOKS = [
  { id: "kids-1", level: "Kids Edition", src: "/kids Level 1 TextBook.png", title: "Tech Explorers, Level 1 Kids Edition", nep: false, fresh: false },
  { id: "kids-2", level: "Kids Edition", src: "/kids-level-2-textbook.png", title: "Tech Explorers, Level 2 Kids Edition", nep: false, fresh: false },
  { id: "l1", level: "Level 1", src: "/Level 1 TextBook.png", title: "Tech Explorers, Level 1", nep: true, fresh: false },
  { id: "l2", level: "Level 2", src: "/Level 2 TextBook .png", title: "Tech Explorers, Level 2", nep: true, fresh: false },
  { id: "l3", level: "Level 3", src: "/level-3-textbook.png", title: "Tech Explorers, Level 3", nep: false, fresh: true },
];
const LEVELS = ["All levels", ...Array.from(new Set(BOOKS.map((b) => b.level)))];
const SPOT_MS = 3600;

/* The textbook library as a shelf. Filter by level, and a spotlight lifts one book after another with its details
   below; pointing at or tapping a book takes over. The shelf scrolls sideways when there are more books than fit.
   Reduced motion never moves the spotlight on its own. */
export default function ProgramsBooks() {
  const [level, setLevel] = useState(0);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const shown = level === 0 ? BOOKS : BOOKS.filter((b) => b.level === LEVELS[level]);
  const cur = shown[Math.min(active, shown.length - 1)];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || picked || !inView || shown.length < 2) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % shown.length), SPOT_MS);
    return () => clearTimeout(id);
  }, [active, still, picked, inView, shown.length]);

  const pickLevel = (i: number) => { setLevel(i); setActive(0); };
  const pickBook = (i: number) => { setPicked(true); setActive(i); };

  return (
    <section className="rh-sec rh-dark" aria-labelledby="pg-books">
      <div className="rh-wrap" ref={box}>
        <div className="pg-books-head">
          <div className="pg-books-copy">
            <h2 id="pg-books">Textbooks for every level.</h2>
            <p className="rh-lede">Illustrated guides to programming, AI and robotics, with hands-on exercises and projects in every chapter.</p>
          </div>
          <div className="pg-levels" role="group" aria-label="Filter books by level">
            {LEVELS.map((l, i) => (
              <button key={l} type="button" aria-pressed={level === i} onClick={() => pickLevel(i)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="pg-shelf-wrap">
          <ul className="pg-shelf" key={level}>
            {shown.map((b, i) => (
              <li key={b.id} style={{ "--i": i } as React.CSSProperties}>
                <button
                  type="button"
                  className="pg-book"
                  data-state={cur.id === b.id ? "active" : "idle"}
                  aria-pressed={cur.id === b.id}
                  aria-label={b.title}
                  onClick={() => pickBook(i)}
                  onMouseEnter={() => pickBook(i)}
                  onFocus={() => pickBook(i)}
                >
                  <Image src={b.src} alt="" fill sizes="(max-width: 960px) 40vw, 14vw" />
                </button>
              </li>
            ))}
          </ul>
          <div className="pg-plank" aria-hidden="true" />
        </div>

        <div className="pg-detail" aria-live="polite" key={cur.id}>
          <h3>{cur.title}</h3>
          <p>A comprehensive guide to coding, AI and robotics.</p>
          <ul className="rh-tags">
            <li className="rh-tag">{cur.level}</li>
            {cur.nep && <li className="rh-tag">As per NEP 2020</li>}
            {cur.fresh && <li className="rh-tag">New edition</li>}
            <li className="rh-tag">Hands-on projects</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
