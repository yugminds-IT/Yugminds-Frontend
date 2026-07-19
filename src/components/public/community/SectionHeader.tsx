"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  title,
  subtitle,
  viewAllHref,
  variant = "light",
  className = "",
}: {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  /** "light" = dark text on white/gray bg  |  "dark" = white text on blue bg */
  variant?: "light" | "dark";
  className?: string;
}) {
  const isDark = variant === "dark";
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.21, 0.61, 0.35, 1] }}
      className={`flex items-start justify-between mb-8 ${className}`}
    >
      <div>
        <h2 className={`text-2xl md:text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`text-sm mt-1.5 max-w-xl ${isDark ? "text-blue-100" : "text-gray-500"}`}>
            {subtitle}
          </p>
        )}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className={`group flex items-center gap-1 font-semibold text-sm shrink-0 mt-1 transition-colors ${
            isDark
              ? "text-blue-100 hover:text-white"
              : "text-blue-600 hover:text-blue-700"
          }`}
        >
          View All <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </motion.div>
  );
}
