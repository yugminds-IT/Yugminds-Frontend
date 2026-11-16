import { Award, Star } from "lucide-react";

const CODE = [
  "move_forward(6)",
  "if sensor.near():",
  "    turn_left()",
  "move_forward(8)",
];

/* Hero picture for the Academy: a lesson playing itself on a 10 second loop. The rover drives, its sensor sees the wall, it
   turns and reaches the star while the matching code line lights up; finishing fills the progress ring and earns the
   certificate. A tutor chip stays online beside it. Pure CSS, no client JS; reduced motion shows the finished state. */
export default function AcademyHeroVisual() {
  return (
    <div className="ach" role="img" aria-label="A lesson playing: a robot drives, senses a wall, turns, reaches the star and completes the lesson, earning a verified certificate.">
      <div className="ach-card" aria-hidden="true">
        <div className="ach-bar">
          <span className="ach-dots"><i /><i /><i /></span>
          <b>Lesson 3: Read a sensor</b>
        </div>

        <div className="ach-stage">
          <span className="ach-wall" />
          <span className="ach-star"><Star size="100%" fill="currentColor" strokeWidth={0} /></span>
          <span className="ach-beam" />
          <span className="ach-rover">
            <i className="ach-eye" /><i className="ach-eye" />
          </span>
          <span className="ach-toast">Lesson complete</span>
        </div>

        <pre className="ach-code">
          {CODE.map((l, i) => <code key={l} className={`ach-l ach-l${i + 1}`}>{l}</code>)}
        </pre>
      </div>

      <div className="ach-chip ach-chip--ring" aria-hidden="true">
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" className="ach-ring-bg" />
          <circle cx="20" cy="20" r="16" className="ach-ring-fg" pathLength="100" />
        </svg>
        <span><b>Course progress</b><small>Robot basics</small></span>
      </div>

      <div className="ach-chip ach-chip--tutor" aria-hidden="true">
        <span className="ach-live" />
        <span><b>Live 1:1 class</b><small>A tutor is online</small></span>
      </div>

      <div className="ach-chip ach-chip--cert" aria-hidden="true">
        <Award size={22} />
        <span><b>Verified certificate</b><small>Earned on completion</small></span>
      </div>
    </div>
  );
}
