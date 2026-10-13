"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  motion,
  MotionConfig,
  useScroll,
  useTransform,
  useInView,
  animate,
  type MotionValue,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Check,
  Code2,
  Cpu,
  Factory,
  FlaskConical,
  GraduationCap,
  Hammer,
  Lightbulb,
  Mail,
  MapPin,
  Menu,
  MonitorPlay,
  PenTool,
  Phone,
  Rocket,
  Shapes,
  X,
  type LucideIcon,
} from "lucide-react";
import BrandSwitcherBar from "../BrandSwitcherBar";
import { brandHref } from "@/lib/brand-host";

const LOGO_SRC = "/Yugminds_Official_Logo-preview.png";
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_CURTAIN = [0.76, 0, 0.24, 1] as const;
const GRADIENT_TEXT =
  "bg-gradient-to-r from-ym-blue via-blue-500 to-sky-400 bg-clip-text text-transparent";

/* WebGL only exists client-side, and the bundle (three + postprocessing) is
   heavy — load it lazily rather than in the main chunk every page pays for. */
const HyperspeedBG = dynamic(() => import("../public/Hyperspeed"), {
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
  as: Tag = "div",
  className = "",
  lineClassName = "",
  delay = 0,
  stagger = 0.13,
}: {
  lines: React.ReactNode[];
  as?: "div" | "h2" | "h3" | "p";
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
}) {
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        /* The trigger has to sit on the *clipping* wrapper, not on the line
           itself: IntersectionObserver clips a target to its ancestors' boxes,
           and a line parked at y:115% inside overflow-hidden has zero visible
           area — so it would never report as in view and never animate.
           Variants propagate the state down to the child that actually moves.
           pb/-mb leaves room for descenders inside the clipping box. */
        <motion.span
          key={i}
          className="block overflow-hidden pb-[0.12em] -mb-[0.12em]"
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
    </Tag>
  );
}

/* Small rounded label with a dot — the section kicker. */
function Pill({
  children,
  dark = false,
  className = "",
}: {
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs md:text-sm font-semibold ${
        dark
          ? "border-white/15 bg-white/10 text-ym-blue-soft"
          : "border-ym-blue/15 bg-ym-blue/[0.06] text-ym-blue"
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-ym-blue-soft" : "bg-ym-blue"}`} />
      {children}
    </span>
  );
}

function SectionHeading({
  pill,
  lines,
  intro,
  center = false,
  dark = false,
}: {
  pill: string;
  lines: React.ReactNode[];
  intro?: string;
  center?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={center ? "text-center max-w-3xl mx-auto" : "max-w-3xl"}>
      <Reveal>
        <Pill dark={dark}>{pill}</Pill>
      </Reveal>
      <MaskLines
        as="h2"
        className={`mt-6 font-extrabold text-[2.1rem] sm:text-[2.8rem] md:text-[3.4rem] leading-[1.12] tracking-tight ${
          dark ? "text-white" : "text-ym-text"
        }`}
        lines={lines}
      />
      {intro && (
        <Reveal delay={0.2}>
          <p
            className={`mt-6 text-[1.05rem] md:text-[1.2rem] leading-relaxed ${
              dark ? "text-white/65" : "text-ym-muted"
            } ${center ? "mx-auto" : ""} max-w-2xl`}
          >
            {intro}
          </p>
        </Reveal>
      )}
    </div>
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
      className="fixed top-0 inset-x-0 h-[2px] origin-left bg-gradient-to-r from-ym-blue to-sky-400 z-[70] pointer-events-none"
    />
  );
}

/* Primary / secondary buttons shared across sections. */
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ym-blue px-7 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(37,99,235,0.7)] transition-all duration-300 hover:bg-ym-blue-lit hover:-translate-y-0.5";
const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-ym-text/12 bg-white/80 px-7 py-3.5 text-[0.95rem] font-semibold text-ym-text backdrop-blur transition-all duration-300 hover:border-ym-blue/40 hover:text-ym-blue hover:-translate-y-0.5";

/* ─────────────────────────────────────────────
   NAVIGATION — floating glass pill
───────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "About", href: "/about" },
  { label: "Divisions", href: "/divisions" },
  { label: "Work", href: "/work" },
  { label: "Products", href: brandHref("/robocoders/products") },
  { label: "Robocoders", href: brandHref("/robocoders") },
  { label: "Contact", href: "/contact" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    /* `scrolled` shifts it from top-9 to the top edge, closing the gap the
       brand bar leaves as it fades. */
    <header
      className={`fixed inset-x-0 z-[60] px-3 md:px-6 transition-[top] duration-500 ${
        scrolled || open ? "top-2" : "top-12"
      }`}
    >
      <div
        className={`mx-auto max-w-6xl rounded-full border bg-white/80 backdrop-blur-xl transition-shadow duration-500 ${
          scrolled
            ? "border-ym-text/10 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)]"
            : "border-ym-text/[0.07] shadow-[0_6px_24px_-14px_rgba(15,23,42,0.2)]"
        }`}
      >
        <div className="h-14 md:h-16 pl-4 pr-2 md:pl-6 md:pr-2.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <LogoMark tint="#2563EB" className="w-8 h-8" />
            <span className="font-extrabold text-[1.05rem] md:text-[1.1rem] text-ym-text tracking-wide">
              YugMinds
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="rounded-full px-4 py-2 text-[0.92rem] font-medium text-ym-text/70 transition-colors duration-300 hover:bg-ym-blue/[0.07] hover:text-ym-blue"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <Link
              href="/contact"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-ym-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-300 hover:bg-ym-blue-lit"
            >
              Start a project
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={open}
              className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-ym-text hover:bg-ym-text/5"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden mx-auto mt-2 max-w-6xl rounded-3xl border border-ym-text/10 bg-white p-3 shadow-xl"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-[1rem] font-medium text-ym-text/80 hover:bg-ym-blue/[0.06] hover:text-ym-blue"
            >
              {l.label}
              <ArrowRight className="w-4 h-4 opacity-40" />
            </Link>
          ))}
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className={`${BTN_PRIMARY} mt-2 w-full`}
          >
            Start a project
          </Link>
        </motion.div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────
   HERO — white field, Hyperspeed streaks behind centered copy
───────────────────────────────────────────── */
const HERO_TAGLINE = [
  { text: "Building", accent: false },
  { text: "Tomorrow's", accent: true },
  { text: "Industries", accent: true },
];

const DIVISION_CHIPS: { label: string; icon: LucideIcon }[] = [
  { label: "Software", icon: Code2 },
  { label: "Manufacturing", icon: Factory },
  { label: "Hardware", icon: Cpu },
  { label: "Research Labs", icon: FlaskConical },
  { label: "Robocoders™ EdTech", icon: GraduationCap },
];

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const rise = {
    out: { opacity: 0, y: 30 },
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
          viewport regardless of config — a soft white fade behind the copy
          keeps streaks visible in the margins and dim under the text. */}
      <div
        className="absolute inset-0 z-[5] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 62% 58% at 50% 46%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.78) 45%, rgba(255,255,255,0) 75%)",
        }}
      />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 z-[4] h-[34rem] w-[34rem] rounded-full bg-ym-blue/10 blur-[120px] pointer-events-none" />

      <motion.div
        style={{ y, opacity: fade }}
        className="relative z-10 max-w-5xl mx-auto w-full px-5 md:px-10 pt-36 pb-20 text-center"
      >
        <motion.div
          variants={rise}
          initial="out"
          animate="in"
          transition={{ duration: 1, delay: 0.1, ease: EASE_OUT }}
        >
          <span className="inline-flex items-center gap-3 rounded-full border border-ym-blue/10 bg-white/80 py-1.5 pl-1.5 pr-5 shadow-[0_8px_30px_-12px_rgba(37,99,235,0.35)] backdrop-blur-md">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-ym-blue to-ym-blue-lit">
              <LogoMark tint="#fff" className="h-5 w-5" />
            </span>
            <span className="text-sm md:text-[0.95rem] font-semibold text-ym-text">Welcome to YugMinds</span>
            <span className="hidden sm:block h-4 w-px bg-ym-blue/15" />
            <span className="hidden sm:block text-sm text-ym-muted">Since 2024</span>
          </span>
        </motion.div>

        <h1 className="mt-7 font-extrabold text-ym-text leading-[1.04] tracking-tight text-[3rem] sm:text-[4.4rem] md:text-[5.6rem] lg:text-[6.4rem]">
          {HERO_TAGLINE.map((line, i) => (
            /* Each line sits in its own overflow-hidden mask for the rise;
               pb/-mb reserves room so descenders (the "g") aren't clipped. */
            <span key={line.text} className="block overflow-hidden pb-[0.18em] -mb-[0.18em]">
              <motion.span
                className={`block ${line.accent ? GRADIENT_TEXT : ""}`}
                initial={{ y: "112%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1.1, delay: 0.25 + i * 0.12, ease: EASE_OUT }}
              >
                {line.text}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          variants={rise}
          initial="out"
          animate="in"
          transition={{ duration: 1, delay: 0.75, ease: EASE_OUT }}
          className="mt-7 mx-auto max-w-2xl text-[1.1rem] md:text-[1.3rem] text-ym-text/65 leading-relaxed"
        >
          Software, electronics and machines — engineered by one team in Hyderabad,
          and taught to the next generation through Robocoders™.
        </motion.p>

        <motion.div
          variants={rise}
          initial="out"
          animate="in"
          transition={{ duration: 1, delay: 0.9, ease: EASE_OUT }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link href="/contact" className={BTN_PRIMARY}>
            Start a project
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/divisions" className={BTN_SECONDARY}>
            Explore divisions
          </Link>
        </motion.div>

        <motion.ul
          variants={rise}
          initial="out"
          animate="in"
          transition={{ duration: 1, delay: 1.05, ease: EASE_OUT }}
          className="mt-14 flex flex-wrap items-center justify-center gap-2.5"
        >
          {DIVISION_CHIPS.map(({ label, icon: Icon }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-ym-text/[0.08] bg-white/85 px-4 py-2 text-sm font-medium text-ym-text/75 shadow-sm backdrop-blur"
            >
              <Icon className="w-4 h-4 text-ym-blue" />
              {label}
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   ABOUT — copy + photo collage
───────────────────────────────────────────── */
const ABOUT_POINTS = [
  "Software teams shipping for clients worldwide",
  "A factory floor making the parts ourselves",
  "Labs where the next product is still an argument",
  "Classrooms where students build all three",
];

function About() {
  return (
    <section id="about" className="relative bg-ym-cream py-24 md:py-36 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-10 grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
        <div>
          <SectionHeading
            pill="About YugMinds"
            lines={[<>Where an idea becomes</>, <span key="a" className={GRADIENT_TEXT}>a working thing.</span>]}
            intro="Started in 2024 in Hyderabad with one stubborn idea: software, electronics and machines, engineered by one team — where a factory floor and a classroom share a roof."
          />
          <ul className="mt-10 grid sm:grid-cols-2 gap-3">
            {ABOUT_POINTS.map((p, i) => (
              <Reveal key={p} delay={0.1 + i * 0.07}>
                <li className="flex h-full items-start gap-3 rounded-2xl border border-ym-text/[0.07] bg-ym-sand p-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ym-blue">
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </span>
                  <span className="text-[0.98rem] font-medium text-ym-text/85 leading-snug">{p}</span>
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={0.4} className="mt-10">
            <Link
              href="/divisions"
              className="group inline-flex items-center gap-2 font-semibold text-ym-blue"
            >
              See the divisions
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>

        {/* Observer on the outer wrapper — the clip-path wipe collapses the
            frame to zero area, which would stop it ever reporting in view. */}
        <motion.div
          className="relative pb-16 lg:pb-0"
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true, margin: "-12%" }}
        >
          <motion.div
            className="relative aspect-[4/5] w-[85%] ml-auto overflow-hidden rounded-[2rem] shadow-2xl"
            variants={{
              hidden: { clipPath: "inset(100% 0% 0% 0% round 2rem)" },
              shown: { clipPath: "inset(0% 0% 0% 0% round 2rem)" },
            }}
            transition={{ duration: 1.3, ease: EASE_CURTAIN }}
          >
            <Image
              src="/images/landing/factory-engineer.jpg"
              alt="A YugMinds engineer at work on the shop floor"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 85vw, 40vw"
            />
          </motion.div>

          <motion.div
            className="absolute bottom-0 left-0 w-[52%] aspect-square overflow-hidden rounded-[1.75rem] border-[6px] border-white shadow-2xl"
            variants={{ hidden: { opacity: 0, y: 40 }, shown: { opacity: 1, y: 0 } }}
            transition={{ duration: 1, delay: 0.5, ease: EASE_OUT }}
          >
            <Image
              src="/images/landing/software-code.jpg"
              alt="Code written by the YugMinds software team"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 50vw, 22vw"
            />
          </motion.div>

          <motion.div
            className="absolute top-6 left-2 md:left-6 flex items-center gap-3 rounded-2xl border border-white/60 bg-white/85 px-4 py-3 shadow-xl backdrop-blur-md"
            variants={{ hidden: { opacity: 0, scale: 0.9 }, shown: { opacity: 1, scale: 1 } }}
            transition={{ duration: 0.8, delay: 0.8, ease: EASE_OUT }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ym-blue/10">
              <LogoMark tint="#2563EB" className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-sm font-bold text-ym-text">Since 2024</span>
              <span className="block text-xs text-ym-muted">Begumpet, Hyderabad</span>
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   DIVISIONS — bento grid of photo cards
───────────────────────────────────────────── */
const DIVISIONS: {
  no: string;
  title: string;
  unit: string;
  desc: string;
  icon: LucideIcon;
  img: string;
  span: string;
  href?: string;
}[] = [
  {
    no: "01",
    title: "Build",
    unit: "YugMinds Software",
    desc: "Websites, mobile apps and business systems, shipped for clients worldwide.",
    icon: Code2,
    img: "/images/landing/software-code.jpg",
    span: "md:col-span-4",
  },
  {
    no: "02",
    title: "Make",
    unit: "YugMinds Manufacturing",
    desc: "Workshops and factory lines turning engineered designs into volume.",
    icon: Factory,
    img: "/images/landing/factory-engineer.jpg",
    span: "md:col-span-2",
  },
  {
    no: "03",
    title: "Design",
    unit: "YugMinds Hardware",
    desc: "Electronics drawn, prototyped and taken to production in-house.",
    icon: Cpu,
    img: "/images/landing/circuit-board.jpg",
    span: "md:col-span-2",
  },
  {
    no: "04",
    title: "Research",
    unit: "YugMinds Labs",
    desc: "Where an untested idea earns its way into a real product.",
    icon: FlaskConical,
    img: "/images/landing/dev-team.jpg",
    span: "md:col-span-2",
  },
  {
    no: "05",
    title: "Teach",
    unit: "Robocoders™ EdTech",
    desc: "Real hardware in classrooms — coding, robotics and AI for students.",
    icon: GraduationCap,
    img: "/child-making-robot.jpg",
    span: "md:col-span-2",
    href: brandHref("/robocoders"),
  },
];

function Divisions() {
  return (
    <section id="divisions" className="bg-ym-sand py-24 md:py-36 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <SectionHeading
            pill="Five divisions"
            lines={[<>Five divisions.</>, <span key="d" className={GRADIENT_TEXT}>One company.</span>]}
            intro="Every YugMinds division works under one roof, so an idea can go from design to product to classroom without changing hands."
          />
          <Reveal delay={0.2}>
            <Link href="/contact" className={BTN_SECONDARY}>
              Work with us
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Reveal>
        </div>

        <div className="mt-14 grid md:grid-cols-6 gap-4 md:gap-5">
          {DIVISIONS.map((d, i) => {
            const Icon = d.icon;
            const body = (
              <>
                <Image
                  src={d.img}
                  alt={`${d.unit} — ${d.desc}`}
                  fill
                  className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
                  sizes="(max-width: 768px) 100vw, 60vw"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-ym-ink/90 via-ym-ink/45 to-ym-ink/10" />
                <div className="relative z-10 flex flex-1 flex-col justify-between p-6 md:p-7">
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur-md">
                      <Icon className="h-6 w-6 text-white" />
                    </span>
                    <span className="text-sm font-semibold text-white/60 tabular-nums">{d.no}</span>
                  </div>
                  <div>
                    <span className="text-xs md:text-sm font-semibold uppercase tracking-[0.12em] text-ym-blue-soft">
                      {d.unit}
                    </span>
                    <h3 className="mt-2 flex items-center gap-2 text-[1.8rem] md:text-[2.1rem] font-extrabold text-white leading-none">
                      {d.title}
                      {d.href && (
                        <ArrowUpRight className="h-6 w-6 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      )}
                    </h3>
                    <p className="mt-3 max-w-md text-[0.98rem] text-white/75 leading-relaxed">{d.desc}</p>
                  </div>
                </div>
              </>
            );
            const className = `group relative flex h-full flex-col min-h-[19rem] md:min-h-[22rem] overflow-hidden rounded-[1.75rem] ${d.span}`;
            return (
              <motion.div
                key={d.no}
                className={d.span}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-8%" }}
                transition={{ duration: 0.9, delay: (i % 3) * 0.08, ease: EASE_OUT }}
              >
                {d.href ? (
                  <Link href={d.href} className={className}>
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PRODUCTS — what we ship from Robocoders
───────────────────────────────────────────── */
const PRODUCTS: {
  id: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  tags: string[];
}[] = [
  {
    id: "studio",
    icon: MonitorPlay,
    title: "RoboCoders Studio",
    desc: "Offline desktop software for block coding, Python, AI experiments and robot control — all in one app.",
    tags: ["Ages 8+", "Works offline"],
  },
  {
    id: "robotics-kit",
    icon: Cpu,
    title: "ESP32 Robotics Kit",
    desc: "A custom ESP32 board, sensors, motors and chassis with 40+ guided robotics, IoT and automation projects.",
    tags: ["40+ projects", "Block & C coding"],
  },
  {
    id: "play-kit",
    icon: Shapes,
    title: "RoboCoders Play Kit",
    desc: "Screen-free coding for young kids — place a direction card on the robot and it follows the command.",
    tags: ["Screen-free", "Learn by playing"],
  },
];

function Products() {
  return (
    <section id="products" className="relative bg-ym-cream py-24 md:py-36 overflow-hidden">
      <div className="absolute top-20 right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-sky-200/40 blur-[120px] pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-5 md:px-10">
        <SectionHeading
          center
          pill="Our products"
          lines={[<>Made in-house,</>, <span key="p" className={GRADIENT_TEXT}>built for learning.</span>]}
          intro="Software and hardware designed by YugMinds and used in Robocoders™ classrooms across India."
        />

        <div className="mt-16 grid md:grid-cols-3 gap-5">
          {PRODUCTS.map(({ id, icon: Icon, title, desc, tags }, i) => (
            <Reveal key={id} delay={i * 0.1}>
              <Link
                href={brandHref(`/robocoders/products#${id}`)}
                className="group flex h-full flex-col rounded-[1.75rem] border border-ym-text/[0.08] bg-white p-3 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] transition-all duration-500 hover:-translate-y-1.5 hover:border-ym-blue/30 hover:shadow-[0_30px_60px_-30px_rgba(37,99,235,0.45)]"
              >
                <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-ym-blue via-blue-600 to-ym-blue-deep">
                  <div className="absolute inset-0 ym-rings opacity-80" />
                  <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-sky-400/40 blur-2xl" />
                  <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/25 bg-white/15 backdrop-blur-md transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <Icon className="h-10 w-10 text-white" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4 md:p-5">
                  <h3 className="text-[1.35rem] font-bold text-ym-text">{title}</h3>
                  <p className="mt-2.5 text-[0.98rem] text-ym-muted leading-relaxed">{desc}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <span key={t} className="rounded-full bg-ym-blue/[0.07] px-3 py-1 text-xs font-semibold text-ym-blue">
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="mt-auto pt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ym-blue">
                    Learn more
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
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
  const opacity = useTransform(progress, [start, start + 0.28], [0.15, 1]);
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
    <section className="relative bg-ym-ink min-h-[80svh] flex items-center py-32 md:py-44 overflow-hidden ym-grain">
      <div className="absolute left-1/2 top-1/2 h-[30rem] w-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ym-blue/30 blur-[140px] pointer-events-none" />
      <div ref={ref} className="relative max-w-5xl mx-auto px-5 md:px-10 text-center">
        <p className="font-extrabold text-white text-[2rem] sm:text-[2.8rem] md:text-[4rem] leading-[1.18] tracking-tight">
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
   PROCESS — how a project moves through YugMinds
───────────────────────────────────────────── */
const STEPS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Lightbulb,
    title: "Understand",
    desc: "We start with your problem, your users and your constraints — not a template.",
  },
  {
    icon: PenTool,
    title: "Design & prototype",
    desc: "Software flows, circuit boards and mechanical parts are drawn and tested early.",
  },
  {
    icon: Hammer,
    title: "Build & manufacture",
    desc: "Our software, hardware and factory teams build it under the same roof.",
  },
  {
    icon: Rocket,
    title: "Launch & support",
    desc: "We ship, measure and keep improving — and teach what we learn in classrooms.",
  },
];

function Process() {
  return (
    <section className="bg-ym-cream py-24 md:py-36 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <SectionHeading
          center
          pill="How we work"
          lines={[<>From first sketch</>, <span key="s" className={GRADIENT_TEXT}>to shipped product.</span>]}
          intro="One team owns the whole journey, so nothing gets lost between design, engineering and the factory floor."
        />

        <div className="relative mt-16">
          <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-gradient-to-r from-ym-blue/0 via-ym-blue/35 to-ym-blue/0 lg:block" />
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 0.1}>
                <li className="relative mt-8 flex h-[calc(100%-2rem)] flex-col items-center rounded-[1.75rem] border border-ym-text/[0.07] bg-ym-sand px-6 pb-8 text-center">
                  <span className="relative -mt-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-ym-blue text-white shadow-[0_12px_30px_-10px_rgba(37,99,235,0.8)]">
                    <Icon className="h-7 w-7" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-ym-ink text-[0.7rem] font-bold">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-6 text-[1.2rem] font-bold text-ym-text">{title}</h3>
                  <p className="mt-2.5 text-[0.96rem] text-ym-muted leading-relaxed">{desc}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   NUMBERS — rounded gradient panel
───────────────────────────────────────────── */
const STATS = [
  { value: 200, suffix: "+", label: "Projects delivered" },
  { value: 50, suffix: "+", label: "Clients worldwide" },
  { value: 5, suffix: "", label: "Divisions under one roof" },
  { value: 2024, suffix: "", label: "Established" },
];

function Numbers() {
  return (
    <section className="bg-ym-cream px-3 md:px-6 py-6 md:py-10">
      <div
        className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[2.5rem] px-5 py-20 md:px-12 md:py-28 ym-grain"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 30%, #2563EB 0%, #1E3A8A 50%, #020617 100%)",
        }}
      >
        <div className="absolute inset-0 ym-rings opacity-70 pointer-events-none" />
        <div className="relative">
          <SectionHeading
            center
            dark
            pill="By the numbers"
            lines={[<>The more clients trust us,</>, <>the more we build together.</>]}
          />

          <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {STATS.map((s, i) => (
              <Reveal
                key={s.label}
                delay={i * 0.1}
                className="rounded-3xl border border-white/10 bg-white/[0.06] px-4 py-8 md:py-10 text-center backdrop-blur-sm"
              >
                <CountUp
                  value={s.value}
                  suffix={s.suffix}
                  className="block font-extrabold text-white text-[2.6rem] md:text-[3.8rem] leading-none tabular-nums"
                />
                <span className="mt-4 block text-sm md:text-[0.95rem] font-medium text-white/60">
                  {s.label}
                </span>
              </Reveal>
            ))}
          </div>
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
    href: brandHref("/robocoders"),
  },
  {
    img: "/Kids Dong Robotics.png",
    alt: "Students working on robotics together",
    kicker: "Curriculum",
    title: "From classroom to competition",
    desc: "A structured STEM path that takes students from first circuits to national events.",
    href: brandHref("/robocoders/programs"),
  },
  {
    img: "/images/landing/office-team.jpg",
    alt: "The YugMinds team collaborating",
    kicker: "Inside YugMinds",
    title: "One team, many industries",
    desc: "How a single team builds software, electronics and machines under one roof.",
    href: "/about",
  },
];

function Work() {
  return (
    <section id="work" className="bg-ym-cream py-24 md:py-36 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <SectionHeading
          pill="The journal"
          lines={[<>Explore our story.</>]}
          intro="What we build, who we build it with, and the students learning alongside us."
        />

        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {STORIES.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <Link
                href={s.href}
                className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-ym-text/[0.08] bg-white transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-30px_rgba(15,23,42,0.4)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-ym-sand">
                  <Image
                    src={s.img}
                    alt={s.alt}
                    fill
                    className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ym-blue backdrop-blur">
                    {s.kicker}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-[1.3rem] md:text-[1.45rem] font-bold text-ym-text leading-snug transition-colors duration-300 group-hover:text-ym-blue">
                    {s.title}
                  </h3>
                  <p className="mt-2.5 text-[0.98rem] text-ym-muted leading-relaxed">{s.desc}</p>
                  <span className="mt-auto pt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ym-blue">
                    Read more
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CTA BAND
───────────────────────────────────────────── */
function CtaBand() {
  return (
    <section className="bg-ym-cream px-3 md:px-6 pb-16 md:pb-24 pt-6">
      <Reveal className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-ym-blue via-blue-700 to-ym-blue-deep px-6 py-16 md:px-16 md:py-24 text-center">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-sky-400/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-indigo-400/30 blur-3xl pointer-events-none" />
        <LogoMark
          tint="rgba(255,255,255,0.07)"
          className="absolute -right-10 top-1/2 h-[22rem] w-[22rem] -translate-y-1/2 pointer-events-none"
        />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl text-[2.1rem] sm:text-[2.8rem] md:text-[3.6rem] font-extrabold leading-[1.1] tracking-tight text-white">
            Have an idea? Let&apos;s build it together.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.05rem] md:text-[1.2rem] text-white/75 leading-relaxed">
            Software, electronics, manufacturing or a Robocoders™ programme for your school —
            tell us what you want built.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:info@yugminds.org"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[0.95rem] font-semibold text-ym-blue transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-50"
            >
              <Mail className="h-4 w-4" />
              info@yugminds.org
            </a>
            <a
              href="tel:+918500345655"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-7 py-3.5 text-[0.95rem] font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
            >
              <Phone className="h-4 w-4" />
              +91 85003 45655
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CONTACT / DETAILS
───────────────────────────────────────────── */
const CONTACT_CARDS: { icon: LucideIcon; k: string; v: string; href?: string }[] = [
  { icon: Mail, k: "Email", v: "info@yugminds.org", href: "mailto:info@yugminds.org" },
  { icon: Phone, k: "Phone", v: "+91 85003 45655", href: "tel:+918500345655" },
  { icon: MapPin, k: "Studio", v: "Begumpet, Hyderabad, Telangana, India" },
  { icon: CalendarDays, k: "Founded", v: "2024 · YugMinds Private Limited" },
];

function Details() {
  return (
    <section className="bg-ym-cream py-16 md:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CONTACT_CARDS.map(({ icon: Icon, k, v, href }, i) => {
          const inner = (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ym-blue/10 text-ym-blue transition-colors duration-300 group-hover:bg-ym-blue group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-6 block text-sm font-medium text-ym-muted">{k}</span>
              <span className="mt-1.5 block text-[1.1rem] font-semibold text-ym-text leading-snug">{v}</span>
            </>
          );
          const cls =
            "group block h-full rounded-[1.75rem] border border-ym-text/[0.08] bg-ym-sand p-6 md:p-7 transition-all duration-300 hover:-translate-y-1 hover:border-ym-blue/30 hover:bg-white hover:shadow-xl";
          return (
            <Reveal key={k} delay={i * 0.08}>
              {href ? (
                <a href={href} className={cls}>
                  {inner}
                </a>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </Reveal>
          );
        })}
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
      { label: "Software", href: "/divisions" },
      { label: "Manufacturing", href: "/divisions" },
      { label: "Hardware", href: "/divisions" },
      { label: "Research Labs", href: "/divisions" },
      { label: "Robocoders™", href: brandHref("/robocoders") },
    ],
  },
  {
    heading: "The company",
    links: [
      { label: "Our story", href: "/about" },
      { label: "The journal", href: "/work" },
      { label: "Careers", href: "/contact" },
      { label: "Partners", href: "/contact" },
    ],
  },
  {
    heading: "Robocoders™",
    links: [
      { label: "Programs", href: brandHref("/robocoders/programs") },
      { label: "Products", href: brandHref("/robocoders/products") },
      { label: "For schools", href: brandHref("/robocoders/for-schools") },
      { label: "For parents", href: brandHref("/robocoders/for-parents") },
      { label: "Student login", href: brandHref("/lms/login") },
    ],
  },
];

function Footer() {
  return (
    <footer id="contact" className="relative bg-ym-ink pt-20 pb-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-ym-blue/20 blur-[120px] pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-5 md:px-10">
        <div className="grid lg:grid-cols-[1.3fr_2fr] gap-14">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <LogoMark tint="#60A5FA" className="w-7 h-7" />
              </span>
              <span className="text-[1.3rem] font-extrabold text-white tracking-wide">YugMinds</span>
            </div>
            <p className="mt-5 max-w-sm text-[1rem] text-white/55 leading-relaxed">
              Software, electronics and machines — engineered by one team in Hyderabad, India,
              and taught to the next through Robocoders™.
            </p>
            <Link href="/contact" className={`${BTN_PRIMARY} mt-8`}>
              Start a project
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
            {FOOTER_COLS.map((col, i) => (
              <Reveal key={col.heading} delay={i * 0.08}>
                <span className="text-sm font-semibold text-white">{col.heading}</span>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-[0.98rem] text-white/55 hover:text-ym-blue-soft transition-colors duration-300"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}

            <Reveal delay={0.24}>
              <span className="text-sm font-semibold text-white">Contact</span>
              <ul className="mt-5 space-y-3">
                <li>
                  <a
                    href="mailto:info@yugminds.org"
                    className="text-[0.98rem] text-white/55 hover:text-ym-blue-soft transition-colors"
                  >
                    info@yugminds.org
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+918500345655"
                    className="text-[0.98rem] text-white/55 hover:text-ym-blue-soft transition-colors"
                  >
                    +91 85003 45655
                  </a>
                </li>
                <li className="text-[0.98rem] text-white/40 leading-relaxed">
                  Begumpet, Hyderabad,
                  <br />
                  Telangana, India
                </li>
              </ul>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 pt-7 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <span className="text-sm text-white/40">
            © {new Date().getFullYear()} YugMinds Private Limited
          </span>
          <div className="flex items-center gap-7 text-sm">
            <a href="#" className="text-white/50 hover:text-white transition-colors">
              Terms
            </a>
            <a href="#" className="text-white/50 hover:text-white transition-colors">
              Privacy
            </a>
            <a
              href="#top"
              className="group inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors"
            >
              Back to top
              <ArrowUp className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-y-1" />
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
function Shell({ children }: { children: React.ReactNode }) {
  return (
    /* The CSS prefers-reduced-motion block can't reach framer's inline
       transforms — this makes every motion component here skip straight to
       its end state for users who ask for reduced motion. */
    <MotionConfig reducedMotion="user">
      <div data-landing className="min-h-screen bg-ym-cream">
        <ScrollProgress />
        <BrandSwitcherBar fixed />
        <Nav />
        <main>{children}</main>
        <Footer />
      </div>
    </MotionConfig>
  );
}

export function YugmindsHomePage() {
  return (
    <Shell>
      <Hero />
      <About />
      <Divisions />
      <Products />
      <ScrubStatement />
      <Process />
      <Numbers />
      <Work />
      <CtaBand />
    </Shell>
  );
}

/* ─────────────────────────────────────────────
   STANDALONE PAGES — /about, /divisions, /work, /contact
   Same sections as the home page, each with its own H1 so search engines
   can index them as separate pages.
───────────────────────────────────────────── */
function SubPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <Shell>
      <section id="top" className="relative bg-ym-cream pt-44 md:pt-52 pb-10 md:pb-16 overflow-hidden">
        <div className="absolute -top-32 right-[-8rem] h-[30rem] w-[30rem] rounded-full bg-ym-blue/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-[-10rem] h-[24rem] w-[24rem] rounded-full bg-sky-200/40 blur-[120px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-5 md:px-10">
          <Reveal>
            <Pill>{eyebrow}</Pill>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 font-extrabold text-ym-text text-[2.6rem] sm:text-[3.6rem] md:text-[4.6rem] leading-[1.06] tracking-tight max-w-4xl">
              {title}
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-7 max-w-2xl text-[1.1rem] md:text-[1.3rem] text-ym-muted leading-relaxed">
              {intro}
            </p>
          </Reveal>
        </div>
      </section>
      {children}
    </Shell>
  );
}

export function YugmindsAboutPage() {
  return (
    <SubPage
      eyebrow="Our story"
      title="One team building software, electronics and machines."
      intro="YugMinds started in 2024 in Hyderabad with one stubborn idea: software, electronics and machines, engineered by one team and taught to the next through Robocoders™."
    >
      <About />
      <ScrubStatement />
      <Process />
      <Numbers />
      <CtaBand />
    </SubPage>
  );
}

export function YugmindsDivisionsPage() {
  return (
    <SubPage
      eyebrow="Our divisions"
      title="Everything we build, under one roof."
      intro="Software, manufacturing, hardware, research labs and Robocoders™ EdTech — every YugMinds division works under one roof, so an idea can go from design to product to classroom."
    >
      <Divisions />
      <Products />
      <Numbers />
      <CtaBand />
    </SubPage>
  );
}

export function YugmindsWorkPage() {
  return (
    <SubPage
      eyebrow="Our work"
      title="What we build, and who we build it with."
      intro="From hands-on robotics in classrooms to software and machines built for clients worldwide — a look at what the YugMinds team builds."
    >
      <Work />
      <Numbers />
      <CtaBand />
    </SubPage>
  );
}

export function YugmindsContactPage() {
  return (
    <SubPage
      eyebrow="Contact YugMinds"
      title="Tell us what you want built."
      intro="Reach the YugMinds team in Begumpet, Hyderabad for software projects, electronics and manufacturing work, partnerships, careers, or Robocoders™ programs."
    >
      <Details />
      <CtaBand />
    </SubPage>
  );
}
