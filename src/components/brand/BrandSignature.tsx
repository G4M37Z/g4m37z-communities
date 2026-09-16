// src/components/brand/BrandSignature.tsx
// "Wassup wassup" — the human side of the G4M37Z identity. Set in Caveat
// (handwritten, confident, not script-cliché). Use sparingly: landing hero,
// onboarding, loading, brand moments, empty states. Never in body copy.

import { Caveat } from "next/font/google";

export const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-signature",
  display: "swap",
});

interface BrandSignatureProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-4xl sm:text-5xl",
} as const;

export function BrandSignature({ size = "md", className }: BrandSignatureProps) {
  return (
    <span
      className={`font-signature ${SIZES[size]} leading-none text-accent-text select-none ${className ?? ""}`}
      aria-hidden="true"
    >
      Wassup wassup
    </span>
  );
}
