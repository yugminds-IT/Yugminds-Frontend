"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

/** Owned here so any dashboard (admin, school-admin) can use the panel. */
export interface NeedsAttentionItem {
  id: string;
  label: string;
  count: number;
  href?: string;
  tone: "red" | "amber";
}

/**
 * Real, actionable counts only — each links straight to where it's resolved.
 * Replaces scattered single-alert banners with one to-do-style row.
 */
export default function NeedsAttentionPanel({ items }: { items: NeedsAttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        <span className="text-sm font-medium">Nothing needs your attention right now.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const toneClass =
          item.tone === "red"
            ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
            : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
        const content = (
          <>
            <AlertCircle className={`h-4 w-4 shrink-0 ${item.tone === "red" ? "text-red-500" : "text-amber-500"}`} />
            <span className="text-sm font-medium">{item.label}</span>
          </>
        );
        if (!item.href) {
          return (
            <div key={item.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${toneClass}`}>
              {content}
            </div>
          );
        }
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${toneClass}`}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
