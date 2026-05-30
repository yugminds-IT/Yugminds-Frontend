"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api/admin.api";
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
  student_id: number;
  student_name: string;
  school_name: string;
  grade: string;
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
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <School className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold text-blue-700">{summary.total_schools}</span>
            </div>
            <p className="text-xs font-medium text-blue-600">Schools</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold text-purple-700">{summary.total_assignments}</span>
            </div>
            <p className="text-xs font-medium text-purple-600">Assignments</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-700">{summary.platform_avg_score.toFixed(1)}%</span>
            </div>
            <p className="text-xs font-medium text-green-600">Platform Avg Score</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              <span className="text-2xl font-bold text-amber-700">{retakeUsage.toFixed(1)}%</span>
            </div>
            <p className="text-xs font-medium text-amber-600">Retake Usage</p>
          </CardContent>
        </Card>
      </div>

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
              <p className="text-xs text-gray-500">Overall = Course (60%) + Daily (40%)</p>
            </CardHeader>
            <CardContent>
              {topStudents.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No student data yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-gray-500 tracking-wider">
                        <th className="py-2 pr-3 text-left w-14">Rank</th>
                        <th className="py-2 pr-3 text-left">Student</th>
                        <th className="py-2 pr-3 text-left hidden md:table-cell">School</th>
                        <th className="py-2 pr-3 text-right hidden lg:table-cell">Course</th>
                        <th className="py-2 pr-3 text-right hidden lg:table-cell">Daily</th>
                        <th className="py-2 text-right">Overall</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topStudents.map((student) => (
                        <tr
                          key={student.student_id}
                          className={`hover:bg-gray-50 ${student.rank <= 3 ? "bg-yellow-50/40" : ""}`}
                        >
                          <td className="py-2.5 pr-3">
                            <RankBadge rank={student.rank} />
                          </td>
                          <td className="py-2.5 pr-3">
                            <p className="font-medium text-gray-900">{student.student_name}</p>
                            <p className="text-xs text-gray-400">{student.grade || "—"}</p>
                          </td>
                          <td className="py-2.5 pr-3 hidden md:table-cell">
                            <span className="text-xs text-gray-500">{student.school_name || "—"}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-right hidden lg:table-cell">
                            <span className="text-xs text-indigo-700 font-medium">
                              {student.course_assignment_score.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right hidden lg:table-cell">
                            <span className="text-xs text-blue-700 font-medium">
                              {student.daily_assignment_score.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <Badge
                              className={`border-0 text-xs font-bold ${
                                student.overall_score >= 90
                                  ? "bg-yellow-100 text-yellow-800"
                                  : student.overall_score >= 75
                                  ? "bg-green-100 text-green-800"
                                  : student.overall_score >= 60
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {student.overall_score.toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
