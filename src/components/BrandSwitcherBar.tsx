"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/* `editorial` matches the public landing page's cream/ink/blue theme.
   Everything else (Robocoders pages) keeps the original blue pill. */
export default function BrandSwitcherBar({
  fixed = false,
  editorial = false,
}: {
  fixed?: boolean;
  editorial?: boolean;
}) {
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

  const round = editorial ? "rounded-none" : "rounded-full";
  const labelCls = editorial
    ? "text-[0.6rem] font-light uppercase tracking-[0.22em]"
    : "text-xs font-semibold";
  const onColor = editorial ? "#F4EFE6" : "#ffffff";
  const offColor = editorial ? "#8A8578" : "#94a3b8";

  return (
    <div
      className={`py-1.5 px-4 w-full h-9 flex items-center transition-opacity duration-300 ${
        editorial
          ? "bg-ym-ink text-ym-cream border-b border-ym-cream/20"
          : "bg-slate-900 text-white"
      } ${fixed ? "fixed top-0 left-0 right-0 z-50" : ""} ${
        atTop ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`w-full mx-auto flex items-center justify-between ${
          editorial ? "max-w-[92rem] px-1 md:px-6" : "max-w-7xl"
        }`}
      >
        <span
          className={
            editorial
              ? "text-[0.6rem] font-light uppercase tracking-[0.28em] text-ym-cream/40"
              : "text-xs text-slate-400 font-medium"
          }
        >
          YugMinds Pvt Ltd
        </span>

        <div
          className={`relative flex items-center border p-0.5 ${round} ${
            editorial ? "border-ym-cream/15" : "bg-white/5 border-white/10"
          }`}
        >
          <motion.span
            className={`absolute inset-y-0.5 w-24 ${round} ${
              editorial
                ? "bg-ym-blue"
                : "bg-blue-600 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            }`}
            initial={false}
            animate={{ left: active ? "6rem" : "0.125rem" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          />
          <button
            type="button"
            onClick={() => handleToggle(false, "/")}
            className={`relative z-10 w-24 py-1 text-center transition-colors duration-200 ${round} ${labelCls}`}
          >
            <motion.span
              animate={{
                color: !active ? onColor : offColor,
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
            className={`relative z-10 w-24 py-1 text-center transition-colors duration-200 ${round} ${labelCls}`}
          >
            <motion.span
              animate={{
                color: active ? onColor : offColor,
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
