// src/app/post/[id]/page.tsx
// Single post view: image, body, author, community, post vote control,
// threaded comments with reply/edit/delete/vote.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";
import { PostActions } from "./PostActions";
import { PostVoteControl } from "@/components/voting/PostVoteControl";
import { CommentForm } from "@/components/comments/CommentForm";
import { ReportButton } from "@/components/ReportButton";
import { RealtimeComments } from "@/components/comments/RealtimeComments";
import { getCommentThread } from "@/lib/comments/queries";
import type { Post } from "@/types/database";

export const dynamic = "force-dynamic";

type Params = { id: string };

interface JoinedPost extends Post {
  comment_count: number;
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
    .select("title, body, image_url, community:communities!posts_community_id_fkey ( name )")
    .eq("id", id)
    .maybeSingle();
  if (!post) return { title: "Post not found" };
  const p = post as {
    title: string;
    body: string | null;
    image_url: string | null;
    community: { name: string } | { name: string }[] | null;
  };
  const communityName = Array.isArray(p.community) ? p.community[0]?.name : p.community?.name;
  const description =
    p.body?.slice(0, 160) ??
    `Post on G4M37Z Communities${communityName ? ` in ${communityName}` : ""}.`;
  const ogImage = p.image_url ?? "/icon.svg";
  return {
    title: p.title,
    description,
    openGraph: {
      title: p.title,
      description,
      type: "article",
      siteName: "G4M37Z Communities",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: p.title,
      description,
      images: [ogImage],
    },
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
      `id, community_id, author_id, title, body, image_url, created_at, updated_at, comment_count,
       author:profiles!posts_author_id_fkey ( username, display_name, avatar_url ),
       community:communities!posts_community_id_fkey ( slug, name )`
    )
    .eq("id", id)
    .maybeSingle();

  if (!postRaw) notFound();
  const post = postRaw as unknown as JoinedPost;

  // Fetch score, current user's vote, and the comment thread in parallel.
  const [
    { data: { user } },
    { data: votes },
    thread,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("post_votes")
      .select("value")
      .eq("post_id", id),
    getCommentThread(id, null),
  ]);

  const score = ((votes ?? []) as { value: number }[]).reduce(
    (sum: number, v: { value: number }) => sum + v.value,
    0
  );

  // Current user's vote on this post (for optimistic UI).
  let myPostVote: 1 | -1 | null = null;
  if (user) {
    const { data: myPostVoteRow } = await supabase
      .from("post_votes")
      .select("value")
      .eq("post_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (myPostVoteRow) {
      const v = (myPostVoteRow as { value: number }).value;
      myPostVote = v === 1 ? 1 : v === -1 ? -1 : null;
    }
  }

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
        <div className="flex gap-4">
          {user ? (
            <PostVoteControl
              postId={post.id}
              initialScore={score}
              initialVote={myPostVote}
            />
          ) : (
            <div
              className="flex flex-col items-center gap-0.5 text-xs text-text-muted"
              aria-label={`Score ${score}`}
            >
              <span className="h-7 w-7" />
              <span className="min-w-[1.5rem] text-center font-bold text-fg">
                {score}
              </span>
              <span className="h-7 w-7" />
            </div>
          )}

          <div className="min-w-0 flex-1">
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
                <span id="comments" className="inline-flex items-center gap-1">
                  <MessageSquare size={14} />
                  {post.comment_count ?? 0}{" "}
                  {post.comment_count === 1 ? "comment" : "comments"}
                </span>
                {user && user.id !== post.author_id && (
                  <ReportButton targetType="post" targetId={post.id} />
                )}
              </div>
              {isOwner && <PostActions post={post} />}
            </footer>
          </div>
        </div>
      </article>

      {/* Comment thread */}
      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold text-fg">
          Comments ({post.comment_count ?? 0})
        </h2>

        {user ? (
          <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
            <CommentForm postId={post.id} mode="create" />
          </div>
        ) : (
          <div className="mb-4 rounded-2xl border border-border bg-surface p-4 text-center">
            <p className="text-sm text-text-muted">
              <Link
                href={`/login?next=/post/${post.id}`}
                className="font-semibold text-accent hover:underline"
              >
                Sign in
              </Link>{" "}
              to leave a comment.
            </p>
          </div>
        )}

        <RealtimeComments
          postId={post.id}
          initialComments={thread}
          currentUserId={user?.id ?? null}
        />
      </section>
    </main>
  );
}