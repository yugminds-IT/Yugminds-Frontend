"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import { brandHref } from "@/lib/brand-host";
import JuniorArt from "./JuniorArt";
import { SimArt } from "./SimulatorCard";
import { StudioArt } from "./StudioCard";

export function KitArt() {
  return (
    <svg className="pv-svg" viewBox="0 0 300 200" aria-hidden="true">
      <rect className="pv-board" x="92" y="52" width="116" height="96" rx="10" />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <rect className="pv-pin" x={102 + i * 12} y="46" width="5" height="8" />
          <rect className="pv-pin" x={102 + i * 12} y="146" width="5" height="8" />
        </g>
      ))}
      <rect className="pv-chip" x="122" y="82" width="56" height="36" rx="5" />
      <text className="pv-chip-t" x="150" y="105" textAnchor="middle">ESP32</text>
      <path className="pv-wifi pv-wifi-1" d="M138 74 a16 16 0 0 1 24 0" />
      <path className="pv-wifi pv-wifi-2" d="M131 67 a26 26 0 0 1 38 0" />
      {/* traces flow from the chip out to the parts */}
      <path className="pv-trace" d="M92 100 H52 V60" />
      <path className="pv-trace" d="M208 100 H248 V70" />
      <path className="pv-trace" d="M150 148 V178 H250" />
      {/* ultrasonic sensor */}
      <g transform="translate(52 44)">
        <rect className="pv-part" x="-26" y="-14" width="52" height="28" rx="5" />
        <circle className="pv-eye" cx="-11" cy="0" r="8" /><circle className="pv-eye" cx="11" cy="0" r="8" />
      </g>
      {/* motor */}
      <g transform="translate(248 52)">
        <circle className="pv-part" r="20" />
        <g className="pv-spin"><path className="pv-spoke" d="M0 -13 V13 M-13 0 H13 M-9 -9 L9 9 M9 -9 L-9 9" /></g>
      </g>
      {/* led */}
      <g transform="translate(262 178)">
        <circle className="pv-part" r="14" /><circle className="pv-led" r="6" />
      </g>
      <text className="pv-cap" x="52" y="20" textAnchor="middle">Sensor</text>
      <text className="pv-cap" x="248" y="20" textAnchor="middle">Motor</text>
      <text className="pv-cap" x="196" y="196" textAnchor="middle">LED</text>
    </svg>
  );
}

const CARDS = [
  { dir: "up", x: 25 }, { dir: "right", x: 85 }, { dir: "right", x: 145 }, { dir: "down", x: 205 },
];
const ARROW: Record<string, string> = { up: "M0 8 V-8 M-6 -2 L0 -8 L6 -2", right: "M-8 0 H8 M2 -6 L8 0 L2 6", down: "M0 -8 V8 M-6 2 L0 8 L6 2" };

export function PlayArt() {
  return (
    <svg className="pv-svg" viewBox="0 0 300 200" aria-hidden="true">
      {/* the floor the robot walks on: 4 by 2 squares */}
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} className="pv-cell" x={40 + (i % 4) * 50} y={20 + Math.floor(i / 4) * 50} width="46" height="46" rx="7" />
      ))}
      <path className="pv-flag" d="M163 78 V102 M163 78 L181 85 L163 92" />
      <g className="pv-walker">
        <g transform="scale(.92)">
          <path className="pv-bot-line" d="M-3 -21 L-4 -27 M3 -21 L4 -27" />
          <circle className="pv-bot" r="14" cy="6" />
          <circle className="pv-bot-ring" r="7" cy="6" />
          <circle className="pv-bot-core" r="3" cy="6" />
          <path className="pv-bot" d="M-9 -7 A9 9 0 0 1 9 -7 Z" transform="translate(0 -4)" />
          <path className="pv-bot-band" d="M-9 -11 H9" />
          <circle className="pv-bot-eye" r="2.6" cx="2" cy="-14" />
        </g>
      </g>
      {/* direction cards laid out in order; each lights as the robot does it */}
      {CARDS.map(({ dir, x }, i) => (
        <g key={i} className="pv-card" style={{ "--i": i } as React.CSSProperties} transform={`translate(${x + 25} 160)`}>
          <rect x="-26" y="-24" width="52" height="48" rx="9" />
          <path d={ARROW[dir]} />
        </g>
      ))}
    </svg>
  );
}


const STUDIO_URL = "https://rcstudio.yugminds.org";
const DWELL_MS = 5200; // a little over one full 5s loop of each product's animation
const RESUME_MS = 12000;

// Ordered from the youngest learners up, so the list reads as a ladder: screen-free, no-code, hardware, then software.
const LADDER = [
  {
    id: "play",
    name: "RoboCoders Play Kit",
    kind: "Kit",
    who: "Young kids",
    text: "Screen-free coding for young kids. Lay out direction cards and the robot follows.",
    tags: ["Screen-free", "Learn by playing"],
    Art: PlayArt,
    list: { title: "How it plays", ordered: true, items: ["Lay out the direction cards", "Place a card on the robot", "Watch it make the move"] },
    href: "/robocoders/products#play-kit",
    cta: "See the Play Kit",
  },
  {
    id: "junior",
    name: "Junior Robotics Kit",
    kind: "Kit",
    who: "Grades 1 to 3",
    text: "No-code robotics. Press a button and make lights and sounds happen.",
    tags: ["Grades 1 to 3", "No code needed"],
    Art: JuniorArt,
    list: { title: "How it works", ordered: true, items: ["Plug the button in", "Plug a light or buzzer in", "Press and watch it work"] },
    href: "/robocoders/products#junior-kit",
    cta: "Try it on the board",
  },
  {
    id: "esp32",
    name: "Robotics Kit, ESP32 Edition",
    kind: "Kit",
    who: "Grades 4 to 12",
    text: "A custom ESP32 board, sensors, motors and chassis with 40+ guided projects.",
    tags: ["40+ projects", "Block and C coding"],
    Art: KitArt,
    list: { title: "What students do", ordered: false, items: ["Build a robot that moves", "Add sensors that react", "Code it in blocks or C"] },
    href: "/robocoders/products#robotics-kit",
    cta: "See the robotics kit",
  },
  {
    id: "studio",
    name: "RoboCoders Studio",
    kind: "Software",
    who: "Ages 8+",
    text: "Software for block coding, Python, AI experiments and robot control.",
    tags: ["Ages 8+", "Works offline", "For schools"],
    Art: () => <StudioArt v="school" />,
    list: { title: "Where it runs", ordered: false, items: ["At school, offline, with no internet needed", "At home, online, for extra practice"] },
    href: "/robocoders/products#studio",
    cta: "See Studio",
    extra: { href: STUDIO_URL, label: "Open Studio online" },
  },
  {
    id: "sim",
    name: "RoboCoders Simulator",
    kind: "Software",
    who: "New",
    isNew: true,
    text: "Wire circuits on a virtual ESP32 and breadboard, and test them before you build.",
    tags: ["Virtual ESP32", "Same pins as the real board"],
    Art: SimArt,
    list: { title: "Why use it", ordered: false, items: ["LEDs, buttons, sensors and motors to wire up", "Live pin readings, so mistakes show before a part burns"] },
    href: "/robocoders/contact",
    cta: "Get early access",
    primary: true,
  },
] as const;

/* The products as an age ladder: the list runs from the youngest kit up to the software, and the stage shows the picked
   one with its own animation. The ladder moves on by itself while on screen (the bar on the open row shows when);
   picking a product holds it and the turns resume after a pause. Reduced motion never advances. */
export default function HomeProducts() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const N = LADDER.length;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (still || picked || !inView) return;
    const id = setTimeout(() => setI((n) => (n + 1) % N), DWELL_MS);
    return () => clearTimeout(id);
  }, [i, still, picked, inView, N]);
  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, i]);

  const p = LADDER[i];
  const List = p.list.ordered ? "ol" : "ul";
  const Art = p.Art;
  const href = p.href.startsWith("/robocoders/contact") ? brandHref(p.href) : p.href;

  return (
    <section className="rh-sec rh-wash" aria-labelledby="rh-products">
      <div className="rh-wrap">
        <div className="rh-head">
          <h2 id="rh-products">Software and kits for every age.</h2>
          <p className="rh-lede">Start on screen, test your circuit, build with hardware, or learn away from the screen.</p>
        </div>

        <div className="ph" ref={box}>
          <ol className="ph-ladder" aria-label="Products, from the youngest learners up" style={{ "--ms": `${DWELL_MS}ms` } as React.CSSProperties}>
            {LADDER.map((x, k) => (
              <li key={x.id} data-state={k < i ? "done" : k === i ? "active" : "todo"}>
                <button type="button" aria-pressed={k === i} onClick={() => { setPicked(true); setI(k); }}>
                  <span className="ph-dot" aria-hidden="true" />
                  <span className="ph-row">
                    <b>{x.name}{"isNew" in x && x.isNew ? <em>New</em> : null}</b>
                    <small>{x.who}<i aria-hidden="true" />{x.kind}</small>
                  </span>
                </button>
                {k === i && !still && !picked && inView && <i className="of-bar" aria-hidden="true" />}
              </li>
            ))}
          </ol>

          <article className="ph-stage" key={p.id} aria-live="polite">
            <div className="rh-pv-art ph-art"><Art /></div>
            <div className="ph-body">
              <h3>{p.name}</h3>
              <p>{p.text}</p>
              <ul className="rh-tags">{p.tags.map((t) => <li key={t} className="rh-tag">{t}</li>)}</ul>
              <div className="rh-pv-list">
                <h4>{p.list.title}</h4>
                <List className={p.list.ordered ? "rh-pv-steps" : "rh-sm-points"}>
                  {p.list.items.map((t, k) => (
                    <li key={t}><span>{p.list.ordered ? k + 1 : <Check size={14} aria-hidden="true" />}</span>{t}</li>
                  ))}
                </List>
              </div>
              <div className="ph-act">
                <Link href={href} className={`rh-btn ${"primary" in p && p.primary ? "rh-btn--primary" : "rh-btn--ghost"}`}>{p.cta}</Link>
                {"extra" in p && p.extra && (
                  <a className="rh-link pv-open" href={p.extra.href} target="_blank" rel="noopener noreferrer">{p.extra.label} <ExternalLink size={14} aria-hidden="true" /></a>
                )}
              </div>
            </div>
          </article>
        </div>

        <p className="rh-more">
          <Link href="/robocoders/products" className="rh-link">Explore the products</Link>
        </p>
      </div>
    </section>
  );
}
