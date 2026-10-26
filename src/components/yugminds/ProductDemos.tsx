"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bell, CircleDot, Droplets, Lightbulb, Radar, Star, Sun, TrafficCone, type LucideIcon } from "lucide-react";

/*
  Hands-on demos for the products section, one per product. Each is small and
  self-contained, runs only when the visitor presses something, and cleans up
  its timers.
*/

const STAGE = "bg-[#0b1a45] p-4 text-white md:p-5";
const BTN = "min-h-10 px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400";
const BTN_LIGHT = `${BTN} bg-white text-ym-text hover:bg-blue-50 disabled:opacity-60`;
const BTN_DARK = `${BTN} bg-[#10245e] text-white hover:bg-[#16307a]`;

/* A timer list that's cleared on unmount or when a run restarts. */
function useTimers() {
  const ids = useRef<number[]>([]);
  useEffect(() => () => ids.current.forEach((t) => window.clearTimeout(t)), []);
  return {
    later: (fn: () => void, ms: number) => ids.current.push(window.setTimeout(fn, ms)),
    clear: () => {
      ids.current.forEach((t) => window.clearTimeout(t));
      ids.current = [];
    },
  };
}

/* ── Studio: a working mini RoboCoders Studio, laid out like the real app. ── */
type BlockKind = "move" | "turn" | "say" | "wait" | "ledOn" | "ledOff";
type Blk = { id: number; kind: BlockKind };
type Cat = "motion" | "looks" | "control" | "pins";
const CATS: { id: Cat; name: string; color: string; edge: string }[] = [
  { id: "motion", name: "Motion", color: "#4c97ff", edge: "#3373cc" },
  { id: "looks", name: "Looks", color: "#9966ff", edge: "#774dcb" },
  { id: "control", name: "Control", color: "#ffab19", edge: "#cf8b17" },
  { id: "pins", name: "ESP32", color: "#0fbd8c", edge: "#0b8e69" },
];
const BLOCKS: Record<BlockKind, { cat: Cat; before: string; value: string; after?: string; ms: number }> = {
  move: { cat: "motion", before: "move", value: "30", after: "steps", ms: 380 },
  turn: { cat: "motion", before: "turn", value: "90", after: "degrees", ms: 320 },
  say: { cat: "looks", before: "say", value: "Hello!", ms: 900 },
  wait: { cat: "control", before: "wait", value: "0.5", after: "seconds", ms: 500 },
  ledOn: { cat: "pins", before: "set LED on pin", value: "2", after: "to on", ms: 160 },
  ledOff: { cat: "pins", before: "set LED on pin", value: "2", after: "to off", ms: 160 },
};
const CAT = (c: Cat) => CATS.find((x) => x.id === c)!;
const START_BODY: BlockKind[] = ["ledOn", "move", "wait", "ledOff", "turn"];

/* One Scratch-style block: coloured, a darker lower edge, white value pills. */
function ScratchBlock({ kind, active = false }: { kind: BlockKind; active?: boolean }) {
  const b = BLOCKS[kind];
  const c = CAT(b.cat);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border-b-[3px] px-2 py-1 text-[12px] font-semibold text-white ${active ? "outline outline-[3px] outline-amber-300" : ""}`}
      style={{ background: c.color, borderColor: c.edge }}
    >
      {b.before}
      <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-700">{b.value}</span>
      {b.after}
    </span>
  );
}

export function StudioDemo() {
  const [cat, setCat] = useState<Cat>("pins");
  const [body, setBody] = useState<Blk[]>(() => START_BODY.map((kind, id) => ({ id, kind })));
  const nextId = useRef(START_BODY.length);
  const [times, setTimes] = useState(3);
  const [active, setActive] = useState<number | "hat" | "loop" | null>(null);
  const [led, setLed] = useState(false);
  const [sprite, setSprite] = useState({ x: 0, y: 0, dir: 90 });
  const [say, setSay] = useState<string | null>(null);
  const [device, setDevice] = useState<"none" | "connecting" | "connected">("none");
  const [upload, setUpload] = useState(-1); // -1 idle, 0..100 progress, 101 done
  const timers = useTimers();
  const running = active !== null;

  const stop = () => {
    timers.clear();
    setActive(null);
    setLed(false);
    setSay(null);
  };
  const run = () => {
    stop();
    setSprite({ x: 0, y: 0, dir: 90 });
    let t = 0;
    let s = { x: 0, y: 0, dir: 90 };
    timers.later(() => setActive("hat"), t);
    t += 250;
    for (let r = 0; r < times; r++) {
      timers.later(() => setActive("loop"), t);
      t += 120;
      for (const blk of body) {
        const def = BLOCKS[blk.kind];
        if (blk.kind === "move") {
          const rad = ((s.dir - 90) * Math.PI) / 180;
          s = { ...s, x: Math.max(-90, Math.min(90, s.x + Math.cos(rad) * 30)), y: Math.max(-58, Math.min(58, s.y - Math.sin(rad) * 30)) };
        } else if (blk.kind === "turn") s = { ...s, dir: (s.dir + 90) % 360 };
        const snap = s;
        timers.later(() => {
          setActive(blk.id);
          if (blk.kind === "ledOn") setLed(true);
          if (blk.kind === "ledOff") setLed(false);
          if (blk.kind === "say") setSay("Hello!");
          if (blk.kind === "move" || blk.kind === "turn") setSprite(snap);
        }, t);
        t += def.ms;
        if (blk.kind === "say") timers.later(() => setSay(null), t);
      }
    }
    timers.later(() => setActive(null), t);
  };
  const connect = () => {
    setDevice("connecting");
    timers.later(() => setDevice("connected"), 700);
  };
  const doUpload = () => {
    for (let i = 0; i <= 10; i++) timers.later(() => setUpload(i === 10 ? 101 : i * 10), i * 120);
  };

  return (
    <div className="overflow-hidden rounded-md bg-[#e9f0fb] text-ym-text">
      {/* Top bar, as in the app. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[#3d6ae0] px-3 py-2 text-white">
        <span className="font-acdisplay text-lg font-bold tracking-tight text-amber-300">ROBOCODERS</span>
        <span className="text-sm opacity-90 max-sm:hidden">File</span>
        <span className="text-sm opacity-90 max-sm:hidden">Edit</span>
        <button
          type="button"
          onClick={connect}
          disabled={device !== "none"}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-semibold outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <span className={`size-2.5 rounded-full ${device === "connected" ? "bg-emerald-300" : device === "connecting" ? "bg-amber-300" : "bg-white/40"}`} aria-hidden />
          {device === "connected" ? "ESP32 connected" : device === "connecting" ? "Connecting…" : "Connect ESP32"}
        </button>
        <button
          type="button"
          onClick={doUpload}
          disabled={device !== "connected" || (upload >= 0 && upload <= 100)}
          className="relative overflow-hidden rounded bg-white/15 px-2.5 py-1 text-sm font-semibold outline-none enabled:hover:bg-white/25 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {upload >= 0 && upload <= 100 && <span aria-hidden className="absolute inset-y-0 left-0 bg-emerald-400/40" style={{ width: `${upload}%` }} />}
          <span className="relative">{upload === 101 ? "Uploaded" : upload >= 0 ? `Uploading ${upload}%` : "Upload to board"}</span>
        </button>
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={run} aria-label="Run: green flag" className="grid size-8 place-items-center rounded outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-300">
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
              <path d="M5 3v18" stroke="#1f7a2e" strokeWidth="2" />
              <path d="M5 4c4-2 6 2 10 0s4-1 4-1v9s-1 1-4 1-6-2-10 0z" fill="#4cbf56" stroke="#1f7a2e" strokeWidth="1.2" />
            </svg>
          </button>
          <button type="button" onClick={stop} aria-label="Stop" className="grid size-8 place-items-center rounded outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-300">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" fill="#ec5959" stroke="#b84848" strokeWidth="1.2" />
            </svg>
          </button>
        </span>
      </div>

      <div className="grid md:grid-cols-[52px_minmax(0,150px)_minmax(0,1fr)_minmax(0,200px)]">
        {/* Categories. */}
        <div className="flex gap-1 bg-white p-1.5 md:flex-col" role="group" aria-label="Block categories">
          {CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
              className={`flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ym-blue max-md:flex-1 ${cat === c.id ? "bg-blue-50 text-ym-blue" : "text-slate-600"}`}
            >
              <span className="size-4 rounded-full border border-black/10" style={{ background: c.color }} aria-hidden />
              {c.name}
            </button>
          ))}
        </div>
        {/* Palette: click a block to add it to the program. */}
        <div className="flex flex-col gap-2 border-slate-200 bg-[#f9fbff] p-2.5 md:border-r">
          <p className="text-xs font-bold text-slate-700">{CAT(cat).name}</p>
          {(Object.keys(BLOCKS) as BlockKind[])
            .filter((k) => BLOCKS[k].cat === cat)
            .map((k) => (
              <button
                key={k}
                type="button"
                disabled={running || body.length >= 9}
                onClick={() => {
                  setBody((b) => [...b, { id: nextId.current, kind: k }]);
                  nextId.current += 1;
                }}
                aria-label={`Add block: ${BLOCKS[k].before} ${BLOCKS[k].value} ${BLOCKS[k].after ?? ""}`}
                className="w-fit rounded-[5px] outline-none transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ym-blue"
              >
                <ScratchBlock kind={k} />
              </button>
            ))}
          <p className="mt-auto pt-2 text-[11px] leading-snug text-slate-500">Click a block to add it.</p>
        </div>
        {/* Script area. */}
        <div className="min-w-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] p-3 [background-size:14px_14px]">
          <span className={`inline-flex rounded-t-[14px] rounded-b-[5px] border-b-[3px] px-2.5 pb-1 pt-2 text-[12px] font-semibold text-white ${active === "hat" ? "outline outline-[3px] outline-amber-300" : ""}`} style={{ background: "#ffbf00", borderColor: "#cc9900" }}>
            when green flag clicked
          </span>
          {/* repeat (C-block) */}
          <div className={`mt-0.5 w-fit min-w-[190px] rounded-[5px] ${active === "loop" ? "outline outline-[3px] outline-amber-300" : ""}`} style={{ background: "#ffab19" }}>
            <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] font-semibold text-white">
              repeat
              <span className="flex items-center rounded-full bg-white px-1 text-[11px] text-slate-700">
                <button type="button" aria-label="Repeat fewer times" disabled={running} onClick={() => setTimes((n) => Math.max(1, n - 1))} className="px-1 outline-none focus-visible:ring-2 focus-visible:ring-ym-blue">
                  −
                </button>
                <span className="w-3 text-center font-bold tabular-nums">{times}</span>
                <button type="button" aria-label="Repeat more times" disabled={running} onClick={() => setTimes((n) => Math.min(9, n + 1))} className="px-1 outline-none focus-visible:ring-2 focus-visible:ring-ym-blue">
                  +
                </button>
              </span>
            </div>
            <ol className="ml-3 flex min-h-8 flex-col gap-0.5 bg-[#e9f0fb] py-0.5 pl-0.5" aria-label="Blocks inside repeat">
              {body.length === 0 && <li className="px-1 py-1 text-[11px] text-slate-500">Add blocks from the palette</li>}
              {body.map((blk) => (
                <li key={blk.id} className="group flex items-center gap-1">
                  <ScratchBlock kind={blk.kind} active={active === blk.id} />
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => setBody((b) => b.filter((x) => x.id !== blk.id))}
                    aria-label={`Remove ${BLOCKS[blk.kind].before} block`}
                    className="grid size-5 place-items-center rounded text-xs text-slate-500 opacity-0 outline-none transition-opacity hover:text-red-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ym-blue group-hover:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
            <div className="h-3" />
          </div>
        </div>
        {/* Stage: the robot sprite and the board's LED. */}
        <div className="flex flex-col gap-2 border-slate-200 bg-[#f4f8ff] p-2.5 md:border-l">
          <div className="relative aspect-[4/3] overflow-hidden rounded bg-white" role="img" aria-label={`Stage: the robot is at x ${Math.round(sprite.x)}, y ${Math.round(sprite.y)}, facing ${sprite.dir} degrees. The LED is ${led ? "on" : "off"}.`}>
            <span className="absolute inset-0 bg-[linear-gradient(#eef2f7_1px,transparent_1px),linear-gradient(90deg,#eef2f7_1px,transparent_1px)] [background-size:16px_16px]" aria-hidden />
            <span
              className="absolute grid h-[22px] w-[30px] place-items-center rounded-[5px] bg-ym-blue transition-all duration-300"
              style={{ left: `calc(50% + ${sprite.x * 0.5}% - 15px)`, top: `calc(50% - ${sprite.y * 0.65}% - 11px)`, transform: `rotate(${sprite.dir - 90}deg)` }}
              aria-hidden
            >
              <span className="absolute -inset-x-0.5 -top-1 h-1 rounded-sm bg-slate-800" />
              <span className="absolute -inset-x-0.5 -bottom-1 h-1 rounded-sm bg-slate-800" />
              <span className="absolute right-0.5 top-1 size-1.5 rounded-full bg-white" />
              <span className="absolute bottom-1 right-0.5 size-1.5 rounded-full bg-white" />
            </span>
            {say && (
              <span className="absolute rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold" style={{ left: `calc(50% + ${sprite.x * 0.5}% + 10px)`, top: `calc(50% - ${sprite.y * 0.65}% - 34px)` }}>
                {say}
              </span>
            )}
            <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 rounded bg-[#1e40af] px-1.5 py-1 text-[10px] font-bold text-blue-100">
              ESP32
              {/* The glow is the LED's light, not a decorative shadow. taste-skill-ignore */}
              <span aria-hidden className={`size-2.5 rounded-full transition-all duration-100 ${led ? "bg-amber-300 shadow-[0_0_10px_3px_rgba(252,211,77,0.8)]" : "bg-amber-900/60"}`} />
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-1 text-center text-[11px]">
            {[
              ["x", Math.round(sprite.x)],
              ["y", Math.round(sprite.y)],
              ["direction", sprite.dir],
            ].map(([k, v]) => (
              <div key={k} className="rounded bg-white py-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] leading-snug text-slate-600" aria-live="polite">
            {upload === 101
              ? "Uploaded. The robot now runs this on its own, no computer needed."
              : running
                ? "Running…"
                : device === "connected"
                  ? "Board connected. Press Upload to send the program to it."
                  : "Press the green flag to run it here."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Simulator: a Tinkercad-style circuit simulator for the ESP32 board. ──
   Parts sit on a breadboard, each wired to a fixed pin. An example program runs
   on a 50 ms tick: it reads the button and potentiometer, drives the LED and
   buzzer, logs to a serial monitor, and catches mistakes (a missing part, an
   LED with no resistor drawing more than a pin can give). */
type Part = "led" | "button" | "buzzer" | "pot";
type Prog = "button" | "blink" | "dimmer" | "alarm";
const PART_INFO: Record<Part, { name: string; pin: string }> = {
  led: { name: "LED", pin: "GPIO 2" },
  button: { name: "Push button", pin: "GPIO 4" },
  buzzer: { name: "Buzzer", pin: "GPIO 5" },
  pot: { name: "Potentiometer", pin: "GPIO 34" },
};
const PROGRAMS: Record<Prog, { name: string; needs: Part[]; code: string[] }> = {
  button: {
    name: "Button",
    needs: ["led", "button"],
    code: ["void loop() {", "  if (digitalRead(4) == HIGH) {", "    digitalWrite(2, HIGH);", "  } else {", "    digitalWrite(2, LOW);", "  }", "}"],
  },
  blink: {
    name: "Blink",
    needs: ["led"],
    code: ["void loop() {", "  digitalWrite(2, HIGH);", "  delay(500);", "  digitalWrite(2, LOW);", "  delay(500);", "}"],
  },
  dimmer: {
    name: "Dimmer",
    needs: ["led", "pot"],
    code: ["void loop() {", "  int value = analogRead(34);", "  analogWrite(2, value / 16);", "  Serial.println(value);", "  delay(200);", "}"],
  },
  alarm: {
    name: "Alarm",
    needs: ["led", "button", "buzzer"],
    code: ["void loop() {", "  if (digitalRead(4) == HIGH) {", "    digitalWrite(2, HIGH);", "    tone(5, 880, 150);", "    delay(150);", "    digitalWrite(2, LOW);", "    delay(150);", "  }", "}"],
  },
};
const PIN_LIMIT_MA = 40;
const LED_MA_WITH_RESISTOR = 6.8; // (3.3 V - 1.8 V) / 220 Ω
const LED_MA_NO_RESISTOR = 68;

export function SimulatorDemo() {
  const [parts, setParts] = useState<Part[]>(["led", "button"]);
  const [resistor, setResistor] = useState(true);
  const [prog, setProg] = useState<Prog>("button");
  const [running, setRunning] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [pot, setPot] = useState(60);
  const [out, setOut] = useState({ led: 0, buzz: false, ma: 0 });
  const [burnt, setBurnt] = useState(false);
  const [serial, setSerial] = useState<string[]>(["Ready. Press Start simulation."]);
  const live = useRef({ parts, resistor, prog, pressed, pot, burnt });
  useEffect(() => {
    live.current = { parts, resistor, prog, pressed, pot, burnt };
  }, [parts, resistor, prog, pressed, pot, burnt]);

  const log = (line: string) => setSerial((s) => (s[s.length - 1] === line ? s : [...s.slice(-5), line]));

  // The simulation loop.
  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    let overSince = 0;
    let lastPressed: boolean | null = null;
    let lastPotLog = 0;
    let warned = false;
    const id = window.setInterval(() => {
      const L = live.current;
      const t = performance.now() - started;
      const missing = PROGRAMS[L.prog].needs.filter((p) => !L.parts.includes(p));
      if (missing.length) {
        if (!warned) log(`Nothing on ${PART_INFO[missing[0]].pin}: add the ${PART_INFO[missing[0]].name.toLowerCase()}.`);
        warned = true;
        setOut({ led: 0, buzz: false, ma: 0 });
        return;
      }
      warned = false;
      let led = 0;
      let buzz = false;
      if (L.prog === "button") led = L.pressed ? 1 : 0;
      if (L.prog === "blink") led = Math.floor(t / 500) % 2 === 0 ? 1 : 0;
      if (L.prog === "dimmer") led = L.pot / 100;
      if (L.prog === "alarm" && L.pressed) {
        led = Math.floor(t / 150) % 2 === 0 ? 1 : 0;
        buzz = led === 1;
      }
      if (L.pressed !== lastPressed && L.parts.includes("button")) {
        if (lastPressed !== null || L.pressed) log(`GPIO 4 ${L.pressed ? "HIGH: button pressed" : "LOW: button released"}`);
        lastPressed = L.pressed;
      }
      if (L.prog === "dimmer" && t - lastPotLog > 600) {
        lastPotLog = t;
        log(`analogRead(34) = ${Math.round((L.pot / 100) * 4095)}`);
      }
      if (L.burnt) led = 0;
      const ma = led * (L.resistor ? LED_MA_WITH_RESISTOR : LED_MA_NO_RESISTOR);
      if (ma > PIN_LIMIT_MA) {
        overSince = overSince || t;
        if (t - overSince > 500 && !L.burnt) {
          setBurnt(true);
          log(`LED burnt out: ${LED_MA_NO_RESISTOR} mA is over the ${PIN_LIMIT_MA} mA a pin can give.`);
        }
      } else overSince = 0;
      setOut({ led, buzz, ma });
    }, 50);
    return () => window.clearInterval(id);
  }, [running]);

  const toggleRun = () => {
    if (running) {
      setRunning(false);
      setOut({ led: 0, buzz: false, ma: 0 });
      setPressed(false);
      log("Simulation stopped.");
    } else {
      setRunning(true);
      log(`Running ${PROGRAMS[prog].name.toLowerCase()} program…`);
    }
  };
  const togglePart = (p: Part) => setParts((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]));
  const has = (p: Part) => parts.includes(p);
  const ledOn = running && out.led > 0 && !burnt;
  const over = out.ma > PIN_LIMIT_MA;

  return (
    <div className="overflow-hidden rounded-md bg-[#eef2f7] text-ym-text">
      {/* Top bar. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2">
        <span className="font-acdisplay text-base font-bold text-ym-blue">RoboCoders Simulator</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Example program">
          {(Object.keys(PROGRAMS) as Prog[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={prog === p}
              onClick={() => {
                setProg(p);
                log(`Loaded the ${PROGRAMS[p].name.toLowerCase()} program.`);
              }}
              className={`rounded px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ym-blue ${prog === p ? "bg-ym-blue text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {PROGRAMS[p].name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleRun}
          className={`ml-auto rounded px-3 py-1.5 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-ym-blue ${running ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
        >
          {running ? "Stop simulation" : "Start simulation"}
        </button>
      </div>

      <div className="grid md:grid-cols-[minmax(0,128px)_minmax(0,1fr)_minmax(0,210px)]">
        {/* Component library. */}
        <div className="flex flex-col gap-1.5 border-slate-200 bg-white p-2.5 md:border-r">
          <p className="text-xs font-bold text-slate-700">Components</p>
          {(Object.keys(PART_INFO) as Part[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={has(p)}
              onClick={() => togglePart(p)}
              className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ym-blue ${has(p) ? "bg-blue-50 text-ym-blue" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
            >
              <span>
                {PART_INFO[p].name}
                <span className="block text-[10px] font-normal text-slate-500">{PART_INFO[p].pin}</span>
              </span>
              <span aria-hidden className="text-sm">{has(p) ? "✓" : "+"}</span>
            </button>
          ))}
          <label className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={resistor}
              onChange={(e) => {
                setResistor(e.target.checked);
                log(e.target.checked ? "Added a 220 Ω resistor to the LED." : "Removed the LED's resistor.");
              }}
              className="accent-ym-blue"
            />
            220 Ω resistor
          </label>
          {burnt && (
            <button
              type="button"
              onClick={() => {
                setBurnt(false);
                log("Replaced the LED.");
              }}
              className="mt-1 rounded bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700 outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-ym-blue"
            >
              Replace the LED
            </button>
          )}
        </div>

        {/* Breadboard canvas. */}
        <div className="min-w-0 p-2.5">
          <svg viewBox="0 0 520 300" className="block w-full" role="img" aria-label={`ESP32 on a breadboard with: ${parts.map((p) => PART_INFO[p].name).join(", ") || "no parts"}. The LED is ${burnt ? "burnt out" : ledOn ? "on" : "off"}.`}>
            <rect x="150" y="16" width="360" height="270" rx="6" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="150" y="262" width="360" height="12" fill="#dbeafe" />
            <line x1="160" y1="268" x2="500" y2="268" stroke="#1e293b" strokeWidth="2" />
            {Array.from({ length: 24 }, (_, i) =>
              [40, 56, 88, 104, 136, 152, 184, 200, 232].map((y) => <rect key={`${i}-${y}`} x={166 + i * 14} y={y} width="3" height="3" fill="#cbd5e1" />),
            )}
            {/* ESP32 */}
            <rect x="14" y="30" width="112" height="250" rx="6" fill="#1e40af" />
            <rect x="26" y="48" width="54" height="50" fill="#cbd5e1" />
            <text x="52" y="132" textAnchor="middle" fill="#dbeafe" fontSize="13" fontWeight="700">ESP32</text>
            {[
              ["3V3", 56],
              ["GPIO 2", 100],
              ["GPIO 4", 144],
              ["GPIO 5", 188],
              ["GPIO 34", 232],
              ["GND", 268],
            ].map(([label, y]) => (
              <g key={label as string}>
                <rect x="120" y={(y as number) - 4} width="8" height="8" fill="#d4af37" />
                <text x="116" y={(y as number) + 4} textAnchor="end" fill="#bfdbfe" fontSize="10">{label}</text>
              </g>
            ))}
            {/* LED on GPIO 2, through the resistor. */}
            {has("led") && (
              <g>
                <polyline points="128,100 210,100" fill="none" stroke="#22c55e" strokeWidth="3" />
                {resistor ? (
                  <g>
                    <rect x="210" y="93" width="44" height="14" rx="6" fill="#e7c9a0" />
                    {[218, 227, 236, 245].map((x, i) => (
                      <rect key={x} x={x} y="93" width="3.5" height="14" fill={["#ef4444", "#ef4444", "#78350f", "#d4af37"][i]} />
                    ))}
                  </g>
                ) : (
                  <line x1="210" y1="100" x2="254" y2="100" stroke="#22c55e" strokeWidth="3" />
                )}
                <line x1="254" y1="100" x2="292" y2="100" stroke="#94a3b8" strokeWidth="2.5" />
                {ledOn && <circle cx="300" cy="92" r={14 + out.led * 14} fill={`rgba(239,68,68,${0.15 + out.led * 0.3})`} />}
                <path d="M288 98 a12 12 0 0 1 24 0 v12 h-24 z" fill={burnt ? "#3f3f46" : ledOn ? `rgb(${200 + out.led * 55},${70 + out.led * 40},${70 + out.led * 40})` : "#7f1d1d"} />
                {burnt && <path d="M294 92 l5 5 l-4 4 l7 6" stroke="#18181b" strokeWidth="2" fill="none" />}
                <polyline points="306,110 306,268" fill="none" stroke="#1e293b" strokeWidth="2.5" />
              </g>
            )}
            {/* Push button on GPIO 4, from 3V3. */}
            {has("button") && (
              <g>
                <polyline points="128,56 140,56 140,132 222,132" fill="none" stroke="#ef4444" strokeWidth="3" />
                <polyline points="128,144 222,144" fill="none" stroke="#facc15" strokeWidth="3" />
                <g
                  role="button"
                  tabIndex={0}
                  aria-label="Push button on GPIO 4: hold to press"
                  aria-pressed={pressed}
                  onPointerDown={() => setPressed(true)}
                  onPointerUp={() => setPressed(false)}
                  onPointerLeave={() => pressed && setPressed(false)}
                  onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setPressed(true)}
                  onKeyUp={(e) => (e.key === " " || e.key === "Enter") && setPressed(false)}
                  className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-ym-blue"
                >
                  <rect x="218" y="118" width="40" height="40" rx="4" fill="#334155" stroke="transparent" strokeWidth="3" />
                  <circle cx="238" cy="138" r={pressed ? 9 : 11} fill={pressed ? "#64748b" : "#94a3b8"} />
                </g>
              </g>
            )}
            {/* Buzzer on GPIO 5. */}
            {has("buzzer") && (
              <g>
                <polyline points="128,188 380,188" fill="none" stroke="#a855f7" strokeWidth="3" />
                <circle cx="396" cy="188" r="16" fill="#111827" />
                <circle cx="396" cy="188" r="4" fill="#334155" />
                {running && out.buzz && (
                  <g fill="none" stroke="#a855f7" strokeWidth="2">
                    <path d="M418 176 q8 12 0 24" />
                    <path d="M426 170 q12 18 0 36" />
                  </g>
                )}
                <polyline points="396,204 396,268" fill="none" stroke="#1e293b" strokeWidth="2.5" />
              </g>
            )}
            {/* Potentiometer on GPIO 34. */}
            {has("pot") && (
              <g>
                <polyline points="128,232 300,232" fill="none" stroke="#0ea5e9" strokeWidth="3" />
                <rect x="300" y="218" width="44" height="28" rx="4" fill="#1d4ed8" />
                <g transform={`rotate(${-135 + pot * 2.7} 322 232)`}>
                  <circle cx="322" cy="232" r="10" fill="#e2e8f0" />
                  <line x1="322" y1="232" x2="322" y2="224" stroke="#1e293b" strokeWidth="2.5" />
                </g>
                <polyline points="344,232 360,232 360,268" fill="none" stroke="#1e293b" strokeWidth="2.5" />
              </g>
            )}
          </svg>
          {has("pot") && (
            <label className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-700">
              Potentiometer
              <input type="range" min={0} max={100} value={pot} onChange={(e) => setPot(Number(e.target.value))} className="w-full accent-ym-blue" />
              <span className="w-9 text-right tabular-nums">{pot}%</span>
            </label>
          )}
        </div>

        {/* Code and serial monitor. */}
        <div className="flex min-w-0 flex-col gap-2 border-slate-200 bg-white p-2.5 md:border-l">
          <p className="text-xs font-bold text-slate-700">Code</p>
          <pre className="overflow-x-auto rounded bg-[#0b1a45] p-2 font-mono text-[11px] leading-5 text-blue-100">{PROGRAMS[prog].code.join("\n")}</pre>
          <p className="text-xs font-bold text-slate-700">Serial monitor</p>
          <ol className="min-h-24 rounded bg-slate-900 p-2 font-mono text-[11px] leading-5 text-emerald-300" aria-live="polite">
            {serial.map((l, i) => (
              <li key={`${i}-${l}`} className={l.startsWith("LED burnt") || l.startsWith("Nothing on") ? "text-red-300" : ""}>
                {l}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Live readings. */}
      <dl className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 text-center sm:grid-cols-5">
        {[
          ["GPIO 2", !has("led") ? "–" : out.led === 0 ? "LOW" : out.led === 1 ? "HIGH" : `PWM ${Math.round(out.led * 100)}%`],
          ["GPIO 4", !has("button") ? "–" : pressed ? "HIGH" : "LOW"],
          ["GPIO 5", !has("buzzer") ? "–" : out.buzz ? "880 Hz" : "off"],
          ["GPIO 34", !has("pot") ? "–" : String(Math.round((pot / 100) * 4095))],
          ["LED current", `${out.ma.toFixed(1)} mA`],
        ].map(([k, v]) => (
          <div key={k} className={`px-1 py-1.5 ${k === "LED current" && over ? "bg-red-600 text-white" : "bg-white"}`}>
            <dt className={`text-[10px] ${k === "LED current" && over ? "text-red-100" : "text-slate-500"}`}>{k}</dt>
            <dd className="text-sm font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Robotics Kit: build a project. A simplified, drawn kit (not the real PCB):
   pick a project, plug the right modules into the board, then run it and play
   with the sensor. ── */
type ModId = "distance" | "light" | "soil" | "button" | "buzzer" | "led" | "traffic";
const MODS: Record<ModId, { name: string; kind: "in" | "out"; icon: LucideIcon }> = {
  distance: { name: "Ultrasonic sensor", kind: "in", icon: Radar },
  light: { name: "Light sensor", kind: "in", icon: Sun },
  soil: { name: "Soil sensor", kind: "in", icon: Droplets },
  button: { name: "Push button", kind: "in", icon: CircleDot },
  buzzer: { name: "Buzzer", kind: "out", icon: Bell },
  led: { name: "LED", kind: "out", icon: Lightbulb },
  traffic: { name: "Traffic light", kind: "out", icon: TrafficCone },
};
const KIT_PROJECTS: { id: string; name: string; needs: [ModId, ModId]; control: string; unit: string; min: number; max: number; start: number; rule: string }[] = [
  { id: "alarm", name: "Obstacle alarm", needs: ["distance", "buzzer"], control: "Distance to hand", unit: "cm", min: 5, max: 100, start: 60, rule: "Beeps when something is closer than 20 cm." },
  { id: "night", name: "Night light", needs: ["light", "led"], control: "Room light", unit: "%", min: 0, max: 100, start: 80, rule: "Turns the LED on when the room gets dark." },
  { id: "plant", name: "Plant alert", needs: ["soil", "buzzer"], control: "Soil moisture", unit: "%", min: 0, max: 100, start: 70, rule: "Beeps when the soil is too dry." },
  { id: "signal", name: "Traffic signal", needs: ["button", "traffic"], control: "", unit: "", min: 0, max: 0, start: 0, rule: "Press the button to change the light." },
];

export function KitDemo() {
  const [pi, setPi] = useState(0);
  const proj = KIT_PROJECTS[pi];
  const [plugged, setPlugged] = useState<ModId[]>([]);
  const [running, setRunning] = useState(false);
  const [value, setValue] = useState(proj.start);
  const [phase, setPhase] = useState(0); // traffic light: 0 red, 1 yellow, 2 green
  const [note, setNote] = useState("Plug in the two modules this project needs.");
  const [tick, setTick] = useState(0);

  const inMod = plugged.find((m) => MODS[m].kind === "in");
  const outMod = plugged.find((m) => MODS[m].kind === "out");
  const ready = proj.needs.every((m) => plugged.includes(m));

  // A slow tick drives the beeping and blinking while running.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 300);
    return () => window.clearInterval(id);
  }, [running]);

  const pickProject = (i: number) => {
    setPi(i);
    setPlugged([]);
    setRunning(false);
    setValue(KIT_PROJECTS[i].start);
    setPhase(0);
    setNote("Plug in the two modules this project needs.");
  };
  const plug = (m: ModId) => {
    if (running) return;
    if (plugged.includes(m)) {
      setPlugged((p) => p.filter((x) => x !== m));
      return;
    }
    if (!proj.needs.includes(m)) {
      setNote(`The ${MODS[m].name.toLowerCase()} isn't needed for the ${proj.name.toLowerCase()}.`);
      return;
    }
    const next = [...plugged.filter((x) => MODS[x].kind !== MODS[m].kind), m];
    setPlugged(next);
    setNote(proj.needs.every((x) => next.includes(x)) ? "All plugged in. Press Run." : `${MODS[m].name} plugged into the ${MODS[m].kind === "in" ? "input" : "output"} port.`);
  };

  // What the outputs are doing right now.
  const active =
    running &&
    ((proj.id === "alarm" && value < 20) || (proj.id === "night" && value < 30) || (proj.id === "plant" && value < 25));
  const blink = tick % 2 === 0;
  const buzzing = outMod === "buzzer" && active && blink;
  const ledOn = outMod === "led" && active;
  const status = !running
    ? note
    : proj.id === "signal"
      ? ["Red: stop", "Yellow: get ready", "Green: go"][phase]
      : active
        ? proj.id === "alarm"
          ? `Too close: ${value} cm. Beeping.`
          : proj.id === "night"
            ? "Dark. LED on."
            : "Soil is dry. Beeping."
        : "All clear.";

  return (
    <div className={STAGE}>
      {/* Projects. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick a project">
        {KIT_PROJECTS.map((p, i) => (
          <button key={p.id} type="button" aria-pressed={i === pi} onClick={() => pickProject(i)} className={`${BTN} min-h-9 ${i === pi ? "bg-white text-ym-text" : "bg-[#10245e] text-blue-100 hover:bg-[#16307a]"}`}>
            {p.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-blue-200">{proj.rule}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr]">
        {/* The board: a simplified drawing with one input and one output port. */}
        <svg viewBox="0 0 420 250" className="block w-full" role="img" aria-label={`A RoboCoders board. Input port: ${inMod ? MODS[inMod].name : "empty"}. Output port: ${outMod ? MODS[outMod].name : "empty"}.`}>
          <rect x="110" y="40" width="200" height="170" rx="14" fill="#1e40af" />
          <rect x="170" y="80" width="80" height="70" rx="6" fill="#0f172a" />
          <text x="210" y="120" textAnchor="middle" fill="#cbd5e1" fontSize="14" fontWeight="700">ESP32</text>
          {running && <circle cx="292" cy="58" r="5" fill={blink ? "#4ade80" : "#166534"} />}
          {/* Ports */}
          {[
            { x: 110, label: "Input", mod: inMod, side: -1 },
            { x: 310, label: "Output", mod: outMod, side: 1 },
          ].map((p) => (
            <g key={p.label}>
              <rect x={p.x - 10} y="105" width="20" height="40" rx="3" fill={p.mod ? "#facc15" : "#e2e8f0"} />
              <text x={p.x} y="168" textAnchor="middle" fill="#bfdbfe" fontSize="11" fontWeight="600">{p.label}</text>
              {p.mod && (
                <g>
                  <line x1={p.x + p.side * 10} y1="125" x2={p.x + p.side * 34} y2="125" stroke="#94a3b8" strokeWidth="4" />
                  <rect x={p.side < 0 ? 4 : 344} y="85" width="72" height="80" rx="8" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1.5" />
                  <text x={p.side < 0 ? 40 : 380} y="182" textAnchor="middle" fill="#dbeafe" fontSize="10" fontWeight="600">{MODS[p.mod].name}</text>
                </g>
              )}
            </g>
          ))}
          {/* Module faces and their live output. */}
          {inMod === "distance" && (
            <g>
              <circle cx="27" cy="125" r="13" fill="#cbd5e1" />
              <circle cx="53" cy="125" r="13" fill="#cbd5e1" />
              {running && <path d="M0 105 q-8 20 0 40" stroke="#60a5fa" strokeWidth="2" fill="none" opacity={blink ? 1 : 0.4} />}
            </g>
          )}
          {inMod === "light" && <circle cx="40" cy="125" r="16" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />}
          {inMod === "soil" && (
            <g fill="#d4af37">
              <rect x="26" y="110" width="8" height="48" />
              <rect x="46" y="110" width="8" height="48" />
            </g>
          )}
          {inMod === "button" && (
            <g
              role="button"
              tabIndex={running ? 0 : -1}
              aria-label="Push button: press to change the light"
              onClick={() => running && setPhase((ph) => (ph + 1) % 3)}
              onKeyDown={(e) => running && (e.key === " " || e.key === "Enter") && (e.preventDefault(), setPhase((ph) => (ph + 1) % 3))}
              className={running ? "cursor-pointer outline-none" : ""}
            >
              <rect x="22" y="107" width="36" height="36" rx="5" fill="#334155" />
              <circle cx="40" cy="125" r="11" fill={running ? "#94a3b8" : "#64748b"} />
            </g>
          )}
          {outMod === "buzzer" && (
            <g>
              <circle cx="380" cy="125" r="18" fill="#111827" />
              <circle cx="380" cy="125" r="4" fill="#475569" />
              {buzzing && (
                <g stroke="#facc15" strokeWidth="2" fill="none">
                  <path d="M404 112 q8 13 0 26" />
                  <path d="M412 104 q14 21 0 42" />
                </g>
              )}
            </g>
          )}
          {outMod === "led" && (
            <g>
              {ledOn && <circle cx="380" cy="125" r="30" fill="rgba(253,224,71,0.35)" />}
              <circle cx="380" cy="125" r="15" fill={ledOn ? "#fde047" : "#713f12"} />
            </g>
          )}
          {outMod === "traffic" &&
            ["#ef4444", "#facc15", "#22c55e"].map((c, i) => (
              <circle key={c} cx="380" cy={101 + i * 24} r="9" fill={running && phase === i ? c : "#334155"} />
            ))}
        </svg>

        {/* Modules to plug in, then run. */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-1" role="group" aria-label="Modules">
            {(Object.keys(MODS) as ModId[]).map((m) => {
              const on = plugged.includes(m);
              const Icon = MODS[m].icon;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  disabled={running}
                  onClick={() => plug(m)}
                  className={`flex min-h-10 items-center gap-2 px-2 text-left text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60 ${on ? "bg-amber-400 text-ym-text" : "bg-[#10245e] text-blue-100 hover:bg-[#16307a]"}`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {MODS[m].name}
                </button>
              );
            })}
          </div>
          {running && proj.control && (
            <label className="flex items-center gap-2 text-sm text-blue-100">
              <span className="shrink-0">{proj.control}</span>
              <input type="range" min={proj.min} max={proj.max} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-amber-400" />
              <span className="w-12 shrink-0 text-right tabular-nums">{value} {proj.unit}</span>
            </label>
          )}
          <p className={`text-sm ${active || (running && proj.id === "signal") ? "font-semibold text-amber-300" : "text-blue-100"}`} aria-live="polite">
            {status}
          </p>
          <div className="mt-auto flex gap-2">
            <button type="button" disabled={!ready} onClick={() => setRunning((r) => !r)} className={BTN_LIGHT}>
              {running ? "Stop" : "Run"}
            </button>
            <button type="button" onClick={() => pickProject(pi)} className={BTN_DARK}>
              Unplug all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Play Kit: lay direction cards on the table; the robot reads each one and
   drives across the mat. Three levels, with rocks to steer round. ── */
type Card = "forward" | "left" | "right" | "uturn";
const CARD: Record<Card, { label: string; rot: number; bg: string }> = {
  forward: { label: "Forward", rot: 0, bg: "bg-ym-blue text-white" },
  left: { label: "Left", rot: -90, bg: "bg-amber-400 text-ym-text" },
  right: { label: "Right", rot: 90, bg: "bg-emerald-500 text-white" },
  uturn: { label: "U-turn", rot: 180, bg: "bg-violet-500 text-white" },
};
const COLS = 6;
const ROWS = 5;
type Level = { name: string; start: { x: number; y: number; dir: number }; goal: { x: number; y: number }; rocks: [number, number][] };
const LEVELS: Level[] = [
  { name: "Level 1", start: { x: 0, y: 4, dir: 0 }, goal: { x: 0, y: 1 }, rocks: [] },
  { name: "Level 2", start: { x: 0, y: 4, dir: 0 }, goal: { x: 3, y: 1 }, rocks: [[1, 1], [2, 3]] },
  { name: "Level 3", start: { x: 0, y: 4, dir: 1 }, goal: { x: 5, y: 0 }, rocks: [[2, 4], [2, 3], [4, 1], [4, 0], [1, 1]] },
];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/* The Play Kit robot, seen from above: wheels, a round body, two eyes facing forward. */
function PlayBot({ reading }: { reading: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className="size-full" aria-hidden>
      <rect x="3" y="9" width="6" height="22" rx="2.5" fill="#0f172a" />
      <rect x="31" y="9" width="6" height="22" rx="2.5" fill="#0f172a" />
      <rect x="7" y="6" width="26" height="28" rx="11" fill="#ffffff" stroke="#1d4ed8" strokeWidth="2" />
      <rect x="13" y="16" width="14" height="10" rx="3" fill={reading ? "#facc15" : "#bfdbfe"} />
      <circle cx="15" cy="11" r="2.4" fill="#0f172a" />
      <circle cx="25" cy="11" r="2.4" fill="#0f172a" />
    </svg>
  );
}

export function PlayKitDemo() {
  const [li, setLi] = useState(0);
  const level = LEVELS[li];
  const [cards, setCards] = useState<Card[]>([]);
  const [bot, setBot] = useState({ x: level.start.x, y: level.start.y, turns: level.start.dir }); // turns: total quarter turns, never wrapped, so it always spins the short way
  const [step, setStep] = useState(-1);
  const [reading, setReading] = useState(false);
  const [bump, setBump] = useState(0);
  const [won, setWon] = useState(false);
  const [note, setNote] = useState("Lay out cards to reach the star, then press Run.");
  const timers = useTimers();
  const running = step >= 0;

  const reset = (to = li) => {
    timers.clear();
    const L = LEVELS[to];
    setBot({ x: L.start.x, y: L.start.y, turns: L.start.dir });
    setStep(-1);
    setReading(false);
    setWon(false);
  };
  const pickLevel = (i: number) => {
    setLi(i);
    setCards([]);
    reset(i);
    setNote("Lay out cards to reach the star, then press Run.");
  };

  const run = () => {
    reset();
    let s = { x: level.start.x, y: level.start.y, turns: level.start.dir };
    let t = 300;
    let stopped = false;
    cards.forEach((c, i) => {
      timers.later(() => {
        if (stopped) return;
        setStep(i);
        setReading(true);
      }, t);
      timers.later(() => {
        if (stopped) return;
        setReading(false);
        if (c === "left") s = { ...s, turns: s.turns - 1 };
        else if (c === "right") s = { ...s, turns: s.turns + 1 };
        else if (c === "uturn") s = { ...s, turns: s.turns + 2 };
        else {
          const d = ((s.turns % 4) + 4) % 4;
          const nx = s.x + DX[d];
          const ny = s.y + DY[d];
          const offMat = nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS;
          const rock = level.rocks.some(([rx, ry]) => rx === nx && ry === ny);
          if (offMat || rock) {
            stopped = true;
            setBump((b) => b + 1);
            setStep(-1);
            setNote(offMat ? `Card ${i + 1} would drive off the mat. Change it and try again.` : `Bump! Card ${i + 1} drives into a rock.`);
            return;
          }
          s = { ...s, x: nx, y: ny };
        }
        setBot(s);
      }, t + 380);
      t += 900;
    });
    timers.later(() => {
      if (stopped) return;
      setStep(-1);
      const ok = s.x === level.goal.x && s.y === level.goal.y;
      setWon(ok);
      setNote(ok ? `You reached the star in ${cards.length} cards!` : "Not there yet. Add or change cards and try again.");
    }, t);
  };

  const cell = (x: number, y: number) => ({ left: `${(x / COLS) * 100}%`, top: `${(y / ROWS) * 100}%`, width: `${100 / COLS}%`, height: `${100 / ROWS}%` });

  return (
    <div className={STAGE}>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Level">
        {LEVELS.map((L, i) => (
          <button key={L.name} type="button" aria-pressed={i === li} disabled={running} onClick={() => pickLevel(i)} className={`${BTN} min-h-9 ${i === li ? "bg-white text-ym-text" : "bg-[#10245e] text-blue-100 hover:bg-[#16307a]"}`}>
            {L.name}
          </button>
        ))}
      </div>

      {/* The mat. */}
      <div
        className="relative mx-auto mt-3 aspect-[6/5] w-full max-w-[420px] overflow-hidden rounded-lg bg-[#e0ecff]"
        role="img"
        aria-label={`${level.name}: a ${COLS} by ${ROWS} mat. The robot is at column ${bot.x + 1}, row ${bot.y + 1}. The star is at column ${level.goal.x + 1}, row ${level.goal.y + 1}.${level.rocks.length ? ` There are ${level.rocks.length} rocks.` : ""}`}
      >
        <span className="absolute inset-0 bg-[linear-gradient(#bfd3f5_2px,transparent_2px),linear-gradient(90deg,#bfd3f5_2px,transparent_2px)]" style={{ backgroundSize: `${100 / COLS}% ${100 / ROWS}%` }} aria-hidden />
        <span className="absolute grid place-items-center" style={cell(level.start.x, level.start.y)} aria-hidden>
          <span className="size-3/4 rounded-md border-2 border-dashed border-ym-blue/40" />
        </span>
        {level.rocks.map(([x, y]) => (
          <span key={`${x}-${y}`} className="absolute grid place-items-center" style={cell(x, y)} aria-hidden>
            <span className="size-[70%] rounded-[40%_55%_45%_50%] bg-slate-500" />
          </span>
        ))}
        <span className={`absolute grid place-items-center ${won ? "ym-pop" : ""}`} style={cell(level.goal.x, level.goal.y)} aria-hidden>
          <Star className="size-3/5 fill-amber-400 text-amber-500" />
        </span>
        {/* The robot glides between squares and turns the short way round. */}
        <span className="absolute p-[3%] transition-[left,top] duration-500 ease-out motion-reduce:transition-none" style={cell(bot.x, bot.y)} aria-hidden>
          <span key={bump} className={`block size-full transition-transform duration-500 ease-out motion-reduce:transition-none ${bump ? "ym-shake" : ""}`} style={{ transform: `rotate(${bot.turns * 90}deg)` }}>
            <PlayBot reading={reading} />
          </span>
        </span>
        {won && (
          <p className="ym-rise absolute inset-x-0 bottom-2 mx-auto w-fit bg-white px-3 py-1.5 text-sm font-bold text-ym-text">Level complete</p>
        )}
      </div>

      {/* Card deck. */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Add a card">
        {(Object.keys(CARD) as Card[]).map((c) => (
          <button
            key={c}
            type="button"
            disabled={running || cards.length >= 12}
            onClick={() => {
              setCards((cs) => [...cs, c]);
              setWon(false);
            }}
            className={`${BTN} flex items-center gap-1.5 ${CARD[c].bg} transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50`}
          >
            <ArrowUp className="size-4" style={{ transform: `rotate(${CARD[c].rot}deg)` }} aria-hidden />
            {CARD[c].label}
          </button>
        ))}
      </div>
      {/* The cards laid on the table, in order. The one being read lifts up. */}
      <ol className="mt-2 flex min-h-[64px] flex-wrap items-end gap-1.5 bg-[#10245e] p-2" aria-label="Your cards, in order">
        {cards.length === 0 && <li className="self-center px-1 text-sm text-blue-200">No cards yet. Tap a card above to lay it down.</li>}
        {cards.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={running}
              onClick={() => setCards((cs) => cs.filter((_, j) => j !== i))}
              aria-label={`${CARD[c].label}, card ${i + 1}. Remove`}
              className={`grid h-12 w-10 place-items-center rounded-md border-2 outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-amber-400 ${CARD[c].bg} ${
                i === step ? "-translate-y-2 border-white" : "border-transparent"
              }`}
              style={{ rotate: i === step ? "0deg" : `${((i % 3) - 1) * 3}deg` }}
            >
              <ArrowUp className="size-5" style={{ transform: `rotate(${CARD[c].rot}deg)` }} aria-hidden />
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={run} disabled={running || cards.length === 0} className={BTN_LIGHT}>
          {running ? "Running…" : "Run"}
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => {
            setCards([]);
            reset();
            setNote("Lay out cards to reach the star, then press Run.");
          }}
          className={BTN_DARK}
        >
          Clear
        </button>
        {won && li < LEVELS.length - 1 && (
          <button type="button" onClick={() => pickLevel(li + 1)} className={`${BTN} bg-amber-400 text-ym-text hover:bg-amber-300`}>
            Next level
          </button>
        )}
        <p className={`text-sm ${won ? "font-semibold text-amber-300" : "text-blue-100"}`} aria-live="polite">
          {note}
        </p>
      </div>
    </div>
  );
}
