---
name: run-frontend-browser
description: Use when you need to manually verify a Wendo RMS frontend page in a real browser (screenshot, click through a flow, check console errors) — e.g. after building/editing a page under frontend/app, before marking a UI task done. Covers launching the Next.js dev server correctly and the project-specific gotchas that otherwise waste time, then drives the browser via the chrome-devtools MCP.
---

# Running the frontend in a real browser for manual verification

This project's CLAUDE.md requires manually exercising UI changes in a browser
before calling them done. Use the **chrome-devtools MCP** to drive the
browser (navigate, click, screenshot, read console) — it's already
configured for this project and needs no setup of its own. This skill exists
for the parts chrome-devtools MCP can't tell you: how to get this project's
dev server into a working state, and the project-specific false positives
that otherwise waste time.

## Steps

1. **Start (or confirm) the dev server:**
   ```bash
   cd frontend
   ss -tlnp | grep :3000   # check if already running — do NOT trust `lsof` alone, it can miss it
   ```
   If nothing is listening:
   ```bash
   nohup npx next dev -p 3000 > /tmp/next-dev.log 2>&1 &
   disown
   timeout 60 bash -c 'until curl -sf http://localhost:3000/login >/dev/null; do sleep 1; done'
   ```
   Also confirm the backend is up (separate process, usually already running via `tsx watch src/server.ts`):
   ```bash
   curl -s http://localhost:4000/api/v1/health
   ```
   `"redis":"down"` in the health response is a known, pre-existing sandbox
   quirk in this environment — not something you caused, don't chase it.

2. **Drive the browser via chrome-devtools MCP** — navigate to the target
   page, log in with a seeded account (below), click through the flow,
   take a screenshot, and read console messages. Wait ~1.5s after
   navigation before screenshotting so entrance animations settle (see
   gotchas below) — don't chain actions immediately after `waitForURL`
   or its MCP equivalent.

3. **Look at the screenshot and check console errors together.** A page can
   render its shell while every data fetch fails — always check both.

## Gotchas specific to this project

- **Stale `next-server` process holding port 3000.** If `next dev` fails with
  `EADDRINUSE` right after you thought you killed it: `npm`/`pnpm` wrapper
  processes don't forward `SIGTERM` to the actual `next-server` child. Use
  `ss -tlnp | grep 3000` (not just `lsof -i :3000`, which can miss it in this
  environment) to find the real PID, then `kill -9 <pid>` directly. If you
  ran a production `next build` earlier in the session, also `rm -rf .next`
  before restarting `next dev` — a leftover production build can make the
  dev server 404 on its own JS/CSS chunks.
- **Don't mistake a fade-in for a bug.** Pages use `animate-fade-up` (300ms
  entrance animation via Tailwind, opacity 0→1). A screenshot taken
  immediately after navigation can look washed-out — wait ~1.5s after the
  page settles before screenshotting, not immediately after navigation.
- **Don't mistake React StrictMode's double-invoke for an infinite refetch
  loop.** In dev mode, effects intentionally fire twice on mount. If you see
  a handful of duplicate API calls right after page load and then nothing
  more, that's normal — only treat it as a real bug if calls keep recurring
  well after the page has settled (several seconds later, not just at
  mount).
- **Seeded accounts** for manual testing (password `password123` for all):
  `manager1.centralstore@dev.test` (STORE_MANAGER), `attendant1.centralstore@dev.test`
  (STORE_ATTENDANT). Check `backend/src/scripts/seed-dev.ts` for others as
  new roles get seeded.
