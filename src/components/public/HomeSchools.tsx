"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "../../lib/api";
import { School } from "lucide-react";
import HomeCount from "./HomeCount";

type Logo = { id: string; name: string; image: string };
type State = { status: "loading" } | { status: "error" } | { status: "ready"; logos: Logo[] };

/* Partner schools, from the backend (GET /api/logos: the logos uploaded in the admin panel). Shows a skeleton while loading,
   a retry on failure, and nothing at all when no logos are uploaded yet. */
export default function HomeSchools() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 12000);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
    setState({ status: "loading" });
    apiClient
      .get("/api/logos", { signal: ac.signal })
      .then(({ data }) => {
        const list = Array.isArray(data?.logos) ? (data.logos as { id: string; image_url?: string; school_name?: string; description?: string }[]) : [];
        const logos = list
          .filter((l) => typeof l?.image_url === "string" && l.image_url.trim() !== "")
          .map((l) => ({ id: l.id, image: l.image_url as string, name: l.school_name || l.description || "" }));
        setState({ status: "ready", logos });
      })
      .catch((e) => {
        if (!ac.signal.aborted || e?.name !== "AbortError") setState({ status: "error" });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [attempt]);

  if (state.status === "ready" && state.logos.length === 0) return null;

  const ready = state.status === "ready" ? state.logos : [];
  // Repeat short lists so one lap always fills the width; the second row runs the same logos from the other end.
  const fill = (list: Logo[]) => !list.length ? [] : Array.from({ length: Math.max(1, Math.ceil(8 / list.length)) }, () => list).flat();
  const rowA = fill(ready);
  const lap = (logos: Logo[], dup: boolean) => (
    <ul className="rh-schools-list" aria-hidden={dup || undefined}>
      {logos.map((l, i) => (
        <li key={`${l.id}-${i}`} className="rh-school">
          <span className="rh-school-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={l.image}
              alt={dup ? "" : l.name ? `${l.name} logo` : "Partner school logo"}
              loading="lazy"
              decoding="async"
              onError={(e) => ((e.currentTarget.closest("li") as HTMLElement).style.display = "none")}
            />
          </span>
          {l.name && <span className="rh-school-name">{l.name}</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <section className="rh-sec rh-schools" aria-labelledby="rh-schools">
      <div className="rh-wrap rh-schools-head">
        <div className="rh-schools-text">
          <h2 id="rh-schools">Schools that run RoboCoders.</h2>
          <p className="rh-lede">
            Classrooms across India teach coding, robotics and AI with us. We handle setup, instructors and support.
          </p>
        </div>
        <p className="rh-schools-stat">
          <span className="rh-schools-stat-ico"><School size={22} aria-hidden="true" /></span>
          <strong><HomeCount to={20} suffix="+" /></strong>
          <span className="rh-schools-stat-label">partner schools nationwide</span>
        </p>
      </div>

      {state.status === "loading" && (
        <div className="rh-schools-skel" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <span key={i} className="rh-school rh-school--skel" />)}
        </div>
      )}

      {state.status === "error" && (
        <div className="rh-wrap rh-schools-error" role="status">
          <p>We could not load the school logos.</p>
          <button type="button" className="rh-btn rh-btn--ghost" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      )}

      {state.status === "ready" && (
        <div className="rh-schools-rows" role="group" aria-label="Partner schools">
          <div className="rh-schools-track"><div className="rh-schools-run">{lap(rowA, false)}{lap(rowA, true)}</div></div>
        </div>
      )}

      <p className="rh-wrap rh-more">
        <Link href="/robocoders/for-schools" className="rh-link">Bring RoboCoders to your school</Link>
      </p>
    </section>
  );
}
