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

> **2026-10-17 retheme (final):** reference-driven. Chrome follows the dark
> game-store screens (near-black, warm-neutral), accent is the warm
> **terracotta** from the reference hero. Supersedes both copper (original)
> and the short-lived PlayStation-blue pass.

~85% neutral; accent carries interaction and identity only.

**Accent — terracotta:**
- Dark & light fill: `#C2542A` (hover `#D8663A` dark / `#A8461F` light,
  soft `#3B2419` dark / `#EFDACF` light)
- **Text step:** use `text-accent-text` (`#EE9A6B` dark / `#993F1A` light)
  for accent-colored TEXT — AA on every surface in both themes. `text-accent`
  is for fills/borders/icons only.
- White on `#C2542A` = 4.57:1 (AA for buttons).

**Dark foundation (game-store chrome):** bg `#0C0B0D`, surface `#141318`,
elevated `#1B1A20`, subtle `#232229`, borders `#2C2B33`/`#3F3D47`,
fg `#FAF9F7`, secondary `#ACAAB2`, muted `#8A8892`.
**Light foundation (daylight expression, not an inversion):** bg `#F3F0E8`
(warm ivory), surface `#FAF9F6`, elevated `#FFFFFF`, subtle `#E8E5DC`,
borders `#DDD8CC`/`#C9C3B4`, fg `#111114`, secondary `#4D4A45`, muted `#6A665F`.

Contrast: every text pairing above was verified ≥4.5:1 (≥3:1 for borders/focus
rings) with a WCAG script. Rules: no pure black backgrounds, no blue-gray
corporate light mode, no neon/glow, depth via surface hierarchy + borders +
spacing (never glow shadows).

### Card system (2026-10-17)

Premium card language = **PlayStation-style tiles over an Apple material base**
(shape, finish and depth — the palette is terracotta per the Color system above,
not PlayStation blue).

- Implementation: `.card` (layered top-lit gradient surface, hairline top
  highlight, soft ambient shadow) + `.card-interactive` (hover lift, accent
  border, accent-tinted grounding shadow; press-down on `:active`). Defined in
  `src/app/globals.css`; structured primitive at `src/components/ui/card.tsx`.
- Hover/selection uses border + depth, never glow (keeps the no-neon rule).
- **Motion:** scroll reveals via `src/components/ui/reveal.tsx`
  (framer-motion `whileInView`, shared easing `[0.22,1,0.36,1]`, reduced-motion
  safe). Primary card grids replace the mount-only `PageEnter` GSAP stagger so
  cards animate as they enter the viewport.

### Layout & responsive shells (2026-10-17)

One codebase, three distinct device shells (user direction: "the UI changed
for the three kinds of devices — mobiles, tablets and pcs"):

| Class | Breakpoint | Chrome | Content |
|---|---|---|---|
| Mobile | `< md` (<768px) | sticky top bar (`Header`) + fixed `BottomNav` | single column; grids go 1-col |
| Tablet | `md` (768–1023) | fixed slim **icon rail** (`Sidebar`, `w-16`, icons only) | `sm:grid-cols-2`; no bottom nav |
| Desktop | `lg` (≥1024) | fixed full **sidebar** (`Sidebar`, `w-60`, labels + brand) + page-level right rail | `lg:grid-cols-3/4`; feed + rail |

- `src/components/Sidebar.tsx` (client, `usePathname`) owns md+ navigation:
  brand, primary nav, Create, notifications, theme, account. It is
  `md:flex lg:w-60` — icon rail on tablet, labelled on desktop.
- `src/app/layout.tsx` wraps content in `md:pl-16 lg:pl-60` to clear the
  fixed rail; renders `Header` only under `md:hidden`; `BottomNav` is
  `md:hidden` (mobile only). Primary nav therefore lives in exactly one
  place per device class — the old header nav was removed.
- Content stays on `container-x` (max 1280, centred) inside the offset, so
  pages widen naturally as the rail grows.

## Typography

- UI/content: **Inter** (`--font-sans`) — unchanged.
- Signature: **Caveat 700** (`--font-signature`, via `BrandSignature`), slight
  −1.5° rotation and a terracotta spark dot echoing the mark's dot (2026-09-21
  restyle — user-approved "keep it, make it richer").
- Wordmark in UI is typeset (font-sans black, tight tracking) — since
  2026-09-21 it renders as **G4M + terracotta 37 + Z** via `BrandWordmark.tsx`
  (user decision: bold tech caps replaced the hand-drawn calligraphy, which
  read thin/dead at header sizes; legacy paths remain in `public/brand/`).
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
