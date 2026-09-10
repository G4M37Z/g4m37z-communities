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

  // Load communities the user owns (for the community dropdown). Empty
  // list is acceptable: events may also be created without a community.
  const { data: memberships } = await supabase
    .from("communities")
    .select("id, name")
    .eq("creator_id", user.id)
    .order("name");

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
