/**
 * JSON-LD structured data — host/path aware per brand.
 */

import {
  BRAND_ORIGINS,
  canonicalUrl,
  resolveBrand,
} from "../lib/brand-host";
import {
  readInternalPathname,
  readRequestHost,
} from "../lib/brand-metadata";
import { BUSINESS, HAS_FULL_ADDRESS } from "../lib/business-info";
import { PAGES_UPDATED, lookupPageSeo } from "../lib/page-seo";

// Built from the single business-facts source, so the site, the schema and
// every listing say the same thing. Unknown fields are simply left out.
const A = BUSINESS.address;
const ADDRESS = {
  "@type": "PostalAddress",
  ...(A.street ? { streetAddress: `${A.street}, ${A.locality}`, addressLocality: A.city } : { addressLocality: `${A.locality}, ${A.city}` }),
  addressRegion: A.region,
  ...(A.postalCode ? { postalCode: A.postalCode } : {}),
  addressCountry: A.country,
};

const CONTACT_POINT = {
  "@type": "ContactPoint",
  contactType: "customer support",
  email: BUSINESS.email,
  telephone: BUSINESS.phone,
  areaServed: "IN",
  availableLanguage: ["en"],
};

export async function StructuredData() {
  const hostname = await readRequestHost();
  const pathname = await readInternalPathname();
  const brand = resolveBrand(hostname, pathname);

  if (brand === "yugminds") {
    const url = BRAND_ORIGINS.yugminds;
    const organization = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${url}/#organization`,
      name: BUSINESS.name,
      legalName: BUSINESS.legalName,
      url,
      logo: `${url}/Yugminds_Official_Logo-preview.png`,
      description:
        "YugMinds is five companies under one roof in Hyderabad: Labs, Hardware, Software (custom software, websites, apps and complete IT services, built to each client's requirements), Manufacturing, and Robocoders robotics lessons for schools.",
      foundingDate: BUSINESS.foundingYear,
      email: BUSINESS.email,
      telephone: BUSINESS.phone,
      address: ADDRESS,
      contactPoint: CONTACT_POINT,
      ...(BUSINESS.sameAs.length ? { sameAs: BUSINESS.sameAs } : {}),
      subOrganization: {
        "@type": "Organization",
        name: "RoboCoders",
        url: BRAND_ORIGINS.robocoders,
      },
    };
    const website = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "YugMinds",
      url,
      publisher: { "@type": "Organization", name: "YugMinds", url },
    };
    // YugMinds is one page: name its sections so search engines can link to them.
    const sections = [
      { id: "divisions", name: "Our companies", about: "Labs, Hardware, Software, Manufacturing and Robocoders, and what each one builds." },
      { id: "products", name: "Products", about: "RoboCoders Studio, Simulator, ESP32 Robotics Kit, Junior Robotics Kit and Play Kit, with live demos." },
      { id: "about", name: "About YugMinds", about: "Why build with YugMinds: one roof, every part made in-house." },
      { id: "build", name: "What do you need built?", about: "Pick a project and see which YugMinds companies build it." },
      { id: "contact", name: "Contact", about: "Send a project brief or call the team in Begumpet, Hyderabad." },
    ];
    const webpage = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "YugMinds",
      url,
      hasPart: sections.map((s) => ({
        "@type": "WebPageElement",
        name: s.name,
        description: s.about,
        url: `${url}/#${s.id}`,
      })),
    };
    const navigation = {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      name: sections.map((s) => s.name),
      url: sections.map((s) => `${url}/#${s.id}`),
    };
    const localBusiness = HAS_FULL_ADDRESS
      ? {
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          "@id": `${url}/#office`,
          name: BUSINESS.name,
          url,
          image: `${url}/og/yugminds.png`,
          telephone: BUSINESS.phone,
          email: BUSINESS.email,
          address: ADDRESS,
          ...(BUSINESS.geo ? { geo: { "@type": "GeoCoordinates", ...BUSINESS.geo } } : {}),
          ...(BUSINESS.openingHours.length ? { openingHours: BUSINESS.openingHours } : {}),
          ...(BUSINESS.sameAs.length ? { sameAs: BUSINESS.sameAs } : {}),
          areaServed: { "@type": "Country", name: "India" },
          parentOrganization: { "@id": `${url}/#organization` },
        }
      : null;
    return (
      <>
        {localBusiness && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webpage) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(navigation) }}
        />
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
      "@type": "EducationalOrganization",
      "@id": `${url}/#organization`,
      name: "RoboCoders",
      alternateName: ["Robo Coders", "RoboCoders by YugMinds", "RoboCoders Hyderabad"],
      url,
      logo: `${url}/robocoders-logo.png`,
      knowsAbout: ["coding for kids", "robotics for kids", "artificial intelligence and machine learning", "Python", "Scratch", "Arduino", "ESP32", "STEM education"],
      // ponytail: add "Country" India or more states here as classes launch outside Telangana.
      areaServed: [{ "@type": "State", name: "Telangana" }],
      ...(BUSINESS.geo ? { geo: { "@type": "GeoCoordinates", ...BUSINESS.geo } } : {}),
      ...(BUSINESS.openingHours.length ? { openingHours: BUSINESS.openingHours } : {}),
      description:
        "RoboCoders — STEM education in AI, robotics, and programming. An EdTech initiative by YugMinds.",
      address: ADDRESS,
      email: BUSINESS.robocodersEmail,
      contactPoint: { ...CONTACT_POINT, email: BUSINESS.robocodersEmail },
      // Same profiles the footer links to (tracking params stripped), plus the parent's LinkedIn.
      sameAs: [
        "https://www.instagram.com/robocoders",
        "https://youtube.com/@robocoders",
        "https://www.facebook.com/share/1V8yjknAGv/",
        ...BUSINESS.sameAs,
      ],
      parentOrganization: {
        "@type": "Organization",
        "@id": `${BRAND_ORIGINS.yugminds}/#organization`,
        name: "YugMinds",
        legalName: BUSINESS.legalName,
        url: BRAND_ORIGINS.yugminds,
        foundingDate: BUSINESS.foundingYear,
      },
    };
    const website = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${url}/#website`,
      name: "RoboCoders",
      alternateName: ["Robo Coders", "RoboCoders by YugMinds"],
      inLanguage: "en-IN",
      url,
      description:
        "Empowering the next generation with STEM education — AI, robotics, and programming.",
      publisher: organization,
    };
    // Each indexable page states what it is and when it last changed (freshness signal for search and AI answers).
    const seo = lookupPageSeo(pathname);
    const pageUrl = canonicalUrl("robocoders", pathname);
    const webpage = seo
      ? {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${pageUrl}#webpage`,
          url: pageUrl,
          name: seo.title,
          description: seo.description,
          inLanguage: "en-IN",
          dateModified: PAGES_UPDATED,
          isPartOf: { "@id": `${url}/#website` },
          about: { "@id": `${url}/#organization` },
        }
      : null;
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
        {webpage && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(webpage) }}
          />
        )}
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
    image: `${BRAND_ORIGINS.robocoders}/robocoders-logo.png`,
    provider: {
      "@type": "Organization",
      name: "RoboCoders",
      url: BRAND_ORIGINS.robocoders,
      logo: `${BRAND_ORIGINS.robocoders}/robocoders-logo.png`,
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
    // The LMS root redirects here, so this page carries the site name Google shows in results.
    const website = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "RoboCoders LMS",
      alternateName: "RoboCoders",
      url: `${BRAND_ORIGINS.lms}/`,
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webApp) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
        />
      </>
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
