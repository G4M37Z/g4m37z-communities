-- =====================================================================
-- 044_game_frameworks.sql
-- Seeds the games catalogue with its own "way of gaming": every game is
-- bound to the tournament framework that mirrors how it is actually
-- hosted on global stages (PUBG != eFootball != Mortal Kombat).
--
--   * tournament_frameworks gains  game_id, scoring_schedule, match_format
--   * games gains                 default_framework_id
--   * games catalogue seeded       (8 titles + genre/platform joins)
--   * per-game frameworks seeded   (from official/league research, see
--                                   SPEC-tournament-formats.md addendum)
--
-- Idempotent: catalogue seeds guard on slug existence (WHERE NOT EXISTS —
-- the games table was created outside this repo and its unique constraints
-- are not assumed); framework/stage seeds use ON CONFLICT (slug/unique).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Schema additions
-- ---------------------------------------------------------------------

ALTER TABLE public.tournament_frameworks
  ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scoring_schedule JSONB,
  ADD COLUMN IF NOT EXISTS match_format JSONB;

ALTER TABLE public.tournament_frameworks
  DROP CONSTRAINT IF EXISTS frameworks_match_format_mode;

ALTER TABLE public.tournament_frameworks
  ADD CONSTRAINT frameworks_match_format_mode
  CHECK (
    match_format IS NULL
    OR (match_format->>'mode')::text IN ('single', 'best_of', 'multi_match', 'league', 'racing')
  );

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS default_framework_id UUID REFERENCES public.tournament_frameworks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_frameworks_game ON public.tournament_frameworks(game_id);
CREATE INDEX IF NOT EXISTS idx_games_default_framework ON public.games(default_framework_id);

-- ---------------------------------------------------------------------
-- 2. Genre taxonomy: add Fighting (Mortal Kombat has no home today)
-- ---------------------------------------------------------------------

INSERT INTO public.genres (name, slug)
VALUES ('Fighting', 'fighting')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. Games catalogue seed (idempotent — guard on slug existence)
-- ---------------------------------------------------------------------

INSERT INTO public.games (slug, name, description, release_date)
SELECT s.slug, s.name, s.description, release_date::date
FROM (VALUES
  ('pubg',
   'PUBG',
   'PlayerUnknown''s Battlegrounds — the original battle royale with a global esports scene.',
   '2017-12-20'),
  ('fortnite',
   'Fortnite',
   'Epic''s battle royale — home of the FNCS and Chapter-era global tournaments.',
   '2017-07-25'),
  ('call-of-duty',
   'Call of Duty',
   'The FPS franchise whose pro format is set by the Call of Duty League.',
   '2003-10-29'),
  ('ea-sports-fc',
   'EA SPORTS FC',
   'EA''s football sim — the competitive home of the FC Pro leagues.',
   '2023-09-29'),
  ('efootball',
   'eFootball',
   'Konami''s free-to-play football sim with its own Pro circuit.',
   '2021-09-30'),
  ('mortal-kombat',
   'Mortal Kombat',
   'NetherRealm''s fighting franchise, a staple of Evo and major FG brackets.',
   '2023-09-19'),
  ('gta',
   'Grand Theft Auto V',
   'Rockstar''s open-world classic; racing and stunt events drive the GTA online scene.',
   '2013-09-17'),
  ('roblox',
   'Roblox',
   'A platform of experiences; Creator Showdown-style events span many games.',
   '2006-09-01')
) AS s(slug, name, description, release_date)
WHERE NOT EXISTS (SELECT 1 FROM public.games g WHERE g.slug = s.slug);

-- Genre links
INSERT INTO public.game_genres (game_id, genre_id)
SELECT g.id, ge.id
FROM public.games g
JOIN (VALUES
  ('pubg', 'shooter'),
  ('fortnite', 'shooter'),
  ('call-of-duty', 'shooter'),
  ('ea-sports-fc', 'sports'),
  ('efootball', 'sports'),
  ('mortal-kombat', 'fighting'),
  ('gta', 'action'),
  ('roblox', 'adventure')
) AS m(game_slug, genre_slug) ON m.game_slug = g.slug
JOIN public.genres ge ON ge.slug = m.genre_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_genres gg
  WHERE gg.game_id = g.id AND gg.genre_id = ge.id
);

-- Platform links
INSERT INTO public.game_platforms (game_id, platform_id)
SELECT g.id, p.id
FROM public.games g
JOIN (VALUES
  ('pubg', 'pc'),
  ('pubg', 'mobile'),
  ('fortnite', 'pc'),
  ('fortnite', 'playstation'),
  ('fortnite', 'xbox'),
  ('fortnite', 'nintendo-switch'),
  ('fortnite', 'mobile'),
  ('call-of-duty', 'pc'),
  ('call-of-duty', 'playstation'),
  ('call-of-duty', 'xbox'),
  ('call-of-duty', 'mobile'),
  ('ea-sports-fc', 'pc'),
  ('ea-sports-fc', 'playstation'),
  ('ea-sports-fc', 'xbox'),
  ('ea-sports-fc', 'nintendo-switch'),
  ('efootball', 'pc'),
  ('efootball', 'playstation'),
  ('efootball', 'xbox'),
  ('efootball', 'mobile'),
  ('mortal-kombat', 'pc'),
  ('mortal-kombat', 'playstation'),
  ('mortal-kombat', 'xbox'),
  ('mortal-kombat', 'nintendo-switch'),
  ('gta', 'pc'),
  ('gta', 'playstation'),
  ('gta', 'xbox'),
  ('roblox', 'pc'),
  ('roblox', 'mobile'),
  ('roblox', 'xbox')
) AS m(game_slug, platform_slug) ON m.game_slug = g.slug
JOIN public.platforms p ON p.slug = m.platform_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_platforms gp
  WHERE gp.game_id = g.id AND gp.platform_id = p.id
);

-- ---------------------------------------------------------------------
-- 4. Per-game frameworks (the "way of gaming" per title)
-- ---------------------------------------------------------------------

INSERT INTO public.tournament_frameworks
  (slug, name, category, scoring_type, description, game_id, scoring_schedule, match_format)
SELECT f.slug, f.name, f.category, f.scoring_type, f.description,
       g.id, f.scoring_schedule::jsonb, f.match_format::jsonb
FROM (VALUES
  ('pubg-br-points',
   'PUBG Points System',
   'PUBG',
   'points',
   'Official PUBG Esports format: placement + kill points accumulated over 6 matches, Grand Final crowns the champion.',
   'pubg',
   '{"placement":[15,12,10,8,6,4,3,2,1],"kill_points":1,"per_match":true,"matches":6}'::text,
   '{"mode":"multi_match","matches":6}'::text),
  ('fncs-style-points',
   'FNCS-Style Points',
   'Fortnite',
   'points',
   'FNCS Open format: Victory Royale 65pts down to 25th worth 2, plus 2 per elimination, across 12 games; top sides advance through Heats to Grand Finals.',
   'fortnite',
   '{"placement":[65,56,52,48,44,40,38,36,34,32,30,28,26,24,22,20,18,16,14,12,10,8,6,4,2],"kill_points":2,"per_match":true,"matches":12}'::text,
   '{"mode":"multi_match","matches":12}'::text),
  ('football-league-knockout',
   'Football League + Knockout',
   'EA FC',
   'points',
   'EA FC ranked-style: league phase on 3-1-0 points, ties split by goal difference then goals scored then head-to-head; knockout rounds settle the winner in single matches.',
   'ea-sports-fc',
   '{"win":3,"draw":1,"loss":0,"tiebreak":["goal_difference","goals_for","head_to_head"]}'::text,
   '{"mode":"league","games":1}'::text),
  ('efootball-pro-cup',
   'eFootball Pro Cup',
   'eFootball',
   'points',
   'eFootball Pro-style: group stage on 3-1-0, semi-final and final played as best-of-3 matchups.',
   'efootball',
   '{"win":3,"draw":1,"loss":0,"tiebreak":["goal_difference","head_to_head"]}'::text,
   '{"mode":"best_of","games":3}'::text),
  ('cod-cdl-series',
   'CDL Best-of-5 Series',
   'Call of Duty',
   'win_loss',
   'Call of Duty League format: best-of-5 series with a fixed mode order — Hardpoint, Search & Destroy, Control, Hardpoint, Search & Destroy. Win 3 maps to take the series.',
   'call-of-duty',
   '{"win_points":1,"loss_points":0}'::text,
   '{"mode":"best_of","games":5,"modes":["Hardpoint","Search & Destroy","Control","Hardpoint","Search & Destroy"]}'::text),
  ('mk-fighting-double-elim',
   'Fighting Double-Elim',
   'Mortal Kombat',
   'win_loss',
   'Mortal Kombat Pro Comp / Evo-style: double-elimination pools of best-of-3 sets, Grand Finals stretch to best-of-5.',
   'mortal-kombat',
   '{"win_points":1,"loss_points":0}'::text,
   '{"mode":"best_of","games":3,"finals_games":5}'::text),
  ('gta-racing-cup',
   'GTA Racing Cup',
   'GTA',
   'rank',
   'GTA Online racing-style: points per finishing position across 5 races, Grand Final decides the champion.',
   'gta',
   '{"placement":[25,18,15,12,10,8,6,5,4,3,2,1],"per_match":true,"matches":5}'::text,
   '{"mode":"racing","matches":5}'::text),
  ('roblox-multi-experience',
   'Roblox Multi-Experience',
   'Roblox',
   'points',
   'Roblox Creator Showdown-style: cumulative points stacked across rounds, one experience at a time. Points total decides the winner.',
   'roblox',
   '{"win_points":1,"tiebreak":["points","head_to_head"]}'::text,
   '{"mode":"multi_match","matches":1}'::text)
) AS f(slug, name, category, scoring_type, description, game_slug, scoring_schedule, match_format)
JOIN public.games g ON g.slug = f.game_slug
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. Stages for each per-game framework (idempotent per (framework, order))
-- ---------------------------------------------------------------------

INSERT INTO public.tournament_stages (framework_id, stage_order, stage_name, progression_rule)
SELECT fw.id, s.stage_order, s.stage_name, s.rule::jsonb
FROM (VALUES
  ('pubg-br-points', 1, 'Group Stage',       '{"top_n":16}'),
  ('pubg-br-points', 2, 'Grand Final',       '{"top_n":1}'),
  ('fncs-style-points', 1, 'Open Qualifiers', '{"top_n":40}'),
  ('fncs-style-points', 2, 'Heats',          '{"top_n":10}'),
  ('fncs-style-points', 3, 'Grand Finals',   '{"top_n":1}'),
  ('football-league-knockout', 1, 'League Phase', '{"top_n":24}'),
  ('football-league-knockout', 2, 'Knockout Rounds', '{"top_n":1}'),
  ('efootball-pro-cup', 1, 'Group Stage',    '{"top_n":4}'),
  ('efootball-pro-cup', 2, 'Semi-Final',     '{"top_n":2}'),
  ('efootball-pro-cup', 3, 'Final',          '{"top_n":1}'),
  ('cod-cdl-series', 1, 'Qualifiers',        '{"top_n":8}'),
  ('cod-cdl-series', 2, 'Championship Bracket', '{"top_n":1}'),
  ('mk-fighting-double-elim', 1, 'Double-Elim Pools', '{"top_n":8}'),
  ('mk-fighting-double-elim', 2, 'Top 8',    '{"top_n":1}'),
  ('gta-racing-cup', 1, 'Qualifying Races',  '{"top_n":16}'),
  ('gta-racing-cup', 2, 'Grand Final',       '{"top_n":1}'),
  ('roblox-multi-experience', 1, 'Rounds 1-3', '{"top_n":8}'),
  ('roblox-multi-experience', 2, 'Semi-Final', '{"top_n":4}'),
  ('roblox-multi-experience', 3, 'Final',    '{"top_n":1}')
) AS s(slug, stage_order, stage_name, rule)
JOIN public.tournament_frameworks fw ON fw.slug = s.slug
ON CONFLICT (framework_id, stage_order) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. Bind each game to its default "way of gaming"
-- ---------------------------------------------------------------------

UPDATE public.games g
SET default_framework_id = fw.id
FROM public.tournament_frameworks fw
JOIN (VALUES
  ('pubg', 'pubg-br-points'),
  ('fortnite', 'fncs-style-points'),
  ('ea-sports-fc', 'football-league-knockout'),
  ('efootball', 'efootball-pro-cup'),
  ('call-of-duty', 'cod-cdl-series'),
  ('mortal-kombat', 'mk-fighting-double-elim'),
  ('gta', 'gta-racing-cup'),
  ('roblox', 'roblox-multi-experience')
) AS d(game_slug, fw_slug) ON d.fw_slug = fw.slug
WHERE g.slug = d.game_slug AND g.default_framework_id IS NULL;

-- =====================================================================
-- End 044.
-- =====================================================================