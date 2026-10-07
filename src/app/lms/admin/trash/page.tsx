"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trash2,
  RefreshCw,
  Undo2,
  Loader2,
  Users,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";

interface TrashItem {
  id: string;
  name: string;
  detail: string;
  deleted_at: string | null;
}

type TrashData = {
  students: TrashItem[];
  teachers: TrashItem[];
  schools: TrashItem[];
  courses: TrashItem[];
};

type TabKey = keyof TrashData;

const EMPTY: TrashData = { students: [], teachers: [], schools: [], courses: [] };

// Students and schools are deleted immediately and permanently elsewhere in
// the admin UI (AdminStudentsService.delete / AdminSchoolsService.delete
// both intentionally hard-delete, never setting deletedAt) — they can NEVER
// populate here, so showing them as recoverable tabs would be misleading.
// Only teachers and courses are genuinely soft-deleted and restorable.
const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "teachers", label: "Teachers", icon: <Users className="h-4 w-4" /> },
  { key: "courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? "s" : ""}`;

export default function TrashPage() {
  const [data, setData] = useState<TrashData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<{ type: TabKey; items: TrashItem[] } | null>(null);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await adminApi.trash.list();
      const payload = (res.data ?? {}) as Partial<TrashData>;
      const next: TrashData = {
        students: payload.students ?? [],
        teachers: payload.teachers ?? [],
        schools: payload.schools ?? [],
        courses: payload.courses ?? [],
      };
      setData(next);
      setSelected((prev) => prev.filter((id) => TABS.some((t) => next[t.key].some((i) => i.id === id))));
    } catch {
      setError("Failed to load trash.");
    } finally {
      setRefreshing(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeTab: TabKey = tab ?? (data.teachers.length === 0 && data.courses.length > 0 ? "courses" : "teachers");
  const activeItems = data[activeTab];
  const selectedItems = activeItems.filter((i) => selected.includes(i.id));
  const allSelected = activeItems.length > 0 && selectedItems.length === activeItems.length;

  const changeTab = (value: string) => {
    setTab(value as TabKey);
    setSelected([]);
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Runs `action` for each item; returns the names that failed. */
  const runEach = async (items: TrashItem[], action: (item: TrashItem) => Promise<unknown>) => {
    const results = await Promise.allSettled(items.map(action));
    return items.filter((_, i) => results[i].status === "rejected").map((i) => i.name);
  };

  const reportFailures = (verb: string, failed: string[]) => {
    if (failed.length === 0) return;
    const preview = failed.slice(0, 3).map((n) => `"${n}"`).join(", ");
    const more = failed.length > 3 ? ` and ${failed.length - 3} more` : "";
    setError(`Failed to ${verb} ${preview}${more}.`);
  };

  const handleRestore = async (type: TabKey, items: TrashItem[]) => {
    if (items.length === 1) setBusyId(items[0].id);
    else setBusy(true);
    setError(null);
    const failed = await runEach(items, (item) => adminApi.trash.restore(type, item.id));
    await load();
    reportFailures("restore", failed);
    setBusyId(null);
    setBusy(false);
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    setPurging(true);
    setError(null);
    const failed = await runEach(purgeTarget.items, (item) => adminApi.trash.purge(purgeTarget.type, item.id));
    setPurgeTarget(null);
    await load();
    reportFailures("permanently delete", failed);
    setPurging(false);
  };

  // Only teachers/courses can ever be non-empty (see TABS comment above) —
  // students/schools are still fetched from the API for forward-compat but
  // deliberately excluded from the displayed total and tabs.
  const totalCount = data.teachers.length + data.courses.length;
  const purgeCount = purgeTarget?.items.length ?? 0;

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="h-7 w-7 text-red-500" />
            Trash
          </h1>
          <p className="text-gray-600 mt-2">
            Deleted teachers and courses are kept here and can be restored — purging is permanent.
            Students and schools are deleted immediately and cannot be recovered.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={refreshing} className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {!loaded ? (
        <div className="flex items-center justify-center py-24 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading trash…
        </div>
      ) : totalCount === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <Trash2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Trash is empty</h3>
            <p>Deleted teachers and courses will appear here. Students and schools are deleted immediately, not moved to trash.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={changeTab} className="space-y-4">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="flex items-center gap-2">
                {t.icon}
                {t.label}
                {data[t.key].length > 0 && (
                  <Badge variant="secondary" className="ml-1">{data[t.key].length}</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Deleted {t.label.toLowerCase()}</CardTitle>
                  <CardDescription>
                    {t.key === "courses"
                      ? "Courses are restored unpublished — re-publish when ready."
                      : "Restoring reactivates the account immediately."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data[t.key].length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-gray-500">Nothing here.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-y bg-gray-50 px-6 py-2.5">
                        <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => setSelected(allSelected ? [] : activeItems.map((i) => i.id))}
                            aria-label="Select all"
                          />
                          {selectedItems.length > 0
                            ? `${selectedItems.length} of ${activeItems.length} selected`
                            : "Select all"}
                        </label>
                        {selectedItems.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-500 text-green-700 hover:bg-green-50"
                              disabled={busy}
                              onClick={() => handleRestore(t.key, selectedItems)}
                            >
                              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Undo2 className="h-4 w-4 mr-1" />}
                              Restore {selectedItems.length}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 text-white"
                              disabled={busy}
                              onClick={() => setPurgeTarget({ type: t.key, items: selectedItems })}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete {selectedItems.length} forever
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="divide-y">
                        {data[t.key].map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between px-6 py-3 ${selected.includes(item.id) ? "bg-red-50/40" : ""}`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Checkbox
                                checked={selected.includes(item.id)}
                                onCheckedChange={() => toggle(item.id)}
                                aria-label={`Select ${item.name}`}
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 truncate">{item.name}</div>
                                <div className="text-xs text-gray-500 truncate">
                                  {item.detail} · deleted {formatDate(item.deleted_at)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-green-500 text-green-700 hover:bg-green-50"
                                disabled={busy || busyId === item.id}
                                onClick={() => handleRestore(t.key, [item])}
                              >
                                {busyId === item.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Undo2 className="h-4 w-4 mr-1" />
                                )}
                                Restore
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-400 text-red-600 hover:bg-red-50"
                                disabled={busy || busyId === item.id}
                                onClick={() => setPurgeTarget({ type: t.key, items: [item] })}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete forever
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Purge confirmation */}
      <Dialog open={!!purgeTarget} onOpenChange={(open) => !open && !purging && setPurgeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Delete forever?
            </DialogTitle>
            <DialogDescription>
              {purgeCount === 1 ? (
                <>
                  This permanently deletes <span className="font-semibold">{purgeTarget?.items[0].name}</span> and all
                  related data.
                </>
              ) : (
                <>
                  This permanently deletes <span className="font-semibold">{plural(purgeCount, purgeTarget?.type === "courses" ? "course" : "teacher")}</span>{" "}
                  and all their related data.
                </>
              )}{" "}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {purgeCount > 1 && (
            <ul className="max-h-40 overflow-y-auto rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700 space-y-0.5">
              {purgeTarget?.items.map((i) => (
                <li key={i.id} className="truncate">• {i.name}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeTarget(null)} disabled={purging}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={handlePurge}
              disabled={purging}
            >
              {purging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete {purgeCount > 1 ? `${purgeCount} ` : ""}forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
