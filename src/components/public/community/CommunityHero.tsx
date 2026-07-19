"use client";

import { motion } from "framer-motion";
import type { CommunityConfig } from "@/lib/community-types";

export function CommunityHero({
  config,
  sectionColor = "white",
}: {
  config: CommunityConfig;
  sectionColor?: "blue" | "white";
}) {
  const isBlue = sectionColor === "blue";

  return (
    <section className={`relative overflow-hidden ${isBlue ? "bg-blue-600" : "bg-white border-b border-gray-100"}`}>
      {/* Decorative dots — only on blue */}
      {isBlue && (
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
          <div className="absolute top-5 left-5 w-3 h-3 rounded-full bg-white/20" />
          <div className="absolute top-10 left-16 w-2 h-2 rounded-full bg-white/15" />
          <div className="absolute top-20 left-8 w-4 h-4 rounded-full bg-white/10" />
          <div className="absolute bottom-10 left-12 w-2 h-2 rounded-full bg-white/20" />
          <div className="absolute top-3 right-80 w-2 h-2 rounded-full bg-white/15" />
          <div className="absolute bottom-6 right-96 w-3 h-3 rounded-full bg-white/10" />
          <div className="absolute top-14 right-64 w-1.5 h-1.5 rounded-full bg-white/20" />
        </div>
      )}

      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 items-center min-h-[260px] py-10 md:py-16">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.61, 0.35, 1] }}
            className={`relative z-10 ${isBlue ? "text-white" : ""}`}
          >
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold mb-5 ${isBlue ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"}`}>
              <span className={`w-2 h-2 rounded-full inline-block ${isBlue ? "bg-white" : "bg-blue-600"}`} />
              Community
            </div>
            <h1 className={`text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight ${isBlue ? "text-white" : "text-gray-900"}`}>
              {config.hero_title}
            </h1>
            {config.hero_subtitle && (
              <p className={`mt-4 text-base md:text-lg leading-relaxed max-w-md ${isBlue ? "text-blue-100" : "text-gray-500"}`}>
                {config.hero_subtitle}
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.21, 0.61, 0.35, 1] }}
            className="flex items-center justify-center min-h-[200px] md:min-h-[240px] relative z-10"
          >
            {config.hero_image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={config.hero_image_url}
                alt=""
                className="max-h-[300px] w-full object-contain drop-shadow-lg"
              />
            ) : (
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className={`w-full max-w-xs aspect-square rounded-full flex items-center justify-center text-6xl border-2 ${isBlue ? "bg-blue-500/40 border-white/20" : "bg-blue-50 border-blue-100"}`}
              >
                👥
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
