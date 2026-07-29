---
name: run-frontend-browser
description: Use when you need to manually verify a Wendo RMS frontend page in a real browser (screenshot, click through a flow, check console errors) — e.g. after building/editing a page under frontend/app, before marking a UI task done. Covers launching the Next.js dev server correctly and driving headless Chromium via the project's own Playwright install, with no global install or path hacks needed.
---

# Running the frontend in a real browser for manual verification

This project's CLAUDE.md requires manually exercising UI changes in a browser
before calling them done. This skill is the fast, correct path — it exists
because doing this the naive way (global playwright install, scripts run from
`/tmp`) wastes a lot of time on path-resolution dead ends. Don't rediscover
that; follow this directly.

## The one fact that matters

**`frontend/package.json` already has `@playwright/test` as a devDependency,
with Chromium already installed in this environment's cache.** You do not
need `npm install -g playwright`, `npx playwright install`, or any hashed
`pnpm global` path. The only real requirement is:

**Your driver script must live somewhere under `frontend/`** (e.g.
`frontend/.scratch/`, already gitignored), not in `/tmp` or the harness's
scratchpad directory. Node's ESM resolver walks up from the *script's own
file location* to find `node_modules`, not from `cwd` — a script outside
`frontend/` will fail with `ERR_MODULE_NOT_FOUND` even if you `cd` into
`frontend` first before running it.

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

2. **Write the driver script inside `frontend/.scratch/`** (create the dir if
   needed — it's gitignored, safe to leave files there):
   ```js
   // frontend/.scratch/check-page.mjs
   import { chromium } from '@playwright/test';

   const browser = await chromium.launch({ args: ['--no-sandbox'] });
   const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();

   const consoleErrors = [];
   page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
   page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

   await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
   await page.fill('input[type="email"]', 'manager1.centralstore@dev.test'); // or whichever seeded account fits the role under test
   await page.fill('input[type="password"]', 'password123');
   await page.click('button[type="submit"]');
   await page.waitForURL('**/app/inventory/dashboard', { timeout: 15000 }); // adjust to the target route
   await page.waitForTimeout(1500); // let entrance animations (animate-fade-up, 300ms) settle before screenshotting
   await page.screenshot({ path: 'frontend/.scratch/screenshot.png', fullPage: true });
   console.log('Console errors:', JSON.stringify(consoleErrors, null, 2));
   await browser.close();
   ```

3. **Run it from inside `frontend/`:**
   ```bash
   cd frontend
   node .scratch/check-page.mjs
   ```

4. **Look at the screenshot** (`Read` tool on the PNG path) and check the
   console-errors output. A page can render its shell while every data fetch
   fails — always check both.

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
  page settles before screenshotting, not immediately after `waitForURL`.
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
