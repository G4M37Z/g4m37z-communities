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

1. **Mobile nav & header density** — the header action cluster (theme,
   notifications, account) crowds the lockup under 380px; collapse into a
   single overflow menu below `sm`.
2. **Card rhythm on feeds** — post cards mix 2–3 different vertical rhythms
   (image vs text vs repost). Normalize paddings (p-5/p-4 → one scale) and
   fix media aspect at 16/10 so feeds scan evenly.
3. **Empty states with actions** — every empty state should carry its CTA
   button (e.g. communities empty → "Create a community"); several still
   end at a sentence.
4. **Form error placement** — a few forms still render errors below the
   fold of the submit row; standardize on inline-field errors + a single
   summary above the submit.
5. **Dark-theme surface hierarchy** — `bg-surface` and `bg-bg` are close on
   some panels (settings). Introduce one more elevation step or a hairline
   top border on cards.
6. **Focus states** — audit `:focus-visible` rings on custom buttons
   (press class) for keyboard users; several are contrast-weak on accent.
7. **Micro-transitions** — page-enter is consistent (PageEnter); add the
   same 150–200ms treatment to sheet/dropdown mounts for coherence.
8. **OG/social cards per route** — landing has og.png; per-route OG images
   (community, game, profile) would lift link sharing.

## Deliberately not queued

- Neon/RGB/glow treatments — against the brand spec (docs/BRAND.md).
- Font replacement — Inter + Caveat pairing is set; changing it resets the
  identity for marginal gain.
