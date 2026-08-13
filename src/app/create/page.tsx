// src/app/create/page.tsx
// Create a new community. Server Component shell renders the form
// (client component) which handles validation, slug availability, and submit.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateCommunityForm } from "./CreateCommunityForm";
import type { CommunityCategory } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create community",
  description: "Start a new G4M37Z gaming community.",
};

export default async function CreateCommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/create");
  }

  const { data: categories } = await supabase
    .from("community_categories")
    .select("id, slug, name, created_at")
    .order("name", { ascending: true });

  return (
    <main className="container-x py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">
            Create a community
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Bring players together. Pick a name, slug, and topic. You&apos;ll
            be the admin of the new community.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <CreateCommunityForm
            categories={(categories as CommunityCategory[] | null) ?? []}
          />
        </div>
      </div>
    </main>
  );
}
