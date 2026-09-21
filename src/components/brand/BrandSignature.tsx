// src/components/brand/BrandSignature.tsx
// "Wassup wassup" — the human side of the G4M37Z identity. Set in Caveat
// (handwritten, confident, not script-cliché). Use sparingly: landing hero,
// onboarding, loading, brand moments, empty states. Never in body copy.
//
// Restyle (2026-09-21, user-approved "keep but make it richer"): weight
// bumped to Caveat 700, a slight warm rotation lifts the handwriting off the
// baseline, and a copper spark echoes the mark's dot — same motif as the
// wordmark's accented "37".

import { Caveat } from "next/font/google";

export const caveat = Caveat({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-signature",
  display: "swap",
});

interface BrandSignatureProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl sm:text-6xl",
} as const;

export function BrandSignature({ size = "md", className }: BrandSignatureProps) {
  return (
    <span
      className={`font-signature inline-flex items-baseline gap-1 ${SIZES[size]} font-bold leading-none text-accent-text select-none ${className ?? ""}`}
      style={{ transform: "rotate(-1.5deg)" }}
      aria-hidden="true"
    >
      Wassup wassup
      <span
        aria-hidden
        className="inline-block h-[0.18em] w-[0.18em] rounded-full bg-accent"
        style={{ marginBottom: "0.08em" }}
      />
    </span>
  );
}
