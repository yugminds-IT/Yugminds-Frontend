"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { studentApi } from "@/lib/api/student.api";
import ThresholdTrack from "@/components/portal/ThresholdTrack";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type BadgeLevel = "GOLD" | "SILVER" | "BRONZE" | "NONE";

type RankScope = {
  rank: number | null;
  total: number;
  percentile: number | null;
};

type Rankings = {
  section: RankScope;
  grade: RankScope;
  school: RankScope;
  system: RankScope & { schools: number };
};

type Summary = {
  course_assignment_score: number;
  daily_assignment_score: number;
  overall_score: number;
  assignments_attempted: number;
  graded_count: number;
  pending_grading: number;
  badge: BadgeLevel;
  grade: string;
  section: string;
  school_name?: string;
  school_rank?: number | null;
  grade_rank?: number | null;
  section_rank?: number | null;
};

type SubjectBreakdown = {
  subject: string;
  avg_score: number;
  submissions: number;
};

type ScoreHistoryEntry = {
  assignment_id: string;
  title: string;
  assignment_type: "COURSE" | "DAILY";
  subject: string;
  score: number;
  max_score: number;
  percentage: number;
  attempt: number;
  submitted_at: string | null;
  feedback: string | null;
};

type LeaderboardEntry = {
  rank: number;
  school_rank?: number;
  grade_rank?: number;
  section_rank?: number;
  student_id: number;
  student_name: string;
  grade?: string;
  section?: string;
  course_score?: number;
  daily_score?: number;
  overall_score: number;
  is_self: boolean;
  badge?: string;
};

type AnalyticsData = {
  summary: Summary;
  rankings?: Rankings;
  subject_breakdown: SubjectBreakdown[];
  score_history: ScoreHistoryEntry[];
  school_leaderboard: LeaderboardEntry[];
};

// ── Badges ───────────────────────────────────────────────────────────────────

const BADGE_NAME: Record<BadgeLevel, string> = { GOLD: "Gold badge", SILVER: "Silver badge", BRONZE: "Bronze badge", NONE: "No badge yet" };
const TICKS = [
  { at: 60, label: "Bronze" },
  { at: 75, label: "Silver" },
  { at: 90, label: "Gold" },
];
const NEXT: Record<BadgeLevel, { target: number; label: string } | null> = {
  NONE: { target: 60, label: "Bronze" },
  BRONZE: { target: 75, label: "Silver" },
  SILVER: { target: 90, label: "Gold" },
  GOLD: null,
};

// ── Rankings ─────────────────────────────────────────────────────────────────

function RankRow({ scope, sub, data }: { scope: string; sub?: string; data: RankScope | undefined }) {
  const rank = data?.rank ?? null;
  const total = data?.total ?? 0;
  const percentile = data?.percentile ?? null;
  const none = total === 0 && rank == null;
  const pos = rank != null && total > 0 ? ((total - rank + 1) / total) * 100 : 0;
  return (
    <div className="an-rank" data-first={rank === 1}>
      <div className="an-rank-name"><b>{scope}</b>{sub && <small>{sub}</small>}</div>
      {none ? (
        <p className="an-wait">Not enough scores yet.</p>
      ) : (
        <>
          <div className="an-rank-n"><b>{rank != null ? `#${rank}` : "—"}</b><span>of {total.toLocaleString("en-IN")}</span></div>
          <div className="sd-ladder" aria-hidden="true"><i style={{ "--p": `${Math.max(4, Math.min(96, pos))}%` } as React.CSSProperties} /></div>
          <span className="an-top">{rank === 1 ? "Top of the class" : percentile != null && total >= 5 ? `Top ${percentile}%` : ""}</span>
        </>
      )}
    </div>
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

type Scope = "school" | "grade" | "section";

function Leaderboard({ rows }: { rows: LeaderboardEntry[] }) {
  const self = rows.find((e) => e.is_self);
  const [scope, setScope] = useState<Scope>("school");
  const [shown, setShown] = useState(10);

  const list = useMemo(() => {
    let l = rows;
    if (scope === "grade" && self?.grade) l = rows.filter((e) => e.grade === self.grade);
    if (scope === "section" && self?.section) l = rows.filter((e) => e.grade === self?.grade && e.section === self.section);
    const rankOf = (e: LeaderboardEntry) =>
      (scope === "grade" ? e.grade_rank : scope === "section" ? e.section_rank : e.school_rank ?? e.rank) ?? e.rank;
    return [...l].sort((a, b) => rankOf(a) - rankOf(b)).map((e, i) => ({ e, pos: rankOf(e) ?? i + 1 }));
  }, [rows, scope, self]);

  const visible = list.slice(0, shown);
  const selfItem = list.find((x) => x.e.is_self);
  const selfHidden = selfItem && !visible.includes(selfItem);

  const row = ({ e, pos }: { e: LeaderboardEntry; pos: number }) => (
    <div key={e.student_id} className="an-lb-row" data-self={e.is_self}>
      <span className="an-pos" data-m={pos <= 3 ? pos : undefined}>{pos}</span>
      <div className="an-who">
        <b>{e.student_name}{e.is_self && <span className="an-you">You</span>}</b>
        <small>{[e.grade, e.section].filter(Boolean).join(" • ")}</small>
      </div>
      <div className="an-pts">
        <b>{e.overall_score.toFixed(1)}%</b>
        {e.course_score != null && e.daily_score != null && <small>Course {e.course_score.toFixed(0)}% • Daily {e.daily_score.toFixed(0)}%</small>}
      </div>
    </div>
  );

  return (
    <section className="sd-panel" aria-labelledby="an-lb-h">
      <div className="sd-panel-head">
        <div>
          <h2 id="an-lb-h">Leaderboard</h2>
          {self && <p>You are #{self.school_rank ?? self.rank} in your school with {self.overall_score.toFixed(1)}%.</p>}
        </div>
      </div>
      <div className="as-chips" role="group" aria-label="Who to compare with" style={{ marginBottom: "0.75rem" }}>
        {([
          { k: "school", label: "My school" },
          { k: "grade", label: "My grade" },
          { k: "section", label: "My section" },
        ] as const).map((c) => (
          <button key={c.k} className="as-chip" aria-pressed={scope === c.k} onClick={() => { setScope(c.k); setShown(10); }}>{c.label}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="sd-empty"><b>No scores to compare yet</b><p>When your class gets graded, the leaderboard fills up.</p></div>
      ) : (
        <div className="an-lb">
          {visible.map(row)}
          {selfHidden && selfItem && (<><p className="an-gap" aria-hidden="true">…</p>{row(selfItem)}</>)}
          {list.length > shown && (
            <button className="sd-btn sd-btn--line an-more" onClick={() => setShown((n) => n + 25)}>Show more</button>
          )}
        </div>
      )}
    </section>
  );
}

// ── Subjects ─────────────────────────────────────────────────────────────────

type SubjectWithSplit = SubjectBreakdown & {
  course_avg: number;
  daily_avg: number;
  course_count: number;
  daily_count: number;
};

const tone = (v: number) => (v < 50 ? "low" : undefined);

function SubjectRow({ row }: { row: SubjectWithSplit }) {
  const hasBoth = row.course_count > 0 && row.daily_count > 0;
  return (
    <div className="an-sub">
      <div className="an-sub-top">
        <div><b>{row.subject}</b> <span>{row.submissions} handed in</span></div>
        <em>{row.avg_score.toFixed(0)}%</em>
      </div>
      <div className="sd-meter" data-t={tone(row.avg_score)} role="progressbar" aria-valuenow={Math.round(row.avg_score)} aria-valuemin={0} aria-valuemax={100} aria-label={`${row.subject} average`}>
        <i style={{ "--p": `${Math.max(0, Math.min(100, row.avg_score))}%` } as React.CSSProperties} />
      </div>
      {hasBoth && (
        <div className="an-split">
          <p data-k="course"><span>Course</span><span className="sd-meter"><i style={{ "--p": `${row.course_avg}%` } as React.CSSProperties} /></span><b>{row.course_avg.toFixed(0)}%</b></p>
          <p data-k="daily"><span>Daily</span><span className="sd-meter"><i style={{ "--p": `${row.daily_avg}%` } as React.CSSProperties} /></span><b>{row.daily_avg.toFixed(0)}%</b></p>
        </div>
      )}
    </div>
  );
}

// ── History ──────────────────────────────────────────────────────────────────

function ScoreTrendChart({ history }: { history: ScoreHistoryEntry[] }) {
  if (history.length < 2) return null;
  const data = history.map((e, i) => ({
    name: e.submitted_at ? new Date(e.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : `#${i + 1}`,
    score: e.percentage,
    type: e.assignment_type,
    title: e.title,
  }));
  const avg = data.reduce((s, d) => s + d.score, 0) / data.length;
  return (
    <div className="an-chart">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d3dcef" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#3d4b69" }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#3d4b69" }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(val: number, _n: string, props: { payload?: { title: string } }) => [`${val.toFixed(0)}%`, props.payload?.title ?? "Score"]}
            labelFormatter={() => ""}
            contentStyle={{ fontSize: 13, borderRadius: 12, border: "1.5px solid #d3dcef", boxShadow: "none" }}
          />
          <ReferenceLine y={avg} stroke="#3d4b69" strokeDasharray="5 5" strokeWidth={1.5} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#0b1b3a"
            strokeWidth={2.5}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { type: string } };
              return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={6} fill={payload.type === "COURSE" ? "#fbbf24" : "#2563eb"} stroke="#0b1b3a" strokeWidth={2} />;
            }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="an-chart-key">
        <span><i /> Course</span>
        <span><i data-k="daily" /> Daily</span>
        <span><i data-k="avg" /> Your average, {avg.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: ScoreHistoryEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="an-hist-row" data-open={open}>
      <button className="an-head" disabled={!entry.feedback} aria-expanded={entry.feedback ? open : undefined} onClick={() => setOpen((o) => !o)}>
        <span className="an-hist-main">
          <p>{entry.title}<span className="an-kind" data-k={entry.assignment_type === "COURSE" ? "course" : "daily"}>{entry.assignment_type === "COURSE" ? "Course" : "Daily"}</span></p>
          <small>
            {entry.submitted_at ? new Date(entry.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
            {entry.attempt > 1 ? ` • Try ${entry.attempt}` : ""}
            {entry.feedback ? " • Has teacher feedback" : ""}
          </small>
        </span>
        <span className="an-hist-sc">
          <div><b>{entry.percentage.toFixed(0)}%</b><small>{entry.score} of {entry.max_score}</small></div>
          {entry.feedback && <ChevronDown aria-hidden="true" />}
        </span>
      </button>
      {open && entry.feedback && (
        <div className="ls-note an-fb"><b>Teacher feedback</b><p style={{ whiteSpace: "pre-wrap" }}>{entry.feedback}</p></div>
      )}
    </div>
  );
}

// ── Fallback: derive section/grade/school ranks from leaderboard ─────────────
// Used when the backend hasn't yet supplied the structured `rankings` object.
// (System / cross-school rank cannot be derived client-side.)

function pct(rank: number | null | undefined, total: number): number | null {
  if (rank == null || total <= 0) return null;
  return Math.max(1, Math.ceil((rank / total) * 100));
}

function deriveRankings(lb: LeaderboardEntry[]): Rankings | null {
  const self = lb.find((e) => e.is_self);
  if (!self) return null;
  const sameGrade = lb.filter((e) => e.grade === self.grade);
  const sameSection = sameGrade.filter((e) => e.section === self.section);
  const schoolRank = self.school_rank ?? self.rank;
  return {
    section: {
      rank: self.section_rank ?? null,
      total: sameSection.length,
      percentile: pct(self.section_rank, sameSection.length),
    },
    grade: {
      rank: self.grade_rank ?? null,
      total: sameGrade.length,
      percentile: pct(self.grade_rank, sameGrade.length),
    },
    school: {
      rank: schoolRank ?? null,
      total: lb.length,
      percentile: pct(schoolRank, lb.length),
    },
    system: { rank: null, total: 0, percentile: null, schools: 0 },
  };
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function StudentAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"board" | "subjects" | "history">("board");

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await studentApi.analytics.get({ historyLimit: 50 });
        setAnalytics(data as AnalyticsData);
      } catch {
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="sd-page" aria-busy="true">
        <div className="sd-skel" style={{ height: "17rem" }} />
        <div className="sd-skel" style={{ height: "6rem" }} />
        <div className="sd-skel" style={{ height: "12rem" }} />
      </div>
    );
  }

  const noData = !analytics || analytics.summary.assignments_attempted === 0;

  const summary = analytics?.summary ?? {
    course_assignment_score: 0,
    daily_assignment_score: 0,
    overall_score: 0,
    assignments_attempted: 0,
    graded_count: 0,
    pending_grading: 0,
    badge: "NONE" as BadgeLevel,
    grade: "",
    section: "",
  };
  const subjectBreakdown = analytics?.subject_breakdown ?? [];
  const scoreHistory = analytics?.score_history ?? [];
  const leaderboard = analytics?.school_leaderboard ?? [];
  const rankings = analytics?.rankings ?? deriveRankings(leaderboard);

  // Per-subject COURSE/DAILY split from score history
  const subjectSplitMap = new Map<string, { cScore: number; cMax: number; cCount: number; dScore: number; dMax: number; dCount: number }>();
  for (const entry of scoreHistory) {
    const existing = subjectSplitMap.get(entry.subject) ?? { cScore: 0, cMax: 0, cCount: 0, dScore: 0, dMax: 0, dCount: 0 };
    if (entry.assignment_type === "COURSE") {
      existing.cScore += entry.score; existing.cMax += entry.max_score; existing.cCount += 1;
    } else {
      existing.dScore += entry.score; existing.dMax += entry.max_score; existing.dCount += 1;
    }
    subjectSplitMap.set(entry.subject, existing);
  }
  const enrichedSubjects: SubjectWithSplit[] = subjectBreakdown
    .map((row) => {
      const split = subjectSplitMap.get(row.subject);
      return {
        ...row,
        course_avg: split && split.cMax > 0 ? (split.cScore / split.cMax) * 100 : 0,
        daily_avg: split && split.dMax > 0 ? (split.dScore / split.dMax) * 100 : 0,
        course_count: split?.cCount ?? 0,
        daily_count: split?.dCount ?? 0,
      };
    })
    .sort((a, b) => b.avg_score - a.avg_score);

  const historyNewestFirst = [...scoreHistory].reverse();
  const score = summary.overall_score;
  const next = NEXT[summary.badge];
  const where = [summary.school_name, summary.grade, summary.section].filter(Boolean).join(" • ");

  let status: React.ReactNode;
  if (noData) status = "Hand in your first assignment and get it graded to start seeing your progress.";
  else if (!next) status = <>You reached <strong>Gold</strong>. Keep it up!</>;
  else status = <>Your overall score is <strong>{score.toFixed(1)}%</strong>. That is <strong>{Math.max(0, next.target - score).toFixed(1)}%</strong> away from {next.label}.</>;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="an-title">
        <div className="sd-hero-copy">
          <h1 id="an-title" className="mc-hero-title">My analytics</h1>
          {where && <p className="sd-where">{where}</p>}
          <p className="sd-status">{status}</p>
          <div className="an-chips">
            <span>{summary.graded_count} graded</span>
            {summary.pending_grading > 0 && <span>{summary.pending_grading} waiting for a grade</span>}
            <span>{summary.assignments_attempted} handed in</span>
          </div>
          <span className="an-badge" data-b={summary.badge}><i />{BADGE_NAME[summary.badge]}</span>
        </div>
        <div className="an-run">
          <ThresholdTrack value={noData ? 0 : score} ticks={TICKS} />
          <div className="sd-run-foot">
            <b>{noData ? "0" : score.toFixed(1)}%<small>overall score</small></b>
            <span>Course counts 60%, daily counts 40%</span>
          </div>
        </div>
      </section>

      {noData ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>Nothing to show yet</b>
            <p>Your scores, ranks and history will appear here after your first graded assignment.</p>
            <Link href="/lms/student/assignments" className="sd-btn sd-btn--amber">See my assignments</Link>
          </div>
        </section>
      ) : (
        <>
          <div className="sd-ledger">
            <div><span className="sd-l">Overall</span><b className="sd-n">{score.toFixed(1)}%</b><small>Your badge score</small></div>
            <div><span className="sd-l">Course</span><b className="sd-n">{summary.course_assignment_score.toFixed(1)}%</b><small>Counts for 60%</small></div>
            <div><span className="sd-l">Daily</span><b className="sd-n">{summary.daily_assignment_score.toFixed(1)}%</b><small>Counts for 40%</small></div>
            <div><span className="sd-l">Handed in</span><b className="sd-n">{summary.assignments_attempted}</b><small>{summary.graded_count} graded</small></div>
          </div>

          {rankings && (
            <section className="sd-panel" aria-labelledby="an-where">
              <div className="sd-panel-head"><div><h2 id="an-where">Where you stand</h2><p>The bar shows how close to the front you are.</p></div></div>
              <div className="an-ranks">
                <RankRow scope="Section" sub={summary.section || undefined} data={rankings.section} />
                <RankRow scope="Grade" sub={summary.grade || undefined} data={rankings.grade} />
                <RankRow scope="School" sub={summary.school_name || undefined} data={rankings.school} />
                <RankRow scope="Every school" sub={rankings.system.schools ? `${rankings.system.schools} school${rankings.system.schools === 1 ? "" : "s"}` : undefined} data={rankings.system} />
              </div>
            </section>
          )}

          <div className="mc-tabs" role="tablist" aria-label="More about your scores" style={{ justifySelf: "start" }}>
            {([
              { id: "board", label: "Leaderboard" },
              { id: "subjects", label: "Subjects" },
              { id: "history", label: "History" },
            ] as const).map((t) => (
              <button key={t.id} role="tab" className="mc-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <div key={tab} className="mc-swap" style={{ display: "grid", gap: "1rem" }}>
            {tab === "board" && <Leaderboard rows={leaderboard} />}

            {tab === "subjects" && (
              <>
                {enrichedSubjects.length >= 2 && (
                  <div className="an-pair">
                    <div className="ls-note"><b>Your strongest subject</b><p>{enrichedSubjects[0].subject}, {enrichedSubjects[0].avg_score.toFixed(0)}%</p></div>
                    <div className="ls-note"><b>Worth some practice</b><p>{enrichedSubjects[enrichedSubjects.length - 1].subject}, {enrichedSubjects[enrichedSubjects.length - 1].avg_score.toFixed(0)}%</p></div>
                  </div>
                )}
                <section className="sd-panel" aria-labelledby="an-subj">
                  <div className="sd-panel-head"><h2 id="an-subj">Subjects</h2></div>
                  {enrichedSubjects.length === 0 ? (
                    <div className="sd-empty"><b>No graded work yet</b><p>Subjects show up once your assignments are graded.</p></div>
                  ) : (
                    <div className="an-subs">{enrichedSubjects.map((row) => <SubjectRow key={row.subject} row={row} />)}</div>
                  )}
                </section>
              </>
            )}

            {tab === "history" && (
              <section className="sd-panel" aria-labelledby="an-hist">
                <div className="sd-panel-head"><div><h2 id="an-hist">Score history</h2><p>Your best try for each assignment, newest first.</p></div></div>
                {historyNewestFirst.length === 0 ? (
                  <div className="sd-empty"><b>No graded assignments yet</b><p>Each graded assignment will be listed here.</p></div>
                ) : (
                  <>
                    <ScoreTrendChart history={scoreHistory} />
                    <div className="an-hist">
                      {historyNewestFirst.map((entry, i) => <HistoryRow key={`${entry.assignment_id}-${i}`} entry={entry} />)}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
