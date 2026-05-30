"use client";

import { useState, useEffect, useCallback } from "react";
import NextImage from "next/image";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  History,
  RotateCcw,
  Calendar,
  FileText,
  AlertCircle,
  Loader2,
  BookOpen,
  ClipboardList,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Clock,
  Pencil,
  Megaphone,
} from "lucide-react";
import { adminApi } from "../../lib/api/admin.api";

// ─── Grade label map ──────────────────────────────────────────────────────────
const GRADE_LABELS: Record<string, string> = {
  grade1: "Grade 1", grade2: "Grade 2", grade3: "Grade 3",
  grade4: "Grade 4", grade5: "Grade 5", grade6: "Grade 6",
  grade7: "Grade 7", grade8: "Grade 8", grade9: "Grade 9",
  grade10: "Grade 10", grade11: "Grade 11", grade12: "Grade 12",
  kindergarten: "Kindergarten", "pre-k": "Pre-K",
};
const gradeLabel = (g: string) => GRADE_LABELS[g] ?? g;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SnapshotSummary {
  name: string | null;
  description: string | null;
  thumbnail_url: string | null;
  chapters_count: number;
  assignments_count: number;
  grades: string[];
}

interface CourseVersion {
  id: string;
  version_number: number;
  changes_summary: string | null;
  created_at: string;
  snapshot_summary: SnapshotSummary | null;
}

interface VersionDiff {
  field: string;
  label: string;
  prev: string | number;
  curr: string | number;
  type: "added" | "removed" | "changed";
}

interface CourseVersionHistoryProps {
  courseId: string;
  courseName: string;
  onVersionRevert?: () => void;
}

// ─── Diff computation ─────────────────────────────────────────────────────────
function computeDiff(curr: SnapshotSummary, prev: SnapshotSummary): VersionDiff[] {
  const diffs: VersionDiff[] = [];

  if (curr.name !== prev.name)
    diffs.push({ field: "name", label: "Course Name", prev: prev.name ?? "—", curr: curr.name ?? "—", type: "changed" });

  if (curr.chapters_count !== prev.chapters_count)
    diffs.push({
      field: "chapters", label: "Chapters",
      prev: prev.chapters_count, curr: curr.chapters_count,
      type: curr.chapters_count > prev.chapters_count ? "added" : "removed",
    });

  if (curr.assignments_count !== prev.assignments_count)
    diffs.push({
      field: "assignments", label: "Assignments",
      prev: prev.assignments_count, curr: curr.assignments_count,
      type: curr.assignments_count > prev.assignments_count ? "added" : "removed",
    });

  const prevGrades = [...(prev.grades ?? [])].sort().join(", ");
  const currGrades = [...(curr.grades ?? [])].sort().join(", ");
  if (prevGrades !== currGrades) {
    const prevLabels = (prev.grades ?? []).map(gradeLabel).sort().join(", ") || "None";
    const currLabels = (curr.grades ?? []).map(gradeLabel).sort().join(", ") || "None";
    diffs.push({ field: "grades", label: "Grades", prev: prevLabels, curr: currLabels, type: "changed" });
  }

  if ((curr.thumbnail_url ?? null) !== (prev.thumbnail_url ?? null))
    diffs.push({
      field: "thumbnail", label: "Thumbnail",
      prev: prev.thumbnail_url ? "Set" : "None",
      curr: curr.thumbnail_url ? "Updated" : "Removed",
      type: curr.thumbnail_url ? "added" : "removed",
    });

  if ((curr.description ?? null) !== (prev.description ?? null))
    diffs.push({
      field: "description", label: "Description",
      prev: prev.description ? "Had description" : "None",
      curr: curr.description ? "Updated" : "Removed",
      type: curr.description ? "changed" : "removed",
    });

  return diffs;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function isPublishVersion(summary: string | null) {
  return !summary || !summary.toLowerCase().startsWith("updated:");
}

// ─── Diff badge ───────────────────────────────────────────────────────────────
function DiffBadge({ type, prev, curr }: { type: VersionDiff["type"]; prev: string | number; curr: string | number }) {
  const colors = {
    added: "bg-green-50 border-green-200 text-green-700",
    removed: "bg-red-50 border-red-200 text-red-700",
    changed: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${colors[type]}`}>
      <span className="line-through opacity-60">{prev}</span>
      <ArrowRight className="h-3 w-3 opacity-50" />
      <span>{curr}</span>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CourseVersionHistory({ courseId, courseName, onVersionRevert }: CourseVersionHistoryProps) {
  const [versions, setVersions] = useState<CourseVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revertTarget, setRevertTarget] = useState<CourseVersion | null>(null);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [revertSuccess, setRevertSuccess] = useState(false);

  useEffect(() => {
    if (courseId) loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await adminApi.courses.getVersions(courseId);
      const raw = (data?.versions ?? data ?? []) as Array<Record<string, unknown>>;
      setVersions(
        raw.map((v) => ({
          id: String(v.id ?? ""),
          version_number: Number(v.version_number ?? 0),
          changes_summary: typeof v.changes_summary === "string" ? v.changes_summary : null,
          created_at: String(v.created_at ?? new Date().toISOString()),
          snapshot_summary:
            v.snapshot_summary && typeof v.snapshot_summary === "object"
              ? (v.snapshot_summary as SnapshotSummary)
              : null,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load version history");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const handleRevert = async () => {
    if (!revertTarget) return;
    setReverting(true);
    setRevertError(null);
    try {
      await adminApi.courses.revertVersion(courseId, {
        version_number: revertTarget.version_number,
      });
      setRevertSuccess(true);
      setTimeout(() => {
        setRevertTarget(null);
        setRevertSuccess(false);
        loadVersions();
        onVersionRevert?.();
      }, 1200);
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : "Failed to revert. Please try again.");
    } finally {
      setReverting(false);
    }
  };

  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-1 pb-4 border-b">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            Version History
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{courseName}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadVersions}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto pt-4">
        {loading && versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Loading history…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <AlertCircle className="h-8 w-8 text-red-400 mb-3" />
            <p className="text-sm font-medium text-gray-700">Could not load version history</p>
            <p className="text-xs text-gray-500 mt-1 mb-4">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={loadVersions}>Try again</Button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <History className="h-7 w-7 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-700">No versions recorded yet</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Versions are saved automatically each time you edit or publish this course.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

            <div className="space-y-1">
              {sorted.map((version, index) => {
                const prev = sorted[index + 1] ?? null;
                const snap = version.snapshot_summary;
                const diffs = snap && prev?.snapshot_summary
                  ? computeDiff(snap, prev.snapshot_summary)
                  : [];
                const isExpanded = expandedId === version.id;
                const isLatest = index === 0;
                const isPublish = isPublishVersion(version.changes_summary);

                return (
                  <div key={version.id} className="relative pl-14">
                    {/* Timeline dot */}
                    <div className={`absolute left-3 top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10
                      ${isLatest
                        ? "bg-blue-600 border-blue-600"
                        : isPublish
                          ? "bg-green-500 border-green-500"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      {isLatest ? (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      ) : isPublish ? (
                        <Megaphone className="h-2.5 w-2.5 text-white" />
                      ) : (
                        <Pencil className="h-2.5 w-2.5 text-gray-400" />
                      )}
                    </div>

                    {/* Card */}
                    <div className={`mb-3 rounded-xl border bg-white transition-shadow
                      ${isLatest ? "border-blue-200 shadow-sm" : "border-gray-200 hover:border-gray-300"}
                    `}>
                      {/* Card header */}
                      <div
                        className="flex items-start gap-3 p-4 cursor-pointer select-none"
                        onClick={() => setExpandedId(isExpanded ? null : version.id)}
                      >
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border">
                          {snap?.thumbnail_url ? (
                            <NextImage
                              src={snap.thumbnail_url}
                              alt="thumbnail"
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="h-5 w-5 text-gray-300" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Top row: version badge + type badge + latest */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              v{version.version_number}
                            </span>
                            {isPublish ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-1.5 py-0 h-5">
                                <Megaphone className="h-3 w-3 mr-1" />Published
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-1.5 py-0 h-5">
                                <Pencil className="h-3 w-3 mr-1" />Edited
                              </Badge>
                            )}
                            {isLatest && (
                              <Badge className="bg-blue-600 text-white text-xs px-1.5 py-0 h-5">Current</Badge>
                            )}
                          </div>

                          {/* Course name at this version */}
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {snap?.name || courseName}
                          </p>

                          {/* Date + time ago */}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(version.created_at)}
                            </span>
                            <span className="flex items-center gap-1 text-gray-400">
                              <Clock className="h-3 w-3" />
                              {timeAgo(version.created_at)}
                            </span>
                          </div>

                          {/* Stats row */}
                          {snap && (
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3 text-blue-400" />
                                {snap.chapters_count} chapter{snap.chapters_count !== 1 ? "s" : ""}
                              </span>
                              <span className="flex items-center gap-1">
                                <ClipboardList className="h-3 w-3 text-purple-400" />
                                {snap.assignments_count} assignment{snap.assignments_count !== 1 ? "s" : ""}
                              </span>
                              {snap.grades.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <GraduationCap className="h-3 w-3 text-green-400" />
                                  {snap.grades.map(gradeLabel).join(", ")}
                                </span>
                              )}
                              {snap.thumbnail_url && (
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3 text-orange-400" />
                                  Thumbnail
                                </span>
                              )}
                            </div>
                          )}

                          {/* Changes summary note */}
                          {version.changes_summary && (
                            <div className="flex items-start gap-1 mt-2 text-xs text-gray-500">
                              <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>{version.changes_summary}</span>
                            </div>
                          )}
                        </div>

                        {/* Right: expand + revert */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
                          <div className="text-gray-400">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                          {!isLatest && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRevertTarget(version);
                              }}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Revert
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expanded diff panel */}
                      {isExpanded && (
                        <div className="border-t bg-gray-50 rounded-b-xl px-4 py-3 space-y-3">
                          {/* Diff vs previous */}
                          {diffs.length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Changes from v{prev!.version_number}
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {diffs.map((diff) => (
                                  <div key={diff.field} className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">{diff.label}</span>
                                    <DiffBadge type={diff.type} prev={diff.prev} curr={diff.curr} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : prev ? (
                            <p className="text-xs text-gray-400 italic">No tracked field changes from v{prev.version_number}.</p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">This is the first recorded version.</p>
                          )}

                          {/* Full snapshot */}
                          {snap && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Snapshot at v{version.version_number}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white rounded-lg border p-2.5">
                                  <span className="text-xs text-gray-400 block mb-0.5">Course Name</span>
                                  <span className="text-sm font-medium text-gray-800">{snap.name || "—"}</span>
                                </div>
                                <div className="bg-white rounded-lg border p-2.5">
                                  <span className="text-xs text-gray-400 block mb-0.5">Grades</span>
                                  <span className="text-sm font-medium text-gray-800">
                                    {snap.grades.length > 0 ? snap.grades.map(gradeLabel).join(", ") : "—"}
                                  </span>
                                </div>
                                <div className="bg-white rounded-lg border p-2.5">
                                  <span className="text-xs text-gray-400 block mb-0.5">Chapters</span>
                                  <span className="text-sm font-medium text-gray-800">{snap.chapters_count}</span>
                                </div>
                                <div className="bg-white rounded-lg border p-2.5">
                                  <span className="text-xs text-gray-400 block mb-0.5">Assignments</span>
                                  <span className="text-sm font-medium text-gray-800">{snap.assignments_count}</span>
                                </div>
                                {snap.description && (
                                  <div className="bg-white rounded-lg border p-2.5 col-span-2">
                                    <span className="text-xs text-gray-400 block mb-0.5">Description</span>
                                    <span className="text-xs text-gray-700 line-clamp-3">{snap.description}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* End of timeline */}
            <div className="pl-14 pb-2">
              <p className="text-xs text-gray-400 italic">Beginning of version history</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Revert Dialog ── */}
      <Dialog open={!!revertTarget} onOpenChange={(open) => { if (!open) { setRevertTarget(null); setRevertError(null); setRevertSuccess(false); } }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-500" />
              Revert to v{revertTarget?.version_number}
            </DialogTitle>
            <DialogDescription>
              The course will be restored to the state saved in this version. A new version entry will be created to record this revert.
            </DialogDescription>
          </DialogHeader>

          {revertTarget && !revertSuccess && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-gray-50 p-3 text-sm space-y-1.5 text-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500">Version</span>
                  <span className="font-medium">v{revertTarget.version_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Saved on</span>
                  <span className="font-medium">{formatDate(revertTarget.created_at)}</span>
                </div>
                {revertTarget.snapshot_summary && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Chapters</span>
                      <span className="font-medium">{revertTarget.snapshot_summary.chapters_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Grades</span>
                      <span className="font-medium">
                        {revertTarget.snapshot_summary.grades.length > 0
                          ? revertTarget.snapshot_summary.grades.map(gradeLabel).join(", ")
                          : "—"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>All unsaved changes to the current version will be overwritten. This cannot be undone.</span>
              </div>

              {revertError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{revertError}</span>
                </div>
              )}
            </div>
          )}

          {revertSuccess && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm font-medium text-gray-800">Course reverted successfully</p>
              <p className="text-xs text-gray-500">Refreshing history…</p>
            </div>
          )}

          {!revertSuccess && (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setRevertTarget(null); setRevertError(null); }}
                disabled={reverting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleRevert}
                disabled={reverting}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {reverting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reverting…</>
                ) : (
                  <><RotateCcw className="h-4 w-4 mr-2" />Revert to v{revertTarget?.version_number}</>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
