// src/app/search/page.tsx
// Federated search across communities, posts, and users.
// Public route — anyone can read.

import Link from "next/link";
import { Users, MessageSquare, Hash, Search as SearchIcon } from "lucide-react";
import { searchAll } from "@/lib/search/queries";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search — G4M37Z Communities",
  description: "Search communities, posts, and users on G4M37Z.",
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length > 0 ? await searchAll(query) : null;
  const totalHits = results
    ? results.communities.length +
      results.posts.length +
      results.users.length
    : 0;

  return (
    <main className="container-x py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">
          Search
        </h1>
        <form
          role="search"
          action="/search"
          method="get"
          className="mt-4 flex max-w-2xl items-center overflow-hidden rounded-md border border-border bg-bg focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30"
        >
          <SearchIcon
            size={16}
            className="ml-3 shrink-0 text-text-muted"
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search communities, posts, or users…"
            autoFocus
            className="h-11 w-full bg-transparent px-3 text-sm text-fg placeholder:text-text-muted focus:outline-none"
          />
          <button
            type="submit"
            className="h-11 shrink-0 bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Search
          </button>
        </form>
        {query.length > 0 && (
          <p className="mt-2 text-sm text-text-muted">
            {totalHits > 0
              ? `${totalHits} ${totalHits === 1 ? "result" : "results"} for "${query}"`
              : `No results for "${query}"`}
          </p>
        )}
      </header>

      {!results && (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <SearchIcon size={32} className="mx-auto mb-4 text-text-muted" />
          <h2 className="mb-1 text-base font-bold text-fg">
            Search G4M37Z Communities
          </h2>
            <p className="mx-auto max-w-md text-sm text-text-muted">
              Find communities by name or topic, posts by title or body, and
              users by username.
            </p>
        </div>
      )}

      {results && totalHits === 0 && (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <SearchIcon size={32} className="mx-auto mb-4 text-text-muted" />
          <h2 className="mb-1 text-base font-bold text-fg">No results</h2>
          <p className="mx-auto max-w-md text-sm text-text-muted">
            Try a different word, or check your spelling. Search is
            case-insensitive and matches partial words.
          </p>
        </div>
      )}

      {results && (
        <div className="space-y-8">
          {results.communities.length > 0 && (
            <ResultSection title="Communities" icon={<Hash size={16} />}>
              <ul className="space-y-3">
                {results.communities.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/communities/${c.slug}`}
                      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-base font-bold text-fg">
                          {c.name}
                        </h3>
                        <span className="text-xs text-text-muted">
                          /{c.slug}
                        </span>
                      </div>
                      {c.description && (
                        <p className="line-clamp-2 text-sm text-text-muted">
                          {c.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-text-muted">
                        <Users size={11} className="inline" />{" "}
                        {c.member_count}{" "}
                        {c.member_count === 1 ? "member" : "members"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {results.posts.length > 0 && (
            <ResultSection title="Posts" icon={<MessageSquare size={16} />}>
              <ul className="space-y-3">
                {results.posts.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/post/${p.id}`}
                      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
                    >
                      <h3 className="text-base font-bold text-fg">{p.title}</h3>
                      {p.body && (
                        <p className="mt-1 line-clamp-2 text-sm text-text-muted">
                          {p.body}
                        </p>
                      )}
                      <p className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                        {p.community && (
                          <>
                            <span className="font-semibold text-fg">
                              {p.community.name}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        {p.author && (
                          <>
                            <span>@{p.author.username}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{timeAgo(p.created_at)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{p.score} points</span>
                        <span aria-hidden="true">·</span>
                        <span>{p.comment_count} comments</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {results.users.length > 0 && (
            <ResultSection title="Users" icon={<Users size={16} />}>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {results.users.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/profile/${u.username}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
                    >
                      <span
                        className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-sm font-black text-accent"
                        aria-hidden="true"
                      >
                        {u.username.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-fg">
                          @{u.username}
                        </p>
                        {u.display_name && (
                          <p className="truncate text-xs text-text-muted">
                            {u.display_name}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}
        </div>
      )}
    </main>
  );
}

function ResultSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}