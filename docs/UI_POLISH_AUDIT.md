# G4M37Z — UI Polish Audit (2026-09-21)

> Where the platform UI stands after the 2026-09-19…21 hardening + polish
> passes, and the ranked list of what to improve next. Quick wins from this
> audit shipped same-day (see "Shipped"). The rest is queued by impact.

## Shipped from this audit (same-day)

1. **Loading experience** — root splash slimmed to mark + progress hairline
   (no font-dependent content, so no fallback-cursive flash on cold loads);
   route-level skeletons for home, messages, communities, discover,
   notifications, tournaments, settings so navigation shows content-shaped
   placeholders instead of the full-screen splash.
2. **Wordmark** — bold tech caps (Inter 900, copper "37"), replacing the
   calligraphic paths (user decision).
3. **Signature** — Caveat 700, −1.5° rotation, copper spark (user decision:
   keep "Wassup wassup").
4. Earlier same-week passes already in: thread chat-surface rework, brand
   color platform icons, 2:3 high-res game covers, empty states with brand
   voice.

## Ranked next steps (impact-ordered)

1. ✅ **SHIPPED 2026-09-21 (`7263e28`)** — header density: theme toggle hidden
   below 380px, mirrored into the account menu at those widths.
2. ✅ **SHIPPED 2026-09-21 (`52ea7a7`)** — feed card rhythm: paddings normalized,
   media restored to 16/10.
3. ✅ **SHIPPED 2026-09-21 (`0f0b918`)** — empty-state CTAs: notifications,
   messages, community posts (member-gated "Create a post").
4. ✅ **VERIFIED ALREADY CONFORMING** — form error placement: settings, post
   create, and community create all render the error banner directly above the
   submit row; no change needed.
5. ✅ **SHIPPED 2026-09-21 (`840a6f6`)** — surface hierarchy: `brand-card`
   elevation utility applied to settings sections.
6. ✅ **SHIPPED 2026-09-21** — focus states: the global `:focus-visible`
   copper ring is fine against surfaces but merged with accent-filled
   controls, so those now switch to the high-contrast foreground ring
   (`.bg-accent:focus-visible` in globals.css; ≥3:1 in both themes, no
   new colors). Verified on the compiled CSS of the production build.
7. ✅ **SHIPPED 2026-09-21 (`840a6f6`)** — micro-transitions: `sheet-in` mount
   animation for sticker/GIF panels matching menu timing.
8. ✅ **SHIPPED 2026-09-21** — OG/social cards: `/discover` and
   `/gaming/profile/[username]` now emit og/twitter tags reusing `/og.png`
   and the profile avatar (metadataBase from `NEXT_PUBLIC_SITE_URL`);
   communities (banner) and profiles (avatar) already did. Live-verified
   on all four routes. A dedicated game-detail route gets its OG for free
   from the layout default when it ships in Phase 2.

## Deliberately not queued

- Neon/RGB/glow treatments — against the brand spec (docs/BRAND.md).
- Font replacement — Inter + Caveat pairing is set; changing it resets the
  identity for marginal gain.
