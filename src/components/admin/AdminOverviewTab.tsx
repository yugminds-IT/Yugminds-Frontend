"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  AlertCircle,
  RefreshCw,
  Clock,
  Activity,
  TrendingUp,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { SkeletonDashboard } from "../ui/skeleton-dashboard";

/** "5m ago" / "3h ago" / "2d ago" — rolls up instead of showing "4320m ago". */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface DashboardStats {
  totalSchools: number;
  totalTeachers: number;
  totalStudents: number;
  activeCourses: number;
  pendingLeaves: number;
  systemHealth: number;
  avgAttendance: number;
  completionRate: number;
  activeUsers: number;
  pendingPasswordResets: number;
}

interface QuickActionPreview {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  data: Array<{
    id?: string;
    name?: string;
    full_name?: string;
    title?: string;
    created_at: string;
    status?: string;
    email?: string;
  }>;
  loading: boolean;
  lastUpdated: string;
}

interface RecentActivity {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

interface TeacherPerformance {
  excellent: number;
  good: number;
  average: number;
  needsImprovement: number;
}

interface AdminOverviewTabProps {
  stats: DashboardStats;
  quickActionPreviews: QuickActionPreview[];
  recentActivity: RecentActivity[];
  isLoading?: boolean;
  onQuickAction?: (id: string) => void;
  teacherPerformance?: TeacherPerformance;
}

export default function AdminOverviewTab({
  stats,
  quickActionPreviews,
  recentActivity,
  isLoading = false,
  onQuickAction,
  teacherPerformance,
}: AdminOverviewTabProps) {
  const router = useRouter();

  const safeInt = (value: number): number =>
    Number.isFinite(value) ? Math.trunc(value) : 0;

  const safePercent = (value: number): string =>
    Number.isFinite(value) ? `${Math.round(value)}%` : '0%';

  const healthTone =
    safeInt(stats.systemHealth) >= 90
      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
      : safeInt(stats.systemHealth) >= 70
        ? "text-amber-700 bg-amber-50 border-amber-100"
        : "text-red-700 bg-red-50 border-red-100";

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Quick Actions */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80">
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks — latest 3 of each</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {quickActionPreviews.map((preview) => (
              <div
                key={preview.id}
                className="rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                      {preview.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{preview.title}</p>
                      <p className="text-xs text-slate-500">
                        Updated {new Date(preview.lastUpdated).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onQuickAction?.(preview.id)}
                    disabled={preview.loading}
                    title="Go to management page"
                    className="h-8 rounded-md border-slate-200 px-2.5"
                  >
                    {preview.loading ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-slate-600">{preview.description}</p>
                <div className="space-y-2">
                  {preview.data && preview.data.length > 0 ? (
                    preview.data.slice(0, 3).map((item, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-2.5 py-2 text-xs"
                      >
                        <span className="truncate text-slate-600">
                          {item.name || item.full_name || item.title || 'Unknown'}
                        </span>
                        <span className="shrink-0 text-slate-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs italic text-slate-400">
                      No recent data
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80">
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system health and metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {safeInt(stats.systemHealth) > 0 && (
                <div className={`rounded-xl border px-3 py-3 ${healthTone}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">System Health</span>
                    <Badge variant="outline" className="border-current bg-transparent text-current">
                      {safePercent(stats.systemHealth)}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-80">Overall platform uptime and service responsiveness</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => router.push("/lms/admin/schools")}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-700">Pending Leave Requests</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={safeInt(stats.pendingLeaves) > 0 ? "destructive" : "secondary"}>
                      {safeInt(stats.pendingLeaves)}
                    </Badge>
                    {stats.pendingLeaves > 0 && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </button>
                <button
                  onClick={() => router.push("/lms/admin/password-reset-requests")}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-700">Pending Password Resets</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={safeInt(stats.pendingPasswordResets) > 0 ? "destructive" : "secondary"}>
                      {safeInt(stats.pendingPasswordResets)}
                    </Badge>
                    {stats.pendingPasswordResets > 0 && (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-700">Active Users</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {safeInt(stats.activeUsers)}
                    </Badge>
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  </div>
                </div>
                {safeInt(stats.avgAttendance) > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <span className="text-sm font-medium text-slate-700">Average Attendance</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-800">
                        {safePercent(stats.avgAttendance)}
                      </Badge>
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    </div>
                  </div>
                )}
              </div>
              {safeInt(stats.completionRate) > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-700">Course Completion</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-50 text-purple-800">
                      {safePercent(stats.completionRate)}
                    </Badge>
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                  </div>
                </div>
              )}
              {teacherPerformance && (teacherPerformance.excellent + teacherPerformance.good + teacherPerformance.average + teacherPerformance.needsImprovement) > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-800">Teacher Performance</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between rounded-md bg-green-50 px-2 py-1.5">
                      <span className="text-xs text-green-700">Excellent</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">{teacherPerformance.excellent}</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-blue-50 px-2 py-1.5">
                      <span className="text-xs text-blue-700">Good</span>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 text-xs">{teacherPerformance.good}</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-yellow-50 px-2 py-1.5">
                      <span className="text-xs text-yellow-700">Average</span>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">{teacherPerformance.average}</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-red-50 px-2 py-1.5">
                      <span className="text-xs text-red-700">Needs Help</span>
                      <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">{teacherPerformance.needsImprovement}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity — real dated events only (recent school/teacher/student/course additions) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest additions across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'success' ? 'bg-green-500' :
                    activity.type === 'warning' ? 'bg-yellow-500' :
                    activity.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-400">{timeAgo(activity.created_at)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2" />
                <p>No recent activity</p>
                <p className="text-sm">System events will appear here</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


