"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Search,
  Eye,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";
import SavedViewsBar from "@/components/admin/SavedViewsBar";

interface AuditLogRow {
  id: string;
  actorId: number | null;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  method: string;
  path: string;
  entityType: string | null;
  entityId: string | null;
  payload: unknown;
  statusCode: number | null;
  success: boolean;
  ipAddress: string | null;
  createdAt: string;
}

const METHOD_CLS: Record<string, string> = {
  POST: "bg-green-100 text-green-700 border-green-200",
  PUT: "bg-blue-100 text-blue-700 border-blue-200",
  PATCH: "bg-amber-100 text-amber-700 border-amber-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entityType, setEntityType] = useState<string>("all");
  const [method, setMethod] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await adminApi.auditLogs.list({
        page,
        limit: 50,
        search: debouncedSearch || undefined,
        entityType: entityType !== "all" ? entityType : undefined,
        method: method !== "all" ? method : undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      });
      setLogs(data?.logs ?? []);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.totalPages ?? 1);
    } catch {
      setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, entityType, method, from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    adminApi.auditLogs
      .entityTypes()
      .then(({ data }) => setEntityTypes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-blue-600" />
            Audit Log
          </h1>
          <p className="text-gray-600 mt-2">
            Every admin change — who did what, to which record, and when.
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={loading} className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by path, actor email, or record ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {entityTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={method} onValueChange={(v) => { setMethod(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="POST">Create (POST)</SelectItem>
                <SelectItem value="PUT">Update (PUT)</SelectItem>
                <SelectItem value="PATCH">Update (PATCH)</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
              <span className="text-gray-400 text-sm">–</span>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="mt-3">
            <SavedViewsBar
              tableKey="audit-log"
              currentState={{ search, entityType, method, from, to }}
              onApply={(state) => {
                setSearch(String(state.search ?? ""));
                setEntityType(String(state.entityType ?? "all"));
                setMethod(String(state.method ?? "all"));
                setFrom(String(state.from ?? ""));
                setTo(String(state.to ?? ""));
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ShieldAlert className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Loading audit logs…
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No audit entries match these filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{log.actorName ?? log.actorEmail ?? "Unknown"}</div>
                        {log.actorName && log.actorEmail && (
                          <div className="text-xs text-gray-500">{log.actorEmail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={METHOD_CLS[log.method] ?? "bg-gray-100 text-gray-700"}>
                          {log.method}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-900">{log.entityType ?? "—"}</span>
                        {log.entityId && <span className="text-xs text-gray-500 block truncate max-w-[10rem]">{log.entityId}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-[16rem] truncate">{log.path}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={log.success ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
                        >
                          {log.statusCode ?? (log.success ? "OK" : "Failed")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{log.ipAddress ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-gray-600">
            <span>
              {total} entr{total === 1 ? "y" : "ies"} · page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit entry</DialogTitle>
            <DialogDescription>
              {detail && `${detail.method} ${detail.path} · ${formatDate(detail.createdAt)}`}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase text-gray-500">Actor</div>
                  <div className="text-gray-900">{detail.actorName ?? "—"}</div>
                  <div className="text-gray-500">{detail.actorEmail ?? "—"} ({detail.actorRole ?? "?"})</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">Result</div>
                  <div className="text-gray-900">
                    {detail.success ? "Success" : "Failed"} {detail.statusCode ? `(HTTP ${detail.statusCode})` : ""}
                  </div>
                  <div className="text-gray-500">IP: {detail.ipAddress ?? "—"}</div>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500 mb-1">Request payload (sanitized)</div>
                <pre className="max-h-72 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                  {JSON.stringify(detail.payload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
