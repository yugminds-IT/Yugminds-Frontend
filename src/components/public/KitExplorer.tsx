"use client";

import { useState } from "react";
import { Bluetooth, Gauge, Home, Lightbulb, Radar, Route, Sparkles, Thermometer, ToggleRight, Waves, type LucideIcon } from "lucide-react";

const PARTS = [
  ["Custom ESP32 board", "The robot's brain. It runs code, reads sensors, drives motors and has Wi-Fi and Bluetooth."],
  ["IR sensors", "Line following, edge detection and maze solving."],
  ["Ultrasonic sensor", "Obstacle avoiding, object following and distance meters."],
  ["LDR light sensor", "Light-following robots and light alerts."],
  ["DHT11 sensor", "Temperature and humidity monitoring, smart fans."],
  ["OLED display", "Shows direction, distance, temperature and water level."],
  ["BO gear motors", "Controlled movement and speed for the 4-wheel chassis."],
  ["Servo motor", "Toll gates, switches and small robotic arms."],
  ["DC motor and propeller", "Cooling fans and fire-control models."],
  ["Buzzer", "Alarms for obstacles, lines and water levels."],
  ["LEDs", "Visual indicators and status signals."],
  ["4-wheel acrylic chassis", "Holds the board, motors and sensors together."],
  ["Wheels (x4)", "Traction and stability for every mobile robot."],
  ["Wires and USB cable", "Power and signal connections to the ESP32."],
  ["Screws, nuts and bolts", "Complete robot assembly and sensor mounting."],
];

const PROJECTS: [LucideIcon, string, string][] = [
  [Lightbulb, "Output and display", "LED on/off, OLED direction indicator, distance and water-level meters"],
  [Radar, "Sensor detection", "Light detector, object and motion detector, digital distance meter"],
  [Gauge, "Movement patterns", "Random, spiral and all-direction movements, left-right solver"],
  [Route, "IR robots", "Line follower, table-edge detector, maze solvers"],
  [Waves, "Ultrasonic robots", "Obstacle avoider, object follower, distance-measuring robot"],
  [Sparkles, "Light-following robots", "Light follower with buzzer, obstacle and light follower"],
  [Bluetooth, "Wireless control", "Bluetooth-controlled robot car"],
  [ToggleRight, "Servo projects", "Toll gate system, switch-on using a servo"],
  [Home, "Home automation", "Motion-activated light, parking management system"],
  [Thermometer, "Environment", "Water-level monitor, fire control, temperature-monitoring bot"],
];

/* Two views of the kit in one place: what is in the box, and what students build with it. */
export default function KitExplorer() {
  const [tab, setTab] = useState<"box" | "projects">("box");
  return (
    <div className="pd-explore">
      <div className="rh-faq2-cats" role="group" aria-label="Kit details">
        <button type="button" aria-pressed={tab === "box"} onClick={() => setTab("box")}>In the box ({PARTS.length})</button>
        <button type="button" aria-pressed={tab === "projects"} onClick={() => setTab("projects")}>40+ projects, by skill</button>
      </div>
      {tab === "box" ? (
        <ul className="pd-rows" key="box">
          {PARTS.map(([name, use], i) => (
            <li key={name} style={{ "--i": i } as React.CSSProperties}><b>{name}</b><span>{use}</span></li>
          ))}
        </ul>
      ) : (
        <ul className="pd-rows" key="projects">
          {PROJECTS.map(([Icon, name, ex], i) => (
            <li key={name} style={{ "--i": i } as React.CSSProperties}>
              <b><Icon size={16} aria-hidden="true" />{name}</b><span>{ex}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
