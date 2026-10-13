import { headers } from "next/headers";
import {
  brandFromHostname,
  canonicalUrl,
  normalizeHost,
  resolveBrand,
  type Brand,
} from "../../lib/brand-host";
import { PAGE_SEO, brandSiteName } from "../../lib/page-seo";

const CONTACT =
  "- Company: YugMinds Private Limited, founded 2024\n" +
  "- Location: Begumpet, Hyderabad, Telangana, India\n" +
  "- Email: info@yugminds.org\n" +
  "- Phone: +91 85003 45655";

const SUMMARY: Record<Brand, string> = {
  yugminds:
    "YugMinds is a Hyderabad, India company that builds software, electronics, and machines under one roof, and teaches the next generation through RoboCoders, its STEM education initiative (https://robocoders.yugminds.org).",
  robocoders:
    "RoboCoders is the STEM education initiative of YugMinds (https://yugminds.org). Students aged 6–18 learn coding, robotics, and AI through hands-on programs delivered in partner schools across India, with kits, textbooks, certificates, and the RoboCoders LMS.",
  lms:
    "RoboCoders LMS is the learning platform for RoboCoders courses by YugMinds. Schools, teachers, and students use it for courses, assignments, attendance, progress reports, and certificates. Accounts are created with a school joining code; dashboards require sign-in.",
};

export async function GET() {
  const h = await headers();
  const brand = brandFromHostname(normalizeHost(h.get("x-forwarded-host") || h.get("host"))) ?? "yugminds";

  const pages = Object.entries(PAGE_SEO)
    .filter(([path]) => resolveBrand("", path) === brand)
    .map(([path, seo]) => `- [${seo.title}](${canonicalUrl(brand, path)}): ${seo.description}`)
    .join("\n");

  const body = `# ${brandSiteName(brand)}\n\n> ${SUMMARY[brand]}\n\n## Pages\n\n${pages}\n\n## Contact\n\n${CONTACT}\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
