import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listConversations } from "@/lib/messaging/service";
import { PageEnter } from "@/components/PageEnter";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PageEnter>
        <main className="container-x py-8 pb-20">
          <h1 className="text-3xl font-bold tracking-tight text-fg">Messages</h1>
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/login?next=/messages" className="underline text-accent hover:text-accent-hover">
              Sign in
            </Link>{" "}
            to view your messages.
          </p>
        </main>
      </PageEnter>
    );
  }

  const conversations = await listConversations(30);

  // Fetch last message + other member name for each conversation
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("body, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conv.id);

      let otherName = conv.name;
      if (!otherName && members && members.length === 2) {
        const otherId = members.find((m: { user_id: string }) => m.user_id !== user.id)?.user_id;
        if (otherId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", otherId)
            .maybeSingle();
          otherName = profile?.username ?? "Unknown";
        }
      }

      return { ...conv, otherName, lastMsg };
    }),
  );

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <header className="mb-6 flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-fg">Messages</h1>
          <Link
            href="/messages/new"
            className="press ml-auto inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            New message
          </Link>
        </header>

        {enriched.length === 0 ? (
          <section className="rounded-lg border border-border bg-surface p-10 text-center">
            <p className="text-sm text-text-secondary">No conversations yet.</p>
          </section>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {enriched.map((conv) => (
              <li key={conv.id}>
                <Link
                  href={`/messages/${conv.id}`}
                  className="flex items-baseline gap-3 px-4 py-3 hover:bg-bg/50"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-fg">
                    {conv.otherName}
                  </span>
                  {conv.lastMsg && (
                    <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
                      {conv.lastMsg.body}
                    </span>
                  )}
                  {conv.lastMsg?.created_at && (
                    <time
                      dateTime={conv.lastMsg.created_at}
                      className="shrink-0 text-[10px] text-text-muted"
                    >
                      {new Date(conv.lastMsg.created_at).toLocaleDateString()}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PageEnter>
  );
}
