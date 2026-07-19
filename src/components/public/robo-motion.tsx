"use client";

/**
 * Shared motion primitives for the Robocoders marketing pages.
 * All are client components so they can be dropped into server pages
 * (about, programs, for-schools, …) without converting those pages.
 */

import { motion } from "framer-motion";

/* Fade + rise + slight scale on scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 36,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.61, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* Reveal from the side — for split hero/text-image layouts. */
export function RevealX({
  children,
  delay = 0,
  x = 48,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  x?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.8, delay, ease: [0.21, 0.61, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* Spring hover lift for cards. Wrap a Card (or any block) with it. */
export function HoverLift({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      whileHover={{ y: -8 }}
      transition={{
        opacity: { duration: 0.6, delay, ease: [0.21, 0.61, 0.35, 1] },
        y: { type: "spring", stiffness: 320, damping: 24, delay },
      }}
    >
      {children}
    </motion.div>
  );
}

/* Gentle infinite bobbing for decorative elements. */
export function Floating({
  children,
  duration = 5,
  offset = 10,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  duration?: number;
  offset?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -offset, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

/* Hand-drawn squiggle underline that draws itself on scroll into view. */
export function SquiggleUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 24"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <motion.path
        d="M4 16 Q 30 4, 58 14 T 112 14 T 166 14 T 216 12"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.45, ease: "easeOut" }}
      />
    </svg>
  );
}
