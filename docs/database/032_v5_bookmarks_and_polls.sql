-- ===================================================================
-- 032_v5_bookmarks_and_polls.sql
-- V5 additive schema (idempotent, safe, preserves all V4 data):
--
--   bookmarks  — private saved-content (user_id, post_id) pairs.
--   polls      — poll content type attached to posts via
--                posts.poll_id FK so feeds/detail render uniformly.
--   poll_options / poll_votes — one vote per user per poll enforced by
--                UNIQUE (poll_id, user_id); vote rows carry the chosen
--                option so results/percentages come from real data.
--
-- RLS:
--   bookmarks: strictly private — SELECT/INSERT/DELETE only where
--              user_id = auth.uid(). No public read, ever.
--   polls/poll_options/poll_votes: read via the owning post's visibility
--              (posts RLS already gates SELECT; polls inherit through
--              the posts join in app queries). Votes writable only by
--              the voter; poll/options writable only by the poll creator
--              at creation time (INSERT requires created_by = auth.uid()).
-- ===================================================================

-- ---------------------------------------------------------------
-- 1. Bookmarks (private saved content)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookmarks (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.posts(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_post ON public.bookmarks(post_id);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bookmarks_select ON public.bookmarks;
CREATE POLICY bookmarks_select ON public.bookmarks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS bookmarks_insert ON public.bookmarks;
CREATE POLICY bookmarks_insert ON public.bookmarks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS bookmarks_delete ON public.bookmarks;
CREATE POLICY bookmarks_delete ON public.bookmarks
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 2. Polls — attached to posts via posts.poll_id
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  question   TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 300),
  multiple   BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_polls_post ON public.polls(post_id);
CREATE INDEX IF NOT EXISTS idx_polls_expires ON public.polls(expires_at);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

-- One poll per post, enforced at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS uq_polls_post ON public.polls(post_id);

DROP POLICY IF EXISTS polls_select ON public.polls;
CREATE POLICY polls_select ON public.polls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = polls.post_id
        AND (
          p.community_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.communities c
            WHERE c.id = p.community_id
              AND (c.is_private = false OR c.creator_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.community_members cm
                              WHERE cm.community_id = c.id AND cm.user_id = auth.uid()))
          )
        )
    )
  );

DROP POLICY IF EXISTS polls_insert ON public.polls;
CREATE POLICY polls_insert ON public.polls
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS polls_delete ON public.polls;
CREATE POLICY polls_delete ON public.polls
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.author_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------
-- 3. Poll options
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label      TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  position   SMALLINT NOT NULL CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON public.poll_options(poll_id, position);

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_options_select ON public.poll_options;
CREATE POLICY poll_options_select ON public.poll_options
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls po WHERE po.id = poll_id));

DROP POLICY IF EXISTS poll_options_insert ON public.poll_options;
CREATE POLICY poll_options_insert ON public.poll_options
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls po
      WHERE po.id = poll_id AND po.created_by = auth.uid()
    )
  );

-- Options are immutable after creation (no UPDATE policy).

-- ---------------------------------------------------------------
-- 4. Poll votes — one vote per user per poll (UNIQUE), changeable
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_votes (
  poll_id    UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON public.poll_votes(option_id);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_votes_select ON public.poll_votes;
CREATE POLICY poll_votes_select ON public.poll_votes
  FOR SELECT TO authenticated
  USING (
    -- Results are public to anyone who can see the poll; own vote readable.
    EXISTS (SELECT 1 FROM public.polls po WHERE po.id = poll_id)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS poll_votes_insert ON public.poll_votes;
CREATE POLICY poll_votes_insert ON public.poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.polls po WHERE po.id = poll_id)
    -- option must belong to the same poll
    AND EXISTS (
      SELECT 1 FROM public.poll_options o
      WHERE o.id = option_id AND o.poll_id = poll_id
    )
  );

DROP POLICY IF EXISTS poll_votes_update ON public.poll_votes;
CREATE POLICY poll_votes_update ON public.poll_votes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.poll_options o
      WHERE o.id = option_id AND o.poll_id = poll_id
    )
  );

DROP POLICY IF EXISTS poll_votes_delete ON public.poll_votes;
CREATE POLICY poll_votes_delete ON public.poll_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
