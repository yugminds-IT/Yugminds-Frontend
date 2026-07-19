"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function BrandSwitcherBar({ fixed = false }: { fixed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const isRobocoders =
    pathname === "/robocoders" || pathname.startsWith("/robocoders/");

  const [atTop, setAtTop] = useState(true);
  // local, optimistic toggle state so the thumb slides instantly on click,
  // ahead of (and independent from) the route change that follows it.
  const [active, setActive] = useState(isRobocoders);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setActive(isRobocoders);
  }, [isRobocoders]);

  const handleToggle = (target: boolean, href: string) => {
    if (target === active) return;
    setActive(target);
    // let the thumb finish its slide before the page actually navigates
    window.setTimeout(() => router.push(href), 260);
  };

  return (
    <div
      className={`bg-slate-900 text-white py-1.5 px-4 w-full h-9 flex items-center transition-opacity duration-300 ${
        fixed ? "fixed top-0 left-0 right-0 z-50" : ""
      } ${atTop ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
    >
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">
          YugMinds Pvt Ltd
        </span>

        <div className="relative flex items-center bg-white/5 border border-white/10 rounded-full p-0.5">
          <motion.span
            className="absolute inset-y-0.5 w-24 bg-blue-600 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            initial={false}
            animate={{ left: active ? "6rem" : "0.125rem" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          />
          <button
            type="button"
            onClick={() => handleToggle(false, "/")}
            className="relative z-10 w-24 py-1 rounded-full text-xs font-semibold text-center transition-colors duration-200"
          >
            <motion.span
              animate={{
                color: !active ? "#ffffff" : "#94a3b8",
                scale: !active ? 1 : 0.96,
              }}
              className="inline-block"
            >
              YugMinds
            </motion.span>
          </button>
          <button
            type="button"
            onClick={() => handleToggle(true, "/robocoders")}
            className="relative z-10 w-24 py-1 rounded-full text-xs font-semibold text-center transition-colors duration-200"
          >
            <motion.span
              animate={{
                color: active ? "#ffffff" : "#94a3b8",
                scale: active ? 1 : 0.96,
              }}
              className="inline-block"
            >
              Robocoders™
            </motion.span>
          </button>
        </div>
      </div>
    </div>
  );
}
