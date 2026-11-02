"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Phone, X } from "lucide-react";
import { commonApi } from "@/lib/api/common.api";
import { display, body } from "../../app/robocoders/robo-fonts";
import "./droid.css";
import "./lead-droid.css";

/*
  The RoboCoders assistant: the hero's droid, in a round window onto the hero's night sky, pinned to the
  bottom-right corner. It rolls in once the hero is scrolled past, its eye follows the cursor, and once per
  visit it offers a call back. Leads go to the same Contact Submissions inbox as YugMinds, prefixed "RoboCoders:".
*/

const PHONE_DISPLAY = "+91 85003 45655";
const PHONE_TEL = "tel:+918500345655";
const TOPICS = ["Free trial class", "Programs and fees", "For my school", "Something else"];
const AGES = ["6 to 8", "9 to 12", "13 to 18"];
const SEEN_KEY = "rc-leadbot-greeted";

type Gesture = "idle" | "look" | "roll" | "tilt" | "hop";
/* How long each idle gesture plays (ms); matches its keyframes in lead-droid.css. */
const GESTURE_MS: Record<Exclude<Gesture, "idle">, number> = { look: 2000, roll: 1600, tilt: 1600, hop: 700 };

function readSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked: the greeting may show again, which is harmless */
  }
}
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* The droid in its window. `headRef` receives --look (-1..1), which slides the eye along the head. */
function Porthole({ gesture = "idle", headRef }: { gesture?: Gesture | "cheer"; headRef?: React.Ref<HTMLDivElement> }) {
  return (
    <span className="ld-port" aria-hidden="true">
      <span className="ld-droid" data-g={gesture}>
        <span className="ld-unit">
          <div className="droid__head-container">
            <div className="droid__antenna" />
            <div className="droid__antenna" />
            <div className="droid__head" ref={headRef} />
          </div>
          <span className="ld-ball"><div className="droid__body" /></span>
        </span>
      </span>
    </span>
  );
}

export default function RoboLeadBot() {
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState<"hidden" | "typing" | "shown">("hidden");
  const [gesture, setGesture] = useState<Gesture>("idle");
  const [engaged, setEngaged] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [onHero, setOnHero] = useState(true);
  const [quiet, setQuiet] = useState(false); // the closing call to action or the footer is on screen
  const [topic, setTopic] = useState("");
  const [age, setAge] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [failMsg, setFailMsg] = useState("");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // The hero already has the big droid in view; this one arrives once you scroll past it.
  useEffect(() => {
    const hero = document.querySelector(".rh-hero");
    if (!hero) return setOnHero(false);
    const io = new IntersectionObserver(([en]) => setOnHero(en.isIntersecting), { rootMargin: "-35% 0px 0px 0px" });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll(".rh-cta2-sec, footer.rf, [data-leadbot-quiet]");
    if (!els.length) return;
    const seen = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => (en.isIntersecting ? seen.add(en.target) : seen.delete(en.target)));
        setQuiet(seen.size > 0);
      },
      { threshold: 0.2 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // The eye follows the cursor (or the last tap) along the head.
  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = launcherRef.current?.getBoundingClientRect();
        if (!r || !headRef.current) return;
        const dx = e.clientX - (r.left + r.width / 2);
        headRef.current.style.setProperty("--look", Math.max(-1, Math.min(1, dx / 240)).toFixed(2));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Idle life: one small gesture every 6 to 10 seconds, never the same twice in a row.
  useEffect(() => {
    if (open || onHero || reducedMotion()) return;
    const moves = Object.keys(GESTURE_MS) as (keyof typeof GESTURE_MS)[];
    let t = 0;
    let last = "";
    const next = () => {
      t = window.setTimeout(() => {
        const g = moves.filter((m) => m !== last)[Math.floor(Math.random() * (moves.length - 1))];
        last = g;
        setGesture(g);
        t = window.setTimeout(() => {
          setGesture("idle");
          next();
        }, GESTURE_MS[g]);
      }, 6000 + Math.random() * 4000);
    };
    next();
    return () => window.clearTimeout(t);
  }, [open, onHero]);

  // Once per visit, a while after it arrives, it offers a call back.
  useEffect(() => {
    if (onHero || readSeen()) return;
    const reduced = reducedMotion();
    const t1 = window.setTimeout(() => setBubble(reduced ? "shown" : "typing"), 6000);
    const t2 = window.setTimeout(() => setBubble("shown"), reduced ? 6000 : 7100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onHero]);

  // A second, smaller nudge later in the visit if they still haven't tried it.
  useEffect(() => {
    if (engaged) return;
    const t1 = window.setTimeout(() => setNudge(true), 45000);
    const t2 = window.setTimeout(() => setNudge(false), 52000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [engaged]);

  const closeBubble = () => {
    setEngaged(true);
    setNudge(false);
    setBubble("hidden");
    markSeen();
  };
  const openPanel = () => {
    closeBubble();
    setOpen(true);
  };
  const closePanel = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    if (state === "idle" || state === "failed") nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePanel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const school = topic === "For my school";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/[\s()-]/g, "").replace(/^\+91/, "");
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Enter your name.";
    if (!/^[6-9]\d{9}$/.test(digits)) errs.phone = "Enter a 10-digit mobile number, like 98765 43210.";
    setErrors(errs);
    if (errs.name) return nameRef.current?.focus();
    if (errs.phone) return panelRef.current?.querySelector<HTMLInputElement>("#rc-lead-phone")?.focus();
    setState("sending");
    try {
      const about = `RoboCoders: ${topic || "Not given"}${age && !school ? `, child aged ${age}` : ""}`;
      await commonApi.callback({ name: name.trim(), phone: digits, topic: about });
      setState("sent");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setFailMsg(status === 429 ? "Too many requests in a minute. Wait a moment and try again." : `That didn't go through. Try again, or call us on ${PHONE_DISPLAY}.`);
      setState("failed");
    }
  };

  const sent = state === "sent";
  const away = onHero && !open;
  const first = name.trim().split(/\s+/)[0];
  const digits = phone.replace(/[\s()-]/g, "").replace(/^\+91/, "");

  return (
    <div className={`ld ${display.variable} ${body.variable}`} data-away={away}>
      {open && (
        <div ref={panelRef} id="rc-lead-panel" role="dialog" aria-modal="false" aria-labelledby="rc-lead-title" className="ld-panel">
          <div className="ld-head">
            <span className="ld-face"><Porthole gesture={sent ? "cheer" : "idle"} /></span>
            <div className="ld-head-copy">
              <h2 id="rc-lead-title">Talk to the RoboCoders team</h2>
              <p>Leave your number and we&apos;ll call you back.</p>
            </div>
            <button type="button" onClick={closePanel} aria-label="Close" className="ld-close">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {sent ? (
            <div className="ld-done" role="status">
              <p className="ld-done-t">Thanks, {first}.</p>
              <p>We&apos;ll call you on <strong>+91 {digits.slice(0, 5)} {digits.slice(5)}</strong>. Rather pick a time yourself? Book the trial class now.</p>
              <Link href="/robocoders/online-classes" className="ld-btn ld-btn--primary" onClick={() => setOpen(false)}>Book a trial class</Link>
              <a href={PHONE_TEL} className="ld-btn ld-btn--ghost"><Phone size={16} aria-hidden="true" />Call {PHONE_DISPLAY}</a>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="ld-form">
              <fieldset>
                <legend>What&apos;s it about?</legend>
                <div className="ld-chips">
                  {TOPICS.map((t) => (
                    <label key={t} className="ld-chip">
                      <input type="radio" name="rc-lead-topic" value={t} checked={topic === t} onChange={() => setTopic(t)} />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {!school && (
                <fieldset>
                  <legend>Child&apos;s age <span className="ld-opt">(optional)</span></legend>
                  <div className="ld-chips">
                    {AGES.map((a) => (
                      <label key={a} className="ld-chip">
                        <input type="radio" name="rc-lead-age" value={a} checked={age === a} onChange={() => setAge(a)} />
                        <span>{a}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div>
                <label htmlFor="rc-lead-name" className="ld-label">Your name</label>
                <input
                  ref={nameRef}
                  id="rc-lead-name"
                  className="ld-input"
                  autoComplete="name"
                  enterKeyHint="next"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "rc-lead-name-err" : undefined}
                />
                {errors.name && <p id="rc-lead-name-err" className="ld-err">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="rc-lead-phone" className="ld-label">Mobile number</label>
                <div className="ld-tel">
                  <span>+91</span>
                  <input
                    id="rc-lead-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    enterKeyHint="send"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "rc-lead-phone-err" : undefined}
                  />
                </div>
                {errors.phone && <p id="rc-lead-phone-err" className="ld-err">{errors.phone}</p>}
              </div>
              {state === "failed" && <p className="ld-alert" role="alert">{failMsg}</p>}
              <button type="submit" disabled={state === "sending"} className="ld-btn ld-btn--primary">
                {state === "sending" ? "Sending…" : "Call me back"}
              </button>
              <div className="ld-alt">
                <a href={PHONE_TEL}><Phone size={16} aria-hidden="true" />{PHONE_DISPLAY}</a>
                <Link href="/robocoders/online-classes" onClick={() => setOpen(false)}>Book a trial class</Link>
              </div>
            </form>
          )}
        </div>
      )}

      {!open && !quiet && bubble !== "hidden" && (
        <div className="ld-bub" role="status">
          <button type="button" onClick={closeBubble} aria-label="Dismiss" className="ld-bub-x">
            <X size={16} aria-hidden="true" />
          </button>
          {bubble === "typing" ? (
            <span className="ld-dots" aria-label="Typing"><i /><i /><i /></span>
          ) : (
            <>
              <p className="ld-bub-t">Want a free trial class?</p>
              <p className="ld-bub-p">I can get a RoboCoders tutor to call you and set one up.</p>
              <div className="ld-bub-actions">
                <button type="button" onClick={openPanel} className="ld-btn ld-btn--primary ld-btn--sm">Request a call back</button>
                <button type="button" onClick={closeBubble} className="ld-btn ld-btn--text ld-btn--sm">Not now</button>
              </div>
            </>
          )}
        </div>
      )}

      {!open && !quiet && bubble === "hidden" && nudge && (
        <button type="button" onClick={openPanel} className="ld-nudge">Need a call back?</button>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-expanded={open}
        aria-controls={open ? "rc-lead-panel" : undefined}
        aria-label={open ? "Close the call-back panel" : "Talk to the RoboCoders team"}
        className="ld-launch"
      >
        {!engaged && <span className="ld-attn" aria-hidden="true" />}
        <Porthole gesture={sent ? "cheer" : bubble === "shown" ? "tilt" : gesture} headRef={headRef} />
      </button>
    </div>
  );
}
