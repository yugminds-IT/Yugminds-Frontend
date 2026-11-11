"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, Wrench } from "lucide-react";
import ConfirmModal from "@/components/portal/ConfirmModal";
import ControlRun from "@/components/admin/controls/ControlRun";
import MaintenancePanel from "@/components/admin/controls/MaintenancePanel";
import AnnouncementPanel from "@/components/admin/controls/AnnouncementPanel";
import FlagsPanel from "@/components/admin/controls/FlagsPanel";
import { EMPTY, PARTS, plural, type Controls, type Part } from "@/components/admin/controls/utils";
import { announcementLive, changesFrom } from "@/components/admin/controls/changes";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/controls/controls.css";

export default function SystemControlsPage() {
  const [controls, setControls] = useState<Controls>(EMPTY);
  const [saved, setSaved] = useState<Controls>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [part, setPart] = useState<Part>("maintenance");
  const [confirmOn, setConfirmOn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.systemControls.get();
      const next = { ...EMPTY, ...(data as Controls) };
      setControls(next);
      setSaved(next);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = JSON.stringify(controls) !== JSON.stringify(saved);

  const persist = async (next: Controls) => {
    setSaving(true);
    try {
      // Only the changes go to the server (see changesFrom), so a stale page cannot undo someone else's change.
      const { data } = await adminApi.systemControls.update(changesFrom(saved, next) as unknown as Record<string, unknown>);
      const fresh = { ...EMPTY, ...(data as Controls) };
      setControls(fresh);
      setSaved(fresh);
      setConfirmOn(false);
      toast.success(fresh.maintenance_mode && !saved.maintenance_mode ? "Maintenance mode is on" : !fresh.maintenance_mode && saved.maintenance_mode ? "Maintenance mode is off" : "System controls saved");
    } catch {
      toast.error("We could not save the changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // Turning maintenance on locks people out, so it asks first. Everything else saves straight away.
  const save = () => {
    if (controls.maintenance_mode && !saved.maintenance_mode) setConfirmOn(true);
    else void persist(controls);
  };

  const flagsOn = Object.values(saved.feature_flags).filter(Boolean).length;
  const first = loading && !loadError;
  const maint = saved.maintenance_mode;

  let statusLine: React.ReactNode;
  if (loadError) statusLine = "The controls did not load. Try refreshing.";
  else if (first) statusLine = "Checking the platform…";
  else if (maint) statusLine = <><strong>Maintenance mode is on.</strong> Students, teachers and school admins cannot sign in.</>;
  else if (announcementLive(saved.announcement) || flagsOn > 0) statusLine = <><strong>Everything is running normally.</strong>{announcementLive(saved.announcement) && <> An announcement is showing.</>}{flagsOn > 0 && <> {plural(flagsOn, "feature flag")} on.</>}</>;
  else statusLine = <><strong>Everything is running normally.</strong> No banner, no flags, no maintenance.</>;

  const runCaption = first ? "Loading…" : maint ? "People are locked out" : "Nobody is affected";

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ctl-title">
        <div className="sd-hero-copy">
          <h1 id="ctl-title" className="mc-hero-title">System controls</h1>
          <p className="sd-where">Switches that affect everyone on the platform</p>
          <p className="sd-status">{statusLine}</p>
          {maint && !dirty && !first && (
            <div className="sd-hero-actions">
              <button className="sd-btn sd-btn--amber" onClick={() => void persist({ ...saved, maintenance_mode: false })} disabled={saving}><Wrench aria-hidden="true" />Turn maintenance off</button>
            </div>
          )}
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void load()} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {first ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <ControlRun saved={saved} selected={part} onSelect={setPart} caption={runCaption} />
        )}
      </section>

      <div className="mc-tabs" role="tablist" aria-label="Platform controls" style={{ justifySelf: "start", maxWidth: "100%" }}>
        {PARTS.map((p) => (
          <button key={p.key} role="tab" className="mc-tab" aria-selected={part === p.key} onClick={() => setPart(p.key)}>
            {p.label}{p.key === "flags" && !first && !loadError && <b>{Object.keys(controls.feature_flags).length}</b>}
          </button>
        ))}
      </div>

      {first ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : loadError ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the system controls</b>
            <p>Check your connection, then try again. Nothing was changed.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void load()}>Try again</button>
          </div>
        </section>
      ) : part === "maintenance" ? (
        <MaintenancePanel value={controls} onChange={setControls} />
      ) : part === "announcement" ? (
        <AnnouncementPanel value={controls} onChange={setControls} />
      ) : (
        <FlagsPanel value={controls} onChange={setControls} />
      )}

      {dirty && !loadError && (
        <div className="ctl-savebar" role="region" aria-label="Unsaved changes">
          <b>You have unsaved changes</b>
          <div>
            <button className="sd-btn sd-btn--line" onClick={() => setControls(saved)} disabled={saving}>Discard</button>
            <button className="sd-btn sd-btn--amber" onClick={save} disabled={saving}>
              <Save aria-hidden="true" />{saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOn}
        onClose={() => { if (!saving) setConfirmOn(false); }}
        title="Turn on maintenance mode?"
        subtitle="This locks people out as soon as you confirm."
        confirmLabel="Turn on maintenance"
        danger
        busy={saving}
        onConfirm={() => void persist(controls)}
      >
        <ul className="ctl-who">
          <li>Students, teachers and school admins cannot sign in.</li>
          <li>Admins can still sign in, and anyone already signed in stays signed in.</li>
          <li>They see your message: “{controls.maintenance_message.trim() || "Yugminds is undergoing scheduled maintenance. Please check back shortly."}”</li>
        </ul>
      </ConfirmModal>
    </div>
  );
}
