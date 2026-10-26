"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, CalendarClock, IndianRupee, Plus, Receipt, UserPlus, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { academy, formatINR, type Overview } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { useAccount } from "@/components/academy/AcademyShell";
import { DashboardPage, EmptyState, Panel } from "@/components/academy/ui";
import { whenLabel } from "@/components/academy/SlotPicker";
import { AreaChartAnalyticsCard } from "@/components/ui/area-chart-analytics-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const BAR = "#2563EB"; // ac.brand (site blue-600) — validated single-series fill on the light surface
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export default function AcademyAdminOverview() {
  const { account } = useAccount();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    academy.admin.overview().then(setData).catch((e) => setError(errorText(e)));
  }, []);

  const series = useMemo(() => {
    if (!data) return null;
    let running = data.revenueInPaise - data.daily.reduce((n, d) => n + d.amountInPaise, 0);
    return {
      revenue: data.daily.map((d) => ({ label: dayLabel(d.date), value: d.amountInPaise / 100 })),
      orders: data.daily.map((d) => ({ label: dayLabel(d.date), value: d.orders })),
      signups: data.daily.map((d) => ({ label: dayLabel(d.date), value: d.signups })),
      cumulative: data.daily.map((d) => ({ label: dayLabel(d.date), value: (running += d.amountInPaise) / 100 })),
      bars: data.daily.map((d) => ({ date: d.date, rupees: d.amountInPaise / 100 })),
      revenue30: data.daily.reduce((n, d) => n + d.amountInPaise, 0),
      orders30: data.daily.reduce((n, d) => n + d.orders, 0),
      signups30: data.daily.reduce((n, d) => n + d.signups, 0),
    };
  }, [data]);

  const attention = data
    ? [
        data.attention.classesWithoutLink > 0 && {
          text: `${data.attention.classesWithoutLink} class${data.attention.classesWithoutLink > 1 ? "es" : ""} in the next 48h without a meeting link`,
          href: "/academy/admin/bookings",
        },
        data.attention.draftCourses > 0 && {
          text: `${data.attention.draftCourses} draft course${data.attention.draftCourses > 1 ? "s" : ""} not published yet`,
          href: "/academy/admin/courses",
        },
      ].filter(Boolean) as { text: string; href: string }[]
    : [];

  return (
    <DashboardPage
      title="Academy Dashboard"
      subtitle={`Welcome back, ${account.fullName.split(" ")[0]}`}
      action={
        <>
          <Button variant="outline" asChild>
            <Link href="/academy/admin/courses"><BookOpen className="h-4 w-4" /> Courses</Link>
          </Button>
          <Button asChild className="bg-ac-brand hover:bg-ac-brand-dark">
            <Link href="/academy/admin/products"><Plus className="h-4 w-4" /> New product</Link>
          </Button>
        </>
      }
    >
      {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {attention.length > 0 && (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 md:mb-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" /> Needs attention</p>
          <div className="flex flex-wrap gap-2">
            {attention.map((a) => (
              <Link key={a.text} href={a.href} className="rounded-lg bg-white px-3 py-1 text-sm text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">{a.text}</Link>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards — the LMS AreaChartAnalyticsCard, fed real 30-day series */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
        {!data || !series
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] rounded-xl" />)
          : (
            <>
              <AreaChartAnalyticsCard title="Revenue (30 days)" value={formatINR(series.revenue30)} description={`${formatINR(data.monthRevenueInPaise)} this month`} badge="Sales" icon={<IndianRupee className="h-4 w-4" />} accentColor="#2563eb" sideMetric={formatINR(data.monthRevenueInPaise)} sideLabel="this month" href="/academy/admin/orders" data={series.revenue} />
              <AreaChartAnalyticsCard title="Paid orders (30 days)" value={series.orders30} description={`${data.paidOrders} paid orders all time`} badge="Orders" icon={<Receipt className="h-4 w-4" />} accentColor="#16a34a" sideMetric={String(data.monthOrders)} sideLabel="this month" href="/academy/admin/orders" data={series.orders} />
              <AreaChartAnalyticsCard title="New learners (30 days)" value={series.signups30} description={`${data.learners} learners in total`} badge="Signups" icon={<UserPlus className="h-4 w-4" />} accentColor="#0891b2" sideMetric={String(data.learners)} sideLabel="total learners" href="/academy/admin/learners" data={series.signups} />
              <AreaChartAnalyticsCard title="Revenue, all time" value={formatINR(data.revenueInPaise)} description="Cumulative paid sales" badge="Total" icon={<Users className="h-4 w-4" />} accentColor="#f97316" sideMetric={String(data.paidOrders)} sideLabel="paid orders" href="/academy/admin/orders" data={series.cumulative} />
            </>
          )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Daily revenue, last 30 days" className="lg:col-span-2">
          {series ? (
            <>
              <div className="h-64" role="img" aria-label={`Daily revenue bar chart, last 30 days, ${formatINR(series.revenue30)} total`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series.bars} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip cursor={{ fill: "#EFF6FF" }} formatter={(v) => [formatINR(Number(v) * 100), "Revenue"]} labelFormatter={(l) => dayLabel(String(l))} contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0", fontSize: 12 }} />
                    <Bar dataKey="rupees" fill={BAR} maxBarSize={24} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">View as table</summary>
                <table className="mt-2 w-full text-left">
                  <thead><tr className="text-muted-foreground"><th className="py-1 font-medium">Date</th><th className="py-1 text-right font-medium">Revenue</th></tr></thead>
                  <tbody>
                    {series.bars.filter((d) => d.rupees > 0).map((d) => (
                      <tr key={d.date} className="border-t border-gray-100"><td className="py-1">{dayLabel(d.date)}</td><td className="py-1 text-right tabular-nums">{formatINR(d.rupees * 100)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <Skeleton className="h-64 rounded-lg" />
          )}
        </Panel>

        <Panel title="Upcoming 1:1 classes" action={<Link href="/academy/admin/bookings" className="text-sm font-medium text-ac-brand hover:underline">All</Link>}>
          {data?.upcomingBookings.length ? (
            <ul className="divide-y divide-gray-100">
              {data.upcomingBookings.map((b) => (
                <li key={b.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-900">{whenLabel(b.startsAt)}</p>
                  <p className="text-xs text-muted-foreground">{b.learnerName} with {b.tutorName}{b.meetingLink ? "" : " (no link yet)"}</p>
                </li>
              ))}
            </ul>
          ) : data ? (
            <EmptyState icon={CalendarClock} title="No upcoming classes" />
          ) : (
            <Skeleton className="h-40 rounded-lg" />
          )}
        </Panel>
      </div>

      <Panel title="Recent orders" className="mt-6" action={<Link href="/academy/admin/orders" className="text-sm font-medium text-ac-brand hover:underline">All orders</Link>}>
        {data?.recentOrders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="pb-2 font-medium">Buyer</th><th className="pb-2 font-medium">Product</th><th className="pb-2 font-medium">Date</th><th className="pb-2 text-right font-medium">Amount</th></tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100">
                    <td className="py-2.5">{o.buyerName || "—"}</td>
                    <td className="py-2.5">{o.product.title}</td>
                    <td className="py-2.5 text-muted-foreground">{o.paidAt ? new Date(o.paidAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums">{o.amountInPaise === 0 ? "Free" : formatINR(o.amountInPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : data ? (
          <EmptyState icon={Receipt} title="No orders yet" text="Orders and free claims appear here as soon as learners check out." />
        ) : (
          <Skeleton className="h-32 rounded-lg" />
        )}
      </Panel>
    </DashboardPage>
  );
}
