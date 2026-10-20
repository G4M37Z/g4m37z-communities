import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  listConversations,
  type ConversationBucket,
} from "@/lib/messaging/service";
import {
  archiveConversationAction,
} from "@/lib/messaging/actions";
import { PageEnter } from "@/components/PageEnter";
import { MessagesLive } from "@/components/messages/MessagesLive";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export const dynamic = "force-dynamic";

interface EnrichedConversation {
  id: string;
  type: string | null;
  name: string | null;
  otherName: string;
  otherAvatar: string | null;
  otherVerified: boolean;
  lastMsg: {
    body: string | null;
    created_at: string;
    attachment_type: string | null;
  } | null;
}

async function loadBucket(bucket: ConversationBucket) {
  const supabase = await createClient();
  const conversations = await listConversations(30, bucket);
  if (conversations.length === 0) return [] as EnrichedConversation[];

  // Fetch last message + other member's profile for each conversation.
  // conversation_members SELECT is RLS-scoped to the caller, so the counterpart
  // is fetched via get_conversation_partner (SECURITY DEFINER, migration 041).
  // Soft-deleted rows (055) never surface as previews.
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("body, created_at, attachment_type")
        .eq("conversation_id", conv.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: partner } = await supabase.rpc("get_conversation_partner", {
        p_conv_id: conv.id,
      });

      const other = Array.isArray(partner) ? partner[0] : null;
      const otherName = conv.name ?? other?.display_name ?? other?.username ?? "Unknown";

      return {
        ...conv,
        otherName,
        otherAvatar: other?.avatar_url ?? null,
        otherVerified: Boolean(
          conv.name
            ? false // group conversations use the community name, no account
            : other?.verified ?? false,
        ),
        lastMsg: lastMsg as EnrichedConversation["lastMsg"],
      };
    }),
  );
  return enriched;
}

function ConversationRow({
  conv,
  unread,
  archived,
}: {
  conv: EnrichedConversation;
  unread: number;
  archived: boolean;
}) {
  return (
    <li className="flex items-center">
      <Link
        href={`/messages/${conv.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 transition-colors hover:bg-bg/50"
      >
        {conv.otherAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={conv.otherAvatar}
            alt={conv.otherName ?? "User"}
            className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-bold text-fg">
            {(conv.otherName ?? "U").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-baseline justify-between">
            <span className="truncate text-sm font-semibold text-fg">
              {conv.otherName}
              {conv.otherVerified && <VerifiedBadge size={13} className="ml-0.5" />}
            </span>
            {conv.lastMsg?.created_at && (
              <time dateTime={conv.lastMsg.created_at} className="shrink-0 text-[10px] text-text-muted">
                {new Date(conv.lastMsg.created_at).toLocaleDateString()}
              </time>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            {conv.lastMsg ? (
              <span className="truncate text-xs text-text-muted">
                {conv.lastMsg.body ||
                  (conv.lastMsg.attachment_type === "call"
                    ? "📞 Call"
                    : conv.lastMsg.attachment_type === "sticker"
                      ? "Sticker"
                      : conv.lastMsg.attachment_type === "gif"
                        ? "GIF"
                        : "📷 Photo")}
              </span>
            ) : (
              <span className="text-xs italic text-text-muted">No messages yet</span>
            )}
            {unread > 0 && (
              <span
                aria-label={`${unread} unread messages`}
                className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white"
              >
                {unread}
              </span>
            )}
          </div>
          {archived && (
            <span className="text-[10px] italic text-text-muted">Archived</span>
          )}
        </div>
      </Link>
      <form action={archiveConversationAction} className="pr-3">
        <input type="hidden" name="conversationId" value={conv.id} />
        <input type="hidden" name="to" value={archived ? "active" : "archived"} />
        <button
          type="submit"
          className="press rounded-md px-2 py-1 text-[11px] font-semibold text-text-muted transition-colors hover:bg-surface hover:text-fg"
          aria-label={archived ? `Unarchive conversation with ${conv.otherName}` : `Archive conversation with ${conv.otherName}`}
        >
          {archived ? "Unarchive" : "Archive"}
        </button>
      </form>
    </li>
  );
}

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

  const [active, archived] = await Promise.all([
    loadBucket("active"),
    loadBucket("archived"),
  ]);

  const supabase2 = await createClient();
  const { data: unreadRows } = await supabase2.rpc("get_unread_counts");
  const unreadCounts = new Map<string, number>(
    ((unreadRows ?? []) as { conversation_id: string; unread_count: number }[]).map((r) => [
      r.conversation_id,
      Number(r.unread_count ?? 0),
    ]),
  );

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        {/* Live layer: reconciles badges while the list sits open (poll +
            realtime), router.refresh() when server truth drifts. */}
        <MessagesLive />

        <header className="mb-6 flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-fg">Messages</h1>
          <Link
            href="/messages/new"
            className="press ml-auto inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            New message
          </Link>
        </header>

        {active.length === 0 && archived.length === 0 ? (
          <section className="card p-10 text-center">
            <p className="mb-4 text-sm text-text-secondary">No conversations yet.</p>
            <Link
              href="/messages/new"
              className="press inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Start a conversation
            </Link>
          </section>
        ) : active.length === 0 ? (
          <p className="mb-6 text-sm text-text-secondary">
            No active conversations — archived ones are below.
          </p>
        ) : (
          <ul className="card divide-y divide-border">
            {active.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                unread={unreadCounts.get(conv.id) ?? 0}
                archived={false}
              />
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer select-none text-sm font-semibold text-text-secondary hover:text-fg">
              Archived ({archived.length})
            </summary>
            <ul className="card mt-3 divide-y divide-border opacity-80">
              {archived.map((conv) => (
                <ConversationRow key={conv.id} conv={conv} unread={0} archived />
              ))}
            </ul>
          </details>
        )}
      </main>
    </PageEnter>
  );
}
