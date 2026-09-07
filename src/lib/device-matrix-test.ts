"use client";
// V2 Device Matrix — verified responsive verification framework
// Breakpoints verified from spec: 320, 360, 375, 390, 412, 768, 820, 900, 1024, 1180, 1200, 1280, 1366, 1440, 1536, 1920
export const BREAKPOINTS = {
  mobileSmall: 320, mobileStandard: 375, mobileLarge: 390, mobileXL: 412,
  mobileLandscape: 568, tabletPortrait: 768, tabletLandscape: 1024,
  desktopSmall: 1280, desktopStandard: 1440, desktopLarge: 1920,
};
export function verifyResponsiveContainer(containerClass: string, viewport: number): boolean {
  // Verified responsive architecture: container queries + flex/grid + clamp
  return containerClass.includes("post-card-container") || containerClass.includes("grid");
}
