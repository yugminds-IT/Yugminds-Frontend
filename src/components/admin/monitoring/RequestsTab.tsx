import { Search } from "lucide-react";
import { ChipGroup, Pager } from "../../portal/notifications";
import { SPEED_LABEL, speedOf, type Kind, type Request, type Speed } from "./utils";

const KINDS = [["all", "All"], ["ok", "Worked"], ["client", "Client errors"], ["server", "Server errors"]] as const;
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" });

/** The latest requests the server handled, newest first. */
export default function RequestsTab({
  rows,
  total,
  speed,
  kind,
  onKind,
  search,
  onSearch,
  onClear,
  page,
  pageSize,
  onPage,
}: {
  rows: Request[];
  /** requests before any filter */
  total: number;
  speed: Speed | null;
  kind: Kind;
  onKind: (k: Kind) => void;
  search: string;
  onSearch: (v: string) => void;
  onClear: () => void;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const filtered = speed !== null || kind !== "all" || search.trim() !== "";
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      {total > 0 && (
        <div className="mo-bar">
          <div className="sd-search" style={{ flex: "1 1 14rem", maxWidth: "24rem", width: "auto" }}>
            <Search aria-hidden="true" />
            <input type="search" placeholder="Search by address" aria-label="Search requests by address" value={search} onChange={(e) => onSearch(e.target.value)} />
          </div>
          <ChipGroup label="Show requests" value={kind} options={KINDS} onChange={onKind} />
          {speed && <span className="sm-chip" data-class="true">{SPEED_LABEL[speed]}</span>}
          {filtered && <button className="sm-reset" style={{ color: "var(--sd-ink)" }} onClick={onClear}>Clear</button>}
        </div>
      )}
      {total === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No requests yet</b><p>The server has not handled any request since it started. They appear here as people use the platform.</p></div></section>
      ) : rows.length === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No requests match</b><p>Try a different address or clear the filters.</p><button className="sd-btn sd-btn--line" onClick={onClear}>Clear filters</button></div></section>
      ) : (
        <section className="sd-panel mo-list mc-swap" aria-label="Recent requests">
          <div className="mo-row mo-head" aria-hidden="true"><span>Time</span><span>Method</span><span>Address</span><span>Took</span><span>Result</span></div>
          {pageRows.map((r, i) => {
            const sp = speedOf(r.duration);
            return (
              <article key={`${r.timestamp}-${i}`} className="mo-row mo-item" data-bad={r.statusCode >= 500}>
                <span className="mo-time">{time.format(new Date(r.timestamp))}</span>
                <span className="sm-chip">{r.method}</span>
                <code className="mo-ep">{r.endpoint}</code>
                <span className="mo-ms" data-s={sp}>{r.duration} ms</span>
                <span className="mo-code" data-k={r.statusCode >= 500 ? "server" : r.statusCode >= 400 ? "client" : "ok"}>{r.statusCode}</span>
              </article>
            );
          })}
          <Pager offset={(page - 1) * pageSize} count={pageRows.length} total={rows.length} pageSize={pageSize} noun="requests" onPrev={() => onPage(Math.max(1, page - 1))} onNext={() => onPage(page + 1)} />
        </section>
      )}
    </>
  );
}
