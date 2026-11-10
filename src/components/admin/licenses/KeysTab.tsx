"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import RowMenu from "../../portal/RowMenu";
import { Pager } from "../../portal/notifications";
import { niceDate, plural, stageOf, STAGE_LABEL, type LicenseItem, type Stage } from "./utils";

const PAGE_SIZE = 20;

export default function KeysTab({
  licenses,
  loading,
  hasFilters,
  schools,
  schoolId,
  onSchool,
  searchInput,
  onSearch,
  stage,
  mismatchOnly,
  onClear,
  schoolName,
  onEdit,
  onDelete,
  onMake,
}: {
  licenses: LicenseItem[];
  loading: boolean;
  hasFilters: boolean;
  schools: { id: string; name: string }[];
  schoolId: string;
  onSchool: (id: string) => void;
  searchInput: string;
  onSearch: (v: string) => void;
  stage: Stage | null;
  mismatchOnly: boolean;
  onClear: () => void;
  schoolName: (id: string) => string;
  onEdit: (l: LicenseItem) => void;
  onDelete: (l: LicenseItem) => void;
  onMake: () => void;
}) {
  const [pageState, setPageState] = useState({ key: "", page: 0 });
  const [copied, setCopied] = useState<string | null>(null);
  const key = `${schoolId}|${searchInput}|${stage}|${mismatchOnly}|${licenses.length}`;
  const lastPage = Math.max(0, Math.ceil(licenses.length / PAGE_SIZE) - 1);
  const page = Math.min(pageState.key === key ? pageState.page : 0, lastPage);
  const visible = licenses.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const copy = async (l: LicenseItem) => {
    try {
      await navigator.clipboard.writeText(l.activation_key);
      setCopied(l.id);
      setTimeout(() => setCopied((c) => (c === l.id ? null : c)), 1800);
    } catch { /* clipboard blocked: the key is on screen to select */ }
  };

  return (
    <>
      <div className="lc-bar">
        <div className="sd-search" style={{ flex: "1 1 16rem", maxWidth: "26rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Search system, machine ID or key" aria-label="Search licenses" value={searchInput} onChange={(e) => onSearch(e.target.value)} />
        </div>
        <select className="sd-field" aria-label="School" value={schoolId} onChange={(e) => onSchool(e.target.value)}>
          <option value="all">All schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {stage && <span className="sm-chip" data-class="true">{STAGE_LABEL[stage]}</span>}
        {mismatchOnly && <span className="sm-chip" data-warn="true">Needs a new key</span>}
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={onClear}>Clear filters</button>}
      </div>

      {loading && licenses.length === 0 ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : licenses.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{hasFilters ? "No licenses match" : "No licenses yet"}</b>
            <p>{hasFilters ? "Try a different search, or clear the filters." : "Make a key for a lab computer. You need its machine ID from the RoboCoders desktop app."}</p>
            {hasFilters ? <button className="sd-btn sd-btn--line" onClick={onClear}>Clear filters</button> : <button className="sd-btn sd-btn--amber" onClick={onMake}><Plus aria-hidden="true" />Make a key</button>}
          </div>
        </section>
      ) : (
        <section className="sd-panel lc-list mc-swap" aria-label="Licenses">
          <div className="lc-head"><span>System</span><span>Machine ID</span><span>Valid</span><span>Activation key</span><span>State</span><span /></div>
          {visible.map((l) => {
            const st = stageOf(l);
            const total = l.duration_days || 1;
            const left = Math.max(0, Math.min(total, l.days_remaining));
            return (
              <div key={l.id} className="lc-row" data-s={st}>
                <span className="lc-sys"><b>{l.system_label}</b><small>{schoolName(l.school_id)}</small></span>
                <code className="lc-mid">{l.machine_id}</code>
                <span className="lc-valid">
                  <b>{niceDate(l.start_date)} to {niceDate(l.expiry_date)}</b>
                  {st === "expired" ? <small>Ended {plural(Math.abs(l.days_remaining), "day")} ago</small> : l.not_yet_active ? <small>Starts later</small> : (
                    <>
                      <span className="sd-meter" role="img" aria-label={`${l.days_remaining} of ${l.duration_days} days left`}><i style={{ "--p": `${Math.max(3, (left / total) * 100)}%` } as React.CSSProperties} /></span>
                      <small>{plural(l.days_remaining, "day")} left of {l.duration_days}</small>
                    </>
                  )}
                </span>
                <span className="lc-key">
                  <code>{l.activation_key}</code>
                  <button type="button" onClick={() => void copy(l)} aria-label={`Copy the key for ${l.system_label}`}>{copied === l.id ? <Check /> : <Copy />}</button>
                </span>
                <span className="lc-state">
                  <span className="lc-chip" data-s={st}>{STAGE_LABEL[st]}</span>
                  {l.key_build_mismatch && (
                    <span className="lc-warn" title={`This key carries license number ${l.license_number}, but the current RoboCoders build expects ${l.expected_license_number}. The machine will reject it. Open Edit and make a new key.`}>
                      <AlertTriangle aria-hidden="true" />Needs a new key
                    </span>
                  )}
                </span>
                <span className="lc-menu">
                  <RowMenu
                    label={`Actions for ${l.system_label}`}
                    items={[
                      { label: "Edit license", icon: Pencil, onClick: () => onEdit(l) },
                      { label: "Copy activation key", icon: Copy, onClick: () => void copy(l) },
                      { label: "Delete license", icon: Trash2, onClick: () => onDelete(l), danger: true, separatorBefore: true },
                    ]}
                  />
                </span>
              </div>
            );
          })}
          <Pager offset={page * PAGE_SIZE} count={visible.length} total={licenses.length} pageSize={PAGE_SIZE} noun="licenses" onPrev={() => setPageState({ key, page: Math.max(0, page - 1) })} onNext={() => setPageState({ key, page: page + 1 })} />
        </section>
      )}
    </>
  );
}
