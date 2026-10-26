"use client";

import { useEffect, useState } from "react";
import { academy, formatINR, type Order } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    academy.me.orders().then(setOrders).catch((e) => setError(errorText(e)));
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <PageHeader title="Orders" subtitle="Your purchases and receipts." />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {orders?.length === 0 && <p className="text-sm text-ac-muted">No purchases yet.</p>}
      <ul className="space-y-3">
        {orders?.map((o) => (
          <li key={o.id} className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{o.product.title}</p>
              <p className="text-xs text-ac-muted">
                Receipt {o.receiptNo}{o.paidAt ? `, paid ${new Date(o.paidAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold tabular-nums">{formatINR(o.amountInPaise)}</p>
              {o.status === "REFUNDED" && <p className="text-xs font-semibold text-amber-700">Refunded</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
