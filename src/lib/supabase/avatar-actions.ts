// src/lib/supabase/avatar-actions.ts
// Server action: upload + replace the current user's avatar.
// Uses the cookie-bound client (RLS-owned) for storage + profiles update.

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function safeExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}

export async function uploadAvatar(formData: FormData) {
  try {
    const file = formData.get("avatar");
    if (!(file instanceof File)) {
      return { error: "No file uploaded." };
    }
    if (file.size === 0) {
      return { error: "Avatar file is empty." };
    }
    if (file.size > MAX_BYTES) {
      return { error: "Avatar must be 5 MB or smaller." };
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return { error: "Avatar must be JPEG, PNG, WebP, or GIF." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in." };

    // Object key: {userId}/avatar.{ext}
    const ext = safeExt(file.type);
    const path = `${user.id}/avatar.${ext}`;

    // Optional: best-effort cleanup of prior variants.
    try {
      const { data: existing } = await supabase.storage
        .from("avatars")
        .list(user.id, { limit: 10 });
      if (existing && existing.length > 0) {
        const oldPaths = existing
          .filter((f: { name: string }) => f.name.startsWith("avatar."))
          .map((f: { name: string }) => `${user.id}/${f.name}`);
        if (oldPaths.length > 0) {
          await supabase.storage.from("avatars").remove(oldPaths);
        }
      }
    } catch {
      // ignore cleanup errors
    }

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadErr) {
      console.error("uploadAvatar failed:", uploadErr);
      // Common cause: the avatars storage bucket doesn't exist yet
      // (008_avatars_bucket.sql hasn't been run).
      const msg = uploadErr.message?.toLowerCase().includes("bucket")
        ? "Storage is not configured yet. Please contact support."
        : "Couldn't upload the avatar. Try again.";
      return { error: msg };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    // Append a cache-busting token so the browser doesn't keep serving the
    // previously cached image at the same URL. Each upload gets a fresh URL.
    const versionedUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: versionedUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateErr) {
      console.error("avatar url update failed:", updateErr);
      return { error: "Avatar uploaded but profile update failed." };
    }

    // Revalidate everything that renders the avatar. Layout invalidation is
    // required because Header/UserMenu live in the root layout and render
    // on every page — without layout invalidation, the header avatar stays
    // stale across navigations.
    revalidatePath("/settings");
    revalidatePath("/profile/[username]", "page");
    revalidatePath("/", "layout");
    revalidatePath("/home", "layout");
    revalidatePath("/communities", "layout");
    revalidatePath("/post", "layout");
    revalidatePath("/notifications", "layout");
    return { ok: true, url: versionedUrl };
  } catch (err) {
    console.error("uploadAvatar crashed:", err);
    return {
      error:
        "We hit an unexpected error. The avatars bucket may not be configured yet — please contact support if this keeps happening.",
    };
  }
}

export async function removeAvatar() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in." };

    try {
      const { data: existing } = await supabase.storage
        .from("avatars")
        .list(user.id, { limit: 10 });
      if (existing && existing.length > 0) {
        const oldPaths = existing
          .filter((f: { name: string }) => f.name.startsWith("avatar."))
          .map((f: { name: string }) => `${user.id}/${f.name}`);
        if (oldPaths.length > 0) {
          await supabase.storage.from("avatars").remove(oldPaths);
        }
      }
    } catch {
      // ignore cleanup errors
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateErr) {
      console.error("avatar remove failed:", updateErr);
      return { error: "Couldn't remove the avatar." };
    }

    revalidatePath("/settings");
    revalidatePath("/profile/[username]", "page");
    revalidatePath("/", "layout");
    revalidatePath("/home", "layout");
    revalidatePath("/communities", "layout");
    revalidatePath("/post", "layout");
    revalidatePath("/notifications", "layout");
    return { ok: true };
  } catch (err) {
    console.error("removeAvatar crashed:", err);
    return { error: "We hit an unexpected error removing the avatar." };
  }
}