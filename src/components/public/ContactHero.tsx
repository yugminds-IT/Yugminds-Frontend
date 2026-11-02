"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, Mail, MapPin, Phone, SendHorizontal } from "lucide-react";
import { officeStatus } from "./contact-hours";
import "./droid.css";

const EMAIL = "robocoders@yugminds.org";

// Answers restate the home page FAQ, so the illustration never promises more than the site does.
const THREADS = [
  {
    who: "Parent",
    topic: "Trial class",
    q: "Can my 9-year-old try a class before we sign up?",
    a: "Yes. The first class is a free trial, one on one with a tutor.",
    back: "Great, Saturday morning works for us.",
  },
  {
    who: "School",
    topic: "Partnership",
    q: "Can our school run RoboCoders?",
    a: "Yes. We handle setup and instructor training, then launch classes with you.",
    back: "Perfect. Can we see a demo next week?",
  },
  {
    who: "Parent",
    topic: "Kits",
    q: "Is there anything for a 6-year-old without a screen?",
    a: "Try the Play Kit. Kids lay out direction cards and the robot follows them.",
    back: "She'll love that. Thank you!",
  },
];

type Phase = "read" | "type" | "sent" | "back" | "leave";

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
}

function Desk({ status }: { status: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const still = useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCED).matches, () => false);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("read");
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  const answer = THREADS[i].a;

  useEffect(() => {
    if (!live || still) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "read") t = setTimeout(() => { setTyped(0); setPhase("type"); }, 1500);
    else if (phase === "type") {
      if (typed < answer.length) t = setTimeout(() => setTyped((n) => n + 1), 30);
      else t = setTimeout(() => setPhase("sent"), 420);
    } else if (phase === "sent") t = setTimeout(() => setPhase("back"), 1500);
    else if (phase === "back") t = setTimeout(() => setPhase("leave"), 2800);
    else t = setTimeout(() => { setI((n) => (n + 1) % THREADS.length); setTyped(0); setPhase("read"); }, 300);
    return () => clearTimeout(t);
  }, [live, still, phase, typed, answer.length]);

  const shown: Phase = still ? "back" : phase;
  const thread = THREADS[i];
  const replied = shown === "sent" || shown === "back" || shown === "leave";
  const open = status?.startsWith("Open") ?? false;
  const away = status?.match(/We open (.+)\.$/)?.[1];

  return (
    <div ref={ref} className="ct-desk rh-dark" role="img" aria-label="Illustration: the RoboCoders droid answering questions from parents and schools">
      <div className="ct-desk-win" aria-hidden="true">
        <div className="ct-desk-bar">
          <span className="ct-desk-av">R</span>
          <span className="ct-desk-who">
            <b>RoboCoders team</b>
            <small>Replies within 24 hours</small>
          </span>
          {status && (
            <span className="ct-desk-state" data-open={open || undefined}>
              <i />
              {open ? "Online now" : away ? `Back ${away}` : "Away"}
            </span>
          )}
        </div>

        <div className="ct-desk-body">
          <div className="ct-rail">
            <ul className="ct-inbox">
              {THREADS.map((t, n) => {
                const state = n < i || (n === i && replied) ? "done" : "new";
                return (
                  <li key={n} className="ct-mail" data-active={n === i || undefined} data-state={state}>
                    <span className="ct-mail-txt">
                      <b>{t.who}</b>
                      <small>{t.topic}</small>
                    </span>
                    <span className="ct-mail-mark">{state === "done" ? <Check /> : <i />}</span>
                  </li>
                );
              })}
            </ul>

            <div className="ct-droid" data-state={shown}>
              <div className="droid__head-container">
                <div className="droid__antenna" />
                <div className="droid__antenna" />
                <div className="droid__head" />
              </div>
              <div className="droid__body" />
            </div>
          </div>

          <div className="ct-pane">
            <div className="ct-thread" data-leave={shown === "leave" || undefined} key={i}>
              <div className="ct-msg ct-msg--in">
                <small>{thread.who}</small>
                {thread.q}
              </div>
              {shown === "type" && (
                <div className="ct-msg ct-msg--dots"><i /><i /><i /></div>
              )}
              {replied && <div className="ct-msg ct-msg--out">{answer}</div>}
              {(shown === "back" || shown === "leave") && (
                <div className="ct-msg ct-msg--in">{thread.back}</div>
              )}
            </div>

            <div className="ct-composer" data-typing={shown === "type" || undefined}>
              <span className="ct-composer-text">
                {shown === "type" ? (
                  <span>{answer.slice(0, typed)}<span className="ct-caret" /></span>
                ) : (
                  <span className="ct-composer-ph">Write a reply</span>
                )}
              </span>
              <span className="ct-send" data-press={(shown === "type" && typed >= answer.length) || undefined}>
                <SendHorizontal />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactHero() {
  const statusText = useSyncExternalStore(subscribeMinute, () => officeStatus().text, () => null);
  const open = statusText?.startsWith("Open") ?? false;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
    } catch {
      window.location.href = `mailto:${EMAIL}`;
    }
  };

  return (
    <section className="ct-hero">
      <div className="rh-wrap ct-hero-grid">
        <div className="ct-hero-copy">
          <h1>Talk to the team behind the classes.</h1>
          <p className="rh-lede">
            Ask about a free trial class, fees, kits or bringing RoboCoders to your school. Or read about{" "}
            <Link href="/robocoders/programs" className="rh-link">our programs</Link> and{" "}
            <Link href="/robocoders/for-schools" className="rh-link">school partnerships</Link> first.
          </p>

          <ul className="ct-ways">
            <li>
              <a href="tel:+918500345655" className="ct-way">
                <span className="ct-way-ic"><Phone /></span>
                <span className="ct-way-txt">
                  <b>+91 85003 45655</b>
                  <small className="ct-status" data-open={open || undefined}>
                    <span className="ct-status-dot" aria-hidden="true" />
                    {statusText ?? "Call or message, Monday to Saturday"}
                  </small>
                </span>
              </a>
            </li>
            <li className="ct-way-row">
              <a href={`mailto:${EMAIL}`} className="ct-way">
                <span className="ct-way-ic"><Mail /></span>
                <span className="ct-way-txt">
                  <b>{EMAIL}</b>
                  <small>We reply within 24 hours</small>
                </span>
              </a>
              <button type="button" className="ct-copy" onClick={copy} aria-label={copied ? "Email address copied" : "Copy email address"}>
                <span className="ct-copy-ic" data-on={!copied || undefined}><Copy /></span>
                <span className="ct-copy-ic" data-on={copied || undefined}><Check /></span>
              </button>
            </li>
            <li>
              <a href="#visit" className="ct-way">
                <span className="ct-way-ic"><MapPin /></span>
                <span className="ct-way-txt">
                  <b>Begumpet, Hyderabad</b>
                  <small>See opening hours and the map</small>
                </span>
              </a>
            </li>
          </ul>
        </div>

        <Desk status={statusText} />
      </div>
    </section>
  );
}
