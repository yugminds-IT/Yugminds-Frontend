/** Shared by the schools list and the school page: the API's school shape mapped to one flat record. */

/** Join code from API (school.joinCodes) */
export interface JoinCodeItem {
  id?: string;
  schoolId?: string;
  grade?: string;
  code?: string;
  usageType?: string;
  maxUses?: number;
  usedCount?: number;
  isActive?: boolean;
  expiresAt?: string;
  createdAt?: string;
}

export interface School {
  id: string;
  name: string;
  school_code?: string;
  join_code?: string;
  school_email?: string;
  school_admin_id?: string;
  school_admin_name?: string;
  school_admin_email?: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  contact_email: string;
  contact_phone: string;
  principal_name: string;
  affiliation_type?: string;
  school_type?: string;
  established_year?: number;
  logo_url?: string;
  grades_offered?: string[];
  total_students_estimate?: number;
  total_teachers_estimate?: number;
  /** Which weekdays the school holds classes — 0=Sun..6=Sat. */
  operating_days?: number[];
  status?: string;
  /** Join codes from backend school.joinCodes; preserved for UI */
  joining_codes?: JoinCodeItem[] | null;
  /** Rolled-up count when flat joinCodes not mapped */
  join_code_count?: number;
  teacher_count?: number;
  student_count?: number;
  is_active: boolean;
  created_at: string;
  created_by?: string;
}

function countJoinCodesInGrades(item: Record<string, unknown>): number {
  const grades = item.grades;
  if (!Array.isArray(grades)) return 0;
  let n = 0;
  for (const g of grades as { sections?: { joinCodes?: unknown[] }[] }[]) {
    for (const sec of g.sections ?? []) {
      n += (sec.joinCodes ?? []).length;
    }
  }
  return n;
}

/** Map API school (EdTech flat shape or legacy tenant+school) to UI School type */
export function mapApiSchoolToSchool(item: Record<string, unknown>): School {
  const legacy = (item.school ?? {}) as Record<string, unknown>;
  const flat = item.grades != null || item.gradesOffered != null ? item : legacy;
  const v = (key: string) => (flat as Record<string, unknown>)[key] ?? (legacy as Record<string, unknown>)[key] ?? item[key];
  const emailOnly = v("email") ?? v("contact_email");
  const flatJoin = (v("joinCodes") ?? v("joining_codes")) as JoinCodeItem[] | null | undefined;
  const joinList = Array.isArray(flatJoin) ? flatJoin : null;
  const join_code_count =
    joinList != null
      ? joinList.length
      : typeof v("join_code_count") === "number"
        ? (v("join_code_count") as number)
        : countJoinCodesInGrades(item as Record<string, unknown>);
  return {
    id: String(v("id") ?? ""),
    name: String(v("name") ?? ""),
    school_code: (v("schoolCode") ?? v("school_code")) as string | undefined,
    join_code: (v("joinCode") ?? v("join_code")) as string | undefined,
    school_email: (v("email") ?? v("school_email")) as string | undefined,
    school_admin_id:
      (v("school_admin_user_id") as string | number | undefined) != null
        ? String(v("school_admin_user_id"))
        : (item.school_admin_id as string | undefined),
    school_admin_name: (v("school_admin_name") as string | undefined) ?? undefined,
    school_admin_email: (v("school_admin_email") as string | undefined) ?? undefined,
    address: String(v("address") ?? ""),
    city: v("city") as string | undefined,
    state: v("state") as string | undefined,
    country: v("country") as string | undefined,
    pincode: v("pincode") as string | undefined,
    contact_email:
      emailOnly != null && String(emailOnly).trim() !== ""
        ? String(emailOnly)
        : "",
    contact_phone: String(v("phone") ?? v("contact_phone") ?? ""),
    principal_name: String(v("principalName") ?? v("principal_name") ?? ""),
    affiliation_type: (v("affiliationType") ?? v("affiliation_type")) as string | undefined,
    school_type: (v("schoolType") ?? v("school_type")) as string | undefined,
    established_year: (v("establishedYear") ?? v("established_year")) as number | undefined,
    logo_url: (v("logoUrl") ?? v("logo_url")) as string | undefined,
    grades_offered: (v("gradesOffered") ?? v("grades_offered")) as string[] | undefined,
    total_students_estimate: (v("totalStudentsEstimate") ?? v("total_students_estimate")) as number | undefined,
    total_teachers_estimate: (v("totalTeachersEstimate") ?? v("total_teachers_estimate")) as number | undefined,
    operating_days: (v("operatingDays") ?? v("operating_days")) as number[] | undefined,
    status: v("status") as string | undefined,
    joining_codes: joinList,
    join_code_count,
    teacher_count:
      typeof v("teacherCount") === "number"
        ? (v("teacherCount") as number)
        : typeof v("teacher_count") === "number"
          ? (v("teacher_count") as number)
          : undefined,
    student_count:
      typeof v("studentCount") === "number"
        ? (v("studentCount") as number)
        : typeof v("student_count") === "number"
          ? (v("student_count") as number)
          : undefined,
    is_active: typeof v("isActive") === "boolean" ? (v("isActive") as boolean) : typeof v("is_active") === "boolean" ? (v("is_active") as boolean) : false,
    created_at: String(v("createdAt") ?? v("created_at") ?? new Date().toISOString()),
    created_by: item.created_by as string | undefined,
  };
}


/** What a school still needs before it is ready for students. */
export const hasAdmin = (s: School) => !!(s.school_admin_name || s.school_admin_email || s.school_admin_id);
export const hasCodes = (s: School) => (s.join_code_count ?? 0) > 0;

export type Stage = "ready" | "setup" | "off";
export const STAGE_LABEL: Record<Stage, string> = { ready: "Ready", setup: "Needs setup", off: "Inactive" };
export function stageOf(s: School): Stage {
  if (!s.is_active) return "off";
  return hasAdmin(s) && hasCodes(s) ? "ready" : "setup";
}

/** What is missing, in words, for a school that needs setup. */
export function missingOf(s: School): string[] {
  const out: string[] = [];
  if (!hasAdmin(s)) out.push("a school admin");
  if (!hasCodes(s)) out.push("joining codes");
  return out;
}

export const placeOf = (s: School) => [s.city, s.state].filter(Boolean).join(", ");
