import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { BRAND_ORIGINS, brandFromHostname, normalizeHost } from "../lib/brand-host";

/** Answer-engine crawlers (ChatGPT, Gemini, Perplexity, Claude, Apple, etc.) we explicitly welcome. */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Google-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "Amazonbot",
  "DuckAssistBot",
  "MistralAI-User",
  "CCBot",
];

type Rule = { allow?: string | string[]; disallow?: string | string[] };

// A crawler matching a named group ignores the `*` group, so AI bots get the same rules repeated.
function withAiCrawlers(rule: Rule): MetadataRoute.Robots["rules"] {
  return [
    { userAgent: "*", ...rule },
    { userAgent: AI_CRAWLERS, ...rule },
  ];
}

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
      rules: withAiCrawlers({
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
      }),
      sitemap,
    };
  }

  if (brand === "academy") {
    return {
      rules: withAiCrawlers({
        allow: "/",
        disallow: [...sharedDisallow, "/learn", "/tutor", "/admin", "/checkout", "/login", "/signup"],
      }),
      sitemap,
    };
  }

  return {
    rules: withAiCrawlers({ allow: "/", disallow: sharedDisallow }),
    sitemap,
  };
}
