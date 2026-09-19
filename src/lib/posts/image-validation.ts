// ============================================================================
// src/lib/posts/image-validation.ts
// Pure post-image validation helpers. Kept OUT of the "use server" module
// (src/lib/posts/actions.ts) because a "use server" file may only export
// async functions — the previous object export
// (`export const __postImageTest`) made Next.js throw
// 'A "use server" file can only export async functions, found object.' and
// took down every action in the bundle (reposts, votes, reactions, image
// uploads) with digest …@E352.
// ============================================================================

export type PostImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/**
 * Sniff the first bytes of an uploaded file and return the image type it
 * actually is, or null when the bytes match no supported image signature.
 * Browser MIME (`file.type`) is client-controlled, so we refuse anything
 * whose content is not genuinely a JPEG/PNG/WebP/GIF.
 */
export async function sniffImageType(file: File): Promise<PostImageMime | null> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
  const b = (i: number) => bytes[i];
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 &&
    b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
    b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 6 &&
    b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38 &&
    (b(4) === 0x37 || b(4) === 0x39) && b(5) === 0x61
  ) {
    return "image/gif";
  }
  return null;
}

/**
 * Extract the object path inside the post-images bucket from a public URL,
 * or null when the URL is not a post-images object URL.
 */
export function postImagePathFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const configuredHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
    } catch {
      return "";
    }
  })();
  if (configuredHost && parsed.host !== configuredHost) return null;
  const m = parsed.pathname.match(/^\/storage\/v1\/object\/public\/post-images\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Validate that an imageUrl is a real post-images object owned by `ownerId`. */
export function validateOwnedImageUrl(imageUrl: string, ownerId: string): string | null {
  const path = postImagePathFromUrl(imageUrl);
  if (!path) return "That image doesn't look like a valid upload.";
  const owner = path.split("/")[0];
  if (!owner || owner !== ownerId) {
    return "That image isn't one of your uploads.";
  }
  return null;
}
