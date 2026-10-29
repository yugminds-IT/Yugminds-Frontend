"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import {
  AppWindow,
  ArrowUp,
  Bot,
  Lightbulb,
  School,
  Sparkles,
  Pause,
  Play,
  CircuitBoard,
  Check,
  Factory,
  GraduationCap,
  MessagesSquare,
  ChevronRight,
  Cpu,
  Mail,
  MapPin,
  Menu,
  MonitorPlay,
  Phone,
  Shapes,
  X,
  type LucideIcon,
} from "lucide-react";
import { brandHref } from "@/lib/brand-host";
import { commonApi } from "@/lib/api/common.api";
import { BUSINESS, BUSINESS_ADDRESS_DISPLAY } from "@/lib/business-info";
import { displayFont } from "@/lib/fonts";

/*
  YugMinds — "one roof, one circuit".
  The company's claim is that one team takes an idea from research to a
  product to a classroom. The hero draws that as an electronics schematic:
  five division blocks joined by traces, named by five verbs. Everything
  else on the page stays quiet: white paper, slate ink, one blue.
*/

const LOGO_SRC = "/Yugminds_Official_Logo-preview.png";

/* The PNG's alpha is a clean silhouette, so a CSS mask paints it any single colour. */
function LogoMark({ tint, className = "" }: { tint: string; className?: string }) {
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

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ym-blue focus-visible:ring-offset-2";
const BTN_PRIMARY = `inline-flex items-center justify-center rounded-md bg-ym-blue px-5 py-3 font-semibold text-white transition-colors hover:bg-ym-blue-lit ${focusRing}`;

/* ─────────────────────────────────────────────
   DIVISIONS — in pipeline order: an idea starts in the labs and ends in a classroom.
───────────────────────────────────────────── */
type DivisionKey = "labs" | "hardware" | "software" | "manufacturing" | "robocoders";


/* ─────────────────────────────────────────────
   NAV
───────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Divisions", href: "/#divisions" },
  { label: "Products", href: "/#products" },
  { label: "About", href: "/#about" },
  { label: "Robocoders", href: brandHref("/robocoders") },
  { label: "Contact", href: "/#contact" },
];

// The page's named sections, in order. Each has a matching id and nav/footer link.
const SECTION_IDS = ["divisions", "products", "about", "build", "contact"];

/* On the home page, "/#section" links glide straight to the section without a
   router navigation (which fights the smooth scroll); elsewhere they load home. */
function jumpTo(e: React.MouseEvent, href: string) {
  if (!href.startsWith("/#") || window.location.pathname !== "/") return;
  const el = document.getElementById(href.slice(2));
  if (!el) return;
  e.preventDefault();
  const target = el.getBoundingClientRect().top + window.scrollY - 64; // below the fixed header
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Long trips (the showcase above is several screens tall) jump most of the
  // way at once, then glide the last stretch so the move still reads.
  const lead = window.innerHeight * 0.6;
  const glide = () => window.scrollTo({ top: target, behavior: reduced ? "instant" : "smooth" });
  if (!reduced && Math.abs(target - window.scrollY) > lead * 2) {
    window.scrollTo({ top: target + (target > window.scrollY ? -lead : lead), behavior: "instant" });
    requestAnimationFrame(glide); // same-frame smooth scrolls get dropped after an instant one
  } else glide();
  window.history.replaceState(null, "", href.slice(1));
}

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [section, setSection] = useState("");
  const barRef = useRef<HTMLSpanElement>(null);
  const linksRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // Compact once the page moves; a thin line shows how far down the page you are. Only reads
  // window.scrollY (never forces a layout) — the page height is cached and resynced on resize
  // only, not recomputed on every scroll tick.
  useEffect(() => {
    if (diagHas("noscroll")) return;
    let raf = 0;
    let max = document.documentElement.scrollHeight - window.innerHeight;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (barRef.current) barRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
        setScrolled(window.scrollY > 8);
      });
    };
    const onResize = () => {
      max = document.documentElement.scrollHeight - window.innerHeight;
      onScroll();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Which section is under the top third of the screen, for the nav and the address bar.
  // IntersectionObserver instead of a per-frame getBoundingClientRect loop over every section:
  // that loop forced a synchronous layout read on every scroll tick, site-wide, which is what
  // was reading as "shaking" during scroll on iOS and on slower laptops.
  useEffect(() => {
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) visible.add(en.target.id);
          else visible.delete(en.target.id);
        }
        let current = "";
        for (const id of SECTION_IDS) if (visible.has(id)) current = id;
        setSection(current);
        if (window.location.pathname === "/" && window.location.hash !== (current ? `#${current}` : "")) {
          window.history.replaceState(null, "", current ? `#${current}` : "/");
        }
      },
      { rootMargin: "0px 0px -67% 0px", threshold: 0 },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  // Close the mobile menu on Esc, and keep the page from scrolling behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // The hover pill slides to whichever link the pointer or focus is on.
  const pointAt = (el: HTMLElement) => {
    const nav = linksRef.current;
    if (!nav) return;
    const a = el.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    setPill({ left: a.left - n.left, width: a.width });
  };
  const isActive = (href: string) => href.startsWith("/#") && href.slice(2) === section;

  return (
    <header className={`fixed inset-x-0 top-0 border-b bg-white pt-[env(safe-area-inset-top)] transition-colors duration-300 ${open ? "z-[80]" : "z-[60]"} ${scrolled ? "border-slate-200" : "border-transparent"}`}>
      <div className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 transition-[height] duration-300 md:px-10 ${scrolled ? "h-14" : "h-16"}`}>
        <Link href="/" className={`group flex items-center gap-2.5 rounded ${focusRing}`}>
          <LogoMark tint="#2563EB" className="h-8 w-8 transition-transform duration-500 group-hover:rotate-[360deg]" />
          <span className="font-acdisplay text-xl font-bold tracking-tight text-ym-text">YugMinds</span>
        </Link>
        <nav ref={linksRef} className="relative hidden items-center lg:flex" aria-label="Main" onPointerLeave={() => setPill(null)}>
          <span
            aria-hidden
            className={`absolute inset-y-1 rounded-full bg-blue-50 transition-all duration-300 ease-out ${pill ? "opacity-100" : "opacity-0"}`}
            style={pill ? { left: pill.left, width: pill.width } : undefined}
          />
          {NAV_LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.label}
                href={l.href}
                onClick={(e) => jumpTo(e, l.href)}
                onPointerEnter={(e) => pointAt(e.currentTarget)}
                onFocus={(e) => pointAt(e.currentTarget)}
                onBlur={() => setPill(null)}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-3.5 py-2 text-[0.95rem] transition-colors ${active ? "font-semibold text-ym-blue" : "text-slate-600 hover:text-ym-text"} ${focusRing}`}
              >
                {l.label}
                {active && <span aria-hidden className="absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-ym-blue" />}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/#contact" onClick={(e) => jumpTo(e, "/#contact")} className={`${BTN_PRIMARY} group hidden gap-1.5 px-4 py-2.5 text-sm sm:inline-flex`}>
            Start a project
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className={`flex h-10 w-10 items-center justify-center rounded-md text-ym-text hover:bg-slate-100 lg:hidden ${focusRing}`}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {/* Reading progress. */}
      <span ref={barRef} aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 origin-left scale-x-0 bg-ym-blue" />

      {open && (
        <nav id="mobile-menu" className="ym-graph-blue fixed inset-x-0 bottom-0 top-[calc(3.5rem+env(safe-area-inset-top))] flex flex-col overflow-y-auto overscroll-contain px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 text-white lg:hidden" aria-label="Main">
          {NAV_LINKS.map((l, i) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={(e) => {
                setOpen(false);
                jumpTo(e, l.href);
              }}
              aria-current={isActive(l.href) ? "page" : undefined}
              className="ym-rise flex items-center justify-between py-3.5 font-acdisplay text-3xl font-bold aria-[current=page]:text-amber-300"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {l.label}
              <ChevronRight className="size-6 text-blue-200" aria-hidden />
            </Link>
          ))}
          <div className="mt-auto pt-8">
            <Link href="/#contact" onClick={(e) => { setOpen(false); jumpTo(e, "/#contact"); }} className="flex min-h-12 w-full items-center justify-center rounded-md bg-white font-semibold text-ym-text">
              Start a project
            </Link>
            <a href="tel:+918500345655" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-md bg-white/10 font-semibold">
              <Phone className="size-4" aria-hidden /> +91 85003 45655
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────
   HERO: "We build robots. / software. / circuits. / machines. / lessons."
   The second line cycles through what YugMinds' teams make. Behind the copy,
   the Robocoders car drives a test arena; the last line invites visitors to
   take the wheel.
───────────────────────────────────────────── */
// The car's stage fills the whole hero at every size: on phones and tablets it runs behind the
// headline too (the speed trails cross the copy), with the car framed in the space below it.
const HERO_STAGE = "absolute inset-x-0 bottom-0 top-0 lg:top-16";

/* True once the browser is idle after load (or after `timeout` ms at the latest). */
function useIdle(timeout = 1500) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setIdle(true), { timeout });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => setIdle(true), 300); // Safari has no requestIdleCallback
    return () => clearTimeout(t);
  }, [timeout]);
  return idle;
}

/* Temporary on-device bisect switchboard: /?diag=nohero,nopipe,nobot,noanim turns subsystems off so a
   real iPhone run shows which one causes the scroll shake. Remove once found. */
const diagHas = (n: string) => typeof window !== "undefined" && (new URLSearchParams(window.location.search).get("diag") ?? "").split(",").includes(n);

function useDiag() {
  const [flags, setFlags] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("diag");
    if (v) setFlags(new Set(v.split(",")));
  }, []);
  return flags;
}

const LeadBot = dynamic(() => import("./LeadBot").then((m) => m.LeadBot), { ssr: false });
const HeroRobot = dynamic(() => import("./HeroRobot").then((m) => m.HeroRobot), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

// One word per YugMinds team: the robot, the app, the electronics, the factory, the classroom.
const BUILD_WORDS = ["robots.", "software.", "circuits.", "machines.", "lessons."];

/* The headline's second line: cycles through what YugMinds builds. Holds on the first word for reduced motion. */
function BuildWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % BUILD_WORDS.length), 2200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <span key={i} className="ym-line block">
        {BUILD_WORDS[i]}
      </span>
    </span>
  );
}

const KEYCAPS = [
  { label: "W", codes: ["KeyW", "ArrowUp"], col: "col-start-2" },
  { label: "A", codes: ["KeyA", "ArrowLeft"], col: "col-start-1" },
  { label: "S", codes: ["KeyS", "ArrowDown"], col: "col-start-2" },
  { label: "D", codes: ["KeyD", "ArrowRight"], col: "col-start-3" },
];

/* W A S D key caps that light up while the matching key is held, so visitors see the car is theirs to drive. */
function DriveKeys() {
  const [down, setDown] = useState<string[]>([]);
  useEffect(() => {
    const on = (ev: KeyboardEvent) => setDown((d) => (d.includes(ev.code) ? d : [...d, ev.code]));
    const off = (ev: KeyboardEvent) => setDown((d) => d.filter((c) => c !== ev.code));
    const clear = () => setDown([]);
    window.addEventListener("keydown", on);
    window.addEventListener("keyup", off);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", on);
      window.removeEventListener("keyup", off);
      window.removeEventListener("blur", clear);
    };
  }, []);
  return (
    <div aria-hidden className="grid shrink-0 grid-cols-3 grid-rows-2 gap-1">
      {KEYCAPS.map((k) => {
        const lit = k.codes.some((c) => down.includes(c));
        return (
          <kbd
            key={k.label}
            className={`${k.col} grid size-9 place-items-center rounded-md border-b-[3px] font-acdisplay text-sm font-bold transition-all duration-100 ${
              lit ? "translate-y-0.5 border-ym-blue-lit bg-ym-blue text-white" : "border-slate-300 bg-white text-ym-text"
            }`}
          >
            {k.label}
          </kbd>
        );
      })}
    </div>
  );
}

/* The game invitation: key caps that light up, and one line on what to do. */
function DrivePrompt() {
  return (
    <div className="ym-rise flex items-center gap-4 bg-white py-3 pl-3 pr-5" style={{ animationDelay: "750ms" }}>
      <DriveKeys />
      <p className="max-w-[16rem] text-sm leading-snug text-slate-600">
        <span className="block font-acdisplay text-base font-bold text-ym-text">Take the wheel</span>
        Drive with W A S D. Click the floor to drop a block in its way.
      </p>
    </div>
  );
}

function Hero() {
  // The car starts once the page has a quiet moment, so the headline and buttons are usable first.
  const idle = useIdle();
  const diag = useDiag();
  const heroReady = idle && !diag.has("nohero");
  return (
    <section id="top" aria-labelledby="hero-title" className="relative flex flex-col bg-white pt-[calc(4rem+env(safe-area-inset-top))] lg:block">
      {/* The car's stage fills the whole hero on large screens; the copy sits over its left side. */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-7xl flex-col px-5 pt-6 md:px-10 lg:min-h-[calc(100svh-4rem)] lg:justify-start lg:pb-20 lg:pt-16">
        <div className="pointer-events-auto max-w-xl">
          <h1 id="hero-title" className="font-acdisplay text-[clamp(4.1rem,6.8vw,6.6rem)] font-bold leading-[0.92] tracking-[-0.035em] text-ym-text">
            {/* One heading, read once: "We build robots." on load, then the second word rotates for sighted visitors. */}
            <span className="block overflow-hidden pb-[0.06em]">
              <span className="ym-line block" style={{ animationDelay: "100ms" }}>We build</span>
            </span>{" "}
            <BuildWord />
          </h1>
          <p className="ym-rise mt-5 max-w-[44ch] text-sm leading-relaxed text-slate-700 sm:text-base md:text-lg lg:mt-6" style={{ animationDelay: "450ms" }}>
            YugMinds designs and makes technology end to end: custom software, websites and apps, electronics and machines for companies, and
            Robocoders robotics lessons for schools.
          </p>
          <div className="ym-rise mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 lg:mt-8 lg:gap-x-6" style={{ animationDelay: "550ms" }}>
            <Link href="/#contact" onClick={(e) => jumpTo(e, "/#contact")} className={`${BTN_PRIMARY} min-h-11 px-4 py-2.5 text-[15px] active:scale-[0.98] sm:min-h-12 sm:px-5 sm:py-3 sm:text-base`}>Start a project</Link>
            <a href="/#divisions" onClick={(e) => jumpTo(e, "/#divisions")} className={`text-[15px] font-semibold text-ym-text underline decoration-slate-300 decoration-2 underline-offset-4 transition-colors hover:decoration-ym-blue sm:text-base ${focusRing}`}>
              See what we make
            </a>
          </div>
        </div>
      </div>
      {/* Phones and tablets: room below the copy where the car drives (the stage behind frames it there). */}
      <div aria-hidden className="h-[min(100vw,500px)] sm:h-[min(72vw,600px)] lg:hidden" />
      {/* Phones and tablets drive themselves (no controls there); desktop with a mouse is drivable. */}
      <div className={HERO_STAGE}>
        {/* The car takes a moment to warm up (idle wait, then its geometry builds in idle-time
            steps). Show a quiet pulse where it'll appear instead of blank space; the 3D canvas
            paints fully opaque once ready, so it covers this without any coordination needed. */}
        <div aria-hidden className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="h-[38%] w-[62%] max-w-md animate-pulse rounded-2xl bg-slate-100" />
        </div>
        {heroReady && (
          <HeroRobot className="h-full w-full">
            <DrivePrompt />
          </HeroRobot>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   WHAT DO YOU NEED BUILT? The visitor picks a kind of project and sees which
   YugMinds companies build it, in the order they'd work, and what each does.
   Wording matches the hero's part tags.
───────────────────────────────────────────── */
const COMPANY_NAME: Record<DivisionKey, string> = {
  labs: "YugMinds Labs",
  hardware: "YugMinds Hardware",
  software: "YugMinds Software",
  manufacturing: "YugMinds Manufacturing",
  robocoders: "Robocoders™",
};

const PROJECTS: { id: string; label: string; cta: string; steps: { key: DivisionKey; role: string }[] }[] = [
  {
    id: "robot",
    label: "A robot or smart device",
    cta: "Start a robot project",
    steps: [
      { key: "labs", role: "Builds the first prototype and tests it until it works." },
      { key: "hardware", role: "Designs the electronics: circuit boards and the microcontroller." },
      { key: "software", role: "Writes the code that makes it sense, decide and move." },
      { key: "manufacturing", role: "Makes the body, chassis and parts, ready to ship." },
    ],
  },
  {
    id: "school",
    label: "A robotics lab for a school",
    cta: "Plan a school lab",
    steps: [
      { key: "robocoders", role: "Plans the lessons and trains your teachers." },
      { key: "hardware", role: "Chooses the kit: boards, sensors and motors." },
      { key: "manufacturing", role: "Builds a kit for every student." },
      { key: "software", role: "Sets up the coding app students program with." },
    ],
  },
  {
    id: "app",
    label: "Software, a website or an app",
    cta: "Start a software project",
    steps: [{ key: "software", role: "Builds your custom software, website or app to your requirements, then runs the IT behind it: hosting, support and updates." }],
  },
  {
    id: "idea",
    label: "An idea to test first",
    cta: "Test an idea with us",
    steps: [
      { key: "labs", role: "Builds a working prototype you can put in front of real users." },
      { key: "hardware", role: "Turns what worked into electronics that can be made." },
    ],
  },
  {
    id: "volume",
    label: "Parts made in volume",
    cta: "Get parts made",
    steps: [{ key: "manufacturing", role: "Takes your drawings to the factory floor and makes them at scale." }],
  },
];

/* Who builds the picked project, in order. `inline` is the phone accordion version. */
function TeamPanel({ picked, inline = false }: { picked: (typeof PROJECTS)[number]; inline?: boolean }) {
  const notNeeded = (Object.keys(COMPANY_NAME) as DivisionKey[]).filter((k) => !picked.steps.some((s) => s.key === k));
  return (
    <>
      {!inline && (
        <h3 className="font-acdisplay text-2xl font-bold leading-tight">Who builds {picked.label.charAt(0).toLowerCase() + picked.label.slice(1)}</h3>
      )}
      <ol key={picked.id} className={`flex flex-col ${inline ? "gap-4" : "mt-7 gap-6"}`}>
        {picked.steps.map((step, i) => (
          <motion.li
            key={step.key}
            className={`flex ${inline ? "gap-3" : "gap-4"}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={`grid shrink-0 place-items-center bg-ym-blue font-acdisplay font-bold text-white ${inline ? "size-7 text-sm" : "size-9 text-base"}`}>{i + 1}</span>
            <span>
              <span className={`block font-acdisplay font-bold leading-tight ${inline ? "text-base" : "text-lg"}`}>{COMPANY_NAME[step.key]}</span>
              <span className={`mt-0.5 block leading-relaxed text-slate-600 ${inline ? "text-[15px]" : ""}`}>{step.role}</span>
            </span>
          </motion.li>
        ))}
      </ol>
      {notNeeded.length > 0 && (
        <p className={`text-sm text-slate-500 ${inline ? "mt-4" : "mt-7"}`}>Not needed for this one: {notNeeded.map((k) => COMPANY_NAME[k]).join(", ")}.</p>
      )}
      <div className={`mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 ${inline ? "pt-5" : "pt-8"}`}>
        {/* Jumps to the brief form below, with this project already picked. */}
        <a
          href="/#contact"
          onClick={(e) => {
            window.dispatchEvent(new CustomEvent("ym:brief", { detail: picked.id }));
            jumpTo(e, "/#contact");
          }}
          className={`${BTN_PRIMARY} min-h-12 ${inline ? "w-full" : ""}`}
        >
          {picked.cta}
        </a>
        {!inline && (
          <Link href="/#divisions" onClick={(e) => jumpTo(e, "/#divisions")} className={`font-semibold text-ym-text underline decoration-slate-300 decoration-2 underline-offset-4 transition-colors hover:decoration-ym-blue ${focusRing}`}>
            See what each company does
          </Link>
        )}
      </div>
    </>
  );
}

function ProjectPicker() {
  const [project, setProject] = useState(PROJECTS[0].id);
  const picked = PROJECTS.find((p) => p.id === project) ?? PROJECTS[0];
  // Auto tour: steps through the projects while the section is on screen, so visitors
  // see the list changes the panel. Stops for good once they hover, focus or pick.
  const TOUR_MS = 4500;
  const sectionRef = useRef<HTMLElement>(null);
  const [touring, setTouring] = useState(true);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    // Reduced motion: never mark it in view, so the tour never starts.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = sectionRef.current;
    if (!el) return;
    // "In view" = the section crosses the middle of the screen (works for the tall phone layout too).
    const io = new IntersectionObserver(([en]) => setInView(en.isIntersecting), { rootMargin: "-35% 0px -35% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Never switch while the visitor is scrolling: on phones the open row changes height, and
  // moving content under a moving thumb loses their place. Wait for the page to settle.
  const lastScroll = useRef(0);
  useEffect(() => {
    const onScroll = () => (lastScroll.current = performance.now());
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!touring || !inView) return;
    let t = 0;
    const advance = () => {
      if (performance.now() - lastScroll.current < 1200) {
        t = window.setTimeout(advance, 400);
        return;
      }
      const i = PROJECTS.findIndex((p) => p.id === project);
      setProject(PROJECTS[(i + 1) % PROJECTS.length].id);
    };
    t = window.setTimeout(advance, TOUR_MS);
    return () => window.clearTimeout(t);
  }, [touring, inView, project]);
  // Using the list pauses the tour; it picks up again 15 s after the last
  // pointer move, click or key press on it. (Not on pointer-leave: scrolling
  // with the mouse resting on the list never fires it.)
  const lastInput = useRef(0);
  // Event timestamps share performance.now()'s clock.
  const stopTour = (e: { timeStamp: number }) => {
    lastInput.current = e.timeStamp;
    setTouring(false);
  };
  useEffect(() => {
    if (touring || !inView) return;
    const id = window.setInterval(() => {
      if (performance.now() - lastInput.current > 15000) setTouring(true);
    }, 500);
    return () => window.clearInterval(id);
  }, [touring, inView]);
  // Phones: when an open row above closes, the tapped row would jump up; scroll it back to where the finger was.
  const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const shift = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: "instant" });
  }, [project]);

  return (
    <section ref={sectionRef} id="build" aria-labelledby="picker-title" className="ym-graph-blue scroll-mt-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:px-10 md:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        {/* The question and the choices. */}
        <div>
          <h2 id="picker-title" className="font-acdisplay text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.02]">
            What do you need built?
          </h2>
          <p className="mt-3 max-w-[44ch] text-pretty text-base leading-relaxed text-blue-100 sm:mt-4 sm:text-lg">
            Pick one. You&apos;ll see which of our companies build it, in the order they work, and what each one does for you.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:mt-8" role="group" aria-label="Kind of project" onPointerMove={stopTour} onPointerDown={stopTour} onKeyDown={stopTour} onFocus={stopTour}>
            {PROJECTS.map((p) => {
              const on = p.id === project;
              return (
                <div key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-expanded={on}
                  onClick={(e) => {
                    stopTour(e);
                    anchor.current = { el: e.currentTarget, top: e.currentTarget.getBoundingClientRect().top };
                    setProject(p.id);
                  }}
                  className={`group relative flex min-h-14 w-full items-center justify-between gap-4 overflow-hidden px-4 text-left text-base font-semibold sm:px-5 sm:text-lg transition-colors duration-150 ${focusRing} focus-visible:ring-offset-[#1e3a8a] ${
                    on ? "bg-white text-ym-text" : "bg-[#172f74] text-white hover:bg-[#1b3786]"
                  }`}
                >
                  {p.label}
                  {/* Desktop: points at the panel on the right. Phones: turns down as the row opens. */}
                  <ChevronRight
                    aria-hidden
                    className={`size-5 shrink-0 transition-transform duration-200 group-hover:lg:translate-x-1 ${on ? "text-ym-blue max-lg:rotate-90" : "text-white/70"}`}
                  />
                  {on && touring && inView && (
                    <span
                      key={p.id}
                      aria-hidden
                      className="ym-progress absolute inset-x-0 bottom-0 h-1 bg-ym-blue"
                      style={{ ["--ym-tour" as string]: `${TOUR_MS}ms` }}
                    />
                  )}
                </button>
                {/* Phones and tablets: the team slides open right under its row. */}
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none lg:hidden ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  inert={!on}
                >
                  <div className="overflow-hidden">
                    <div className="flex flex-col bg-white px-4 pb-5 pt-4 text-ym-text">
                      <TeamPanel picked={p} inline />
                    </div>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
          <p className={`mt-4 text-sm text-blue-100 transition-opacity duration-300 ${touring && inView ? "opacity-100" : "opacity-0"}`} aria-hidden={!(touring && inView)}>
            Showing each project in turn. Pick one to stay on it.
          </p>
        </div>

        {/* Who builds it, in order (desktop: beside the list). */}
        <div className="hidden flex-col bg-white p-6 text-ym-text md:p-9 lg:flex" aria-live="polite">
          <TeamPanel picked={picked} />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SECTIONS
───────────────────────────────────────────── */
function SectionHead({ title, intro, id }: { title: string; intro?: string; id?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="font-acdisplay text-3xl font-bold leading-tight tracking-tight text-ym-text md:text-[2.75rem]">
        {title}
      </h2>
      {intro && <p className="mt-3 text-pretty text-base leading-relaxed text-slate-600 sm:mt-4 sm:text-lg">{intro}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ABOUT: why build with YugMinds. Not a list of the companies (the next
   section does that), but what making every part in-house means for you.
───────────────────────────────────────────── */
const ABOUT_POINTS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MessagesSquare,
    title: "One brief covers every part",
    text: "Explain it once. Labs, Hardware, Software and Manufacturing hand it on across one roof, not across four contracts.",
  },
  {
    icon: Factory,
    title: "No starting over for production",
    text: "The people who build your prototype also make it at scale, so nothing gets redesigned for a new supplier.",
  },
  {
    icon: GraduationCap,
    title: "Tested by students every week",
    text: "Robocoders puts our robots in real classrooms, so what we build has to survive real hands.",
  },
];

// One photo per company, so the section shows all five.
const ABOUT_PHOTOS = [
  { src: "/images/landing/factory-engineer.jpg", alt: "An engineer on a manufacturing floor", name: "Manufacturing", role: "Bodies, chassis and parts", cls: "col-start-1 row-span-2 row-start-1" },
  { src: "/images/landing/circuit-board.jpg", alt: "A close-up of a circuit board", name: "Hardware", role: "Electronics and circuit boards", cls: "col-start-2 row-start-1" },
  { src: "/images/landing/software-code.jpg", alt: "Code on a screen", name: "Software", role: "Custom software, websites, apps and IT", cls: "col-start-2 row-start-2" },
  { src: "/images/landing/dev-team.jpg", alt: "A team testing a prototype together", name: "Labs", role: "Prototypes, built and tested", cls: "col-start-1 row-start-3" },
  { src: "/child-making-robot.jpg", alt: "A student building a robot in a Robocoders class", name: "Robocoders", role: "Teaches kids to build robots", cls: "col-start-2 row-start-3" },
];

/* A number that counts up from zero once `run` turns true. */
function CountUp({ to, suffix = "", run }: { to: number; suffix?: string; run: boolean }) {
  const [n, setN] = useState(to);
  useEffect(() => {
    if (!run) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1200);
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return (
    <>
      {n}
      {suffix}
    </>
  );
}

function About() {
  // One reveal when the section scrolls in: the photos wipe open in turn and the
  // numbers count up. Without JS, or with reduced motion, everything is simply shown.
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.anim = "ready";
    const io = new IntersectionObserver(
      ([en]) => {
        if (!en.isIntersecting) return;
        el.dataset.anim = "in";
        setSeen(true);
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id="about" aria-labelledby="about-title" className="ym-about scroll-mt-16 border-t border-slate-200">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
        <div>
          <SectionHead
            id="about-title"
            title="Where an idea becomes a working thing."
            intro="YugMinds started in Hyderabad in 2024 with one rule: make every part ourselves. The prototype you approve is built by the people who design its boards, write its code and manufacture it."
          />
          <ul className="mt-10 flex flex-col gap-7">
            {ABOUT_POINTS.map((p, i) => (
              <li key={p.title} className="ym-about-point flex gap-4" style={{ ["--d" as string]: `${300 + i * 120}ms` }}>
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-blue-50 text-ym-blue">
                  <p.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-acdisplay text-xl font-semibold text-ym-text">{p.title}</span>
                  <span className="mt-1 block max-w-[52ch] leading-relaxed text-slate-600">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t-2 border-slate-100 pt-8">
            {[
              { to: 20, suffix: "+", label: "projects delivered" },
              { to: 10, suffix: "+", label: "clients" },
              { to: 5, suffix: "", label: "companies under one roof" },
            ].map((st) => (
              <div key={st.label} className="flex flex-col-reverse justify-end">
                <dt className="mt-1 text-sm leading-snug text-slate-600">{st.label}</dt>
                <dd className="font-acdisplay text-4xl font-bold tabular-nums tracking-tight text-ym-text md:text-5xl">
                  <CountUp to={st.to} suffix={st.suffix} run={seen} />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* All five companies, at work. */}
        <div className="grid h-[min(130vw,620px)] grid-cols-2 grid-rows-3 gap-3 lg:h-[640px]">
          {ABOUT_PHOTOS.map((ph, i) => (
            <figure
              key={ph.src}
              className={`ym-about-tile group relative overflow-hidden rounded-lg bg-slate-100 ${ph.cls}`}
              style={{ ["--d" as string]: `${i * 110}ms` }}
            >
              <Image src={ph.src} alt={ph.alt} fill sizes="(min-width: 1024px) 26vw, 50vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
              <figcaption className="absolute bottom-3 left-3 bg-white px-2.5 py-1.5 leading-tight text-ym-text">
                <span className="block text-sm font-bold">{ph.name}</span>
                <span className="block text-xs text-slate-600">{ph.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   DIVISIONS: the main showcase. The section pins while you scroll, and the
   RoboCoders car is built one company at a time in 3D beside a step rail.
───────────────────────────────────────────── */
const PipelineScene = dynamic(() => import("./PipelineScene").then((m) => m.PipelineScene), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

const STAGES: { key: DivisionKey; verb: string; unit: string; desc: string; see: string; href?: string }[] = [
  { key: "labs", verb: "Research", unit: "YugMinds Labs", desc: "Every product starts here. We sketch it, build a prototype and test it until the idea works.", see: "The blueprint is drawn." },
  { key: "hardware", verb: "Design", unit: "YugMinds Hardware", desc: "We design the electronics: custom circuit boards (PCBs), the microcontroller, and the motors and sensors wired to it.", see: "Chassis, motors, board and sensor go in." },
  { key: "software", verb: "Build", unit: "YugMinds Software", desc: "We write the code it runs, so it can sense, decide and drive. For clients, the same team builds custom software, websites and apps to their requirements, with complete IT services.", see: "The program loads and the sensor wakes up." },
  { key: "manufacturing", verb: "Make", unit: "YugMinds Manufacturing", desc: "We 3D print, machine and assemble the body, chassis and parts, then make them in volume.", see: "Wheels on. The shell prints layer by layer." },
  { key: "robocoders", verb: "Teach", unit: "Robocoders™", desc: "Then we teach kids to build and code the same robot, in their own classroom.", see: "On the line track, with its lesson card.", href: brandHref("/robocoders") },
];

function Divisions() {
  const diag = useDiag();
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [active, setActive] = useState(0); // which step's text shows; only changes 5 times total
  // The 3D build scene (its own WebGL canvas) mounts only once the section is a screen away, and stays.
  const [buildNear, setBuildNear] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || buildNear) return;
    const io = new IntersectionObserver(([en]) => en.isIntersecting && setBuildNear(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [buildNear]);

  useEffect(() => {
    if (diagHas("noscroll")) return;
    let raf = 0;
    // Mobile browsers resize the window as their toolbar hides/shows while you scroll, but the
    // section's CSS height is set in `svh` (stable). Measuring against the live window.innerHeight
    // instead would make `total`/`prog` jitter every scroll frame — read as the whole section
    // shaking. So we only resync this to a real device resize (width change), not a scroll-driven
    // toolbar collapse.
    let vh = window.innerHeight;
    let vw = window.innerWidth;
    // The section's document-relative top and height, cached and only resynced on resize — not
    // read every scroll frame. getBoundingClientRect() forces a synchronous layout; calling it on
    // every scroll tick (even just once, for this one element) is exactly what a motion-performance
    // audit flags as a "never" pattern for scroll-linked animation. window.scrollY, by contrast,
    // costs nothing: it's already known to the compositor.
    let elTop = 0;
    let height = 0;
    const remeasure = () => {
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      elTop = r.top + window.scrollY;
      height = r.height;
    };
    // The per-frame progress (camera position, rail fill) is written straight to refs/DOM, not
    // React state — a setState here would re-render the whole step list up to 60x/sec during
    // scroll, which on top of the WebGL canvas's own compositing is what was reading as "shaking"
    // on slower laptops and phones. React only re-renders when the active step actually changes.
    let lastActive = -1;
    const measure = () => {
      raf = 0;
      const total = height - vh;
      const p = total > 0 ? Math.max(0, Math.min(1, (window.scrollY - elTop) / total)) * 5 : 0;
      progressRef.current = p;
      const nextActive = Math.min(4, Math.floor(p));
      for (let i = 0; i < fillRefs.current.length; i++) {
        const local = i === nextActive ? Math.max(0, Math.min(1, p - i)) : i < nextActive ? 1 : 0;
        fillRefs.current[i]?.style.setProperty("transform", `scaleX(${local})`);
      }
      if (nextActive !== lastActive) {
        lastActive = nextActive;
        setActive(nextActive);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    const onResize = () => {
      if (window.innerWidth !== vw) {
        vw = window.innerWidth;
        vh = window.innerHeight;
      }
      remeasure();
      onScroll();
    };
    remeasure();
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const goTo = (i: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const total = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((i + 0.6) / 5) * total, behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} id="divisions" aria-labelledby="divisions-title" className="relative bg-slate-50" style={{ height: "calc(100svh + 420svh)" }}>
      {/* [transform:translateZ(0)] forces Safari to give this sticky element its own stable
          compositing layer. Without it, WebKit recomposites the sticky box (and the WebGL canvas
          inside it) against scroll every frame instead of just translating it — the cause of the
          shake reported on iOS; Chromium doesn't have this bug, so it never showed up there. */}
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden [backface-visibility:hidden] [transform:translateZ(0)]">
        <div className="mx-auto grid h-full max-w-7xl grid-rows-[minmax(0,1fr)_auto] px-5 md:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:grid-rows-1 lg:gap-10">
          {/* The build, in 3D. */}
          {buildNear && !diag.has("nopipe") ? (
            <PipelineScene progress={progressRef} className="order-1 h-full min-h-0 w-full lg:order-2" />
          ) : (
            <div className="order-1 h-full min-h-0 w-full lg:order-2" aria-hidden />
          )}

          {/* The steps. */}
          <div className="order-2 flex flex-col justify-center pb-6 lg:order-1 lg:py-10">
            <h2 id="divisions-title" className="font-acdisplay text-[clamp(1.75rem,3.2vw,2.75rem)] font-bold leading-tight tracking-tight text-ym-text">
              Watch an idea become a robot.
            </h2>
            <p className="mt-3 max-w-[44ch] text-slate-600 max-lg:hidden [@media(max-height:780px)]:hidden">
              Labs, Hardware, Software, Manufacturing and Robocoders each add their part to the car from the top of the page. Scroll to watch it come together.
            </p>
            {/* Fixed layout, so nothing moves while scrolling. The step rows never open or close (phones
                show only the current row, all five sharing one cell). The current step's details sit in
                one panel below; it holds all five (the rest invisible, not removed), so it is always
                as tall as the longest and never resizes as the steps change. */}
            <ol className="mt-6 grid lg:mt-5 lg:gap-1">
              {STAGES.map((st, i) => {
                const on = i === active;
                const done = i < active;
                return (
                  <li key={st.key} id={st.key} className={`scroll-mt-24 max-lg:col-start-1 max-lg:row-start-1 ${on ? "" : "max-lg:invisible"}`}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={on ? "step" : undefined}
                      className={`relative flex w-full items-center gap-4 overflow-hidden px-4 py-3 text-left transition-colors duration-200 lg:py-2 ${focusRing} ${
                        on ? "bg-white" : "hover:bg-white/70"
                      }`}
                    >
                      <span
                        className={`grid size-9 shrink-0 place-items-center font-acdisplay text-base font-bold transition-colors duration-200 ${
                          on || done ? "bg-ym-blue text-white" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={`block font-acdisplay text-2xl font-bold leading-none tracking-tight lg:text-xl ${on ? "text-ym-text" : "text-slate-500"}`}>{st.verb}</span>
                        <span className={`mt-1 block text-sm font-semibold ${on ? "text-ym-blue" : "text-slate-500"}`}>{st.unit}</span>
                      </span>
                      {/* How far this step has got. Updated straight on the DOM from the scroll loop (see measure()), not via React state. */}
                      <span
                        aria-hidden
                        ref={(el) => {
                          fillRefs.current[i] = el;
                        }}
                        className="absolute inset-x-0 bottom-0 h-1 origin-left bg-ym-blue"
                        style={{ transform: `scaleX(${done ? 1 : 0})` }}
                      />
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-1.5 grid border-l-4 border-ym-blue bg-white" aria-live="polite">
              {STAGES.map((st, i) => {
                const on = i === active;
                return (
                  <div key={st.key} className={`col-start-1 row-start-1 px-4 py-4 transition-opacity duration-300 lg:py-3 lg:pl-[3.75rem] ${on ? "opacity-100" : "invisible opacity-0"}`} aria-hidden={!on}>
                    <p className="leading-relaxed text-slate-700">{st.desc}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-500">{st.see}</p>
                    {st.href && (
                      <Link href={st.href} tabIndex={on ? undefined : -1} className={`mt-3 inline-block font-semibold text-ym-blue underline decoration-blue-200 decoration-2 underline-offset-4 hover:decoration-ym-blue ${focusRing}`}>
                        Visit Robocoders
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Phones show one step at a time; these dots show where you are. */}
            <div className="mt-3 flex gap-1.5 lg:hidden" aria-hidden>
              {STAGES.map((st, i) => (
                <span key={st.key} className={`h-1.5 flex-1 ${i <= active ? "bg-ym-blue" : "bg-slate-200"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PRODUCTS: a showroom. One tab per product, in the order students use them
   (code it, test the circuit, build it; and the Play Kit for younger kids),
   each with a small hands-on demo.
───────────────────────────────────────────── */
const demo = (name: "StudioDemo" | "SimulatorDemo" | "KitDemo" | "PlayKitDemo") =>
  dynamic(() => import("./ProductDemos").then((m) => m[name]), { ssr: false, loading: () => <div className="min-h-[360px] bg-[#0b1a45]" /> });
const DEMOS = { studio: demo("StudioDemo"), simulator: demo("SimulatorDemo"), kit: demo("KitDemo"), play: demo("PlayKitDemo") };

const PRODUCTS: {
  id: keyof typeof DEMOS;
  icon: LucideIcon;
  step: string;
  title: string;
  isNew?: boolean;
  desc: string;
  points: string[];
  cta: string;
  href: string;
  tryIt: string;
}[] = [
  {
    id: "studio",
    icon: MonitorPlay,
    step: "Code it",
    title: "RoboCoders Studio",
    desc: "Offline desktop software for block coding, Python, AI experiments and robot control, all in one app.",
    points: ["Blocks for beginners, Python when they're ready", "Works offline on laptops, desktops and Chromebooks", "Sends code straight to the ESP32 kit"],
    cta: "See Studio",
    href: "https://rcstudio.yugminds.org",
    tryIt: "Try it: add blocks from the palette, press the green flag, then connect the board and upload.",
  },
  {
    id: "simulator",
    icon: CircuitBoard,
    step: "Test the circuit",
    title: "RoboCoders Simulator",
    isNew: true,
    desc: "Wire circuits on a virtual ESP32 and breadboard, and test them before you build. Like Tinkercad, made for our board.",
    points: ["LEDs, buttons, sensors, resistors and motors to wire up", "Live current and pin readings, so mistakes show before a part burns", "Same pins as the real board, so the circuit works on the kit"],
    cta: "Get early access",
    href: "#contact",
    tryIt: "Try it: pick a program, start the simulation and use the parts. Then untick the resistor and see what happens.",
  },
  {
    id: "kit",
    icon: Cpu,
    step: "Build it",
    title: "ESP32 Robotics Kit",
    desc: "Our own ESP32 board with a built-in motor driver, and 15 plug-in modules. Every module clicks into a labelled port: no breadboard, no loose wires.",
    points: ["Plug-and-play ports, labelled with their pins", "Sensors for distance, lines, light, sound, touch, rain, soil and temperature", "40+ guided projects in block and C coding"],
    cta: "See the kit",
    href: brandHref("/robocoders/products#robotics-kit"),
    tryIt: "Try it: pick a project, plug in the two modules it needs, then press Run and play with the sensor.",
  },
  {
    id: "play",
    icon: Shapes,
    step: "Play, no screen",
    title: "RoboCoders Play Kit",
    desc: "Screen-free coding for young children: place a direction card on the robot and it follows the command.",
    points: ["No screen and no typing", "Forward, left, right and U-turn cards", "Builds sequencing and logic early"],
    cta: "See the Play Kit",
    href: brandHref("/robocoders/products"),
    tryIt: "Try it: lay out cards to get the robot to the star, then press Run.",
  },
];

function Products() {
  // A guided tour of the products while the section is on screen.
  // "on": touring. "hold": the visitor is exploring; it picks up again after
  // IDLE_MS with no input. "off": they pressed Pause, so it waits for Play.
  const TOUR_MS = 5000;
  const IDLE_MS = 15000;
  const [tab, setTab] = useState<keyof typeof DEMOS>(PRODUCTS[0].id); // the tour starts at Studio
  const [mode, setMode] = useState<"on" | "hold" | "off">("on");
  const [resumeIn, setResumeIn] = useState(0);
  const lastInput = useRef(0);
  const touring = mode === "on";
  const hold = () => {
    lastInput.current = performance.now();
    setMode((m) => (m === "off" ? "off" : "hold"));
  };
  // Any input inside the section keeps it on hold.
  const nudge = () => {
    lastInput.current = performance.now();
  };
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Reduced motion: never mark it in view, so the tour never starts.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = sectionRef.current;
    if (!el) return;
    // "In view" = the section crosses the middle of the screen. (A ratio threshold never fires
    // on phones, where the section is several screens tall.) Touching a demo still holds the tour.
    const io = new IntersectionObserver(([en]) => setInView(en.isIntersecting), { rootMargin: "-40% 0px -40% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Each time the section comes into view with the tour running, it starts again at Studio.
  useEffect(() => {
    if (inView && mode === "on") setTab(PRODUCTS[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);
  useEffect(() => {
    if (!touring || !inView) return;
    const t = window.setTimeout(() => {
      const i = PRODUCTS.findIndex((x) => x.id === tab);
      setTab(PRODUCTS[(i + 1) % PRODUCTS.length].id);
    }, TOUR_MS);
    return () => window.clearTimeout(t);
  }, [touring, inView, tab]);
  useEffect(() => {
    if (mode !== "hold" || !inView) return;
    const id = window.setInterval(() => {
      const left = IDLE_MS - (performance.now() - lastInput.current);
      if (left <= 0) setMode("on");
      else setResumeIn(Math.ceil(left / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [mode, inView]);
  const playing = touring && inView;
  // Keep the chosen product fully visible in the swipeable strip (scrolls the strip only, never the page).
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    const btn = strip?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (!strip || !btn || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: btn.offsetLeft - (strip.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
  }, [tab]);
  // The stage keeps the height of the tallest product it has shown, so the page below never jumps
  // as the tour moves on (the demos differ in height, by up to ~500px on phones). Starts over only
  // when the width changes (rotation); the phone's address bar showing or hiding doesn't count.
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let tallest = 0;
    let width = window.innerWidth;
    const ro = new ResizeObserver(() => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        tallest = 0;
        el.style.minHeight = "";
      }
      const h = el.offsetHeight;
      if (h > tallest) {
        tallest = h;
        el.style.minHeight = `${h}px`;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const p = PRODUCTS.find((x) => x.id === tab) ?? PRODUCTS[0];
  const Demo = DEMOS[p.id];

  return (
    <section
      ref={sectionRef}
      id="products"
      aria-labelledby="products-title"
      className="ym-graph-blue scroll-mt-16 text-white"
      onPointerMove={nudge}
      onPointerDown={nudge}
      onKeyDown={nudge}
      onWheel={nudge}
    >
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div className="max-w-2xl">
            <h2 id="products-title" className="font-acdisplay text-3xl font-bold leading-tight tracking-tight md:text-[2.75rem]">
              Made in-house.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-blue-100 sm:mt-4 sm:text-lg">
              Robotics kits, a circuit simulator and coding software, made by us and used in our classrooms. Each one works right here: try it.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {mode === "hold" && inView && resumeIn > 0 && (
              <p className="text-sm text-blue-200" aria-live="off">
                Tour resumes in {resumeIn} s
              </p>
            )}
            <button
              type="button"
              onClick={() => setMode((m) => (m === "on" ? "off" : "on"))}
              aria-pressed={!touring}
              className={`inline-flex min-h-11 items-center gap-2 bg-[#172f74] px-4 text-sm font-semibold transition-colors hover:bg-[#1b3786] ${focusRing} focus-visible:ring-offset-[#1e3a8a]`}
            >
              {touring ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {touring ? "Pause tour" : mode === "hold" ? "Resume tour" : "Play tour"}
            </button>
          </div>
        </div>

        {/* Every product, always in view. Phones and tablets: a swipeable strip that sticks under
            the header while you scroll the panel. Desktop: four tiles in a row. */}
        <div
          ref={stripRef}
          className="ym-strip sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-5 mt-8 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain bg-[#1e3a8a] px-5 py-2 md:-mx-10 md:px-10 lg:static lg:mx-0 lg:mt-10 lg:grid lg:grid-cols-4 lg:overflow-visible lg:bg-transparent lg:px-0 lg:py-0"
          role="group"
          aria-label="Choose a product"
        >
          {PRODUCTS.map((x) => {
            const on = x.id === tab;
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={on}
                data-tab={x.id}
                onClick={() => {
                  hold();
                  setTab(x.id);
                }}
                className={`group relative flex w-[68%] shrink-0 snap-start items-center gap-3 overflow-hidden p-3 text-left sm:w-[42%] sm:p-4 lg:w-auto transition-colors duration-150 ${focusRing} focus-visible:ring-offset-[#1e3a8a] ${
                  on ? "bg-white text-ym-text" : "bg-[#172f74] text-white hover:bg-[#1b3786]"
                }`}
              >
                <span className={`hidden size-10 shrink-0 place-items-center sm:grid ${on ? "bg-ym-blue text-white" : "bg-white/10"}`}>
                  <x.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${on ? "text-ym-blue" : "text-blue-200"}`}>
                    {x.step}
                    {x.isNew && <span className="bg-amber-400 px-1.5 py-px text-[10px] font-bold text-ym-text sm:hidden">New</span>}
                  </span>
                  <span className="block font-acdisplay text-[15px] font-bold leading-tight sm:text-base md:text-lg">{x.title}</span>
                </span>
                {x.isNew && <span className="absolute right-2 top-2 hidden bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-ym-text sm:block">New</span>}
                {on && playing && (
                  <span
                    key={`bar-${x.id}`}
                    aria-hidden
                    className="ym-progress absolute inset-x-0 bottom-0 h-1 bg-ym-blue"
                    style={{ ["--ym-tour" as string]: `${TOUR_MS}ms` }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* The stage: the chosen product and its demo. Using the demo stops the tour. */}
        <div
          ref={stageRef}
          className="mt-2 grid content-start gap-5 bg-[#172f74] p-3 sm:gap-8 sm:p-5 md:p-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-10"
          onPointerDown={hold}
          onFocusCapture={hold}
        >
          <div key={`info-${p.id}`} className="ym-rise flex flex-col px-2 pb-2 sm:px-0 sm:pb-0">
            <p className="text-sm font-semibold text-blue-200 max-lg:hidden">{p.step}</p>
            <h3 className="font-acdisplay text-2xl font-bold leading-tight lg:mt-2 lg:text-3xl">{p.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-blue-100 sm:mt-3 sm:text-lg">{p.desc}</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-[15px] sm:mt-6 sm:gap-3 sm:text-base">
              {p.points.map((pt) => (
                <li key={pt} className="flex gap-3 leading-snug">
                  <Check className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden />
                  {pt}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-blue-200 max-lg:hidden">{p.tryIt}</p>
            <div className="mt-auto pt-5 sm:pt-6">
              <Link
                href={p.href}
                {...(p.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`inline-flex min-h-12 items-center bg-white px-5 font-semibold text-ym-text transition-colors hover:bg-blue-50 ${focusRing} focus-visible:ring-offset-[#172f74]`}
              >
                {p.cta}
                {p.href.startsWith("http") && <span className="sr-only"> (opens in a new tab)</span>}
              </Link>
            </div>
          </div>
          {/* Phones and tablets: the thing to try comes first, its details underneath. */}
          <div key={`demo-${p.id}`} className="ym-rise max-lg:order-first">
            <p className="mb-2 px-1 text-sm text-blue-200 lg:hidden">{p.tryIt}</p>
            <Demo />
          </div>
        </div>
      </div>
    </section>
  );
}

const CONTACT: { icon: LucideIcon; label: string; value: string; href?: string }[] = [
  { icon: Mail, label: "Email", value: BUSINESS.email, href: `mailto:${BUSINESS.email}` },
  { icon: Phone, label: "Phone", value: BUSINESS.phoneDisplay, href: `tel:${BUSINESS.phone.replace(/-/g, "")}` },
  { icon: MapPin, label: "Studio", value: BUSINESS_ADDRESS_DISPLAY },
];
const NEXT_STEPS = [
  "We read your brief and reply by email or phone.",
  "A short call to understand what you need and what it's for.",
  "A plan: which of our companies builds it, a timeline and a cost.",
];
const BRIEF_PROJECTS: { id: string; label: string; icon: LucideIcon; hint: string }[] = [
  { id: "robot", label: "A robot or smart device", icon: Bot, hint: "Prototype to product" },
  { id: "school", label: "A robotics lab for a school", icon: School, hint: "Kits, lessons, training" },
  { id: "app", label: "Software, a website or an app", icon: AppWindow, hint: "Built to your requirements" },
  { id: "idea", label: "An idea to test first", icon: Lightbulb, hint: "Prove it before you build" },
  { id: "volume", label: "Parts made in volume", icon: Factory, hint: "From your drawings" },
  { id: "other", label: "Something else", icon: Sparkles, hint: "Tell us and we'll see" },
];
const BUDGETS = ["Under ₹1 lakh", "₹1 to 5 lakh", "₹5 to 20 lakh", "Over ₹20 lakh", "Not sure yet"];
const TIMELINES = ["Within a month", "1 to 3 months", "3 to 6 months", "Just exploring"];
const IDEA_STARTERS = ["It should…", "It's for…", "We already have…", "The hard part is…"];
const BRIEF_STEPS = ["What", "Details", "Budget", "You"] as const;

type Brief = { project: string; budget: string; timeline: string; details: string; firstName: string; lastName: string; email: string; phone: string; org: string };
const EMPTY_BRIEF: Brief = { project: "", budget: "", timeline: "", details: "", firstName: "", lastName: "", email: "", phone: "", org: "" };

/* What each step needs before moving on. */
function checkStep(step: number, b: Brief) {
  const e: Partial<Record<keyof Brief, string>> = {};
  if (step === 0 && !b.project) e.project = "Pick what you need built.";
  if (step === 1 && b.details.trim().length < 20) e.details = "Tell us a little more: at least a sentence or two.";
  if (step === 3) {
    if (!b.firstName.trim()) e.firstName = "Enter your first name.";
    if (!b.lastName.trim()) e.lastName = "Enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) e.email = "Enter an email we can reply to, like name@company.com.";
    if (b.phone && !/^[0-9 +()-]{7,20}$/.test(b.phone.trim())) e.phone = "Use digits only, like 98765 43210.";
  }
  return e;
}

const FIELD = "mt-1.5 block w-full rounded-lg border-2 border-slate-200 bg-white px-3.5 py-3 text-ym-text outline-none transition-colors placeholder:text-slate-400 focus:border-ym-blue aria-[invalid=true]:border-red-500";

/* Pill choices used for budget and timeline. */
function Pills({ label, name, options, value, onChange }: { label: string; name: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="font-acdisplay text-lg font-bold text-ym-text">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className="cursor-pointer">
            <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} className="peer sr-only" />
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-all hover:border-ym-blue peer-checked:border-ym-blue peer-checked:bg-ym-blue peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ym-blue peer-focus-visible:ring-offset-2">
              {o}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* One line of the live brief: dashed until it's filled in. */
function BriefRow({ k, v, wide = false }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs font-semibold text-blue-200">{k}</dt>
      {v ? (
        <dd className="ym-rise mt-0.5 font-semibold leading-snug text-white">
          {v}
        </dd>
      ) : (
        <dd className="mt-2 h-2.5 w-3/4 rounded-full border border-dashed border-white/30" aria-label="Not filled in yet" />
      )}
    </div>
  );
}

function briefPct(b: Brief) {
  const filled = [b.project, b.details.trim().length >= 20 ? "y" : "", b.budget, b.timeline, b.firstName && b.email ? "y" : ""].filter(Boolean).length;
  return Math.round((filled / 5) * 100);
}

/* Phones: the live brief shrinks to one line inside the form, where it stays in view. */
function BriefStrip({ b }: { b: Brief }) {
  const proj = BRIEF_PROJECTS.find((p) => p.id === b.project);
  const team = PROJECTS.find((p) => p.id === b.project)?.steps ?? [];
  const pct = briefPct(b);
  if (!proj) return null;
  return (
    <div className="ym-graph-blue ym-rise mt-5 flex items-center gap-3 rounded-xl p-3 text-white lg:hidden" aria-live="polite">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-ym-blue">
        <proj.icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{proj.label}</p>
        <p className="mt-0.5 truncate text-xs text-blue-200">
          {team.length ? `Built by ${team.map((t) => COMPANY_NAME[t.key].replace("YugMinds ", "")).join(", ")}` : "We'll match the right team"}
        </p>
      </div>
      <span className="relative grid size-10 shrink-0 place-items-center" aria-label={`Brief ${pct}% ready`}>
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 94.2} 94.2`} className="transition-[stroke-dasharray] duration-500" />
        </svg>
        <span className="text-[11px] font-bold tabular-nums">{pct}</span>
      </span>
    </div>
  );
}

/* The live brief: fills in as the visitor answers, on the site's blueprint. */
function BriefCard({ b, sent }: { b: Brief; sent: boolean }) {
  const proj = BRIEF_PROJECTS.find((p) => p.id === b.project);
  const team = PROJECTS.find((p) => p.id === b.project)?.steps ?? [];
  const pct = briefPct(b);
  const name = [b.firstName, b.lastName].filter(Boolean).join(" ");
  return (
    <div className="ym-graph-blue relative flex h-full flex-col overflow-hidden rounded-2xl p-6 text-white md:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="font-acdisplay text-xl font-bold">Your project brief</p>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums">{sent ? "Sent" : `${pct}% ready`}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-amber-400 transition-[width] duration-500 ease-out" style={{ width: `${sent ? 100 : pct}%` }} />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className={`grid size-12 shrink-0 place-items-center rounded-xl transition-colors duration-300 ${proj ? "bg-white text-ym-blue" : "border-2 border-dashed border-white/30 text-white/40"}`}>
          {proj ? <proj.icon key={proj.id} className="ym-pop size-6" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
        </span>
        <p className="font-acdisplay text-lg font-bold leading-tight">{proj ? proj.label : "Pick what you need built"}</p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4">
        <BriefRow k="About it" v={b.details.trim() ? (b.details.trim().length > 110 ? b.details.trim().slice(0, 110) + "…" : b.details.trim()) : ""} wide />
        <BriefRow k="Budget" v={b.budget} />
        <BriefRow k="Timeline" v={b.timeline} />
        <BriefRow k="From" v={[name, b.org.trim()].filter(Boolean).join(", ")} wide />
      </dl>

      <div className="mt-6">
        <p className="text-xs font-semibold text-blue-200">Who builds it</p>
        <ol className="mt-2 flex flex-wrap gap-1.5">
          {team.length === 0 ? (
            <li className="text-sm text-blue-100">{b.project === "other" ? "We'll match the right team." : "Lights up once you pick a project."}</li>
          ) : (
            team.map((t, i) => (
              <li key={`${b.project}-${t.key}`} className="ym-rise flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm font-semibold" style={{ animationDelay: `${i * 90}ms` }}>
                <span className="grid size-6 place-items-center rounded-full bg-amber-400 text-xs font-bold text-ym-text">{i + 1}</span>
                {COMPANY_NAME[t.key]}
              </li>
            ))
          )}
        </ol>
      </div>

      <div className="mt-auto pt-8">
        <p className="text-xs font-semibold text-blue-200">After you send it</p>
        <ol className="mt-2 flex flex-col gap-1.5 text-sm text-blue-50">
          {NEXT_STEPS.map((st, i) => (
            <li key={st} className="flex gap-2">
              <span className="font-bold text-amber-300">{i + 1}.</span>
              {st}
            </li>
          ))}
        </ol>
      </div>

      {/* The stamp, when it's sent. */}
      {sent && (
        <div className="ym-stamp pointer-events-none absolute right-6 top-24 rotate-[-12deg] rounded-lg border-4 border-amber-400 px-4 py-2 text-center text-amber-300" aria-hidden>
          <p className="font-acdisplay text-2xl font-bold leading-none">Received</p>
          <p className="mt-1 text-xs font-semibold">YugMinds</p>
        </div>
      )}
    </div>
  );
}

function BriefForm() {
  const [b, setB] = useState<Brief>(EMPTY_BRIEF);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [errors, setErrors] = useState<Partial<Record<keyof Brief, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [failMsg, setFailMsg] = useState("");
  const paneRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // A new step starts at the top: on a phone, Continue is pressed far below the form's start.
  useEffect(() => {
    const top = formRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 64) window.scrollBy({ top: top - 80, behavior: "smooth" });
  }, [step, state]);
  const set = (k: keyof Brief) => (v: string) => {
    setB((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
    setErrors({});
  };
  const next = () => {
    const e = checkStep(step, b);
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      paneRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return false;
    }
    if (step < BRIEF_STEPS.length - 1) go(step + 1);
    return true;
  };

  // Move focus to each step's first control, so keyboard users follow along.
  useEffect(() => {
    if (state !== "idle") return;
    const el = paneRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    if (el && document.activeElement && paneRef.current?.contains(document.activeElement)) el.focus();
  }, [step, state]);

  // The project picker's buttons pre-select a project here and skip to details.
  useEffect(() => {
    const onPick = (ev: Event) => {
      const id = (ev as CustomEvent<string>).detail;
      if (BRIEF_PROJECTS.some((p) => p.id === id)) {
        setB((x) => ({ ...x, project: id }));
        setDir(1);
        setStep(1);
      }
    };
    window.addEventListener("ym:brief", onPick);
    return () => window.removeEventListener("ym:brief", onPick);
  }, []);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (step < BRIEF_STEPS.length - 1) {
      next();
      return;
    }
    // Recheck everything, and send them back to the first step that needs fixing.
    for (let s = 0; s < BRIEF_STEPS.length; s++) {
      const e = checkStep(s, b);
      if (Object.keys(e).length) {
        if (s !== step) go(s);
        setErrors(e);
        return;
      }
    }
    setState("sending");
    const project = BRIEF_PROJECTS.find((p) => p.id === b.project)?.label ?? b.project;
    const lines = [b.details.trim(), "", `Budget: ${b.budget || "Not given"}`, `Timeline: ${b.timeline || "Not given"}`];
    if (b.org.trim()) lines.push(`Organisation: ${b.org.trim()}`);
    try {
      await commonApi.contact({
        firstName: b.firstName.trim(),
        lastName: b.lastName.trim(),
        email: b.email.trim(),
        areaCode: "+91",
        phoneNumber: b.phone.trim(),
        purpose: `Project brief: ${project}`,
        message: lines.join("\n"),
        source: "yugminds",
      });
      setState("sent");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setFailMsg(
        status === 429
          ? "That's a lot of messages in a minute. Wait a moment and send it again."
          : "Your brief didn't send. Check your connection and try again, or email info@yugminds.org.",
      );
      setState("failed");
    }
  };

  const err = (k: keyof Brief) =>
    errors[k] ? (
      <p id={`${k}-err`} className="mt-1.5 text-sm font-semibold text-red-600">
        {errors[k]}
      </p>
    ) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      {/* The steps. */}
      <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="brief-title" className="flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-4 sm:p-6 md:p-8 lg:min-h-[560px]">
        {state === "sent" ? (
          <div className="ym-rise my-auto flex flex-col items-start" role="status">
            <span className="ym-pop grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="size-7" aria-hidden />
            </span>
            <h3 className="mt-5 font-acdisplay text-3xl font-bold text-ym-text">Brief sent. Thanks, {b.firstName.trim()}.</h3>
            <p className="mt-2 max-w-[46ch] text-lg leading-relaxed text-slate-600">
              A person on the team will reply to <span className="font-semibold text-ym-text">{b.email.trim()}</span>. If it&apos;s urgent, call +91 85003 45655.
            </p>
            <button
              type="button"
              onClick={() => {
                setB(EMPTY_BRIEF);
                setState("idle");
                go(0);
              }}
              className={`mt-6 font-semibold text-ym-blue underline decoration-blue-200 decoration-2 underline-offset-4 hover:decoration-ym-blue ${focusRing}`}
            >
              Send another brief
            </button>
          </div>
        ) : (
          <>
            <h3 id="brief-title" className="sr-only">
              Project brief, step {step + 1} of {BRIEF_STEPS.length}: {BRIEF_STEPS[step]}
            </h3>
            {/* Step rail: tap a done step to go back to it. */}
            <ol className="flex items-center gap-2" aria-label="Steps">
              {BRIEF_STEPS.map((s, i) => (
                <li key={s} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    disabled={i > step}
                    onClick={() => go(i)}
                    aria-current={i === step ? "step" : undefined}
                    className={`flex items-center gap-2 rounded-full text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ym-blue ${i <= step ? "text-ym-text" : "text-slate-400"}`}
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-300 ${i < step ? "bg-ym-blue text-white" : i === step ? "bg-amber-400 text-ym-text" : "bg-slate-100"}`}>
                      {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
                    </span>
                    <span className="max-sm:hidden">{s}</span>
                  </button>
                  {i < BRIEF_STEPS.length - 1 && (
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <span className="block h-full bg-ym-blue transition-[width] duration-500" style={{ width: i < step ? "100%" : "0%" }} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-2.5 text-sm font-semibold text-slate-500 sm:hidden" aria-hidden>
              Step {step + 1} of {BRIEF_STEPS.length}: {BRIEF_STEPS[step]}
            </p>
            <BriefStrip b={b} />

            <div ref={paneRef} key={step} className={`${dir > 0 ? "ym-step-in" : "ym-step-back"} mt-6 flex-1 sm:mt-8`}>
              {step === 0 && (
                <fieldset>
                  <legend className="font-acdisplay text-2xl font-bold text-ym-text">What do you need built?</legend>
                  <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-2.5" role="radiogroup" aria-describedby={errors.project ? "project-err" : undefined}>
                    {BRIEF_PROJECTS.map((p, i) => (
                      <label key={p.id} className="cursor-pointer">
                        <input
                          type="radio"
                          name="project"
                          value={p.id}
                          checked={b.project === p.id}
                          {...(i === 0 ? { "data-autofocus": true } : {})}
                          onChange={() => {
                            set("project")(p.id);
                            setDir(1);
                            window.setTimeout(() => setStep(1), 260); // a beat to see it light up
                          }}
                          className="peer sr-only"
                        />
                        <span className="group flex h-full items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 transition-all duration-200 hover:border-ym-blue peer-checked:border-ym-blue peer-checked:bg-blue-50 peer-focus-visible:ring-2 peer-focus-visible:ring-ym-blue peer-focus-visible:ring-offset-2 sm:flex-col sm:items-start sm:p-4 sm:hover:-translate-y-0.5">
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-ym-blue transition-colors group-hover:bg-ym-blue group-hover:text-white sm:size-11">
                            <p.icon className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold leading-snug text-ym-text">{p.label}</span>
                            <span className="mt-0.5 block text-sm text-slate-500">{p.hint}</span>
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-slate-300 sm:hidden" aria-hidden />
                        </span>
                      </label>
                    ))}
                  </div>
                  {err("project")}
                </fieldset>
              )}

              {step === 1 && (
                <div>
                  <label htmlFor="brief-details" className="font-acdisplay text-2xl font-bold text-ym-text">
                    Tell us about it
                  </label>
                  <p className="mt-1 text-slate-600">What should it do, who is it for, and what do you have so far? Rough is fine.</p>
                  <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Sentence starters">
                    {IDEA_STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          set("details")((b.details.trim() ? b.details.trimEnd() + "\n" : "") + s.replace("…", " "));
                          paneRef.current?.querySelector<HTMLTextAreaElement>("#brief-details")?.focus();
                        }}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none transition-colors hover:bg-blue-50 hover:text-ym-blue focus-visible:ring-2 focus-visible:ring-ym-blue"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="brief-details"
                    name="details"
                    data-autofocus
                    rows={6}
                    value={b.details}
                    onChange={(e) => set("details")(e.target.value)}
                    aria-invalid={!!errors.details}
                    aria-describedby={errors.details ? "details-err" : "details-count"}
                    className={`${FIELD} mt-3 resize-y`}
                  />
                  {err("details") ?? (
                    <p id="details-count" className={`mt-1.5 text-sm ${b.details.trim().length >= 20 ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
                      {b.details.trim().length >= 20 ? "That's enough to get started. More detail always helps." : `A sentence or two is enough (${b.details.trim().length}/20).`}
                    </p>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-7">
                  <Pills label="Rough budget" name="budget" options={BUDGETS} value={b.budget} onChange={set("budget")} />
                  <Pills label="When do you need it?" name="timeline" options={TIMELINES} value={b.timeline} onChange={set("timeline")} />
                  <p className="text-sm text-slate-500">Both optional. A rough idea helps us plan the right team.</p>
                </div>
              )}

              {step === 3 && (
                <div>
                  <p className="font-acdisplay text-2xl font-bold text-ym-text">Where should we reply?</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        ["firstName", "First name", "text", "given-name"],
                        ["lastName", "Last name", "text", "family-name"],
                        ["email", "Email", "email", "email"],
                        ["phone", "Phone (optional)", "tel", "tel"],
                      ] as const
                    ).map(([k, label, type, auto], i) => (
                      <div key={k}>
                        <label htmlFor={`brief-${k}`} className="text-sm font-semibold text-ym-text">
                          {label}
                        </label>
                        <input
                          id={`brief-${k}`}
                          name={k}
                          type={type}
                          autoComplete={auto}
                          enterKeyHint={k === "phone" ? "done" : "next"}
                          {...(k === "email" ? { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } : {})}
                          {...(k === "phone" ? { inputMode: "tel" as const } : {})}
                          {...(i === 0 ? { "data-autofocus": true } : {})}
                          value={b[k]}
                          onChange={(e) => set(k)(e.target.value)}
                          aria-invalid={!!errors[k]}
                          aria-describedby={errors[k] ? `${k}-err` : undefined}
                          className={FIELD}
                        />
                        {err(k)}
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <label htmlFor="brief-org" className="text-sm font-semibold text-ym-text">
                        Company or school (optional)
                      </label>
                      <input id="brief-org" name="org" type="text" autoComplete="organization" value={b.org} onChange={(e) => set("org")(e.target.value)} className={FIELD} />
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-500">We only use your details to reply to you.</p>
                </div>
              )}
            </div>

            {state === "failed" && (
              <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700" role="alert">
                {failMsg}
              </p>
            )}

            {/* Phones: the actions ride the bottom of the screen while the form is in view. */}
            <div className={`${step === 0 ? "max-sm:hidden" : ""} mt-8 flex items-center justify-between gap-3 max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:-mb-4 max-sm:mt-6 max-sm:rounded-b-2xl max-sm:border-t max-sm:border-slate-200 max-sm:bg-white/95 max-sm:px-4 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-sm:pt-3`}>
              {step > 0 ? (
                <button type="button" onClick={() => go(step - 1)} className={`min-h-12 rounded-md px-4 font-semibold text-slate-600 transition-colors hover:bg-slate-100 ${focusRing}`}>
                  Back
                </button>
              ) : (
                <span className="text-sm text-slate-500 max-sm:hidden">Takes about a minute.</span>
              )}
              {step < BRIEF_STEPS.length - 1 ? (
                step === 0 ? (
                  // The tiles advance on their own; on a phone the button only takes space.
                  <button type="submit" className={`${BTN_PRIMARY} min-h-12 gap-2 max-sm:hidden`}>
                    Continue
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                ) : (
                  <button type="submit" className={`${BTN_PRIMARY} min-h-12 gap-2 max-sm:flex-1`}>
                    {step === 2 && !b.budget && !b.timeline ? "Skip" : "Continue"}
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                )
              ) : (
                <button type="submit" disabled={state === "sending"} className={`${BTN_PRIMARY} min-h-12 gap-2 disabled:opacity-70 max-sm:flex-1`}>
                  {state === "sending" ? "Sending…" : "Send brief"}
                </button>
              )}
            </div>
          </>
        )}
      </form>

      {/* Phones get the strip while filling in, and the full card (with its stamp) once sent. */}
      <div className={state === "sent" ? "" : "max-lg:hidden"}>
        <BriefCard b={b} sent={state === "sent"} />
      </div>
    </div>
  );
}

function ContactBlock() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="scroll-mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-28">
        <div className="flex flex-col gap-y-6 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-x-12">
          <div className="max-w-xl">
            <h2 id="contact-title" className="font-acdisplay text-4xl font-bold leading-[1.05] tracking-tight text-ym-text md:text-6xl">
              Talk to the team.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              Build your brief in four quick steps and watch it come together. A person on the team reads every one.
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-3 max-lg:order-last max-lg:mt-2" aria-label="Or reach us directly">
            {CONTACT.map(({ icon: Icon, label, value, href }) => {
              const inner = (
                <>
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-ym-blue">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-xs text-slate-500">{label}</span>
                    <span className="block text-sm font-semibold text-ym-text">{value}</span>
                  </span>
                </>
              );
              return (
                <li key={label}>
                  {href ? (
                    <a href={href} className={`flex items-center gap-3 rounded hover:text-ym-blue ${focusRing}`}>{inner}</a>
                  ) : (
                    <div className="flex items-center gap-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-2 lg:mt-6 lg:basis-full">
            <BriefForm />
          </div>
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
    heading: "Our companies",
    links: [
      { label: "YugMinds Labs", href: "/#labs" },
      { label: "YugMinds Hardware", href: "/#hardware" },
      { label: "YugMinds Software", href: "/#software" },
      { label: "YugMinds Manufacturing", href: "/#manufacturing" },
      { label: "Robocoders™", href: brandHref("/robocoders") },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "/#about" },
      { label: "Products", href: "/#products" },
      { label: "What we build", href: "/#build" },
      { label: "Contact", href: "/#contact" },
    ],
  },
  {
    heading: "Robocoders™",
    links: [
      { label: "Programs", href: brandHref("/robocoders/programs") },
      { label: "Products", href: brandHref("/robocoders/products") },
      { label: "For schools", href: brandHref("/robocoders/for-schools") },
      { label: "Online classes", href: brandHref("/robocoders/online-classes") },
      { label: "Student login", href: brandHref("/lms/login") },
    ],
  },
];

/* The Robocoders car from the hero, top-down, small enough to drive along the footer's track. */
function TrackCar() {
  // The hero's race car in side profile, facing right (the way it drives): long hood, fastback
  // cabin, swan-neck wing, the three livery stripes, bronze wheels and a headlight.
  return (
    <svg viewBox="0 0 120 40" className="h-9 w-auto" aria-hidden>
      <path d="M14 18 L13 11 H30 V13 H26 L24 18 Z" fill="#0f172a" />
      <path d="M6 30 Q4 22 9 19 L34 16 Q44 7 60 6 Q76 6 86 14 L108 18 Q116 20 116 27 L115 31 Q114 33 110 33 H8 Q6 33 6 30 Z" fill="#f8fafc" />
      <path d="M39 16 Q47 9 60 8.5 Q72 8.5 80 14 Z" fill="#0f172a" />
      <path d="M60 8.6 L60.5 14.6" stroke="#f8fafc" strokeWidth="1.4" />
      <path d="M8 25 H44 Q52 25 56 21 Q60 18 70 18.5 L108 21" fill="none" stroke="#0ea5e9" strokeWidth="1.6" />
      <path d="M8 27 H44 Q53 27 57 23 Q61 20 70 20.5 L110 23" fill="none" stroke="#1e3a8a" strokeWidth="1.6" />
      <path d="M8 29 H44 Q54 29 58 25 Q62 22 70 22.5 L112 25" fill="none" stroke="#dc2626" strokeWidth="1.6" />
      <path d="M108 20 L115 22.5 L114.5 25 L107 23 Z" fill="#0f172a" />
      <path d="M109 21.6 L114 23.2" stroke="#e0f2fe" strokeWidth="1" />
      <rect x="4" y="21" width="4" height="3" fill="#ef4444" />
      <path d="M9 33 H113" stroke="#0f172a" strokeWidth="2" />
      {[28, 94].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="31" r="8" fill="#0b1220" />
          <circle cx={cx} cy="31" r="5" fill="#a8834a" />
          <circle cx={cx} cy="31" r="1.6" fill="#0b1220" />
        </g>
      ))}
    </svg>
  );
}

function Footer() {
  return (
    <footer className="ym-footer bg-[#0b1a45] text-white">
      {/* The line track, with the car driving along it. */}
      <div className="relative h-12 overflow-hidden" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,#334a8a_0_18px,transparent_18px_30px)]" />
        <span className="ym-drive absolute top-1/2">
          <TrackCar />
        </span>
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-10 md:px-10">
        {/* Call to action. */}
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-white/[0.06] p-6 md:flex-row md:items-center md:p-8">
          <div>
            <p className="font-acdisplay text-2xl font-bold md:text-3xl">Got something to build?</p>
            <p className="mt-1 text-blue-100">Send us a brief, or call and talk it through.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/#contact" onClick={(e) => jumpTo(e, "/#contact")} className={`group inline-flex min-h-12 items-center gap-1.5 rounded-md bg-white px-5 font-semibold text-ym-text transition-colors hover:bg-blue-50 ${focusRing} focus-visible:ring-offset-[#0b1a45]`}>
              Start a project
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <a href="tel:+918500345655" className={`inline-flex min-h-12 items-center gap-2 rounded-md bg-white/10 px-5 font-semibold transition-colors hover:bg-white/15 ${focusRing} focus-visible:ring-offset-[#0b1a45]`}>
              <Phone className="size-4" aria-hidden /> +91 85003 45655
            </a>
          </div>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.1fr_2fr]">
          <div>
            <Link href="/" className={`group inline-flex items-center gap-3 rounded ${focusRing} focus-visible:ring-offset-[#0b1a45]`}>
              <LogoMark tint="#93C5FD" className="h-9 w-9 transition-transform duration-500 group-hover:rotate-[360deg]" />
              <span className="font-acdisplay text-2xl font-bold tracking-tight">YugMinds</span>
            </Link>
            <p className="mt-4 max-w-sm leading-relaxed text-blue-100/80">
              Five companies under one roof in Hyderabad: custom software and IT services, electronics, machines, and Robocoders™ robotics lessons for schools.
            </p>
            <ul className="mt-6 flex flex-col gap-2.5 text-sm">
              {CONTACT.map(({ icon: Icon, value, href }) => (
                <li key={value}>
                  {href ? (
                    <a href={href} className="inline-flex items-center gap-2.5 text-blue-100 transition-colors hover:text-white">
                      <Icon className="size-4 text-amber-300" aria-hidden /> {value}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2.5 text-blue-100">
                      <Icon className="size-4 text-amber-300" aria-hidden /> {value}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-10 md:grid-cols-3">
            {FOOTER_COLS.map((col) => (
              // Phones skip the Robocoders column: it's that site's own menu, and Robocoders is already listed under Our companies.
              <div key={col.heading} className={col.heading === "Robocoders™" ? "max-sm:hidden" : ""}>
                <p className="font-acdisplay font-semibold">{col.heading}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} onClick={(e) => jumpTo(e, l.href)} className="group inline-flex items-center gap-1 text-blue-100/80 transition-colors hover:text-white">
                        <span className="h-0.5 w-0 rounded-full bg-amber-300 transition-all duration-200 group-hover:w-2.5" aria-hidden />
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-sm text-blue-200/70 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} YugMinds Private Limited, Hyderabad</span>
          <a href="/#top" onClick={(e) => jumpTo(e, "/#top")} className={`group inline-flex items-center gap-1.5 rounded hover:text-white ${focusRing} focus-visible:ring-offset-[#0b1a45]`}>
            <ArrowUp className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" aria-hidden /> Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   PAGES
───────────────────────────────────────────── */
function Shell({ children }: { children: React.ReactNode }) {
  const diag = useDiag();
  const [probe, setProbe] = useState("");
  useEffect(() => {
    if (diag.size === 0) return;
    // Inject the bisect overrides at runtime (not via globals.css, which Safari on the phone wasn't applying).
    const css = [
      diag.has("noanim") && '[data-landing], [data-landing] * { animation: none !important; transition: none !important; }',
      diag.has("nosticky") && '[data-landing] .sticky, [data-landing] [class*="sticky"] { position: static !important; }',
      diag.has("nofixed") && '[data-landing] header { position: absolute !important; }',
      diag.has("noclip") && '[data-landing] main, [data-landing] section, body { overflow-x: visible !important; }',
    ].filter(Boolean).join("\n");
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    const t = window.setTimeout(() => {
      const pos = (el: Element | null) => (el ? getComputedStyle(el).position : "none");
      setProbe(`hdr:${pos(document.querySelector("header"))} pin:${pos(document.querySelector("#divisions > div"))} main:${getComputedStyle(document.querySelector("main")!).overflowX} body:${getComputedStyle(document.body).overflowX} sec:${getComputedStyle(document.querySelector("#divisions")!).overflowX}`);
    }, 1500);
    return () => {
      window.clearTimeout(t);
      st.remove();
    };
  }, [diag]);
  return (
    // Reduced-motion users get the schematic fully drawn, no animation.
    <MotionConfig reducedMotion="user">
      <div data-landing data-noanim={diag.has("noanim") || undefined} data-nosticky={diag.has("nosticky") || undefined} data-nofixed={diag.has("nofixed") || undefined} data-noclip={diag.has("noclip") || undefined} className={`${displayFont.variable} min-h-screen bg-white font-abeezee text-ym-text`}>
        {diag.size > 0 && (
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 99999, background: "#facc15", color: "#000", font: "700 11px/1.3 monospace", padding: "3px 6px" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 3 }}>
              {["nosticky", "nofixed", "noclip", "noanim"].map((f) => {
                const on = diag.has(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      const next = new Set(diag);
                      if (on) next.delete(f);
                      else next.add(f);
                      window.location.search = next.size ? `?diag=${Array.from(next).join(",")}` : "";
                    }}
                    style={{ padding: "6px 8px", border: "2px solid #000", background: on ? "#000" : "#fff", color: on ? "#facc15" : "#000", font: "inherit" }}
                  >
                    {on ? "OFF " : "ON "}{f.replace("no", "")}
                  </button>
                );
              })}
            </div>
            {probe}
          </div>
        )}
        <Nav />
        {/* No overflow-x clip on main/sections: it made iOS Safari shake while scrolling (see globals.css). */}
        <main>{children}</main>
        <Footer />
        {!diag.has("nobot") && <LeadBot />}
      </div>
    </MotionConfig>
  );
}

export function YugmindsHomePage() {
  const diag = useDiag();
  if (diag.has("plain")) {
    // Temporary: a bare long page, to tell "our code" from "the phone".
    const colors = ["#f8fafc", "#1e3a8a", "#ffffff", "#e0f2fe"];
    return (
      <main>
        {Array.from({ length: 12 }).map((_, i) => (
          <section key={i} style={{ height: "100svh", background: colors[i % 4], color: i % 4 === 1 ? "#fff" : "#0f172a", padding: 24, fontSize: 28, fontWeight: 700 }}>
            Plain block {i + 1}
          </section>
        ))}
      </main>
    );
  }
  return (
    <Shell>
      {/* Hook, what we do, what we make, why us, start your project, talk to us. */}
      <Hero />
      <Divisions />
      <Products />
      <About />
      <ProjectPicker />
      <ContactBlock />
    </Shell>
  );
}
