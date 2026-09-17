// src/components/Logo.tsx
// G4M37Z lockup: inline BrandMark + BrandWordmark. Both are inline SVG and
// inherit currentColor, so the lockup is theme-aware with no extra request.
// The wordmark is hand-drawn art (tools/wordmark/gen.mjs), not typeset text.

import { BrandMark } from "@/components/brand/BrandMark";
import { BrandWordmark } from "@/components/brand/BrandWordmark";

interface LogoProps {
  withWordmark?: boolean;
  height?: number;
  ariaLabel?: string;
}

export function Logo({ withWordmark = true, height = 34, ariaLabel = "G4M37Z Communities — home" }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={ariaLabel} role="img">
      <span className="shrink-0 text-fg" style={{ height, width: height }}>
        <BrandMark size={height} className="h-full w-full" />
      </span>
      {withWordmark && <BrandWordmark height={height * 0.73} className="text-fg" />}
    </span>
  );
}
