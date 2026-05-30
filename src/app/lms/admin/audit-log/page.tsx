"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/api/admin.api";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw } from "lucide-react";

type AuditEntry = {
  id: string;
  timestamp: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
};

const actionColor: Record<string, string> = {
  CREATE_TEACHER: "bg-green-100 text-green-800",
  UPDATE_TEACHER: "bg-blue-100 text-blue-800",
  DELETE_TEACHER: "bg-red-100 text-red-800",
  CREATE_STUDENT: "bg-green-100 text-green-800",
  UPDATE_STUDENT: "bg-blue-100 text-blue-800",
  DELETE_STUDENT: "bg-red-100 text-red-800",
  CREATE_SCHOOL_ADMIN: "bg-green-100 text-green-800",
  UPDATE_SCHOOL_ADMIN: "bg-blue-100 text-blue-800",
  DELETE_SCHOOL_ADMIN: "bg-red-100 text-red-800",
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.auditLog.list({ limit });
      setEntries((data as { entries?: AuditEntry[] })?.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">Recent admin actions (in-memory, last {limit})</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>{n} entries</option>
            ))}
          </select>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded text-sm hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No audit entries yet.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-xs font-medium ${actionColor[entry.action] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">{entry.entity}</TableCell>
                  <TableCell className="text-sm text-gray-500">{entry.entityId}</TableCell>
                  <TableCell className="text-sm text-gray-700">{entry.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
