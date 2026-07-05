"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function BrandSwitcherBar({ fixed = false }: { fixed?: boolean }) {
  const pathname = usePathname();
  const isRobocoders =
    pathname === "/robocoders" || pathname.startsWith("/robocoders/");

  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-1 rounded text-xs font-semibold transition-all duration-200 ${
              !isRobocoders
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            YugMinds
          </Link>
          <Link
            href="/robocoders"
            className={`px-3 py-1 rounded text-xs font-semibold transition-all duration-200 ${
              isRobocoders
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            Robocoders™
          </Link>
        </div>
      </div>
    </div>
  );
}
