"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";
import { BRAND_ORIGINS, ROBOCODERS_HOST, brandFromHostname, normalizeHost } from "../lib/brand-host";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "./ui/resizable-navbar";

const PATH_NAV = [
  { name: "Home", link: "/robocoders", exact: true, publicPath: "/" },
  { name: "About Us", link: "/robocoders/about", publicPath: "/about" },
  { name: "Our Programs", link: "/robocoders/programs", publicPath: "/programs" },
  { name: "Community", link: "/robocoders/community", publicPath: "/community" },
  { name: "For Schools", link: "/robocoders/for-schools", publicPath: "/for-schools" },
  { name: "For Parents", link: "/robocoders/for-parents", publicPath: "/for-parents" },
  { name: "Contact Us", link: "/robocoders/contact", publicPath: "/contact" },
];

export default function ResizableNavbar({ offsetForBrandBar = false }: { offsetForBrandBar?: boolean }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [onRobocodersHost, setOnRobocodersHost] = useState(false);
  const [lmsLoginHref, setLmsLoginHref] = useState("/lms/login");
  const pathname = usePathname();

  useEffect(() => {
    const host = normalizeHost(window.location.host);
    setOnRobocodersHost(host === ROBOCODERS_HOST);
    setLmsLoginHref(brandFromHostname(host) ? `${BRAND_ORIGINS.lms}/login` : "/lms/login");
  }, []);

  // usePathname() is the browser-visible path, so match against the same form we link to.
  const navItems = PATH_NAV.map((item) => ({
    name: item.name,
    link: onRobocodersHost ? item.publicPath : item.link,
    exact: item.exact,
  }));

  const isActive = (item: { link: string; exact?: boolean }) => {
    if (item.exact) return pathname === item.link;
    return pathname === item.link || pathname.startsWith(item.link + "/");
  };

  return (
    <Navbar className={offsetForBrandBar ? "!top-9" : ""}>
      {/* Desktop Navigation */}
      <NavBody>
        <NavbarLogo />
        <NavItems items={navItems} />
        <div className="flex items-center gap-1.5 ml-1.5 flex-shrink-0">
          <NavbarButton href={lmsLoginHref} variant="secondary" className="text-sm px-2.5 py-1">Student Portal</NavbarButton>
        </div>
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <MobileNavToggle
            isOpen={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
        </MobileNavHeader>

        <MobileNavMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        >
          {navItems.map((item, idx) => {
            const active = isActive(item);
            return (
              <Link
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "relative text-base text-neutral-600 dark:text-neutral-300 py-2 px-4 -mx-4",
                  active && "text-blue-600 dark:text-blue-400"
                )}
                prefetch={true}
              >
                <span className="block">{item.name}</span>
                {/* Blue line indicator for active page with animations */}
                {active && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 overflow-hidden"
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    exit={{ scaleX: 0, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                      duration: 0.3,
                    }}
                  >
                    {/* Animated shine effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                      animate={{
                        x: ["-100%", "200%"],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                        repeatDelay: 1,
                      }}
                    />
                  </motion.div>
                )}
              </Link>
            );
          })}
          <div className="flex w-full flex-col gap-4">
            <NavbarButton
              href={lmsLoginHref}
              onClick={() => setIsMobileMenuOpen(false)}
              variant="primary"
              className="w-full"
            >
              Student Portal
            </NavbarButton>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}

