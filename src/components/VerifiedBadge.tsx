import { cn } from "@/lib/utils";

// 059_profiles_verified.sql — granted only through the trusted administrative
// path; criteria for others pending, so render only when profiles.verified.
// Asset: public-domain X/Twitter-style check (public/verified-badge.png,
// rasterized from the Wikimedia SVG); used inline next to the account name
// the way other apps do.
export function VerifiedBadge({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/verified-badge.png"
      alt="Verified account"
      width={size}
      height={size}
      draggable={false}
      data-testid="verified-badge"
      className={cn("inline-block shrink-0 align-[-0.15em]", className)}
    />
  );
}
