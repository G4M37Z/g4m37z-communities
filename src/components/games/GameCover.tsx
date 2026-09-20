import { isOfficialCoverUrl } from "@/lib/games/cover-url";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * GameCover (GAP-GAMES-01) renders official cover art (Steam / IGDB CDN,
 * validated by an allowlist) with a branded placeholder fallback so a game
 * without a cover still gets a consistent tile.
 */
export function GameCover({ title, url }: { title: string; url: string | null }) {
  if (!isOfficialCoverUrl(url)) {
    return (
      <div
        aria-hidden
        className="flex aspect-[2/1] w-full items-center justify-center rounded-lg border border-border bg-surface"
      >
        <span className="text-2xl font-bold text-text-muted">{initials(title)}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${title} cover art`}
      className="aspect-[2/1] w-full rounded-lg object-cover"
      loading="lazy"
    />
  );
}