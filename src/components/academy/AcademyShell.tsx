"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, GraduationCap, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { academy, type Account, type Role } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { HOME_BY_ROLE, toAcademyPath } from "@/lib/academy/paths";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const AccountContext = createContext<{ account: Account; setAccount: (a: Account) => void } | null>(null);

/** The signed-in Academy account (inside AcademyShell). */
export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside AcademyShell");
  return ctx;
}

/**
 * Frame for the Academy dashboards (learner, tutor, admin). The middleware
 * already checked the cookie; this loads the account, keeps each role in its
 * own dashboard and renders the Academy's own navigation.
 */
export function AcademyShell({
  role,
  label,
  items,
  bare = false,
  children,
}: {
  role: Role;
  label: string;
  items: NavItem[];
  /** Full-screen pages (course player) render without the sidebar. */
  bare?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const path = toAcademyPath(usePathname() ?? "/");
  const [account, setAccount] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("academy.sidebar.collapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    academy.auth
      .me()
      .then((a) => (a.role === role ? setAccount(a) : router.replace(HOME_BY_ROLE[a.role])))
      .catch(() => router.replace(`/academy/login?next=${encodeURIComponent(toAcademyPath(window.location.pathname))}`));
  }, [role, router]);

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ac-brand" />
      </div>
    );
  }

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("academy.sidebar.collapsed", c ? "0" : "1");
      } catch {
        /* storage unavailable: just don't remember */
      }
      return !c;
    });
  };

  const logout = async () => {
    await academy.auth.logout().catch(() => undefined);
    window.location.href = "/academy/login";
  };

  const isActive = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`));
  const initials = account.fullName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const nav = (compact: boolean) => (
    <nav className="flex-1 overflow-y-auto px-3 py-3">
      <ul className="space-y-0.5">
        {items.map((i) => {
          const active = isActive(i);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                onClick={() => setOpen(false)}
                title={compact ? i.label : undefined}
                className={`group flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ac-brand/40 ${compact ? "justify-center px-2" : ""} ${
                  active
                    ? "relative bg-ac-soft font-medium text-ac-brand before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-r before:bg-amber-400"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <i.icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-ac-brand" : "text-slate-500 group-hover:text-slate-700"}`} />
                {!compact && <span className="truncate">{i.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const brand = (compact: boolean) => (
    <Link href="/academy" className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ac-brand text-white shadow-sm">
        <GraduationCap className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-acdisplay text-base font-semibold text-slate-800">RoboCoders Academy</span>
          <span className="block text-xs text-slate-500">{label}</span>
        </span>
      )}
    </Link>
  );

  const footer = (compact: boolean) => (
    <div className="mt-auto border-t border-slate-200">
      <div className={`border-b border-slate-200 bg-slate-50/30 ${compact ? "px-2 py-3" : "p-3"}`}>
        <div className={`flex items-center rounded-md ${compact ? "justify-center" : "bg-white px-3 py-2"}`}>
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-700">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" title="Online" />
          </span>
          {!compact && (
            <span className="ml-2.5 min-w-0">
              <span className="block truncate text-sm font-medium text-slate-800">{account.fullName}</span>
              <span className="block truncate text-xs text-slate-500">{account.email}</span>
            </span>
          )}
        </div>
      </div>
      <div className="p-3">
        <button
          onClick={logout}
          title={compact ? "Log out" : undefined}
          className={`flex w-full items-center rounded-md text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 ${compact ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5"}`}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0 text-red-500" />
          {!compact && "Log out"}
        </button>
      </div>
    </div>
  );

  return (
    <AccountContext.Provider value={{ account, setAccount }}>
      {account.mustChangePassword && <ForcePasswordChange onDone={() => setAccount({ ...account, mustChangePassword: false })} />}
      {bare ? (
        children
      ) : (
        <div className="flex min-h-screen bg-gray-50 md:h-screen">
          <aside className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 md:flex print:hidden ${collapsed ? "w-20" : "w-72"}`}>
            <div className={`flex items-center border-b border-slate-200 bg-slate-50/60 p-4 ${collapsed ? "flex-col gap-3" : "justify-between"}`}>
              {brand(collapsed)}
              <button onClick={toggleCollapsed} className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
            {nav(collapsed)}
            {footer(collapsed)}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden print:hidden">
              {brand(false)}
              <button onClick={() => setOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
            </header>
            {open && (
              <div className="fixed inset-0 z-50 md:hidden">
                <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close menu" />
                <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 p-4">
                    {brand(false)}
                    <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close menu">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  {nav(false)}
                  {footer(false)}
                </aside>
              </div>
            )}
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      )}
    </AccountContext.Provider>
  );
}

/** Accounts created by an admin start with a one-time password. */
function ForcePasswordChange({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await academy.auth.changePassword(String(f.get("current")), String(f.get("next")));
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>Set your own password</DialogTitle></DialogHeader>
        <p className="text-sm text-ac-muted">You signed in with a one-time password. Choose a new one to continue.</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="fp-current">One-time password</Label><Input id="fp-current" name="current" type="password" required /></div>
          <div className="space-y-1.5">
            <Label htmlFor="fp-next">New password</Label>
            <Input id="fp-next" name="next" type="password" minLength={8} required autoComplete="new-password" />
            <p className="text-xs text-ac-muted">At least 8 characters with an uppercase letter, a lowercase letter and a number.</p>
          </div>
          {error && <p className="whitespace-pre-line text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark disabled:opacity-60">
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Page heading used across Academy dashboards (LMS dashboard heading style). */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-6">
      <div className="min-w-0">
        <h1 className="font-acdisplay text-2xl font-bold text-gray-900 md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-600 md:text-base">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
