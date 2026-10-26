"use client";

import { useEffect, useState } from "react";
import { academy, type TutorProfile } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function TutorProfilePage() {
  const [p, setP] = useState<TutorProfile | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    academy.tutor.me().then(setP).catch((e) => setMsg(errorText(e)));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p) return;
    setMsg("");
    try {
      await academy.tutor.updateMe({
        headline: p.headline ?? undefined,
        bio: p.bio ?? undefined,
        subjects: p.subjects,
        photoUrl: p.photoUrl || undefined,
        defaultMeetingLink: p.defaultMeetingLink || undefined,
      });
      setMsg("Saved");
    } catch (err) {
      setMsg(errorText(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <PageHeader title="Public profile" subtitle="This is what learners see on your tutor page." />
      {msg && !p && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{msg}</p>}
      {p && (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="space-y-1.5">
            <Label htmlFor="headline">Headline</Label>
            <Input id="headline" value={p.headline ?? ""} onChange={(e) => setP({ ...p, headline: e.target.value })} placeholder="Robotics and Python tutor, 5 years teaching" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">About you</Label>
            <Textarea id="bio" rows={6} value={p.bio ?? ""} onChange={(e) => setP({ ...p, bio: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subjects">Subjects (comma separated)</Label>
            <Input id="subjects" value={p.subjects.join(", ")} onChange={(e) => setP({ ...p, subjects: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="photo">Photo URL</Label>
            <Input id="photo" value={p.photoUrl ?? ""} onChange={(e) => setP({ ...p, photoUrl: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link">Default meeting link</Label>
            <Input id="link" value={p.defaultMeetingLink ?? ""} onChange={(e) => setP({ ...p, defaultMeetingLink: e.target.value })} placeholder="https://meet.google.com/…" />
            <p className="text-xs text-ac-muted">Added to every new booking automatically. You can change it per class.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark">Save</button>
            {msg && <span className={`text-sm ${msg === "Saved" ? "text-emerald-600" : "text-red-600"}`}>{msg}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
