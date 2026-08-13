// src/components/post/PostCard.tsx
// Reusable post card used in feeds (home, community page, profile pages).
// Server-rendered — no client state. Author + community links, vote controls
// placeholder for M5.

import Link from "next/link";
import { MessageSquare, Image as ImageIcon } from "lucide-react";
import type { Post } from "@/types/database";
import { timeAgo } from "@/lib/utils";

export interface PostCardData extends Post {
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  community: {
    slug: string;
    name: string;
  } | null;
  comment_count: number;
  score: number;
}

interface Props {
  post: PostCardData;
}

export function PostCard({ post }: Props) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/60">
      {/* Community + author meta */}
      <header className="mb-2 flex items-center gap-2 text-xs text-text-muted">
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
      </header>

      {/* Title */}
      <h2 className="mb-1.5 text-base font-bold leading-snug text-fg">
        <Link
          href={`/post/${post.id}`}
          className="hover:text-accent"
        >
          {post.title}
        </Link>
      </h2>

      {/* Body preview (truncated) */}
      {post.body && (
        <p className="line-clamp-2 text-sm text-text-muted">{post.body}</p>
      )}

      {/* Image thumbnail */}
      {post.image_url && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          {/* User-uploaded image — no known dimensions for next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url}
            alt=""
            className="block max-h-72 w-full object-cover"
          />
        </div>
      )}

      {/* Footer: score + comments + image badge */}
      <footer className="mt-3 flex items-center gap-4 text-xs text-text-muted">
        <span aria-label={`${post.score} score`}>
          <strong className="text-fg">{post.score}</strong>{" "}
          {post.score === 1 ? "point" : "points"}
        </span>
        <Link
          href={`/post/${post.id}#comments`}
          className="inline-flex items-center gap-1 hover:text-fg"
        >
          <MessageSquare size={12} />
          {post.comment_count}{" "}
          {post.comment_count === 1 ? "comment" : "comments"}
        </Link>
        {post.image_url && (
          <span className="inline-flex items-center gap-1">
            <ImageIcon size={12} />
            image
          </span>
        )}
      </footer>
    </article>
  );
}