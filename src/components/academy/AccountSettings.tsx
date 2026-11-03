"use client";

import { useState } from "react";
import { academy } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { DevicesAndSessions } from "@/components/settings/DevicesAndSessions";
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
    <div className="ac-d-page ac-d-page--narrow" style={{ display: "grid", gap: "1.25rem" }}>
      <PageHeader title="Settings" subtitle={account.email} />
      <form onSubmit={saveProfile} className="ac-d-form">
        <h2>Profile</h2>
        <div className="ac-d-field"><label htmlFor="fullName">Full name</label><input id="fullName" name="fullName" defaultValue={account.fullName} required minLength={2} /></div>
        <div className="ac-d-field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" defaultValue={account.phone ?? ""} /></div>
        {account.role === "LEARNER" && (
          <div className="ac-d-field"><label htmlFor="parentName">Parent&apos;s name</label><input id="parentName" name="parentName" defaultValue={account.parentName ?? ""} /></div>
        )}
        <div className="ac-d-form-foot">
          <button className="rh-btn rh-btn--primary">Save</button>
          {profileMsg && <span role="status" className="ac-d-hint" style={{ color: profileMsg === "Saved" ? "var(--rh-ink)" : "#b91c1c", fontWeight: 700 }}>{profileMsg}</span>}
        </div>
      </form>

      <form onSubmit={changePassword} className="ac-d-form">
        <h2>Change password</h2>
        <div className="ac-d-field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" /></div>
        <div className="ac-d-field">
          <label htmlFor="next">New password</label>
          <input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" />
          <p className="ac-d-hint">At least 8 characters with an uppercase letter, a lowercase letter and a number.</p>
        </div>
        <div className="ac-d-form-foot">
          <button className="rh-btn rh-btn--primary">Change password</button>
          {pwMsg && <span role="status" className="ac-d-hint" style={{ whiteSpace: "pre-line", color: pwMsg.startsWith("Password changed") ? "var(--rh-ink)" : "#b91c1c", fontWeight: 700 }}>{pwMsg}</span>}
        </div>
      </form>

      <div className="ac-d-form">
        <DevicesAndSessions api={academy.auth.sessions} onSignedOut={() => (window.location.href = "/academy/login")} />
      </div>
    </div>
  );
}
