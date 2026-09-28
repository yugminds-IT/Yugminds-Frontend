import Link from "next/link";
import { BRAND_ORIGINS, type Brand } from "../../lib/brand-host";

export type Crumb = { name: string; path: string };

export function faqPageJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function breadcrumbJsonLd(crumbs: Crumb[], brand: Brand = "robocoders") {
  const origin = BRAND_ORIGINS[brand];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.path === "/" ? origin : `${origin}${c.path}`,
    })),
  };
}

export function courseListJsonLd(
  courses: { name: string; description: string; audience?: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@graph": courses.map((c) => ({
      "@type": "Course",
      name: c.name,
      description: c.description,
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
      ...(c.audience
        ? {
            audience: {
              "@type": "EducationalAudience",
              educationalRole: "student",
              name: c.audience,
            },
          }
        : {}),
      isAccessibleForFree: false,
      inLanguage: "en",
    })),
  };
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Visible breadcrumb + BreadcrumbList JSON-LD. `path` values are public RoboCoders paths (`/`, `/about`). */
export function RoboBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      {/* sr-only: the fixed navbar would cover a visible strip; Google reads the JSON-LD above. */}
      <nav aria-label="Breadcrumb" className="sr-only">
        <ol className="flex flex-wrap items-center gap-1.5">
          {crumbs.map((c, i) => {
            const href =
              c.path === "/"
                ? "/robocoders"
                : c.path.startsWith("/robocoders")
                  ? c.path
                  : `/robocoders${c.path}`;
            const isLast = i === crumbs.length - 1;
            return (
              <li key={`${c.path}-${c.name}`} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                {isLast ? (
                  <span className="text-gray-800 font-medium" aria-current="page">
                    {c.name}
                  </span>
                ) : (
                  <Link href={href} className="hover:text-blue-600 transition-colors">
                    {c.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
