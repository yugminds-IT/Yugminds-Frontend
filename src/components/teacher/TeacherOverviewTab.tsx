"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { 
  BookOpen, 
  FileText,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
} from "lucide-react";
import {
  useTeacherReports,
  useTeacherLeaves,
  useTodaysClasses,
  formatGradeSection,
  type TeacherReport,
} from "../../hooks/useTeacherData";
import { Skeleton } from "../ui/skeleton";

interface TeacherOverviewTabProps {
  selectedSchoolId?: string;
}

interface RecentActivity {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

interface ClassItem {
  id?: string;
  schedule_id?: string;
  grade?: string;
  section?: string | null;
  class_name?: string;
  subject?: string;
  start_time?: string;
  end_time?: string;
  hasReport?: boolean;
}

function formatTime(time?: string) {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  if (isNaN(hour)) return time;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

function TodayClassesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-[7.5rem] w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function TeacherOverviewTab({ selectedSchoolId }: TeacherOverviewTabProps) {
  const { data: todaysClasses, isLoading: todaysClassesLoading } = useTodaysClasses(selectedSchoolId);
  const { data: reports, isLoading: reportsLoading } = useTeacherReports(selectedSchoolId, { limit: 5 });
  const { data: leaves, isLoading: leavesLoading } = useTeacherLeaves(selectedSchoolId);

  const recentActivity = useMemo(() => {
    const activity: RecentActivity[] = [];

    // Recent reports — only entries with a real timestamp
    const recentReports = reports?.slice(0, 3) || [];
    recentReports.forEach((report: TeacherReport) => {
      const classData = Array.isArray(report.classes) ? report.classes[0] : report.classes;
      const when = report.created_at ?? report.date;
      if (!when) return;
      activity.push({
        id: `report-${report.id}`,
        title: 'Report Submitted',
        message: `Submitted report for ${formatGradeSection(report.grade || classData?.grade, report.section ?? classData?.section) || 'grade'} on ${report.date ? new Date(report.date).toLocaleDateString() : 'unknown date'}`,
        created_at: String(when),
        type: report.report_status === 'Approved' ? 'success' : 'info'
      });
    });

    // Pending leaves — timestamped by the newest pending request, not "now"
    const pendingLeavesList = (leaves ?? []).filter((l) => l.status === 'Pending');
    if (pendingLeavesList.length > 0) {
      const newest = pendingLeavesList
        .map((l) => String((l as { created_at?: string }).created_at ?? ''))
        .filter(Boolean)
        .sort()
        .pop();
      activity.push({
        id: 'pending-leaves',
        title: 'Pending Leave Requests',
        message: `${pendingLeavesList.length} leave request(s) awaiting approval`,
        created_at: newest ?? pendingLeavesList[0].start_date,
        type: 'warning'
      });
    }

    // Sort by date and limit
    activity.sort((a: RecentActivity, b: RecentActivity) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return activity.slice(0, 5);
  }, [selectedSchoolId, reports, leaves]);

  return (
    <div className="space-y-6">
      {/* Today's Classes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Today&apos;s Classes</CardTitle>
              <CardDescription>Your scheduled classes for today</CardDescription>
            </div>
            <Link href="/lms/teacher/reports">
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Submit Report
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {todaysClassesLoading ? (
            <TodayClassesSkeleton />
          ) : todaysClasses && todaysClasses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {todaysClasses.map((classItem: ClassItem) => {
                const periodId = classItem.schedule_id || classItem.id;
                const gradeLabel =
                  formatGradeSection(classItem.grade, classItem.section) ||
                  classItem.class_name ||
                  'Class';
                const timeLabel =
                  classItem.start_time
                    ? `${formatTime(classItem.start_time)}${
                        classItem.end_time ? ` – ${formatTime(classItem.end_time)}` : ''
                      }`
                    : null;
                const tile = (
                  <div
                    className={`h-full rounded-lg border border-l-[3px] p-3.5 transition-colors ${
                      classItem.hasReport
                        ? 'border-l-emerald-500 border-gray-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50'
                        : 'border-l-amber-500 border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                        {classItem.subject || 'General'}
                      </p>
                      <Badge
                        variant={classItem.hasReport ? 'default' : 'outline'}
                        className={`shrink-0 text-[10px] ${
                          classItem.hasReport
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {classItem.hasReport ? 'Reported' : 'Pending'}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-gray-600 truncate">{gradeLabel}</p>
                    {timeLabel && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{timeLabel}</span>
                      </p>
                    )}
                  </div>
                );
                return periodId ? (
                  <Link
                    key={periodId}
                    href={`/lms/teacher/reports?period_id=${periodId}`}
                    className="block h-full"
                    title={
                      classItem.hasReport
                        ? 'View or update report'
                        : 'Submit report for this class'
                    }
                  >
                    {tile}
                  </Link>
                ) : (
                  <div
                    key={`${gradeLabel}-${classItem.start_time ?? ''}-${classItem.subject ?? ''}`}
                    className="h-full"
                  >
                    {tile}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No classes scheduled for today</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest activities and updates</CardDescription>
        </CardHeader>
        <CardContent>
          {reportsLoading || leavesLoading ? (
            <CardSkeleton rows={3} />
          ) : recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <div className={`mt-1 ${
                    activity.type === 'success' ? 'text-green-500' :
                    activity.type === 'warning' ? 'text-yellow-500' :
                    activity.type === 'error' ? 'text-red-500' :
                    'text-blue-500'
                  }`}>
                    {activity.type === 'success' ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{activity.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/lms/teacher/reports">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <h3 className="font-semibold mb-1">Submit Report</h3>
                  <p className="text-sm text-gray-600">Daily teaching report</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/lms/teacher/leaves">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <h3 className="font-semibold mb-1">Apply for Leave</h3>
                  <p className="text-sm text-gray-600">Submit leave request</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/lms/teacher/attendance">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6 text-center">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <h3 className="font-semibold mb-1">View Attendance</h3>
                  <p className="text-sm text-gray-600">Monthly attendance chart</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/lms/teacher/classes">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6 text-center">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <h3 className="font-semibold mb-1">My Classes</h3>
                  <p className="text-sm text-gray-600">View all classes</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


