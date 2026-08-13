// src/components/Logo.tsx
// G4M37Z Communities brand mark — sharp hexagonal game-pad glyph with the
// "G4" wordmark. Pure SVG so it scales without raster artefacts.

interface LogoProps {
  /** Show the wordmark beside the mark. Default true. */
  withWordmark?: boolean;
  /** Total height in px (mark scales to match). Default 32. */
  height?: number;
  /** Override wordmark colour (defaults to text-fg via currentColor). */
  wordmarkClassName?: string;
  /** Accessible label override. */
  ariaLabel?: string;
}

export function Logo({
  withWordmark = true,
  height = 32,
  wordmarkClassName = "text-fg",
  ariaLabel = "G4M37Z Communities — home",
}: LogoProps) {
  const markSize = height;

  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={ariaLabel}
      role="img"
    >
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Hexagonal shield background */}
        <path
          d="M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z"
          fill="currentColor"
          className="text-accent"
        />
        {/* Inner cutout */}
        <path
          d="M32 14 L48 23 L48 41 L32 50 L16 41 L16 23 Z"
          fill="#0b0d12"
        />
        {/* G4 mark inside */}
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="900"
          fontSize="20"
          fill="#ffffff"
          letterSpacing="-1"
        >
          G4
        </text>
      </svg>

      {withWordmark && (
        <span
          className={`font-sans text-lg font-black tracking-tight sm:text-xl ${wordmarkClassName}`}
          style={{ lineHeight: 1 }}
        >
          G4M37Z
        </span>
      )}
    </span>
  );
}
