// src/components/Logo.tsx
// G4M37Z lockup: inline BrandMark + wordmark. The mark is inline SVG
// (inherits currentColor — theme-aware by default); the wordmark stays
// typeset (font-sans black, tight tracking) rather than an image, so it
// stays crisp and theme-aware everywhere.

import { BrandMark } from "@/components/brand/BrandMark";

interface LogoProps {
  withWordmark?: boolean;
  height?: number;
  ariaLabel?: string;
}

export function Logo({ withWordmark = true, height = 34, ariaLabel = "G4M37Z Communities — home" }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={ariaLabel} role="img">
      <span className="shrink-0 text-fg" style={{ height, width: height }}>
        <BrandMark size={height} className="h-full w-full" />
      </span>
      {withWordmark && (
        <span className="font-sans text-lg font-black tracking-tight text-fg sm:text-xl" style={{ lineHeight: 1 }}>
          G4M37Z
        </span>
      )}
    </span>
  );
}
