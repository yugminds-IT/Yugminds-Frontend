"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { academy, formatINR, type Order } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { DashboardPage, StatusBadge } from "@/components/academy/ui";
import { ManagementTable, type ManagementTableColumn } from "@/components/ui/management-table";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

type Row = Order & { createdAt: string };
const STATUSES = ["", "PAID", "CREATED", "FAILED", "REFUNDED"];

const COLUMNS: ManagementTableColumn<Row>[] = [
  {
    id: "date",
    header: "Date",
    render: (o) => (
      <div className="whitespace-nowrap">
        <p>{new Date(o.paidAt ?? o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
        <p className="text-xs text-muted-foreground">{o.receiptNo}</p>
      </div>
    ),
  },
  {
    id: "buyer",
    header: "Buyer",
    render: (o) => (
      <div>
        <p>{o.buyerName || "—"}</p>
        <p className="text-xs text-muted-foreground">{o.buyerPhone}</p>
      </div>
    ),
  },
  { id: "product", header: "Product", render: (o) => o.product.title },
  {
    id: "amount",
    header: "Amount",
    align: "right",
    render: (o) => (o.amountInPaise === 0 ? <StatusBadge status="FREE" label="Free" /> : <span className="font-medium tabular-nums">{formatINR(o.amountInPaise)}</span>),
  },
  { id: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
];

export default function OrdersPage() {
  const [status, setStatus] = useState("PAID");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<{ rows: Row[]; total: number } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    academy.admin
      .orders({ status: status || undefined, search: search || undefined, take: pageSize, skip: (page - 1) * pageSize })
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [status, search, page, pageSize]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const refund = async (o: Order) => {
    const ok = await confirmDialog({
      title: `Refund ${formatINR(o.amountInPaise)}?`,
      description: `The full amount goes back to ${o.buyerName || "the buyer"} via Razorpay, and access to "${o.product.title}" (or its unused class credits) is removed. This can't be undone.`,
      confirmText: "Refund",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await academy.admin.refund(o.id);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <DashboardPage title="Orders & refunds" subtitle="Payments and free claims from the storefront.">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search receipt, name, phone or payment id" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="bg-white sm:max-w-sm" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-input bg-white px-3 py-2 text-sm" aria-label="Status">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s[0] + s.slice(1).toLowerCase() : "All statuses"}</option>)}
        </select>
      </div>
      {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <ManagementTable
        rows={data?.rows ?? []}
        loading={data === null}
        columns={COLUMNS}
        entityName="order"
        emptyMessage="No orders match."
        enableSelection={false}
        hideToolbarSearch
        getRowLabel={(o) => o.receiptNo}
        serverPagination={{
          page,
          pageSize,
          total: data?.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (n) => { setPageSize(n); setPage(1); },
          pageSizeOptions: [25, 50, 100],
        }}
        rowActions={[
          {
            id: "refund",
            label: "Refund",
            icon: <RotateCcw className="h-4 w-4" />,
            destructive: true,
            hidden: (o) => o.status !== "PAID" || o.amountInPaise === 0,
            onClick: refund,
          },
        ]}
      />
    </DashboardPage>
  );
}
