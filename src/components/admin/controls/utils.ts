export { plural } from "../students/utils";

export interface Announcement {
  enabled: boolean;
  text: string;
  level: "info" | "warning" | "critical";
}

export interface Controls {
  maintenance_mode: boolean;
  maintenance_message: string;
  announcement: Announcement;
  feature_flags: Record<string, boolean>;
}

export const EMPTY: Controls = {
  maintenance_mode: false,
  maintenance_message: "",
  announcement: { enabled: false, text: "", level: "info" },
  feature_flags: {},
};

export type Part = "maintenance" | "announcement" | "flags";
export const PARTS: { key: Part; label: string; short: string }[] = [
  { key: "maintenance", label: "Maintenance mode", short: "Maintenance" },
  { key: "announcement", label: "Announcement banner", short: "Announcement" },
  { key: "flags", label: "Feature flags", short: "Flags" },
];

export const MAX_TEXT = 500;
/** Same rule the server enforces, so a bad name is caught here with a reason instead of silently dropped. */
export const FLAG_RE = /^[\w.-]{1,64}$/;
export const toFlagName = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, "_");
