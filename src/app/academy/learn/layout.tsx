"use client";

import { usePathname } from "next/navigation";
import { Award, BookOpen, Home, Receipt, Settings, ShoppingBag, Video } from "lucide-react";
import { AcademyShell, type NavItem } from "@/components/academy/AcademyShell";

const ITEMS: NavItem[] = [
  { href: "/academy/learn", label: "Home", icon: Home, exact: true },
  { href: "/academy/learn/courses", label: "My courses", icon: BookOpen },
  { href: "/academy/learn/sessions", label: "1:1 classes", icon: Video },
  { href: "/academy/learn/certificates", label: "Certificates", icon: Award },
  { href: "/academy/learn/orders", label: "Orders", icon: Receipt },
  { href: "/academy/courses", label: "Browse courses", icon: ShoppingBag },
  { href: "/academy/learn/settings", label: "Settings", icon: Settings },
];

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  // The course player is a full-screen focus view with its own navigation.
  const isPlayer = /\/learn\/courses\/[^/]+/.test(usePathname() ?? "");
  return (
    <AcademyShell role="LEARNER" label="Learner" items={ITEMS} bare={isPlayer}>
      {children}
    </AcademyShell>
  );
}
