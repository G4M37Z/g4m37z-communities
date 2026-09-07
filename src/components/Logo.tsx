// src/components/Logo.tsx
// Approved G4M37Z brand — primary /icon.jpg verified present; fallback /logo-mark.svg

interface LogoProps {
  withWordmark?: boolean;
  height?: number;
  ariaLabel?: string;
}

export function Logo({ withWordmark = true, height = 32, ariaLabel = "G4M37Z Communities — home" }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={ariaLabel} role="img">
      <span className="relative shrink-0 overflow-hidden rounded-md bg-bg" style={{ height, width: height * 1.2 }}>
        <img
          src="/icon.png"
          alt="G4M37Z Communities"
          className="h-full w-full object-contain"
          style={{ height: "100%", width: "100%", display: "block" }}
        />
      </span>
      {withWordmark && (
        <span className="font-sans text-lg font-black tracking-tight text-fg sm:text-xl" style={{ lineHeight: 1 }}>
          G4M37Z
        </span>
      )}
    </span>
  );
}
