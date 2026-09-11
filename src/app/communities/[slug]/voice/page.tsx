// src/app/communities/[slug]/voice/page.tsx
// Community voice rooms — list active rooms and create new ones.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Mic } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCommunityContext } from "@/lib/community-service";
import { listVoiceRooms, countRoomParticipants } from "@/lib/voice/queries";
import { CreateVoiceRoomForm } from "./CreateVoiceRoomForm";

export const dynamic = "force-dynamic";

export default async function CommunityVoicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/communities/${slug}/voice`);

  const ctx = await getCommunityContext(slug, user.id);
  if (!ctx.community) notFound();

  const { data: rooms } = await listVoiceRooms(ctx.community.id);

  const roomParticipants = await Promise.all(
    rooms.map(async (room) => ({
      roomId: room.id,
      count: await countRoomParticipants(room.id),
    })),
  );
  const countById = Object.fromEntries(roomParticipants.map((r) => [r.roomId, r.count]));

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href={`/communities/${slug}`}
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to {ctx.community.name}
      </Link>
      <h1 className="mb-1 mt-3 flex items-center gap-2 text-2xl font-black tracking-[-0.03em] text-fg">
        <Mic size={20} className="text-accent" /> Voice Rooms
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        Live audio rooms for {ctx.community.name}. Join a room to speak.
      </p>

      {ctx.canModerate && <CreateVoiceRoomForm communityId={ctx.community.id} />}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {rooms.length === 0 && (
          <p className="text-sm text-text-muted">
            No active voice rooms right now.
          </p>
        )}
        {rooms.map((room) => (
          <Link
            key={room.id}
            href={`/voice/${room.id}`}
            className="group rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-fg group-hover:text-accent">
                {room.name}
              </h3>
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <span className="h-2 w-2 rounded-full bg-success" />
                {countById[room.id] ?? 0}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              {room.is_locked ? "Locked · " : ""}Created{" "}
              {new Date(room.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}