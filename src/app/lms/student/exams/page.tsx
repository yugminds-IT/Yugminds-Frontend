"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Play, Search } from "lucide-react";
import { EXAM_TYPE_LABEL, fmtWindow } from "@/lib/assignment-types";
import { studentApi } from "@/lib/api/student.api";

interface Exam {
  id: string;
  title: string;
  subject: string;
  exam_type: string | null;
  exam_phase: "upcoming" | "open" | "closed";
  starts_at: string | null;
  ends_at: string | null;
  duration_minutes: number | null;
  max_marks: number;
  submitted: boolean;
  graded: boolean;
  score: number | null;
}

type Group = "open" | "upcoming" | "completed" | "missed";

const GROUPS: Array<{ key: Group; label: string; hint: string }> = [
  { key: "open", label: "Open now", hint: "You can take these" },
  { key: "upcoming", label: "Upcoming", hint: "Scheduled for later" },
  { key: "completed", label: "Completed", hint: "Handed in" },
  { key: "missed", label: "Missed", hint: "Closed, not taken" },
];

const groupOf = (e: Exam): Group =>
  e.submitted ? "completed" : e.exam_phase === "open" ? "open" : e.exam_phase === "upcoming" ? "upcoming" : "missed";

function normalize(raw: Record<string, unknown>): Exam {
  const sub = raw.submission as { grade?: number | null; status?: string } | null | undefined;
  const grade = sub?.grade ?? null;
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    subject: String(raw.subject ?? raw.course_title ?? ""),
    exam_type: raw.exam_type != null ? String(raw.exam_type) : null,
    exam_phase: (raw.exam_phase as Exam["exam_phase"]) ?? "closed",
    starts_at: raw.starts_at != null ? String(raw.starts_at) : null,
    ends_at: raw.ends_at != null ? String(raw.ends_at) : null,
    duration_minutes: raw.duration_minutes != null ? Number(raw.duration_minutes) : null,
    max_marks: Number(raw.max_marks ?? raw.total_marks ?? 0),
    submitted: !!sub,
    graded: raw.status === "graded" || grade !== null,
    score: grade,
  };
}

export default function StudentExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Group | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await studentApi.assignments.list({ type: "EXAM" });
        const list = (data as { assignments?: unknown[] }).assignments ?? [];
        setExams((list as Record<string, unknown>[]).map(normalize));
      } catch {
        setExams([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => {
    const c: Record<Group, number> = { open: 0, upcoming: 0, completed: 0, missed: 0 };
    exams.forEach((e) => (c[groupOf(e)] += 1));
    return c;
  }, [exams]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (e: Exam) => !q || e.title.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q);
    const time = (v: string | null) => (v ? new Date(v).getTime() : 0);
    return GROUPS.filter((g) => filter === "all" || filter === g.key).map((g) => ({
      ...g,
      items: exams
        .filter((e) => groupOf(e) === g.key && match(e))
        // Soonest first for open/upcoming, most recent first for finished ones.
        .sort((a, b) =>
          g.key === "open" || g.key === "upcoming" ? time(a.starts_at) - time(b.starts_at) : time(b.ends_at) - time(a.ends_at),
        ),
    })).filter((g) => g.items.length > 0);
  }, [exams, filter, search]);

  const openExam = exams.find((e) => groupOf(e) === "open");
  const nextExam = exams
    .filter((e) => groupOf(e) === "upcoming")
    .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime())[0];

  const status = loading
    ? "Checking your exams…"
    : counts.open > 0
    ? <><strong>{counts.open} exam{counts.open !== 1 ? "s" : ""} open now.</strong></>
    : nextExam
    ? <>Next: <strong>{nextExam.title}</strong>, {fmtWindow(nextExam.starts_at, null).split(" → ")[0]}.</>
    : "No exams scheduled.";

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ex-title">
        <div className="sd-hero-copy">
          <h1 id="ex-title" className="mc-hero-title">Exams</h1>
          <p className="sd-status">{status}</p>
          {openExam && !openExam.submitted ? (
            <div className="sd-hero-actions">
              <Link href={`/lms/student/assignments/${openExam.id}`} className="sd-btn sd-btn--amber">
                <Play aria-hidden="true" />Start {openExam.title.length > 28 ? `${openExam.title.slice(0, 26)}…` : openExam.title}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <nav className="sd-ledger" aria-label="Filter by status">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            aria-pressed={filter === g.key}
            data-hot={g.key === "open" && counts.open > 0 ? "true" : undefined}
            onClick={() => setFilter(filter === g.key ? "all" : g.key)}
          >
            <span className="sd-l">{g.label}</span>
            <b className="sd-n">{counts[g.key]}</b>
            <small>{g.hint}</small>
          </button>
        ))}
      </nav>

      <label className="sd-search" style={{ width: "min(100%, 18rem)" }}>
        <Search aria-hidden="true" />
        <input type="search" placeholder="Search exams" aria-label="Search exams" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>

      {loading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : grouped.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{search || filter !== "all" ? "Nothing matches" : "No exams scheduled yet"}</b>
            <p>{search || filter !== "all" ? "Try another word or filter." : "When your teacher schedules an exam it will show up here."}</p>
            {(search || filter !== "all") && (
              <button className="sd-btn sd-btn--line" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>
            )}
          </div>
        </section>
      ) : (
        grouped.map((g) => (
          <section key={g.key} className="sd-panel as-list" aria-label={g.label}>
            <p className="as-group">{g.label}<span>{g.items.length}</span></p>
            {g.items.map((e) => (
              <Link
                key={e.id}
                href={e.submitted ? `/lms/student/assignments/${e.id}/view` : `/lms/student/assignments/${e.id}`}
                className="as-row"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.9rem 1rem", textDecoration: "none", color: "inherit" }}
              >
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: "block" }}>{e.title}</b>
                  <small style={{ display: "block", opacity: 0.7 }}>
                    {[EXAM_TYPE_LABEL[e.exam_type ?? "OTHER"], e.subject, fmtWindow(e.starts_at, e.ends_at)].filter(Boolean).join(" · ")}
                  </small>
                  {e.duration_minutes ? (
                    <small style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", opacity: 0.7 }}>
                      <Clock aria-hidden="true" size={12} />{e.duration_minutes} min
                    </small>
                  ) : null}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", whiteSpace: "nowrap" }}>
                  {g.key === "completed" ? (
                    <b>{e.graded && e.score !== null ? `${e.score}/${e.max_marks}` : "Awaiting grade"}</b>
                  ) : g.key === "open" ? (
                    <b>Open now</b>
                  ) : g.key === "missed" ? (
                    <b>Missed</b>
                  ) : (
                    <b>Upcoming</b>
                  )}
                  <ArrowRight aria-hidden="true" size={16} />
                </span>
              </Link>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
