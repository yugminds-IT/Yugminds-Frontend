import type { Metadata } from "next";
import {
  buildBrandMetadata,
  readInternalPathname,
} from "../../lib/brand-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const pathname = await readInternalPathname();
  const path = pathname.startsWith("/lms")
    ? pathname
    : `/lms${pathname === "/" ? "" : pathname}`;
  return buildBrandMetadata("lms", path || "/lms/login");
}

export default function LmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
