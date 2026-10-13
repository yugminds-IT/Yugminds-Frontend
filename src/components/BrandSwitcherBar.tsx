"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { BRAND_ORIGINS, ROBOCODERS_HOST, brandFromHostname, normalizeHost } from "../lib/brand-host";

const LOGO_MASK = {
  maskImage: 'url("/Yugminds_Official_Logo-preview.png")',
  WebkitMaskImage: 'url("/Yugminds_Official_Logo-preview.png")',
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
} as const;

export default function BrandSwitcherBar({ fixed = false }: { fixed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [onRobocodersHost, setOnRobocodersHost] = useState(false);
  const isRobocoders =
    onRobocodersHost ||
    pathname === "/robocoders" ||
    pathname.startsWith("/robocoders/");

  const [atTop, setAtTop] = useState(true);
  // local, optimistic toggle state so the thumb slides instantly on click,
  // ahead of (and independent from) the route change that follows it.
  const [active, setActive] = useState(isRobocoders);

  useEffect(() => {
    setOnRobocodersHost(normalizeHost(window.location.host) === ROBOCODERS_HOST);
  }, []);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setActive(isRobocoders);
  }, [isRobocoders]);

  const handleToggle = (target: boolean, pathHref: string) => {
    if (target === active) return;
    setActive(target);
    window.setTimeout(() => {
      if (brandFromHostname(window.location.host)) {
        window.location.href = target
          ? BRAND_ORIGINS.robocoders
          : BRAND_ORIGINS.yugminds;
        return;
      }
      router.push(pathHref);
    }, 260);
  };

  const options = [
    {
      robo: false,
      href: "/",
      label: "YugMinds",
      icon: <span aria-hidden className="block h-3.5 w-3.5 bg-current" style={LOGO_MASK} />,
    },
    {
      robo: true,
      href: "/robocoders",
      label: "Robocoders™",
      icon: <Bot aria-hidden className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div
      className={`relative h-9 w-full bg-ym-ink text-white transition-opacity duration-300 ${
        fixed ? "fixed top-0 left-0 right-0 z-50" : ""
      } ${atTop ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
    >
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ym-blue/50 to-transparent" />
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-center sm:justify-between px-4 md:px-10">
        <span className="hidden sm:flex items-center gap-2 text-[0.7rem] font-medium tracking-wide text-white/50">
          <span className="h-1.5 w-1.5 rounded-full bg-ym-blue-lit shadow-[0_0_8px_rgba(96,165,250,0.9)]" />
          YugMinds Pvt Ltd
          <span className="hidden md:inline text-white/30">· Hyderabad, India</span>
        </span>

        <div
          role="tablist"
          aria-label="Switch site"
          className="relative flex items-center rounded-full border border-white/10 bg-white/[0.06] p-0.5"
        >
          <motion.span
            aria-hidden
            className="absolute inset-y-0.5 w-[7.25rem] rounded-full bg-gradient-to-r from-ym-blue to-ym-blue-lit shadow-[0_0_16px_-2px_rgba(37,99,235,0.8)]"
            initial={false}
            animate={{ left: active ? "7.375rem" : "0.125rem" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          />
          {options.map((o) => {
            const on = active === o.robo;
            return (
              <button
                key={o.label}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => handleToggle(o.robo, o.href)}
                className={`relative z-10 flex h-7 w-[7.25rem] items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors duration-200 ${
                  on ? "text-white" : "text-white/55 hover:text-white/85"
                }`}
              >
                {o.icon}
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
