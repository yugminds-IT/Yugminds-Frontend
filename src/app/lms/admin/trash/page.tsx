"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  School,
  Users,
  User,
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

const EMPTY: TrashData = { students: [], teachers: [], schools: [], courses: [] };

const TABS: Array<{ key: keyof TrashData; label: string; icon: React.ReactNode }> = [
  { key: "students", label: "Students", icon: <User className="h-4 w-4" /> },
  { key: "teachers", label: "Teachers", icon: <Users className="h-4 w-4" /> },
  { key: "schools", label: "Schools", icon: <School className="h-4 w-4" /> },
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

export default function TrashPage() {
  const [data, setData] = useState<TrashData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<{ type: keyof TrashData; item: TrashItem } | null>(null);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.trash.list();
      const payload = (res.data ?? {}) as Partial<TrashData>;
      setData({
        students: payload.students ?? [],
        teachers: payload.teachers ?? [],
        schools: payload.schools ?? [],
        courses: payload.courses ?? [],
      });
    } catch {
      setError("Failed to load trash.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRestore = async (type: keyof TrashData, item: TrashItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      await adminApi.trash.restore(type, item.id);
      await load();
    } catch {
      setError(`Failed to restore "${item.name}".`);
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    setPurging(true);
    setError(null);
    try {
      await adminApi.trash.purge(purgeTarget.type, purgeTarget.item.id);
      setPurgeTarget(null);
      await load();
    } catch {
      setError(`Failed to permanently delete "${purgeTarget.item.name}".`);
    } finally {
      setPurging(false);
    }
  };

  const totalCount =
    data.students.length + data.teachers.length + data.schools.length + data.courses.length;

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="h-7 w-7 text-red-500" />
            Trash
          </h1>
          <p className="text-gray-600 mt-2">
            Deleted records are kept here and can be restored. Purging is permanent.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading trash…
        </div>
      ) : totalCount === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <Trash2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Trash is empty</h3>
            <p>Deleted students, teachers, schools, and courses will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="students" className="space-y-4">
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
                    {t.key === "schools"
                      ? "Restoring a school also restores its trashed users."
                      : t.key === "courses"
                        ? "Courses are restored unpublished — re-publish when ready."
                        : "Restoring reactivates the account immediately."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data[t.key].length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-gray-500">Nothing here.</p>
                  ) : (
                    <div className="divide-y">
                      {data[t.key].map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-6 py-3">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">{item.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {item.detail} · deleted {formatDate(item.deleted_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-500 text-green-700 hover:bg-green-50"
                              disabled={busyId === item.id}
                              onClick={() => handleRestore(t.key, item)}
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
                              disabled={busyId === item.id}
                              onClick={() => setPurgeTarget({ type: t.key, item })}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete forever
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Purge confirmation */}
      <Dialog open={!!purgeTarget} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Delete forever?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-semibold">{purgeTarget?.item.name}</span> and all related
              data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
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
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
