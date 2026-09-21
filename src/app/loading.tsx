// src/app/loading.tsx
// Root-segment fallback. Kept deliberately minimal: a single mark with a
// short settle, no font-dependent content (the signature on a splash caused
// a fallback-cursive flash on cold loads, reading as "slow" before the swap),
// and an indeterminate progress hairline so the wait reads as progress, not
// freeze. Per-route skeletons carry the rest of the perceived-speed story.
// prefers-reduced-motion skips the animation entirely.

import { BrandMark } from "@/components/brand/BrandMark";

export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-5"
      aria-busy="true"
      aria-label="Loading"
    >
      <BrandMark
        size={44}
        className="text-fg/70 motion-safe:animate-[brand-settle_240ms_var(--ease-out)_both]"
      />
      <span
        aria-hidden
        className="motion-safe:animate-[brand-reveal_200ms_var(--ease-out)_both] h-px w-24 overflow-hidden rounded-full bg-border"
      >
        <span className="block h-px w-1/2 animate-[skeleton-shimmer_900ms_linear_infinite] bg-accent/70" />
      </span>
    </div>
  );
}
