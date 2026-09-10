# G4M37Z Communities — Roadmap

> The official V3 sequence. Do not reorder. Do not mark future milestones
> complete.

---

## Current state

| # | Milestone | Status | Final commit |
|---|---|---|---|
| — | Phase 0.5 readiness gate | COMPLETE | `78d8cd3` |
| — | Phase 0.6 DB + WebRTC gate | COMPLETE | `a79fc91` |
| 1 | V3.1 Reputation | COMPLETE | `ef8e681` |
| 2 | V3.2 Achievements | COMPLETE | `edbf925` |
| P0 | V3 P0 Security Containment | COMPLETE | `fe324a4` |
| 3 | V3.3 Game Discovery | COMPLETE | `5386337` |
| 4 | V3.4 LFG | COMPLETE | `a578663` |
| 5 | V3.5 Events | COMPLETE | `662452c` |
| 6 | V3.6 Tournaments | COMPLETE | `ea3c598` |
| 7 | V3.7 Creators | COMPLETE | `7d36d93` |
| 8 | V3.8 Messaging | COMPLETE | `19e862f` |
| 9 | V3.9 Social Graph | COMPLETE | `8460b32` |

P0 is a security gate, not a feature milestone. Do not reorder the
sequence: V3.1 / V3.2 / P0 / V3.3 / V3.4 / V3.5 / V3.6 / V3.7 / V3.8 /
V3.9 / Launch Hardening.

---

## Forward roadmap

### V3.7 — Creators (COMPLETE — `7d36d93`)

- Tables: `creator_profiles`, `creator_content`, `creator_followers`
  (verified live DB; RLS policies applied via `019_creators_policies.sql`).
- Completed:
  - Migration `docs/database/019_creators_policies.sql` (10 RLS policies).
  - `src/lib/creators/service.ts`, `/creators`, `/creators/[id]`, tests.
  - Milestone commit `7d36d93 feat: implement v3.7 creators`.

### V3.8 — Messaging (COMPLETE — `19e862f`)

- Tables: `conversations`, `conversation_members`, `messages`
  (verified live DB: RLS enabled, previously 0 policies; policies applied
  via `020_messaging_policies.sql`).
- Completed:
  - Migration `docs/database/020_messaging_policies.sql` (10 RLS policies;
    SELECT/INSERT member-scoped, messages immutable via `USING false` /
    `WITH CHECK false`).
  - `src/lib/messaging/service.ts` (conversation list, cursor-paginated
    message list), `/messages`, `/messages/[conversationId]`, tests.
  - Milestone commit `19e862f feat: implement v3.8 messaging`.

### V3.9 — Social Graph + Notifications (COMPLETE — `8460b32`)

- Tables: `follows`, `blocks`, `mutes`, `notification_events`
  (RLS verified live: 13 policies via `021_social_graph_policies.sql`).
- Completed: `021_*.sql`, `src/lib/social/service.ts`, `/social`, tests, commit.

### Launch Hardening (post-V3, NOT a feature milestone)

Status (verified 2026-09-10 session): PARTIAL / BLOCKED. Not COMPLETE. P1.1 PARTIAL; P1.2 NONE; P1.3 PASS; P1.4 BLOCKED (benchmark); P2 PASS; P2.3 BLOCKED (UI static only); P3 PARTIAL (security/DB/test verified; full build + mobile + perf blocked). Deferred: rate limit (P1.1), CAPTCHA (P1.2), upload MIME (P1.5), telemetry/anomaly (P2), CSP/MFA/rotation (P3).

Strictly after all V3 milestones (1–9) are PASS on `main`. This is a
**separate, gated phase** that should not be conflated with V3 surface
work. The current "build surface first, harden before launch" strategy
depends on this gate being respected.

Required work:
- **P1.1** Rate limiting via Upstash / Vercel KV (per-IP / per-user / per-endpoint).
- **P1.2** Turnstile / CAPTCHA on signup, login, and any public write
  endpoint.
- **P1.3** (P0 already applied — defense-in-depth is satisfied.)
- **P1.5** Upload MIME validation (post images, avatars, voice recordings).
- **P1.6** Search / IP hardening (current length caps are not enough at
  scale).
- **P2** Telemetry / anomaly scoring / security observability pipeline.
- **P3** CSP / security headers / MFA / secrets rotation / WAF rules.

Additional items that may surface during P2 / P3:
- The advisory-lock RPC pattern (`try_rsvp_session`, `try_rsvp_event`) for
  capacity race containment (currently best-effort).
- Bracket progression logic for tournaments (currently no
  `next_match_id` column).

---

## Hard rules

1. Do not skip a milestone.
2. Do not mark a future milestone complete.
3. Do not mix launch-hardening work into a V3 feature milestone.
4. Do not reorder the V3 sequence.
5. Do not invent schema (table names, column names, etc.) — verify against
   the live database first.
6. Do not bypass RLS to make a feature work; write a proper policy.
7. Do not weaken P0 containment to ship a feature.
8. Do not push to GitHub without explicit instruction.
9. Do not silently absorb V2 debt into V3 milestones.
10. Do not claim concurrent correctness without testing it.
