"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { academy, type Account, type Role } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { HOME_BY_ROLE, toAcademyPath } from "@/lib/academy/paths";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { display, body } from "../../app/robocoders/robo-fonts";
import "../public/robo-home.css";
import "./academy.css";
import "./academy-dash.css";

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
/** The chrome itself, without any data loading (the real shell and the design preview both render it). */
export function ShellView({
  account,
  label,
  items,
  path,
  bare = false,
  onLogout,
  children,
}: {
  account: Account;
  label: string;
  items: NavItem[];
  path: string;
  bare?: boolean;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("academy.sidebar.collapsed") === "1";
    } catch {
      return false;
    }
  });
  const fonts = `${display.variable} ${body.variable}`;
  // Dialogs and menus render on <body>; this lets the dashboard skin reach them.
  useEffect(() => {
    document.body.classList.add("ac-skin");
    return () => document.body.classList.remove("ac-skin");
  }, []);
  if (bare) return <div className={`rh ${fonts}`}>{children}</div>;

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
  const isActive = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`));
  const initials = account.fullName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const side = (compact: boolean, drawer: boolean) => (
    <aside className="rh-dark ac-d-side" data-collapsed={compact} style={drawer ? { display: "flex", width: "100%" } : undefined}>
      <div className="ac-d-brand" style={compact ? { flexDirection: "column" } : undefined}>
        <Link href="/academy" aria-label="RoboCoders Academy home">
          {compact ? <span className="ac-d-role">{label[0]}</span> : (
            <>
              <Image src="/robocoders-logo.png" alt="RoboCoders Academy" width={803} height={341} />
              <span className="ac-d-role">{label}</span>
            </>
          )}
        </Link>
        {drawer ? (
          <button type="button" className="ac-d-icon-btn" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} aria-hidden="true" /></button>
        ) : (
          <button type="button" className="ac-d-icon-btn" onClick={toggleCollapsed} aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}>
            {compact ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      <nav className="ac-d-nav" aria-label={`${label} navigation`}>
        {items.map((i) => (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)} title={compact ? i.label : undefined} aria-current={isActive(i) ? "page" : undefined} className="ac-d-link">
            <i.icon size={19} aria-hidden="true" />
            {!compact && <span>{i.label}</span>}
          </Link>
        ))}
      </nav>
      <div className="ac-d-me">
        <div className="ac-d-who" style={compact ? { justifyContent: "center" } : undefined}>
          <span className="ac-avatar" style={{ "--s": "2.25rem" } as React.CSSProperties} aria-hidden="true">{initials}</span>
          {!compact && <span style={{ minWidth: 0 }}><b>{account.fullName}</b><small>{account.email}</small></span>}
        </div>
        <button type="button" className="ac-d-out" onClick={onLogout} title={compact ? "Log out" : undefined}>
          <LogOut size={19} aria-hidden="true" />
          {!compact && "Log out"}
        </button>
      </div>
    </aside>
  );

  return (
    <div className={`rh ac-d ${fonts}`}>
      {side(collapsed, false)}
      <div className="ac-d-col">
        <header className="ac-d-top">
          <Link href="/academy" aria-label="RoboCoders Academy home"><Image src="/robocoders-logo.png" alt="RoboCoders Academy" width={803} height={341} /></Link>
          <button type="button" className="ac-d-icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} aria-hidden="true" /></button>
        </header>
        {open && (
          <div className="ac-d-drawer">
            <button type="button" className="ac-d-scrim" onClick={() => setOpen(false)} aria-label="Close menu" />
            <div style={{ position: "absolute", inset: "0 auto 0 0", display: "flex", width: "18rem", maxWidth: "86vw" }}>{side(false, true)}</div>
          </div>
        )}
        <main className="ac-d-main">{children}</main>
      </div>
    </div>
  );
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

  useEffect(() => {
    academy.auth
      .me()
      .then((a) => (a.role === role ? setAccount(a) : router.replace(HOME_BY_ROLE[a.role])))
      .catch(() => router.replace(`/academy/login?next=${encodeURIComponent(toAcademyPath(window.location.pathname))}`));
  }, [role, router]);

  if (!account) {
    return (
      <div className={`rh ${display.variable} ${body.variable}`}>
        <div className="ac-d-load"><span className="ac-spin" role="status" aria-label="Loading your account" /></div>
      </div>
    );
  }

  const logout = async () => {
    await academy.auth.logout().catch(() => undefined);
    window.location.href = "/academy/login";
  };

  return (
    <AccountContext.Provider value={{ account, setAccount }}>
      {account.mustChangePassword && <ForcePasswordChange onDone={() => setAccount({ ...account, mustChangePassword: false })} />}
      <ShellView account={account} label={label} items={items} path={path} bare={bare} onLogout={logout}>
        {children}
      </ShellView>
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
          <button disabled={busy} className="w-full rounded-full bg-amber-400 px-6 py-2.5 font-bold text-slate-900 hover:bg-amber-500 disabled:opacity-60">
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Page heading used across Academy dashboards. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="ac-d-head">
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="ac-d-actions">{action}</div>}
    </div>
  );
}
