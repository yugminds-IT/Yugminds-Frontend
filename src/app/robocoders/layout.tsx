"use client";

import { usePathname } from "next/navigation";
import BrandSwitcherBar from "../../components/BrandSwitcherBar";
import ResizableNavbar from "../../components/ResizableNavbar";

export default function RobocodersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // LMS sub-pages (verify, etc.) are standalone — no marketing chrome
  if (pathname.startsWith("/robocoders/lms")) {
    return <>{children}</>;
  }

  return (
    <>
      <BrandSwitcherBar fixed />
      {/* 36px document-flow spacer for the fixed brand bar */}
      <div className="h-9" />
      <ResizableNavbar offsetForBrandBar />
      {children}
    </>
  );
}
