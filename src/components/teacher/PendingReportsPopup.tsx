"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { teacherApi, setAuthToken } from "@/lib/api";
import { getSession } from "@/lib/session-utils";
import { shouldShowPendingReportsPopup, type TodayReportsStatus } from "@/lib/pending-reports-popup";

const REMIND_AFTER_MS = 30 * 60 * 1000;

/**
 * "Submit your reports" popup for teachers. Appears on login / page load while
 * today's reports are pending, disappears for good once every period is
 * reported (the report mutation invalidates this query). "Remind me later"
 * only snoozes it for this page load / 30 minutes — it comes back until the
 * reports are submitted. Uses the server's view of today (IST), not the
 * device clock.
 */
export default function PendingReportsPopup() {
  const router = useRouter();
  const pathname = usePathname();
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const { data: today } = useQuery({
    // Under ['teacher','attendance'] so submitting a report refreshes it.
    queryKey: ["teacher", "attendance", "pending-reports-popup"],
    queryFn: async () => {
      const {
        data: { session },
      } = await getSession();
      if (!session) throw new Error("Not authenticated");
      setAuthToken(session.access_token || null);
      const { data } = await teacherApi.attendance.today({});
      return data as TodayReportsStatus;
    },
    refetchInterval: REMIND_AFTER_MS,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  // Tick so a snooze expires on its own while the page stays open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const onReportsPage = pathname?.startsWith("/lms/teacher/reports") ?? false;
  const open = shouldShowPendingReportsPopup(today) && !onReportsPage && now >= snoozedUntil;
  const pending = today?.pendingPeriods ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setSnoozedUntil(Date.now() + REMIND_AFTER_MS)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            Submit today&apos;s reports
          </DialogTitle>
          <DialogDescription>
            {today?.before_cutoff === false
              ? "The 8:00 PM IST cutoff has passed, so today is marked Absent. Please still submit your reports."
              : "You have reports pending for today. Submit all of them before 8:00 PM IST to be marked Present."}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {pending.map((p, i) => (
            <li key={p.period_id ?? i} className="flex justify-between rounded border px-3 py-1.5">
              <span>
                {[p.grade, p.section].filter(Boolean).join(" ")} {p.subject ? `· ${p.subject}` : ""}
              </span>
              <span className="text-gray-500">{p.start_time ?? ""}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSnoozedUntil(Date.now() + REMIND_AFTER_MS)}>
            Remind me later
          </Button>
          <Button onClick={() => router.push("/lms/teacher/reports")}>Submit reports now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
