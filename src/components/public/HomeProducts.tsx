import Link from "next/link";
import { Check } from "lucide-react";
import StudioCard from "./StudioCard";
import SimulatorCard from "./SimulatorCard";

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
        <circle r="15" className="pv-bot" />
        <circle r="4.5" cx="5" className="pv-bot-eye" />
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

const PRODUCTS = [
  {
    name: "Robotics Kit, ESP32 Edition",
    text: "A custom ESP32 board, sensors, motors and chassis with 40+ guided projects.",
    tags: ["40+ projects", "Block and C coding"],
    Art: KitArt,
    list: {
      title: "In the box",
      ordered: false,
      items: ["Custom ESP32 board", "Four kinds of sensor", "Motors, servo and chassis"],
    },
  },
  {
    name: "RoboCoders Play Kit",
    text: "Screen-free coding for young kids. Lay out direction cards and the robot follows.",
    tags: ["Screen-free", "Learn by playing"],
    Art: PlayArt,
    list: {
      title: "How it plays",
      ordered: true,
      items: ["Lay out the direction cards", "Place a card on the robot", "Watch it make the move"],
    },
  },
];

export default function HomeProducts() {
  return (
    <section className="rh-sec rh-wash" aria-labelledby="rh-products">
      <div className="rh-wrap">
        <div className="rh-head">
          <h2 id="rh-products">Software and kits for every age.</h2>
          <p className="rh-lede">Start on screen, test your circuit, build with hardware, or learn away from the screen.</p>
        </div>
        <div className="rh-pv-grid">
          <StudioCard />
          {PRODUCTS.map(({ name, text, tags, Art, list }) => {
            const List = list.ordered ? "ol" : "ul";
            return (
              <article key={name} className="rh-pv">
                <div className="rh-pv-art"><Art /></div>
                <div className="rh-pv-body">
                  <h3>{name}</h3>
                  <p>{text}</p>
                  <ul className="rh-tags">
                    {tags.map((t) => <li key={t} className="rh-tag">{t}</li>)}
                  </ul>
                  <div className="rh-pv-list">
                    <h4>{list.title}</h4>
                    <List className={list.ordered ? "rh-pv-steps" : "rh-sm-points"}>
                      {list.items.map((t, i) => (
                        <li key={t}><span>{list.ordered ? i + 1 : <Check size={14} aria-hidden="true" />}</span>{t}</li>
                      ))}
                    </List>
                  </div>
                </div>
              </article>
            );
          })}
          <SimulatorCard />
        </div>
        <p className="rh-more">
          <Link href="/robocoders/products" className="rh-link">Explore the products</Link>
        </p>
      </div>
    </section>
  );
}
