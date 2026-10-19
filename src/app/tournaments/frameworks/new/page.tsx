import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listGames } from "@/lib/games/service";
import { getCurrentUser } from "@/lib/auth/current-user";
import { FrameworkBuilder } from "@/components/tournaments/FrameworkBuilder";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Define a hosting format — G4M37Z Communities",
  description: "Define a custom tournament format with stages and progression rules.",
};

export default async function NewFrameworkPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const params = await searchParams;
  const { user, role } = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/tournaments/frameworks/new");
  }

  const supabase = await createClient();
  const games = await listGames(supabase, { limit: 100 });

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href="/tournaments/new"
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to create tournament
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-fg">
        Define a hosting format
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Define a competition pipeline — stages, points, and who advances.
        Bind it to a game so it shows up as that game&apos;s format during
        tournament creation. Admins can mark a format{" "}
        <strong>official</strong> — the game&apos;s engrained way of running
        events, whether that&apos;s an esports circuit or a roleplay-server
        format for non-competitive titles like GTA or Roblox.
      </p>
      <div className="mt-6">
        <FrameworkBuilder
          games={games.map((g) => ({ id: g.id, name: g.name }))}
          initialGameId={params.game ?? null}
          isAdmin={role === "admin"}
        />
      </div>
    </main>
  );
}
