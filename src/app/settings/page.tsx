// src/app/settings/page.tsx
// Settings page — lets the authenticated user edit their profile.
// Server Component reads the profile; Client Component handles the form.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";
import { GamingProfileForm } from "@/components/settings/gaming-profile-form";
import { NotificationPreferencesForm } from "@/components/settings/notification-prefs-form";
import { getGamingProfile } from "@/lib/profiles/service-v4";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — G4M37Z Communities",
  description: "Edit your profile, display name, bio, avatar, and gaming identity.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings");
  }

  // Fetch profile, backfill if missing (for users who signed up before profile creation was added)
  let { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at, notification_prefs")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Create minimal profile
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fallbackUsername =
      (typeof meta.username === "string" && meta.username.trim()) ||
      (user.email ? user.email.split("@")[0] : user.id);
    const safeUsername =
      String(fallbackUsername)
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 30) || `user_${user.id.slice(0, 8)}`;

    const { data: newProfile, error: insertErr } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        username: safeUsername,
        display_name: String(fallbackUsername).slice(0, 80),
      })
      .select("id, username, display_name, avatar_url, bio, created_at")
      .single();

    if (insertErr) {
      console.error("Settings: profile backfill failed:", insertErr);
      // If username taken, redirect to settings with error so they can pick one
      if (insertErr.code === "23505") {
        redirect("/settings?error=username_taken");
      }
      redirect("/login?next=/settings");
    }
    profile = newProfile;
  }

  const gaming = await getGamingProfile(user.id);
  const prefsRaw = (profile as { notification_prefs?: Record<string, boolean> | null } | null)
    ?.notification_prefs ?? {};

  return (
    <div className="mx-auto max-w-xl px-4 pt-8 pb-24">
      <NotificationPreferencesForm initial={prefsRaw} />
      <div className="h-5" />
      <GamingProfileForm initial={gaming} />
      <div className="h-5" />
      <SettingsForm profile={profile} />
    </div>
  );
}
