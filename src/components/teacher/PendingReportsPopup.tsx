"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import Modal from "@/components/portal/Modal";
import { teacherApi, setAuthToken } from "@/lib/api";
import { getSession } from "@/lib/session-utils";
import { shouldShowPendingReportsPopup, type TodayReportsStatus } from "@/lib/pending-reports-popup";
import { classLabel, clock, toMin } from "./overview/utils";

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
  const snooze = () => setSnoozedUntil(Date.now() + REMIND_AFTER_MS);

  return (
    <Modal
      open={open}
      onClose={snooze}
      title="Submit today's reports"
      subtitle={
        today?.before_cutoff === false
          ? "The 8 PM IST cutoff has passed, so today is marked absent. Please still submit your reports."
          : "Submit every report before 8 PM IST to be marked present."
      }
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={snooze}>Remind me later</button>
          <button className="sd-btn sd-btn--amber" onClick={() => router.push("/lms/teacher/reports")}><FileText aria-hidden="true" />Submit reports now</button>
        </>
      }
    >
      <ul className="to-due">
        {pending.map((p, i) => (
          <li key={p.period_id ?? i}>
            <time>{Number.isFinite(toMin(p.start_time)) ? clock(toMin(p.start_time)) : ""}</time>
            <span><b>{p.subject || "Class"}</b>{classLabel(p.grade, p.section) && <small>{classLabel(p.grade, p.section)}</small>}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
