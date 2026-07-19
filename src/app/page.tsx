"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useScroll, useInView, animate } from "framer-motion";
import {
  Menu,
  X,
  Code2,
  Cpu,
  FlaskConical,
  Factory,
  GraduationCap,
  ArrowRight,
  ArrowUpRight,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Youtube,
  Facebook,
  Star,
  Zap,
} from "lucide-react";
import BrandSwitcherBar from "../components/BrandSwitcherBar";

/* ─────────────────────────────────────────────
   MOTION HELPERS
───────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  y = 40,
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
      initial={{ opacity: 0, y, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: [0.21, 0.61, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* thin scroll progress bar pinned above everything */
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      style={{ scaleX: scrollYProgress }}
      className="fixed top-0 inset-x-0 h-[3px] origin-left bg-gradient-to-r from-blue-600 via-sky-400 to-amber-400 z-[60] pointer-events-none"
    />
  );
}

/* animated number that counts up when scrolled into view */
function CountUp({
  value,
  suffix = "",
  className = "",
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <p ref={ref} className={className}>
      {display}
      {suffix}
    </p>
  );
}

function Floating({
  children,
  duration = 5,
  offset = 12,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  duration?: number;
  offset?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -offset, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   HAND-DRAWN SVG DECORATIONS
───────────────────────────────────────────── */
function SquiggleUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 24"
      fill="none"
      preserveAspectRatio="none"
    >
      <motion.path
        d="M4 16 Q 30 4, 58 14 T 112 14 T 166 14 T 216 12"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.5, ease: "easeOut" }}
      />
    </svg>
  );
}

function HandCircle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 260 90" fill="none">
      <motion.path
        d="M130 8 C 210 4, 254 22, 253 44 C 252 70, 196 84, 126 83 C 58 82, 8 68, 7 45 C 6 24, 52 10, 148 10"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, delay: 0.6, ease: "easeOut" }}
      />
    </svg>
  );
}

function ScribbleArrow({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 110" fill="none">
      <motion.path
        d="M14 10 C 60 18, 46 52, 26 56 C 10 60, 8 42, 26 40 C 58 38, 86 60, 96 92"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, delay: 0.8 }}
      />
      <motion.path
        d="M82 88 L 97 94 L 102 78"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.9 }}
      />
    </svg>
  );
}

function Spiral({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none">
      {[44, 34, 24, 14, 6].map((r, i) => (
        <circle
          key={i}
          cx="50"
          cy="50"
          r={r}
          stroke="currentColor"
          strokeWidth="5"
          strokeDasharray={i % 2 === 0 ? "999" : "180 40"}
        />
      ))}
    </svg>
  );
}

function Seal({ className = "" }: { className?: string }) {
  // flower / seal badge shape
  const petals = 12;
  const pts: string[] = [];
  for (let i = 0; i < petals * 2; i++) {
    const angle = (Math.PI * i) / petals;
    const r = i % 2 === 0 ? 50 : 42;
    pts.push(
      `${(50 + r * Math.cos(angle)).toFixed(2)},${(50 + r * Math.sin(angle)).toFixed(2)}`
    );
  }
  return (
    <svg className={className} viewBox="0 0 100 100">
      <polygon points={pts.join(" ")} fill="currentColor" />
    </svg>
  );
}

function WaveMarks({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 90" fill="none">
      {[0, 1, 2].map((row) => (
        <path
          key={row}
          d={`M8 ${18 + row * 26} q 12 -14 24 0 t 24 0 t 24 0 t 24 0 t 24 0`}
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
          opacity={row === 1 ? 0.85 : 1}
        />
      ))}
    </svg>
  );
}

function DotGrid({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-6 gap-2 ${className}`}>
      {Array(24)
        .fill(0)
        .map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-current" />
        ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────── */
function YugmindsNavbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { name: "Home", href: "#home" },
    { name: "About", href: "#about" },
    { name: "Services", href: "#services" },
    { name: "Divisions", href: "#divisions" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <header className="sticky top-0 z-50 px-3 md:px-6 pt-3">
      <nav className="max-w-6xl mx-auto bg-white/85 backdrop-blur-xl rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-slate-900/5">
        <div className="relative pl-5 pr-2.5 md:pl-7 md:pr-3 py-2.5 flex items-center justify-between">
          {/* Logo */}
          <a href="#home" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/Yugminds_Official_Logo-preview.png"
              alt="YugMinds Logo"
              width={38}
              height={38}
              className="object-contain"
              priority
            />
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">
              YugMinds
            </span>
          </a>

          {/* Desktop links — clean text */}
          <div className="hidden md:flex items-center gap-9 absolute left-1/2 -translate-x-1/2">
            {links.map((l) => (
              <a
                key={l.name}
                href={l.href}
                className="relative text-[0.92rem] font-medium text-slate-600 hover:text-slate-900 transition-colors duration-200 after:absolute after:-bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-[3px] after:w-0 after:rounded-full after:bg-blue-600 after:transition-all after:duration-300 hover:after:w-4"
              >
                {l.name}
              </a>
            ))}
          </div>

          {/* CTA */}
          <motion.a
            href="#contact"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="hidden md:inline-flex items-center gap-2 bg-blue-600 text-white pl-5 pr-1.5 py-1.5 rounded-full text-sm font-semibold shadow-md shadow-blue-600/25 hover:bg-blue-700 transition-colors group"
          >
            Get in Touch
            <span className="w-7 h-7 rounded-full bg-white text-blue-600 flex items-center justify-center transition-transform duration-300 group-hover:rotate-45">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </motion.a>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-slate-700 w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden max-w-6xl mx-auto mt-2 bg-white/95 backdrop-blur-xl rounded-3xl shadow-lg ring-1 ring-slate-900/5 px-4 py-5 flex flex-col gap-1">
          {links.map((l) => (
            <a
              key={l.name}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-slate-700 hover:text-blue-600 px-4 py-2.5 rounded-full hover:bg-blue-50 transition-colors"
            >
              {l.name}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold text-center hover:bg-blue-700 transition-colors mt-2"
          >
            Get in Touch
          </a>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────
   HERO — centered, playful, WonderKids style
───────────────────────────────────────────── */
function HeroSection() {
  return (
    <section id="home" className="relative bg-white overflow-hidden">
      {/* soft ambient blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-70 pointer-events-none" />
      <div className="absolute top-40 -right-32 w-[28rem] h-[28rem] bg-sky-50 rounded-full blur-3xl opacity-70 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-24 relative">
        {/* ── floating side decorations (parallax drift) ── */}
        {/* left: logo bubble on blue blob */}
        <Floating
          className="hidden lg:block absolute left-0 top-32"
          duration={6}
        >
          <div className="relative">
            <div className="w-32 h-20 bg-blue-100 rounded-[3rem] rotate-[-8deg]" />
            <div className="absolute -top-8 left-6 w-20 h-20 rounded-full bg-white shadow-xl border-4 border-blue-100 flex items-center justify-center overflow-hidden">
              <Image
                src="/Yugminds_Official_Logo-preview.png"
                alt="YugMinds"
                width={52}
                height={52}
                className="object-contain"
              />
            </div>
          </div>
          <ScribbleArrow className="w-20 h-20 text-blue-500 mt-6 ml-2" />
        </Floating>

        {/* right: rotating seal badge */}
        <motion.div
          className="hidden lg:flex absolute right-0 top-24 w-28 h-28 items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <path
                id="heroCirclePath"
                d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0"
              />
            </defs>
            <circle
              cx="50"
              cy="50"
              r="48"
              className="fill-white stroke-blue-200"
              strokeWidth="1.5"
            />
            <text className="fill-blue-600 text-[8.5px] font-bold tracking-[0.05em] uppercase">
              <textPath href="#heroCirclePath">
                YugMinds · Est. 2024 · YugMinds · Est. 2024 ·
              </textPath>
            </text>
            <circle cx="50" cy="50" r="14" className="fill-blue-600" />
            <circle cx="44" cy="44" r="4" className="fill-sky-300" />
            <circle cx="57" cy="49" r="4" className="fill-amber-300" />
            <circle cx="48" cy="58" r="4" className="fill-white" />
          </svg>
        </motion.div>

        {/* right: hashtag pills */}
        <div className="hidden lg:block absolute right-4 top-[420px]">
          {[
            { tag: "#software", cls: "bg-blue-100 text-blue-700 rotate-[-6deg]" },
            { tag: "#robotics", cls: "bg-amber-300 text-amber-900 rotate-[4deg] ml-16 -mt-1" },
            { tag: "#innovation", cls: "bg-blue-600 text-white rotate-[-3deg] ml-6 mt-2" },
          ].map((p, i) => (
            <Floating key={p.tag} duration={4 + i} delay={i * 0.4}>
              <span
                className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm mb-2 ${p.cls}`}
              >
                {p.tag}
              </span>
            </Floating>
          ))}
        </div>

        {/* left: spiral */}
        <Floating
          className="hidden lg:block absolute left-10 top-[430px]"
          duration={7}
          offset={8}
        >
          <Spiral className="w-16 h-16 text-blue-300" />
        </Floating>

        {/* ── centered content ── */}
        <div className="text-center max-w-4xl mx-auto">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 px-4 py-2 rounded-full mb-8">
              <Zap className="w-3.5 h-3.5" /> Software · Machines · Education
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className="text-5xl sm:text-6xl md:text-[5.25rem] font-extrabold leading-[1.08] text-slate-900 mb-8">
              Building{" "}
              <span className="relative inline-block text-blue-600 italic">
                Tomorrow&apos;s
                <SquiggleUnderline className="absolute -bottom-3 left-0 w-full h-5 text-blue-400" />
              </span>
              <br />
              <span className="relative inline-block">
                <span className="relative z-10 text-slate-900">Industries</span>
                <HandCircle className="absolute -inset-x-8 -inset-y-3 w-[calc(100%+4rem)] h-[calc(100%+1.5rem)] text-amber-400 z-0" />
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="text-slate-500 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
              YugMinds Private Limited builds software, electronics, and
              machines — and teaches students coding and robotics through
              Robocoders™, our flagship education program.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="flex flex-wrap justify-center gap-4">
              <motion.a
                href="#divisions"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2.5 bg-blue-600 text-white pl-7 pr-2.5 py-2.5 rounded-full font-semibold shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors text-sm"
              >
                Explore Divisions
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </motion.a>
              <motion.a
                href="#about"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 border-2 border-slate-200 text-slate-700 px-7 py-3 rounded-full font-semibold hover:border-blue-400 hover:text-blue-600 transition-colors text-sm"
              >
                Learn More
              </motion.a>
            </div>
          </Reveal>
        </div>

        {/* ── bottom photo strip in pill blobs ── */}
        <Reveal delay={0.35} className="mt-20">
          <div className="flex items-end justify-center gap-4 md:gap-6">
            <Floating duration={5.5} offset={8} className="hidden sm:block">
              <div className="relative w-36 h-24 md:w-48 md:h-32 rounded-[2.5rem] overflow-hidden bg-blue-100 rotate-[-4deg] shadow-lg">
                <Image
                  src="/images/landing/dev-team.jpg"
                  alt="Software developers working together"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 144px, 192px"
                />
              </div>
            </Floating>
            <Floating duration={6.5} offset={10}>
              <div className="relative w-48 h-32 md:w-64 md:h-44 rounded-[3rem] overflow-hidden bg-amber-100 shadow-xl z-10">
                <Image
                  src="/Kids Dong Robotics.png"
                  alt="Kids doing robotics with Robocoders"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 192px, 256px"
                />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-blue-700 text-[10px] md:text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  Robocoders™ in action
                </div>
              </div>
            </Floating>
            <Floating duration={5} offset={7} className="hidden sm:block">
              <div className="relative w-36 h-24 md:w-48 md:h-32 rounded-[2.5rem] overflow-hidden bg-sky-100 rotate-[4deg] shadow-lg">
                <Image
                  src="/images/landing/factory-engineer.jpg"
                  alt="Engineer working in a modern factory"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 144px, 192px"
                />
              </div>
            </Floating>
          </div>
        </Reveal>

        {/* floating stat chips */}
        <Floating
          className="hidden md:block absolute bottom-40 left-6 lg:left-24"
          duration={6}
          delay={0.5}
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 px-5 py-3 rotate-[-3deg]">
            <p className="text-[11px] text-slate-500 font-medium">
              Active Projects
            </p>
            <p className="text-2xl font-extrabold text-blue-600">200+</p>
          </div>
        </Floating>
        <Floating
          className="hidden md:block absolute bottom-48 right-6 lg:right-24"
          duration={5}
          delay={1}
        >
          <div className="bg-blue-600 rounded-2xl shadow-xl px-5 py-2.5 rotate-[3deg] text-white text-sm font-bold">
            Est. 2024 ✦
          </div>
        </Floating>
      </div>

      {/* wave divider into next section */}
      <svg
        viewBox="0 0 1440 60"
        className="w-full h-10 md:h-14 text-slate-50 -mb-px"
        preserveAspectRatio="none"
      >
        <path
          d="M0,32 C240,64 480,0 720,24 C960,48 1200,8 1440,32 L1440,60 L0,60 Z"
          fill="currentColor"
        />
      </svg>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FEATURES — three big tinted cards
───────────────────────────────────────────── */
function FeaturesSection() {
  const cards = [
    {
      title: "Software",
      accent: "Development",
      desc: "Expert teams that build websites, mobile apps, and business software for clients around the world.",
      icon: <Code2 className="w-6 h-6 text-blue-700" />,
      card: "bg-blue-100 text-slate-900",
      sub: "text-slate-600",
      accentCls: "text-blue-700 italic",
      decor: <Spiral className="w-24 h-24 text-blue-400/60" />,
    },
    {
      title: "Manufacturing",
      accent: "& Hardware",
      desc: "Modern factories and workshops that make high-quality, carefully engineered products in large numbers.",
      icon: <Factory className="w-6 h-6 text-blue-700" />,
      card: "bg-blue-600 text-white",
      sub: "text-blue-100",
      accentCls: "text-amber-300 italic",
      decor: <WaveMarks className="w-28 h-20 text-blue-400/70" />,
    },
    {
      title: "Research &",
      accent: "Development",
      desc: "Our own labs where we test new ideas and turn them into useful, real-world products.",
      icon: <FlaskConical className="w-6 h-6 text-amber-700" />,
      card: "bg-amber-300 text-amber-950",
      sub: "text-amber-800",
      accentCls: "text-blue-700 italic",
      decor: <DotGrid className="text-amber-600/50" />,
    },
  ];

  return (
    <section id="services" className="bg-slate-50 py-20 md:py-28 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
              Our{" "}
              <span className="relative inline-block text-blue-600 italic">
                core
                <SquiggleUnderline className="absolute -bottom-2 left-0 w-full h-4 text-amber-400" />
              </span>
              <br className="hidden md:block" /> strengths
            </h2>
            <p className="text-slate-500 text-base leading-relaxed md:max-w-sm">
              Whatever the project, we give every client our best work —
              across everything we do.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.15}>
              <motion.div
                whileHover={{ y: -10 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`relative rounded-[2.5rem] p-8 md:p-10 min-h-[340px] flex flex-col overflow-hidden ${c.card}`}
              >
                {/* decoration top-right */}
                <div className="absolute top-6 right-6">{c.decor}</div>

                {/* icon in seal blob */}
                <div className="relative w-16 h-16 mb-auto">
                  <Seal className="absolute inset-0 w-16 h-16 text-white" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    {c.icon}
                  </span>
                </div>

                <h3 className="text-2xl md:text-[1.7rem] font-extrabold leading-snug mt-10 mb-3">
                  {c.title} <span className={c.accentCls}>{c.accent}</span>
                </h3>
                <p className={`text-sm leading-relaxed ${c.sub}`}>{c.desc}</p>

                <a
                  href="#divisions"
                  className="inline-flex items-center gap-1.5 text-sm font-bold mt-5 group"
                >
                  Read more
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   MISSION BAND + DIVISIONS — full blue section
───────────────────────────────────────────── */
function DivisionsSection() {
  const divisions = [
    {
      icon: <Code2 className="w-9 h-9" />,
      circle: "bg-amber-300 text-amber-900",
      title: "Software Development",
      role: "Web · Mobile · Enterprise",
    },
    {
      icon: <Factory className="w-9 h-9" />,
      circle: "bg-white text-blue-700",
      title: "Manufacturing",
      role: "Precision at scale",
    },
    {
      icon: <Cpu className="w-9 h-9" />,
      circle: "bg-sky-300 text-sky-900",
      title: "Hardware Engineering",
      role: "Design & prototyping",
    },
    {
      icon: <GraduationCap className="w-9 h-9" />,
      circle: "bg-amber-300 text-amber-900",
      title: "Robocoders™ EdTech",
      role: "Coding · Robotics · AI",
    },
  ];

  return (
    <section id="divisions" className="bg-slate-50 pb-20 md:pb-28 pt-4">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 60 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: [0.21, 0.61, 0.35, 1] }}
        >
          <div className="relative bg-blue-600 rounded-[3rem] px-6 md:px-16 py-16 md:py-20 overflow-hidden">
            {/* decorations */}
            <Seal className="absolute top-10 left-10 w-14 h-14 text-amber-300" />
            <WaveMarks className="absolute bottom-8 right-10 w-24 h-16 text-blue-400/60 hidden md:block" />
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-500/40 rounded-full blur-2xl" />

            {/* mission statement */}
            <div className="text-center max-w-2xl mx-auto mb-14 relative z-10">
              <h2 className="text-3xl md:text-[2.6rem] font-extrabold text-white leading-snug">
                From software and machines to classrooms, we{" "}
                <span className="text-amber-300 italic">
                  love building new things
                </span>{" "}
                — and we build them to last.
              </h2>
            </div>

            {/* division "avatar" cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-6 relative z-10">
              {divisions.map((d, i) => (
                <Reveal key={d.title} delay={0.15 + i * 0.12}>
                  <motion.div
                    whileHover={{ y: -8 }}
                    className="flex flex-col items-center text-center group cursor-default"
                  >
                    <div className="relative mb-5">
                      {/* blob behind circle */}
                      <div
                        className={`w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center shadow-xl transition-transform duration-300 group-hover:scale-105 ${d.circle}`}
                      >
                        {d.icon}
                      </div>
                      <div className="absolute -top-1 -right-2 grid grid-cols-3 gap-1">
                        {Array(9)
                          .fill(0)
                          .map((_, j) => (
                            <div
                              key={j}
                              className="w-1 h-1 rounded-full bg-white/50"
                            />
                          ))}
                      </div>
                    </div>
                    <h3 className="text-white font-bold text-base md:text-lg">
                      {d.title}
                    </h3>
                    <p className="text-blue-200 text-xs md:text-sm mt-1">
                      {d.role}
                    </p>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   ABOUT SPLIT — circled word + photo collage
───────────────────────────────────────────── */
function AboutSection() {
  return (
    <section id="about" className="bg-white py-20 md:py-28 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-2 gap-14 md:gap-20 items-center">
        {/* Left — text with circled accent */}
        <div>
          <Reveal>
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-[1.15] mb-6">
              The solutions we provide are{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-blue-600 italic">
                  reliable
                </span>
                <HandCircle className="absolute -inset-x-5 -inset-y-2 w-[calc(100%+2.5rem)] h-[calc(100%+1rem)] text-amber-400 z-0" />
              </span>{" "}
              for every business
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="text-slate-500 leading-relaxed mb-8 max-w-md">
              YugMinds brings experts in software, machines, and education
              together under one roof — to help your business grow, work
              smarter, and stay ahead of the competition.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <motion.a
              href="#divisions"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2.5 border-2 border-blue-600 text-blue-600 pl-6 pr-2 py-2 rounded-full font-semibold text-sm hover:bg-blue-50 transition-colors"
            >
              Learn More
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </motion.a>
          </Reveal>
        </div>

        {/* Right — stacked pill collage */}
        <div className="relative flex flex-col items-center gap-4">
          <Spiral className="absolute -top-8 -left-2 w-14 h-14 text-amber-400 z-10" />
          <Reveal delay={0.1} y={40}>
            <div className="flex items-center gap-3">
              <div className="relative w-56 h-24 md:w-72 md:h-28 rounded-full overflow-hidden bg-blue-100 shadow-md">
                <Image
                  src="/images/landing/software-code.jpg"
                  alt="Software code on a screen"
                  fill
                  className="object-cover"
                  sizes="288px"
                />
              </div>
              <div className="w-20 h-24 md:w-28 md:h-28 rounded-full bg-blue-600 flex items-center justify-center">
                <WaveMarks className="w-14 h-10 text-blue-300" />
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.25} y={40}>
            <div className="flex items-center gap-3">
              <div className="w-20 h-24 md:w-28 md:h-28 rounded-full bg-amber-300 flex items-center justify-center">
                <Star className="w-9 h-9 text-amber-700 fill-amber-700" />
              </div>
              <div className="relative w-56 h-24 md:w-72 md:h-28 rounded-full overflow-hidden bg-amber-100 shadow-md">
                <Image
                  src="/images/landing/circuit-board.jpg"
                  alt="Electronics circuit board"
                  fill
                  className="object-cover"
                  sizes="288px"
                />
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.4} y={40}>
            <div className="flex items-center gap-3">
              <div className="relative w-56 h-24 md:w-72 md:h-28 rounded-full overflow-hidden bg-sky-100 shadow-md">
                <Image
                  src="/About Us.jpg"
                  alt="The YugMinds team"
                  fill
                  className="object-cover"
                  sizes="288px"
                />
              </div>
              <div className="w-20 h-24 md:w-28 md:h-28 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                <Image
                  src="/Yugminds_Official_Logo-preview.png"
                  alt="YugMinds logo"
                  width={56}
                  height={56}
                  className="object-contain"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   STATS / TRUST BAND
───────────────────────────────────────────── */
function StatsSection() {
  const stats = [
    { value: 200, suffix: "+", label: "Projects Delivered", cls: "bg-blue-100 text-blue-700" },
    { value: 50, suffix: "+", label: "Clients Worldwide", cls: "bg-amber-300 text-amber-900" },
    { value: 5, suffix: "+", label: "Fields We Work In", cls: "bg-blue-600 text-white" },
    { value: 2024, suffix: "", label: "Established", cls: "bg-sky-100 text-sky-800" },
  ];

  return (
    <section className="bg-white pb-20 md:pb-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
              The more clients trust{" "}
              <span className="text-blue-600 italic">YugMinds,</span>
              <br className="hidden md:block" /> the more we achieve together
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -8, rotate: i % 2 === 0 ? -1.5 : 1.5 }}
                className={`rounded-[2rem] px-6 py-10 text-center shadow-sm ${s.cls}`}
              >
                <CountUp
                  value={s.value}
                  suffix={s.suffix}
                  className="text-4xl md:text-5xl font-extrabold mb-2"
                />
                <p className="text-sm font-semibold opacity-80">{s.label}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   STORIES — blog-style photo cards
───────────────────────────────────────────── */
function StoriesSection() {
  const stories = [
    {
      img: "/child-making-robot.jpg",
      alt: "Child building a robot",
      title: "Hands-on Robotics for Every Student",
      desc: "How Robocoders™ brings real hardware into classrooms so students learn by building, not just watching.",
    },
    {
      img: "/Kids Dong Robotics.png",
      alt: "Kids doing robotics together",
      title: "From Classroom to Competition",
      desc: "Our structured STEM curriculum takes students from first circuits to national-level robotics challenges.",
    },
    {
      img: "/images/landing/office-team.jpg",
      alt: "YugMinds team collaborating at the office",
      title: "One Team, Many Industries",
      desc: "Inside YugMinds — how one team builds software, electronics, and machines under one roof.",
    },
  ];

  return (
    <section className="bg-slate-50 py-20 md:py-28 relative overflow-hidden">
      <Seal className="absolute top-16 right-10 w-16 h-16 text-amber-300 hidden md:block" />
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <Reveal>
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-14">
            Explore our{" "}
            <span className="relative inline-block text-blue-600 italic">
              story
              <SquiggleUnderline className="absolute -bottom-2 left-0 w-full h-4 text-amber-400" />
            </span>
          </h2>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {stories.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.15}>
              <motion.article
                whileHover={{ y: -10 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300 flex flex-col h-full"
              >
                <div className="relative h-52 m-3 rounded-[1.6rem] overflow-hidden">
                  <Image
                    src={s.img}
                    alt={s.alt}
                    fill
                    className="object-cover transition-transform duration-500 hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="px-6 pb-7 pt-2 flex flex-col flex-1">
                  <h3 className="font-extrabold text-slate-900 text-lg leading-snug mb-2">
                    {s.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-1">
                    {s.desc}
                  </p>
                  <a
                    href="#contact"
                    className="inline-flex items-center gap-2.5 text-blue-600 text-sm font-bold group"
                  >
                    Read More
                    <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center group-hover:bg-blue-700 group-hover:translate-x-1 transition-all">
                      <ArrowUpRight className="w-4 h-4" />
                    </span>
                  </a>
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   LEADERSHIP / ABOUT COMPANY
───────────────────────────────────────────── */
function LeadershipSection() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-2 gap-16 items-center">
        {/* Left — circular visual */}
        <Reveal>
          <div className="flex justify-center">
            <div className="relative inline-block">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-dashed border-blue-300"
                animate={{ rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              />
              <div className="w-64 h-64 md:w-72 md:h-72 rounded-full flex items-center justify-center">
                <div className="w-48 h-48 md:w-56 md:h-56 rounded-full bg-blue-50 flex items-center justify-center shadow-xl overflow-hidden">
                  <Image
                    src="/Yugminds_Official_Logo-preview.png"
                    alt="YugMinds Logo"
                    width={150}
                    height={150}
                    className="object-contain"
                  />
                </div>
              </div>
              {/* orbiting dots */}
              <Floating className="absolute -top-2 right-8" duration={4}>
                <div className="w-5 h-5 rounded-full bg-amber-400" />
              </Floating>
              <Floating className="absolute bottom-10 -left-3" duration={5} delay={0.5}>
                <div className="w-4 h-4 rounded-full bg-blue-500" />
              </Floating>
              {/* Name badge */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-full px-5 py-2.5 flex items-center gap-2 whitespace-nowrap border border-slate-100">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-slate-700">
                  YugMinds Pvt Ltd
                </span>
                <span className="text-xs text-slate-400">· Est. 2024</span>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Right — text */}
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-semibold mb-5">
              <Star className="w-3 h-3 fill-blue-600" />
              Great Company · Trusted Team
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
              About <span className="text-blue-600 italic">YugMinds</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-slate-500 leading-relaxed mb-8">
              Started in 2024 with a simple goal — use technology to make work
              and learning better — YugMinds Private Limited today builds
              software, electronics, and machines, and teaches students coding
              and robotics. Whatever we make, we make it to last.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <motion.a
              href="#divisions"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2.5 bg-blue-600 text-white pl-6 pr-2 py-2 rounded-full font-semibold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors"
            >
              Learn More
              <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </motion.a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
function YugmindsFooter() {
  const cols = [
    {
      heading: "Services",
      links: [
        "Software Dev",
        "Manufacturing",
        "Hardware Engg",
        "Research",
        "EdTech",
      ],
    },
    {
      heading: "Divisions",
      links: [
        "Software",
        "Manufacturing",
        "Hardware",
        "Robocoders™",
        "Research Lab",
      ],
    },
    {
      heading: "About",
      links: ["Our Story", "Leadership", "Careers", "News", "Partners"],
    },
  ];

  return (
    <footer id="contact" className="bg-slate-950 pt-8 pb-8 relative overflow-hidden">
      {/* faint oversized watermark */}
      <p className="pointer-events-none select-none absolute -bottom-10 left-1/2 -translate-x-1/2 text-[9rem] md:text-[13rem] font-extrabold text-white/[0.025] whitespace-nowrap leading-none">
        YugMinds
      </p>

      <div className="max-w-7xl mx-auto px-4 md:px-8 relative">
        {/* CTA banner */}
        <Reveal>
          <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2.5rem] px-8 md:px-14 py-12 md:py-14 mb-20 overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl shadow-blue-900/30">
            <motion.div
              className="absolute -top-6 -left-6"
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            >
              <Seal className="w-24 h-24 text-blue-400/40" />
            </motion.div>
            <Floating duration={5} offset={6} className="absolute bottom-4 right-40 hidden lg:block">
              <WaveMarks className="w-20 h-14 text-blue-400/40" />
            </Floating>
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
                Ready to get started?
              </h3>
              <p className="text-blue-100 text-sm md:text-base">
                Let&apos;s build the future of your industry — together.
              </p>
            </div>
            <motion.a
              href="mailto:info@yugminds.org"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="relative z-10 inline-flex items-center gap-2.5 bg-white text-blue-700 pl-7 pr-2.5 py-2.5 rounded-full font-bold text-sm shadow-lg group"
            >
              Join Us
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center transition-transform duration-300 group-hover:rotate-45">
                <ArrowRight className="w-4 h-4" />
              </span>
            </motion.a>
          </div>
        </Reveal>

        {/* Links grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-14">
          {/* Brand column */}
          <Reveal className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-white rounded-full p-1">
                <Image
                  src="/Yugminds_Official_Logo-preview.png"
                  alt="YugMinds Logo"
                  width={36}
                  height={36}
                  className="object-contain"
                />
              </div>
              <span className="text-lg font-extrabold text-white">
                YugMinds
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-6">
              We build software, electronics, and machines — and teach
              students coding and robotics. Building tomorrow&apos;s
              industries.
            </p>
            <div className="flex items-center gap-3">
              {[
                { icon: <Facebook className="w-4 h-4" />, label: "Facebook", hover: "hover:bg-blue-600" },
                { icon: <Instagram className="w-4 h-4" />, label: "Instagram", hover: "hover:bg-pink-500" },
                { icon: <Youtube className="w-4 h-4" />, label: "YouTube", hover: "hover:bg-red-500" },
              ].map((s) => (
                <motion.a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  whileHover={{ scale: 1.12, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-9 h-9 rounded-full bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center transition-colors hover:text-white hover:border-transparent ${s.hover}`}
                >
                  {s.icon}
                </motion.a>
              ))}
            </div>
          </Reveal>

          {cols.map((col, i) => (
            <Reveal key={col.heading} delay={0.1 + i * 0.08}>
              <h4 className="font-bold text-white text-sm mb-4">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="group inline-flex items-center text-slate-400 text-sm hover:text-white transition-colors"
                    >
                      <span className="relative">
                        {l}
                        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-blue-400 transition-all duration-300 group-hover:w-full" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        {/* Contact strip */}
        <Reveal>
          <div className="flex flex-col md:flex-row flex-wrap gap-3 md:gap-4 mb-10">
            {[
              { icon: <Mail className="w-3.5 h-3.5" />, text: "info@yugminds.org" },
              { icon: <Phone className="w-3.5 h-3.5" />, text: "+91 85003 45655" },
              { icon: <MapPin className="w-3.5 h-3.5" />, text: "Begumpet, Hyderabad, Telangana, India." },
            ].map((c) => (
              <span
                key={c.text}
                className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-full pl-2 pr-4 py-2 text-slate-300 text-sm"
              >
                <span className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                  {c.icon}
                </span>
                {c.text}
              </span>
            ))}
          </div>
        </Reveal>

        <hr className="border-white/10 mb-6" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-xs">
            © {new Date().getFullYear()} YugMinds Private Limited. All rights reserved.
          </p>
          <div className="flex gap-6 text-slate-400 text-xs">
            <a href="#" className="hover:text-white transition-colors">
              Terms &amp; Conditions
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   PAGE EXPORT
───────────────────────────────────────────── */
export default function YugmindsHomePage() {
  return (
    <div className="min-h-screen scroll-smooth">
      <ScrollProgressBar />
      <BrandSwitcherBar />
      <YugmindsNavbar />
      <HeroSection />
      <FeaturesSection />
      <DivisionsSection />
      <AboutSection />
      <StatsSection />
      <StoriesSection />
      <LeadershipSection />
      <YugmindsFooter />
    </div>
  );
}
