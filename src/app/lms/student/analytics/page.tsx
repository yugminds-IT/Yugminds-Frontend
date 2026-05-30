"use client";

import { useEffect, useState } from "react";
import { studentApi } from "@/lib/api/student.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  BarChart2,
  BookOpen,
  TrendingUp,
  Star,
  Users,
  ClipboardCheck,
} from "lucide-react";

type BadgeLevel = "GOLD" | "SILVER" | "BRONZE" | "NONE";

type Summary = {
  course_assignment_score: number;
  daily_assignment_score: number;
  overall_score: number;
  assignments_attempted: number;
  graded_count: number;
  badge: BadgeLevel;
  grade: string;
  section: string;
};

type SubjectBreakdown = {
  subject: string;
  avg_score: number;
  submissions: number;
};

type ScoreHistoryEntry = {
  assignment_id: string;
  title: string;
  score: number;
  max_score: number;
  percentage: number;
  attempt: number;
  submitted_at: string | null;
  feedback: string | null;
};

type LeaderboardEntry = {
  rank: number;
  student_id: number;
  student_name: string;
  overall_score: number;
  is_self: boolean;
};

type AnalyticsData = {
  summary: Summary;
  subject_breakdown: SubjectBreakdown[];
  score_history: ScoreHistoryEntry[];
  school_leaderboard: LeaderboardEntry[];
};

function BadgeDisplay({ badge }: { badge: BadgeLevel }) {
  const config: Record<BadgeLevel, { label: string; class: string; icon: string }> = {
    GOLD: { label: "Gold", class: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: "🥇" },
    SILVER: { label: "Silver", class: "bg-gray-100 text-gray-700 border-gray-300", icon: "🥈" },
    BRONZE: { label: "Bronze", class: "bg-amber-100 text-amber-800 border-amber-300", icon: "🥉" },
    NONE: { label: "No Badge", class: "bg-gray-50 text-gray-500 border-gray-200", icon: "—" },
  };
  const c = config[badge];
  return (
    <Badge className={`border text-sm font-semibold px-3 py-1 ${c.class}`}>
      {c.icon} {c.label}
    </Badge>
  );
}

function ScoreBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-12 text-right">{value.toFixed(1)}%</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-semibold text-gray-500">#{rank}</span>;
}

export default function StudentAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await studentApi.analytics.get();
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
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const summary = analytics?.summary ?? {
    course_assignment_score: 0,
    daily_assignment_score: 0,
    overall_score: 0,
    assignments_attempted: 0,
    graded_count: 0,
    badge: "NONE" as BadgeLevel,
    grade: "",
    section: "",
  };
  const subjectBreakdown = analytics?.subject_breakdown ?? [];
  const scoreHistory = analytics?.score_history ?? [];
  const leaderboard = analytics?.school_leaderboard ?? [];
  const selfEntry = leaderboard.find((e) => e.is_self);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-blue-600" />
            My Analytics
          </h1>
          {summary.grade && (
            <p className="text-sm text-gray-500 mt-1">
              Grade {summary.grade}{summary.section ? ` · Section ${summary.section}` : ""}
            </p>
          )}
        </div>
        <BadgeDisplay badge={summary.badge} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <span className="text-2xl font-bold text-indigo-700">{summary.course_assignment_score.toFixed(1)}%</span>
            </div>
            <p className="text-xs font-medium text-indigo-600">Course Score</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold text-blue-700">{summary.daily_assignment_score.toFixed(1)}%</span>
            </div>
            <p className="text-xs font-medium text-blue-600">Daily Score</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-700">{summary.overall_score.toFixed(1)}%</span>
            </div>
            <p className="text-xs font-medium text-green-600">Overall Score</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold text-purple-700">
                {selfEntry ? `#${selfEntry.rank}` : "—"}
              </span>
            </div>
            <p className="text-xs font-medium text-purple-600">School Rank</p>
          </CardContent>
        </Card>
      </div>

      {/* Score composition bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Score Breakdown</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-28">Course (60%)</span>
              <ScoreBar value={summary.course_assignment_score} color="bg-indigo-500" />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-28">Daily (40%)</span>
              <ScoreBar value={summary.daily_assignment_score} color="bg-blue-400" />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-28 font-semibold text-gray-800">Overall</span>
              <ScoreBar
                value={summary.overall_score}
                color={summary.overall_score >= 90 ? "bg-yellow-500" : summary.overall_score >= 75 ? "bg-green-500" : summary.overall_score >= 60 ? "bg-blue-500" : "bg-red-400"}
              />
            </div>
          </div>
          <div className="flex gap-4 pt-1 text-xs text-gray-500">
            <span>{summary.assignments_attempted} assignments attempted</span>
            <span>{summary.graded_count} graded</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="subjects">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="subjects" className="text-xs">
            <BookOpen className="h-3.5 w-3.5 mr-1" />
            Subjects
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            <BarChart2 className="h-3.5 w-3.5 mr-1" />
            History
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs">
            <Users className="h-3.5 w-3.5 mr-1" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        {/* Subject Breakdown */}
        <TabsContent value="subjects" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Subject Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {subjectBreakdown.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No graded submissions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {subjectBreakdown.map((row, i) => (
                    <div key={row.subject} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                          <span className="text-sm font-medium text-gray-800">{row.subject}</span>
                          <span className="text-xs text-gray-400">{row.submissions} submitted</span>
                        </div>
                      </div>
                      <ScoreBar
                        value={row.avg_score}
                        color={row.avg_score >= 75 ? "bg-green-500" : row.avg_score >= 50 ? "bg-yellow-500" : "bg-red-400"}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Score History */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Score History</CardTitle>
              <p className="text-xs text-gray-500">Last 20 graded submissions</p>
            </CardHeader>
            <CardContent>
              {scoreHistory.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No graded assignments yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...scoreHistory].reverse().map((entry, i) => (
                    <div key={`${entry.assignment_id}-${entry.attempt}-${i}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                        <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                          {entry.submitted_at && (
                            <span>{new Date(entry.submitted_at).toLocaleDateString()}</span>
                          )}
                          {entry.attempt > 1 && <span>Attempt {entry.attempt}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${
                          entry.percentage >= 75 ? "text-green-700" : entry.percentage >= 50 ? "text-yellow-700" : "text-red-600"
                        }`}>
                          {entry.percentage.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-400">{entry.score}/{entry.max_score}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* School Leaderboard */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                School Leaderboard
              </CardTitle>
              {selfEntry && (
                <p className="text-xs text-gray-500">Your rank: #{selfEntry.rank} with {selfEntry.overall_score.toFixed(1)}%</p>
              )}
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No leaderboard data yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.student_id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                        entry.is_self
                          ? "bg-blue-50 border border-blue-200"
                          : entry.rank <= 3
                          ? "bg-yellow-50/50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="w-8 flex-shrink-0 flex justify-center">
                        <RankBadge rank={entry.rank} />
                      </div>
                      <p className={`flex-1 text-sm ${entry.is_self ? "font-bold text-blue-800" : "font-medium text-gray-800"}`}>
                        {entry.student_name}
                        {entry.is_self && <span className="ml-2 text-xs font-normal text-blue-600">(You)</span>}
                      </p>
                      <span className={`text-sm font-semibold ${
                        entry.overall_score >= 90 ? "text-yellow-600" :
                        entry.overall_score >= 75 ? "text-green-700" :
                        entry.overall_score >= 60 ? "text-blue-700" : "text-gray-600"
                      }`}>
                        {entry.overall_score.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
