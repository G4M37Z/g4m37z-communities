// src/components/post/PostCard.tsx — responsive composition via container query
import Link from "next/link";
import { MessageSquare, Image as ImageIcon } from "lucide-react";
import type { Post } from "@/types/database";
import { timeAgo } from "@/lib/utils";
import { PostVoteControl } from "@/components/voting/PostVoteControl";
import { EmojiPicker } from "@/components/emoji-picker";

export interface PostCardData extends Post {
  author: { username: string; display_name: string | null; avatar_url: string | null } | null;
  community: { slug: string; name: string } | null;
  comment_count: number;
  score: number;
  my_vote?: 1 | -1 | null;
  signed_in?: boolean;
}

interface Props { post: PostCardData; }

export function PostCard({ post }: Props) {
  return (
    <article className="post-card-container rounded-lg border border-border bg-surface transition-colors hover:border-border-strong hover:bg-surface-subtle">
      <div className="post-card-inner flex gap-3 p-4">
        {post.signed_in ? (
          <PostVoteControl postId={post.id} initialScore={post.score} initialVote={post.my_vote ?? null} variant="compact" />
        ) : (
          <div className="flex flex-col items-center gap-0.5 text-xs text-text-muted" aria-label={`Score ${post.score}`}>
            <span className="h-6 w-6" />
            <span className="min-w-[1.5rem] text-center font-bold text-fg">{post.score}</span>
            <span className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            {post.community && (
              <><Link href={`/communities/${post.community.slug}`} className="font-semibold text-fg hover:text-accent">{post.community.name}</Link><span aria-hidden="true">·</span></>
            )}
            {post.author && (
              <Link href={`/profile/${post.author.username}`} className="hover:text-fg">@{post.author.username}</Link>
            )}
            <span aria-hidden="true">·</span>
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          </header>
          <h2 className="mb-1.5 text-base font-bold leading-snug text-fg">
            <Link href={`/post/${post.id}`} className="hover:text-accent">{post.title}</Link>
          </h2>
          {post.body && <p className="line-clamp-2 text-sm text-text-secondary">{post.body}</p>}
          {post.image_url && (
            <div className="mt-3 overflow-hidden rounded-md border border-border">
              <img src={post.image_url} alt="" className="block max-h-72 w-full object-cover" />
            </div>
          )}
          <footer className="mt-3 flex items-center gap-4 text-xs text-text-muted">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(window.location.origin + `/post/${post.id}`); }} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-fg" aria-label="Copy link to share">Share</button>
            <Link href={`/post/${post.id}#comments`} className="inline-flex items-center gap-1 hover:text-fg"><MessageSquare size={12} />{post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}</Link>
          </footer>
        </div>
      </div>
    </article>
  );
}
