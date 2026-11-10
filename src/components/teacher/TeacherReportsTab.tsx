"use client";

import { useState } from "react";
import Link from "next/link";
import { useTeacherReports } from "../../hooks/useTeacherData";
import RecentReports from "./reports/RecentReports";
import type { ReportRow } from "./reports/utils";
import "@/components/teacher/reports/reports.css";

interface TeacherReportsTabProps {
  selectedSchoolId?: string;
}

/** The dashboard's Reports tab: your newest reports and where each one stands. */
export default function TeacherReportsTab({ selectedSchoolId }: TeacherReportsTabProps) {
  const { data, isLoading, isError, refetch } = useTeacherReports(selectedSchoolId, { limit: 10 });
  const [now] = useState(() => Date.now());
  const reports = (data ?? []) as ReportRow[];

  return (
    <section className="sd-panel" aria-labelledby="tr-title">
      <div className="sd-panel-head">
        <div><h2 id="tr-title">Recent reports</h2><p>Your newest reports and their review status</p></div>
        <Link href="/lms/teacher/reports" className="sd-link">Submit report</Link>
      </div>
      {isLoading ? (
        <><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></>
      ) : isError ? (
        <div className="sd-empty">
          <b>Could not load your reports</b>
          <p>Check your connection and try again.</p>
          <button className="sd-btn sd-btn--ink" onClick={() => void refetch()}>Try again</button>
        </div>
      ) : reports.length === 0 ? (
        <div className="sd-empty">
          <b>No reports yet</b>
          <p>Write a report after each class. Your admin reviews it and the status shows here.</p>
          <Link href="/lms/teacher/reports" className="sd-btn sd-btn--amber">Submit your first report</Link>
        </div>
      ) : (
        <RecentReports reports={reports} now={now} limit={10} />
      )}
    </section>
  );
}
