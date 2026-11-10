/** Shared by the admin RoboCoders licenses page and its tabs. */

export type LicenseItem = {
  id: string;
  school_id: string;
  system_label: string;
  machine_id: string;
  license_number: number;
  expected_license_number?: number;
  key_build_mismatch?: boolean;
  start_date: string;
  expiry_date: string;
  duration_days: number;
  activation_key: string;
  notes: string | null;
  is_active: boolean;
  days_remaining: number;
  is_expired: boolean;
  not_yet_active: boolean;
  created_at: string;
  updated_at: string;
};

export const MACHINE_ID_RE = /^[0-9A-F]{16}$/;
export const cleanMachineId = (v: string) => v.toUpperCase().replace(/[^0-9A-F]/g, "");

export const DURATION_PRESETS = [
  { label: "1 month (30 days)", days: 30 },
  { label: "3 months (90 days)", days: 90 },
  { label: "6 months (180 days)", days: 180 },
  { label: "1 year (365 days)", days: 365 },
  { label: "2 years (730 days)", days: 730 },
] as const;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The server sometimes wraps its payload in `data`; unwrap it. */
export function payloadOf(data: unknown): Record<string, unknown> {
  const root = (data ?? {}) as Record<string, unknown>;
  return root.data && typeof root.data === "object" && !Array.isArray(root.data) ? (root.data as Record<string, unknown>) : root;
}
export const licensesOf = (data: unknown) => (payloadOf(data).licenses as LicenseItem[] | undefined) ?? [];
export const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e instanceof Error ? e.message : "") || fallback;

/** Where a key stands: working, close to running out (30 days or fewer), expired, or switched off in this table. */
export type Stage = "active" | "soon" | "expired" | "off";
export const STAGES: Stage[] = ["active", "soon", "expired", "off"];
export const STAGE_LABEL: Record<Stage, string> = { active: "Active", soon: "Renew soon", expired: "Expired", off: "Deactivated" };
export const SOON_DAYS = 30;
export function stageOf(l: LicenseItem): Stage {
  if (!l.is_active) return "off";
  if (l.is_expired) return "expired";
  if (!l.not_yet_active && l.days_remaining <= SOON_DAYS) return "soon";
  return "active";
}

export const niceDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
