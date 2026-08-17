"use client";

// src/components/HeaderScrollObserver.tsx
// Tiny client component that toggles [data-scrolled] on the parent <header>
// so CSS can quietly raise surface opacity once the page has scrolled.

import { useEffect } from "react";

export function HeaderScrollObserver({ threshold = 8 }: { threshold?: number }) {
  useEffect(() => {
    const headerEl = document.querySelector<HTMLElement>(".site-header");
    if (!headerEl) return;
    const header = headerEl;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrolled = window.scrollY > threshold;
        if (header.getAttribute("data-scrolled") !== String(scrolled)) {
          header.setAttribute("data-scrolled", String(scrolled));
        }
        ticking = false;
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return null;
}