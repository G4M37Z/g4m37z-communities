import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMessages, isConversationMember } from "@/lib/messaging/service";
import { PageEnter } from "@/components/PageEnter";
import { MessageForm } from "./MessageForm";
import { ThreadLive } from "./ThreadLive";

export const dynamic = "force-dynamic";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
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
            <Link href="/login?next=/messages" className="underline text-accent-text">
              Sign in
            </Link>{" "}
            to view messages.
          </p>
        </main>
      </PageEnter>
    );
  }

  // Membership is the authorization check, not "are there messages". A member
  // with an empty thread (e.g. a first send that failed) still gets a usable
  // composer; a non-member gets 404. RLS returns [] for non-members, so
  // emptiness alone cannot distinguish the two.
  const isMember = await isConversationMember(conversationId);
  if (!isMember) notFound();

  const messages = await listMessages(conversationId, 1);

  const senderIds = [...new Set(messages.map((m) => m.sender_id).filter(Boolean))] as string[];
  const profiles = new Map<string, string>();
  if (senderIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", senderIds);
    (data ?? []).forEach((p: { id: string; username: string }) =>
      profiles.set(p.id, p.username),
    );
  }

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <header className="mb-4 flex items-center gap-3">
          <Link href="/messages" className="text-sm text-accent-text hover:text-accent-text-hover">
            ← Back
          </Link>
        </header>

        <ThreadLive conversationId={conversationId} />

        {messages.length === 0 && (
          <p className="mb-4 text-center text-sm text-text-muted">
            No messages yet — say hello.
          </p>
        )}

        <ul className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`flex gap-2 ${m.sender_id === user.id ? "justify-end" : ""}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  m.sender_id === user.id
                    ? "bg-accent text-white"
                    : "border border-border bg-surface text-fg"
                }`}
              >
                {m.sender_id !== user.id && (
                  <p className="mb-0.5 text-[10px] font-semibold text-text-muted">
                    {profiles.get(m.sender_id ?? "") ?? "Unknown"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {m.created_at && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
                    <time dateTime={m.created_at}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    {m.sender_id === user.id && (
                      <span title={m.read ? "Read" : "Sent"}>
                        {m.read ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <MessageForm conversationId={conversationId} />
      </main>
    </PageEnter>
  );
}
