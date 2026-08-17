"use client";

// src/components/PageEnter.tsx
// Lightweight client component that runs a staggered GSAP entrance on its
// direct children, then forwards refs through. Server pages can drop this
// in to opt into entrance animation without becoming client components.

import { useEffect } from "react";
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
  useEffect(() => {
    const el = document.querySelector("[data-page-enter]");
    if (el) staggerIn(el, childSelector, { stagger, y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div data-page-enter className="page-enter">
      {children}
    </div>
  );
}