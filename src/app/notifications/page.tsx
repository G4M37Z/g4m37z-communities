// src/app/notifications/page.tsx
// Notifications page — placeholder for Milestone 7.
// Protected route; shows a friendly message until notifications are built.

import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications — G4M37Z Communities",
  description: "Your notifications feed.",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/notifications");
  }

  // Ensure profile exists (backfill for users who signed up before profile creation was added)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
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

    await supabase.from("profiles").insert({
      id: user.id,
      username: safeUsername,
      display_name: String(fallbackUsername).slice(0, 80),
    });
  }

  return (
    <main className="container-x py-12 max-w-2xl text-center">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Bell size={32} />
      </div>
      <h1 className="mb-2 text-2xl font-black text-fg sm:text-3xl">
        Notifications
      </h1>
      <p className="text-sm text-text-muted">
        In-app notifications (comments on your posts, replies, mentions, moderation
        actions) will appear here in Milestone 7.
      </p>
      <p className="mt-4 text-xs text-text-muted">
        For now, you&apos;re signed in and the route works.
      </p>
    </main>
  );
}
