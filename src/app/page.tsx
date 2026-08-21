"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  motion,
  MotionConfig,
  useScroll,
  useTransform,
  useInView,
  animate,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { ArrowRight, ArrowUp, Menu, X } from "lucide-react";
import BrandSwitcherBar from "../components/BrandSwitcherBar";

const LOGO_SRC = "/Yugminds_Official_Logo-preview.png";
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_CURTAIN = [0.76, 0, 0.24, 1] as const;

/* WebGL only exists client-side, and the bundle (three + postprocessing) is
   heavy — load it lazily rather than in the main chunk every page pays for. */
const HyperspeedBG = dynamic(() => import("../components/public/Hyperspeed"), {
  ssr: false,
});
/* Module-level, not useMemo: the component's own docs warn that a new
   effectOptions object identity recreates the whole WebGL scene, and a
   plain top-level constant is simpler than memoizing something that never
   depends on props or state. background/fog is white (not the vendored
   default black) since the road/island are hidden in Hyperspeed.tsx and
   only the car-light streaks should read here; streak colors are blue only,
   matching the site's no-gold rule instead of the default neon pink/cyan. */
const HYPERSPEED_OPTIONS = {
  distortion: "turbulentDistortion",
  length: 400,
  roadWidth: 10,
  islandWidth: 2,
  lanesPerRoad: 3,
  fov: 90,
  fovSpeedUp: 150,
  speedUp: 2,
  carLightsFade: 0.4,
  totalSideLightSticks: 20,
  lightPairsPerRoadWay: 40,
  colors: {
    roadColor: 0xffffff,
    islandColor: 0xffffff,
    background: 0xffffff,
    shoulderLines: 0xffffff,
    brokenLines: 0xffffff,
    leftCars: [0x2563eb, 0x1d4ed8, 0x60a5fa],
    rightCars: [0x172554, 0x1e3a8a, 0x3b82f6],
    sticks: 0x2563eb,
  },
};

/* Three.js's `fov` is the *vertical* field of view; the horizontal FOV a
   PerspectiveCamera actually shows is `2·atan(tan(fov/2)·aspect)`. A phone
   in portrait has aspect ~0.46 versus ~1.6 on desktop, so the identical
   `fov: 90` config renders a horizontal FOV of roughly 50° on mobile against
   ~115° on desktop — the same road geometry fills far more of the (already
   narrower) screen and swamps the text. This variant compensates: a much
   wider fov plus a narrower, sparser, thinner road so the streaks read as a
   background accent rather than a wall of light cutting through the copy. */
const HYPERSPEED_OPTIONS_MOBILE = {
  ...HYPERSPEED_OPTIONS,
  fov: 145,
  roadWidth: 6,
  islandWidth: 1.2,
  lanesPerRoad: 2,
  totalSideLightSticks: 10,
  lightPairsPerRoadWay: 18,
  carLightsRadius: [0.03, 0.08] as [number, number],
  lightStickWidth: [0.08, 0.3] as [number, number],
};

/* ─────────────────────────────────────────────
   LOGO MARK
   The brand logo is a raster PNG whose alpha channel is a clean
   silhouette, so a CSS mask repaints it in any single colour —
   that is how the mark appears monochrome blue everywhere it's used —
   full-colour nowhere on this page.
───────────────────────────────────────────── */
function LogoMark({
  tint,
  className = "",
}: {
  tint: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "block",
        backgroundColor: tint,
        maskImage: `url("${LOGO_SRC}")`,
        WebkitMaskImage: `url("${LOGO_SRC}")`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

/* The ring that draws itself around the mark — the stroke-then-fill
   opening beat of the reference animation. */
function DrawnRing({
  className = "",
  duration = 1.2,
  delay = 0,
  inView = false,
  stroke = "#2563EB",
}: {
  className?: string;
  duration?: number;
  delay?: number;
  inView?: boolean;
  stroke?: string;
}) {
  const animateProp = { pathLength: 1, opacity: 1 };
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none">
      <motion.circle
        cx="100"
        cy="100"
        r="94"
        stroke={stroke}
        strokeWidth="0.9"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        {...(inView
          ? { whileInView: animateProp, viewport: { once: true, margin: "-15%" } }
          : { animate: animateProp })}
        transition={{ duration, delay, ease: EASE_OUT }}
        style={{ rotate: -90, transformOrigin: "50% 50%" }}
      />
      <motion.circle
        cx="100"
        cy="100"
        r="78"
        stroke={stroke}
        strokeWidth="0.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        {...(inView
          ? {
              whileInView: { pathLength: 1, opacity: 0.45 },
              viewport: { once: true, margin: "-15%" },
            }
          : { animate: { pathLength: 1, opacity: 0.45 } })}
        transition={{ duration: duration * 1.15, delay: delay + 0.12, ease: EASE_OUT }}
        style={{ rotate: -90, transformOrigin: "50% 50%" }}
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   PRELOADER
   Ring draws → mark fills in → wordmark rises → curtain lifts.
───────────────────────────────────────────── */
function Preloader({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [lifting, setLifting] = useState(false);
  const word = "YUGMINDS".split("");

  useEffect(() => {
    const hold = reduced ? 200 : 2700;
    const t = window.setTimeout(() => setLifting(true), hold);
    return () => window.clearTimeout(t);
  }, [reduced]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden"
      initial={{ y: 0 }}
      animate={lifting ? { y: "-100%" } : { y: 0 }}
      transition={{ duration: reduced ? 0.2 : 1.05, ease: EASE_CURTAIN }}
      onAnimationComplete={() => lifting && onDone()}
    >
      <div className="absolute inset-0 bg-ym-cream" />

      <div className="relative h-full w-full flex flex-col items-center justify-center">
        <div className="relative w-[190px] h-[190px] md:w-[230px] md:h-[230px]">
          <DrawnRing
            className="absolute inset-0 w-full h-full"
            duration={1.15}
            delay={0.18}
            stroke="#2563EB"
          />
          <motion.div
            className="absolute inset-[19%]"
            initial={{ opacity: 0, scale: 0.86, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.95, delay: 1.05, ease: EASE_OUT }}
          >
            <LogoMark tint="#2563EB" className="w-full h-full" />
          </motion.div>
        </div>

        <div className="mt-8 flex overflow-hidden">
          {word.map((c, i) => (
            <motion.span
              key={`${c}-${i}`}
              className="font-extrabold text-[1.6rem] md:text-[2rem] text-ym-text leading-none"
              style={{ letterSpacing: "0.2em" }}
              initial={{ y: "110%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              transition={{
                duration: 0.7,
                delay: 1.5 + i * 0.045,
                ease: EASE_OUT,
              }}
            >
              {c}
            </motion.span>
          ))}
        </div>

        <motion.div
          className="mt-7 h-px bg-ym-blue/40"
          initial={{ width: 0 }}
          animate={{ width: 110 }}
          transition={{ duration: 0.9, delay: 1.85, ease: EASE_OUT }}
        />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   MOTION PRIMITIVES
───────────────────────────────────────────── */

/* Fade + rise on entry. The house reveal. */
function Reveal({
  children,
  delay = 0,
  y = 26,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 1, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* Type that rises out from behind a mask, one line at a time. */
function MaskLines({
  lines,
  className = "",
  lineClassName = "",
  delay = 0,
  stagger = 0.13,
}: {
  lines: React.ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
}) {
  return (
    <div className={className}>
      {lines.map((line, i) => (
        /* The trigger has to sit on the *clipping* wrapper, not on the line
           itself: IntersectionObserver clips a target to its ancestors' boxes,
           and a line parked at y:115% inside overflow-hidden has zero visible
           area — so it would never report as in view and never animate.
           Variants propagate the state down to the child that actually moves. */
        <motion.span
          key={i}
          className="block overflow-hidden"
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true, margin: "-12%" }}
        >
          <motion.span
            className={`block ${lineClassName}`}
            variants={{ hidden: { y: "115%" }, shown: { y: "0%" } }}
            transition={{
              duration: 1.05,
              delay: delay + i * stagger,
              ease: EASE_OUT,
            }}
          >
            {line}
          </motion.span>
        </motion.span>
      ))}
    </div>
  );
}

/* Hairline rule that draws across as it enters. */
function Rule({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  /* Trigger sits on the untransformed wrapper: a rule collapsed to scaleX(0)
     has zero width, so IntersectionObserver would never call it visible. */
  return (
    <motion.div
      className="w-full"
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "-10%" }}
    >
      <motion.div
        className={`h-px origin-left ${className}`}
        variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1 } }}
        transition={{ duration: 1.1, delay, ease: EASE_OUT }}
      />
    </motion.div>
  );
}

/* Small letterspaced uppercase label. */
function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-semibold text-xs md:text-sm uppercase ${className}`}
      style={{ letterSpacing: "0.12em" }}
    >
      {children}
    </span>
  );
}

function CountUp({
  value,
  suffix = "",
  className = "",
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.9,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}

/* ─────────────────────────────────────────────
   SCROLL PROGRESS HAIRLINE
───────────────────────────────────────────── */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      style={{ scaleX: scrollYProgress }}
      className="fixed top-0 inset-x-0 h-[2px] origin-left bg-ym-blue z-[70] pointer-events-none"
    />
  );
}

/* ─────────────────────────────────────────────
   NAVIGATION
   Transparent over the hero, cream once the page moves.
───────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "About", href: "#about" },
  { label: "Divisions", href: "#divisions" },
  { label: "Work", href: "#work" },
  { label: "Robocoders", href: "/robocoders" },
  { label: "Contact", href: "#contact" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  /* An open mobile panel is cream, so the bar above it has to be too —
     otherwise the header reads as two mismatched halves. */
  const solid = scrolled || open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    /* The hero is white now, same as the rest of the page, so the nav no
       longer needs a separate light-on-dark "over the hero" palette — it's
       always the light style. `solid` still shifts it down from top-9 to
       top-0 on scroll, closing the gap the brand bar leaves as it fades. */
    <header
      className={`fixed inset-x-0 z-[60] bg-ym-cream/95 backdrop-blur-md border-b border-ym-text/10 transition-[top] duration-500 ${
        solid ? "top-0" : "top-9"
      }`}
    >
      <div className="max-w-[92rem] mx-auto px-5 md:px-10 h-[4.2rem] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3 shrink-0">
          <LogoMark tint="#2563EB" className="w-8 h-8" />
          <span
            className="font-extrabold text-[1.05rem] md:text-[1.15rem] text-ym-blue"
            style={{ letterSpacing: "0.1em" }}
          >
            YUGMINDS
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-9">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="group relative font-semibold text-sm uppercase text-ym-text/75 hover:text-ym-blue transition-colors duration-300"
              style={{ letterSpacing: "0.1em" }}
            >
              {l.label}
              <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-ym-blue transition-all duration-400 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#contact"
            className="hidden sm:inline-flex items-center justify-center px-6 py-2.5 border border-ym-blue/35 text-ym-blue font-semibold text-sm uppercase hover:bg-ym-blue hover:text-ym-cream transition-colors duration-300"
            style={{ letterSpacing: "0.1em" }}
          >
            Enquire
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="lg:hidden w-10 h-10 flex items-center justify-center text-ym-text"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-ym-cream border-t border-ym-text/10 px-5 py-6 flex flex-col gap-1">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="font-semibold text-sm uppercase text-ym-text/80 py-3 border-b border-ym-text/8"
              style={{ letterSpacing: "0.1em" }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="mt-6 inline-flex items-center justify-center px-6 py-4 border border-ym-blue/35 text-ym-blue font-semibold text-sm uppercase"
            style={{ letterSpacing: "0.1em" }}
          >
            Enquire
          </a>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────
   HERO — white field, Hyperspeed streaks behind centered copy
───────────────────────────────────────────── */

/* The brand's own tagline, given the Robocoders treatment: a multi-line
   headline with the payoff phrase picked out in blue. */
const HERO_TAGLINE = [
  { text: "Building", accent: false },
  { text: "Tomorrow's", accent: true },
  { text: "Industries", accent: true },
];

function Hero({ start }: { start: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  /* Hero copy waits for the curtain so the two never play over each other. */
  const anim = start ? "in" : "out";
  const rise = {
    out: { opacity: 0, y: 34 },
    in: { opacity: 1, y: 0 },
  };

  /* Gate the *mount* on knowing the viewport class first, not just which
     config to pass: mounting with the wrong (e.g. desktop) config for even
     one frame before matchMedia reports back would briefly show the
     oversized-on-mobile version. `null` = not yet known. */
  const [viewport, setViewport] = useState<"mobile" | "desktop" | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setViewport(mq.matches ? "desktop" : "mobile");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <section
      ref={ref}
      id="top"
      className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden bg-ym-cream"
    >
      {/* pointer-events-none so the streaks never block clicks on the CTAs
          or nav sitting above them */}
      {viewport && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <HyperspeedBG
            effectOptions={viewport === "desktop" ? HYPERSPEED_OPTIONS : HYPERSPEED_OPTIONS_MOBILE}
          />
        </div>
      )}

      {/* The road's vanishing point sits roughly in the middle of the
          viewport regardless of config — tuning the 3D camera per
          breakpoint to dodge the text is exactly the fragile per-viewport
          chase that broke on mobile earlier. A soft white fade behind the
          copy is robust instead: streaks stay fully visible in the margins
          and dim out under the headline/paragraph, whatever their shape. */}
      {viewport && (
        <div
          className="absolute inset-0 z-[5] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 62% 58% at 50% 46%, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.75) 45%, rgba(255,255,255,0) 75%)",
          }}
        />
      )}

      <motion.div
        style={{ y, opacity: fade }}
        className="relative z-10 max-w-4xl mx-auto w-full px-5 md:px-10 pt-32 pb-20 text-center"
      >
        <motion.div
          variants={rise}
          initial="out"
          animate={anim}
          transition={{ duration: 1, delay: 0.15, ease: EASE_OUT }}
        >
          <Eyebrow className="text-ym-blue">Welcome to YugMinds</Eyebrow>
        </motion.div>

        {/* The tagline carries the headline slot, same as Robocoders'
            "Empowering Students to Code, Create, and Innovate" — the brand
            name moved to the eyebrow above, since it's already the biggest
            thing in the nav. Each line masks/rises in on its own delay,
            gated on `start` like the rest of the hero (not MaskLines'
            whileInView — that fires the moment the section enters the
            viewport, curtain or no curtain, which would let it finish
            revealing itself behind the preloader). */}
        {/* leading-[0.98] let descenders (the "g" in "Building") overlap
            the line below at this font-weight/size — 1.08 gives room
            between lines, but each line also sits in its own
            overflow-hidden wrapper (for the upward mask-reveal), and that
            wrapper's box is exactly one line-height tall with nothing
            reserved below the baseline — so the "g" was still getting
            clipped by its *own* line's box, not just crowded by the next
            one. pb-[0.18em] gives the wrapper room for the descender. */}
        <h1 className="mt-6 font-extrabold text-ym-text leading-[1.08] text-[3rem] sm:text-[4.4rem] md:text-[5.4rem] lg:text-[6rem]">
          {HERO_TAGLINE.map((line, i) => (
            <span key={line.text} className="block overflow-hidden pb-[0.18em] -mb-[0.18em]">
              <motion.span
                className={`block ${line.accent ? "text-ym-blue" : ""}`}
                initial={{ y: "112%" }}
                animate={start ? { y: "0%" } : { y: "112%" }}
                transition={{ duration: 1.1, delay: 0.35 + i * 0.13, ease: EASE_OUT }}
              >
                {line.text}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          variants={rise}
          initial="out"
          animate={anim}
          transition={{ duration: 1, delay: 0.9, ease: EASE_OUT }}
          className="mt-7 mx-auto max-w-xl text-[1.1rem] md:text-[1.25rem] font-normal text-ym-text/70 leading-relaxed"
        >
          Software, electronics and machines — engineered by one team,
          taught to the next.
        </motion.p>

        <motion.div
          variants={rise}
          initial="out"
          animate={anim}
          transition={{ duration: 1, delay: 1.02, ease: EASE_OUT }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-5"
        >
          <a
            href="#divisions"
            className="inline-flex items-center justify-center px-9 py-4 bg-ym-blue text-ym-cream font-semibold text-sm uppercase hover:bg-ym-blue-lit transition-colors duration-500"
            style={{ letterSpacing: "0.12em" }}
          >
            Explore Divisions
          </a>
          <a
            href="#contact"
            className="group inline-flex items-center gap-3 text-ym-blue font-semibold text-sm uppercase hover:text-ym-blue-lit transition-colors"
            style={{ letterSpacing: "0.12em" }}
          >
            Start a Project
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   MANIFESTO — cream, line-by-line, mark draws in
───────────────────────────────────────────── */
function Manifesto() {
  return (
    <section id="about" className="relative bg-ym-cream py-28 md:py-40 overflow-hidden">
      <div className="max-w-[92rem] mx-auto px-5 md:px-10 grid lg:grid-cols-[1.15fr_0.85fr] gap-16 items-center">
        <MaskLines
          className="font-extrabold text-ym-text text-[1.9rem] sm:text-[2.4rem] md:text-[3rem] leading-[1.35] space-y-4 md:space-y-6"
          lines={[
            <>Where an idea becomes a working thing.</>,
            <>
              Where a factory floor and a
              <br className="hidden sm:block" /> classroom share a roof.
            </>,
            <>Where students build what engineers ship.</>,
          ]}
        />

        <div className="relative flex flex-col items-center lg:items-end gap-6">
          <div className="relative w-[16rem] h-[16rem] md:w-[21rem] md:h-[21rem]">
            <DrawnRing
              className="absolute inset-0 w-full h-full"
              stroke="#2563EB"
              duration={1.6}
              inView
            />
            <motion.div
              className="absolute inset-[24%]"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 1.1, delay: 0.8, ease: EASE_OUT }}
            >
              <LogoMark tint="#2563EB" className="w-full h-full opacity-90" />
            </motion.div>
          </div>

          {/* Static, not scroll-revealed: both a hand-rolled motion.span
              and the codebase's proven Reveal (motion.div) never fired
              whileInView in this exact spot — confirmed with a raw
              IntersectionObserver on the same node reporting fully visible,
              real wheel-scroll input (not just programmatic scrollTo), and
              multi-second waits well past the transition's delay+duration —
              while every sibling whileInView on this page animates
              correctly. Root cause unresolved; not worth blocking a small
              label on it, so it just renders. */}
          {/* Same fixed width as the ring above and text-center, so it's
              centered *under the ring itself* regardless of whether the
              parent's items-end (desktop) or items-center (mobile) is
              active — matching widths means the two boxes' edges always
              align, so centering text within this one centers it under
              the ring's own middle, not the column's. */}
          <div className="w-[16rem] md:w-[21rem] text-center">
            <span
              className="font-extrabold text-ym-blue text-[1.6rem] md:text-[2rem]"
              style={{ letterSpacing: "0.14em" }}
            >
              YUGMINDS
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   STORY — image left, editorial column right
───────────────────────────────────────────── */
function Story() {
  return (
    <section className="bg-ym-cream pb-28 md:pb-40 overflow-hidden">
      <div className="max-w-[92rem] mx-auto px-5 md:px-10 grid md:grid-cols-2 gap-12 md:gap-20 items-start">
        {/* Observer on the outer wrapper — the clip-path wipe collapses the
            frame to zero area, which would stop it ever reporting in view. */}
        <motion.div
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true, margin: "-12%" }}
        >
          <motion.div
            className="relative aspect-[3/4] overflow-hidden"
            variants={{
              hidden: { clipPath: "inset(100% 0% 0% 0%)" },
              shown: { clipPath: "inset(0% 0% 0% 0%)" },
            }}
            transition={{ duration: 1.3, ease: EASE_CURTAIN }}
          >
            <motion.div
              className="absolute inset-0"
              variants={{ hidden: { scale: 1.18 }, shown: { scale: 1 } }}
              transition={{ duration: 1.6, ease: EASE_OUT }}
            >
              <Image
                src="/images/landing/factory-engineer.jpg"
                alt="A YugMinds engineer at work on the shop floor"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 45vw"
              />
            </motion.div>
          </motion.div>
        </motion.div>

        <div className="md:pt-16">
          <MaskLines
            className="font-extrabold text-ym-text text-[2rem] sm:text-[2.6rem] md:text-[3.2rem] leading-[1.2]"
            lines={[
              <>Started in 2024 with</>,
              <>one stubborn idea.</>,
              <>Everything else came after.</>,
            ]}
          />

          <Rule className="bg-ym-text/20 my-10" delay={0.35} />

          <MaskLines
            className="font-normal text-ym-text/85 text-[1.15rem] md:text-[1.4rem] leading-relaxed space-y-5"
            delay={0.45}
            stagger={0.1}
            lines={[
              <>Software teams shipping for clients worldwide.</>,
              <>A factory floor making the parts ourselves.</>,
              <>Labs where the next product is still an argument.</>,
              <>And classrooms where students build all three.</>,
            ]}
          />

          <Reveal delay={0.6} className="mt-12">
            <a
              href="#divisions"
              className="group inline-flex items-center gap-3 text-ym-blue font-semibold text-sm uppercase"
              style={{ letterSpacing: "0.12em" }}
            >
              <span className="relative">
                See the divisions
                <span className="absolute -bottom-1.5 left-0 h-px w-full bg-ym-blue/30 transition-all duration-500 group-hover:bg-ym-blue" />
              </span>
              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SCROLL-SCRUBBED STATEMENT
   Each character resolves as the section crosses the viewport.
───────────────────────────────────────────── */
function ScrubChar({
  char,
  index,
  total,
  progress,
}: {
  char: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const start = (index / total) * 0.72;
  const opacity = useTransform(progress, [start, start + 0.28], [0.1, 1]);
  return <motion.span style={{ opacity }}>{char}</motion.span>;
}

function ScrubStatement() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.35"],
  });
  const text = "You don't hire YugMinds. You build with us.";
  const chars = text.split("");

  return (
    /* Tall on purpose: the character scrub needs real scroll distance,
       otherwise the whole reveal resolves in a few dozen pixels. */
    <section className="bg-ym-sand min-h-[85svh] flex items-center py-32 md:py-48 overflow-hidden">
      <div ref={ref} className="max-w-5xl mx-auto px-5 md:px-10 text-center">
        <p className="font-extrabold text-ym-text text-[1.8rem] sm:text-[2.6rem] md:text-[3.6rem] leading-[1.25]">
          {/* Word-break spaces render as plain text nodes, not inside a
              motion.span — a space isolated as the sole content of its own
              inline element is fragile (this file shipped a build where one
              such space had silently become a non-breaking space, and the
              whole sentence rendered as a single unwrappable line overflowing
              its centered container). A bare " " between elements is the one
              pattern browsers always wrap correctly, regardless. */}
          {chars.map((c, i) =>
            c === " " ? (
              " "
            ) : (
              <ScrubChar
                key={i}
                char={c}
                index={i}
                total={chars.length}
                progress={scrollYProgress}
              />
            )
          )}
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   DIVISIONS — hairline timeline rows
───────────────────────────────────────────── */
const DIVISIONS = [
  {
    no: "01",
    title: "Build",
    unit: "YugMinds Software",
    desc: "Websites, mobile apps and business systems, shipped for clients worldwide.",
  },
  {
    no: "02",
    title: "Make",
    unit: "YugMinds Manufacturing",
    desc: "Workshops and factory lines turning engineered designs into volume.",
  },
  {
    no: "03",
    title: "Design",
    unit: "YugMinds Hardware",
    desc: "Electronics drawn, prototyped and taken to production in-house.",
  },
  {
    no: "04",
    title: "Research",
    unit: "YugMinds Labs",
    desc: "Where an untested idea earns its way into a real product.",
  },
  {
    no: "05",
    title: "Teach",
    unit: "Robocoders™ EdTech",
    desc: "Real hardware in classrooms — coding, robotics and AI for students.",
    href: "/robocoders",
  },
];

function Divisions() {
  return (
    <section id="divisions" className="bg-ym-cream py-28 md:py-40 overflow-hidden">
      <div className="max-w-[92rem] mx-auto px-5 md:px-10">
        <Reveal>
          <Eyebrow className="text-ym-blue">Five divisions</Eyebrow>
        </Reveal>
        <MaskLines
          className="mt-6 font-extrabold text-ym-text text-[2.2rem] sm:text-[3rem] md:text-[3.6rem] leading-[1.2]"
          lines={[<>Five divisions. One company.</>]}
        />

        <Rule className="bg-ym-blue/40 mt-14" />

        <div>
          {DIVISIONS.map((d, i) => {
            const Row = d.href ? motion.a : motion.div;
            return (
              <Row
                key={d.no}
                {...(d.href ? { href: d.href } : {})}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-8%" }}
                transition={{ duration: 0.9, delay: i * 0.07, ease: EASE_OUT }}
                className="group grid grid-cols-[3rem_1fr] md:grid-cols-[5rem_14rem_1fr_3rem] items-baseline md:items-center gap-x-4 md:gap-x-8 gap-y-2 py-8 md:py-9 border-b border-ym-text/12 transition-colors duration-500 hover:border-ym-blue/40"
              >
                <span
                  className="font-semibold text-sm text-ym-muted tabular-nums"
                  style={{ letterSpacing: "0.1em" }}
                >
                  {d.no}
                </span>

                <div className="md:col-auto">
                  <h3 className="font-extrabold text-ym-text text-[1.9rem] md:text-[2.4rem] leading-none transition-colors duration-500 group-hover:text-ym-blue">
                    {d.title}
                  </h3>
                  <Eyebrow className="mt-2.5 block text-ym-muted">
                    {d.unit}
                  </Eyebrow>
                </div>

                <p className="col-start-2 md:col-auto text-[1.05rem] md:text-[1.3rem] font-normal text-ym-text/70 leading-relaxed">
                  {d.desc}
                </p>

                <span className="hidden md:flex justify-end text-ym-muted transition-all duration-500 group-hover:text-ym-blue group-hover:translate-x-1.5">
                  <ArrowRight className="w-5 h-5" strokeWidth={1.1} />
                </span>
              </Row>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   NUMBERS
───────────────────────────────────────────── */
const STATS = [
  { value: 200, suffix: "+", label: "Projects delivered" },
  { value: 50, suffix: "+", label: "Clients worldwide" },
  { value: 5, suffix: "", label: "Divisions under one roof" },
  { value: 2024, suffix: "", label: "Established" },
];

function Numbers() {
  return (
    <section
      className="relative py-28 md:py-40 overflow-hidden ym-grain"
      style={{
        background:
          "radial-gradient(ellipse 80% 70% at 50% 40%, #2563EB 0%, #1E3A8A 48%, #020617 100%)",
      }}
    >
      <div className="absolute inset-0 ym-rings opacity-60 pointer-events-none" />
      <div className="relative max-w-[92rem] mx-auto px-5 md:px-10">
        <Reveal className="text-center">
          <Eyebrow className="text-ym-blue-soft/90">By the numbers</Eyebrow>
        </Reveal>
        <MaskLines
          className="mt-6 text-center font-extrabold text-ym-cream text-[2rem] sm:text-[2.7rem] md:text-[3.3rem] leading-[1.22]"
          lines={[
            <>The more clients trust us,</>,
            <>the more we build together.</>,
          ]}
        />

        <div className="mt-20 grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal
              key={s.label}
              delay={i * 0.1}
              className="px-4 py-8 md:px-8 text-center border-ym-cream/12 border-t lg:border-t-0 lg:border-l lg:first:border-l-0 [&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+2)]:border-t-0"
            >
              <CountUp
                value={s.value}
                suffix={s.suffix}
                className="block font-extrabold text-ym-cream text-[3rem] md:text-[4.2rem] leading-none tabular-nums"
              />
              <Eyebrow className="mt-5 block text-ym-cream/50">
                {s.label}
              </Eyebrow>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   WORK / JOURNAL
───────────────────────────────────────────── */
const STORIES = [
  {
    img: "/child-making-robot.jpg",
    alt: "A student building a robot",
    kicker: "Robocoders™",
    title: "Hands-on robotics for every student",
    desc: "Real hardware in classrooms, so students learn by building rather than watching.",
    href: "/robocoders",
  },
  {
    img: "/Kids Dong Robotics.png",
    alt: "Students working on robotics together",
    kicker: "Curriculum",
    title: "From classroom to competition",
    desc: "A structured STEM path that takes students from first circuits to national events.",
    href: "/robocoders/programs",
  },
  {
    img: "/images/landing/office-team.jpg",
    alt: "The YugMinds team collaborating",
    kicker: "Inside YugMinds",
    title: "One team, many industries",
    desc: "How a single team builds software, electronics and machines under one roof.",
    href: "#about",
  },
];

function Work() {
  return (
    <section id="work" className="bg-ym-cream py-28 md:py-40 overflow-hidden">
      <div className="max-w-[92rem] mx-auto px-5 md:px-10">
        <Reveal>
          <Eyebrow className="text-ym-blue">The journal</Eyebrow>
        </Reveal>
        <MaskLines
          className="mt-6 font-extrabold text-ym-text text-[2.2rem] sm:text-[3rem] md:text-[3.6rem] leading-[1.2]"
          lines={[<>Explore our story.</>]}
        />

        <div className="mt-16 grid md:grid-cols-3 gap-10 md:gap-8">
          {STORIES.map((s, i) => (
            <motion.a
              key={s.title}
              href={s.href}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 1, delay: i * 0.12, ease: EASE_OUT }}
              className="group block"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-ym-sand">
                <Image
                  src={s.img}
                  alt={s.alt}
                  fill
                  className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <span className="absolute inset-0 bg-ym-blue-deep/0 transition-colors duration-700 group-hover:bg-ym-blue-deep/15" />
              </div>

              <Eyebrow className="mt-7 block text-ym-blue">{s.kicker}</Eyebrow>
              <h3 className="mt-3 font-bold text-ym-text text-[1.5rem] md:text-[1.8rem] leading-snug transition-colors duration-500 group-hover:text-ym-blue">
                {s.title}
              </h3>
              <p className="mt-3 text-[1.05rem] font-normal text-ym-text/70 leading-relaxed">
                {s.desc}
              </p>
              <span
                className="mt-6 inline-flex items-center gap-2.5 font-semibold text-sm uppercase text-ym-blue"
                style={{ letterSpacing: "0.1em" }}
              >
                Read more
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-1.5" />
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CONTACT / DETAILS
───────────────────────────────────────────── */
function Details() {
  const rows = [
    { k: "Email", v: "info@yugminds.org", href: "mailto:info@yugminds.org" },
    { k: "Phone", v: "+91 85003 45655", href: "tel:+918500345655" },
    { k: "Studio", v: "Begumpet, Hyderabad, Telangana, India" },
    { k: "Founded", v: "2024 · YugMinds Private Limited" },
  ];

  return (
    <section className="bg-ym-sand py-28 md:py-40 overflow-hidden">
      <div className="max-w-[92rem] mx-auto px-5 md:px-10 grid md:grid-cols-[0.9fr_1.1fr] gap-14 md:gap-20">
        <div>
          <Reveal>
            <Eyebrow className="text-ym-blue">Get in touch</Eyebrow>
          </Reveal>
          <MaskLines
            className="mt-6 font-extrabold text-ym-text text-[2.2rem] md:text-[3rem] leading-[1.2]"
            lines={[<>Tell us what</>, <>you want built.</>]}
          />
        </div>

        <div>
          {rows.map((r, i) => (
            <Reveal key={r.k} delay={i * 0.08}>
              <div className="grid grid-cols-[7rem_1fr] md:grid-cols-[10rem_1fr] gap-4 items-baseline py-6 border-b border-ym-text/12">
                <Eyebrow className="text-ym-muted">{r.k}</Eyebrow>
                {r.href ? (
                  <a
                    href={r.href}
                    className="text-[1.15rem] md:text-[1.4rem] font-semibold text-ym-text hover:text-ym-blue transition-colors"
                  >
                    {r.v}
                  </a>
                ) : (
                  <span className="text-[1.15rem] md:text-[1.4rem] font-semibold text-ym-text">
                    {r.v}
                  </span>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
const FOOTER_COLS = [
  {
    heading: "Divisions",
    links: [
      { label: "Software", href: "#divisions" },
      { label: "Manufacturing", href: "#divisions" },
      { label: "Hardware", href: "#divisions" },
      { label: "Research Labs", href: "#divisions" },
      { label: "Robocoders™", href: "/robocoders" },
    ],
  },
  {
    heading: "The company",
    links: [
      { label: "Our story", href: "#about" },
      { label: "The journal", href: "#work" },
      { label: "Careers", href: "#contact" },
      { label: "Partners", href: "#contact" },
    ],
  },
  {
    heading: "Robocoders™",
    links: [
      { label: "Programs", href: "/robocoders/programs" },
      { label: "For schools", href: "/robocoders/for-schools" },
      { label: "For parents", href: "/robocoders/for-parents" },
      { label: "Student login", href: "/lms/login" },
    ],
  },
];

function Footer() {
  return (
    <footer id="contact" className="bg-ym-ink pt-20 pb-10 overflow-hidden">
      <div className="max-w-[92rem] mx-auto px-5 md:px-10">
        <Reveal className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-5">
            <span className="w-16 h-16 border border-ym-cream/20 flex items-center justify-center shrink-0">
              <LogoMark tint="#2563EB" className="w-9 h-9" />
            </span>
            <div>
              <p
                className="font-extrabold text-[1.35rem] text-ym-cream"
                style={{ letterSpacing: "0.1em" }}
              >
                YUGMINDS
              </p>
              <p className="mt-1.5 text-[0.98rem] font-normal text-ym-cream/55">
                Software, machines and education — Hyderabad, India
              </p>
            </div>
          </div>

          <a
            href="mailto:info@yugminds.org"
            className="inline-flex items-center justify-center px-10 py-4 bg-ym-blue text-ym-cream font-semibold text-sm uppercase hover:bg-ym-blue-lit transition-colors duration-500"
            style={{ letterSpacing: "0.12em" }}
          >
            Start a project
          </a>
        </Reveal>

        <Rule className="bg-ym-blue-soft/30 mt-14 mb-14" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
          {FOOTER_COLS.map((col, i) => (
            <Reveal key={col.heading} delay={i * 0.08}>
              <Eyebrow className="text-ym-cream/40">{col.heading}</Eyebrow>
              <ul className="mt-6 space-y-3.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[1.05rem] font-normal text-ym-cream/75 hover:text-ym-blue-soft transition-colors duration-400"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}

          <Reveal delay={0.24}>
            <Eyebrow className="text-ym-cream/40">Contact</Eyebrow>
            <ul className="mt-6 space-y-3.5">
              <li>
                <a
                  href="mailto:info@yugminds.org"
                  className="text-[1.05rem] font-normal text-ym-cream/75 hover:text-ym-blue-soft transition-colors"
                >
                  info@yugminds.org
                </a>
              </li>
              <li>
                <a
                  href="tel:+918500345655"
                  className="text-[1.05rem] font-normal text-ym-cream/75 hover:text-ym-blue-soft transition-colors"
                >
                  +91 85003 45655
                </a>
              </li>
              <li className="text-[1.05rem] font-normal text-ym-cream/55 leading-relaxed">
                Begumpet, Hyderabad,
                <br />
                Telangana, India
              </li>
            </ul>
          </Reveal>
        </div>

        <Rule className="bg-ym-cream/12 mt-16 mb-7" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <Eyebrow className="text-ym-cream/35">
            © {new Date().getFullYear()} YugMinds Private Limited
          </Eyebrow>
          <div className="flex items-center gap-8">
            <a href="#" className="font-semibold text-sm uppercase text-ym-cream/60 hover:text-ym-cream transition-colors" style={{ letterSpacing: "0.1em" }}>
              Terms
            </a>
            <a href="#" className="font-semibold text-sm uppercase text-ym-cream/60 hover:text-ym-cream transition-colors" style={{ letterSpacing: "0.1em" }}>
              Privacy
            </a>
            <a
              href="#top"
              className="group inline-flex items-center gap-2.5 font-semibold text-sm uppercase text-ym-cream/60 hover:text-ym-cream transition-colors"
              style={{ letterSpacing: "0.1em" }}
            >
              Back to top
              <ArrowUp className="w-3.5 h-3.5 transition-transform duration-500 group-hover:-translate-y-1" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function YugmindsHomePage() {
  /* The intro plays once per tab, not on every client-side return to `/`.
     useSyncExternalStore reads sessionStorage without a setState-in-effect:
     the server snapshot is "already seen", so SSR markup never contains the
     curtain and hydration stays clean. The flag is only written once the
     curtain has finished, so re-reading it mid-animation can't cut it short. */
  const introSeen = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem("ym-intro") === "1",
    () => true,
  );
  const [introDone, setIntroDone] = useState(false);

  const showPreloader = !introSeen && !introDone;
  const revealed = introSeen || introDone;

  useEffect(() => {
    if (introSeen) return;
    /* Browsers restore scroll on reload; without this the curtain would
       lift onto the middle of the page instead of the hero. */
    window.scrollTo(0, 0);
    document.body.classList.add("ym-locked");
    return () => document.body.classList.remove("ym-locked");
  }, [introSeen]);

  const finishIntro = () => {
    document.body.classList.remove("ym-locked");
    sessionStorage.setItem("ym-intro", "1");
    setIntroDone(true);
  };

  return (
    /* The CSS prefers-reduced-motion block can't reach framer's inline
       transforms — this makes every motion component here skip straight to
       its end state for users who ask for reduced motion. */
    <MotionConfig reducedMotion="user">
      <div data-landing className="min-h-screen bg-ym-cream">
        {showPreloader && <Preloader onDone={finishIntro} />}
        <ScrollProgress />
        <BrandSwitcherBar fixed editorial />
        <Nav />
        <main>
          <Hero start={revealed} />
          <Manifesto />
          <Story />
          <ScrubStatement />
          <Divisions />
          <Numbers />
          <Work />
          <Details />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
