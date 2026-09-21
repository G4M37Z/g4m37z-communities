// ============================================================================
// src/components/platform-icon.tsx
// Official platform marks for gaming-platform links (GAP-PLATFORM-01).
//
// Sources (all official; bundled locally, never hotlinked):
//   steam / playstation / xbox / google_play — Simple Icons path data (CC0).
//     Xbox was removed from Simple Icons v13+, so its path is pinned from
//     simple-icons@12.4.0 and inlined here.
//   apple_game_center — Apple's official Game Center mark, four overlapping
//     circles (source: developer.apple.com/game-center, via Wikimedia Commons
//     "Game Center icon.svg", PD-ineligible / trademarked).
//
// Marks render in their official brand hex on light surfaces and a slightly
// lifted variant on dark (brand guidelines permit this for recognition); a
// monochrome `text-fg` treatment stays available via `mono` for places that
// need palette restraint. A text label always sits alongside in the UI.
// ============================================================================

import type { ReactNode } from "react";
import { PLATFORM_LABELS, type Platform } from "@/lib/profiles/platforms";

interface PlatformIconDef {
  viewBox: string;
  body: ReactNode;
  /** Official brand hex (light surfaces). */
  brand: string;
  /** Slightly lifted variant for dark surfaces (contrast). */
  brandDark: string;
}

/**
 * Brand color for a platform on the given theme. Kept exported so server
 * components can compute the same value the icon renders with.
 */
export function platformBrandColor(platform: Platform, theme: "light" | "dark"): string {
  const icon = ICONS[platform];
  if (!icon) return "currentColor";
  return theme === "dark" ? icon.brandDark : icon.brand;
}

const ICONS: Record<Platform, PlatformIconDef> = {
  steam: {
    viewBox: "0 0 24 24",
    brand: "#66c0f4",
    brandDark: "#8ad4f8",
    body: (
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
    ),
  },
  playstation: {
    viewBox: "0 0 24 24",
    brand: "#0070d1",
    brandDark: "#3b8fe0",
    body: (
      <path d="M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z" />
    ),
  },
  xbox: {
    viewBox: "0 0 24 24",
    brand: "#107c10",
    brandDark: "#4ea44e",
    body: (
      <path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.002 17.48 24 14.861 24 12.004c0-3.34-1.365-6.362-3.57-8.536 0 0-.027-.022-.082-.042-.063-.022-.152-.045-.281-.045-.592 0-1.985.434-4.805 3.246zM3.654 3.426c-.057.02-.082.041-.086.042C1.365 5.642 0 8.664 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91-2.82-2.813-4.216-3.245-4.806-3.245-.131 0-.223.021-.281.046v-.002zM12 3.551S9.055 1.828 6.755 1.746c-.903-.033-1.454.295-1.521.339C7.379.646 9.659 0 11.984 0H12c2.334 0 4.605.646 6.766 2.085-.068-.046-.615-.372-1.52-.339C14.946 1.828 12 3.545 12 3.545v.006z" />
    ),
  },
  google_play: {
    viewBox: "0 0 24 24",
    brand: "#00c4ff",
    brandDark: "#4dd2ff",
    body: (
      <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
    ),
  },
  apple_game_center: {
    viewBox: "0 0 1050.29 1076.18",
    brand: "#6e6e73",
    brandDark: "#98989d",
    // Apple's official mark: four overlapping circles. Rendered in
    // currentColor with per-circle opacity so the overlaps stay legible
    // (the source uses four gradient fills at 0.8 opacity).
    body: (
      <>
        <circle cx="706.58" cy="314.54" r="314.54" opacity="0.7" />
        <circle cx="420.27" cy="435.51" r="420.27" opacity="0.55" />
        <circle cx="770.28" cy="751.73" r="280.01" opacity="0.8" />
        <circle cx="398.54" cy="872.1" r="204.08" opacity="0.9" />
      </>
    ),
  },
};

export const PLATFORM_ICON_SLUGS = Object.keys(ICONS) as Platform[];

export function PlatformIcon({
  platform,
  className,
  labelHidden = false,
  mono = false,
}: {
  platform: Platform;
  className?: string;
  labelHidden?: boolean;
  /** Palette-restrained rendering (currentColor); default is brand color. */
  mono?: boolean;
}) {
  const icon = ICONS[platform];
  if (!icon) return null;
  return (
    <svg
      viewBox={icon.viewBox}
      className={className}
      role="img"
      aria-label={labelHidden ? undefined : PLATFORM_LABELS[platform]}
      aria-hidden={labelHidden}
      style={mono ? undefined : ({ color: "var(--platform-brand, currentColor)" } as React.CSSProperties)}
      fill="currentColor"
      focusable="false"
      data-platform={mono ? undefined : platform}
    >
      {icon.body}
    </svg>
  );
}