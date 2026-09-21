-- 051_cover_quality.sql
-- Cover-quality upgrade (user report: covers look low-quality and are cropped
-- badly in the 2:1 card slot). Two moves:
--   1. Steam CDN art moves from header.jpg (460x215, landscape banner) to the
--      official library_600x900 portrait capsule — 2:3 aspect, same CDN, no
--      upscaling: it is the artwork Steam itself ships.
--   2. IGDB art moves from t_cover_big (2D "big cover", 452px wide) to
--      t_720p (1280px-side resize of the original 1:1.5 cover).
-- GameCover.tsx renders at aspect-[2/3] so the art is shown uncropped.
-- Idempotent in effect: re-running simply rewrites the same URLs.
-- Safe to re-run: YES

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/578080/library_600x900.jpg'
WHERE slug = 'pubg' AND cover_url LIKE '%/578080/%';

UPDATE public.games
SET cover_url = 'https://images.igdb.com/igdb/image/upload/t_720p/cocxbi.jpg'
WHERE slug = 'fortnite' AND cover_url LIKE '%/cocxbi.%';

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1938090/library_600x900.jpg'
WHERE slug = 'call-of-duty' AND cover_url LIKE '%/1938090/%';

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/2669320/library_600x900.jpg'
WHERE slug = 'ea-sports-fc' AND cover_url LIKE '%/2669320/%';

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1665460/library_600x900.jpg'
WHERE slug = 'efootball' AND cover_url LIKE '%/1665460/%';

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1971870/library_600x900.jpg'
WHERE slug = 'mortal-kombat' AND cover_url LIKE '%/1971870/%';

UPDATE public.games
SET cover_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/271590/library_600x900.jpg'
WHERE slug = 'gta' AND cover_url LIKE '%/271590/%';

UPDATE public.games
SET cover_url = 'https://images.igdb.com/igdb/image/upload/t_720p/cociyw.jpg'
WHERE slug = 'roblox' AND cover_url LIKE '%/cociyw.%';
