import type { Brand } from "./brand-host";

export type PageSeo = {
  title: string;
  description: string;
  keywords: string[];
  primaryKeyword: string;
};

/**
 * Per-page SEO — titles/descriptions match what each page actually is.
 * Keys = internal App Router paths.
 */
export const PAGE_SEO: Record<string, PageSeo> = {
  "/": {
    primaryKeyword: "YugMinds",
    title: "YugMinds — Software, Electronics & STEM Education",
    description:
      "YugMinds builds software, electronics, and machines under one roof — and teaches the next generation through RoboCoders STEM programs across India.",
    keywords: [
      "YugMinds",
      "YugMinds software",
      "electronics manufacturing",
      "STEM education India",
      "RoboCoders",
      "EdTech",
    ],
  },
  "/about": {
    primaryKeyword: "About YugMinds",
    title: "About YugMinds | Software, Electronics & Machines — Hyderabad",
    description:
      "About YugMinds — founded in 2024 in Hyderabad. One team building software, electronics and machines, and teaching the next generation through Robocoders.",
    keywords: ["About YugMinds", "YugMinds Hyderabad", "YugMinds Private Limited", "YugMinds story"],
  },
  "/divisions": {
    primaryKeyword: "YugMinds divisions",
    title: "Our Divisions | Software, Manufacturing, Hardware & Labs — YugMinds",
    description:
      "Five YugMinds divisions under one roof: Software, Manufacturing, Hardware, Research Labs and Robocoders EdTech — from design to product to classroom.",
    keywords: [
      "YugMinds divisions",
      "YugMinds Software",
      "YugMinds Manufacturing",
      "YugMinds Hardware",
      "YugMinds Labs",
      "Robocoders EdTech",
    ],
  },
  "/work": {
    primaryKeyword: "YugMinds work",
    title: "Our Work | Projects & Stories — YugMinds",
    description:
      "Explore YugMinds work — hands-on robotics in classrooms, a STEM curriculum from first circuits to competitions, and software and machines built by one team.",
    keywords: ["YugMinds work", "YugMinds projects", "YugMinds journal", "Robocoders robotics"],
  },
  "/contact": {
    primaryKeyword: "Contact YugMinds",
    title: "Contact YugMinds | Begumpet, Hyderabad",
    description:
      "Contact YugMinds in Begumpet, Hyderabad — email info@yugminds.org or call +91 85003 45655 for software, electronics, manufacturing or Robocoders enquiries.",
    keywords: ["Contact YugMinds", "YugMinds Hyderabad", "YugMinds email", "YugMinds phone"],
  },
  "/robocoders": {
    primaryKeyword: "RoboCoders",
    title: "RoboCoders — Coding, Robotics & AI for Students",
    description:
      "RoboCoders is YugMinds’ STEM education initiative. Students learn coding, robotics, and AI through hands-on programs for schools and learners ages 6–18.",
    keywords: [
      "RoboCoders",
      "coding and robotics",
      "STEM education",
      "AI for students",
      "YugMinds",
    ],
  },
  "/robocoders/about": {
    primaryKeyword: "About RoboCoders",
    title: "About RoboCoders | STEM Education by YugMinds",
    description:
      "About RoboCoders — an EdTech initiative by YugMinds transforming education with coding, robotics, and AI programs that build creativity and real skills.",
    keywords: [
      "About RoboCoders",
      "STEM education",
      "coding and robotics programs",
      "YugMinds EdTech",
    ],
  },
  "/robocoders/programs": {
    primaryKeyword: "RoboCoders programs",
    title: "Our Programs | Coding, Robotics & AI — RoboCoders",
    description:
      "Explore RoboCoders programs: Coding Fundamentals, Robotics & Electronics, and AI & Machine Learning for ages 6–18 — with kits, textbooks, and certificates.",
    keywords: [
      "RoboCoders programs",
      "coding fundamentals",
      "robotics and electronics",
      "AI and machine learning",
      "STEM courses",
    ],
  },
  "/robocoders/community": {
    primaryKeyword: "RoboCoders community",
    title: "Community | Student Projects & Challenges — RoboCoders",
    description:
      "See the RoboCoders community — student projects, coding challenges, reels, and school highlights from our coding, robotics, and AI programs.",
    keywords: [
      "RoboCoders community",
      "student projects",
      "coding challenges",
      "STEM community",
    ],
  },
  "/robocoders/for-schools": {
    primaryKeyword: "RoboCoders for schools",
    title: "For Schools | Partner with RoboCoders",
    description:
      "Bring RoboCoders coding and robotics programs to your school — curriculum integration, trained instructors, flexible pricing, and ongoing tech support.",
    keywords: [
      "RoboCoders for schools",
      "school STEM partnership",
      "coding programs for schools",
      "robotics for schools",
    ],
  },
  "/robocoders/for-parents": {
    primaryKeyword: "RoboCoders for parents",
    title: "For Parents | Coding & Robotics for Your Child — RoboCoders",
    description:
      "Give your child a head start with RoboCoders — coding, robotics, Python, Scratch, and AI. Flexible plans from ₹999 with certificates and progress reports.",
    keywords: [
      "RoboCoders for parents",
      "coding for kids",
      "robotics for children",
      "STEM courses for kids",
    ],
  },
  "/robocoders/contact": {
    primaryKeyword: "Contact RoboCoders",
    title: "Contact Us | RoboCoders",
    description:
      "Get in touch with RoboCoders for school partnerships, parent enrollment, or program questions. We typically reply within 24 hours.",
    keywords: [
      "Contact RoboCoders",
      "RoboCoders enquiry",
      "school demo",
      "STEM program contact",
    ],
  },
  "/robocoders/lms/verify": {
    primaryKeyword: "Verify RoboCoders certificate",
    title: "Verify Certificate | RoboCoders",
    description:
      "Verify a RoboCoders certificate. Enter the certificate ID printed on the certificate to confirm the student, course, and issue date are authentic.",
    keywords: [
      "verify RoboCoders certificate",
      "certificate verification",
      "RoboCoders certificate ID",
    ],
  },
  "/lms/login": {
    primaryKeyword: "RoboCoders LMS",
    title: "RoboCoders LMS Login",
    description:
      "Sign in to RoboCoders LMS — the learning platform for courses, assignments, attendance, and certificates used by schools, teachers, and students.",
    keywords: [
      "RoboCoders LMS",
      "LMS login",
      "student portal",
      "teacher login",
    ],
  },
  "/lms/signup": {
    primaryKeyword: "RoboCoders LMS signup",
    title: "Create Account | RoboCoders LMS",
    description:
      "Create your RoboCoders LMS account with your school joining code to access coding and robotics courses assigned by your school.",
    keywords: ["RoboCoders LMS signup", "create account", "joining code"],
  },
  "/lms/forgot-password": {
    primaryKeyword: "RoboCoders LMS password",
    title: "Forgot Password | RoboCoders LMS",
    description:
      "Request a RoboCoders LMS password reset. Your school administrator will review the request and help you regain access to your account.",
    keywords: ["RoboCoders LMS password", "forgot password", "password reset"],
  },
  "/lms/student-registration": {
    primaryKeyword: "RoboCoders student registration",
    title: "Student Registration | RoboCoders LMS",
    description:
      "Register as a RoboCoders student with your school joining code to join courses, submit assignments, and track progress on the LMS.",
    keywords: [
      "student registration",
      "RoboCoders LMS",
      "joining code",
      "school registration",
    ],
  },
};

export function lookupPageSeo(internalPath: string): PageSeo | null {
  const clean = internalPath.replace(/\/$/, "") || "/";
  if (PAGE_SEO[clean]) return PAGE_SEO[clean];
  if (PAGE_SEO[internalPath]) return PAGE_SEO[internalPath];
  for (const key of Object.keys(PAGE_SEO)) {
    if (clean === key) return PAGE_SEO[key];
  }
  return null;
}

export function brandSiteName(brand: Brand): string {
  if (brand === "yugminds") return "YugMinds";
  if (brand === "robocoders") return "RoboCoders";
  return "RoboCoders LMS";
}
