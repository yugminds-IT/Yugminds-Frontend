"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bookmark, BookmarkPlus, X, Loader2 } from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";

interface SavedView {
  id: string;
  name: string;
  state: Record<string, unknown>;
  isDefault: boolean;
}

/**
 * Generic saved-views strip for an admin table/page. The page owns what
 * `state` means: pass the current filter state and apply it back on click.
 */
export default function SavedViewsBar({
  tableKey,
  currentState,
  onApply,
}: {
  tableKey: string;
  currentState: Record<string, unknown>;
  onApply: (state: Record<string, unknown>) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await adminApi.savedViews.list(tableKey);
      setViews(Array.isArray(data) ? (data as SavedView[]) : []);
    } catch {
      // Non-fatal — the strip just stays empty.
    }
  }, [tableKey]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await adminApi.savedViews.create({
        table_key: tableKey,
        name: trimmed,
        state: currentState,
      });
      setName("");
      setNaming(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await adminApi.savedViews.delete(id).catch(() => {});
    setViews((v) => v.filter((x) => x.id !== id));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((v) => (
        <Badge
          key={v.id}
          variant="outline"
          className="cursor-pointer gap-1 border-blue-200 bg-blue-50 py-1 pl-2 pr-1 text-blue-700 hover:bg-blue-100"
          onClick={() => onApply(v.state)}
        >
          <Bookmark className="h-3 w-3" />
          {v.name}
          <button
            aria-label={`Delete view ${v.name}`}
            className="ml-1 rounded p-0.5 opacity-60 hover:bg-blue-200 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              remove(v.id);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {naming ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setNaming(false);
            }}
            placeholder="View name…"
            className="h-7 w-40 text-xs"
          />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={save} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setNaming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-gray-500 hover:text-gray-800"
          onClick={() => setNaming(true)}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          Save current view
        </Button>
      )}
    </div>
  );
}
