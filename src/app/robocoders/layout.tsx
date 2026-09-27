import type { Metadata } from "next";
import {
  buildBrandMetadata,
  readInternalPathname,
} from "../../lib/brand-metadata";
import RobocodersChrome from "./RobocodersChrome";

export async function generateMetadata(): Promise<Metadata> {
  const pathname = await readInternalPathname();
  const path =
    pathname.startsWith("/robocoders") ? pathname : `/robocoders${pathname === "/" ? "" : pathname}`;
  return buildBrandMetadata("robocoders", path || "/robocoders");
}

export default function RobocodersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RobocodersChrome>{children}</RobocodersChrome>;
}
