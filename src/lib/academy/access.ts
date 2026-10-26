/**
 * Pure middleware decision for the Academy dashboards (kept separate from the
 * LMS ROLE_ROUTES). Input: internal path + verified Academy JWT payload.
 */
import { HOME_BY_ROLE } from "./paths.ts";

export type AcademyRole = keyof typeof HOME_BY_ROLE;

const AREAS: { prefix: string; role: AcademyRole }[] = [
  { prefix: "/academy/learn", role: "LEARNER" },
  { prefix: "/academy/tutor", role: "TUTOR" },
  { prefix: "/academy/admin", role: "ADMIN" },
];

export function academyArea(internalPath: string): AcademyRole | null {
  const hit = AREAS.find((a) => internalPath === a.prefix || internalPath.startsWith(`${a.prefix}/`));
  return hit?.role ?? null;
}

/**
 * null = let through. Otherwise the internal path to redirect to: login when
 * there is no valid session, the account's own dashboard on a role mismatch.
 */
export function academyRedirect(
  internalPath: string,
  payload: { role?: string } | null,
): string | null {
  const needed = academyArea(internalPath);
  if (!needed) return null;
  if (!payload?.role || !(payload.role in HOME_BY_ROLE)) {
    return `/academy/login?next=${encodeURIComponent(internalPath)}`;
  }
  return payload.role === needed ? null : HOME_BY_ROLE[payload.role as AcademyRole];
}
