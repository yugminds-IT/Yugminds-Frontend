import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Pager } from "../../portal/notifications";
import type { EndpointStat } from "./utils";

const PAGE_SIZE = 25;

/** Every address the server has handled, busiest first. Speeds come from the last 200 requests to each address. */
export default function EndpointsTab({ stats }: { stats: EndpointStat[] }) {
  const [search, setSearch] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [pageState, setPageState] = useState({ key: "", page: 1 });

  const max = Math.max(1, ...stats.map((s) => s.requests));
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stats.filter((s) => (!onlyErrors || s.errors > 0) && (!q || s.endpoint.toLowerCase().includes(q)));
  }, [stats, search, onlyErrors]);
  const key = `${search}|${onlyErrors}`;
  const page = pageState.key === key ? pageState.page : 1;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const clear = () => { setSearch(""); setOnlyErrors(false); };

  if (stats.length === 0) {
    return <section className="sd-panel"><div className="sd-empty"><b>No addresses yet</b><p>They show up here once the server has handled requests.</p></div></section>;
  }
  return (
    <>
      <div className="mo-bar">
        <div className="sd-search" style={{ flex: "1 1 14rem", maxWidth: "24rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Search by address" aria-label="Search addresses" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" className="as-chip" aria-pressed={onlyErrors} onClick={() => setOnlyErrors((v) => !v)}>Only with errors</button>
        {(search || onlyErrors) && <button className="sm-reset" style={{ color: "var(--sd-ink)" }} onClick={clear}>Clear</button>}
      </div>
      <p className="mo-note">Errors are any response that is not a success, so a wrong password or a page that was not found counts as one.</p>
      {rows.length === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No addresses match</b><p>Try a different address.</p><button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button></div></section>
      ) : (
        <section className="sd-panel mo-list mc-swap" aria-label="Addresses">
          <div className="mo-erow mo-head" aria-hidden="true"><span>Address</span><span>Requests</span><span>Errors</span><span>Average</span><span>95% faster than</span></div>
          {pageRows.map((s) => (
            <article key={s.endpoint} className="mo-erow mo-item">
              <code className="mo-ep">{s.endpoint}</code>
              <span className="mo-vol">
                <b>{s.requests.toLocaleString("en-IN")}</b>
                <span className="sd-meter" role="img" aria-label={`${s.requests} requests`}><i style={{ "--p": `${Math.max(2, (s.requests / max) * 100)}%` } as React.CSSProperties} /></span>
              </span>
              <span className="mo-err" data-hot={s.errors > 0}>{s.errors > 0 ? `${s.errors} (${100 - s.successRate}%)` : "None"}</span>
              <span className="mo-ms" data-s="plain"><small className="mo-lbl">Average</small>{s.avgDuration} ms</span>
              <span className="mo-ms" data-s="plain"><small className="mo-lbl">95% faster than</small>{s.p95Duration} ms</span>
            </article>
          ))}
          <Pager offset={(page - 1) * PAGE_SIZE} count={pageRows.length} total={rows.length} pageSize={PAGE_SIZE} noun="addresses" onPrev={() => setPageState({ key, page: Math.max(1, page - 1) })} onNext={() => setPageState({ key, page: page + 1 })} />
        </section>
      )}
    </>
  );
}
