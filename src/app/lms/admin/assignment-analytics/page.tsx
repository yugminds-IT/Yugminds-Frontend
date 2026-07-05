"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api/admin.api";
import { RankingTable, type RankingRow } from "@/components/ui/ranking-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  School,
  Users,
  TrendingUp,
  RotateCcw,
  BookOpen,
  BarChart2,
  Star,
} from "lucide-react";

type SchoolRanking = {
  rank: number;
  school_id: string;
  school_name: string;
  assignments_created: number;
  attempts_count: number;
  average_score_percentage: number;
  completion_rate: number;
  retake_usage_percentage: number;
};

type TopStudent = {
  rank: number;
  system_rank?: number;
  student_id: number;
  student_name: string;
  school_name: string;
  grade: string;
  section?: string;
  course_assignment_score: number;
  daily_assignment_score: number;
  overall_score: number;
};

type PlatformSummary = {
  total_schools: number;
  total_assignments: number;
  total_attempts: number;
  platform_avg_score: number;
};

type AnalyticsData = {
  school_rankings: SchoolRanking[];
  platform_completion_rate: number;
  retake_usage: number;
  top_students_platform: TopStudent[];
  summary: PlatformSummary;
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-semibold text-gray-500 w-6 text-center">#{rank}</span>;
}

function ScoreBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-12 text-right">{value.toFixed(1)}%</span>
    </div>
  );
}

export default function AdminAssignmentAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await adminApi.dashboard.assignmentAnalytics();
        setAnalytics((data as { analytics?: AnalyticsData }).analytics ?? null);
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
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const summary = analytics?.summary ?? {
    total_schools: 0,
    total_assignments: 0,
    total_attempts: 0,
    platform_avg_score: 0,
  };
  const schoolRankings = analytics?.school_rankings ?? [];
  const topStudents = analytics?.top_students_platform ?? [];
  const platformCompletion = analytics?.platform_completion_rate ?? 0;
  const retakeUsage = analytics?.retake_usage ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-blue-600" />
          Platform Assignment Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-1">Cross-school performance overview</p>
      </div>

      {/* Platform Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Schools", value: String(summary.total_schools), icon: School, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Assignments", value: String(summary.total_assignments), icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Platform Avg Score", value: `${summary.platform_avg_score.toFixed(1)}%`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Retake Usage", value: `${retakeUsage.toFixed(1)}%`, icon: RotateCcw, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((s) => (
          <Card key={s.label} className="bg-white border border-gray-100 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
                <div className={`h-11 w-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No-activity hint */}
      {summary.total_attempts === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
          <BarChart2 className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">No assignment submissions yet</p>
            <p className="text-blue-700 text-xs mt-0.5">
              {summary.total_assignments} assignment{summary.total_assignments !== 1 ? "s" : ""} published across {summary.total_schools} school{summary.total_schools !== 1 ? "s" : ""}. Scores and rankings will populate as students submit their work.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="schools">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="schools" className="flex items-center gap-2">
            <School className="h-4 w-4" />
            School Rankings ({schoolRankings.length})
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top Students ({topStudents.length})
          </TabsTrigger>
        </TabsList>

        {/* School Rankings Tab */}
        <TabsContent value="schools" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                School Leaderboard
              </CardTitle>
              <p className="text-xs text-gray-500">
                Platform completion rate: {platformCompletion.toFixed(1)}%
              </p>
            </CardHeader>
            <CardContent>
              {schoolRankings.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <School className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No school data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {schoolRankings.map((school) => (
                    <div
                      key={school.school_id}
                      className={`border rounded-xl p-4 transition-shadow hover:shadow-sm ${
                        school.rank <= 3 ? "border-yellow-200 bg-yellow-50/30" : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <RankBadge rank={school.rank} />
                          <div>
                            <p className="font-semibold text-gray-900">{school.school_name}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>{school.assignments_created} assignments</span>
                              <span>{school.attempts_count} attempts</span>
                              <span>Retake {school.retake_usage_percentage.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-lg font-bold ${
                              school.average_score_percentage >= 75
                                ? "text-green-600"
                                : school.average_score_percentage >= 50
                                ? "text-yellow-600"
                                : "text-red-500"
                            }`}
                          >
                            {school.average_score_percentage.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-400">avg score</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <span className="text-gray-500">Avg Score</span>
                          <ScoreBar
                            value={school.average_score_percentage}
                            color={
                              school.average_score_percentage >= 75
                                ? "bg-green-500"
                                : school.average_score_percentage >= 50
                                ? "bg-yellow-500"
                                : "bg-red-400"
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-gray-500">Completion</span>
                          <ScoreBar value={school.completion_rate} color="bg-blue-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Students Tab */}
        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Top 50 Students Platform-wide
              </CardTitle>
              <p className="text-xs text-gray-500">Overall = Course (60%) + Daily (40%) · Ranked system-wide</p>
            </CardHeader>
            <CardContent>
              {topStudents.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No student data yet</p>
                </div>
              ) : (
                <RankingTable
                  rows={topStudents.map((s): RankingRow => ({
                    student_id: s.student_id,
                    student_name: s.student_name,
                    grade: s.grade,
                    section: s.section,
                    school_name: s.school_name,
                    course_score: s.course_assignment_score,
                    daily_score: s.daily_assignment_score,
                    overall_score: s.overall_score,
                    rank: s.system_rank ?? s.rank,
                    system_rank: s.system_rank ?? s.rank,
                  }))}
                  showRanks={["system"]}
                  showSchool
                  showGrade
                  showScoreBreakdown
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
