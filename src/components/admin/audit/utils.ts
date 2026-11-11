export { plural } from "../students/utils";

export interface AuditLogRow {
  id: string;
  actorId: number | null;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  schoolId: string | null;
  schoolName: string | null;
  /** set when an admin did this while acting as the person above */
  impersonatedBy?: { id: number; name: string } | null;
  method: string;
  path: string;
  entityType: string | null;
  entityId: string | null;
  payload: unknown;
  statusCode: number | null;
  success: boolean;
  ipAddress: string | null;
  createdAt: string;
}

/** Only changes are recorded: requests that create, change or delete something, by admins, school admins, teachers and (for key actions) students. Never reads or sign-ins. */
export type Method = "POST" | "PATCH" | "PUT" | "DELETE";
export const METHODS: Method[] = ["POST", "PATCH", "PUT", "DELETE"];
export const METHOD_LABEL: Record<Method, string> = { POST: "Added", PATCH: "Changed", PUT: "Replaced", DELETE: "Deleted" };
/** A POST either adds something or runs an action such as "restore", so the track names both. */
export const TRACK_LABEL: Record<Method, string> = { POST: "Added or run", PATCH: "Changed", PUT: "Replaced", DELETE: "Deleted" };

const LABELS: Record<string, string> = {
  students: "student",
  teachers: "teacher",
  schools: "school",
  "school-admins": "school admin",
  courses: "course",
  certificates: "certificate",
  "contact-submissions": "contact message",
  "joining-codes": "joining code",
  licenses: "license",
  logos: "logo",
  community: "community page item",
  trash: "trash item",
  "system-controls": "system controls",
  calendar: "calendar entry",
  leaves: "leave request",
  "password-reset-requests": "password reset",
  reports: "report",
  "teacher-reports": "teacher report",
  settings: "settings",
  notifications: "notification",
  "saved-views": "saved view",
  impersonation: "impersonation",
  "create-account": "new account",
  profile: "profile",
  assignments: "assignment",
  schedules: "timetable entry",
  rooms: "room",
  periods: "period",
  attendance: "attendance record",
  "retake-requests": "retake request",
  data: "imported data",
};
export const entityLabel = (type: string | null) => (type ? (LABELS[type] ?? type.replace(/[-_]/g, " ")) : "record");

const isId = (s: string) => /^\d+$/.test(s) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) || /^c[a-z0-9]{20,}$/i.test(s);
const sentence = (s: string) => { const t = s.replace(/[-_]/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };

/**
 * Turns "PATCH /admin/students/42/enroll" into "Enroll · student" with the record's id, so nobody has to read a URL.
 * `kind` is the short tag on the row: what the request did, or "Action" when it ran a named action.
 */
export function describe(l: AuditLogRow): { headline: string; id: string | null; kind: string } {
  const parts = l.path.split("?")[0].split("/").filter(Boolean).slice(1); // drop "admin"
  const rest = parts.slice(1);
  // "/students/42/enroll" has an id then an action; "/trash/restore" has just an action; "/students/42" has just an id
  const id = rest.length >= 2 ? rest[0] : rest.length === 1 && isId(rest[0]) ? rest[0] : null;
  const action = rest.length >= 2 ? rest[1] : rest.length === 1 && !isId(rest[0]) ? rest[0] : null;
  const what = entityLabel(l.entityType ?? parts[0] ?? null);
  const verb = l.method === "POST" ? "Added" : l.method === "DELETE" ? "Deleted" : "Changed";
  return { headline: action ? `${sentence(action)} · ${what}` : `${verb} ${what}`, id, kind: action ? "Action" : (METHOD_LABEL[l.method as Method] ?? l.method) };
}

export const whoOf = (l: AuditLogRow) => l.actorName ?? l.actorEmail ?? "Unknown";

/** Who did it: the dashboard they work in. */
export type ActorRole = "admin" | "school_admin" | "teacher" | "student";
export const ACTOR_ROLES: ActorRole[] = ["admin", "school_admin", "teacher", "student"];
export const ROLE_LABEL: Record<string, string> = { admin: "Admin", school_admin: "School admin", teacher: "Teacher", student: "Student" };
export const roleLabel = (r: string | null) => (r ? (ROLE_LABEL[r] ?? r) : "Not signed in");

export interface ActorSummary { role: string; total: number; failed: number; deleted: number }
export interface PersonSummary { actor_id: number | null; name: string; email: string | null; role: string | null; total: number; failed: number; deleted: number }
export interface AuditSummary { by_role: ActorSummary[]; top_people: PersonSummary[] }

export const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

export interface Filters { search: string; entityType: string; method: string; from: string; to: string; role: string; schoolId: string; actorId: string; attention: boolean }
export const NO_FILTERS: Filters = { search: "", entityType: "all", method: "all", from: "", to: "", role: "all", schoolId: "", actorId: "", attention: false };

/** The query the server understands, from the filters on screen. Dates cover the whole of both days. */
export function toParams(f: Filters) {
  return {
    search: f.search || undefined,
    entityType: f.entityType !== "all" ? f.entityType : undefined,
    method: f.method !== "all" ? f.method : undefined,
    actorRole: f.role !== "all" ? f.role : undefined,
    schoolId: f.schoolId || undefined,
    actorId: f.actorId || undefined,
    attention: f.attention ? "true" : undefined,
    from: f.from ? new Date(f.from).toISOString() : undefined,
    to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : undefined,
  };
}
