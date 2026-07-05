import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "https://website-lms-seven.vercel.app";

type Route = {
  path: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
};

// YugMinds company homepage
const yugmindsRoutes: Route[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
];

// Robocoders public marketing pages
const robocodersRoutes: Route[] = [
  { path: "/robocoders", changeFrequency: "weekly", priority: 0.95 },
  { path: "/robocoders/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/robocoders/programs", changeFrequency: "monthly", priority: 0.9 },
  { path: "/robocoders/community", changeFrequency: "weekly", priority: 0.85 },
  { path: "/robocoders/for-schools", changeFrequency: "monthly", priority: 0.85 },
  { path: "/robocoders/for-parents", changeFrequency: "monthly", priority: 0.85 },
  { path: "/robocoders/contact", changeFrequency: "monthly", priority: 0.75 },
];

// LMS auth pages only — dashboards/portals are auth-gated, excluded from sitemap
const lmsPublicRoutes: Route[] = [
  { path: "/lms/login", changeFrequency: "yearly", priority: 0.5 },
  { path: "/lms/signup", changeFrequency: "yearly", priority: 0.5 },
  { path: "/lms/student-registration", changeFrequency: "yearly", priority: 0.5 },
  { path: "/lms/forgot-password", changeFrequency: "yearly", priority: 0.3 },
];

const allRoutes = [...yugmindsRoutes, ...robocodersRoutes, ...lmsPublicRoutes];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const base = baseUrl.replace(/\/$/, "");
  return allRoutes.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? base : `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
