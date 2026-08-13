# G4M37Z Communities

The foundational social/community layer of the G4M37Z gaming platform.

This is **v0.1**: signup/login, profiles, communities, posts, comments, voting,
search, notifications, and moderation. Games, mini-apps, and the developer SDK
arrive in later phases.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Supabase (Auth, PostgreSQL, RLS, Storage)
- Tailwind CSS v4

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

The dev server runs at http://localhost:3000.

## Project layout

```
g4m37z-communities/
├── app/                    # Next.js routes (login, signup, home, ...)
├── components/             # Reusable UI components
├── lib/
│   ├── supabase/           # Supabase clients + auth server actions
│   └── utils.ts            # Generic helpers
├── types/database.ts       # TS shapes that mirror the Supabase schema
├── docs/database/          # Executed SQL migrations (record of DB state)
├── public/                 # Static assets
└── proxy.ts                # Next.js 16 proxy — session refresh + auth gating
```

## Database workflow

Schema changes are authored as SQL files in `docs/database/` and executed
manually in the Supabase SQL Editor. After the SQL is confirmed to run, the
application code is built against it. The TypeScript types in
`types/database.ts` mirror those SQL files.

## Roadmap

See `docs/` and the milestone list in the project brief.
