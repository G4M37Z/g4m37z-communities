# G4M37Z — Brand & Visual Identity

> Living specification. Established 2026-09-16 as part of the complete visual
> identity redesign. Historical docs untouched; this file is authoritative
> for brand questions.

## Brand idea

G4M37Z is a Kenyan gaming/social creator brand. Gaming is part of the
culture, not the entire identity. The system communicates identity,
community, expression and discovery through **contrast, composition,
material and typography — never neon, glow, RGB or esports clichés.**

Two intentional halves:

- **The mark (structured side):** "call & response" — two interlocked
  crescents with a spark dot answering at the seam. Two voices meeting.
  Recognizable from silhouette; works mono, 16px+, no effects.
- **The signature (human side):** "Wassup wassup" in Caveat — natural,
  confident, warm. Used sparingly (landing hero, loading, onboarding,
  brand moments, empty states). Never in body copy. Never a replacement
  slogan; it IS the brand greeting.

## Assets (`public/brand/`)

| File | Purpose |
|---|---|
| `logo-mark.svg` | The symbol (uses `currentColor`) |
| `logo-wordmark.svg` | G4M37Z wordmark, drawn as paths |
| `logo.svg` | Combined lockup |
| `favicon-tile.svg` | Ivory tile + ink mark (favicon/app icon source) |

Also: `public/icon.svg` (favicon, auto-served by Next), `public/icon.png`
(512 tile), `public/og.png` (1200×630 social card), `public/apple-icon.png`.
Legacy path `public/logo-mark.svg` is refreshed to the new mark for any
stale references. Components: `BrandMark.tsx` (inline SVG — use this in
app UI), `BrandSignature.tsx` (signature + Caveat font loader).

## Color system

~85% neutral; accent carries interaction and identity only.

**Accent — burnished copper** (chosen over the muted-violet candidate:
warmer against both foundations, more original, no tech-startup read):
- Dark: `#B4633C` (hover `#C6764C`, soft `#8A4A2C`)
- Light: `#A44F28` (hover `#8F441F`, soft `#E9D5C8`)
- **Text step:** use `text-accent-text` (`#D08A5F` dark / `#9C4A24` light)
  for accent-colored TEXT — AA on both obsidian and ivory. `text-accent`
  is for fills/borders/icons only.

**Dark foundation:** bg `#0B0C0E`, surface `#111316`, elevated `#17191D`,
subtle `#1D2025`, borders `#282C32`/`#3A3F47`, fg `#F5F5F3`.
**Light foundation (daylight expression, not an inversion):** bg `#F3F0E8`
(warm ivory), surface `#FAF9F6`, elevated `#FFFFFF`, subtle `#E8E5DC`,
borders `#DDD8CC`/`#C9C3B4`, fg `#111114`, secondary `#4D4A45`.

Rules: no pure black, no blue-gray corporate light mode, no neon/glow,
depth via surface hierarchy + borders + spacing (never glow shadows).

## Typography

- UI/content: **Inter** (`--font-sans`) — unchanged.
- Signature: **Caveat 600** (`--font-signature`, via `BrandSignature`).
- Wordmark in UI is typeset (font-sans black, tight tracking), not an image.
- Hierarchy: brand (mark/signature) → navigation → content → metadata.

## Motion

Loading/brand reveals use `brand-reveal` / `brand-settle` keyframes
(300–900ms, `--ease-out`, opacity+transform only). All gated behind
`motion-safe` — reduced-motion users get final states immediately.
No spinners, no artificial delays.

## Do / Don't

- DO use semantic tokens (`bg`, `surface`, `fg`, `accent`, …).
- DO use `text-accent-text` for accent text.
- DON'T hardcode hex in components.
- DON'T add controllers, crosshairs, RGB, neon, cyberpunk, esports type.
- DON'T scatter the signature; it is a deliberate brand moment.
