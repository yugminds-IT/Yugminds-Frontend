export { plural } from "../students/utils";

export interface EndpointStat {
  endpoint: string;
  requests: number;
  /** any response that is not 2xx or 3xx, so wrong passwords and "not found" count too */
  errors: number;
  avgDuration: number;
  p95Duration: number;
  successRate: number;
}

export interface ApiMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  endpointStats: EndpointStat[];
  uptimeSeconds: number;
}

/** Who made a request: one of the four dashboards, or "public" for anyone not signed in. */
export type Role = "admin" | "school_admin" | "teacher" | "student" | "public";
export const ROLES: Role[] = ["admin", "school_admin", "teacher", "student", "public"];
export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", school_admin: "School admin", teacher: "Teacher", student: "Student", public: "Public" };

export interface Request {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: number;
  userId?: string;
  role?: Role;
  schoolId?: string;
  schoolName?: string | null;
  error?: string;
}

export interface Alert { id: string; label: string; count: number; href?: string; tone: "red" | "amber" }

export const EMPTY: ApiMetrics = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, averageResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0, endpointStats: [], uptimeSeconds: 0 };

/** How fast a response was. */
export type Speed = "fast" | "normal" | "slow" | "crawl";
export const SPEEDS: Speed[] = ["fast", "normal", "slow", "crawl"];
export const SPEED_LABEL: Record<Speed, string> = { fast: "Under 200 ms", normal: "200 to 500 ms", slow: "500 ms to 1 s", crawl: "Over 1 s" };
export const speedOf = (ms: number): Speed => (ms < 200 ? "fast" : ms < 500 ? "normal" : ms < 1000 ? "slow" : "crawl");

export type Kind = "all" | "ok" | "client" | "server";
export const kindOf = (code: number): Exclude<Kind, "all"> => (code >= 500 ? "server" : code >= 400 ? "client" : "ok");

export function uptimeText(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} ${d === 1 ? "day" : "days"} ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${sec} s`;
}

/** Health is judged on server errors (5xx) in the recent requests. A 4xx is usually the caller's mistake, not the server's. */
export type Health = "waiting" | "healthy" | "degraded" | "unhealthy";
export function healthOf(recent: Request[]): { state: Health; server: number } {
  const server = recent.filter((r) => r.statusCode >= 500).length;
  if (recent.length === 0) return { state: "waiting", server };
  const rate = server / recent.length;
  return { state: server === 0 ? "healthy" : rate < 0.05 ? "degraded" : "unhealthy", server };
}

/** One hour of saved traffic. */
export interface HourPoint { hour: string; requests: number; ok: number; client_errors: number; server_errors: number; avg_ms: number; slow: number; over_1s: number; max_ms: number }
export interface Breakdown { requests: number; client_errors: number; server_errors: number; avg_ms: number; slow_percent: number }
export interface History {
  available: boolean;
  retention_days: number;
  hours: number;
  series: HourPoint[];
  totals: Breakdown;
  by_role: (Breakdown & { role: Role })[];
  by_school: (Breakdown & { school_id: string; school_name: string })[];
}
