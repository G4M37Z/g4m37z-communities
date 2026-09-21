// src/components/brand/BrandWordmark.tsx
// G4M37Z wordmark — bold tech caps (user decision, 2026-09-21). The original
// hand-drawn calligraphic paths (tools/wordmark/gen.mjs, still in
// public/brand/) read thin and uneven at header sizes. The wordmark is now
// typeset in Inter 900 with tight tracking, and the "37" carries the copper
// accent so the gamer identity stays visible in the lockup.
//
// Typeset (not paths) keeps it crisp at every size, theme-aware via
// text-fg/accent-text, and adds zero network requests — Inter is already the
// app font. Uppercase-only content prevents lowercase drift.

interface BrandWordmarkProps {
  height?: number;
  className?: string;
  title?: string;
}

export function BrandWordmark({ height = 28, className, title }: BrandWordmarkProps) {
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title ? "G4M37Z" : undefined}
      aria-hidden={title ? undefined : true}
      className={`inline-flex select-none items-baseline font-black uppercase leading-none tracking-tight ${className ?? ""}`}
      style={{ fontSize: height, letterSpacing: "-0.02em" }}
    >
      <span>G4M</span>
      <span className="text-accent-text">37</span>
      <span>Z</span>
    </span>
  );
}
