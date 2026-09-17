import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listConversations, getUnreadCounts } from "@/lib/messaging/service";
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
            <Link href="/login?next=/messages" className="underline text-accent-text hover:text-accent-text-hover">
              Sign in
            </Link>{" "}
            to view your messages.
          </p>
        </main>
      </PageEnter>
    );
  }

  const conversations = await listConversations(30);
  const unreadCounts = await getUnreadCounts();

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
      let otherAvatar: string | null = null;
      if (!otherName && members && members.length >= 1) {
        const otherId = members.find((m: { user_id: string }) => m.user_id !== user.id)?.user_id ?? members[0]?.user_id;
        if (otherId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("id", otherId)
            .maybeSingle();
          otherName = profile?.display_name ?? profile?.username ?? "Unknown";
          otherAvatar = profile?.avatar_url ?? null;
        }
      }

      return { ...conv, otherName, otherAvatar, lastMsg };
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
                  className="flex items-center gap-3 px-4 py-4 hover:bg-bg/50 transition-colors"
                >
                  {conv.otherAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={conv.otherAvatar}
                      alt={conv.otherName ?? "User"}
                      className="h-10 w-10 shrink-0 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-bold text-fg">
                      {(conv.otherName ?? "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className="truncate text-sm font-semibold text-fg">
                        {conv.otherName}
                      </span>
                      {conv.lastMsg?.created_at && (
                        <time
                          dateTime={conv.lastMsg.created_at}
                          className="shrink-0 text-[10px] text-text-muted"
                        >
                          {new Date(conv.lastMsg.created_at).toLocaleDateString()}
                        </time>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between">
                      {conv.lastMsg ? (
                        <span className="truncate text-xs text-text-muted">
                          {conv.lastMsg.body}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted italic">No messages yet</span>
                      )}
                      {(unreadCounts.get(conv.id) ?? 0) > 0 && (
                        <span
                          aria-label={`${unreadCounts.get(conv.id)} unread messages`}
                          className="ml-2 shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white"
                        >
                          {unreadCounts.get(conv.id)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PageEnter>
  );
}
