/**
 * JSON-LD structured data — host/path aware per brand.
 */

import {
  BRAND_ORIGINS,
  resolveBrand,
} from "../lib/brand-host";
import {
  readInternalPathname,
  readRequestHost,
} from "../lib/brand-metadata";

export async function StructuredData() {
  const hostname = await readRequestHost();
  const pathname = await readInternalPathname();
  const brand = resolveBrand(hostname, pathname);

  if (brand === "yugminds") {
    const url = BRAND_ORIGINS.yugminds;
    const organization = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "YugMinds",
      url,
      logo: `${url}/icon.png`,
      description:
        "YugMinds builds software, electronics, and machines under one roof — and teaches the next generation through RoboCoders STEM programs.",
    };
    const website = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "YugMinds",
      url,
      publisher: { "@type": "Organization", name: "YugMinds", url },
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
        />
      </>
    );
  }

  if (brand === "robocoders") {
    const url = BRAND_ORIGINS.robocoders;
    const organization = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "RoboCoders",
      url,
      logo: `${url}/icon.png`,
      description:
        "RoboCoders — STEM education in AI, robotics, and programming. An EdTech initiative by YugMinds.",
      parentOrganization: {
        "@type": "Organization",
        name: "YugMinds",
        url: BRAND_ORIGINS.yugminds,
      },
    };
    const website = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "RoboCoders",
      url,
      description:
        "Empowering the next generation with STEM education — AI, robotics, and programming.",
      publisher: organization,
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
        />
      </>
    );
  }

  // LMS — WebApplication on login (and siblings under LMS host / path)
  const loginUrl = `${BRAND_ORIGINS.lms}/login`;
  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "RoboCoders LMS",
    url: loginUrl,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    description:
      "RoboCoders LMS — the learning platform for RoboCoders courses, used by schools, teachers, and students.",
    provider: {
      "@type": "Organization",
      name: "RoboCoders",
      url: BRAND_ORIGINS.robocoders,
      parentOrganization: {
        "@type": "Organization",
        name: "YugMinds",
        url: BRAND_ORIGINS.yugminds,
      },
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
  };

  if (pathname === "/lms/login" || pathname.endsWith("/login")) {
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApp) }}
      />
    );
  }

  // Other LMS pages: light WebPage only (dashboards are noindex)
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "RoboCoders LMS",
    url: BRAND_ORIGINS.lms,
    isPartOf: {
      "@type": "WebApplication",
      name: "RoboCoders LMS",
      url: loginUrl,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }}
    />
  );
}
