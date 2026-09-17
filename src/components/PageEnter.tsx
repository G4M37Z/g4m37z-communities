"use client";

// src/components/PageEnter.tsx
// Lightweight client component that runs a staggered GSAP entrance on its
// direct children, then forwards refs through. Server pages can drop this
// in to opt into entrance animation without becoming client components.

import { useEffect, useRef } from "react";
import { staggerIn } from "@/lib/motion";

export function PageEnter({
  children,
  childSelector = "> *",
  stagger = 0.05,
  y = 12,
}: {
  children: React.ReactNode;
  childSelector?: string;
  stagger?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    staggerIn(ref.current, childSelector, { stagger, y });
  }, [childSelector, stagger, y]);

  return (
    <div ref={ref} className="page-enter">
      {children}
    </div>
  );
}
