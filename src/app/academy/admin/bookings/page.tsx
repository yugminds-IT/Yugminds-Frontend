"use client";

import { useCallback, useEffect, useState } from "react";
import { XCircle } from "lucide-react";
import { academy, type Booking } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { DashboardPage, StatusBadge } from "@/components/academy/ui";
import { whenLabel } from "@/components/academy/SlotPicker";
import { ManagementTable, type ManagementTableColumn } from "@/components/ui/management-table";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type Row = Booking & { tutorName: string };

const COLUMNS: ManagementTableColumn<Row>[] = [
  { id: "when", header: "When", sortable: true, sortValue: (b) => b.startsAt, render: (b) => <span className="whitespace-nowrap font-medium text-gray-900">{whenLabel(b.startsAt)}</span> },
  { id: "tutor", header: "Tutor", sortable: true, sortValue: (b) => b.tutorName, searchValue: (b) => b.tutorName, filterable: true, filterValue: (b) => b.tutorName, render: (b) => b.tutorName },
  {
    id: "learner",
    header: "Learner",
    searchValue: (b) => `${b.learner?.fullName ?? ""} ${b.learner?.phone ?? ""}`,
    render: (b) => (
      <div>
        <p>{b.learner?.fullName ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{b.learner?.phone}</p>
      </div>
    ),
  },
  {
    id: "link",
    header: "Meeting link",
    render: (b) => (b.meetingLink ? <StatusBadge status="ACTIVE" label="Added" /> : <StatusBadge status="NO_SHOW" label="Missing" />),
  },
  { id: "status", header: "Status", filterable: true, filterValue: (b) => b.status.toLowerCase(), render: (b) => <StatusBadge status={b.status} /> },
];

export default function BookingsAdminPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    academy.admin.bookings().then(setRows).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const cancel = async (b: Row) => {
    const ok = await confirmDialog({
      title: "Cancel this class?",
      description: "The learner's class credit is returned.",
      confirmText: "Cancel class",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await academy.admin.cancelBooking(b.id);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <DashboardPage title="1:1 bookings" subtitle="All classes from one week ago onwards.">
      {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <ManagementTable
        rows={rows ?? []}
        loading={rows === null}
        columns={COLUMNS}
        entityName="booking"
        searchPlaceholder="Search tutor or learner…"
        emptyMessage="No bookings yet."
        enableSelection={false}
        getRowLabel={(b) => whenLabel(b.startsAt)}
        rowActions={[
          {
            id: "cancel",
            label: "Cancel class",
            icon: <XCircle className="h-4 w-4" />,
            destructive: true,
            hidden: (b) => b.status !== "CONFIRMED" || new Date(b.startsAt).getTime() <= Date.now(),
            onClick: cancel,
          },
        ]}
      />
    </DashboardPage>
  );
}
