# G4M37Z — Brand & Visual Identity

> Living specification. Established 2026-09-16 as part of the complete visual
> identity redesign. Historical docs untouched; this file is authoritative
> for brand questions.

> **Governing direction (2026-10-17, user):** *“PlayStation theme and layout,
> UI/UX, animation and fonts.”* The interface is a **PlayStation-inspired
> theme**: console chrome, not generic web SaaS. Every section below maps to
> those five words — theme (console chrome + one identity accent), layout
> (three device shells), UX (one nav home per device, tactile feedback),
> animation (systemic reveals, reduced-motion safe), fonts (Inter UI +
> Caveat signature, console-weight display headings).

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

> **2026-10-17 retheme (final):** a PlayStation-inspired theme with the
> **PlayStation blue** accent (`#0070D1`, Sony's signature console blue —
> user-directed switch from terracotta, 2026-10-17). Console-dark chrome is
> the foundation.

~85% neutral; accent carries interaction and identity only.

**Accent — PlayStation blue:**
- Dark & light fill: `#0070D1` (hover `#0065D1` dark / `#004E9E` light,
  soft `#0E2036` dark / `#D6E8FA` light)
- **Text step:** use `text-accent-text` (`#4DA3FF` dark / `#0058B0` light)
  for accent-colored TEXT — AA on every surface in both themes. `text-accent`
  is for fills/borders/icons only.
- White on `#0070D1` = 4.95:1 (AA for buttons).

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

### Accent personalization (2026-10-18)

Users can swap the accent (`/settings → Appearance`, client-side — same
contract as ThemeToggle): `localStorage` key `g4m37z-accent` + `[data-accent]`
attribute on `<html>` via `src/lib/appearance.ts`; UI at
`src/components/settings/appearance-form.tsx`. Overrides live at the END of
`globals.css` (out-ranking `@theme` and both light paths). Six accents —
PlayStation blue (default, no attribute), terracotta, emerald, violet, rose,
gold — each verified: white ≥4.57:1 on every fill/hover, text steps ≥4.57:1 on
their theme backgrounds. Components must keep using semantic tokens
(`bg-accent`, `text-accent-text`) so personalization works everywhere.

### PlayStation theme system (2026-10-17)

The user's brief in one line: *PlayStation theme and layout, UI/UX,
animation and fonts.* Implementation mapping:

- **Theme** → near-black console chrome + **PlayStation blue** accent +
  PS-style **tile panels** (shape, finish and depth — the palette follows
  the Color system above).
- Implementation: `.card` (layered top-lit gradient surface, hairline top
  highlight, soft ambient shadow) + `.card-interactive` (hover lift, accent
  border, accent-tinted grounding shadow; press-down on `:active`). Defined in
  `src/app/globals.css`; structured primitive at `src/components/ui/card.tsx`.
- Hover/selection uses border + depth, never glow (keeps the no-neon rule) —
  PS selection feel via borders and depth, not neon.
- **Animation** → scroll reveals via `src/components/ui/reveal.tsx`
  (framer-motion `whileInView`, shared easing `[0.22,1,0.36,1]`, reduced-motion
  safe). Primary card grids replace the mount-only `PageEnter` GSAP stagger so
  cards animate as they enter the viewport.

### Layout & responsive shells (2026-10-17) — **layout**

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

### UX rules (2026-10-17) — **UI/UX**

- **One nav home per device class.** Primary nav lives in exactly one place:
  `BottomNav` + `Header` on mobile, the `Sidebar` rail/labelled sidebar on
  md+. Secondary actions never duplicate primary nav.
- **Active-state clarity:** the current route gets `bg-accent-soft` +
  `text-accent-text`; everything else is `text-text-secondary` until hover.
- **Tactile feedback everywhere:** `.press` scale-down on `:active`, focus
  rings via `:focus-visible` (accent ring; `bg-accent` switches to the
  high-contrast foreground ring per Audit #6), ≥44px touch targets in
  chrome (`BottomNav`, icon rail).
- **Scroll-then-stream pages:** static chrome paints first; DB-backed
  sections stream behind `Suspense` skeletons (`skeleton` shimmer), never
  blank or spinners.

## Typography — **fonts**

- UI/content: **Inter** (`--font-sans`) — unchanged.
- Display: **Archivo** (`--font-display`, loaded in `layout.tsx`, landed
  2026-10-17) — console-tooling: geometric, heavy, uppercase-friendly.
  h1/h2 set in it at weight 800; section kickers use the `.eyebrow`
  utility (uppercase, 0.14em tracking). Body copy never uses it.
- Signature: **Caveat 700** (`--font-signature`, via `BrandSignature`), slight
  −1.5° rotation and an accent spark dot echoing the mark's dot (2026-09-21
  restyle — user-approved "keep it, make it richer").
- Wordmark in UI is typeset (font-sans black, tight tracking) — since
  2026-09-21 it renders as **G4M + accent 37 + Z** via `BrandWordmark.tsx`
  (the accented "37" follows the current accent token — PlayStation blue as
  of 2026-10-17; originally terracotta. User decision: bold tech caps replaced
  the hand-drawn calligraphy, which read thin/dead at header sizes; legacy
  paths remain in `public/brand/`).
- Hierarchy: brand (mark/signature) → navigation → content → metadata.

## Motion — **animation**

One motion system, never scattered effects:

- **Loading/brand reveals:** `brand-reveal` / `brand-settle` keyframes
  (300–900ms, `--ease-out`, opacity+transform only) for mark, signature and
  hero copy choreography.
- **Hero panel:** `.hero-ps` layered console-chrome backdrop (accent glow,
  sheen, vignette — backgrounds only, no glow shadows) with an oversized
  `.hero-glow-mark` watermark on md+; hero CTAs stagger on load. List pages
  (tournaments/events/lfg/creators) carry PS eyebrow kickers + staggered
  `Reveal` grids; `PageEnter` remains only on non-grid secondary pages.
- **Scroll reveals:** `Reveal` (`whileInView`) on card grids — shared easing,
  staggered by index where used, no extra parallel systems.
- **Interaction:** `.press` press-down scale, `.card-interactive` hover
  lift + accent border, `nav-item-active` / `nav-item-active-top` PS notch
  rails for active nav states, `menu-enter` / `sheet-in` for menus & panels,
  `skeleton` shimmer for streamed sections.
- All gated behind `motion-safe` / `prefers-reduced-motion` — reduced-motion
  users get final states immediately. No spinners, no artificial delays.

## Do / Don't

- DO use semantic tokens (`bg`, `surface`, `fg`, `accent`, …).
- DO use `text-accent-text` for accent text.
- DON'T hardcode hex in components.
- DON'T add controllers, crosshairs, RGB, neon, cyberpunk, esports type.
- DON'T scatter the signature; it is a deliberate brand moment.
