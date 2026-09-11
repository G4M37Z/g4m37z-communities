import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMessages } from "@/lib/messaging/service";
import { PageEnter } from "@/components/PageEnter";
import { MessageForm } from "./MessageForm";

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
            <Link href="/login?next=/messages" className="underline text-accent">
              Sign in
            </Link>{" "}
            to view messages.
          </p>
        </main>
      </PageEnter>
    );
  }

  const messages = await listMessages(conversationId, 1);
  if (!messages.length) notFound();

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
          <Link href="/messages" className="text-sm text-accent hover:text-accent-hover">
            ← Back
          </Link>
        </header>

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
                  <time
                    dateTime={m.created_at}
                    className="mt-1 block text-[10px] opacity-60"
                  >
                    {new Date(m.created_at).toLocaleTimeString()}
                  </time>
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
