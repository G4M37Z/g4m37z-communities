"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Scroll-reveal primitive (framer-motion). One shared entrance for cards and
// grids so motion feels systemic, never scattered. Reduced-motion users get
// the final state immediately (no transform).
const EASE = [0.22, 1, 0.36, 1] as const;

export interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  /** Reveal once and stay (default) or re-run each time it enters view. */
  once?: boolean;
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 14,
  once = true,
}: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.45, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
