"use client";

import { usePathname } from "next/navigation";
import { display, body } from "./robo-fonts";
import HomeNav from "../../components/public/HomeNav";
import RoboLeadBot from "../../components/public/RoboLeadBot";
import "../../components/public/robo-home.css";

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

  // Every RoboCoders page uses the same navbar, set in the home page's two typefaces.
  return (
    <>
      <div className={`rh-nav ${display.variable} ${body.variable}`}>
        <HomeNav />
      </div>
      {children}
      <RoboLeadBot />
    </>
  );
}
