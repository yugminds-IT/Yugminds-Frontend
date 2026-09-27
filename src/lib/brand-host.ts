/**
 * Host ↔ brand mapping for multi-subdomain routing.
 * Internal routes stay `/`, `/robocoders/*`, `/lms/*`; see `routeForHost` for public URLs.
 */

export type Brand = "yugminds" | "robocoders" | "lms";

export const YUGMINDS_HOSTS = ["yugminds.org", "www.yugminds.org"] as const;
export const ROBOCODERS_HOST = "robocoders.yugminds.org";
export const LMS_HOST = "lms.yugminds.org";

export const BRAND_ORIGINS: Record<Brand, string> = {
  yugminds: "https://yugminds.org",
  robocoders: `https://${ROBOCODERS_HOST}`,
  lms: `https://${LMS_HOST}`,
};

/** Canonical public verify URL (single indexable location). */
export function getVerifyCertUrl(shortId?: string): string {
  const base = `${BRAND_ORIGINS.robocoders}/lms/verify`;
  return shortId ? `${base}/${shortId}` : base;
}

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.split(":")[0].trim().toLowerCase();
}

export function isDevHost(hostname: string): boolean {
  const h = normalizeHost(hostname);
  return (
    !h ||
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".vercel.app") ||
    h.endsWith(".local")
  );
}

export function brandFromHostname(hostname: string): Brand | null {
  const h = normalizeHost(hostname);
  if (YUGMINDS_HOSTS.includes(h as (typeof YUGMINDS_HOSTS)[number])) {
    return "yugminds";
  }
  if (h === ROBOCODERS_HOST) return "robocoders";
  if (h === LMS_HOST) return "lms";
  return null;
}

/** Brand for metadata/schema: host first, else path prefix (path-based access on root). */
export function resolveBrand(hostname: string, pathname: string): Brand {
  const fromHost = brandFromHostname(hostname);
  if (fromHost === "robocoders" || fromHost === "lms") return fromHost;
  if (pathname === "/robocoders" || pathname.startsWith("/robocoders/")) {
    return "robocoders";
  }
  if (pathname === "/lms" || pathname.startsWith("/lms/")) return "lms";
  return "yugminds";
}

export function shouldSkipHostPrefix(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    /\.(css|js|json|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|mp4|webp|txt|xml|map)$/i.test(
      pathname,
    )
  );
}

export type HostRoute =
  | { kind: "pass" }
  | { kind: "rewrite"; path: string }
  | { kind: "redirect"; url: string; status: 307 | 308 };

function hasPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * How a production host serves a path:
 * - yugminds.org: root site; `/robocoders*` and `/lms*` move to their subdomains.
 * - robocoders.yugminds.org: clean URLs rewritten under `/robocoders`.
 * - lms.yugminds.org: keeps the `/lms` prefix visible (client code relies on it).
 * `/lms/verify` is canonical on the RoboCoders host.
 */
export function routeForHost(brand: Brand | null, path: string): HostRoute {
  if (!brand || shouldSkipHostPrefix(path)) return { kind: "pass" };

  const verify = path.match(/^(?:\/robocoders)?\/lms\/verify(\/.*)?$/);
  if (verify) {
    if (brand === "robocoders" && hasPrefix(path, "/lms/verify")) {
      return { kind: "rewrite", path: `/robocoders${path}` };
    }
    return {
      kind: "redirect",
      url: `${BRAND_ORIGINS.robocoders}/lms/verify${verify[1] ?? ""}`,
      status: 308,
    };
  }

  const toRobocoders = (): HostRoute => ({
    kind: "redirect",
    url: `${BRAND_ORIGINS.robocoders}${path.slice("/robocoders".length) || "/"}`,
    status: 308,
  });

  if (brand === "yugminds") {
    if (hasPrefix(path, "/robocoders")) return toRobocoders();
    if (hasPrefix(path, "/lms")) {
      return { kind: "redirect", url: `${BRAND_ORIGINS.lms}${path}`, status: 308 };
    }
    return { kind: "pass" };
  }

  if (brand === "robocoders") {
    if (hasPrefix(path, "/robocoders")) return toRobocoders();
    if (hasPrefix(path, "/lms")) {
      return { kind: "redirect", url: `${BRAND_ORIGINS.lms}${path}`, status: 308 };
    }
    return { kind: "rewrite", path: path === "/" ? "/robocoders" : `/robocoders${path}` };
  }

  // lms
  if (path === "/" || path === "/lms") {
    return { kind: "redirect", url: `${BRAND_ORIGINS.lms}/lms/login`, status: 307 };
  }
  if (hasPrefix(path, "/lms")) return { kind: "pass" };
  if (hasPrefix(path, "/robocoders")) return toRobocoders();
  return { kind: "redirect", url: `${BRAND_ORIGINS.lms}/lms${path}`, status: 308 };
}

/** Browser-visible path for an internal route on that brand's host. */
export function toPublicPath(brand: Brand, internalPath: string): string {
  if (brand === "robocoders") {
    if (internalPath === "/robocoders") return "/";
    if (internalPath.startsWith("/robocoders/")) {
      return internalPath.slice("/robocoders".length) || "/";
    }
  }
  return internalPath || "/";
}

export function brandOrigin(brand: Brand): string {
  return BRAND_ORIGINS[brand];
}

/** Always prefer the brand's canonical host (even when hit via path on root). */
export function canonicalUrl(brand: Brand, internalPath: string): string {
  const origin = brandOrigin(brand);
  if (brand === "yugminds") {
    const path = internalPath === "/" ? "" : internalPath;
    return `${origin}${path}`;
  }
  const pub = toPublicPath(brand, internalPath);
  return pub === "/" ? origin : `${origin}${pub}`;
}

export function fallbackAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    BRAND_ORIGINS.yugminds
  );
}

/** LMS paths that may be indexed. */
export function isLmsIndexablePath(internalPath: string): boolean {
  const indexable = [
    "/lms/login",
    "/lms/signup",
    "/lms/forgot-password",
    "/lms/student-registration",
  ];
  return indexable.some((p) => internalPath === p || internalPath.startsWith(`${p}/`));
}

export const HEADER_BRAND = "x-brand";
export const HEADER_INTERNAL_PATH = "x-internal-pathname";
export const HEADER_PUBLIC_PATH = "x-public-pathname";
