// src/components/post/PostCard.tsx — responsive composition via container query
import Link from "next/link";
import { MessageSquare, Image as ImageIcon, Repeat2 } from "lucide-react";
import type { Post } from "@/types/database";
import { timeAgo } from "@/lib/utils";
import { PostVoteControl } from "@/components/voting/PostVoteControl";
import { ShareButton } from "@/components/post/ShareButton";
import { BookmarkButton } from "@/components/post/BookmarkButton";
import { RepostButton } from "@/components/post/RepostButton";
import { PollView as PollViewComponent } from "@/components/polls/PollView";
import type { PollView } from "@/lib/polls/service";

export interface PostCardData extends Post {  author: { username: string; display_name: string | null; avatar_url: string | null } | null;  community: { slug: string; name: string } | null;  comment_count: number;  score: number;  my_vote?: 1 | -1 | null;  signed_in?: boolean;  bookmarked?: boolean;    repost_count?: number;
  reposted?: boolean;
  reposted_by?: { username: string; comment: string | null; at: string } | null;
  poll?: PollView | null;
}

interface Props { post: PostCardData; }

export function PostCard({ post }: Props) {
  return (
    <article className="post-card-container rounded-lg border border-border bg-surface transition-colors hover:border-border-strong hover:bg-surface-subtle">
      {/* Rhythm: every card uses p-5 on ≥sm and p-4 on mobile; media locks to
          16/10 so image cards and text cards share one vertical cadence. */}
      <div className="post-card-inner flex gap-3 p-4 sm:p-5">
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
          {post.reposted_by && (
            <p className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-text-muted">
              <Repeat2 size={12} className="text-accent-text" />
              <Link
                href={`/profile/${post.reposted_by.username}`}
                className="font-semibold text-fg hover:text-accent-text"
              >
                @{post.reposted_by.username}
              </Link>
              <span>reposted</span>
            </p>
          )}
          <header className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            {post.community && (
              <><Link href={`/communities/${post.community.slug}`} className="font-semibold text-fg hover:text-accent-text">{post.community.name}</Link><span aria-hidden="true">·</span></>
            )}
            {post.author && (
              <Link href={`/profile/${post.author.username}`} className="hover:text-fg">@{post.author.username}</Link>
            )}
            <span aria-hidden="true">·</span>
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          </header>
          {post.reposted_by?.comment && (
            <p className="mb-1.5 text-sm italic text-text-secondary">
              &ldquo;{post.reposted_by.comment}&rdquo;
            </p>
          )}
          <h2 className="mb-1.5 text-base font-bold leading-snug text-fg">
            <Link href={`/post/${post.id}`} className="hover:text-accent-text">{post.title}</Link>
          </h2>
          {post.body && <p className="line-clamp-2 text-sm text-text-secondary">{post.body}</p>}
          {post.image_url && (
            <div className="mt-3 overflow-hidden rounded-md border border-border">
              {/* 16/10 fixed ratio keeps feed cards a consistent height; the
                  image center-crops instead of stretching the card. */}
              <img
                src={post.image_url}
                alt=""
                loading="lazy"
                className="block aspect-[16/10] w-full object-cover"
              />
            </div>
          )}
          {post.poll && (
            <div className="mt-3">
              <PollViewComponent poll={post.poll} signedIn={Boolean(post.signed_in)} postId={post.id} />
            </div>
          )}
          <footer className="mt-3 flex items-center gap-4 text-xs text-text-muted">
            <ShareButton postId={post.id} title={post.title} />
            <RepostButton postId={post.id} initialReposted={post.reposted ?? false} initialCount={post.repost_count ?? 0} signedIn={Boolean(post.signed_in)} />
            <Link href={`/post/${post.id}#comments`} className="inline-flex items-center gap-1 hover:text-fg"><MessageSquare size={12} />{post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}</Link>
            <BookmarkButton postId={post.id} initialSaved={post.bookmarked ?? false} signedIn={Boolean(post.signed_in)} />
          </footer>
        </div>
      </div>
    </article>
  );
}
