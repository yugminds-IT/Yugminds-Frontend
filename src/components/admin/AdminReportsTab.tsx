"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Download, Loader2, TrendingUp } from "lucide-react";
import { SkeletonDashboard } from "../ui/skeleton-dashboard";
import { adminApi } from "../../lib/api/admin.api";
import ReportFilterDialog from "./ReportFilterDialog";
import { toast } from "../ui/toast";
import NeedsAttentionPanel from "./NeedsAttentionPanel";
import type { MonthlyGrowthPoint, NeedsAttentionItem } from "../../hooks/useAdminDashboard";

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
}

interface AdminReportsTabProps {
  stats: DashboardStats;
  monthlyGrowth?: MonthlyGrowthPoint[];
  needsAttention?: NeedsAttentionItem[];
  isLoading?: boolean;
}

export default function AdminReportsTab({
  stats,
  monthlyGrowth = [],
  needsAttention = [],
  isLoading = false
}: AdminReportsTabProps) {
  const _router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState<'schools' | 'teachers' | 'students' | 'courses' | null>(null);

  const handleDownloadReportWithFilters = async (
    reportType: 'schools' | 'teachers' | 'students' | 'courses',
    reportName: string,
    filters: Record<string, unknown> = {}
  ) => {
    try {
      setDownloading(reportType);
      
      // Build query parameters with filters
      const params: Record<string, string> = { type: reportType };
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          params[key] = String(value);
        }
      });

      const response = await adminApi.reports.download(params);
      const blob = response.data as Blob;
      const contentType = String(response.headers['content-type'] ?? '');

      if (!contentType.includes('application/pdf')) {
        throw new Error('Invalid response format. Expected PDF.');
      }

      const contentDisposition = response.headers['content-disposition'] ?? '';
      let filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`;
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log(`✅ ${reportName} downloaded successfully as PDF:`, {
        filename,
        size: `${(blob.size / 1024).toFixed(2)} KB`
      });
    } catch (error) {
      console.error(`❌ Error downloading ${reportName}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to download ${reportName}. ${errorMessage}. Please try again.`);
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Export Reports</CardTitle>
            <CardDescription>Generate and download system reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => setFilterDialogOpen('schools')}
                disabled={downloading === 'schools' || isLoading}
              >
                {downloading === 'schools' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                School Report
                <Badge variant="secondary" className="ml-auto">{stats.totalSchools} schools</Badge>
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => setFilterDialogOpen('teachers')}
                disabled={downloading === 'teachers' || isLoading}
              >
                {downloading === 'teachers' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Teacher Performance Report
                <Badge variant="secondary" className="ml-auto">{stats.totalTeachers} teachers</Badge>
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => setFilterDialogOpen('students')}
                disabled={downloading === 'students' || isLoading}
              >
                {downloading === 'students' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Student Enrollment Report
                <Badge variant="secondary" className="ml-auto">{stats.totalStudents} students</Badge>
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => setFilterDialogOpen('courses')}
                disabled={downloading === 'courses' || isLoading}
              >
                {downloading === 'courses' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Course Progress Report
                <Badge variant="secondary" className="ml-auto">{stats.activeCourses} courses</Badge>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
            <CardDescription>Items across the platform waiting on admin action</CardDescription>
          </CardHeader>
          <CardContent>
            <NeedsAttentionPanel items={needsAttention} />
          </CardContent>
        </Card>
      </div>

      {/* Real 6-month growth — from the same aggregation the dashboard sparklines use */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Growth (last 6 months)
          </CardTitle>
          <CardDescription>New schools, teachers, students, and courses added per month</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyGrowth.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No growth data available yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Month</th>
                    <th className="py-2 pr-4 font-medium text-right">Schools</th>
                    <th className="py-2 pr-4 font-medium text-right">Teachers</th>
                    <th className="py-2 pr-4 font-medium text-right">Students</th>
                    <th className="py-2 font-medium text-right">Courses</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyGrowth.map((m) => (
                    <tr key={m.name} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium text-gray-700">{m.name}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{m.schools}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{m.teachers}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{m.students}</td>
                      <td className="py-2 text-right tabular-nums">{m.courses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Dialog */}
      <ReportFilterDialog
        reportType={filterDialogOpen}
        isOpen={filterDialogOpen !== null}
        onClose={() => setFilterDialogOpen(null)}
        onApplyFilters={(filters) => {
          const reportNames = {
            schools: 'School Report',
            teachers: 'Teacher Performance Report',
            students: 'Student Enrollment Report',
            courses: 'Course Progress Report'
          };
          if (filterDialogOpen) {
            handleDownloadReportWithFilters(filterDialogOpen, reportNames[filterDialogOpen], filters);
            setFilterDialogOpen(null);
          }
        }}
      />
    </div>
  );
}


