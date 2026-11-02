import Link from "next/link";
import { Check } from "lucide-react";
import { brandHref } from "@/lib/brand-host";

const POINTS = [
  "LEDs, buttons, sensors and motors to wire up",
  "Live pin readings, so mistakes show before a part burns",
  "Same pins as the real board",
];
const PINS = [["3V3", 40], ["GPIO 2", 70], ["GPIO 4", 100], ["GPIO 5", 130], ["GND", 160]] as const;

/* The Simulator running its Button program: pressing the button drives GPIO 2 high and lights the LED. One 6s loop
   keeps the button, LED and current in step. */
export function SimArt() {
  return (
    <div className="sm-win" aria-hidden="true">
      <em className="sm-run">Running</em>
      <svg viewBox="0 0 300 190" className="sm-svg">
        <rect className="sm-board" x="6" y="14" width="64" height="162" rx="6" />
        <rect className="sm-chip" x="14" y="24" width="26" height="26" rx="3" />
        <text className="sm-pin-t" x="22" y="100" transform="rotate(-90 22 100)">ESP32</text>
        {PINS.map(([l, y]) => (
          <g key={l}>
            <rect className="sm-pin" x="68" y={y - 3} width="6" height="6" />
            <text className="sm-pin-t" x="64" y={y + 3} textAnchor="end">{l}</text>
          </g>
        ))}
        <rect className="sm-bread" x="96" y="14" width="196" height="162" rx="8" />
        <rect className="sm-rail" x="104" y="150" width="180" height="5" rx="2" />
        {/* wires: 3V3 to button, GPIO 4 to button, GPIO 2 to resistor to LED, LED to the ground rail */}
        <path className="sm-w sm-w-red" d="M74 40 H196 V96" />
        <path className="sm-w sm-w-yel" d="M74 100 H168" />
        <path className="sm-w sm-w-grn" d="M74 70 H130" />
        <path className="sm-flow" d="M74 70 H130 M196 70 H236" />
        <rect className="sm-res" x="130" y="64" width="40" height="12" rx="6" />
        <path className="sm-w sm-w-grey" d="M170 70 H236" />
        <path className="sm-w sm-w-blk" d="M236 82 V150" />
        <circle className="sm-glow" cx="236" cy="70" r="22" />
        <circle className="sm-led" cx="236" cy="70" r="11" />
        <rect className="sm-btn" x="168" y="96" width="36" height="36" rx="6" />
        <circle className="sm-cap" cx="186" cy="114" r="10" />
      </svg>
    </div>
  );
}

export default function SimulatorCard() {
  return (
    <article className="rh-pv rh-sm">
      <div className="rh-pv-art"><SimArt /></div>
      <div className="rh-pv-body">
        <h3>RoboCoders Simulator <span className="rh-sm-new">New</span></h3>
        <p>Wire circuits on a virtual ESP32 and breadboard, and test them before you build.</p>
        <ul className="rh-sm-points">
          {POINTS.map((t) => (
            <li key={t}><span><Check size={14} aria-hidden="true" /></span>{t}</li>
          ))}
        </ul>
        <Link href={brandHref("/robocoders/contact")} className="rh-btn rh-btn--primary rh-sm-cta">Get early access</Link>
      </div>
    </article>
  );
}
