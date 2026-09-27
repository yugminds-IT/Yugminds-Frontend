"use client";

import { usePathname } from "next/navigation";
import BrandSwitcherBar from "../../components/BrandSwitcherBar";
import ResizableNavbar from "../../components/ResizableNavbar";

export default function RobocodersChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Visible path is `/lms/verify/...` on robocoders.yugminds.org (middleware rewrite).
  if (pathname.startsWith("/robocoders/lms") || pathname.startsWith("/lms/")) {
    return <>{children}</>;
  }

  return (
    <>
      <BrandSwitcherBar fixed />
      <div className="h-9" />
      <ResizableNavbar offsetForBrandBar />
      {children}
    </>
  );
}
