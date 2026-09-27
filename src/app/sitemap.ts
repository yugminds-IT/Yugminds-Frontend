import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import {
  BRAND_ORIGINS,
  brandFromHostname,
  fallbackAppUrl,
  isDevHost,
  normalizeHost,
  type Brand,
} from "../lib/brand-host";

type Route = {
  path: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
};

async function resolveBrandAndOrigin(): Promise<{ brand: Brand; origin: string }> {
  const h = await headers();
  const hostname = normalizeHost(h.get("x-forwarded-host") || h.get("host"));
  if (isDevHost(hostname)) {
    return { brand: "yugminds", origin: fallbackAppUrl() };
  }
  const brand = brandFromHostname(hostname) ?? "yugminds";
  return { brand, origin: BRAND_ORIGINS[brand] };
}

function mapRoutes(origin: string, routes: Route[]): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const base = origin.replace(/\/$/, "");
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? base : `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { brand, origin } = await resolveBrandAndOrigin();

  if (brand === "robocoders") {
    return mapRoutes(origin, [
      { path: "/", changeFrequency: "weekly", priority: 1.0 },
      { path: "/about", changeFrequency: "monthly", priority: 0.8 },
      { path: "/programs", changeFrequency: "monthly", priority: 0.9 },
      { path: "/community", changeFrequency: "weekly", priority: 0.85 },
      { path: "/for-schools", changeFrequency: "monthly", priority: 0.85 },
      { path: "/for-parents", changeFrequency: "monthly", priority: 0.85 },
      { path: "/contact", changeFrequency: "monthly", priority: 0.75 },
      { path: "/lms/verify", changeFrequency: "monthly", priority: 0.4 },
    ]);
  }

  if (brand === "lms") {
    return mapRoutes(origin, [
      { path: "/lms/login", changeFrequency: "yearly", priority: 0.9 },
      { path: "/lms/signup", changeFrequency: "yearly", priority: 0.5 },
      { path: "/lms/student-registration", changeFrequency: "yearly", priority: 0.5 },
      { path: "/lms/forgot-password", changeFrequency: "yearly", priority: 0.3 },
    ]);
  }

  // YugMinds host (and local/preview): company home only.
  // Path-based RoboCoders/LMS URLs canonicalize to subdomains — omit from root sitemap.
  return mapRoutes(origin, [
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
  ]);
}
