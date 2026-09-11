import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageEnter } from "@/components/PageEnter";

export const dynamic = "force-dynamic";

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("user_id, display_name, bio, verified, follower_count, total_content, created_at")
    .eq("user_id", id)
    .maybeSingle();

  if (!creator) notFound();

  const { data: content } = await supabase
    .from("creator_content")
    .select("id, content_type, title, game_id, published, view_count, created_at")
    .eq("creator_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20 max-w-2xl">
        <Link href="/creators" className="mb-4 inline-block text-sm text-accent hover:text-accent-hover">
          ← All creators
        </Link>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-fg">
            {creator.display_name}
            {creator.verified && <span className="ml-2 text-accent">✓</span>}
          </h1>
          {creator.bio && (
            <p className="mt-2 text-sm text-text-secondary">{creator.bio}</p>
          )}
          <dl className="mt-4 flex gap-6 text-xs text-text-muted">
            <div>
              <dt>Followers</dt>
              <dd className="text-sm font-semibold text-fg">{creator.follower_count}</dd>
            </div>
            <div>
              <dt>Content</dt>
              <dd className="text-sm font-semibold text-fg">{creator.total_content}</dd>
            </div>
            <div>
              <dt>Since</dt>
              <dd className="text-sm text-fg">
                {new Date(creator.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </header>

        <section>
          <h2 className="text-lg font-semibold text-fg mb-3">Recent content</h2>
          {content && content.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {content.map((c: { id: string; content_type: string; title: string; game_id: string | null; published: boolean; view_count: number; created_at: string }) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 truncate text-sm text-fg">{c.title}</span>
                  <div className="flex shrink-0 items-center gap-3 text-[10px] text-text-muted">
                    <span className="uppercase">{c.content_type}</span>
                    {c.published ? (
                      <span className="text-green">published</span>
                    ) : (
                      <span className="text-text-muted">draft</span>
                    )}
                    <span>{c.view_count} views</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No content yet.</p>
          )}
        </section>
      </main>
    </PageEnter>
  );
}
