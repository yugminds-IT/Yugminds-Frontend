"use client";

import { BookOpen, CalendarDays, GraduationCap, LayoutDashboard, Package, Receipt, Settings, Users } from "lucide-react";
import { AcademyShell, type NavItem } from "@/components/academy/AcademyShell";

const ITEMS: NavItem[] = [
  { href: "/academy/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/academy/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/academy/admin/products", label: "Products & pricing", icon: Package },
  { href: "/academy/admin/orders", label: "Orders & refunds", icon: Receipt },
  { href: "/academy/admin/learners", label: "Learners", icon: Users },
  { href: "/academy/admin/tutors", label: "Tutors", icon: GraduationCap },
  { href: "/academy/admin/bookings", label: "1:1 bookings", icon: CalendarDays },
  { href: "/academy/admin/settings", label: "Settings", icon: Settings },
];

export default function AcademyAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcademyShell role="ADMIN" label="Admin" items={ITEMS}>
      {children}
    </AcademyShell>
  );
}
