"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Cog, Cpu, Lightbulb, Pause, Play, PlayCircle, Plug, Radar, ListChecks } from "lucide-react";
import { brandHref } from "@/lib/brand-host";

const ITEMS = [
  { Icon: Cpu, name: "ESP32-compatible microcontroller board", note: "The robot's brain. It runs your code, reads sensors and drives motors, with Wi-Fi and Bluetooth." },
  { Icon: Radar, name: "30+ electronic components and sensors", note: "IR, ultrasonic, light and temperature sensors, plus an OLED display, LEDs and a buzzer." },
  { Icon: Cog, name: "Motors, wheels and chassis", note: "Gear motors, a servo, four wheels and an acrylic chassis that holds it all together." },
  { Icon: Plug, name: "USB cable and power supply", note: "Power and signal connections to the board." },
  { Icon: ListChecks, name: "Step-by-step assembly instructions", note: "Follow along to put the robot together. Pins are labelled for easy, safe connections." },
  { Icon: PlayCircle, name: "Online video tutorials", note: "Watch each build before you try it yourself." },
  { Icon: Lightbulb, name: "Project ideas and coding examples", note: "40+ guided projects, from a first LED to a maze-solving robot." },
];
const SPOT_MS = 2600;

/* The robotics kit as an unboxing. A spotlight goes through what is in the box one part at a time, opening the part's
   note, while a counter and a chip on the video say which part it is. Pointing at or focusing a part takes over. The
   video has a play/pause button and does not autoplay with reduced motion. */
export default function ProgramsKit() {
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const [playing, setPlaying] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) { setStill(true); setPlaying(false); video.current?.pause(); }
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || picked || !inView) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % ITEMS.length), SPOT_MS);
    return () => clearTimeout(id);
  }, [active, still, picked, inView]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };
  const pick = (i: number) => { setPicked(true); setActive(i); };

  return (
    <section className="rh-sec rh-wash" aria-labelledby="pg-kit">
      <div className="rh-wrap pg-kit" ref={box}>
        <div className="pg-kit-video">
          <video
            ref={video}
            src="/instagram-reel.mp4"
            autoPlay={!still}
            loop
            muted
            playsInline
            aria-label="The RoboCoders robotics kit being built and driven"
          />
          <p className="pg-kit-chip" aria-hidden="true" key={active}>In the box: {ITEMS[active].name}</p>
          <button type="button" className="pg-kit-play" aria-pressed={!playing} aria-label={playing ? "Pause the video" : "Play the video"} onClick={toggle}>
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
        </div>

        <div className="pg-kit-copy">
          <h2 id="pg-kit">Everything you need to build your first robot.</h2>
          <p className="rh-lede">The robotics kit has the parts, the tools and the tutorials in one box.</p>

          <div className="pg-inv">
            <p className="pg-inv-count" aria-live="polite">Part {active + 1} of {ITEMS.length}</p>
            <ul>
              {ITEMS.map(({ Icon, name, note }, i) => (
                <li key={name} data-state={i === active ? "active" : i < active ? "done" : "todo"}>
                  <button type="button" onClick={() => pick(i)} onMouseEnter={() => pick(i)} onFocus={() => pick(i)} aria-expanded={i === active}>
                    <span className="rh-chip-ico"><Icon size={16} aria-hidden="true" /></span>
                    <span className="pg-inv-name">{name}</span>
                  </button>
                  <div className="pg-inv-note"><p>{note}</p></div>
                  {i === active && !picked && !still && inView && <i key={`b-${i}`} className="pg-inv-bar" aria-hidden="true" />}
                </li>
              ))}
            </ul>
          </div>

          <div className="rh-actions">
            <Link href={brandHref("/robocoders/products#robotics-kit")} className="rh-btn rh-btn--primary">Order the robotics kit</Link>
            <Link href={brandHref("/robocoders/contact")} className="rh-btn rh-btn--ghost">Ask about the kit</Link>
          </div>
          <p className="pg-kit-note">
            Prefer software? See the <Link href="/robocoders/products" className="rh-link">offline learning platform</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
