"use client";

import { useState } from "react";
import { BookOpen, Download, Loader2, School, UserRound, Users } from "lucide-react";
import { adminApi } from "../../lib/api/admin.api";
import { plural } from "./students/utils";
import ReportFilterDialog from "./ReportFilterDialog";
import { toast } from "../ui/toast";
import type { MonthlyGrowthPoint, NeedsAttentionItem } from "../../hooks/useAdminDashboard";
import "./overview/overview.css";

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
  /** shown on the Overview tab; kept in the props so the page does not have to change */
  needsAttention?: NeedsAttentionItem[];
  isLoading?: boolean;
}

export default function AdminReportsTab({
  stats,
  monthlyGrowth = [],
  isLoading = false
}: AdminReportsTabProps) {
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

      toast.success(`${reportName} downloaded`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`We could not download the ${reportName.toLowerCase()}. ${errorMessage}. Try again.`);
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>;
  }

  const REPORTS = [
    { type: "schools" as const, name: "School report", note: "A PDF of every school. You choose what to include.", count: plural(stats.totalSchools, "school"), Icon: School },
    { type: "teachers" as const, name: "Teacher performance report", note: "A PDF of how teachers are doing.", count: plural(stats.totalTeachers, "teacher"), Icon: UserRound },
    { type: "students" as const, name: "Student enrollment report", note: "A PDF of students and where they are enrolled.", count: plural(stats.totalStudents, "student"), Icon: Users },
    { type: "courses" as const, name: "Course progress report", note: "A PDF of how far students have got in each course.", count: plural(stats.activeCourses, "course"), Icon: BookOpen },
  ];
  const zero = (n: number) => (n === 0 ? <span className="rt-zero">–</span> : n);

  return (
    <div className="so-grid">
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="rt-dl">
          <div className="sd-panel-head"><div><h2 id="rt-dl">Download a report</h2><p>Pick a report, choose what to include, and it saves as a PDF.</p></div></div>
          <ul className="rt-reports">
            {REPORTS.map(({ type, name, note, count, Icon }) => (
              <li key={type}>
                <span className="rt-ico" aria-hidden="true"><Icon /></span>
                <span className="rt-text"><b>{name}</b><small>{note}</small></span>
                <span className="sm-chip">{count}</span>
                <button className="sd-btn sd-btn--line" onClick={() => setFilterDialogOpen(type)} disabled={downloading === type} aria-label={`Choose what goes in the ${name.toLowerCase()}`}>
                  {downloading === type ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                  {downloading === type ? "Preparing…" : "Download"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="so-col">
        <section className="sd-panel" aria-labelledby="rt-gr">
          <div className="sd-panel-head"><div><h2 id="rt-gr">New each month</h2><p>What was added in the last six months.</p></div></div>
          {monthlyGrowth.length === 0 ? (
            <p className="rt-empty">Monthly numbers appear once there is something to count.</p>
          ) : (
            <table className="rt-table">
              <thead><tr><th scope="col">Month</th><th scope="col">Schools</th><th scope="col">Teachers</th><th scope="col">Students</th><th scope="col">Courses</th></tr></thead>
              <tbody>
                {monthlyGrowth.map((m) => (
                  <tr key={m.name}><th scope="row">{m.name}</th><td>{zero(m.schools)}</td><td>{zero(m.teachers)}</td><td>{zero(m.students)}</td><td>{zero(m.courses)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <ReportFilterDialog
        reportType={filterDialogOpen}
        isOpen={filterDialogOpen !== null}
        onClose={() => setFilterDialogOpen(null)}
        onApplyFilters={(filters) => {
          const reportNames = {
            schools: "School report",
            teachers: "Teacher performance report",
            students: "Student enrollment report",
            courses: "Course progress report",
          };
          if (filterDialogOpen) {
            void handleDownloadReportWithFilters(filterDialogOpen, reportNames[filterDialogOpen], filters);
            setFilterDialogOpen(null);
          }
        }}
      />
    </div>
  );
}
