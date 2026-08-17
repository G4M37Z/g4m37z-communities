"use client";

// src/lib/motion.ts
// GSAP motion helpers + reduced-motion guards.
// Restrained by spec: short, intentional, opacity + small Y only.
// All functions are safe to call without gsap registered on the server.

import { useEffect, useRef } from "react";

const reducedMotionQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

function prefersReducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false;
}

/**
 * Reveal a single element with a subtle fade + small Y rise.
 * Use on page mount for hero content.
 */
export function fadeUp(
  el: Element | null,
  options: { delay?: number; duration?: number; y?: number } = {},
): void {
  if (!el || prefersReducedMotion()) return;
  // Lazy import keeps bundle small for non-interactive pages.
  void import("gsap").then(({ gsap }) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: options.y ?? 12 },
      {
        opacity: 1,
        y: 0,
        duration: (options.duration ?? 0.32),
        delay: options.delay ?? 0,
        ease: "power2.out",
      },
    );
  });
}

/**
 * Stagger a group of children — opacity + small Y, 40ms apart.
 * Use on lists, card grids.
 */
export function staggerIn(
  container: Element | null,
  childSelector: string,
  options: { stagger?: number; y?: number } = {},
): void {
  if (!container || prefersReducedMotion()) return;
  const children = container.querySelectorAll(childSelector);
  if (children.length === 0) return;
  void import("gsap").then(({ gsap }) => {
    gsap.fromTo(
      children,
      { opacity: 0, y: options.y ?? 10 },
      {
        opacity: 1,
        y: 0,
        duration: 0.28,
        stagger: options.stagger ?? 0.04,
        ease: "power2.out",
      },
    );
  });
}

/**
 * React hook: stagger in children of a ref once on mount.
 * Returns the ref to attach to your container.
 *
 *   const ref = useStaggerIn("> *");
 *   <div ref={ref}>...</div>
 */
export function useStaggerIn(childSelector: string = "> *") {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    staggerIn(ref.current, childSelector);
  }, [childSelector]);
  return ref;
}

/**
 * React hook: fade-up a single ref on mount.
 */
export function useFadeUp(options: { delay?: number; y?: number } = {}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    fadeUp(ref.current, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/**
 * React hook: dim the site header on scroll. Toggle [data-scrolled] on
 * the element so CSS can quietly raise background opacity + border.
 */
export function useHeaderScrollState(thresholdPx: number = 8) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ticking = false;
    function onScroll() {
      if (!el) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (!el) return;
        const scrolled = window.scrollY > thresholdPx;
        if (el.dataset.scrolled !== String(scrolled)) {
          el.dataset.scrolled = String(scrolled);
        }
        ticking = false;
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [thresholdPx]);
  return ref;
}