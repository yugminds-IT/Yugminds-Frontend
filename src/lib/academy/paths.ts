/**
 * Academy path helpers. Internal routes live under `/academy/*`; on
 * academy.yugminds.org the visible URL has no prefix (middleware rewrite).
 */

export function toAcademyPath(pathname: string): string {
  if (pathname === "/academy" || pathname.startsWith("/academy/")) return pathname;
  return pathname === "/" ? "/academy" : `/academy${pathname}`;
}

const SIGNED_IN = /^\/academy\/(learn|tutor|admin|checkout)(\/|$|\?)/;

/** Only in-app signed-in Academy pages are allowed as a post-login `next`. */
export function safeAcademyNext(raw: string | null | undefined): string | null {
  if (!raw || raw.includes("//") || raw.includes("://")) return null;
  return SIGNED_IN.test(raw) ? raw : null;
}

export const HOME_BY_ROLE = {
  LEARNER: "/academy/learn",
  TUTOR: "/academy/tutor",
  ADMIN: "/academy/admin",
} as const;
