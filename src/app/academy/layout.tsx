import type { Metadata } from "next";
import {
  buildBrandMetadata,
  readInternalPathname,
} from "../../lib/brand-metadata";
import { displayFont } from "../../lib/fonts";


export async function generateMetadata(): Promise<Metadata> {
  const pathname = await readInternalPathname();
  const path = pathname.startsWith("/academy")
    ? pathname
    : `/academy${pathname === "/" ? "" : pathname}`;
  return buildBrandMetadata("academy", path);
}

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return <div className={displayFont.variable}>{children}</div>;
}
