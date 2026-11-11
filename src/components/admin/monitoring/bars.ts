import type { HourPoint } from "./utils";

export type Range = "24" | "72" | "168";

const hourFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: true });
const hourMinFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
/** "2 pm", or "1:30 pm" where the clock is on a half hour (India time is UTC+5:30, so saved hours start at :30). */
const hourLabel = (d: Date) => (d.getMinutes() === 0 ? hourFmt : hourMinFmt).format(d);
const dayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric" });
const fullLabel = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const fullDay = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" });

/**
 * Group hours into bars: every hour for a day, every 3 hours for 3 days, every calendar day for a week.
 * Groups follow the viewer's own clock (so a "Mon" bar is Monday, midnight to midnight), not blocks counted
 * from whatever hour the range happens to start.
 */
export function bars(series: HourPoint[], range: Range) {
  const out: { label: string; full: string; requests: number; server: number; client: number; avg: number; over1s: number; slowShare: number }[] = [];
  const keyOf = (d: Date) => {
    const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return range === "24" ? d.toISOString() : range === "72" ? `${day}-${Math.floor(d.getHours() / 3)}` : day;
  };
  let group: HourPoint[] = [];
  let key = "";
  const flush = () => {
    if (group.length === 0) return;
    const first = new Date(group[0].hour);
    const requests = group.reduce((a, p) => a + p.requests, 0);
    const totalMs = group.reduce((a, p) => a + p.avg_ms * p.requests, 0);
    // a 3-hour block is named by where it starts on the clock (12 pm, 3 pm...), even if only part of it is in range
    const blockStart = new Date(first);
    if (range === "72") blockStart.setHours(Math.floor(first.getHours() / 3) * 3, 0, 0, 0);
    out.push({
      label: range === "24" ? hourLabel(first) : range === "72" ? `${dayLabel.format(blockStart).split(" ")[0]} ${hourLabel(blockStart)}` : dayLabel.format(first),
      full: range === "168" ? `${fullDay.format(first)}${group.length < 24 ? `, ${group.length} hours` : ""}` : `${fullLabel.format(range === "72" ? blockStart : first)}${group.length > 1 ? `, ${group.length} hours` : ""}`,
      requests,
      server: group.reduce((a, p) => a + p.server_errors, 0),
      client: group.reduce((a, p) => a + p.client_errors, 0),
      avg: requests > 0 ? Math.round(totalMs / requests) : 0,
      over1s: group.reduce((a, p) => a + p.over_1s, 0),
      slowShare: requests > 0 ? group.reduce((a, p) => a + p.slow, 0) / requests : 0,
    });
    group = [];
  };
  for (const p of series) {
    const k = keyOf(new Date(p.hour));
    if (k !== key) flush();
    key = k;
    group.push(p);
  }
  flush();
  return out;
}

