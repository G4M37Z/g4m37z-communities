import { Badge } from "@/components/Badge";

// 059_profiles_verified.sql — granted only through the trusted administrative
// path; criteria for others pending, so render only when profiles.verified.
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="accent"
      className="gap-0.5"
      title="Verified account"
      aria-label="Verified account"
      data-testid="verified-badge"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-2.5 w-2.5"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      Verified
    </Badge>
  );
}
