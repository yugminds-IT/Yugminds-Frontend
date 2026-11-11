import { ChevronRight } from "lucide-react";
import { ago, initialsOf } from "../../portal/notifications";
import { describe, roleLabel, whoOf, type AuditLogRow } from "./utils";

/** One row per recorded change, newest first. Opening a row shows who, when, from where, and exactly what was sent. */
export default function AuditList({ rows, now, onOpen }: { rows: AuditLogRow[]; now: number; onOpen: (l: AuditLogRow) => void }) {
  return (
    <section className="sd-panel aud-list mc-swap" aria-label="Audit entries">
      <div className="aud-row aud-head" aria-hidden="true"><span>When</span><span>Who</span><span>What changed</span><span>Result</span><span /></div>
      {rows.map((l) => {
        const d = describe(l);
        const who = whoOf(l);
        const when = new Date(l.createdAt);
        return (
          <button key={l.id} type="button" className="aud-row aud-item" data-bad={!l.success} aria-label={`${d.headline} by ${who}, ${ago(l.createdAt, now)}. Open details`} onClick={() => onOpen(l)}>
            <span className="aud-when">{ago(l.createdAt, now)}<small>{when.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</small></span>
            <span className="aud-who">
              <span className="sd-avatar" aria-hidden="true">{initialsOf(who)}</span>
              <span><b>{who}</b><small>{[roleLabel(l.actorRole), l.schoolName].filter(Boolean).join(" · ")}</small>{l.impersonatedBy && <small className="aud-via">Done by {l.impersonatedBy.name}, acting as them</small>}</span>
            </span>
            <span className="aud-what">
              <span><span className="sm-chip" data-on={l.method === "POST" ? "true" : undefined} data-warn={l.method === "DELETE" ? "true" : undefined}>{d.kind}</span><b>{d.headline}</b></span>
              <small>{d.id ? `Record ${d.id}` : l.path}</small>
            </span>
            <span className="aud-res" data-ok={l.success}>{l.success ? "Worked" : "Failed"}<small>{l.statusCode ?? ""}</small></span>
            <ChevronRight className="aud-chev" aria-hidden="true" />
          </button>
        );
      })}
    </section>
  );
}
