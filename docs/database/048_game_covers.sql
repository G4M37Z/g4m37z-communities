-- 048_game_covers.sql
-- Backfill official cover art for the 8 seeded games (GAP-GAMES-01).
-- Sources: Steam CDN (cdn.cloudflare.steamstatic.com) for Steam-hosted
-- titles; IGDB CDN (images.igdb.com) for Fortnite and Roblox (not on
-- Steam). Cover art is hotlinked from official CDNs, never committed.
-- Idempotent: only fills rows where cover_url is still NULL. Safe to re-run.
-- Safe to re-run: YES

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/578080/header.jpg'
WHERE slug = 'pubg' AND cover_url IS NULL;

UPDATE public.games
SET cover_url = 'https://images.igdb.com/igdb/image/upload/t_cover_big/cocxbi.jpg'
WHERE slug = 'fortnite' AND cover_url IS NULL;

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1938090/header.jpg'
WHERE slug = 'call-of-duty' AND cover_url IS NULL;

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/2669320/header.jpg'
WHERE slug = 'ea-sports-fc' AND cover_url IS NULL;

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1665460/header.jpg'
WHERE slug = 'efootball' AND cover_url IS NULL;

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1971870/header.jpg'
WHERE slug = 'mortal-kombat' AND cover_url IS NULL;

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg'
WHERE slug = 'gta' AND cover_url IS NULL;

UPDATE public.games
SET cover_url = 'https://images.igdb.com/igdb/image/upload/t_cover_big/cociyw.jpg'
WHERE slug = 'roblox' AND cover_url IS NULL;