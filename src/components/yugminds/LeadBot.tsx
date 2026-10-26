"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Phone, X } from "lucide-react";
import { commonApi } from "@/lib/api/common.api";

/*
  The site assistant: a small robot pinned to the bottom-right corner of every
  page. Its eyes follow the cursor. Once per visit it waves and offers a call
  back; clicking it opens a panel to leave a name and number (saved to the
  admin's Contact Submissions inbox) or call us directly.
*/

const PHONE_DISPLAY = "+91 85003 45655";
const PHONE_TEL = "tel:+918500345655";
const TOPICS = ["Robot or device", "School robotics lab", "App or software", "Something else"];
const SEEN_KEY = "ym-leadbot-greeted";

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

/* The robot's face. `look` is -1..1 on each axis; `blink` closes the eyes. */
function BotFace({ look, blink, happy }: { look: { x: number; y: number }; blink: boolean; happy: boolean }) {
  const ex = look.x * 2.2;
  const ey = look.y * 1.6;
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <line x1="24" y1="4" x2="24" y2="10" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="4" r="2.6" fill="#f59e0b" />
      <rect x="4" y="18" width="5" height="12" rx="2.5" fill="#1d4ed8" />
      <rect x="39" y="18" width="5" height="12" rx="2.5" fill="#1d4ed8" />
      <rect x="7" y="10" width="34" height="30" rx="12" fill="#ffffff" stroke="#1d4ed8" strokeWidth="2.5" />
      <rect x="12" y="16" width="24" height="17" rx="7" fill="#0f172a" />
      {blink ? (
        <g stroke="#7dd3fc" strokeWidth="2.4" strokeLinecap="round">
          <line x1={17 + ex} y1={24 + ey} x2={21 + ex} y2={24 + ey} />
          <line x1={27 + ex} y1={24 + ey} x2={31 + ex} y2={24 + ey} />
        </g>
      ) : (
        <g fill="#7dd3fc">
          <rect x={17 + ex} y={20.5 + ey} width="4" height={happy ? 4 : 6} rx="2" />
          <rect x={27 + ex} y={20.5 + ey} width="4" height={happy ? 4 : 6} rx="2" />
        </g>
      )}
      <path d={`M${20 + ex * 0.5} ${29 + ey * 0.5} q4 ${happy ? 3.4 : 2} 8 0`} stroke="#7dd3fc" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

type Gesture = "idle" | "wave" | "look" | "tilt" | "hop" | "ping" | "dance" | "cheer" | "nod" | "roll" | "think";
/* How long each gesture plays (ms); matches its keyframes in globals.css. */
const GESTURE_MS: Record<Exclude<Gesture, "idle">, number> = { wave: 1800, look: 1800, tilt: 1800, hop: 900, ping: 2000, dance: 2200, cheer: 1700, nod: 1300, roll: 2100, think: 2400 };
type Mood = "normal" | "happy" | "blink";

/* The full robot for the corner: head with a face screen and antenna, a body
   with a chest light, two arms and a wheel base. Gestures are CSS classes on
   its parts (see .lb-* in globals.css). */
function BotFigure({ look, mood, gesture, hover }: { look: { x: number; y: number }; mood: Mood; gesture: Gesture; hover: boolean }) {
  const ex = gesture === "look" ? 0 : gesture === "think" ? 1.2 : look.x * 2.4;
  const ey = gesture === "look" ? 0 : gesture === "think" ? -1.6 : look.y * 1.6;
  const happy = mood === "happy" || hover || gesture === "cheer" || gesture === "dance";
  const spin = gesture === "roll" || gesture === "dance" ? "lb-spin" : "";
  const armL = hover ? "lb-arm-l-up" : gesture === "cheer" ? "lb-cheer-l" : gesture === "dance" ? "lb-dance-l" : gesture === "think" ? "lb-think-arm" : "";
  const armR = gesture === "wave" ? "lb-wave-arm" : gesture === "cheer" ? "lb-cheer-r" : gesture === "dance" ? "lb-dance-r" : "";
  const body = gesture === "hop" ? "lb-hop" : gesture === "dance" ? "lb-dance" : gesture === "roll" ? "lb-roll" : "";
  const head = gesture === "tilt" || gesture === "think" ? "lb-tilt" : gesture === "look" ? "lb-lookaround" : gesture === "nod" ? "lb-nod" : "";
  return (
    <svg viewBox="0 0 80 96" className="size-full overflow-visible" aria-hidden>
      <ellipse className="lb-shadow" cx="40" cy="91" rx="17" ry="3.5" fill="#1e3a8a" opacity="0.18" />
      <g className={`lb-body ${body}`}>
        {/* Wheel base; the wheels turn when it rolls or dances */}
        <rect x="25" y="74" width="30" height="9" rx="4.5" fill="#1e3a8a" />
        {[31, 49].map((cx) => (
          <g key={cx} className={`lb-wheel ${spin}`}>
            <circle cx={cx} cy="83" r="4" fill="#0f172a" />
            <line x1={cx} y1="80.2" x2={cx} y2="85.8" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ))}
        {/* Left arm: the outer group sways all the time, the inner one does the gestures */}
        <g className="lb-sway-l">
          <g className={`lb-arm-l ${armL}`}>
            <rect x="13" y="51" width="8" height="18" rx="4" fill="#2563eb" />
            <circle cx="17" cy="70" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
          </g>
        </g>
        {/* Right arm: the waving one */}
        <g className="lb-sway-r">
          <g className={`lb-arm-r ${armR}`}>
            <rect x="59" y="51" width="8" height="18" rx="4" fill="#2563eb" />
            <circle cx="63" cy="70" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
          </g>
        </g>
        {/* Torso and chest light */}
        <rect x="21" y="48" width="38" height="28" rx="11" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
        <rect x="31" y="55" width="18" height="12" rx="4" fill="#0f172a" />
        <path className="lb-chest" d="M36.5 58.5c1.4-1.6 3.5-.4 3.5 1.2 0-1.6 2.1-2.8 3.5-1.2 1.4 1.7-.6 3.8-3.5 5.8-2.9-2-4.9-4.1-3.5-5.8z" fill="#f59e0b" />
        {/* Head */}
        <g className="lb-bob">
        <g className={`lb-head ${head}`}>
          <rect x="36" y="42" width="8" height="8" rx="2" fill="#1e3a8a" />
          <line x1="40" y1="6" x2="40" y2="14" stroke="#1e3a8a" strokeWidth="2.2" strokeLinecap="round" />
          {/* A beacon that keeps pulsing from the antenna */}
          <circle className="lb-halo" cx="40" cy="5" r="3.4" fill="none" stroke="#f59e0b" strokeWidth="1.4" />
          <circle className={gesture === "ping" ? "lb-ping" : ""} cx="40" cy="5" r="3.4" fill="#f59e0b" />
          <rect x="11" y="24" width="6" height="12" rx="3" fill="#2563eb" />
          <rect x="63" y="24" width="6" height="12" rx="3" fill="#2563eb" />
          <rect x="15" y="13" width="50" height="33" rx="14" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
          <rect x="21" y="19" width="38" height="21" rx="9" fill="#0f172a" />
          <g className={gesture === "look" ? "lb-eyes-scan" : ""}>
            {mood === "blink" ? (
              <g stroke="#7dd3fc" strokeWidth="2.6" strokeLinecap="round">
                <line x1={27 + ex} y1={29 + ey} x2={33 + ex} y2={29 + ey} />
                <line x1={43 + ex} y1={29 + ey} x2={49 + ex} y2={29 + ey} />
              </g>
            ) : happy ? (
              <g stroke="#7dd3fc" strokeWidth="2.6" strokeLinecap="round" fill="none">
                <path d={`M${27 + ex} ${30 + ey} q3 -4 6 0`} />
                <path d={`M${43 + ex} ${30 + ey} q3 -4 6 0`} />
              </g>
            ) : (
              <g fill="#7dd3fc">
                <rect x={27 + ex} y={24.5 + ey} width="6" height="8" rx="3" />
                <rect x={43 + ex} y={24.5 + ey} width="6" height="8" rx="3" />
                <circle cx={31.5 + ex} cy={26.5 + ey} r="1.1" fill="#ffffff" />
                <circle cx={47.5 + ex} cy={26.5 + ey} r="1.1" fill="#ffffff" />
              </g>
            )}
          </g>
          {/* Cheeks show when it's pleased */}
          {happy && (
            <g fill="#f59e0b" opacity="0.55">
              <circle cx="25" cy="35" r="2" />
              <circle cx="55" cy="35" r="2" />
            </g>
          )}
          <path d={happy ? "M35 34 q5 4.5 10 0" : "M36 35 q4 2.5 8 0"} stroke="#7dd3fc" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
        </g>
      </g>
    </svg>
  );
}

export function LeadBot() {
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState<"hidden" | "typing" | "shown">("hidden");
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [gesture, setGesture] = useState<Gesture>("idle");
  const [hover, setHover] = useState(false);
  const [engaged, setEngaged] = useState(false); // stops the attention cue once they've interacted
  const [nudge, setNudge] = useState(false);
  const [onForm, setOnForm] = useState(false); // the brief form is on screen: don't talk over it
  // The hero has its own car and controls in that corner; the robot arrives once you scroll past it.
  const [onHero, setOnHero] = useState(true);
  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) {
      setOnHero(false); // pages without the hero
      return;
    }
    const io = new IntersectionObserver(([en]) => setOnHero(en.isIntersecting), { rootMargin: "-35% 0px 0px 0px" }); // gone once its bottom passes the top third
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const form = document.getElementById("contact");
    if (!form) return;
    const io = new IntersectionObserver(([en]) => setOnForm(en.isIntersecting), { threshold: 0.15 });
    io.observe(form);
    return () => io.disconnect();
  }, []);
  const [topic, setTopic] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [failMsg, setFailMsg] = useState("");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Eyes follow the cursor; a blink every few seconds.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = launcherRef.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.max(1, Math.hypot(dx, dy));
        setLook({ x: dx / d, y: dy / d });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true }); // touch screens: it looks where you tap
    // While the page scrolls, its eyes follow the direction, then settle.
    let lastY = window.scrollY;
    let settle = 0;
    const onScroll = () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      if (Math.abs(dy) < 2) return;
      const y = dy > 0 ? 1 : -1;
      setLook((l) => (l.x === 0 && l.y === y ? l : { x: 0, y }));
      window.clearTimeout(settle);
      settle = window.setTimeout(() => setLook({ x: 0, y: 0 }), 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const blinker = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
    }, 4200);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(settle);
      window.clearInterval(blinker);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Idle life: a gesture every couple of seconds (never the same twice in a row),
  // on top of the sway, bob and beacon that run all the time.
  useEffect(() => {
    if (open || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const moves = Object.keys(GESTURE_MS) as (keyof typeof GESTURE_MS)[];
    let t = 0;
    let last = "";
    const next = () => {
      t = window.setTimeout(() => {
        const pool = moves.filter((m) => m !== last);
        const g = pool[Math.floor(Math.random() * pool.length)];
        last = g;
        setGesture(g);
        t = window.setTimeout(() => {
          setGesture("idle");
          next();
        }, GESTURE_MS[g]);
      }, 1800 + Math.random() * 2200);
    };
    next();
    return () => window.clearTimeout(t);
  }, [open]);

  // A second, smaller nudge later in the visit if they still haven't tried it.
  useEffect(() => {
    if (engaged) return;
    const t1 = window.setTimeout(() => setNudge(true), 40000);
    const t2 = window.setTimeout(() => setNudge(false), 47000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [engaged]);

  // Once per visit: after a short while, it waves and offers a call back.
  useEffect(() => {
    if (readSeen()) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = window.setTimeout(() => setBubble(reduced ? "shown" : "typing"), 7000);
    const t2 = window.setTimeout(() => setBubble("shown"), reduced ? 7000 : 8100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

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

  // Focus the first field when the panel opens; Esc closes it.
  useEffect(() => {
    if (!open) return;
    if (state === "idle" || state === "failed") nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePanel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/[\s()-]/g, "").replace(/^\+91/, "");
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Enter your name.";
    if (!/^[6-9]\d{9}$/.test(digits)) errs.phone = "Enter a 10-digit mobile number, like 98765 43210.";
    setErrors(errs);
    if (errs.name) return nameRef.current?.focus();
    if (errs.phone) return panelRef.current?.querySelector<HTMLInputElement>("#leadbot-phone")?.focus();
    setState("sending");
    try {
      await commonApi.callback({ name: name.trim(), phone: digits, topic: topic || "Not given" });
      setState("sent");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setFailMsg(status === 429 ? "Too many requests in a minute. Wait a moment and try again." : `That didn't go through. Try again, or call us on ${PHONE_DISPLAY}.`);
      setState("failed");
    }
  };

  const happy = state === "sent";

  return (
    // On phones it steps aside over the brief form, whose Continue bar sits in that corner.
    <div className={`${onHero && !open ? "hidden" : "ym-rise"} ${onForm && !open ? "max-lg:hidden" : ""} fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-[70] flex flex-col items-end gap-3 md:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] md:right-[calc(1.25rem+env(safe-area-inset-right))]`}>
      {/* The panel. */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="leadbot-title"
          className="ym-rise max-h-[calc(100dvh-8rem)] w-[min(360px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white text-ym-text shadow-[0_18px_50px_-12px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-start gap-3 rounded-t-xl bg-[#1e3a8a] p-4 text-white">
            <div className="size-11 shrink-0 rounded-lg bg-white p-1">
              <BotFace look={{ x: 0, y: 0.2 }} blink={false} happy={happy} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="leadbot-title" className="font-acdisplay text-lg font-bold leading-tight">
                Talk to a person at YugMinds
              </h2>
              <p className="mt-0.5 text-sm text-blue-100">Leave your number and we&apos;ll call you back.</p>
            </div>
            <button type="button" onClick={closePanel} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-md text-blue-100 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {state === "sent" ? (
            <div className="p-5" role="status">
              <p className="font-acdisplay text-lg font-bold">Thanks, {name.trim().split(/\s+/)[0]}.</p>
              <p className="mt-1 leading-relaxed text-slate-600">
                We&apos;ll call you on <span className="font-semibold text-ym-text">{phone}</span>. If it&apos;s urgent, call us now.
              </p>
              <a href={PHONE_TEL} className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 font-semibold outline-none hover:border-ym-blue focus-visible:ring-2 focus-visible:ring-ym-blue">
                <Phone className="size-4" aria-hidden />
                Call {PHONE_DISPLAY}
              </a>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-5">
              <fieldset>
                <legend className="text-sm font-semibold">What&apos;s it about?</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TOPICS.map((t) => (
                    <label key={t} className="cursor-pointer">
                      <input type="radio" name="leadbot-topic" value={t} checked={topic === t} onChange={() => setTopic(t)} className="peer sr-only" />
                      <span className="inline-flex min-h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-ym-blue peer-checked:border-ym-blue peer-checked:bg-ym-blue peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ym-blue peer-focus-visible:ring-offset-1">
                        {t}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="leadbot-name" className="text-sm font-semibold">
                  Your name
                </label>
                <input
                  ref={nameRef}
                  id="leadbot-name"
                  autoComplete="name"
                  enterKeyHint="next"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "leadbot-name-err" : undefined}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-ym-blue focus:ring-2 focus:ring-ym-blue/30 aria-[invalid=true]:border-red-500"
                />
                {errors.name && <p id="leadbot-name-err" className="mt-1 text-sm font-semibold text-red-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="leadbot-phone" className="text-sm font-semibold">
                  Mobile number
                </label>
                <div className="mt-1 flex rounded-md border border-slate-300 focus-within:border-ym-blue focus-within:ring-2 focus-within:ring-ym-blue/30 has-[[aria-invalid=true]]:border-red-500">
                  <span className="grid place-items-center px-3 text-slate-500">+91</span>
                  <input
                    id="leadbot-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    enterKeyHint="send"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "leadbot-phone-err" : undefined}
                    className="w-full rounded-r-md py-2.5 pr-3 outline-none"
                  />
                </div>
                {errors.phone && <p id="leadbot-phone-err" className="mt-1 text-sm font-semibold text-red-600">{errors.phone}</p>}
              </div>
              {state === "failed" && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">
                  {failMsg}
                </p>
              )}
              <button type="submit" disabled={state === "sending"} className="min-h-11 rounded-md bg-ym-blue font-semibold text-white outline-none transition-colors hover:bg-ym-blue-lit focus-visible:ring-2 focus-visible:ring-ym-blue focus-visible:ring-offset-2 disabled:opacity-70">
                {state === "sending" ? "Sending…" : "Call me back"}
              </button>
              <div className="flex items-center justify-between gap-3 text-sm">
                <a href={PHONE_TEL} className="flex items-center gap-1.5 font-semibold text-ym-text outline-none hover:text-ym-blue focus-visible:ring-2 focus-visible:ring-ym-blue">
                  <Phone className="size-4" aria-hidden />
                  {PHONE_DISPLAY}
                </a>
                <Link
                  href="/#contact"
                  onClick={(e) => {
                    closePanel();
                    if (window.location.pathname === "/") {
                      e.preventDefault();
                      document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
                    }
                  }} className="font-semibold text-ym-blue underline decoration-blue-200 decoration-2 underline-offset-4 outline-none hover:decoration-ym-blue focus-visible:ring-2 focus-visible:ring-ym-blue">
                  Send a full brief
                </Link>
              </div>
            </form>
          )}
        </div>
      )}

      {/* The greeting, once per visit. */}
      {!open && !onForm && bubble !== "hidden" && (
        <div className="ym-rise relative w-[min(290px,calc(100vw-6rem))] rounded-xl border border-slate-200 bg-white p-3 sm:p-4 text-ym-text shadow-[0_14px_40px_-12px_rgba(15,23,42,0.35)]" role="status">
          <button type="button" onClick={closeBubble} aria-label="Dismiss" className="absolute right-2 top-2 grid size-7 place-items-center rounded-md text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-ym-blue">
            <X className="size-4" aria-hidden />
          </button>
          {bubble === "typing" ? (
            <span className="flex gap-1 py-2" aria-label="Typing">
              {[0, 1, 2].map((i) => (
                <span key={i} className="ym-dot size-2 rounded-full bg-slate-400" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          ) : (
            <>
              <p className="pr-6 font-acdisplay text-base font-bold leading-snug">
                Building something?<span className="sm:hidden"> Get a call back.</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 max-sm:hidden">I can get someone from YugMinds to call you back.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={openPanel} className="min-h-10 flex-1 whitespace-nowrap rounded-md bg-ym-blue px-3 text-sm font-semibold text-white outline-none hover:bg-ym-blue-lit focus-visible:ring-2 focus-visible:ring-ym-blue focus-visible:ring-offset-2">
                  Request a call back
                </button>
                <button type="button" onClick={closeBubble} className="min-h-10 rounded-md px-3 text-sm font-semibold text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-ym-blue">
                  Not now
                </button>
              </div>
            </>
          )}
          {/* The bubble's tail, pointing at the robot. */}
          <span aria-hidden className="absolute -bottom-2 right-6 size-4 rotate-45 border-b border-r border-slate-200 bg-white" />
        </div>
      )}

      {/* A small later nudge, once. */}
      {!open && !onForm && bubble === "hidden" && nudge && (
        <button
          type="button"
          onClick={openPanel}
          className="ym-rise absolute bottom-4 right-[76px] whitespace-nowrap sm:bottom-6 sm:right-[88px] rounded-full bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-[#1b3786] focus-visible:ring-2 focus-visible:ring-ym-blue focus-visible:ring-offset-2"
        >
          Need a call back?
        </button>
      )}

      {/* The robot. */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-expanded={open}
        aria-label={open ? "Close the call-back panel" : "Talk to a person at YugMinds"}
        className={`relative size-[68px] rounded-full sm:size-[84px] outline-none focus-visible:ring-2 focus-visible:ring-ym-blue focus-visible:ring-offset-2 ${happy ? "ym-hop" : ""}`}
      >
        {/* Attention cue: a soft ring that pulses until they've interacted. */}
        {!engaged && !open && <span aria-hidden className="lb-attn absolute inset-2 rounded-full border-2 border-ym-blue" />}
        <span aria-hidden className="absolute inset-1 rounded-full bg-blue-50 transition-colors duration-200 [button:hover>&]:bg-blue-100" />
        <span className="lb-float absolute inset-0 block p-1">
          <BotFigure look={look} mood={blink ? "blink" : happy ? "happy" : "normal"} gesture={bubble === "shown" ? "wave" : gesture} hover={hover} />
        </span>
      </button>
    </div>
  );
}
