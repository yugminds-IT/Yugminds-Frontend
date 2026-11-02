"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Route, Sun, Thermometer, ToggleRight, Waves, type LucideIcon } from "lucide-react";
import { RoboticsSim } from "./HomeProgramsLab";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

/* A looping progress value in 0..1 for a simulation. When it is not running it rests on a finished frame. */
function useLoop(period: number, run: boolean, rest: number) {
  const [p, setP] = useState(rest);
  useEffect(() => {
    if (!run) { setP(rest); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (n: number) => { setP(((n - t0) / period) % 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [period, run, rest]);
  return p;
}

type SimProps = { run: boolean };

/* Ultrasonic sensor: the robot drives at a wall, reads the distance, and turns away at 20 cm. */
function UltrasonicSim({ run }: SimProps) {
  const p = useLoop(7000, run, 0.8);
  const wall = 290;
  const drive = seg(p, 0, 0.55);
  const turn = seg(p, 0.55, 0.72);
  const climb = seg(p, 0.72, 1);
  const x = lerp(40, 226, drive);
  const y = lerp(120, 40, climb);
  const ang = -90 * turn;
  const cm = Math.max(18, Math.round((wall - (x + 16)) / 2.2));
  const phase = p < 0.55 ? "Driving forward" : p < 0.72 ? "Obstacle at 20 cm: turning" : "Path clear";
  return (
    <div className="sim kl-sim">
      <svg className="sim-stage" viewBox="0 0 320 200" aria-hidden="true">
        <rect className="sim-floor" x="1" y="1" width="318" height="198" rx="14" />
        <rect className="kl-wall" x="290" y="20" width="14" height="160" rx="4" />
        <g transform={`translate(${x} ${y}) rotate(${ang})`} className="kl-bot">
          {p < 0.55 && <path className="kl-beam" d="M16 0 L120 -34 A120 120 0 0 1 120 34 Z" style={{ opacity: 0.12 + 0.12 * Math.sin(p * 90) ** 2 }} />}
          <rect x="-16" y="-12" width="32" height="24" rx="5" />
          <circle className="kl-eye" cx="14" cy="-6" r="4" /><circle className="kl-eye" cx="14" cy="6" r="4" />
          <rect className="kl-wheel" x="-11" y="-15" width="14" height="4" rx="2" /><rect className="kl-wheel" x="-11" y="11" width="14" height="4" rx="2" />
        </g>
      </svg>
      <div className="sim-hud" aria-hidden="true">
        <p>{phase}</p>
        <dl>
          <div><dt>Distance</dt><dd className="kl-num">{p < 0.72 ? cm : "--"} cm</dd></div>
          <div><dt>Motors</dt><dd className="bar"><b style={{ transform: `scaleX(${p < 0.55 ? 0.8 : p < 0.72 ? 0.1 : 0.7})` }} /></dd></div>
          <div><dt>Buzzer</dt><dd><i data-on={p >= 0.55 && p < 0.66} /></dd></div>
        </dl>
      </div>
    </div>
  );
}

/* LDR: a lamp moves up and down, the light reading rises when the robot faces it, and the robot turns to follow. */
function LightSim({ run }: SimProps) {
  const p = useLoop(8000, run, 0.15);
  const lamp = (q: number) => 100 + 62 * Math.sin(q * Math.PI * 2);
  const heading = (q: number) => (Math.atan2(lamp(q) - 100, 230 - 100) * 180) / Math.PI;
  const ang = heading(p - 0.05); // the robot lags a little behind the lamp
  const diff = Math.abs(heading(p) - ang);
  const light = Math.round(100 * Math.max(0, Math.cos((diff * Math.PI) / 180)));
  const dir = heading(p) - ang;
  const say = dir > 3 ? "Turning down" : dir < -3 ? "Turning up" : "Facing the light";
  return (
    <div className="sim kl-sim">
      <svg className="sim-stage" viewBox="0 0 320 200" aria-hidden="true">
        <rect className="sim-floor" x="1" y="1" width="318" height="198" rx="14" />
        <circle className="kl-halo" cx="230" cy={lamp(p)} r="30" />
        <circle className="kl-lamp" cx="230" cy={lamp(p)} r="11" />
        <g transform={`translate(100 100) rotate(${ang})`} className="kl-bot">
          <rect x="-16" y="-12" width="32" height="24" rx="5" />
          <circle className="kl-eye" cx="14" cy="-6" r="4" /><circle className="kl-eye" cx="14" cy="6" r="4" />
          <rect className="kl-wheel" x="-11" y="-15" width="14" height="4" rx="2" /><rect className="kl-wheel" x="-11" y="11" width="14" height="4" rx="2" />
        </g>
      </svg>
      <div className="sim-hud" aria-hidden="true">
        <p>{say}</p>
        <dl>
          <div><dt>Light</dt><dd className="kl-num">{light}%</dd></div>
          <div><dt>Left motor</dt><dd className="bar"><b style={{ transform: `scaleX(${clamp(0.6 + dir / 40, 0.15, 1)})` }} /></dd></div>
          <div><dt>Right motor</dt><dd className="bar"><b style={{ transform: `scaleX(${clamp(0.6 - dir / 40, 0.15, 1)})` }} /></dd></div>
        </dl>
      </div>
    </div>
  );
}

/* DHT11: temperature climbs and falls; above 30 C the fan switches on and spins faster the hotter it gets. */
function FanSim({ run }: SimProps) {
  const p = useLoop(8000, run, 0.5);
  const temp = (q: number) => 24 + 10 * (1 - Math.abs(2 * q - 1));
  const t = temp(p);
  let angle = 0;
  for (let i = 0; i < 80; i += 1) { const q = (i / 80) * p; angle += Math.max(0, temp(q) - 29) * (p / 80) * 1400; }
  const on = t >= 30;
  return (
    <div className="sim kl-sim">
      <svg className="sim-stage" viewBox="0 0 320 200" aria-hidden="true">
        <rect className="sim-floor" x="1" y="1" width="318" height="198" rx="14" />
        <rect className="kl-tube" x="52" y="24" width="18" height="140" rx="9" />
        <rect className="kl-hg" x="56" y={164 - ((t - 22) / 14) * 132} width="10" height={((t - 22) / 14) * 132} rx="5" data-hot={on} />
        <circle className="kl-hgbulb" cx="61" cy="172" r="15" data-hot={on} />
        <g transform="translate(200 100)">
          <circle className="kl-fanring" r="64" />
          <g transform={`rotate(${angle})`} className="kl-blades" data-on={on}>
            {[0, 90, 180, 270].map((a) => <path key={a} transform={`rotate(${a})`} d="M0 0 C 10 -14 14 -44 0 -58 C -14 -44 -10 -14 0 0 Z" />)}
          </g>
          <circle className="kl-hub" r="8" />
        </g>
      </svg>
      <div className="sim-hud" aria-hidden="true">
        <p>{on ? "Too warm: fan on" : "Comfortable: fan off"}</p>
        <dl>
          <div><dt>Temperature</dt><dd className="kl-num">{t.toFixed(0)} °C</dd></div>
          <div><dt>Humidity</dt><dd className="kl-num">52 %</dd></div>
          <div><dt>Fan</dt><dd><i data-on={on} /></dd></div>
        </dl>
      </div>
    </div>
  );
}

/* Servo: a car approaches a toll gate, the sensor sees it, the servo lifts the arm, and it closes behind the car. */
function GateSim({ run }: SimProps) {
  const p = useLoop(7000, run, 0.55);
  const car = lerp(-30, 340, p);
  const open = seg(car, 90, 140) * (1 - seg(car, 215, 265));
  const angle = -80 * open;
  const sees = car > 80 && car < 230;
  return (
    <div className="sim kl-sim">
      <svg className="sim-stage" viewBox="0 0 320 200" aria-hidden="true">
        <rect className="sim-floor" x="1" y="1" width="318" height="198" rx="14" />
        <rect className="kl-road" x="0" y="118" width="320" height="30" />
        <rect className="kl-post" x="170" y="96" width="14" height="52" rx="3" />
        <g transform={`translate(177 104) rotate(${angle})`}><rect className="kl-arm" x="-4" y="-4" width="100" height="8" rx="3" /></g>
        <g transform={`translate(${car} 120)`} className="kl-car">
          <rect x="0" y="-6" width="46" height="18" rx="5" /><rect x="10" y="-16" width="24" height="12" rx="4" />
          <circle className="kl-wheel2" cx="10" cy="13" r="6" /><circle className="kl-wheel2" cx="36" cy="13" r="6" />
        </g>
      </svg>
      <div className="sim-hud" aria-hidden="true">
        <p>{open > 0.5 ? "Gate open: car passes" : sees ? "Car detected" : "Gate closed"}</p>
        <dl>
          <div><dt>Sensor</dt><dd><i data-on={sees} /></dd></div>
          <div><dt>Servo</dt><dd className="kl-num">{Math.round(Math.abs(angle) * 1.12)}°</dd></div>
        </dl>
      </div>
    </div>
  );
}

type Item = { name: string; Icon: LucideIcon; use: string; project: string; also: string; Sim: React.ComponentType<SimProps> };
const ITEMS: Item[] = [
  { name: "IR sensors", Icon: Route, use: "Line following, edge detection and maze solving.", project: "Line follower", also: "Table-edge detector, maze solvers", Sim: RoboticsSim as unknown as React.ComponentType<SimProps> },
  { name: "Ultrasonic sensor", Icon: Waves, use: "Obstacle avoiding, object following and distance meters.", project: "Obstacle avoider", also: "Object follower, distance-measuring robot", Sim: UltrasonicSim },
  { name: "LDR light sensor", Icon: Sun, use: "Light-following robots and light alerts.", project: "Light follower", also: "Light follower with buzzer, obstacle and light follower", Sim: LightSim },
  { name: "DHT11 sensor", Icon: Thermometer, use: "Temperature and humidity monitoring, smart fans.", project: "Smart fan", also: "Temperature-monitoring bot, fire control", Sim: FanSim },
  { name: "Servo motor", Icon: ToggleRight, use: "Toll gates, switches and small robotic arms.", project: "Toll gate", also: "Switch-on using a servo", Sim: GateSim },
];
const DWELL = 9;
const RESUME_MS = 12000; // how long switching waits after someone picks a part

/* Pick a part from the kit and watch the project it makes possible, run live: the sensor readings, motor levels and
   outputs are computed from the simulation, not drawn on a loop. The parts take turns while on screen (the bar shows
   when), a click picks one and switching resumes after a pause, and the button holds it. Reduced motion shows each simulation's resting frame. */
export default function KitLab() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // after a click the switching waits a while, then carries on by itself
  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, active]);

  const cur = ITEMS[active];
  const Sim = cur.Sim;
  const auto = !picked && !still;
  const run = inView && !still;

  return (
    <div className="kl" ref={box}>
      <div className="pg-tabs" role="tablist" aria-label="Kit parts" aria-orientation="vertical">
        {ITEMS.map(({ name, Icon, use }, i) => (
          <button key={name} type="button" role="tab" id={`kl-tab-${i}`} aria-selected={active === i} aria-controls="kl-panel" tabIndex={active === i ? 0 : -1} onClick={() => { setPicked(true); setActive(i); }}>
            <span className="rh-chip-ico"><Icon size={18} aria-hidden="true" /></span>
            <h3>{name}</h3>
            <p>{use}</p>
            {active === i && auto && !paused && (
              <i key={`bar-${active}`} className="pg-tab-bar" style={{ animationDuration: `${DWELL}s`, animationPlayState: inView ? "running" : "paused" }} onAnimationEnd={() => setActive((a) => (a + 1) % ITEMS.length)} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      <div className="bs kl-bench" id="kl-panel" role="tabpanel" aria-labelledby={`kl-tab-${active}`}>
        <div className="bs-bar">
          <span>Project: {cur.project}</span>
          <em>Made with the {cur.name.toLowerCase()}</em>
        </div>
        <div className="kl-screen" key={active} role="img" aria-label={`${cur.project} simulation using the ${cur.name}.`}>
          <Sim run={run} />
        </div>
        <div className="bs-foot">
          <p className="sw-hint">Also with this part: {cur.also}.</p>
          <button type="button" className="bs-pause" aria-pressed={paused} aria-label={paused ? "Resume switching between parts" : "Pause switching between parts"} onClick={() => setPaused((x) => !x)}>
            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
