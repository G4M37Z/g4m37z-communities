import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventCreateForm } from "@/components/events/EventCreateForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/events/new");
  }

  // Load communities where the user may create events: owned, or where they
  // are an admin/moderator member (matches the events INSERT RLS policy).
  const [{ data: owned }, { data: moderated }] = await Promise.all([
    supabase.from("communities").select("id, name").eq("creator_id", user.id),
    supabase
      .from("community_members")
      .select("role, communities:community_id ( id, name )")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"]),
  ]);

  const moderatedCommunities = (moderated ?? []).flatMap(
    (m: { role: string; communities: { id: string; name: string } | { id: string; name: string }[] | null }) => {
      const c = Array.isArray(m.communities) ? m.communities[0] : m.communities;
      return c ? [c] : [];
    },
  );
  const byId = new Map<string, { id: string; name: string }>();
  for (const c of [...(owned ?? []), ...moderatedCommunities]) {
    byId.set(c.id, c);
  }
  const memberships = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href="/events"
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to events
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-fg">
        Create an event
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Events can be associated with one of your communities, or stand on
        their own.
      </p>
      <EventCreateForm
        communities={(memberships ?? []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }))}
      />
    </main>
  );
}
