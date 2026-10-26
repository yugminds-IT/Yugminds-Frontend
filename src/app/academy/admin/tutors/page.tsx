"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { academy, type TutorAdminRow } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TutorsAdminPage() {
  const [rows, setRows] = useState<TutorAdminRow[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  const load = useCallback(() => {
    academy.admin.tutors().then(setRows).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    try {
      const data = await academy.admin.createTutor({
        fullName: String(f.get("fullName")).trim(),
        email: String(f.get("email")).trim(),
        phone: String(f.get("phone") ?? "").trim() || undefined,
        headline: String(f.get("headline") ?? "").trim() || undefined,
        subjects: String(f.get("subjects") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      });
      setCreating(false);
      setCreated(data);
      load();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const resetPassword = async (t: TutorAdminRow) => {
    try {
      setCreated(await academy.admin.resetPassword(t.accountId));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const toggle = async (t: TutorAdminRow) => {
    try {
      await academy.admin.updateTutor(t.id, { isActive: !t.isActive });
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader
        title="Tutors"
        subtitle="Tutors log in on the Academy site, set their weekly hours and run their 1:1 classes."
        action={
          <button onClick={() => { setError(""); setCreating(true); }} className="flex items-center justify-center gap-1.5 rounded-lg bg-ac-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-ac-brand-dark">
            <Plus className="h-4 w-4" /> Add tutor
          </button>
        }
      />
      {error && !creating && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {created && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Share these login details with the tutor now — they won&apos;t be shown again:</p>
          <p className="mt-2 font-mono">{created.email} / {created.tempPassword}
            <button onClick={() => navigator.clipboard.writeText(`${created.email} / ${created.tempPassword}`)} className="ml-2 inline-flex align-middle text-emerald-700" aria-label="Copy"><Copy className="h-4 w-4" /></button>
          </p>
          <p className="mt-1 text-xs">They will be asked to set their own password at first login.</p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {rows?.map((t) => (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{t.account?.fullName || t.account?.email}</p>
                <p className="text-sm text-ac-muted">{t.account?.email}{t.account?.phone ? `, ${t.account.phone}` : ""}</p>
                {t.headline && <p className="mt-1 text-sm">{t.headline}</p>}
              </div>
              <label className="flex items-center gap-2 text-xs text-ac-muted">
                {t.isActive ? "Active" : "Hidden"}
                <Switch checked={t.isActive} onCheckedChange={() => toggle(t)} />
              </label>
            </div>
            <p className="mt-3 text-xs text-ac-muted">
              {t.availability.length
                ? `Available: ${[...new Set(t.availability.map((a) => DAYS[a.dayOfWeek]))].join(", ")}`
                : "No availability set yet"}
              {!t.defaultMeetingLink && ". No default meeting link yet"}
            </p>
            <button onClick={() => resetPassword(t)} className="mt-3 text-xs font-medium text-ac-brand hover:underline">Reset password</button>
          </div>
        ))}
        {rows?.length === 0 && <p className="text-sm text-ac-muted">No tutors yet.</p>}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add tutor</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="fullName" required minLength={2} /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
            <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" type="tel" /></div>
            <div className="space-y-1.5"><Label htmlFor="headline">Headline</Label><Input id="headline" name="headline" placeholder="Robotics & Python tutor" /></div>
            <div className="space-y-1.5"><Label htmlFor="subjects">Subjects (comma separated)</Label><Input id="subjects" name="subjects" placeholder="Robotics, Python, Scratch" /></div>
            {error && <p className="whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button className="w-full rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark">Create tutor account</button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
