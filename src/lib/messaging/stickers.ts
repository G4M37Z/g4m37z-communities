// ============================================================================
// src/lib/messaging/stickers.ts
// Local sticker catalog for DM attachments (GAP-MSG-RICH-01). Stickers are
// first-party app assets under /public/stickers — they are never uploaded to
// storage (unlike image/GIF attachments), so a "sticker" send carries the
// asset URL directly and needs no server action, no bytes sniff and no rate
// limit. The messages.attachment_type CHECK already allows 'sticker' (047).
// ============================================================================

export interface Sticker {
  id: string;
  name: string;
  /** Public app-relative asset path, e.g. "/stickers/fire.svg". */
  url: string;
}

export const STICKERS: readonly Sticker[] = Object.freeze([
  { id: "fire", name: "Fire", url: "/stickers/fire.svg" },
  { id: "skull", name: "Dead", url: "/stickers/skull.svg" },
  { id: "clutch", name: "Clutch", url: "/stickers/clutch.svg" },
  { id: "ggwp", name: "Well played", url: "/stickers/ggwp.svg" },
  { id: "glhf", name: "Good luck", url: "/stickers/glhf.svg" },
  { id: "rofl", name: "Rofl", url: "/stickers/rofl.svg" },
  { id: "nice", name: "Nice", url: "/stickers/nice.svg" },
  { id: "trophy", name: "Champion", url: "/stickers/trophy.svg" },
  { id: "wave", name: "Yo", url: "/stickers/wave.svg" },
  { id: "love", name: "Love", url: "/stickers/love.svg" },
]);

const BY_ID = new Map<string, Sticker>(STICKERS.map((s) => [s.id, s]));

export function stickerById(id: string): Sticker | undefined {
  return BY_ID.get(id);
}

/**
 * Verdict helper for validating a sticker reference before it is sent or
 * rendered. Guards against arbitrary attachment_url injection: a sticker
 * must reference an asset in this catalog, by exact public path.
 */
export type StickerVerdict =
  | { ok: true; sticker: Sticker }
  | { ok: false; reason: "unknown_id" | "bad_url" };

export function stickerVerdict(url: string | null | undefined): StickerVerdict {
  if (!url || !url.startsWith("/stickers/")) {
    return { ok: false, reason: "bad_url" };
  }
  const id = url.slice("/stickers/".length).replace(/\.svg$/, "");
  const sticker = stickerById(id);
  if (!sticker) return { ok: false, reason: "unknown_id" };
  if (sticker.url !== url) return { ok: false, reason: "bad_url" };
  return { ok: true, sticker };
}

export const __test = { stickerVerdict, stickerById, STICKERS };