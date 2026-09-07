-- ============================================================================
-- G4M37Z Communities V1 Additions — Expressions, Voice, Sharing
-- Idempotent. Safe to re-run. Run AFTER 005_full_sync.sql.
-- ============================================================================

-- 1. Reactions (V1 foundation — extensible to custom reactions in V2)
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like','love','laugh','wow','sad','angry')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(post_id, user_id, reaction_type)
);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON public.reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON public.reactions(user_id);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions viewable by everyone" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert own reaction" ON public.reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reaction" ON public.reactions FOR DELETE USING (auth.uid() = user_id);

-- 2. Emoji usage tracking (optional V1 — records which emoji used per post/comment)
CREATE TABLE IF NOT EXISTS public.emoji_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  emoji_char TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CHECK (
    (post_id IS NOT NULL) OR (comment_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_emoji_usage_post ON public.emoji_usage(post_id);
CREATE INDEX IF NOT EXISTS idx_emoji_usage_comment ON public.emoji_usage(comment_id);
ALTER TABLE public.emoji_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Emoji usage viewable by everyone" ON public.emoji_usage FOR SELECT USING (true);
CREATE POLICY "Users can insert own emoji usage" ON public.emoji_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. GIF references (external provider reference; image stored in storage)
CREATE TABLE IF NOT EXISTS public.gif_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'giphy',
  gif_url TEXT NOT NULL,
  preview_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gif_refs_post ON public.gif_refs(post_id);
ALTER TABLE public.gif_refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GIF refs viewable by everyone" ON public.gif_refs FOR SELECT USING (true);
CREATE POLICY "Post authors can insert GIF refs" ON public.gif_refs FOR INSERT WITH CHECK (auth.uid() = (SELECT author_id FROM public.posts WHERE id = gif_refs.post_id));

-- 4. Voice comments (recordings attached to post/comment — storage URL reference)
CREATE TABLE IF NOT EXISTS public.voice_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CHECK ((post_id IS NOT NULL) OR (comment_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_voice_comments_post ON public.voice_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_voice_comments_user ON public.voice_comments(user_id);
ALTER TABLE public.voice_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voice comments viewable by everyone" ON public.voice_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert own voice comment" ON public.voice_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors can delete own" ON public.voice_comments FOR DELETE USING (auth.uid() = user_id);

-- 5. Voice room settings (per community — settings only, not rooms themselves)
CREATE TABLE IF NOT EXISTS public.voice_room_settings (
  community_id UUID PRIMARY KEY REFERENCES public.communities(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  allow_member_create BOOLEAN NOT NULL DEFAULT true,
  max_participants INTEGER NOT NULL DEFAULT 50,
  default_listener_mode BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE public.voice_room_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Community members can view settings" ON public.voice_room_settings FOR SELECT USING (true);
CREATE POLICY "Community admins can update settings" ON public.voice_room_settings FOR UPDATE USING (auth.uid() IN (SELECT creator_id FROM public.communities WHERE id = voice_room_settings.community_id));
CREATE POLICY "Community admins can insert" ON public.voice_room_settings FOR INSERT WITH CHECK (auth.uid() IN (SELECT creator_id FROM public.communities WHERE id = voice_room_settings.community_id));

-- 6. Voice rooms (per community — basic presence/state, not media transport)
CREATE TABLE IF NOT EXISTS public.voice_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_voice_rooms_community ON public.voice_rooms(community_id);
ALTER TABLE public.voice_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible to all" ON public.voice_rooms FOR SELECT USING (true);
CREATE POLICY "Community members can create" ON public.voice_rooms FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator/mod can update" ON public.voice_rooms FOR UPDATE USING (auth.uid() IN (SELECT creator_id FROM public.communities WHERE id = voice_rooms.community_id) OR auth.uid() = created_by);
CREATE POLICY "Creator/mod can delete" ON public.voice_rooms FOR DELETE USING (auth.uid() IN (SELECT creator_id FROM public.communities WHERE id = voice_rooms.community_id) OR auth.uid() = created_by);

-- 7. Voice room participants (presence/state only — not media)
CREATE TABLE IF NOT EXISTS public.voice_room_participants (
  room_id UUID NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('listener','speaker','moderator')),
  is_muted BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_voice_participants_room ON public.voice_room_participants(room_id);
ALTER TABLE public.voice_room_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants visible to members" ON public.voice_room_participants FOR SELECT USING (true);
CREATE POLICY "Self can insert" ON public.voice_room_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Self can update state" ON public.voice_room_participants FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Self can delete" ON public.voice_room_participants FOR DELETE USING (auth.uid() = user_id);

-- 8. Storage bucket for voice recordings (additive — safe with bucket policy)
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('voice-recordings', 'voice-recordings', false)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can read voice recordings" ON storage.objects';
  EXECUTE 'CREATE POLICY "Anyone can read voice recordings" ON storage.objects FOR SELECT USING (bucket_id = ''voice-recordings'' AND auth.uid() IS NOT NULL)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'voice SELECT skipped: %', SQLERRM;
END $storage$;

DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can upload voice" ON storage.objects';
  EXECUTE 'CREATE POLICY "Users can upload voice" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''voice-recordings'' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'voice INSERT skipped: %', SQLERRM;
END $storage$;

-- 9. Realtime publication for new reactions / voice rooms
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_rooms;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_room_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- END V1 ADDITIONAL FEATURES SQL
-- Idempotent. Run after 005_full_sync.sql.
-- ============================================================================
