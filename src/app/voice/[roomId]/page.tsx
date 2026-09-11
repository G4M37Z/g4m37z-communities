// src/app/voice/[roomId]/page.tsx
// Live voice room — fetches room + participants, renders the client view.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getVoiceRoom, listRoomParticipants } from "@/lib/voice/queries";
import { VoiceRoomView } from "@/components/voice-room-view";

export const dynamic = "force-dynamic";

export default async function VoiceRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/voice/${roomId}`);

  const room = await getVoiceRoom(roomId);
  if (!room) notFound();
  if (!room.is_active) notFound();

  const participants = await listRoomParticipants(roomId);

  return (
    <main className="container-x max-w-4xl py-8 pb-20">
      <Link
        href={`/communities/${room.community?.slug ?? ""}/voice`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted hover:text-fg"
      >
        <ArrowLeft size={14} />
        {room.community?.name ? `Back to ${room.community.name}` : "Back to voice rooms"}
      </Link>

      <h1 className="mb-1 text-2xl font-black tracking-[-0.03em] text-fg">
        {room.name}
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        {room.community?.name ?? "Community voice room"}
      </p>

      <VoiceRoomView
        roomId={room.id}
        communitySlug={room.community?.slug ?? ""}
        currentUserId={user.id}
        initialParticipants={participants}
      />
    </main>
  );
}