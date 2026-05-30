"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Calendar, CheckCircle, XCircle, Clock, AlertCircle, FileText, ExternalLink } from "lucide-react";
import { useTeacherSchool } from "../../app/lms/teacher/context";
import {
  useTodayAttendanceStatus,
  useTeacherMonthlyAttendance,
} from "../../hooks/useTeacherData";
import { SkeletonDashboard } from "../ui/skeleton-dashboard";

export default function TeacherAttendanceTab() {
  const { selectedSchool } = useTeacherSchool();
  const today = new Date().toISOString().split("T")[0];

  const { data: todayStatus, isLoading: todayLoading } = useTodayAttendanceStatus(
    selectedSchool?.id,
    today,
  );
  const { data: monthlyAttendance, isLoading: monthlyLoading } =
    useTeacherMonthlyAttendance(selectedSchool?.id, 6);

  if (todayLoading || monthlyLoading) {
    return <SkeletonDashboard />;
  }

  const currentMonth = monthlyAttendance?.[0];
  const attendancePct =
    currentMonth && currentMonth.total_days > 0
      ? Math.round((currentMonth.present_count / currentMonth.total_days) * 100)
      : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Present":
        return <Badge className="bg-green-100 text-green-800">Present</Badge>;
      case "Absent":
        return <Badge className="bg-red-100 text-red-800">Absent</Badge>;
      case "Leave-Approved":
        return <Badge className="bg-yellow-100 text-yellow-800">Leave Approved</Badge>;
      case "Leave-Rejected":
        return <Badge className="bg-red-100 text-red-800">Leave Rejected</Badge>;
      case "Unreported":
        return <Badge className="bg-gray-100 text-gray-800">Unreported</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Today's Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2 border-blue-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Today&apos;s Status
                </CardTitle>
                <CardDescription>
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </CardDescription>
              </div>
              {todayStatus?.attendance?.status && getStatusBadge(todayStatus.attendance.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayStatus && todayStatus.totalPeriods > 0 ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Report Progress</span>
                    <span className="font-medium">
                      {todayStatus.periodsWithReports}/{todayStatus.totalPeriods} periods
                    </span>
                  </div>
                  <Progress value={todayStatus.progress} className="h-2" />
                  <p className="text-xs text-gray-500">{todayStatus.progress}% complete</p>
                </div>
                {todayStatus.periodsWithReports < todayStatus.totalPeriods && (
                  <Link href="/lms/teacher/reports">
                    <Button size="sm" variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      Submit Pending Reports
                    </Button>
                  </Link>
                )}
                {todayStatus.periodsWithReports >= todayStatus.totalPeriods && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-800 font-medium">All reports submitted for today</p>
                  </div>
                )}
              </>
            ) : todayStatus ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <p className="text-sm text-gray-600">No scheduled periods for today</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No attendance data for today</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              This Month
            </CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentMonth ? (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <div className="text-4xl font-bold text-blue-600">{attendancePct}%</div>
                  <p className="text-sm text-gray-500 mt-1">Attendance Rate</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-green-700">{currentMonth.present_count}</div>
                    <p className="text-xs text-gray-500">Present</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-red-700">{currentMonth.absent_count}</div>
                    <p className="text-xs text-gray-500">Absent</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <Clock className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-yellow-700">{currentMonth.leave_count}</div>
                    <p className="text-xs text-gray-500">Leave</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No attendance data for this month</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6-Month Trend */}
      {monthlyAttendance && monthlyAttendance.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Attendance Trend (Last 6 Months)</CardTitle>
                <CardDescription>Monthly attendance breakdown</CardDescription>
              </div>
              <Link href="/lms/teacher/attendance">
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <ExternalLink className="h-4 w-4" />
                  Full Details
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...monthlyAttendance].reverse().map((m) => {
                const pct =
                  m.total_days > 0 ? Math.round((m.present_count / m.total_days) * 100) : 0;
                const label = new Date(m.month + "-01").toLocaleDateString("en-US", {
                  month: "short",
                  year: "2-digit",
                });
                return (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-12 shrink-0">{label}</span>
                    <div className="flex-1">
                      <Progress value={pct} className="h-2" />
                    </div>
                    <span
                      className={`text-sm font-medium w-10 text-right shrink-0 ${
                        pct >= 90
                          ? "text-green-600"
                          : pct >= 75
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
