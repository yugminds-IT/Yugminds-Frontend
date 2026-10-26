"use client";

import { CalendarRange, Settings, UserRound, Video } from "lucide-react";
import { AcademyShell, type NavItem } from "@/components/academy/AcademyShell";

const ITEMS: NavItem[] = [
  { href: "/academy/tutor", label: "My classes", icon: Video, exact: true },
  { href: "/academy/tutor/schedule", label: "Availability", icon: CalendarRange },
  { href: "/academy/tutor/profile", label: "Public profile", icon: UserRound },
  { href: "/academy/tutor/settings", label: "Settings", icon: Settings },
];

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcademyShell role="TUTOR" label="Tutor" items={ITEMS}>
      {children}
    </AcademyShell>
  );
}
