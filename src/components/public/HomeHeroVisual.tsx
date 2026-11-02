import { Brain, Code, Cpu } from "lucide-react";
import "./droid.css";

const MODULES = [
  { id: "ai", name: "AI and ML", text: "The brain: it sees, learns and decides.", Icon: Brain },
  { id: "robotics", name: "Robotics", text: "The body: motors and sensors let it move.", Icon: Cpu },
  { id: "coding", name: "Coding", text: "The instructions that tell it what to do.", Icon: Code },
];

const BLOCKS = ["when started", "roll forward", "look around"];

export default function HomeHeroVisual() {
  return (
    <div className="rh-robot">
      <div className="droid-wrap">
        <div
          className="droid"
          role="img"
          aria-label="A small droid. Its head stands for AI and ML, its rolling ball body for robotics, and a card of code blocks for coding."
        >
          <div className="droid__sky" aria-hidden="true">
            <span className="droid__stars" />
            <span className="droid__stars droid__stars--b" />
            <span className="droid__moon droid__moon--big" />
            <span className="droid__moon droid__moon--mid" />
            <span className="droid__moon droid__moon--small" />
          </div>
          <div className="droid__orbit" aria-hidden="true">
            {[0, 120, 240].map((a, i) => {
              const Icon = [Code, Brain, Cpu][i];
              return (
                <div
                  key={a}
                  className="droid__orbiter"
                  style={{ "--a": `${a}deg`, "--d": `${-(a / 360) * 48}s` } as React.CSSProperties}
                >
                  <span><Icon aria-hidden="true" /></span>
                </div>
              );
            })}
          </div>
          <div className="droid__ping" aria-hidden="true" />
          <div className="droid__ping" aria-hidden="true" />
          <div className="droid__ground" />
          <div className="droid__shadow" />
          <div className="droid__unit">
            <div className="droid__head-container">
              <div className="droid__scan" />
              <div className="droid__antenna" />
              <div className="droid__antenna" />
              <div className="droid__head" />
            </div>
            <div className="droid__body" />
          </div>
        </div>

        <svg className="droid__leaders" viewBox="0 0 136 102" aria-hidden="true">
          <path d="M82 31 H96 M92.5 62.5 H96 M40 68 H44.5" />
          <circle cx="82" cy="31" r="1" />
          <circle cx="92.5" cy="62.5" r="1" />
          <circle cx="44.5" cy="68" r="1" />
        </svg>

        <ul className="rh-mods">
          {MODULES.map(({ id, name, text, Icon }) => (
            <li key={id} className={`rh-mod rh-mod--${id}`}>
              <div className="rh-mod-head">
                <span className="rh-mod-ico"><Icon size={20} aria-hidden="true" /></span>
                <h3>{name}</h3>
              </div>
              <p>{text}</p>
              {id === "coding" && (
                <div className="droid__code" aria-hidden="true">
                  {BLOCKS.map((b, i) => (
                    <span key={b} style={{ "--i": i } as React.CSSProperties}>{b}</span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
