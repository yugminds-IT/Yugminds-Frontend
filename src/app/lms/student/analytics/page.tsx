"use client";

import { Fragment, useEffect, useState } from "react";
import { studentApi } from "@/lib/api/student.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  BarChart2,
  BookOpen,
  TrendingUp,
  Users,
  ClipboardCheck,
  Medal,
  Shield,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  School,
  Globe,
  Trophy,
} from "lucide-react";
import { RankingTable, type RankingRow } from "@/components/ui/ranking-table";
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

// ── Badge helpers ────────────────────────────────────────────────────────────

function badgeConfig(badge: BadgeLevel) {
  return {
    GOLD:   { label: "Gold",     cls: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: "🥇" },
    SILVER: { label: "Silver",   cls: "bg-gray-100 text-gray-700 border-gray-300",       icon: "🥈" },
    BRONZE: { label: "Bronze",   cls: "bg-amber-100 text-amber-800 border-amber-300",    icon: "🥉" },
    NONE:   { label: "No Badge", cls: "bg-gray-50 text-gray-400 border-gray-200",        icon: null },
  }[badge];
}

function BadgeDisplay({ badge }: { badge: BadgeLevel }) {
  const c = badgeConfig(badge);
  return (
    <Badge className={`border text-sm font-semibold px-3 py-1 flex items-center gap-1.5 ${c.cls}`}>
      {c.icon ? <span>{c.icon}</span> : <Shield className="h-3.5 w-3.5 text-gray-400" />}
      {c.label}
    </Badge>
  );
}

function BadgeProgress({ score, badge }: { score: number; badge: BadgeLevel }) {
  const thresholds: Record<BadgeLevel, { next: BadgeLevel | null; target: number; label: string }> = {
    NONE:   { next: "BRONZE", target: 60,  label: "Bronze" },
    BRONZE: { next: "SILVER", target: 75,  label: "Silver" },
    SILVER: { next: "GOLD",   target: 90,  label: "Gold"   },
    GOLD:   { next: null,     target: 100, label: ""       },
  };
  const { next, target, label } = thresholds[badge];
  if (!next) {
    return <p className="text-xs text-yellow-700 font-medium mt-1">🏆 Maximum badge achieved!</p>;
  }
  const gap = Math.max(0, target - score).toFixed(1);
  const prevTarget = badge === "NONE" ? 0 : badge === "BRONZE" ? 60 : 75;
  const rangeProgress = Math.min(100, Math.max(0, ((score - prevTarget) / (target - prevTarget)) * 100));
  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-gray-500">
        <span className="font-medium text-gray-700">{gap}%</span> to <span className="font-medium">{label}</span>
      </p>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all" style={{ width: `${rangeProgress}%` }} />
      </div>
    </div>
  );
}

function ScoreBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-12 text-right">{value.toFixed(1)}%</span>
    </div>
  );
}

// ── Ranking cards ────────────────────────────────────────────────────────────

function medalFor(rank: number | null) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function RankCard({
  scope,
  sublabel,
  icon,
  data,
  accent,
  highlight = false,
}: {
  scope: string;
  sublabel?: string;
  icon: React.ReactNode;
  data: RankScope | undefined;
  accent: string;
  highlight?: boolean;
}) {
  const rank = data?.rank ?? null;
  const total = data?.total ?? 0;
  const percentile = data?.percentile ?? null;
  const medal = medalFor(rank);
  const fill = rank != null && total > 0 ? ((total - rank + 1) / total) * 100 : 0;
  const unavailable = total === 0 && rank == null;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 flex flex-col justify-between min-h-[132px] transition-shadow hover:shadow-md",
        highlight
          ? "border-transparent bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-200"
          : "bg-white border-gray-200"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span className={cn("flex items-center justify-center h-7 w-7 rounded-lg", highlight ? "bg-white/20" : "bg-gray-100")}>
            {icon}
          </span>
          <div className="leading-tight">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", highlight ? "text-white" : "text-gray-600")}>{scope}</p>
            {sublabel && <p className={cn("text-[10px]", highlight ? "text-white/70" : "text-gray-400")}>{sublabel}</p>}
          </div>
        </div>
        {medal && <span className="text-xl leading-none">{medal}</span>}
        {!medal && highlight && (
          <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded-full">Global</span>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className={cn("text-3xl font-bold tabular-nums", highlight ? "text-white" : "text-gray-900")}>
            {rank != null ? `#${rank}` : "—"}
          </span>
          {!unavailable && (
            <span className={cn("text-xs", highlight ? "text-white/70" : "text-gray-400")}>
              of {total.toLocaleString()}
            </span>
          )}
        </div>
        {unavailable ? (
          <p className={cn("text-[11px] mt-2", highlight ? "text-white/70" : "text-gray-400")}>
            Awaiting data
          </p>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <div className={cn("flex-1 h-1.5 rounded-full overflow-hidden", highlight ? "bg-white/20" : "bg-gray-100")}>
              <div
                className={cn("h-full rounded-full transition-all", highlight ? "bg-white" : accent)}
                style={{ width: `${Math.max(fill, rank != null ? 4 : 0)}%` }}
              />
            </div>
            {percentile != null && total >= 5 && (
              <span className={cn("text-[10px] font-semibold whitespace-nowrap", highlight ? "text-white/90" : "text-gray-500")}>
                Top {percentile}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RankingsPanel({ rankings, summary }: { rankings: Rankings; summary: Summary }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Performance Rankings</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <RankCard
          scope="Section"
          sublabel={summary.section || undefined}
          icon={<Users className="h-4 w-4 text-blue-600" />}
          data={rankings.section}
          accent="bg-blue-500"
        />
        <RankCard
          scope="Grade"
          sublabel={summary.grade || undefined}
          icon={<GraduationCap className="h-4 w-4 text-green-600" />}
          data={rankings.grade}
          accent="bg-green-500"
        />
        <RankCard
          scope="School"
          sublabel={summary.school_name || undefined}
          icon={<School className="h-4 w-4 text-purple-600" />}
          data={rankings.school}
          accent="bg-purple-500"
        />
        <RankCard
          scope="System"
          sublabel={`Across ${rankings.system.schools} school${rankings.system.schools === 1 ? "" : "s"}`}
          icon={<Globe className="h-4 w-4 text-white" />}
          data={rankings.system}
          accent="bg-indigo-500"
          highlight
        />
      </div>
    </div>
  );
}

// ── Score trend chart ────────────────────────────────────────────────────────

function ScoreTrendChart({ history }: { history: ScoreHistoryEntry[] }) {
  if (history.length < 2) return null;
  const data = history.map((e, i) => ({
    name: e.submitted_at
      ? new Date(e.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
      : `#${i + 1}`,
    score: e.percentage,
    type: e.assignment_type,
    title: e.title,
  }));
  const avg = data.reduce((s, d) => s + d.score, 0) / data.length;
  return (
    <div className="mt-2 mb-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Score Trend</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(val: number, _n: string, props: { payload?: { title: string } }) => [`${val.toFixed(1)}%`, props.payload?.title ?? "Score"]}
            labelFormatter={() => ""}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { type: string } };
              return (
                <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={payload.type === "COURSE" ? "#6366f1" : "#22c55e"} stroke="#fff" strokeWidth={1.5} />
              );
            }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-1 text-[10px] text-gray-400 justify-end">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />Course</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />Daily</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 border-t border-dashed border-slate-400" />Avg {avg.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ entry }: { entry: ScoreHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const color = entry.percentage >= 75 ? "text-green-700" : entry.percentage >= 50 ? "text-yellow-700" : "text-red-600";
  return (
    <div className="rounded-lg border border-gray-100 hover:bg-gray-50 overflow-hidden">
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => entry.feedback && setOpen((o) => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${entry.assignment_type === "COURSE" ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"}`}>
              {entry.assignment_type === "COURSE" ? "Course" : "Daily"}
            </span>
          </div>
          <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
            {entry.submitted_at && <span>{new Date(entry.submitted_at).toLocaleDateString()}</span>}
            {entry.attempt > 1 && <span>Attempt {entry.attempt}</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0 flex items-center gap-2">
          <div>
            <p className={`text-sm font-bold ${color}`}>{entry.percentage.toFixed(1)}%</p>
            <p className="text-xs text-gray-400">{entry.score}/{entry.max_score}</p>
          </div>
          {entry.feedback && (open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />)}
        </div>
      </div>
      {open && entry.feedback && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-blue-50/40">
          <p className="text-xs font-semibold text-gray-500 mb-1">Feedback</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{entry.feedback}</p>
        </div>
      )}
    </div>
  );
}

// ── Subject row with COURSE/DAILY split ──────────────────────────────────────

type SubjectWithSplit = SubjectBreakdown & {
  course_avg: number;
  daily_avg: number;
  course_count: number;
  daily_count: number;
};

function SubjectRow({ row, index }: { row: SubjectWithSplit; index: number }) {
  const hasBoth = row.course_count > 0 && row.daily_count > 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-4">{index + 1}</span>
          <span className="text-sm font-medium text-gray-800">{row.subject}</span>
          <span className="text-xs text-gray-400">{row.submissions} submitted</span>
        </div>
        <span className="text-xs font-semibold text-gray-600">{row.avg_score.toFixed(1)}%</span>
      </div>
      {hasBoth ? (
        <div className="pl-6 space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span className="w-10 text-indigo-600 font-medium">Course</span>
            <ScoreBar value={row.course_avg} color="bg-indigo-500" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span className="w-10 text-green-600 font-medium">Daily</span>
            <ScoreBar value={row.daily_avg} color="bg-green-500" />
          </div>
        </div>
      ) : (
        <ScoreBar value={row.avg_score} color={row.avg_score >= 75 ? "bg-green-500" : row.avg_score >= 50 ? "bg-yellow-500" : "bg-red-400"} />
      )}
    </div>
  );
}

// ── Score summary card ───────────────────────────────────────────────────────

function ScoreCard({
  icon,
  label,
  value,
  sub,
  gradient,
  valueColor,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  gradient: string;
  valueColor: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn("border", gradient)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          {icon}
          <span className={cn("text-2xl font-bold", valueColor)}>{value}</span>
        </div>
        <p className={cn("text-xs font-medium", valueColor)}>{label}</p>
        {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
        {children}
      </CardContent>
    </Card>
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
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
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
  const selfEntry = leaderboard.find((e) => e.is_self);
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
  const enrichedSubjects: SubjectWithSplit[] = subjectBreakdown.map((row) => {
    const split = subjectSplitMap.get(row.subject);
    return {
      ...row,
      course_avg: split && split.cMax > 0 ? (split.cScore / split.cMax) * 100 : 0,
      daily_avg: split && split.dMax > 0 ? (split.dScore / split.dMax) * 100 : 0,
      course_count: split?.cCount ?? 0,
      daily_count: split?.dCount ?? 0,
    };
  });

  const historyNewestFirst = [...scoreHistory].reverse();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-blue-600" />
            My Analytics
          </h1>
          {(() => {
            const parts: React.ReactNode[] = [];
            if (summary.school_name)
              parts.push(
                <span key="school" className="flex items-center gap-1">
                  <School className="h-3.5 w-3.5" />
                  {summary.school_name}
                </span>,
              );
            if (summary.grade) parts.push(<span key="grade">{summary.grade}</span>);
            if (summary.section) parts.push(<span key="section">{summary.section}</span>);
            if (!parts.length) return null;
            return (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                {parts.map((p, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="text-gray-300">·</span>}
                    {p}
                  </Fragment>
                ))}
              </p>
            );
          })()}
        </div>
        <BadgeDisplay badge={summary.badge} />
      </div>

      {noData ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <ClipboardCheck className="h-12 w-12 text-gray-300" />
            <p className="text-base font-semibold text-gray-700">No analytics yet</p>
            <p className="text-sm text-gray-400 max-w-xs">
              Complete and get graded on your first assignment to start seeing your performance and rankings here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Rankings — the headline */}
          {rankings && <RankingsPanel rankings={rankings} summary={summary} />}

          {/* Score summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ScoreCard
              icon={<BookOpen className="h-5 w-5 text-indigo-600" />}
              label="Course Score"
              sub="60% weight"
              value={`${summary.course_assignment_score.toFixed(1)}%`}
              gradient="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200"
              valueColor="text-indigo-700"
            />
            <ScoreCard
              icon={<ClipboardCheck className="h-5 w-5 text-green-600" />}
              label="Daily Score"
              sub="40% weight"
              value={`${summary.daily_assignment_score.toFixed(1)}%`}
              gradient="bg-gradient-to-br from-green-50 to-green-100 border-green-200"
              valueColor="text-green-700"
            />
            <ScoreCard
              icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
              label="Overall Score"
              value={`${summary.overall_score.toFixed(1)}%`}
              gradient="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200"
              valueColor="text-blue-700"
            >
              <BadgeProgress score={summary.overall_score} badge={summary.badge} />
            </ScoreCard>
          </div>

          {/* Submission stats */}
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap px-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600">
              {summary.graded_count} graded
            </span>
            {summary.pending_grading > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
                {summary.pending_grading} pending review
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600">
              {summary.assignments_attempted} total submissions
            </span>
          </div>

          <Tabs defaultValue="leaderboard">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="leaderboard" className="text-xs">
                <Users className="h-3.5 w-3.5 mr-1" />
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="subjects" className="text-xs">
                <BookOpen className="h-3.5 w-3.5 mr-1" />
                Subjects
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                <BarChart2 className="h-3.5 w-3.5 mr-1" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Leaderboard */}
            <TabsContent value="leaderboard" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Medal className="h-4 w-4 text-yellow-500" />
                    School Leaderboard
                  </CardTitle>
                  {selfEntry && (
                    <p className="text-xs text-gray-500">
                      School #{selfEntry.school_rank ?? selfEntry.rank}
                      {selfEntry.grade_rank != null && ` · Grade #${selfEntry.grade_rank}`}
                      {selfEntry.section_rank != null && ` · Section #${selfEntry.section_rank}`}
                      {" · "}{selfEntry.overall_score.toFixed(1)}%
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No leaderboard data yet</p>
                    </div>
                  ) : (
                    <RankingTable
                      rows={leaderboard.map((e): RankingRow => ({
                        student_id: e.student_id,
                        student_name: e.student_name,
                        grade: e.grade,
                        section: e.section,
                        course_score: e.course_score,
                        daily_score: e.daily_score,
                        overall_score: e.overall_score,
                        rank: e.school_rank ?? e.rank,
                        school_rank: e.school_rank ?? e.rank,
                        grade_rank: e.grade_rank,
                        section_rank: e.section_rank,
                        is_self: e.is_self,
                        badge: e.badge,
                      }))}
                      showRanks={["school", "grade", "section"]}
                      showGrade
                      showScoreBreakdown
                      highlightSelf
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subjects */}
            <TabsContent value="subjects" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Subject Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {enrichedSubjects.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No graded submissions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {enrichedSubjects.map((row, i) => <SubjectRow key={row.subject} row={row} index={i} />)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History */}
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Score History</CardTitle>
                  <p className="text-xs text-gray-500">Best submission per assignment · newest first</p>
                </CardHeader>
                <CardContent>
                  {historyNewestFirst.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No graded assignments yet</p>
                    </div>
                  ) : (
                    <>
                      <ScoreTrendChart history={scoreHistory} />
                      <div className="space-y-2 mt-4">
                        {historyNewestFirst.map((entry, i) => <HistoryRow key={`${entry.assignment_id}-${i}`} entry={entry} />)}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
