import Link from "next/link";
import { Hammer, Layers, School, Users } from "lucide-react";
import HomeCount from "./HomeCount";

const stats = [
  { to: 2000, suffix: "+", label: "students trained across India", Icon: Users },
  { to: 20, suffix: "+", label: "partner schools nationwide", Icon: School },
  { to: 3, suffix: "", label: "core programs: coding, AI and robotics", Icon: Layers },
  { to: 100, suffix: "%", label: "project-based, every lesson builds something real", Icon: Hammer },
];

export default function HomeStats() {
  return (
    <section className="rh-sec rh-dark rh-about-sec" aria-labelledby="rh-about">
      <div className="rh-wrap rh-about">
        <div className="rh-about-copy">
          <h2 id="rh-about" className="rh-about-title">
            Built by YugMinds, taught across India.
          </h2>
          <p className="rh-statement">
            RoboCoders is an EdTech initiative by YugMinds in Hyderabad. We teach students to build with code, circuits and AI.
          </p>
          <Link href="/robocoders/about" className="rh-link">About RoboCoders</Link>
        </div>
        <dl className="rh-stats">
          {stats.map(({ to, suffix, label, Icon }) => (
            <div key={label} className="rh-stat">
              <span className="rh-stat-ico"><Icon size={20} aria-hidden="true" /></span>
              <dt><HomeCount to={to} suffix={suffix} /></dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
