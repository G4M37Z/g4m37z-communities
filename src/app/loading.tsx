// src/app/loading.tsx
// Branded loading state. The mark reveals; no spinner, no artificial
// delay — this renders only while the segment's data is in flight.
// prefers-reduced-motion: the reveal is skipped, content fades in fast.

import { BrandMark } from "@/components/brand/BrandMark";

export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 motion-safe:animate-[brand-reveal_600ms_var(--ease-out)_both]"
      aria-busy="true"
      aria-label="Loading"
    >
      <BrandMark size={44} className="text-fg/70 motion-safe:animate-[brand-settle_900ms_var(--ease-out)_both]" />
      <span className="font-signature text-2xl text-accent-text/80 motion-safe:animate-[brand-reveal_700ms_var(--ease-out)_150ms_both]">
        Wassup wassup
      </span>
    </div>
  );
}
