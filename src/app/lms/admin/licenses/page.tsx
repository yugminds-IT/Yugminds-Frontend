"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { adminApi } from "@/lib/api/admin.api";
import { useToast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  KeyRound,
  School,
  Cpu,
  Plus,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  Loader2,
  Sparkles,
  Search,
  TableIcon,
  Filter,
  RefreshCw,
  Import,
  Pencil,
  AlertTriangle,
} from "lucide-react";

type LicenseItem = {
  id: string;
  school_id: string;
  system_label: string;
  machine_id: string;
  license_number: number;
  expected_license_number?: number;
  key_build_mismatch?: boolean;
  start_date: string;
  expiry_date: string;
  duration_days: number;
  activation_key: string;
  notes: string | null;
  is_active: boolean;
  days_remaining: number;
  is_expired: boolean;
  not_yet_active: boolean;
  created_at: string;
  updated_at: string;
};

type DraftRow = {
  uid: string;
  label: string;
  machineId: string;
  durationDays: number;
  notes: string;
  saving: boolean;
  savedKey: string | null;
};

const MACHINE_ID_RE = /^[0-9A-F]{16}$/;

const DURATION_PRESETS = [
  { label: "1 month (30 days)", days: 30 },
  { label: "3 months (90 days)", days: 90 },
  { label: "6 months (180 days)", days: 180 },
  { label: "1 year (365 days)", days: 365 },
  { label: "2 years (730 days)", days: 730 },
] as const;

function makeUid() {
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function StatusBadge({ lic }: { lic: LicenseItem }) {
  if (!lic.is_active)
    return <Badge className="bg-gray-200 text-gray-700 hover:bg-gray-200">Deactivated</Badge>;
  if (lic.is_expired)
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Expired</Badge>;
  if (lic.not_yet_active)
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Not active yet</Badge>;
  return (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
      Active · {lic.days_remaining}d left
    </Badge>
  );
}

export default function LicensesPage() {
  const toast = useToast();
  const { schools, isLoading: schoolsLoading } = useAdminSchools();

  // All licenses across all schools
  const [allLicenses, setAllLicenses] = useState<LicenseItem[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  // Filter state for the table
  const [filterSchoolId, setFilterSchoolId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Generate tab: selected school
  const [generateSchoolId, setGenerateSchoolId] = useState<string>("");
  const [systemCount, setSystemCount] = useState<string>("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  // Import existing (previously generated) license
  const [importSchoolId, setImportSchoolId] = useState<string>("");
  const [importLabel, setImportLabel] = useState("");
  const [importMachineId, setImportMachineId] = useState("");
  const [importKey, setImportKey] = useState("");
  const [importNotes, setImportNotes] = useState("");
  const [importing, setImporting] = useState(false);

  // Edit an existing license
  const [editLic, setEditLic] = useState<LicenseItem | null>(null);
  const [editForm, setEditForm] = useState({
    systemLabel: "",
    notes: "",
    isActive: true,
    machineId: "",
    durationDays: 365,
    startDate: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Inspect tool
  const [inspectKey, setInspectKey] = useState("");
  const [inspectResult, setInspectResult] = useState<Record<string, unknown> | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const generateSchool = (schools ?? []).find((s) => s.id === generateSchoolId);

  // Load all licenses from all schools in parallel
  const loadAllLicenses = useCallback(async () => {
    if (!schools || schools.length === 0) return;
    setLoadingAll(true);
    try {
      const results = await Promise.allSettled(
        schools.map((school) =>
          adminApi.licenses.list(school.id).then(({ data }) => {
            const root = (data ?? {}) as Record<string, unknown>;
            const payload =
              root.data && typeof root.data === "object" && !Array.isArray(root.data)
                ? (root.data as Record<string, unknown>)
                : root;
            return (payload.licenses as LicenseItem[]) ?? [];
          }),
        ),
      );
      const merged: LicenseItem[] = [];
      let failedCount = 0;
      results.forEach((r) => {
        if (r.status === "fulfilled") merged.push(...r.value);
        else failedCount++;
      });
      setAllLicenses(merged);
      if (failedCount > 0)
        toast.error(`Failed to load licenses for ${failedCount} school${failedCount > 1 ? "s" : ""}. Data may be incomplete.`);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed to load licenses");
    } finally {
      setLoadingAll(false);
    }
  }, [schools, toast]);

  useEffect(() => {
    if (schools && schools.length > 0) loadAllLicenses();
  }, [schools, loadAllLicenses]);

  // Filtered view of the table
  const filteredLicenses = useMemo(() => {
    return allLicenses.filter((lic) => {
      if (filterSchoolId !== "all" && lic.school_id !== filterSchoolId) return false;
      if (filterStatus === "active" && (!lic.is_active || lic.is_expired || lic.not_yet_active))
        return false;
      if (filterStatus === "expired" && !lic.is_expired) return false;
      if (filterStatus === "pending" && !lic.not_yet_active) return false;
      if (filterStatus === "inactive" && lic.is_active) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (
          !lic.system_label.toLowerCase().includes(q) &&
          !lic.machine_id.toLowerCase().includes(q) &&
          !lic.activation_key.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [allLicenses, filterSchoolId, filterStatus, filterSearch]);

  const stats = useMemo(() => {
    const active = filteredLicenses.filter(
      (l) => l.is_active && !l.is_expired && !l.not_yet_active,
    ).length;
    const expired = filteredLicenses.filter((l) => l.is_expired).length;
    return { total: filteredLicenses.length, active, expired };
  }, [filteredLicenses]);

  // Generate tab helpers
  const createDraftRows = () => {
    const n = Math.floor(Number(systemCount));
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      toast.error("Enter a system count between 1 and 100");
      return;
    }
    const existing = allLicenses.filter((l) => l.school_id === generateSchoolId).length;
    const base = existing + drafts.length;
    const rows: DraftRow[] = Array.from({ length: n }, (_, i) => ({
      uid: makeUid(),
      label: `System ${base + i + 1}`,
      machineId: "",
      durationDays: 365,
      notes: "",
      saving: false,
      savedKey: null,
    }));
    setDrafts((prev) => [...prev, ...rows]);
    setSystemCount("");
  };

  const updateDraft = (uid: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  };

  const removeDraft = (uid: string) => {
    setDrafts((prev) => prev.filter((d) => d.uid !== uid));
  };

  const generateDraft = async (draft: DraftRow) => {
    const label = draft.label.trim();
    const machineId = draft.machineId.trim().toUpperCase();
    if (!label) return toast.error("Give the system a name/number");
    if (!MACHINE_ID_RE.test(machineId))
      return toast.error(`${label}: Machine ID must be 16 hex characters`);

    updateDraft(draft.uid, { saving: true });
    try {
      const { data } = await adminApi.licenses.generate({
        schoolId: generateSchoolId,
        systemLabel: label,
        machineId,
        durationDays: draft.durationDays,
        notes: draft.notes.trim() || undefined,
      });
      const root = (data ?? {}) as Record<string, unknown>;
      const payload =
        root.data && typeof root.data === "object" && !Array.isArray(root.data)
          ? (root.data as Record<string, unknown>)
          : root;
      const created = payload.license as LicenseItem | undefined;
      if (created) {
        setAllLicenses((prev) => [created, ...prev]);
        updateDraft(draft.uid, { saving: false, savedKey: created.activation_key });
        toast.success(`${label}: activation key generated`);
      } else {
        updateDraft(draft.uid, { saving: false });
        await loadAllLicenses();
      }
    } catch (e: unknown) {
      updateDraft(draft.uid, { saving: false });
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e instanceof Error ? e.message : String(e));
      toast.error(`${label}: ${msg || "Failed to generate key"}`);
    }
  };

  const importExisting = async () => {
    const label = importLabel.trim();
    const key = importKey.trim();
    const machineId = importMachineId.trim().toUpperCase();
    if (!importSchoolId) return toast.error("Select a school");
    if (!label) return toast.error("Give the system a name/number");
    if (!MACHINE_ID_RE.test(machineId))
      return toast.error("Machine ID must be 16 hex characters");
    if (!key) return toast.error("Paste the existing activation key");

    setImporting(true);
    try {
      const { data } = await adminApi.licenses.import({
        schoolId: importSchoolId,
        systemLabel: label,
        machineId,
        activationKey: key,
        notes: importNotes.trim() || undefined,
      });
      const root = (data ?? {}) as Record<string, unknown>;
      const payload =
        root.data && typeof root.data === "object" && !Array.isArray(root.data)
          ? (root.data as Record<string, unknown>)
          : root;
      const created = payload.license as LicenseItem | undefined;
      if (created) setAllLicenses((prev) => [created, ...prev]);
      else await loadAllLicenses();
      setImportLabel("");
      setImportMachineId("");
      setImportKey("");
      setImportNotes("");
      toast.success(`${label}: license imported`);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e instanceof Error ? e.message : String(e));
      toast.error(msg || "Failed to import license");
    } finally {
      setImporting(false);
    }
  };

  const openEdit = (lic: LicenseItem) => {
    setEditLic(lic);
    setEditForm({
      systemLabel: lic.system_label,
      notes: lic.notes ?? "",
      isActive: lic.is_active,
      machineId: lic.machine_id,
      durationDays: lic.duration_days,
      startDate: lic.start_date,
    });
  };

  const saveEdit = async (opts?: { regenerate?: boolean }) => {
    if (!editLic) return;

    const label = editForm.systemLabel.trim();
    if (!label) return toast.error("System name cannot be empty");

    // Only send fields that actually changed so we don't re-issue the key needlessly.
    const payload: Record<string, unknown> = {};
    if (label !== editLic.system_label) payload.systemLabel = label;
    const notes = editForm.notes.trim();
    if (notes !== (editLic.notes ?? "")) payload.notes = notes || null;
    if (editForm.isActive !== editLic.is_active) payload.isActive = editForm.isActive;

    const machineId = editForm.machineId.trim().toUpperCase();
    if (machineId !== editLic.machine_id) {
      if (!MACHINE_ID_RE.test(machineId))
        return toast.error("Machine ID must be 16 hex characters");
      payload.machineId = machineId;
    }
    const durationDays = Math.floor(Number(editForm.durationDays));
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 20000)
      return toast.error("Duration must be between 1 and 20000 days");
    if (durationDays !== editLic.duration_days) payload.durationDays = durationDays;
    if (editForm.startDate && editForm.startDate !== editLic.start_date)
      payload.startDate = editForm.startDate;
    if (opts?.regenerate) payload.regenerate = true;

    if (Object.keys(payload).length === 0) {
      setEditLic(null);
      return;
    }

    setSavingEdit(true);
    try {
      const { data } = await adminApi.licenses.update(editLic.id, payload);
      const root = (data ?? {}) as Record<string, unknown>;
      const resPayload =
        root.data && typeof root.data === "object" && !Array.isArray(root.data)
          ? (root.data as Record<string, unknown>)
          : root;
      const updated = resPayload.license as LicenseItem | undefined;
      if (updated) setAllLicenses((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      else await loadAllLicenses();
      toast.success(opts?.regenerate ? "Activation key regenerated" : "License updated");
      setEditLic(null);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e instanceof Error ? e.message : String(e));
      toast.error(msg || "Failed to update license");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteLicense = async (lic: LicenseItem) => {
    const ok = await confirmDialog({
      title: "Delete license?",
      description: `This removes the stored activation record for "${lic.system_label}" (${lic.machine_id}). The key already installed on that machine keeps working until it expires.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await adminApi.licenses.delete(lic.id);
      setAllLicenses((prev) => prev.filter((l) => l.id !== lic.id));
      toast.success("License deleted");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed to delete");
    }
  };

  const inspect = async () => {
    const key = inspectKey.trim();
    if (!key) return;
    setInspecting(true);
    setInspectResult(null);
    try {
      const { data } = await adminApi.licenses.decode(key);
      const root = (data ?? {}) as Record<string, unknown>;
      const payload =
        root.data && typeof root.data === "object" && !Array.isArray(root.data)
          ? (root.data as Record<string, unknown>)
          : root;
      setInspectResult(payload);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed to decode key");
    } finally {
      setInspecting(false);
    }
  };

  const schoolName = (schoolId: string) =>
    (schools ?? []).find((s) => s.id === schoolId)?.name ?? "Unknown school";

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="h-6 w-6" />
          RoboCoders Studio Licenses
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Generate and store offline activation keys per school and per system. Each key is bound to
          one machine ID and valid for a fixed number of days.
        </p>
      </div>

      <Tabs defaultValue="keys" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="keys" className="flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            License Keys
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate &amp; Inspect
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: All License Keys ── */}
        <TabsContent value="keys" className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-gray-500">Total systems</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-gray-500">Expired</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </CardContent>
            </Card>
          </div>

          {/* Table with inline filters */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>All License Keys</CardTitle>
                  <CardDescription className="mt-1">
                    {loadingAll || schoolsLoading
                      ? "Loading…"
                      : `${filteredLicenses.length} of ${allLicenses.length} licenses`}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAllLicenses}
                  disabled={loadingAll || schoolsLoading}
                  className="shrink-0 self-start sm:self-auto"
                >
                  {loadingAll ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Refresh
                </Button>
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap gap-2 pt-2">
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Filter className="h-4 w-4" />
                </div>
                <Select value={filterSchoolId} onValueChange={setFilterSchoolId}>
                  <SelectTrigger className="h-8 w-48 text-sm">
                    <SelectValue placeholder="All schools" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All schools</SelectItem>
                    {(schools ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 w-36 text-sm">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="pending">Not active yet</SelectItem>
                    <SelectItem value="inactive">Deactivated</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Search system, machine ID or key…"
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAll || schoolsLoading ? (
                <div className="py-10 text-center text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Loading licenses from all schools…</p>
                </div>
              ) : filteredLicenses.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">
                  {allLicenses.length === 0
                    ? "No licenses have been generated yet."
                    : "No licenses match the current filters."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>School</TableHead>
                        <TableHead>System</TableHead>
                        <TableHead>Machine ID</TableHead>
                        <TableHead>Lic #</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Activation Key</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLicenses.map((lic) => (
                        <TableRow key={lic.id}>
                          <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                            {schoolName(lic.school_id)}
                          </TableCell>
                          <TableCell className="font-medium">{lic.system_label}</TableCell>
                          <TableCell className="font-mono text-xs">{lic.machine_id}</TableCell>
                          <TableCell>
                            {lic.key_build_mismatch ? (
                              <span
                                className="inline-flex items-center gap-1 text-amber-700"
                                title={`This key carries license number ${lic.license_number}, but the current RoboCoders build expects ${lic.expected_license_number}. It will be rejected on the machine with "license number mismatch". Regenerate it (Edit → Regenerate) to fix.`}
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {lic.license_number}
                              </span>
                            ) : (
                              lic.license_number
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{lic.start_date}</TableCell>
                          <TableCell className="text-xs">{lic.expiry_date}</TableCell>
                          <TableCell>{lic.duration_days}</TableCell>
                          <TableCell>
                            <StatusBadge lic={lic} />
                          </TableCell>
                          <TableCell>
                            <code className="font-mono text-xs tracking-wide">
                              {lic.activation_key}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <CopyButton value={lic.activation_key} />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(lic)}
                                title="Edit license"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                onClick={() => deleteLicense(lic)}
                                title="Delete license"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Generate & Inspect ── */}
        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" />
                Select School
              </CardTitle>
              <CardDescription>Choose a school to generate new license keys for.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md">
                <Select
                  value={generateSchoolId}
                  onValueChange={(v) => {
                    setGenerateSchoolId(v);
                    setDrafts([]);
                  }}
                  disabled={schoolsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={schoolsLoading ? "Loading schools…" : "Select a school"}
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {(schools ?? []).map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {generateSchoolId ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Add systems for {generateSchool?.name}
                </CardTitle>
                <CardDescription>
                  Enter how many systems you want to license, then fill in each system&apos;s
                  machine ID and choose a duration. Start date is set to today automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="w-48">
                    <Label htmlFor="sysCount">Number of systems</Label>
                    <Input
                      id="sysCount"
                      type="number"
                      min={1}
                      max={100}
                      value={systemCount}
                      placeholder="e.g. 5"
                      onChange={(e) => setSystemCount(e.target.value)}
                    />
                  </div>
                  <Button onClick={createDraftRows} className="shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Create rows
                  </Button>
                </div>

                {drafts.length > 0 && (
                  <div className="space-y-3 pt-2">
                    {drafts.map((d) => (
                      <div
                        key={d.uid}
                        className="rounded-lg border p-4 bg-gray-50/60 grid gap-3 md:grid-cols-[1fr_1.6fr_1.2fr_auto] md:items-end"
                      >
                        <div>
                          <Label>System name / number</Label>
                          <Input
                            value={d.label}
                            disabled={!!d.savedKey}
                            onChange={(e) => updateDraft(d.uid, { label: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Machine ID (16 hex — from desktop app)</Label>
                          <Input
                            value={d.machineId}
                            disabled={!!d.savedKey}
                            spellCheck={false}
                            maxLength={16}
                            placeholder="7E4C84B9F7D28C0D"
                            className="font-mono uppercase"
                            onChange={(e) =>
                              updateDraft(d.uid, {
                                machineId: e.target.value
                                  .toUpperCase()
                                  .replace(/[^0-9A-F]/g, ""),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>License duration</Label>
                          <Select
                            value={String(d.durationDays)}
                            disabled={!!d.savedKey}
                            onValueChange={(v) => updateDraft(d.uid, { durationDays: Number(v) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              {DURATION_PRESETS.map((p) => (
                                <SelectItem key={p.days} value={String(p.days)}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          {d.savedKey ? (
                            <CopyButton value={d.savedKey} label="Copy key" />
                          ) : (
                            <>
                              <Button
                                onClick={() => generateDraft(d)}
                                disabled={d.saving}
                                className="h-9"
                              >
                                {d.saving ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4 mr-1" />
                                )}
                                Generate
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => removeDraft(d.uid)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>

                        {d.savedKey && (
                          <div className="md:col-span-4">
                            <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 flex items-center justify-between">
                              <code className="font-mono text-sm tracking-wide text-green-800">
                                {d.savedKey}
                              </code>
                              <span className="text-xs text-green-700 flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Saved
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              Select a school above to generate licenses.
            </p>
          )}

          {/* ── Manually add an existing (previously issued) license ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Import className="h-5 w-5" />
                Add an existing license manually
              </CardTitle>
              <CardDescription>
                Already handed out a key before this system existed? Select the school, name the
                system, and paste the machine ID and activation code. The dates, duration and license
                number are read straight from the key — nothing is regenerated, so the stored key
                stays byte-identical to the one on the machine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>School</Label>
                  <Select
                    value={importSchoolId}
                    onValueChange={setImportSchoolId}
                    disabled={schoolsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={schoolsLoading ? "Loading schools…" : "Select a school"}
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {(schools ?? []).map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="importLabel">System name / number</Label>
                  <Input
                    id="importLabel"
                    value={importLabel}
                    placeholder="e.g. Lab PC 3"
                    onChange={(e) => setImportLabel(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="importMachine">
                    Machine ID <span className="text-gray-400">(16 hex — must match the key)</span>
                  </Label>
                  <Input
                    id="importMachine"
                    value={importMachineId}
                    spellCheck={false}
                    maxLength={16}
                    placeholder="7E4C84B9F7D28C0D"
                    className="font-mono uppercase"
                    onChange={(e) =>
                      setImportMachineId(
                        e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ""),
                      )
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="importKey">Activation code</Label>
                  <Input
                    id="importKey"
                    value={importKey}
                    spellCheck={false}
                    className="font-mono"
                    placeholder="XXXXXXX-XXXXXXX-XXXXXXX"
                    onChange={(e) => setImportKey(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="importNotes">Notes (optional)</Label>
                <Input
                  id="importNotes"
                  value={importNotes}
                  placeholder="e.g. issued manually in Jan 2026"
                  onChange={(e) => setImportNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={importExisting} disabled={importing}>
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Import className="h-4 w-4 mr-2" />
                  )}
                  Add license
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Inspect a key */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Inspect an activation key
              </CardTitle>
              <CardDescription>
                Paste any key to verify its tamper seal and read the machine ID, dates and license
                number.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label htmlFor="inspect">Activation key</Label>
                  <Input
                    id="inspect"
                    value={inspectKey}
                    spellCheck={false}
                    className="font-mono"
                    placeholder="XXXXXXX-XXXXXXX-XXXXXXX"
                    onChange={(e) => setInspectKey(e.target.value)}
                  />
                </div>
                <Button
                  onClick={inspect}
                  disabled={inspecting}
                  variant="outline"
                  className="shrink-0 h-10"
                >
                  {inspecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Decode
                </Button>
              </div>
              {inspectResult && (
                <pre className="rounded-md bg-gray-900 text-gray-100 text-xs p-4 overflow-x-auto">
                  {JSON.stringify(inspectResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Edit license dialog ── */}
      <Dialog open={!!editLic} onOpenChange={(open) => !open && setEditLic(null)}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit license
            </DialogTitle>
            <DialogDescription>
              {editLic ? (
                <>
                  {schoolName(editLic.school_id)} · {editLic.machine_id}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {editLic && (
            <div className="space-y-4">
              {editLic.key_build_mismatch && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    This key carries license number {editLic.license_number}, but the current build
                    expects {editLic.expected_license_number}. The machine will reject it. Click{" "}
                    <strong>Regenerate key</strong> below to re-issue it for the current build.
                  </span>
                </div>
              )}

              <div>
                <Label htmlFor="editLabel">System name / number</Label>
                <Input
                  id="editLabel"
                  value={editForm.systemLabel}
                  onChange={(e) => setEditForm((f) => ({ ...f, systemLabel: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label className="cursor-pointer">Active</Label>
                  <p className="text-xs text-gray-500">
                    Deactivated licenses stay stored but are marked inactive.
                  </p>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={(v) => setEditForm((f) => ({ ...f, isActive: v }))}
                />
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <p className="text-xs font-medium text-gray-500">
                  Changing any of these re-issues the activation key — the old key stops working on
                  the machine.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="editMachine">Machine ID</Label>
                    <Input
                      id="editMachine"
                      value={editForm.machineId}
                      spellCheck={false}
                      maxLength={16}
                      className="font-mono uppercase"
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          machineId: e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ""),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="editDuration">Duration (days)</Label>
                    <Input
                      id="editDuration"
                      type="number"
                      min={1}
                      max={20000}
                      value={editForm.durationDays}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, durationDays: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="editStart">Start date</Label>
                    <Input
                      id="editStart"
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="editNotes">Notes</Label>
                <Textarea
                  id="editNotes"
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => saveEdit({ regenerate: true })}
              disabled={savingEdit}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate key
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditLic(null)} disabled={savingEdit}>
                Cancel
              </Button>
              <Button onClick={() => saveEdit()} disabled={savingEdit}>
                {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
