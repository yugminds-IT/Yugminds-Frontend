"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Award, Bell, BookOpen, Building2, CalendarDays, ClipboardCheck, ClipboardList, FileBarChart, GraduationCap, KeyRound,
  Pause, Play, School, Settings, TrendingUp, UserCog, Users, type LucideIcon,
} from "lucide-react";
import { brandHref } from "@/lib/brand-host";

type Role = { id: string; name: string; text: string; Icon: LucideIcon; sections: [string, LucideIcon][] };

// The sections are the pages each role actually has in the LMS.
const ROLES: Role[] = [
  {
    id: "admin", name: "Admin", Icon: UserCog,
    text: "The RoboCoders team sets up schools, accounts, courses and certificates.",
    sections: [["Schools", Building2], ["School admins", UserCog], ["Teachers and students", Users], ["Courses", BookOpen], ["Certificates", Award], ["Joining codes and licences", KeyRound]],
  },
  {
    id: "school-admin", name: "School admin", Icon: School,
    text: "Runs the programme inside the school: people, schedules and reports.",
    sections: [["Teachers", GraduationCap], ["Students", Users], ["Courses", BookOpen], ["Schedules", CalendarDays], ["Reports", FileBarChart], ["Student progress", TrendingUp]],
  },
  {
    id: "teacher", name: "Teacher", Icon: GraduationCap,
    text: "Takes the class, marks attendance, sets assignments and tracks progress.",
    sections: [["Classes", Users], ["Attendance", ClipboardCheck], ["Assignments", ClipboardList], ["Student progress", TrendingUp], ["Reports", FileBarChart], ["Calendar", CalendarDays]],
  },
  {
    id: "student", name: "Student", Icon: Users,
    text: "Learns through courses and assignments, and earns certificates.",
    sections: [["My courses", BookOpen], ["Assignments", ClipboardList], ["Progress", TrendingUp], ["Certificates", Award], ["Notifications", Bell], ["Settings", Settings]],
  },
];
const DWELL = 6.5; // seconds per role

/* One LMS, four dashboards. The roles rotate on their own (held off screen, and stoppable with the pause button); the
   dashboard on the right lights up that role's sections one after another, as if someone were moving through them. */
export default function HomeLms() {
  const [active, setActive] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = inView && !userPaused;
  const role = ROLES[active];
  const pick = (i: number, focus = false) => {
    setActive(i);
    if (focus) refs.current[i]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = ROLES.length;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); pick((i + 1) % n, true); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); pick((i + n - 1) % n, true); }
  };

  return (
    <section className="rh-sec" aria-labelledby="rh-lms">
      <div className="rh-wrap">
        <div className="rh-head">
          <h2 id="rh-lms">One LMS for everyone in the programme.</h2>
          <p className="rh-lede">Admins, school admins, teachers and students each get a dashboard built for their job.</p>
        </div>

        <div className="rh-lab" ref={box}>
          <div className="rh-lab-tabs" role="tablist" aria-label="LMS roles" aria-orientation="vertical">
            {ROLES.map((r, i) => (
              <button
                key={r.id}
                ref={(el) => { refs.current[i] = el; }}
                role="tab"
                id={`lms-tab-${r.id}`}
                aria-selected={active === i}
                aria-controls="rh-lms-panel"
                tabIndex={active === i ? 0 : -1}
                className="rh-lab-tab rh-role"
                onClick={() => pick(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="rh-role-ico"><r.Icon size={20} aria-hidden="true" /></span>
                <h3>{r.name}</h3>
                <p>{r.text}</p>
                <span className="rh-lab-track" aria-hidden="true">
                  {active === i && (
                    <span
                      className="rh-lab-fill"
                      data-running={running}
                      style={{ "--dwell": `${DWELL}s` } as React.CSSProperties}
                      onAnimationEnd={() => setActive((a) => (a + 1) % ROLES.length)}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="rh-lab-panel" role="tabpanel" id="rh-lms-panel" aria-labelledby={`lms-tab-${role.id}`}>
            <div className="rh-lab-screen rh-dash" key={role.id}>
              <div className="rh-dash-bar" aria-hidden="true">
                <i /><i /><i />
                <span>RoboCoders LMS</span>
                <em>{role.name}</em>
              </div>
              <ul className="rh-dash-grid">
                {role.sections.map(([label, Icon], i) => (
                  <li key={label} style={{ "--i": i } as React.CSSProperties}>
                    <span><Icon size={18} aria-hidden="true" /></span>
                    <strong>{label}</strong>
                    <i />
                  </li>
                ))}
              </ul>
            </div>
            <div className="rh-lab-bar">
              <p className="rh-lab-note">Illustration: sections of the {role.name.toLowerCase()} dashboard</p>
              <button
                type="button"
                className="rh-ticker-btn"
                aria-pressed={userPaused}
                aria-label={userPaused ? "Resume switching between roles" : "Pause switching between roles"}
                onClick={() => setUserPaused((p) => !p)}
              >
                {userPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        <p className="rh-more">
          <Link href={brandHref("/lms/login")} className="rh-link">Sign in to the LMS</Link>
        </p>
      </div>
    </section>
  );
}
