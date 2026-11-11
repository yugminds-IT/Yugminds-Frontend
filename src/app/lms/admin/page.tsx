"use client";

import { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, School, Search, UserPlus } from "lucide-react";
import CreateAccountDialog from "@/components/admin/CreateAccountDialog";
import { AdminTabErrorBoundary } from "@/components/admin/AdminTabErrorBoundary";
import GrowthRun, { type GrowthKey } from "@/components/admin/overview/GrowthRun";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { queryKeys } from "@/lib/query-keys";
import {
  useAdminDashboardStats,
  useAdminQuickPreviews,
  useAdminNeedsAttention,
  useAdminName,
} from "@/hooks/useAdminDashboard";
import "@/components/school-admin/overview.css"; // hero meta, to-do rows, two-column grid
import "@/components/teacher/overview/overview.css"; // track
import "@/components/admin/overview/overview.css";

const AdminOverviewTab = lazy(() => import("@/components/admin/AdminOverviewTab"));
const AdminReportsTab = lazy(() => import("@/components/admin/AdminReportsTab"));

type TabId = "overview" | "reports";
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "reports", label: "Reports" },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="sd-panel">
      <div className="sd-empty">
        <b>We could not load the dashboard numbers</b>
        <p>Check your connection, then try again. Nothing was changed.</p>
        <button className="sd-btn sd-btn--amber" onClick={onRetry}>Try again</button>
      </div>
    </section>
  );
}

function TabSkeleton() {
  return <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [mounted, setMounted] = useState<Set<TabId>>(new Set(["overview"]));
  const [metric, setMetric] = useState<GrowthKey>("students");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // null until mounted so server and first client render match (the greeting depends on the clock)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { data: adminName } = useAdminName();
  const statsQ = useAdminDashboardStats();
  const previewsQ = useAdminQuickPreviews();
  const { data: needsAttention = [] } = useAdminNeedsAttention();

  const stats = statsQ.data?.stats;
  const monthlyGrowth = useMemo(() => statsQ.data?.monthlyGrowth ?? [], [statsQ.data]);
  const previews = useMemo(() => previewsQ.data?.previews ?? [], [previewsQ.data]);

  const { isConnected } = useDashboardRealtime("admin", {
    enabled: true,
    debugLabel: "admin-dashboard",
    customEventMap: {
      "notification:new": [queryKeys.admin.dashboardStats, queryKeys.admin.recentActivity, queryKeys.admin.studentProgress],
      "notification:read": [queryKeys.admin.dashboardStats, queryKeys.admin.studentProgress],
      "dashboard:stats": [queryKeys.admin.dashboardStats],
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboardStats }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.quickPreviews }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.needsAttention }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openSearch = () => window.dispatchEvent(new Event("admin-palette:open"));

  const loading = statsQ.isLoading || previewsQ.isLoading;
  const failed = statsQ.isError && !statsQ.data;
  const newThis = (k: GrowthKey) => monthlyGrowth[monthlyGrowth.length - 1]?.[k] ?? 0;
  const totals: Record<GrowthKey, number> = stats
    ? { schools: stats.totalSchools, teachers: stats.totalTeachers, students: stats.totalStudents, courses: stats.activeCourses }
    : { schools: 0, teachers: 0, students: 0, courses: 0 };

  const hour = now == null ? 12 : new Date(now).getHours();
  const greeting = now == null ? "Hello" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (adminName ?? "").trim().replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, "").split(/[\s@]+/)[0];

  let status: React.ReactNode;
  if (failed) status = "The numbers did not load. Try again.";
  else if (statsQ.isError) status = "Some numbers did not load. Try refreshing.";
  else if (loading || now == null) status = "Checking the platform…";
  else if (needsAttention.length === 0) status = <><strong>Everything is up to date.</strong> Nothing needs you right now.</>;
  else status = <><strong>{plural(needsAttention.length, "thing")}</strong> {needsAttention.length === 1 ? "needs" : "need"} your attention.</>;

  const ledger: { key: GrowthKey; label: string; href: string }[] = [
    { key: "schools", label: "Schools", href: "/lms/admin/schools" },
    { key: "teachers", label: "Teachers", href: "/lms/admin/teachers" },
    { key: "students", label: "Students", href: "/lms/admin/students" },
    { key: "courses", label: "Active courses", href: "/lms/admin/courses" },
  ];

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (to == null) return;
    e.preventDefault();
    pick(TABS[(to + TABS.length) % TABS.length].id);
    tabRefs.current[TABS[(to + TABS.length) % TABS.length].id]?.focus();
  };
  const pick = (id: TabId) => {
    setTab(id);
    setMounted((prev) => new Set([...prev, id]));
  };

  if (now == null) {
    return <div className="sd-page"><div className="sd-skel" style={{ height: "22rem", borderRadius: "1.75rem" }} /></div>;
  }

  return (
    <div className="sd-page">
      <section className="sd-hero ao-hero mc-band" aria-labelledby="ao-title">
        <div className="sd-hero-copy">
          <h1 id="ao-title" className="mc-hero-title">Admin dashboard</h1>
          <p className="sd-where">{greeting}{firstName ? `, ${firstName}` : ""}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => router.push("/lms/admin/schools?action=add")}><School aria-hidden="true" />Add school</button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => setCreateOpen(true)}><UserPlus aria-hidden="true" />Create account</button>
            <button className="sd-btn sd-btn--ghost-dark ao-search" onClick={openSearch} aria-label="Search schools, teachers, students and courses"><Search aria-hidden="true" />Search <kbd>⌘K</kbd></button>
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={() => void handleRefresh()} disabled={isRefreshing} aria-label={isRefreshing ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={isRefreshing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
            <p className="so-live" data-on={isConnected} style={{ alignSelf: "center", margin: 0 }}>
              <i aria-hidden="true" />
              {isConnected ? "Live" : "Reconnecting…"}
            </p>
          </div>
        </div>
        {loading ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : failed ? (
          <div className="sd-run-card"><p style={{ color: "var(--sd-paper)", padding: "1rem 0.25rem" }}>Monthly numbers could not be loaded.</p></div>
        ) : (
          <GrowthRun months={monthlyGrowth} metric={metric} onMetric={setMetric} total={totals[metric]} />
        )}
      </section>

      <nav className="sd-ledger" aria-label="Platform totals">
        {ledger.map((m) => (
          <Link key={m.key} href={m.href} aria-label={loading || failed ? m.label : `${m.label}: ${totals[m.key]}`}>
            <span className="sd-l">{m.label}</span>
            {loading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4.5rem" }} /> : <b className="sd-n">{failed ? "–" : totals[m.key].toLocaleString("en-IN")}</b>}
            <small>{loading ? " " : failed ? "Not loaded" : newThis(m.key) > 0 ? `${newThis(m.key)} new this month` : `None new this month`}</small>
          </Link>
        ))}
      </nav>

      <div className="to-tabs-row">
        <div className="mc-tabs" role="tablist" aria-label="Dashboard sections">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              role="tab"
              id={`ao-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`ao-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="mc-tab"
              onClick={() => pick(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs stay mounted after the first visit so switching back does not flash */}
      <div role="tabpanel" id="ao-panel-overview" aria-labelledby="ao-tab-overview" hidden={tab !== "overview"} className={tab === "overview" ? "mc-swap" : undefined}>
        {mounted.has("overview") && (
          <AdminTabErrorBoundary tabName="Overview">
            <Suspense fallback={<TabSkeleton />}>
              {failed ? (
                <LoadFailed onRetry={() => void handleRefresh()} />
              ) : loading || !stats ? (
                <TabSkeleton />
              ) : (
                <AdminOverviewTab stats={stats} previews={previews} todos={needsAttention} teacherPerformance={statsQ.data?.teacherPerformance} now={now} />
              )}
            </Suspense>
          </AdminTabErrorBoundary>
        )}
      </div>
      <div role="tabpanel" id="ao-panel-reports" aria-labelledby="ao-tab-reports" hidden={tab !== "reports"} className={tab === "reports" ? "mc-swap" : undefined}>
        {mounted.has("reports") && (
          <AdminTabErrorBoundary tabName="Reports">
            <Suspense fallback={<TabSkeleton />}>
              {failed ? <LoadFailed onRetry={() => void handleRefresh()} /> : stats ? <AdminReportsTab stats={stats} monthlyGrowth={monthlyGrowth} needsAttention={needsAttention} isLoading={false} /> : <TabSkeleton />}
            </Suspense>
          </AdminTabErrorBoundary>
        )}
      </div>

      <CreateAccountDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          void handleRefresh();
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
