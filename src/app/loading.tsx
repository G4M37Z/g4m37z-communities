// src/app/loading.tsx
// Branded loading state. This is the fallback for the root segment, so it
// shows on every client-side navigation — keep the choreography SHORT.
// The mark lands and the signature is already there; nothing waits on a
// delayed animation. prefers-reduced-motion skips the reveal entirely.

import { BrandMark } from "@/components/brand/BrandMark";

export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
      aria-busy="true"
      aria-label="Loading"
    >
      <BrandMark
        size={44}
        className="text-fg/70 motion-safe:animate-[brand-settle_320ms_var(--ease-out)_both]"
      />
      <span className="font-signature text-2xl text-accent-text/80 motion-safe:animate-[brand-reveal_260ms_var(--ease-out)_both]">
        Wassup wassup
      </span>
    </div>
  );
}
