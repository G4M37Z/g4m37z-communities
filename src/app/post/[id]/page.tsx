// src/app/post/[id]/page.tsx
// Single post view: image, body, author, community, edit/delete for owner.
// Comments placeholder for M5.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";
import { PostActions } from "./PostActions";
import type { Post } from "@/types/database";

export const dynamic = "force-dynamic";

type Params = { id: string };

interface JoinedPost extends Post {
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  community: { slug: string; name: string } | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("title, body")
    .eq("id", id)
    .maybeSingle();
  if (!post) return { title: "Post not found" };
  const p = post as { title: string; body: string | null };
  return {
    title: p.title,
    description: p.body?.slice(0, 160) ?? `Post on G4M37Z Communities.`,
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: postRaw } = await supabase
    .from("posts")
    .select(
      `id, community_id, author_id, title, body, image_url, created_at, updated_at,
       author:profiles!posts_author_id_fkey ( username, display_name, avatar_url ),
       community:communities!posts_community_id_fkey ( slug, name )`
    )
    .eq("id", id)
    .maybeSingle();

  if (!postRaw) notFound();
  const post = postRaw as unknown as JoinedPost;

  // Vote score + current user's vote
  const [
    { data: { user } },
    { data: votes },
    { count: commentCount },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("post_votes")
      .select("value")
      .eq("post_id", id),
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", id),
  ]);

  const score = ((votes ?? []) as { value: number }[]).reduce(
    (sum: number, v: { value: number }) => sum + v.value,
    0
  );

  const isOwner = Boolean(user && user.id === post.author_id);
  const updatedLabel =
    post.updated_at && post.updated_at !== post.created_at
      ? `edited ${timeAgo(post.updated_at)}`
      : null;

  return (
    <main className="container-x py-8 sm:py-10">
      <Link
        href={post.community ? `/communities/${post.community.slug}` : "/home"}
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted hover:text-fg"
      >
        <ArrowLeft size={14} />
        {post.community ? `Back to ${post.community.name}` : "Back"}
      </Link>

      <article className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <header className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
            {post.community && (
              <>
                <Link
                  href={`/communities/${post.community.slug}`}
                  className="font-semibold text-fg hover:text-accent"
                >
                  {post.community.name}
                </Link>
                <span aria-hidden="true">·</span>
              </>
            )}
            {post.author && (
              <Link
                href={`/profile/${post.author.username}`}
                className="hover:text-fg"
              >
                @{post.author.username}
              </Link>
            )}
            <span aria-hidden="true">·</span>
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
            {updatedLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span>{updatedLabel}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-black leading-tight text-fg sm:text-3xl">
            {post.title}
          </h1>
        </header>

        {post.image_url && (
          <div className="mb-4 overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image_url}
              alt=""
              className="block w-full object-cover"
            />
          </div>
        )}

        {post.body && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
            {post.body}
          </div>
        )}

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <span aria-label={`${score} score`}>
              <strong className="text-fg">{score}</strong>{" "}
              {score === 1 ? "point" : "points"}
            </span>
            <span id="comments" className="inline-flex items-center gap-1">
              <MessageSquare size={14} />
              {commentCount ?? 0}{" "}
              {commentCount === 1 ? "comment" : "comments"}
            </span>
          </div>
          {isOwner && <PostActions post={post} />}
        </footer>
      </article>

      {/* Comments placeholder — Milestone 5 will replace this. */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-base font-bold text-fg">Comments</h2>
        <p className="text-sm text-text-muted">
          Comments arrive in Milestone 5. The post above is fully usable now.
        </p>
      </section>
    </main>
  );
}