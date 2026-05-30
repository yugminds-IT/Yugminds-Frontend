"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Sun,
  Coffee,
  Zap,
  AlertCircle,
} from "lucide-react";
import {
  useSchoolCalendar,
  useCreateCalendarEntry,
  useUpdateCalendarEntry,
  useDeleteCalendarEntry,
  type CalendarEntry,
} from "@/hooks/useSchoolCalendar";

const ENTRY_TYPES = [
  { value: "Holiday", label: "Holiday", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "Break", label: "Break", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "HalfDay", label: "Half Day", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "CompensatoryWork", label: "Compensatory Work", color: "bg-blue-100 text-blue-800 border-blue-200" },
];

function typeBadge(type: string) {
  const config = ENTRY_TYPES.find((t) => t.value === type);
  return (
    <Badge variant="outline" className={config?.color ?? ""}>
      {config?.label ?? type}
    </Badge>
  );
}

function typeIcon(type: string) {
  switch (type) {
    case "Holiday": return <Sun className="h-4 w-4 text-red-500" />;
    case "Break": return <Coffee className="h-4 w-4 text-orange-500" />;
    case "HalfDay": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "CompensatoryWork": return <Zap className="h-4 w-4 text-blue-500" />;
    default: return null;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface EntryFormData {
  date: string;
  end_date: string;
  name: string;
  type: string;
  academic_year: string;
  description: string;
}

const emptyForm: EntryFormData = {
  date: "",
  end_date: "",
  name: "",
  type: "Holiday",
  academic_year: "2024-25",
  description: "",
};

export default function SchoolCalendarPage() {
  const now = new Date();
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));
  const [filterMonth, setFilterMonth] = useState("all");

  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<CalendarEntry | null>(null);
  const [form, setForm] = useState<EntryFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const { data: calendar = [], isLoading } = useSchoolCalendar({
    year: filterYear,
    month: filterMonth === "all" ? undefined : filterMonth,
  });

  const createMutation = useCreateCalendarEntry();
  const updateMutation = useUpdateCalendarEntry();
  const deleteMutation = useDeleteCalendarEntry();

  const openCreate = () => {
    setEditEntry(null);
    setForm(emptyForm);
    setFormError("");
    setShowDialog(true);
  };

  const openEdit = (entry: CalendarEntry) => {
    setEditEntry(entry);
    setForm({
      date: entry.date,
      end_date: entry.end_date ?? "",
      name: entry.name,
      type: entry.type,
      academic_year: entry.academic_year,
      description: entry.description ?? "",
    });
    setFormError("");
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!form.date) { setFormError("Start date is required"); return; }
    if (!form.name.trim()) { setFormError("Name is required"); return; }
    setFormError("");

    const payload = {
      date: form.date,
      end_date: form.end_date || undefined,
      name: form.name.trim(),
      type: form.type,
      academic_year: form.academic_year,
      description: form.description.trim() || undefined,
    };

    try {
      if (editEntry) {
        await updateMutation.mutateAsync({ id: editEntry.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setShowDialog(false);
    } catch {
      setFormError("Failed to save. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteId(null);
    } catch {
      // silently handled — query will refetch
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  // Summary counts for the filtered view
  const counts = ENTRY_TYPES.map((t) => ({
    ...t,
    count: calendar.filter((e) => e.type === t.value).reduce((sum, e) => {
      if (!e.end_date) return sum + 1;
      const d1 = new Date(e.date);
      const d2 = new Date(e.end_date);
      return sum + Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
    }, 0),
  }));

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 1 + i));
  const months = [
    { value: "all", label: "All months" },
    { value: "1", label: "January" }, { value: "2", label: "February" },
    { value: "3", label: "March" }, { value: "4", label: "April" },
    { value: "5", label: "May" }, { value: "6", label: "June" },
    { value: "7", label: "July" }, { value: "8", label: "August" },
    { value: "9", label: "September" }, { value: "10", label: "October" },
    { value: "11", label: "November" }, { value: "12", label: "December" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-8 w-8 text-blue-600" />
            School Calendar
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage holidays, breaks, and compensatory working days. These are used to calculate
            accurate teacher attendance percentages.
          </p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Entry
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {counts.map((t) => (
          <Card key={t.value}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                {typeIcon(t.value)}
                <span className="text-xs font-medium text-gray-500">{t.label}</span>
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{t.count}</div>
              <div className="text-xs text-gray-400">days</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Calendar Entries</CardTitle>
              <CardDescription>
                {filterMonth !== "all"
                  ? `${months.find((m) => m.value === filterMonth)?.label} ${filterYear}`
                  : `All of ${filterYear}`}
                {" · "}{calendar.length} entries
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : calendar.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p className="font-medium">No calendar entries found</p>
              <p className="text-sm mt-1">Add holidays and breaks to improve attendance accuracy.</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Entry
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calendar.map((entry) => {
                  const dayCount = entry.end_date
                    ? Math.max(1, Math.round((new Date(entry.end_date).getTime() - new Date(entry.date).getTime()) / 86400000) + 1)
                    : 1;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {typeIcon(entry.type)}
                          {entry.name}
                        </div>
                      </TableCell>
                      <TableCell>{typeBadge(entry.type)}</TableCell>
                      <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {entry.end_date ? formatDate(entry.end_date) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{entry.type === "HalfDay" ? "0.5" : dayCount}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{entry.academic_year}</TableCell>
                      <TableCell className="text-sm text-gray-400 max-w-xs truncate">
                        {entry.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEdit(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteId(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!isBusy) setShowDialog(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>{editEntry ? "Edit Calendar Entry" : "Add Calendar Entry"}</DialogTitle>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Start Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>End Date <span className="text-gray-400 text-xs">(optional)</span></Label>
                <Input
                  type="date"
                  value={form.end_date}
                  min={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Diwali, Summer Break, Gandhi Jayanti"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Type <span className="text-red-500">*</span></Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Academic Year</Label>
                <Input
                  placeholder="2024-25"
                  value={form.academic_year}
                  onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Description <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Input
                placeholder="Additional notes..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Type guide */}
            <div className="rounded-md bg-gray-50 border p-3 text-xs text-gray-500 space-y-1">
              <p><strong>Holiday / Break</strong> — school off; deducted from teacher working days</p>
              <p><strong>Half Day</strong> — counts as 0.5 working days</p>
              <p><strong>Compensatory Work</strong> — weekend day treated as a working day</p>
            </div>

            {formError && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isBusy}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isBusy}>
                {isBusy ? "Saving..." : editEntry ? "Save Changes" : "Add Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Delete Calendar Entry</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            This entry will be removed from the school calendar and will no longer affect attendance
            calculations.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
