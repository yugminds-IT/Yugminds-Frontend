"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, GraduationCap, Menu, School, X } from "lucide-react";
import { ROBOCODERS_HOST, brandHref, normalizeHost } from "../../lib/brand-host";

const PATH_NAV = [
  { name: "Home", link: "/robocoders", exact: true, publicPath: "/" },
  { name: "About Us", link: "/robocoders/about", publicPath: "/about" },
  { name: "Our Programs", link: "/robocoders/programs", publicPath: "/programs" },
  { name: "Products", link: "/robocoders/products", publicPath: "/products" },
  { name: "Community", link: "/robocoders/community", publicPath: "/community" },
  { name: "For Schools", link: "/robocoders/for-schools", publicPath: "/for-schools" },
  { name: "For Parents", link: "/robocoders/for-parents", publicPath: "/for-parents" },
  { name: "Online Classes", link: "/robocoders/online-classes", publicPath: "/online-classes" },
  { name: "Contact Us", link: "/robocoders/contact", publicPath: "/contact" },
];

/* The home page's navbar: a floating bar that tightens on scroll, stays in view as you scroll,
   shows reading progress, and slides a highlight to the link you point at (resting on the current page). */
export default function HomeNav() {
  const pathname = usePathname();
  const [onHost, setOnHost] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const bar = useRef<HTMLSpanElement>(null);
  const [menu, setMenu] = useState(false);
  const [login, setLogin] = useState(false);
  const [hl, setHl] = useState<{ left: number; width: number } | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const loginRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
  useEffect(() => setOnHost(normalizeHost(window.location.host) === ROBOCODERS_HOST), []);

  const items = PATH_NAV.map((i) => ({ name: i.name, link: onHost ? i.publicPath : brandHref(i.link), exact: i.exact }));
  const isActive = (i: { link: string; exact?: boolean }) => {
    const l = i.link.replace(/^https?:\/\/[^/]+/, "") || "/";
    return i.exact ? pathname === l : pathname === l || pathname.startsWith(l + "/");
  };
  const activeIdx = Math.max(0, items.findIndex(isActive));

  const place = (i: number) => {
    const el = links.current[i];
    if (el) setHl({ left: (el.parentElement as HTMLElement).offsetLeft, width: el.offsetWidth });
  };
  useLayoutEffect(() => {
    place(activeIdx);
    const on = () => place(activeIdx);
    window.addEventListener("resize", on);
    document.fonts?.ready.then(on);
    // re-measure whenever the links change size (font swap, language, zoom)
    const ro = new ResizeObserver(on);
    links.current.forEach((l) => l && ro.observe(l));
    return () => { window.removeEventListener("resize", on); ro.disconnect(); };
  }, [activeIdx, onHost]);

  // scroll: tighten and report progress; the bar stays in view
  // progress is written straight to the bar once per frame; re-rendering the nav on every scroll event is wasted work
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 24);
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    const out = (e: MouseEvent) => loginRef.current && !loginRef.current.contains(e.target as Node) && setLogin(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (setLogin(false), setMenu(false));
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this effect syncs state from the browser or props; existing behavior kept
  useEffect(() => setMenu(false), [pathname]);

  const lms = brandHref("/lms/login");
  const academy = brandHref("/academy/login");

  return (
    <header className="hn" data-scrolled={scrolled}>
      <div className="hn-bar">
        <Link href={items[0].link} className="hn-logo" aria-label="RoboCoders home">
          <Image src="/robocoders-logo.png" alt="RoboCoders — An EdTech initiative by YugMinds" width={803} height={341} priority />
        </Link>

        <nav className="hn-nav" aria-label="Main" onMouseLeave={() => place(activeIdx)}>
          <ul ref={list}>
            {hl && <li className="hn-hl" aria-hidden="true" style={{ transform: `translateX(${hl.left}px)`, width: hl.width }} />}
            {items.map((it, i) => (
              <li key={it.name}>
                <a
                  ref={(el) => { links.current[i] = el; }}
                  href={it.link}
                  aria-current={i === activeIdx ? "page" : undefined}
                  onMouseEnter={() => place(i)}
                  onFocus={() => place(i)}
                  onBlur={() => place(activeIdx)}
                >
                  {it.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hn-right">
          <div className="hn-login" ref={loginRef}>
            <button type="button" aria-expanded={login} aria-haspopup="true" onClick={() => setLogin((o) => !o)}>
              Log in <ChevronDown size={16} aria-hidden="true" />
            </button>
            {login && (
              <div className="hn-pop" role="menu" onKeyDown={(e) => e.key === "Escape" && setLogin(false)}>
                <a role="menuitem" href={lms} style={{ "--i": 0 } as React.CSSProperties}>
                  <span className="hn-pop-ico"><School size={20} aria-hidden="true" /></span>
                  <span className="hn-pop-txt"><strong>Student Portal</strong><small>For students at partner schools</small></span>
                  <ArrowRight className="hn-pop-go" size={16} aria-hidden="true" />
                </a>
                <a role="menuitem" href={academy} style={{ "--i": 1 } as React.CSSProperties}>
                  <span className="hn-pop-ico"><GraduationCap size={20} aria-hidden="true" /></span>
                  <span className="hn-pop-txt"><strong>Academy Login</strong><small>For online classes</small></span>
                  <ArrowRight className="hn-pop-go" size={16} aria-hidden="true" />
                </a>
                <p className="hn-pop-new" style={{ "--i": 2 } as React.CSSProperties}>
                  New here? <a role="menuitem" href={brandHref("/academy/signup")}>Create a free account</a>
                </p>
              </div>
            )}
          </div>
          <Link href="/robocoders/online-classes" className="hn-cta">Book a free trial</Link>
          <button type="button" className="hn-burger" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} aria-controls="hn-sheet" onClick={() => setMenu((o) => !o)}>
            {menu ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>

        <span ref={bar} className="hn-progress" aria-hidden="true" />
      </div>

      <div className="hn-sheet" id="hn-sheet" data-open={menu}>
        <ul>
          {items.map((it, i) => (
            <li key={it.name} style={{ "--i": i } as React.CSSProperties}>
              <a href={it.link} aria-current={i === activeIdx ? "page" : undefined} tabIndex={menu ? 0 : -1}>{it.name}</a>
            </li>
          ))}
        </ul>
        <div className="hn-sheet-actions" style={{ "--i": items.length } as React.CSSProperties}>
          <Link href="/robocoders/online-classes" className="hn-cta" tabIndex={menu ? 0 : -1}>Book a free trial</Link>
          <a href={lms} tabIndex={menu ? 0 : -1}>Student Portal</a>
          <a href={academy} tabIndex={menu ? 0 : -1}>Academy Login</a>
        </div>
      </div>
    </header>
  );
}
