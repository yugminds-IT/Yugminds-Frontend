"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Loader2, School, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ClassRow = { grade: string | null; section: string | null; count: number; other_school_count: number };
type Preview = { classes: ClassRow[] };

const CONFIRM_WORD = "DELETE";
const keyOf = (c: { grade: string | null; section: string | null }) => `${c.grade ?? ""}::${c.section ?? ""}`;
const sectionLabel = (s: string | null) => (!s ? "No section" : /^sec/i.test(s) ? s : `Section ${s}`);
const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? "s" : ""}`;

export default function BulkDeleteStudentsButton({
  schools,
  onDeleted,
}: {
  schools: Array<{ id: string; name: string }>;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [schoolId, setSchoolId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    adminApi.students
      .deleteByClass({ school_id: schoolId, dry_run: true })
      .then(({ data }) => !cancelled && setPreview(data as Preview))
      .catch(() => !cancelled && toast.error("Could not load the school's classes."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [schoolId, reloadKey]);

  const grades = useMemo(() => {
    const byGrade = new Map<string, ClassRow[]>();
    for (const c of preview?.classes ?? []) {
      const g = c.grade ?? "";
      byGrade.set(g, [...(byGrade.get(g) ?? []), c]);
    }
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    return [...byGrade.entries()]
      .sort(([a], [b]) => cmp(a, b))
      .map(([grade, sections]) => ({
        grade,
        sections: sections.sort((a, b) => cmp(a.section ?? "", b.section ?? "")),
        count: sections.reduce((n, s) => n + s.count, 0),
      }));
  }, [preview]);

  const allKeys = useMemo(() => (preview?.classes ?? []).map(keyOf), [preview]);
  const schoolTotal = grades.reduce((n, g) => n + g.count, 0);
  const wholeSchool = allKeys.length > 0 && selected.length === allKeys.length;
  const picked = (preview?.classes ?? []).filter((c) => selected.includes(keyOf(c)));
  const total = picked.reduce((n, c) => n + c.count, 0);
  const unenrollOnly = picked.reduce((n, c) => n + c.other_school_count, 0);
  const schoolName = schools.find((s) => s.id === schoolId)?.name ?? "";

  const reset = () => {
    setStep("select");
    setSchoolId("");
    setPreview(null);
    setSelected([]);
    setConfirmText("");
  };

  const chooseSchool = (id: string) => {
    setSchoolId(id);
    setPreview(null);
    setLoading(true);
    setSelected([]);
  };

  const toggleGrade = (keys: string[]) =>
    setSelected((prev) =>
      keys.every((k) => prev.includes(k)) ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev, ...keys])],
    );
  const toggleKey = (k: string) =>
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const runDelete = async () => {
    if (deleting || confirmText !== CONFIRM_WORD) return;
    setDeleting(true);
    try {
      const { data } = await adminApi.students.deleteByClass({
        school_id: schoolId,
        ...(wholeSchool
          ? { whole_school: true }
          : { classes: picked.map(({ grade, section }) => ({ grade, section })) }),
      });
      const res = data as { deleted?: number; unenrolled?: number };
      toast.success(
        `Deleted ${plural(res.deleted ?? 0, "student")}` +
          (res.unenrolled ? `; removed ${res.unenrolled} more from ${schoolName} (kept for their other school).` : "."),
      );
      setStep("select");
      setSelected([]);
      setConfirmText("");
      setLoading(true);
      setReloadKey((k) => k + 1);
      onDeleted();
    } catch (error) {
      toast.error(`Bulk delete failed. ${(error as { message?: string })?.message ?? ""}`);
    } finally {
      setDeleting(false);
    }
  };

  const selectionSummary = wholeSchool
    ? "Entire school"
    : picked.map((c) => `${c.grade ?? "No grade"} · ${sectionLabel(c.section)}`).join(", ");

  return (
    <>
      <Button
        variant="outline"
        className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Bulk Delete
      </Button>

      <Dialog open={open} onOpenChange={(o) => !deleting && setOpen(o)}>
        <DialogContent className="bg-white sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle>{step === "select" ? "Bulk Delete Students" : "Confirm deletion"}</DialogTitle>
                <DialogDescription>
                  {step === "select"
                    ? "Pick a school, then the whole school or specific grades and sections."
                    : "Review what will be removed. This cannot be undone."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {step === "select" ? (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">School</Label>
                <Select value={schoolId} onValueChange={chooseSchool}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a school" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!schoolId && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                  <School className="h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">Select a school to see its grades and sections.</p>
                </div>
              )}

              {schoolId && loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading grades and sections…
                </div>
              )}

              {schoolId && !loading && preview && grades.length === 0 && (
                <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-500">
                  This school has no students.
                </div>
              )}

              {schoolId && !loading && grades.length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelected(wholeSchool ? [] : allKeys)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                      wholeSchool ? "border-red-500 bg-red-50" : "hover:bg-gray-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={wholeSchool} className="pointer-events-none" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Entire school</p>
                        <p className="text-xs text-gray-500">Every grade and section in {schoolName}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{plural(schoolTotal, "student")}</span>
                  </button>

                  <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-gray-400">
                    <div className="h-px flex-1 bg-gray-200" />
                    or pick grades &amp; sections
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  <div className="divide-y rounded-lg border">
                    {grades.map((g) => {
                      const keys = g.sections.map(keyOf);
                      const pickedCount = keys.filter((k) => selected.includes(k)).length;
                      const id = `bulk-delete-grade-${g.grade}`;
                      return (
                        <div key={g.grade} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={id}
                              checked={pickedCount === keys.length}
                              onCheckedChange={() => toggleGrade(keys)}
                            />
                            <Label htmlFor={id} className="flex-1 cursor-pointer font-medium">
                              {g.grade || "No grade"}
                            </Label>
                            <span className="text-xs text-gray-500">
                              {pickedCount > 0 && pickedCount < keys.length && (
                                <span className="mr-2 text-red-600">
                                  {pickedCount}/{keys.length} sections
                                </span>
                              )}
                              {plural(g.count, "student")}
                            </span>
                          </div>
                          <div className="mt-2 ml-7 flex flex-wrap gap-2">
                            {g.sections.map((s) => {
                              const k = keyOf(s);
                              const on = selected.includes(k);
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => toggleKey(k)}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                                    on
                                      ? "border-red-500 bg-red-50 text-red-700"
                                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50",
                                  )}
                                >
                                  {on && <Check className="h-3 w-3" />}
                                  {sectionLabel(s.section)}
                                  <span className={on ? "text-red-500" : "text-gray-400"}>{s.count}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                  <div className="space-y-1 text-sm text-red-800">
                    <p className="font-semibold">
                      {plural(total, "student")} from {schoolName}
                    </p>
                    <p>{selectionSummary}</p>
                  </div>
                </div>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-700">
                <li>
                  <strong>{plural(total - unenrollOnly, "account")}</strong> will be deleted permanently, along with
                  their submissions and progress.
                </li>
                {unenrollOnly > 0 && (
                  <li>
                    <strong>{plural(unenrollOnly, "student")}</strong> also enrolled in another school will only be
                    removed from {schoolName} and keep their account.
                  </li>
                )}
              </ul>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-delete-confirm">
                  Type <strong className="font-mono">{CONFIRM_WORD}</strong> to confirm
                </Label>
                <Input
                  id="bulk-delete-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void runDelete()}
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-row items-center justify-between gap-3 border-t px-6 py-4 sm:justify-between">
            <p className="text-sm text-gray-600">
              {step === "select" &&
                (total > 0 ? (
                  <>
                    <strong className="text-gray-900">{plural(total, "student")}</strong> selected
                  </>
                ) : (
                  "Nothing selected"
                ))}
            </p>
            <div className="flex gap-2">
              {step === "select" ? (
                <>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={total === 0}
                    onClick={() => {
                      setConfirmText("");
                      setStep("confirm");
                    }}
                  >
                    Continue
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" disabled={deleting} onClick={() => setStep("select")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={deleting || confirmText !== CONFIRM_WORD}
                    onClick={() => void runDelete()}
                  >
                    {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete {plural(total, "student")}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
