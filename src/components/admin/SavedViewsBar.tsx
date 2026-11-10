"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkPlus, Loader2, X } from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";

interface SavedView {
  id: string;
  name: string;
  state: Record<string, unknown>;
  isDefault: boolean;
}

/**
 * A strip of saved filter sets for an admin table. The page owns what `state` means:
 * pass the current filters in, and apply a saved set back when it is picked. Needs audit.css (aud-view classes).
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
      /* the strip just stays empty */
    }
  }, [tableKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await adminApi.savedViews.create({ table_key: tableKey, name: trimmed, state: currentState });
      toast.success(`Saved the view “${trimmed}”`);
      setName("");
      setNaming(false);
      await load();
    } catch {
      toast.error("We could not save this view. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v: SavedView) => {
    try {
      await adminApi.savedViews.delete(v.id);
      setViews((all) => all.filter((x) => x.id !== v.id));
    } catch {
      toast.error(`We could not delete “${v.name}”. Try again.`);
    }
  };

  return (
    <div className="aud-views" role="group" aria-label="Saved views">
      {views.map((v) => (
        <span key={v.id} className="aud-view">
          <button type="button" className="aud-apply" onClick={() => onApply(v.state)}><Bookmark aria-hidden="true" />{v.name}</button>
          <button type="button" className="aud-del" aria-label={`Delete the view ${v.name}`} onClick={() => void remove(v)}><X aria-hidden="true" /></button>
        </span>
      ))}
      {naming ? (
        <span className="aud-name">
          <input
            autoFocus
            className="sd-field"
            aria-label="Name for this view"
            value={name}
            maxLength={60}
            placeholder="Name this view"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setNaming(false);
            }}
          />
          <button className="sd-btn sd-btn--amber" onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}Save
          </button>
          <button className="sd-btn sd-btn--line" onClick={() => setNaming(false)} disabled={saving}>Cancel</button>
        </span>
      ) : (
        <button type="button" className="sm-reset" style={{ color: "var(--sd-ink)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }} onClick={() => setNaming(true)}>
          <BookmarkPlus width={16} height={16} aria-hidden="true" />Save these filters as a view
        </button>
      )}
    </div>
  );
}
