"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Instagram, Youtube, Facebook, MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/social-links";
import FooterTop from "@/components/FooterTop";
import FooterLogo from "@/components/FooterLogo";
import "../public/droid.css";
import { academy } from "@/lib/academy/api";
import { brandHref } from "@/lib/brand-host";

const NAV = [
  { href: "/academy/courses", label: "Courses", seg: "courses" },
  { href: "/academy/tutors", label: "1:1 classes", seg: "tutors" },
];

/* The Academy's navbar: the RoboCoders floating bar (same `hn` styles), with the Academy's own links and a sign-in state.
   Signed in shows "My account"; signed out shows Log in and Start free. */
export function AcademyHeader() {
  const pathname = usePathname() ?? "";
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    academy.auth.me().then(() => setSignedIn(true)).catch(() => setSignedIn(false));
  }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);

  // The visible path is `/courses` on academy.yugminds.org and `/academy/courses` elsewhere.
  const active = (seg: string) => new RegExp(`^(?:/academy)?/${seg}(?:/|$)`).test(pathname);

  return (
    <header className="hn" data-scrolled={scrolled}>
      <div className="hn-bar">
        <Link href="/academy" className="hn-logo" aria-label="RoboCoders Academy home">
          <Image src="/robocoders-logo.png" alt="RoboCoders Academy" width={803} height={341} sizes="(max-width: 1179px) 112px, 92px" priority />
        </Link>

        <nav className="hn-nav" aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={active(n.seg) ? "page" : undefined}>{n.label}</Link>
              </li>
            ))}
            <li><a href={brandHref("/robocoders")}>RoboCoders site</a></li>
          </ul>
        </nav>

        <div className="hn-right">
          {signedIn ? (
            <Link href="/academy/learn" className="hn-cta">My account</Link>
          ) : (
            <>
              <Link href="/academy/login" className="hn-login-link">Log in</Link>
              <Link href="/academy/signup" className="hn-cta">Start free</Link>
            </>
          )}
          <button type="button" className="hn-burger" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} aria-controls="ac-sheet" onClick={() => setMenu((o) => !o)}>
            {menu ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="hn-sheet" id="ac-sheet" data-open={menu}>
        <ul>
          {NAV.map((n, i) => (
            <li key={n.href} style={{ "--i": i } as React.CSSProperties}>
              <Link href={n.href} aria-current={active(n.seg) ? "page" : undefined} tabIndex={menu ? 0 : -1}>{n.label}</Link>
            </li>
          ))}
          <li style={{ "--i": NAV.length } as React.CSSProperties}><a href={brandHref("/robocoders")} tabIndex={menu ? 0 : -1}>RoboCoders site</a></li>
        </ul>
        <div className="hn-sheet-actions" style={{ "--i": NAV.length + 1 } as React.CSSProperties}>
          {signedIn ? (
            <Link href="/academy/learn" className="hn-cta" tabIndex={menu ? 0 : -1}>My account</Link>
          ) : (
            <>
              <Link href="/academy/signup" className="hn-cta" tabIndex={menu ? 0 : -1}>Start free</Link>
              <Link href="/academy/login" tabIndex={menu ? 0 : -1}>Log in</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const SOCIAL_ICON = { instagram: Instagram, youtube: Youtube, facebook: Facebook, whatsapp: MessageCircle } as const;

/* Same footer as the RoboCoders site (rf-* styles in robo-home.css), with the Academy's own links. */
export function AcademyFooter() {
  return (
    <footer className="rf">
      <FooterTop />
      <div className="rf-wrap">
        <div className="rf-grid">
          <div className="rf-brand">
            <FooterLogo />
            <p>Online coding, robotics and AI. Self-paced courses and live 1:1 classes, from YugMinds in Hyderabad.</p>
          </div>

          <nav aria-label="Learn">
            <h3>Learn</h3>
            <ul className="rf-links">
              <li><Link href="/academy/courses">All courses</Link></li>
              <li><Link href="/academy/tutors">1:1 classes</Link></li>
              <li><Link href="/academy/learn">My account</Link></li>
              <li><Link href="/academy/login">Log in</Link></li>
              <li><Link href="/academy/signup">Create a free account</Link></li>
              <li><Link href="/academy#verify">Verify a certificate</Link></li>
            </ul>
          </nav>

          <div>
            <h3>Contact</h3>
            <ul className="rf-contact">
              <li><Mail size={16} aria-hidden="true" /><a href="mailto:info@yugminds.org">info@yugminds.org</a></li>
              <li><Phone size={16} aria-hidden="true" /><a href="tel:+918500345655">+91 85003 45655</a></li>
              <li><MapPin size={16} aria-hidden="true" /><a href={brandHref("/robocoders/contact")}>Contact RoboCoders</a></li>
            </ul>
          </div>

          <div>
            <h3>Follow us</h3>
            <ul className="rf-social">
              {SOCIAL_LINKS.map(({ platform, label, url }) => {
                const Icon = SOCIAL_ICON[platform as keyof typeof SOCIAL_ICON];
                return (
                  <li key={label}>
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={label}><Icon size={20} aria-hidden="true" /></a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="rf-base">
          <p>© {new Date().getFullYear()} YugMinds Private Limited</p>
          <p>Privacy Policy · Terms of Service</p>
        </div>
      </div>
    </footer>
  );
}
