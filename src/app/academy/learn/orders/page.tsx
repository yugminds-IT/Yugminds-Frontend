"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { academy, formatINR, type Order } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { EmptyState } from "@/components/academy/ui";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    academy.me.orders().then(setOrders).catch((e) => setError(errorText(e)));
  }, []);

  return (
    <div className="ac-d-page ac-d-page--narrow">
      <PageHeader title="Orders" subtitle="Your purchases and receipts." />
      {error && <p className="ac-d-note" data-tone="error" role="alert">{error}</p>}
      {orders === null && !error && <span className="ac-spin" role="status" aria-label="Loading your orders" />}
      {orders?.length === 0 && (
        <EmptyState icon={Receipt} title="No purchases yet" text="Courses and class packs you buy will show up here." action={<Link href="/academy/courses" className="rh-btn rh-btn--primary">Browse courses</Link>} />
      )}
      {orders && orders.length > 0 && (
        <div className="ac-d-rows">
          {orders.map((o) => (
            <div key={o.id} className="ac-d-row" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
              <span>
                <b>{o.product.title}</b>
                <small>Receipt {o.receiptNo}{o.paidAt ? `, paid ${new Date(o.paidAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}` : ""}</small>
              </span>
              <span style={{ textAlign: "right" }}>
                <b className="tabular-nums">{formatINR(o.amountInPaise)}</b>
                {o.status === "REFUNDED" && <small>Refunded</small>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
