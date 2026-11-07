"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { toLmsPath } from "@/lib/brand-host";
import { confirmLeaveAssignment } from "@/hooks/useAssignmentLeaveGuard";
import { useAppStore, type AppState } from "@/store/app-store";
import Droid from "./Droid";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** match only this exact path (use for the dashboard root, which would otherwise match every page) */
  exact?: boolean;
}

interface Props {
  nav: NavItem[];
  /** "Student portal" and a smaller line under it */
  brand: { title: string; sub?: string };
  userName: string;
  userEmail: string;
  onLogout: () => void | Promise<void>;
  /** counts shown as an amber badge, keyed by nav href */
  badges?: Record<string, number | undefined>;
}

const initialsOf = (name: string) =>
  name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";

/** The portal's sidebar. Every dashboard gives it a nav list; the look, collapse and mobile drawer are shared. */
export default function PortalSidebar({ nav, brand, userName, userEmail, onLogout, badges = {} }: Props) {
  const router = useRouter();
  const pathname = toLmsPath(usePathname() ?? "");
  const collapsed = useAppStore((s: AppState) => s.sidebarCollapsed);
  const toggle = useAppStore((s: AppState) => s.toggleSidebar);
  const [open, setOpen] = useState(false);

  // The longest matching href wins, so /my-courses/123 highlights My courses.
  const active = useMemo(
    () =>
      nav.reduce(
        (best, it, i) =>
          (pathname === it.href || (!it.exact && pathname.startsWith(it.href + "/"))) && (best < 0 || it.href.length > nav[best].href.length) ? i : best,
        -1,
      ),
    [nav, pathname],
  );

  const go = async (e: React.MouseEvent, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (!(await confirmLeaveAssignment())) return;
    setOpen(false);
    router.push(href);
  };

  const logout = async () => {
    if (!(await confirmLeaveAssignment())) return;
    await onLogout();
  };

  return (
    <>
      <header className="sd-topbar">
        <button className="sd-topbar-btn" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <span className="sd-mark"><Droid className="sd-mark-droid" /></span>
        <b style={{ fontFamily: "var(--sd-display)", fontSize: "1.05rem" }}>{brand.title}</b>
      </header>
      <div className="sd-scrim" data-open={open} onClick={() => setOpen(false)} />

      <aside className="sd-nav" data-collapsed={collapsed} data-open={open} aria-label={`${brand.title} navigation`}>
        <div className="sd-brand">
          <span className="sd-mark"><Droid className="sd-mark-droid" /></span>
          <span className="sd-brand-text"><b>{brand.title}</b>{brand.sub && <span>{brand.sub}</span>}</span>
          <button className="sd-collapse" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav>
          <ul className="sd-list" data-none={active < 0} style={{ "--i": Math.max(active, 0) } as React.CSSProperties}>
            <li className="sd-pill" aria-hidden="true" />
            {nav.map((it, i) => {
              const Icon = it.icon;
              const badge = badges[it.href] ?? 0;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className="sd-item"
                    aria-current={i === active ? "page" : undefined}
                    aria-label={collapsed ? it.label : undefined}
                    title={collapsed ? it.label : undefined}
                    onClick={(e) => go(e, it.href)}
                  >
                    <Icon aria-hidden="true" />
                    <span className="sd-item-label">{it.label}</span>
                    {badge > 0 ? <span className="sd-badge">{badge > 99 ? "99+" : badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sd-foot">
          <div className="sd-who">
            <span className="sd-avatar" aria-hidden="true">{initialsOf(userName)}</span>
            <span className="sd-who-text"><b>{userName}</b><span>{userEmail}</span></span>
          </div>
          <button className="sd-item sd-logout" onClick={logout} title={collapsed ? "Log out" : undefined} aria-label="Log out">
            <LogOut aria-hidden="true" />
            <span className="sd-item-label">Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
