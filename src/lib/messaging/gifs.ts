// ============================================================================
// src/lib/messaging/gifs.ts
// Tenor GIF search (GAP-MSG-RICH-01 remainder). Server-only: the API key
// never reaches the browser — the client talks to /api/gifs, which proxies
// here. Without TENOR_API_KEY configured the module degrades gracefully and
// the picker shows an explanatory empty state (upload-GIF path unaffected).
//
// Result URLs are restricted to Tenor media hosts by gifVerdict in
// service.ts before any row is written, so a crafted API response or a
// tampered client cannot plant arbitrary URLs in the thread.
// ============================================================================

const TENOR_HOSTS = new Set([
  "media.tenor.com",
  "media1.tenor.com",
  "media2.tenor.com",
  "media3.tenor.com",
  "c.tenor.com",
]);

export interface GifResult {
  id: string;
  /** Tiny preview used inside the picker grid. */
  previewUrl: string;
  /** Full-size asset stored on the message row. */
  url: string;
  description: string;
}

export type GifSearchResult =
  | { ok: true; gifs: GifResult[] }
  | { ok: false; error: string; reason: "no-key" | "upstream" };

export function isTenorHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && TENOR_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

interface TenorMediaObject {
  url?: string;
  dims?: number[];
}
interface TenorItem {
  id?: string;
  content_description?: string;
  media_formats?: Record<string, TenorMediaObject>;
}

export async function searchGifs(
  query: string,
  opts: { limit?: number } = {},
): Promise<GifSearchResult> {
  const key = process.env.TENOR_API_KEY;
  if (!key) {
    return {
      ok: false,
      error:
        "GIF search is not configured yet — add TENOR_API_KEY to enable it. You can still attach a GIF file.",
      reason: "no-key",
    };
  }

  const q = query.trim();
  const endpoint = q
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}`
    : "https://tenor.googleapis.com/v2/featured";

  try {
    const res = await fetch(
      `${endpoint}&key=${encodeURIComponent(key)}&limit=${opts.limit ?? 20}&media_filter=gif,tinygif&client_key=g4m37z_communities`,
      // Tenor is safe to cache briefly server-side; keeps the picker snappy.
      { next: { revalidate: 300 } },
    );
    if (!res.ok) {
      return { ok: false, error: "GIF search is unavailable right now.", reason: "upstream" };
    }
    const data = (await res.json()) as { results?: TenorItem[] };
    const gifs: GifResult[] = [];
    for (const item of data.results ?? []) {
      const full = item.media_formats?.gif?.url;
      const tiny = item.media_formats?.tinygif?.url ?? full;
      if (!full || !tiny) continue;
      // Defence-in-depth: even though the key is ours, never surface a
      // non-Tenor URL through this API.
      if (!isTenorHost(full) || !isTenorHost(tiny)) continue;
      gifs.push({
        id: item.id ?? full,
        previewUrl: tiny,
        url: full,
        description: item.content_description ?? "GIF",
      });
    }
    return { ok: true, gifs };
  } catch {
    return { ok: false, error: "GIF search is unavailable right now.", reason: "upstream" };
  }
}
