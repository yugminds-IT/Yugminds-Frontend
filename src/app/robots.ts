import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { BRAND_ORIGINS, brandFromHostname, normalizeHost } from "../lib/brand-host";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const hostname = normalizeHost(h.get("x-forwarded-host") || h.get("host"));
  const brand = brandFromHostname(hostname);

  // dev.yugminds.org, localhost, previews: keep out of the index entirely.
  if (!brand) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  const sitemap = `${BRAND_ORIGINS[brand]}/sitemap.xml`;
  const sharedDisallow = ["/api/", "/sentry-example-page"];

  if (brand === "lms") {
    return {
      rules: [
        {
          userAgent: "*",
          allow: ["/login", "/signup", "/forgot-password", "/student-registration"],
          disallow: [
            ...sharedDisallow,
            "/admin",
            "/school-admin",
            "/teacher",
            "/student",
            "/auth/callback",
            "/redirect",
            "/reset-password",
            "/update-password",
          ],
        },
      ],
      sitemap,
    };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: sharedDisallow }],
    sitemap,
  };
}
