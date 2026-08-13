// src/app/settings/page.tsx
// Settings page — lets the authenticated user edit their profile.
// Server Component reads the profile; Client Component handles the form.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — G4M37Z Communities",
  description: "Edit your profile, display name, bio, and avatar.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login?next=/settings");
  }

  return <SettingsForm profile={profile} />;
}
