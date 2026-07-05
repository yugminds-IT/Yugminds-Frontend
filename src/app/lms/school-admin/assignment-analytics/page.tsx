"use client";

import { useEffect, useMemo, useState } from "react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { RankingTable, type RankingRow } from "@/components/ui/ranking-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Trophy,
  Users,
  BookOpen,
  BarChart2,
  TrendingUp,
  ClipboardList,
  Search,
  Medal,
  Star,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type LeaderboardStudent = {
  rank: number;
  school_rank?: number;
  grade_rank?: number;
  section_rank?: number;
  student_id: number;
  student_name: string;
  grade: string;
  section: string;
  course_assignment_score: number;
  daily_assignment_score: number;
  overall_score: number;
  assignments_attempted: number;
  graded_assignments_count: number;
  badge: "GOLD" | "SILVER" | "BRONZE" | "NONE";
};

type GradeBreakdown = {
  grade: string;
  avg_course_score: number;
  avg_daily_score: number;
  avg_overall: number;
};

type SubjectBreakdown = {
  subject: string;
  avg_score: number;
};

type AssignmentRow = {
  assignment_id: string;
  title: string;
  assignment_type: string;
  subject: string;
  total_submissions: number;
  avg_score: number;
  highest_score: number;
  lowest_score: number;
  completion_rate: number;
};

type LeaderboardSummary = {
  school_name: string;
  total_students: number;
  total_assignments_published: number;
  course_assignments_published: number;
  daily_assignments_published: number;
  overall_avg_score: number;
};

type LeaderboardData = {
  summary: LeaderboardSummary;
  leaderboard: LeaderboardStudent[];
  grade_breakdown: GradeBreakdown[];
  subject_breakdown: SubjectBreakdown[];
  assignment_table: AssignmentRow[];
};

type SortKey = "rank" | "course" | "daily" | "overall";

function ScoreBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-12 text-right shrink-0">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function BadgeChip({ badge }: { badge: "GOLD" | "SILVER" | "BRONZE" | "NONE" }) {
  if (badge === "NONE") return <span className="text-xs text-gray-300">—</span>;
  const config = {
    GOLD: { label: "Gold", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    SILVER: { cls: "bg-gray-100 text-gray-600 border-gray-200", label: "Silver" },
    BRONZE: { cls: "bg-amber-100 text-amber-700 border-amber-200", label: "Bronze" },
  }[badge];
  return (
    <Badge className={`text-xs border px-1.5 py-0 ${config.cls}`}>
      <Medal className="h-3 w-3 mr-0.5" />
      {config.label}
    </Badge>
  );
}

function RankCell({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex items-center gap-1">
        <span className="text-xl leading-none">🥇</span>
        <span className="text-xs font-bold text-yellow-600">1st</span>
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex items-center gap-1">
        <span className="text-xl leading-none">🥈</span>
        <span className="text-xs font-bold text-gray-500">2nd</span>
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex items-center gap-1">
        <span className="text-xl leading-none">🥉</span>
        <span className="text-xs font-bold text-amber-700">3rd</span>
      </div>
    );
  return (
    <span className="text-xs font-semibold text-gray-400 pl-1">#{rank}</span>
  );
}

type Tab = "leaderboard" | "grade" | "subject" | "assignments";

export default function SchoolAdminLeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { data: res } = await schoolAdminApi.stats.leaderboard();
        setData(res as LeaderboardData);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = data?.summary ?? {
    school_name: "School",
    total_students: 0,
    total_assignments_published: 0,
    course_assignments_published: 0,
    daily_assignments_published: 0,
    overall_avg_score: 0,
  };
  const leaderboard = useMemo(() => data?.leaderboard ?? [], [data]);
  const gradeBreakdown = data?.grade_breakdown ?? [];
  const subjectBreakdown = data?.subject_breakdown ?? [];
  const assignmentTable = data?.assignment_table ?? [];

  const goldCount = leaderboard.filter((s) => s.badge === "GOLD").length;
  const silverCount = leaderboard.filter((s) => s.badge === "SILVER").length;
  const bronzeCount = leaderboard.filter((s) => s.badge === "BRONZE").length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(key === "rank"); }
  };

  const filteredLeaderboard = useMemo(() => {
    let list = leaderboard;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.student_name.toLowerCase().includes(q) ||
          (s.grade ?? "").toLowerCase().includes(q) ||
          (s.section ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === "rank") diff = a.rank - b.rank;
      else if (sortKey === "course") diff = b.course_assignment_score - a.course_assignment_score;
      else if (sortKey === "daily") diff = b.daily_assignment_score - a.daily_assignment_score;
      else if (sortKey === "overall") diff = b.overall_score - a.overall_score;
      return sortAsc ? diff : -diff;
    });
  }, [leaderboard, search, sortKey, sortAsc]);

  if (loading) {
    return (
      <div className="bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-32 mt-2 animate-pulse" />
        </div>
        <div className="max-w-7xl mx-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "grade", label: "By Grade", icon: BarChart2 },
    { id: "subject", label: "By Subject", icon: BookOpen },
    { id: "assignments", label: "Assignments", icon: ClipboardList },
  ];

  const SortHeader = ({
    label,
    sKey,
    className = "",
  }: {
    label: string;
    sKey: SortKey;
    className?: string;
  }) => (
    <th
      className={`py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none ${className}`}
      onClick={() => handleSort(sKey)}
    >
      <span className="flex items-center gap-1 justify-end">
        {label}
        {sortKey === sKey ? (
          sortAsc ? (
            <ArrowUp className="h-3 w-3 text-blue-500" />
          ) : (
            <ArrowDown className="h-3 w-3 text-blue-500" />
          )
        ) : (
          <ArrowUp className="h-3 w-3 text-gray-300" />
        )}
      </span>
    </th>
  );

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Assignment Analytics</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{summary.school_name}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">
                  {summary.total_students}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Students</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">
                  {summary.total_assignments_published}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Assignments</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">
                  {summary.overall_avg_score.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Avg Score</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm font-bold text-yellow-600">{goldCount}</span>
                  <span className="text-base">🥇</span>
                  <span className="text-sm font-bold text-gray-500">{silverCount}</span>
                  <span className="text-base">🥈</span>
                  <span className="text-sm font-bold text-amber-700">{bronzeCount}</span>
                  <span className="text-base">🥉</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Achievers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top 3 podium */}
        {leaderboard.length >= 3 && (
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-8">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest text-center mb-6">
                Top Performers
              </p>
              <div className="flex items-end justify-center gap-4">
                {/* 2nd place */}
                <div className="flex flex-col items-center gap-2 mb-0">
                  <div className="h-14 w-14 rounded-full bg-gray-400 flex items-center justify-center text-lg font-black text-white">
                    {leaderboard[1]?.student_name.charAt(0)}
                  </div>
                  <p className="text-xs text-gray-300 font-semibold max-w-20 text-center truncate">
                    {leaderboard[1]?.student_name}
                  </p>
                  <p className="text-sm font-bold text-gray-200">
                    {leaderboard[1]?.overall_score.toFixed(1)}%
                  </p>
                  <div className="bg-gray-500 w-20 h-16 rounded-t-lg flex items-center justify-center">
                    <span className="text-2xl">🥈</span>
                  </div>
                </div>
                {/* 1st place */}
                <div className="flex flex-col items-center gap-2">
                  <div className="h-16 w-16 rounded-full bg-yellow-400 flex items-center justify-center text-xl font-black text-yellow-900 ring-4 ring-yellow-300/50">
                    {leaderboard[0]?.student_name.charAt(0)}
                  </div>
                  <p className="text-xs text-yellow-200 font-bold max-w-20 text-center truncate">
                    {leaderboard[0]?.student_name}
                  </p>
                  <p className="text-sm font-bold text-yellow-300">
                    {leaderboard[0]?.overall_score.toFixed(1)}%
                  </p>
                  <div className="bg-yellow-500 w-20 h-24 rounded-t-lg flex items-center justify-center">
                    <span className="text-3xl">🥇</span>
                  </div>
                </div>
                {/* 3rd place */}
                <div className="flex flex-col items-center gap-2 mb-0">
                  <div className="h-14 w-14 rounded-full bg-amber-600 flex items-center justify-center text-lg font-black text-white">
                    {leaderboard[2]?.student_name.charAt(0)}
                  </div>
                  <p className="text-xs text-amber-300 font-semibold max-w-20 text-center truncate">
                    {leaderboard[2]?.student_name}
                  </p>
                  <p className="text-sm font-bold text-amber-200">
                    {leaderboard[2]?.overall_score.toFixed(1)}%
                  </p>
                  <div className="bg-amber-700 w-20 h-10 rounded-t-lg flex items-center justify-center">
                    <span className="text-2xl">🥉</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit shadow-sm">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                tab === id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Leaderboard table */}
        {tab === "leaderboard" && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="px-5 py-3 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-800">Student Rankings</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">Overall = Course (60%) + Daily (40%) · Ranked by school, grade, and section</p>
            </CardHeader>
            <CardContent className="p-4">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Trophy className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No data yet</p>
                </div>
              ) : (
                <RankingTable
                  rows={leaderboard.map((s): RankingRow => ({
                    student_id: s.student_id,
                    student_name: s.student_name,
                    grade: s.grade,
                    section: s.section,
                    course_score: s.course_assignment_score,
                    daily_score: s.daily_assignment_score,
                    overall_score: s.overall_score,
                    rank: s.school_rank ?? s.rank,
                    school_rank: s.school_rank ?? s.rank,
                    grade_rank: s.grade_rank,
                    section_rank: s.section_rank,
                    badge: s.badge,
                  }))}
                  showRanks={["school", "grade", "section"]}
                  showGrade
                  showScoreBreakdown
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Grade breakdown */}
        {tab === "grade" && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="px-5 py-3 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-800">
                Grade-wise Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {gradeBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No data yet</p>
              ) : (
                gradeBreakdown.map((row) => (
                  <div key={row.grade} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">
                        Grade {row.grade}
                      </span>
                      <Badge className="bg-gray-100 text-gray-700 border-0 text-xs font-semibold">
                        Overall {row.avg_overall.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-14 shrink-0">Course</span>
                        <ScoreBar value={row.avg_course_score} color="bg-indigo-500" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-14 shrink-0">Daily</span>
                        <ScoreBar value={row.avg_daily_score} color="bg-blue-400" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Subject breakdown */}
        {tab === "subject" && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="px-5 py-3 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-800">
                Subject-wise Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {subjectBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No data yet</p>
              ) : (
                subjectBreakdown.map((row, i) => (
                  <div key={row.subject} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-800 w-36 truncate shrink-0">
                      {row.subject}
                    </span>
                    <div className="flex-1">
                      <ScoreBar
                        value={row.avg_score}
                        color={
                          row.avg_score >= 75
                            ? "bg-emerald-500"
                            : row.avg_score >= 50
                            ? "bg-amber-400"
                            : "bg-red-400"
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Assignment table */}
        {tab === "assignments" && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="px-5 py-3 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-800">
                Assignment Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {assignmentTable.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  No assignments published yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">
                          Assignment
                        </th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell text-left">
                          Subject
                        </th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                          Type
                        </th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                          Submissions
                        </th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right hidden md:table-cell">
                          Completion
                        </th>
                        <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                          Avg Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {assignmentTable.map((row) => (
                        <tr key={row.assignment_id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-5">
                            <p className="font-semibold text-gray-900 truncate max-w-52">
                              {row.title}
                            </p>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <span className="text-xs text-gray-500">{row.subject || "—"}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              className={`border-0 text-xs ${
                                row.assignment_type === "COURSE"
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {row.assignment_type === "COURSE" ? "Course" : "Daily"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-gray-700 font-medium">
                            {row.total_submissions}
                          </td>
                          <td className="py-3 px-4 text-right hidden md:table-cell">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{
                                    width: `${Math.min(100, row.completion_rate)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 w-8 text-right">
                                {row.completion_rate.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <span
                              className={`text-sm font-bold ${
                                row.avg_score >= 75
                                  ? "text-emerald-600"
                                  : row.avg_score >= 50
                                  ? "text-amber-600"
                                  : "text-red-500"
                              }`}
                            >
                              {row.avg_score.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
