// src/components/Logo.tsx
// Brand mark — uses approved G4M37Z asset (public/icon.jpg) exactly as supplied.
// Renders via <img> to preserve original proportions; wordmark kept beside.

import Image from "next/image";

interface LogoProps {
  withWordmark?: boolean;
  height?: number;
  ariaLabel?: string;
}

export function Logo({
  withWordmark = true,
  height = 32,
  ariaLabel = "G4M37Z Communities — home",
}: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={ariaLabel} role="img">
      <span className="relative shrink-0 overflow-hidden rounded-md" style={{ height, width: height * 1.2 }}>
        <Image
          src="/icon.jpg"
          alt="G4M37Z Communities"
          fill
          className="object-contain"
          priority
          sizes="(max-width: 768px) 32px, 40px"
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
