import { initialsOf } from "../../portal/notifications";
import { plural, roleLabel, type AuditSummary } from "./utils";

/** Who is behind the failed attempts and deletions. Pressing a person shows everything they did. */
export default function SummaryPanel({ summary, actorId, onPerson }: { summary: AuditSummary; actorId: string; onPerson: (id: string) => void }) {
  if (summary.top_people.length === 0) return null;
  return (
    <section className="sd-panel aud-sum" aria-labelledby="aud-sum-t">
      <div className="sd-panel-head"><div><h2 id="aud-sum-t">Who to look at first</h2><p>People with the most failed attempts and deletions under these filters. Press a name to see everything they did.</p></div></div>
      <ul className="aud-roles">
        {summary.by_role.map((r) => (
          <li key={r.role}><b>{roleLabel(r.role)}</b><span>{plural(r.total, "change")}</span><small>{r.failed} failed, {r.deleted} deleted</small></li>
        ))}
      </ul>
      <ul className="aud-people">
        {summary.top_people.map((p, i) => (
          <li key={`${p.actor_id ?? p.email ?? i}`}>
            <button type="button" className="aud-person" data-on={p.actor_id != null && String(p.actor_id) === actorId} disabled={p.actor_id == null} onClick={() => p.actor_id != null && onPerson(String(p.actor_id))}>
              <span className="sd-avatar" aria-hidden="true">{initialsOf(p.name)}</span>
              <span className="aud-person-main"><b>{p.name}</b><small>{roleLabel(p.role)}</small></span>
              <span className="aud-person-n" data-hot={p.failed > 0}>{p.failed}<small>failed</small></span>
              <span className="aud-person-n">{p.deleted}<small>deleted</small></span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
