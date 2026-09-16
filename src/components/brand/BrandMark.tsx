// src/components/brand/BrandMark.tsx
// The G4M37Z symbol, inlined (not <img>) so it inherits currentColor and
// renders crisply at every size without an extra request. Structured side
// of the brand — see docs/BRAND.md.

interface BrandMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

export function BrandMark({ size = 24, className, title }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M 17.03 29.31 A 15.5 15.5 0 0 1 46.47 28.31"
        stroke="currentColor"
        strokeWidth={11}
        strokeLinecap="round"
      />
      <path
        d="M 25.5 49.5 A 16 16 0 0 0 50 49.5"
        stroke="currentColor"
        strokeWidth={11}
        strokeLinecap="round"
      />
      <circle cx={54.6} cy={39.8} r={4.8} fill="currentColor" />
    </svg>
  );
}
