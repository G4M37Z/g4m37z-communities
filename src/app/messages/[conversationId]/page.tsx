import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMessages, isConversationMember, getReadState } from "@/lib/messaging/service";
import { getCallContext } from "@/lib/messaging/calls";
import { PageEnter } from "@/components/PageEnter";
import { DmCall } from "@/components/dm-call";
import { ThreadLive } from "./ThreadLive";
import { ThreadClient } from "./ThreadClient";

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

  // Receipts (046): the partner's last_read_at turns the sender's ✓✓ blue.
  // conversation_members RLS hides the partner's row, so this comes from the
  // SECURITY DEFINER RPC instead of a client-side join.
  const readState = await getReadState(conversationId);

  // Call affordance (GAP-MSG-CALL-01): only direct conversations can be
  // called. The partner identity and any in-flight call render server-side;
  // live call state takes over in the client component.
  const callContext = await getCallContext(conversationId);

  const senderIds = [...new Set(messages.map((m) => m.sender_id).filter(Boolean))] as string[];
  const profiles = new Map<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  >();
  if (senderIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", senderIds);
    (data ?? []).forEach(
      (p: { id: string; username: string; display_name: string | null; avatar_url: string | null }) =>
        profiles.set(p.id, p),
    );
  }

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <header className="mb-4 flex items-center gap-3">
          <Link href="/messages" className="text-sm text-accent-text hover:text-accent-text-hover">
            ← Back
          </Link>
          {callContext.isDirect && callContext.partner && (
            <div className="ml-auto">
              <DmCall
                conversationId={conversationId}
                currentUserId={user.id}
                partner={callContext.partner}
                initialCall={callContext.activeCall}
              />
            </div>
          )}
        </header>

        <ThreadLive conversationId={conversationId} />

        <ThreadClient
          conversationId={conversationId}
          currentUserId={user.id}
          initialMessages={messages}
          profiles={profiles}
          readState={readState}
        />
      </main>
    </PageEnter>
  );
}
