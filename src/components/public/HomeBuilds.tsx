"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AppWindow, BookOpen, Bluetooth, Clapperboard, Flame, Gamepad2, ImageIcon, MessageSquareText, Mic, Network,
  Pause, Play, Radar, Route, Sparkles, Terminal, ToggleRight, Waves,
  type LucideIcon,
} from "lucide-react";

type Module = "coding" | "robotics" | "ai";
const MODULE_NAME: Record<Module, string> = { coding: "Coding", robotics: "Robotics", ai: "AI and ML" };
const FILTERS: { id: "all" | Module; label: string }[] = [
  { id: "all", label: "All" },
  { id: "coding", label: "Coding" },
  { id: "robotics", label: "Robotics" },
  { id: "ai", label: "AI and ML" },
];

type Project = { module: Module; name: string; detail: string; Icon: LucideIcon };

// What students make in each module. Coding: Scratch-style block coding, then text coding. Robotics: the ESP32 kit
// (see the products page). AI and ML: the data types the RoboCoders ML environment trains on.
const CODING: Project[] = [
  { module: "coding", name: "Animations", detail: "Scratch blocks", Icon: Clapperboard },
  { module: "coding", name: "Games", detail: "Scratch blocks", Icon: Gamepad2 },
  { module: "coding", name: "Stories", detail: "Scratch blocks", Icon: BookOpen },
  { module: "coding", name: "Apps", detail: "Block and text coding", Icon: AppWindow },
  { module: "coding", name: "Python programs", detail: "Text coding", Icon: Terminal },
];
const ROBOTICS: Project[] = [
  { module: "robotics", name: "Line follower", detail: "IR sensors", Icon: Route },
  { module: "robotics", name: "Obstacle avoider", detail: "Ultrasonic sensor", Icon: Waves },
  { module: "robotics", name: "Maze solver", detail: "IR sensors", Icon: Route },
  { module: "robotics", name: "Light follower", detail: "LDR light sensor", Icon: Sparkles },
  { module: "robotics", name: "Bluetooth-controlled car", detail: "ESP32 board", Icon: Bluetooth },
  { module: "robotics", name: "Table-edge detector", detail: "IR sensors", Icon: Radar },
  { module: "robotics", name: "Toll gate system", detail: "Servo motor", Icon: ToggleRight },
  { module: "robotics", name: "Fire control model", detail: "DC motor and propeller", Icon: Flame },
];
const AI: Project[] = [
  { module: "ai", name: "Image classifier", detail: "Camera or files", Icon: ImageIcon },
  { module: "ai", name: "Text classifier", detail: "Phrases and sentences", Icon: MessageSquareText },
  { module: "ai", name: "Sound recognizer", detail: "Microphone", Icon: Mic },
  { module: "ai", name: "Apps that decide", detail: "Neural network basics", Icon: Network },
];

// One from each module in turn, so the strip never shows a long run of the same kind.
const ALL: Project[] = [];
for (let i = 0; i < Math.max(CODING.length, ROBOTICS.length, AI.length); i++) {
  for (const group of [CODING, ROBOTICS, AI]) if (group[i]) ALL.push(group[i]);
}

/* The strip along the bottom of the hero: what students make across all three modules, drifting past. Filter pills show
   one module at a time. It pauses on hover and focus, and a button pauses it for good (moving content needs a stop). */
export default function HomeBuilds() {
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<"all" | Module>("all");
  const shown = useMemo(() => (filter === "all" ? ALL : ALL.filter((p) => p.module === filter)), [filter]);

  const list = (dup: boolean) => (
    <ul className="rh-ticker-list" aria-hidden={dup || undefined}>
      {shown.map(({ module, name, detail, Icon }) => (
        <li key={name}>
          <span className="rh-chip-ico"><Icon size={16} aria-hidden="true" /></span>
          <span className="rh-chip-text">
            <strong>{name}</strong>
            <span>{MODULE_NAME[module]} · {detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="rh-ticker" data-paused={paused}>
      <div className="rh-ticker-head">
        <p className="rh-ticker-label">Students build</p>
        <div className="rh-ticker-filters" role="group" aria-label="Show projects from">
          {FILTERS.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="rh-ticker-track" role="group" aria-label="What students build">
        {/* key restarts the drift from the start when the filter changes */}
        <div key={filter} className="rh-ticker-run">
          {list(false)}
          {list(true)}
        </div>
      </div>
      <div className="rh-ticker-tools">
        <Link href="/robocoders/programs" className="rh-link">Explore every program</Link>
        <button
          type="button"
          className="rh-ticker-btn"
          aria-pressed={paused}
          aria-label={paused ? "Play the project strip" : "Pause the project strip"}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
