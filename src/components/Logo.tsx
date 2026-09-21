// src/components/Logo.tsx
// G4M37Z lockup: inline BrandMark + BrandWordmark. The wordmark is typeset
// bold tech caps (Inter 900, copper "37"); it aligns to the mark's optical
// centerline with breathing room (gap-2.5) and no extra stroke tricks —
// heavy weights don't need optical bolding.

import { BrandMark } from "@/components/brand/BrandMark";
import { BrandWordmark } from "@/components/brand/BrandWordmark";

interface LogoProps {
  withWordmark?: boolean;
  height?: number;
  ariaLabel?: string;
}

export function Logo({ withWordmark = true, height = 34, ariaLabel = "G4M37Z Communities — home" }: LogoProps) {
  // Cap-height match: Inter's cap height is ~0.72em, so a wordmark font-size
  // of height*0.62 puts its caps level with the mark's visual mass.
  const wordmarkHeight = Math.round(height * 0.62 * 10) / 10;
  return (
    <span className="inline-flex items-center gap-2.5" aria-label={ariaLabel} role="img">
      <span className="shrink-0 text-fg" style={{ height, width: height }}>
        <BrandMark size={height} className="h-full w-full" />
      </span>
      {withWordmark && (
        <BrandWordmark height={wordmarkHeight} className="text-fg" />
      )}
    </span>
  );
}
