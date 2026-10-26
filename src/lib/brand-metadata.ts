import { headers } from "next/headers";
import type { Metadata } from "next";
import {
  BRAND_ORIGINS,
  HEADER_INTERNAL_PATH,
  brandFromHostname,
  brandOrigin,
  canonicalUrl,
  fallbackAppUrl,
  isDevHost,
  isLmsIndexablePath,
  normalizeHost,
  resolveBrand,
  type Brand,
} from "./brand-host";
import { brandSiteName, lookupPageSeo } from "./page-seo";

export async function readRequestHost(): Promise<string> {
  const h = await headers();
  return normalizeHost(h.get("x-forwarded-host") || h.get("host"));
}

export async function readInternalPathname(): Promise<string> {
  const h = await headers();
  const fromMw = h.get(HEADER_INTERNAL_PATH);
  if (fromMw) return fromMw;
  const nextUrl = h.get("next-url");
  if (nextUrl) {
    try {
      return new URL(nextUrl, "http://local").pathname;
    } catch {
      /* ignore */
    }
  }
  return "/";
}

export async function resolveRequestBrand(): Promise<Brand> {
  const hostname = await readRequestHost();
  const pathname = await readInternalPathname();
  if (isDevHost(hostname)) {
    return resolveBrand(hostname, pathname);
  }
  return brandFromHostname(hostname) ?? resolveBrand(hostname, pathname);
}

export async function metadataBaseForRequest(): Promise<URL> {
  const brand = await resolveRequestBrand();
  const hostname = await readRequestHost();
  if (isDevHost(hostname)) {
    return new URL(fallbackAppUrl());
  }
  return new URL(brandOrigin(brand));
}

type BrandCopy = {
  siteName: string;
  title: string;
  description: string;
  keywords: string[];
};

/** Fallback when no per-page SEO entry exists. */
const BRAND_COPY: Record<Brand, BrandCopy> = {
  yugminds: {
    siteName: "YugMinds",
    title: "YugMinds — Software, Electronics & STEM Education",
    description:
      "YugMinds builds software, electronics, and machines under one roof — and teaches the next generation through RoboCoders STEM programs.",
    keywords: ["YugMinds", "software", "electronics", "STEM education", "RoboCoders"],
  },
  robocoders: {
    siteName: "RoboCoders",
    title: "RoboCoders — Coding, Robotics & AI for Students",
    description:
      "RoboCoders is YugMinds’ STEM education initiative. Students learn coding, robotics, and AI through hands-on programs for schools and learners ages 6–18.",
    keywords: ["RoboCoders", "coding and robotics", "STEM education", "YugMinds"],
  },
  lms: {
    siteName: "RoboCoders LMS",
    title: "RoboCoders LMS Login",
    description:
      "Sign in to RoboCoders LMS — courses, assignments, attendance, and certificates for schools, teachers, and students.",
    keywords: ["RoboCoders LMS", "LMS login", "student portal"],
  },
  academy: {
    siteName: "RoboCoders Academy",
    title: "RoboCoders Academy — Online Coding & Robotics Courses, Live 1:1 Classes",
    description:
      "Learn coding, robotics and AI online with self-paced courses and live 1:1 sessions with RoboCoders tutors. Certificates included.",
    keywords: ["online coding course for kids", "robotics course online", "1:1 coding classes", "RoboCoders Academy"],
  },
};

export async function buildBrandMetadata(
  brand: Brand,
  internalPath: string,
  overrides?: Partial<Metadata>,
): Promise<Metadata> {
  const page = lookupPageSeo(internalPath);
  const copy = page
    ? {
        siteName: brandSiteName(brand),
        title: page.title,
        description: page.description,
        keywords: page.keywords,
      }
    : BRAND_COPY[brand];

  const hostname = await readRequestHost();
  const base = isDevHost(hostname) ? fallbackAppUrl() : brandOrigin(brand);
  const canonical = isDevHost(hostname)
    ? `${fallbackAppUrl()}${internalPath === "/" ? "" : internalPath}`
    : canonicalUrl(brand, internalPath);

  const isProductionHost = brandFromHostname(hostname) !== null;
  // Individual certificate pages carry student names — reachable, but not indexed.
  const isCertificatePage = internalPath.startsWith("/robocoders/lms/verify/");
  const robots: Metadata["robots"] =
    !isProductionHost ||
    isCertificatePage ||
    (brand === "lms" && !isLmsIndexablePath(internalPath)) ||
    // Academy dashboards, auth and checkout are private; storefront pages are indexed.
    (brand === "academy" && /^\/academy\/(learn|tutor|admin|checkout|login|signup)(\/|$)/.test(internalPath))
      ? { index: false, follow: false }
      : { index: true, follow: true };

  const shareImage = {
    url: `/og/${brand}.png`,
    width: 1200,
    height: 630,
    alt: copy.title,
    type: "image/png",
  };

  return {
    metadataBase: new URL(base),
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
    robots,
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      siteName: copy.siteName,
      type: "website",
      locale: "en_IN",
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [shareImage],
    },
    alternates: { canonical },
    ...overrides,
  };
}

export { BRAND_ORIGINS, BRAND_COPY };
