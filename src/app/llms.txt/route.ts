import { headers } from "next/headers";
import {
  brandFromHostname,
  canonicalUrl,
  normalizeHost,
  resolveBrand,
  type Brand,
} from "../../lib/brand-host";
import { PAGE_SEO, PAGES_UPDATED, brandSiteName } from "../../lib/page-seo";
import { BUSINESS, BUSINESS_ADDRESS_DISPLAY } from "../../lib/business-info";

const contact = (email: string) =>
  `- Company: ${BUSINESS.legalName}, founded ${BUSINESS.foundingYear}\n` +
  `- Location: ${BUSINESS_ADDRESS_DISPLAY}\n` +
  `- Email: ${email}\n` +
  `- Phone: ${BUSINESS.phoneDisplay}`;

// yugminds.org is one page; these are its named sections.
const YUGMINDS_SECTIONS =
  "- [Our companies](https://yugminds.org/#divisions): YugMinds Labs (prototypes), Hardware (electronics and circuit boards), Software (custom software, websites, apps and complete IT services, built to each client's requirements), Manufacturing (bodies, chassis and parts in volume) and Robocoders (robotics lessons for schools).\n" +
  "- [Products](https://yugminds.org/#products): RoboCoders Studio (block and Python coding), RoboCoders Simulator (test ESP32 circuits before building), ESP32 Robotics Kit, the no-code Junior Robotics Kit for grades 1 to 3 and the screen-free Play Kit.\n" +
  "- [About](https://yugminds.org/#about): why build with YugMinds: one brief covers every part, and prototypes go straight to production.\n" +
  "- [What do you need built?](https://yugminds.org/#build): which companies build a robot, a school robotics lab, software, a website or an app, an idea to test, or parts in volume.\n" +
  "- [Contact](https://yugminds.org/#contact): send a project brief or request a call back.";

// Plain facts an AI agent can quote (ai-seo skill). Only facts already on the site.
const ROBOCODERS_FACTS =
  "\n\n## Key facts\n\n- Ages: 6 to 18, three tracks: coding, robotics and electronics, AI and machine learning\n" +
  "- Formats: partner-school programs, online live 1:1 classes, self-paced video courses\n" +
  "- Free trial class available, no payment needed\n" +
  "- Serves Hyderabad and Telangana; online classes open to learners across India\n" +
  "- Updated: " + PAGES_UPDATED;

const SUMMARY: Record<Brand, string> = {
  yugminds:
    "YugMinds is five companies under one roof in Begumpet, Hyderabad, India: Labs, Hardware, Software and Manufacturing build robots, electronics, machines, and custom software, websites and apps (with complete IT services) to each client's requirements, and Robocoders (https://robocoders.yugminds.org) teaches kids to build and code robots in schools.",
  robocoders:
    "RoboCoders is the STEM education initiative of YugMinds (https://yugminds.org). Students aged 6–18 learn coding, robotics, and AI through hands-on programs delivered in partner schools across India, with kits, textbooks, certificates, and the RoboCoders LMS.",
  lms:
    "RoboCoders LMS is the learning platform for RoboCoders courses by YugMinds. Schools, teachers, and students use it for courses, assignments, attendance, progress reports, and certificates. Accounts are created with a school joining code; dashboards require sign-in.",
  academy:
    "RoboCoders Academy is the online learning store of YugMinds: self-paced coding, robotics and AI courses plus live 1:1 sessions with RoboCoders tutors, for learners anywhere in India.",
};

export async function GET() {
  const h = await headers();
  const brand = brandFromHostname(normalizeHost(h.get("x-forwarded-host") || h.get("host"))) ?? "yugminds";

  const pages = Object.entries(PAGE_SEO)
    .filter(([path]) => resolveBrand("", path) === brand)
    .map(([path, seo]) => `- [${seo.title}](${canonicalUrl(brand, path)}): ${seo.description}`)
    .join("\n");

  const sections = brand === "yugminds" ? `\n\n## Sections\n\n${YUGMINDS_SECTIONS}` : "";
  const body = `# ${brandSiteName(brand)}\n\n> ${SUMMARY[brand]}\n\n## Pages\n\n${pages}${brand === "robocoders" ? ROBOCODERS_FACTS : ""}${sections}\n\n## Contact\n\n${contact(brand === "robocoders" ? BUSINESS.robocodersEmail : BUSINESS.email)}\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
