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

const YUGMINDS_ROUTES: Route[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/divisions", changeFrequency: "monthly", priority: 0.8 },
  { path: "/work", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
];

const ROBOCODERS_ROUTES: Route[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/programs", changeFrequency: "monthly", priority: 0.9 },
  { path: "/community", changeFrequency: "weekly", priority: 0.85 },
  { path: "/for-schools", changeFrequency: "monthly", priority: 0.85 },
  { path: "/for-parents", changeFrequency: "monthly", priority: 0.85 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.75 },
  { path: "/lms/verify", changeFrequency: "monthly", priority: 0.4 },
];

const LMS_ROUTES: Route[] = [
  { path: "/login", changeFrequency: "yearly", priority: 0.9 },
  { path: "/signup", changeFrequency: "yearly", priority: 0.5 },
  { path: "/student-registration", changeFrequency: "yearly", priority: 0.5 },
  { path: "/forgot-password", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { brand, origin } = await resolveBrandAndOrigin();

  if (brand === "robocoders") return mapRoutes(origin, ROBOCODERS_ROUTES);
  if (brand === "lms") return mapRoutes(origin, LMS_ROUTES);
  return mapRoutes(origin, YUGMINDS_ROUTES);
}
