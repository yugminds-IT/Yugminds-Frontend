"use client";

import { useState } from "react";
import { academy } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, useAccount } from "./AcademyShell";

/** Profile + password, shared by every Academy dashboard. */
export function AccountSettings() {
  const { account, setAccount } = useAccount();
  const [profileMsg, setProfileMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setProfileMsg("");
    try {
      const updated = await academy.auth.updateMe({
        fullName: String(f.get("fullName")).trim(),
        phone: String(f.get("phone") ?? "").trim() || undefined,
        ...(account.role === "LEARNER" ? { parentName: String(f.get("parentName") ?? "").trim() } : {}),
      });
      setAccount(updated);
      setProfileMsg("Saved");
    } catch (err) {
      setProfileMsg(errorText(err));
    }
  };

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPwMsg("");
    try {
      await academy.auth.changePassword(String(f.get("current")), String(f.get("next")));
      form.reset();
      setPwMsg("Password changed. Other devices have been signed out.");
    } catch (err) {
      setPwMsg(errorText(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <PageHeader title="Settings" subtitle={account.email} />
      <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold">Profile</h2>
        <div className="space-y-1.5"><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="fullName" defaultValue={account.fullName} required minLength={2} /></div>
        <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" type="tel" defaultValue={account.phone ?? ""} /></div>
        {account.role === "LEARNER" && (
          <div className="space-y-1.5"><Label htmlFor="parentName">Parent&apos;s name</Label><Input id="parentName" name="parentName" defaultValue={account.parentName ?? ""} /></div>
        )}
        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark">Save</button>
          {profileMsg && <span className={`text-sm ${profileMsg === "Saved" ? "text-emerald-600" : "text-red-600"}`}>{profileMsg}</span>}
        </div>
      </form>

      <form onSubmit={changePassword} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold">Change password</h2>
        <div className="space-y-1.5"><Label htmlFor="current">Current password</Label><Input id="current" name="current" type="password" required autoComplete="current-password" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="next">New password</Label>
          <Input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" />
          <p className="text-xs text-ac-muted">At least 8 characters with an uppercase letter, a lowercase letter and a number.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark">Change password</button>
          {pwMsg && <span className={`whitespace-pre-line text-sm ${pwMsg.startsWith("Password changed") ? "text-emerald-600" : "text-red-600"}`}>{pwMsg}</span>}
        </div>
      </form>
    </div>
  );
}
