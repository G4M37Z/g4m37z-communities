// src/components/Logo.tsx
// G4M37Z lockup: inline BrandMark + BrandWordmark. Both are inline SVG and
// inherit currentColor, so the lockup is theme-aware with no extra request.
// The wordmark is hand-drawn art (tools/wordmark/gen.mjs), not typeset text.
//
// Lockup tuning: the wordmark's calligraphic hairlines thin out at header
// sizes, so the wordmark group gets a slight same-color stroke (optical
// bolding, 0.35px — invisible at large sizes, decisive below ~30px). The
// pair sits on a shared optical centerline with breathing room (gap-2.5)
// and the wordmark rides 0.5px up to match the mark's visual weight.

import { BrandMark } from "@/components/brand/BrandMark";
import { BrandWordmark } from "@/components/brand/BrandWordmark";

interface LogoProps {
  withWordmark?: boolean;
  height?: number;
  ariaLabel?: string;
}

export function Logo({ withWordmark = true, height = 34, ariaLabel = "G4M37Z Communities — home" }: LogoProps) {
  const wordmarkHeight = Math.round(height * 0.66 * 10) / 10;
  return (
    <span className="inline-flex items-center gap-2.5" aria-label={ariaLabel} role="img">
      <span className="shrink-0 text-fg" style={{ height, width: height }}>
        <BrandMark size={height} className="h-full w-full" />
      </span>
      {withWordmark && (
        <span
          className="block text-fg [&_g]:[stroke:currentColor] [&_g]:[stroke-width:0.35] [&_g]:[stroke-linejoin:round]"
          style={{ transform: "translateY(-0.5px)" }}
        >
          <BrandWordmark height={wordmarkHeight} className="text-fg" />
        </span>
      )}
    </span>
  );
}
