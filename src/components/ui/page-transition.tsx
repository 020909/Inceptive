"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type PageTransitionProps = {
  children: React.ReactNode;
  /** Optional shell: use for marketing or sparse pages that need centered max-width padding. */
  className?: string;
};

/**
 * Route enter animation for dashboard content. No forced padding — each page owns layout
 * (dashboard chat is full-bleed; others use p-8 / max-w-* on their root).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      className={cn("min-h-0 w-full flex flex-col", className)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.42,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* Staggered children animation — use for lists */
export function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}