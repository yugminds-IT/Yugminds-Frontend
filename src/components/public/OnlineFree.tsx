"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, Clock, Eye, GraduationCap, Lock, PlayCircle } from "lucide-react";

type Props = {
  courses: { title: string; href: string }[];
  trialMinutes?: number;
  hrefs: { demo: string; trial: string; preview: string };
};

const MS = 7000;
const RESUME_MS = 12000;
const LESSONS = ["Meet the blocks", "Make it move", "Add a loop", "Share your game"];
const SLOTS = ["Sat 10:00", "Sat 11:00", "Sun 10:00"];

/* The three free ways in, as one picker and one screen. Each option opens with its own short scene: a demo course
   being finished, a trial class being booked, a paid course whose first lessons are open. Scenes take turns while on
   screen; picking one holds it, and the turns resume after a pause. Every scene plays once when it mounts and rests on
   its finished state, so reduced motion shows the result. */
export default function OnlineFree({ courses, trialMinutes, hrefs }: Props) {
  const [on, setOn] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || picked || !inView) return;
    const id = setTimeout(() => setOn((s) => (s + 1) % 3), MS);
    return () => clearTimeout(id);
  }, [on, still, picked, inView]);

  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, on]);

  const pick = (i: number) => { setPicked(true); setOn(i); };
  const OPTIONS = [
    {
      Icon: PlayCircle, title: "Free demo courses", cta: "Start a free course", href: hrefs.demo, bar: "Free demo course",
      text: courses.length > 0 ? "" : "Complete beginner courses, free forever. New ones are added regularly.",
    },
    {
      Icon: CalendarCheck, title: "Free 1:1 trial class", cta: "Claim your free class", href: hrefs.trial, bar: "Free trial class", primary: true,
      text: `A free ${trialMinutes ? `${trialMinutes}-minute ` : ""}live class with a RoboCoders tutor, one per learner. Pick any tutor and time.`,
    },
    {
      Icon: Eye, title: "Free preview lessons", cta: "Browse courses", href: hrefs.preview, bar: "Preview lessons",
      text: "Every paid course has free preview lessons, so you can see the teaching style before you buy.",
    },
  ];

  return (
    <div className="of" ref={box}>
      <ul className="of-list">
        {OPTIONS.map((o, i) => (
          <li key={o.title} data-on={on === i} style={{ "--ms": `${MS}ms` } as React.CSSProperties}>
            <button type="button" aria-pressed={on === i} onClick={() => pick(i)}>
              <span className="rh-chip-ico"><o.Icon size={20} aria-hidden="true" /></span>
              <h3>{o.title}</h3>
            </button>
            <div className="of-more">
              <div>
                {i === 0 && courses.length > 0 ? (
                  <ul className="ol-links">
                    {courses.slice(0, 4).map((c) => <li key={c.href}><Link href={c.href}>{c.title}</Link></li>)}
                  </ul>
                ) : <p>{o.text}</p>}
                <Link href={o.href} className={`rh-btn ${o.primary ? "rh-btn--primary" : "rh-btn--ghost"}`}>{o.cta}</Link>
              </div>
            </div>
            {on === i && !still && !picked && inView && <i className="of-bar" aria-hidden="true" />}
          </li>
        ))}
      </ul>

      <div className="bs of-bench">
        <div className="bs-bar">
          <span>RoboCoders Online</span>
          <em>{OPTIONS[on].bar}</em>
        </div>
        <div className="of-screen" key={on} role="img" aria-label={["A free demo course finishing lesson by lesson.", "A free trial class being booked: a tutor, a time, then the confirmation.", "A paid course with its first lessons open to preview and the rest locked."][on]}>
          {on === 0 && (
            <div className="of-demo" aria-hidden="true">
              <p className="of-title">Intro to coding <em>Free</em></p>
              <ol>
                {LESSONS.map((l, i) => (
                  <li key={l} style={{ "--i": i } as React.CSSProperties}><span><Check size={13} /></span>{l}</li>
                ))}
              </ol>
              <div className="of-prog"><i /></div>
              <p className="of-end"><Check size={16} /> Course complete</p>
            </div>
          )}
          {on === 1 && (
            <div className="of-trial" aria-hidden="true">
              <div className="of-tutors">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i === 0 ? "of-tut of-tut--pick" : "of-tut"}><GraduationCap size={22} /><b>Tutor</b></span>
                ))}
              </div>
              <div className="of-slots">
                {SLOTS.map((s, i) => <span key={s} className={i === 1 ? "of-slot of-slot--pick" : "of-slot"}>{s}</span>)}
              </div>
              <p className="of-booked"><Check size={16} /> Booked <small><Clock size={12} /> Link opens 10 minutes before</small></p>
            </div>
          )}
          {on === 2 && (
            <div className="of-prev" aria-hidden="true">
              <p className="of-title">Python basics <em>Paid</em></p>
              <ol>
                {["Your first program", "Variables", "Loops", "Functions", "Final project"].map((l, i) => (
                  <li key={l} data-open={i < 2} style={{ "--i": i } as React.CSSProperties}>
                    {i < 2 ? <Eye size={14} /> : <Lock size={14} />}
                    <span>{l}</span>
                    {i < 2 && <em>Free preview</em>}
                  </li>
                ))}
              </ol>
              <p className="of-end">Buy when you are ready</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
