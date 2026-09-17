<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Build & verify (Termux / android-arm64)

Turbopack has no native bindings for android/arm64 and fails outright
(`Error: Turbopack is not supported on this platform`). Webpack is the only
engine that runs here, so `dev`/`build` are pinned to `--webpack`.

- Fast local checks, no build: `npm run check` (tsc + eslint + unit tests) — ~30s.
- Dev server: `npm run dev` (already `--webpack`), incremental.
- Local production build is slow (~2 min compile, memory-hungry, can be
  OOM-killed). If you must: `NODE_OPTIONS=--max-old-space-size=2048 npm run build`.
- Prefer cloud builds: the `CI` GitHub Action (`./node_modules/.bin/next build`,
  Turbopack, ~30s) and Vercel. Don't gate work on a local production build.
- Browser smoke tests need ChromeDriver on :9515 and are excluded from
  `npm run test:unit`; run with `npm run test:browser` when it's up.
