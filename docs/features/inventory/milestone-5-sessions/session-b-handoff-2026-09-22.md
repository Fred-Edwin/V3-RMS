# Milestone Five, Session B — handoff (2026-09-22, second continuation)

Paste this whole file's contents as your opening prompt for the next session.

## Read first, in this order

1. `docs/features/inventory/milestone-5-sessions/session-b-plan.md` — the
   full build plan (screen table, backend/frontend build order, decisions
   already made). Still authoritative; nothing in it has been contradicted.
2. `docs/features/inventory/milestone-5-plan.md` — data model / API
   contract this session implements against.
3. `docs/features/inventory/milestone-5-sessions/session-a-plan.md` — what
   Session A shipped and how (this session extends its files).
4. This file — what's actually done vs. remaining, two real bug classes to
   watch for, and exact next steps.

Nothing has been committed to git yet. `git status` will show everything
described below as modified/untracked. That's expected — do not `git
reset`/`git clean` anything.

## What's done — backend (100%, tested, not yet committed)

All of Session B's backend scope is complete:
- `Discrepancy` model + `DiscrepancyStatus`/`DiscrepancyOutcome` enums,
  migration `20260922111827_milestone5_session_b_discrepancy` applied to
  the local DB.
- `dispatch-repository.ts` extended: `findDispatchesForBranch`,
  `findByIdWithLinesForBranch`, `markConfirmed`, `findBranchManagers`.
- `discrepancy-repository.ts` (new): full CRUD + role-scoped list queries.
  **Extended again this session** to include `dispatch.confirmedAt` /
  `dispatch.confirmedBy` in `discrepancyDetailInclude` — needed so the
  resolution screen can show "confirmed by X · date" (Paper `16GW-0`'s "The
  gap" card header), which wasn't in the original include.
- `dispatch-service.ts` extended: `listDeliveries`, `getDeliveryDetail`,
  `confirmDelivery`, `confirmDeliveryOnBehalf`, `getDeliveryNoteForBranch`.
  `DISPATCH_IN` writer is positive-signed (confirmed correct). Automatic
  `Discrepancy` creation on any line mismatch, dispatch status flips to
  `DISCREPANCY_OPEN`. **Extended again this session**: `serializeDeliveryNote`
  now also returns `confirmedQty` per line (see "Contract additions" below).
- `discrepancy-service.ts` (new): `listDiscrepancies`, `getDiscrepancy`,
  `resolveDiscrepancy` — all three outcomes implemented and **all
  verified live** except see note below. **Extended again this session**:
  `serializeDetail` now also returns `confirmedByName`/`confirmedAt`.
- Controller + routes wired: `GET/POST /deliveries*`,
  `GET/POST /discrepancies*`.
- `fcm-service.ts`: `sendDiscrepancyResolvedPush` added, reused
  `sendReceiptVariancePush` for discrepancy-created.
- Zod schemas in `dispatch-validators.ts` extended for every endpoint,
  **plus this session's two contract additions** (see below).
- Tests: `dispatch-service-confirm.test.ts` (13 tests),
  `discrepancy-service.test.ts` (11 tests), `deliveries-discrepancy-contract.test.ts`
  (11 tests).
- **`cd backend && pnpm build && pnpm test` is clean — 982/982 tests pass**,
  confirmed as the very last action of this session, after every change
  described below.

### Contract additions made this session (real gaps found, not pre-specified)

Two small, deliberate additions to the frozen contract, made because the
UI genuinely couldn't be built correctly without them — not scope creep,
just filling in what `session-b-plan.md` didn't anticipate:

1. **`DeliveryNoteLine.confirmedQty: string | null`** — added to
   `DeliveryNoteLineSchema` (`dispatch-validators.ts`), `serializeDeliveryNote`
   (`dispatch-service.ts`), and the frontend `DeliveryNoteLine` type
   (`frontend/features/dispatch/types/index.ts`). Reason: `confirmDelivery`/
   `confirmOnBehalf` return a `DeliveryNote`, and neither the on-screen note
   (`delivery-note-screen.tsx`) nor the print renderer
   (`printable-delivery-note.tsx`) could show the confirmed-vs-dispatched
   gap that Paper's `15SU-0` (discrepancy print variant) requires, without
   this field.
2. **`DiscrepancyDetail.confirmedByName: string | null` /
   `confirmedAt: string | null`** — added to `DiscrepancyDetailSchema`
   (`dispatch-validators.ts`), `discrepancyDetailInclude` +
   `DiscrepancyWithDetail` type (`discrepancy-repository.ts`), and
   `serializeDetail` (`discrepancy-service.ts`), plus the frontend
   `DiscrepancyDetail` type. Reason: Paper's `16GW-0`/`16LI-0` "The gap"
   card shows "confirmed by W. Kariuki (Barista head) · 12 Sep 10:40" —
   this is the dispatch's own `confirmedBy`/`confirmedAt` (who signed the
   branch-side receipt), not a discrepancy-specific field, and it wasn't in
   the original `discrepancyDetailInclude`.

One deliberate **non**-addition: Paper's `15OP-0` (signed confirm receipt)
mockup shows a placeholder "Ledger entry: LDG-KIT-08822" row with no
backing field anywhere in the real contract. Rather than inventing a fake
reference number, `confirm-receipt-screen-mobile.tsx`'s signed state omits
that row entirely and uses only real returned fields
(`sequenceLabel`/`confirmedByName`/`confirmedAt`/`confirmedOnBehalf`). If
a future session wants a real ledger reference here, it would need to
return the created `InventoryTransaction.id` or similar from the confirm
endpoint — not done, flagging only.

**Backend dev server**: was killed and restarted at least 3 times this
session after schema/service edits (the `tsx watch` gotcha from Session
A's notes — it does not reliably pick up backend file changes on save in
this sandbox). If backend calls return stale-looking data or 500s, kill
whatever's on port 4000 and restart fresh:
```
pkill -9 -f "tsx watch src/server.ts"; cd backend && npx tsx watch src/server.ts
```
It is currently running from this session's last restart; verify with
`curl -s http://localhost:4000/api/v1/health` before trusting any live
check.

## What's done — frontend, screen by screen

**Screens 1–2 (`168U-0`, `15L1-0`)** — done in a prior continuation of this
same session, gated and live-verified. No changes this session except the
process-lesson fixes already noted lower down in git history; not touched
further tonight.

**Screen 3 (`15I4-0`/`15MG-0`/`15OP-0`, mobile Confirm branch receipt, all
three states) — DONE, gated, live-verified, then bug-fixed twice more (see
"Two real bug classes" below).** New file:
`confirm-receipt-screen-mobile.tsx`. Routed at
`/app/branch/deliveries/confirm` (new
`app/app/branch/(shell)/deliveries/confirm/page.tsx`, Suspense-wrapped).
Live-verified end to end multiple times this session:
- Department Head (`chef1.nyeritown@dev.test`) confirming with a
  deliberate shortfall → real `DISPATCH_IN` (positive, branch department
  location, correct org scoping) + real `Discrepancy` row created,
  verified via Postgres MCP.
- Branch Manager (`manager1.nyeritown@dev.test`) confirm-on-behalf, clean
  receipt → `DISPATCH_IN` positive, `confirmed_on_behalf: true`, status
  `CONFIRMED`, no discrepancy, verified via Postgres MCP.
- After the stepper/button size fix (see below), re-screenshotted and
  confirmed the populated state now matches Paper pixel-for-pixel on the
  stepper dimensions (30×30px) and the primary CTA (48px tall, full
  width).

**Screen 6 (`15SU-0` print + on-screen desktop/mobile note view) — DONE,
gated, live-verified.** No new screen file — extended the existing
Session A components (`delivery-note-screen.tsx`, `printable-delivery-note.tsx`)
to render the confirmed-vs-dispatched gap using the new `confirmedQty`
field: a NOTE column showing "Short N unit" in error-red, plus a dynamic
sentence appended to the Notes box naming the specific short line and
amount. Live-verified via chrome-devtools MCP against the real `DSC-0001`
discrepancy (dispatched 10, confirmed 7, short 3) at both
`/app/inventory/dispatch-print/<id>` and `/app/inventory/dispatch/<id>`.
**Use chrome-devtools MCP for this route specifically** — Playwright
stalled indefinitely on this page's `window.print()` call in an earlier
attempt (needed interactive dialog approval that wasn't available);
chrome-devtools MCP handled it cleanly with no such issue.

**Screens 7–8 (`16GW-0` populated / `16LI-0` resolved, desktop Discrepancy
resolution, Store Manager) — DONE, gated, live-verified end to end
including a real ledger write.** New file: `discrepancy-resolution-screen.tsx`.
Read `.agents/skills/vercel-composition-patterns/rules/architecture-avoid-boolean-props.md`
and `patterns-explicit-variants.md` before building this, per the plan —
built as an **explicit variant**, not shared with `DiscrepancyDetailScreen`
(the read-only Branch Manager view) via a `readOnly` boolean prop; both
compose a shared internal `GapCard` piece instead. Routed at
`/app/inventory/discrepancies/[id]/page.tsx` (inside `(shell)`, since
Paper's `16GW-0` shows the full Central Store sidebar). Live-verified:
resolved `DSC-0001` with `TRANSIT_LOSS_WRITEOFF` as
`store.manager@wendo.test`/PIN `1234` — confirmed via Postgres MCP that
this is genuinely **the first `ADJUSTMENT` writer in the codebase** and it
works exactly as `session-b-plan.md` decision #6 specifies: `-3` at the
Central Store, hub-org-scoped. Discrepancy flipped to `RESOLVED`,
resolution note persisted, resolved-state screen renders correctly
(signature, ledger summary, immutable footer).

**Screen 9 (`16DM-0`, desktop Discrepancy detail, Branch Manager
read-only) — code done, NOT yet live-verified.** New file:
`discrepancy-detail-screen.tsx`. Deliberately separate from
`DiscrepancyResolutionScreen` (no sign flow, no outcome selection at all —
not a read-only mode of the other component). Routed at
`/app/branch/(shell)/deliveries/discrepancies/[id]/page.tsx`. Typechecks
and builds clean; never clicked through in a real browser as
`manager1.nyeritown@dev.test`. **This is the top of the next session's
checklist.**

**Screens 10–11 (`16Q7-0` Store Manager all-branches / `16UG-0` Branch
Manager own-branch, Discrepancies list) — DONE, one live-verified, one
not.** One new file per decision #7:
`discrepancies-list-screen.tsx`, branching on `user.role === 'STORE_MANAGER'`
for column set / breadcrumb / open-only-filter copy. Routed at
`/app/inventory/(shell)/discrepancies/page.tsx` (Store Manager) and
`/app/branch/(shell)/deliveries/discrepancies/page.tsx` (Branch Manager).
- **Store Manager variant: live-verified.** Showed `DSC-0001` correctly
  with branch/department/item/gap/raised/status columns, "Open only"
  filter toggle, clicked through to the resolution screen successfully.
- **Branch Manager variant: NOT yet live-verified.** Code exists, builds
  clean, never opened in a browser. Second item on the next session's
  checklist — log in as `manager1.nyeritown@dev.test`, navigate to
  `/app/branch/deliveries/discrepancies`.

Nav wiring added: a "Discrepancies" `Button` action in the Central Store
dispatch queue topbar (`dispatch-queue-fulfil-screen.tsx`) linking to
`/app/inventory/discrepancies`; a "Discrepancies" action in the branch
deliveries topbar (`branch-incoming-confirm-screen.tsx`), shown only when
`isManager` (Department Heads don't get this link — matches Paper, which
never gives them discrepancy visibility). Per `session-b-plan.md`, there
is still no separate sidebar nav entry for Discrepancies on either
shell — it's reached via these topbar links / the KPI card's own
"View discrepancies →" link on the branch deliveries screen (pre-existing,
not touched this session), matching how Paper's own artboards reach it.

## Two real bug classes found and fixed this session — read before touching any Tailwind class in this codebase

These cost significant time tonight and will recur on any future screen
if not understood. Both are **silent** — no build error, no console
warning, the class name looks completely plausible, and `tsc`/`next build`
both pass clean. The only way to catch them is a live rendered screenshot,
or the small Node script below.

### Bug class 1: `size-N` fails for any non-default-scale `N`, even though `wN` works

This project defines a **prefixed** custom spacing scale in
`tailwind.wds.preset.ts`: `wds-1.25`, `wds-2.5`, `wds-3.5`, `wds-4.5`, etc.
— these are **not** merged into Tailwind's bare `spacing` scale. They only
work when written as `w-wds-1.25`, `gap-wds-2.5`, `px-wds-3.5`, etc.
(already the convention in `components/app/shell/sidebar-nav.tsx` and
elsewhere).

**The actual bug**: writing a bare fractional value that isn't in
*Tailwind's own default* spacing scale — `w-7.5`, `h-7.5`, `gap-2.75`,
`p-2.75`, `size-1.25`, `py-4.5`, `pt-1.25`, `gap-1.25`, `w-55`, `h-8.5`,
`gap-0.75`, `px-1.75`, `text-title` (not a registered token at all) — **does
not error anywhere in the toolchain**. Tailwind's JIT just silently emits
no CSS rule for that class. The element renders at its shrink-to-fit
content size instead of the intended size. A button meant to be 30×30px
renders as ~11.6×22px (just the glyph + border). A button meant to have
14px padding renders with 0px padding (just line-height tall).

Tailwind's **default** scale (safe to use bare) is:
`0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, ...`
Anything **not** in that list (`1.25`, `1.75`, `2.25`, `2.75`, `3.25`,
`4.5`, `7.5`, `8.5`, `55`, ...) needs either:
- the `wds-` prefixed version if one exists at that value
  (`tailwind.wds.preset.ts`'s `spacing` block has `0.5, 1, 1.25, 1.5, 2,
  2.5, 3, 3.5, 4, 4.5, 5, 6, 8, 10, 12, 16`), or
- an arbitrary value in brackets, e.g. `w-[30px]`, `gap-[5px]`,
  `pt-[18px]` — this is what was used for values with no `wds-` match at
  all (`7.5`, `8.5`, `55`, `1.75`).

**Fixed this session** (all now verified via the checker script below and,
for the ones on this session's own new screens, live screenshot):
- `confirm-receipt-screen-mobile.tsx`: stepper buttons (`w-7.5 h-7.5` →
  `w-[30px] h-[30px]`), primary CTA (`p-2.75` → `p-3.5`, which **is**
  default — this one was just a wrong value, not a missing one), a
  `w-15` receipt-line column (→ `w-[60px]`), `text-title` (→
  `text-[30px]/8`, matching the working precedent elsewhere).
- `discrepancy-resolution-screen.tsx`: `h-17` footer bars (→
  `h-[68px]`), `gap-1.25`/`w-55`/`pt-4.5` in the signature block (→
  `gap-[5px]`/`w-[220px]`/`pt-4`), `text-title` (→ `text-[30px]/8`).
- `discrepancies-list-screen.tsx`: `size-3.25` checkbox icon (→
  `h-[13px] w-[13px]`), `text-title` heading (→ `text-wds-h1`, the
  actually-registered 26px heading token — **this one is a real token
  name, `wds-h1`, not an arbitrary value**; check `tailwind.wds.preset.ts`
  before reaching for `[Npx]` on text sizes specifically).
- `discrepancy-detail-screen.tsx`: `text-title` heading (→ `text-wds-h1`).
- **Pre-existing Session A bugs, same class, fixed as part of this
  session's cleanup pass** (found by grep, not directly related to any
  screen built tonight, but the user asked to fix them while in this
  code): `dispatch-fulfil-screen-mobile.tsx` (its own mobile stepper had
  `gap-1.25`, `size-1.25`, `py-4.5`, `py-2.75`, `gap-2.25`, `mt-1.25`, all
  fixed), `dispatch-queue-screen-mobile.tsx` (`px-1.75` → `px-[7px]`),
  `delivery-note-screen.tsx` + `printable-delivery-note.tsx` (`gap-0.75`,
  `gap-1.25`, `py-2.25`, `py-2.75`, `h-8.5`, `pt-1.25`, all fixed).

**A one-off checker script** (not committed, was run from `/tmp` this
session) can catch most of this class mechanically — it does NOT replace
a live screenshot (some bad values, like a wrong-but-valid default value,
it can't catch), but it catches every genuinely-nonexistent utility fast:
```js
// Run from frontend/ with: node this-file.js
const defaultTheme = require('tailwindcss/defaultTheme');
const defaultKeys = new Set(Object.keys(defaultTheme.spacing));
const fs = require('fs');
const files = require('child_process').execSync('find features -name "*.tsx"').toString().trim().split('\n');
const prefixes = ['w','h','size','p','px','py','pt','pb','pl','pr','gap','gap-x','gap-y','m','mx','my','mt','mb','ml','mr','inset','top','bottom','left','right'];
const re = new RegExp(`\\b(${prefixes.join('|')})-([0-9]+(?:\\.[0-9]+)?)\\b`, 'g');
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  let m, bad = [];
  while ((m = re.exec(content))) if (!defaultKeys.has(m[2])) bad.push(m[0]);
  if (bad.length) console.log(f + ':', [...new Set(bad)].join(', '));
}
```
Note it will flag some false positives (values inside code comments, not
actual classNames — check each hit). **Run this against any new dispatch
screen before considering it visually gated**, in addition to the actual
screenshot comparison.

### Bug class 2 (from the earlier continuation of this session, still valid): the four process lessons

Unchanged from before — full-page-reload-on-click (use `router.push` +
intercept plain left-clicks, keep real `href` for modifier-click), missing
hover/active states (Paper can't show these, check by eye), missing
`Suspense` boundaries around `useSearchParams()`, and the `/app/branch`
middleware gate needing route-specific carve-outs before general rules.
All four screens built tonight were built with these lessons already
applied from the start (no regressions of this type found tonight).

## Local dev environment state (as of end of session)

- **Backend**: running on :4000, restarted several times, currently up
  and serving the two contract additions above. Verify with `curl -s
  http://localhost:4000/api/v1/health` before trusting any response.
- **Frontend**: `.next` cache was corrupted once this session (stray
  `next start` production-mode process left over from a previous session
  was still bound to :3000 serving a stale build; killing it and starting
  `next dev` on top of the *same* `.next` directory produced broken
  webpack module resolution — lots of 404s and a blank/frozen-looking
  login page). **Fixed by**: killing whatever's on :3000, `rm -rf .next`,
  then `npx next dev -p 3000`. If you see a suspiciously static/frozen
  page or repeated 404s on navigation, check `ss -tlnp | grep :3000` for
  what's actually bound there and consider this same fix — don't assume
  it's a code bug first.
- Dev credentials: `store.manager@wendo.test` (Store Manager),
  `manager1.nyeritown@dev.test` (Branch Manager),
  `chef1.nyeritown@dev.test` (Kitchen Department Head) — all password
  `password123`, PIN `1234`.
- **Live discrepancy/dispatch state in the local DB right now** (useful
  for picking up screen 9/11 verification without re-seeding):
  - `DSC-0001` (id `9c46d00d-060d-46d5-a825-ca9e6c90a69c`) — **RESOLVED**,
    `TRANSIT_LOSS_WRITEOFF`, on dispatch `63350aae-cd28-4961-8061-3861957b7c46`
    (Nyeri Town · Kitchen). Good for exercising the read-only *resolved*
    state of screen 9.
  - `DSC-0002` (id `67398648-1b02-4a37-b43e-c31ffc8bb784`) — **OPEN**, on
    dispatch `fc826542-2150-441d-9f32-9b9611bcf3bd` (Nyeri Town ·
    Kitchen). Good for exercising the read-only *open* state of screen 9,
    and for testing `FOUND_REDELIVERED` or `MISCOUNT_CORRECTED` (the two
    outcomes not yet exercised — only `TRANSIT_LOSS_WRITEOFF` has been
    tested this session).
  - Several other dispatches exist in various states (`Dispatch 1`
    through `Dispatch 5` on Nyeri Town · Kitchen) from repeated scratch-script
    runs — `frontend/.scratch/setup-delivery-data.mjs` can produce more
    any time (safe to re-run repeatedly, opens a fresh requisition each
    time).

## Definition of done (unchanged from session-b-plan.md) — updated status

- [x] Screens 1–2 gated (prior continuation)
- [x] Screen 3 (all 3 states) gated, live-verified, bug-fixed
- [x] Screen 6 (print + on-screen) gated, live-verified
- [x] Screens 7–8 gated, live-verified, real ledger write confirmed
- [x] Screen 9 — **live-verified 2026-09-22 (next-session continuation)**,
  both resolved (`DSC-0001`) and open (`DSC-0002`) states, as
  `manager1.nyeritown@dev.test`. No console errors, correct data,
  correct status-dependent UI.
- [x] Screen 10 (Store Manager list) gated, live-verified
- [x] Screen 11 (Branch Manager list) — **live-verified same session**,
  "Open only" filter toggle confirmed both states, row click navigates
  correctly.
- [x] Backend `pnpm build && pnpm test` clean (982/982, re-confirmed at
  the end of the continuation session after all fixes below)
- [x] Frontend `pnpm build` clean, including the project's
  `check-wds-tokens.ts` script (378 files scanned, zero unregistered
  token references) — **note this token checker does NOT catch bug class
  1 above**, since `w-7.5` etc. aren't `wds-*` tokens at all, just
  malformed bare Tailwind classes. Don't rely on it for that.
- [x] `FOUND_REDELIVERED` outcome — **exercised live** via a fresh
  requisition→approve→dispatch→confirm-with-shortfall chain (script:
  `frontend/.scratch/setup-found-redelivered.mjs`), resolved as
  `DSC-0003`. Verified via Postgres MCP: new `Dispatch 10` row with
  `dispatch_lines.substitute_note = "Follow-up for discrepancy DSC-0003"`,
  `dispatched_qty: 2.0000`, status `IN_TRANSIT`; `DISPATCH_OUT` of `-2` at
  Central Store.
- [x] `MISCOUNT_CORRECTED` outcome — **exercised live** on `DSC-0002`.
  Verified via Postgres MCP: new `ADJUSTMENT` of `-2.0000` at the
  **branch department location** (Nyeri Town — Kitchen,
  `BRANCH_DEPARTMENT`), distinct from `TRANSIT_LOSS_WRITEOFF`'s Central
  Store target, exactly per spec.
- [ ] Full Flow 9→10→11 loop closed end-to-end in one continuous pass —
  individual pieces have all been exercised (requisition → approve →
  dispatch was Session A; receive-with-discrepancy → resolve was this
  session, three times over for three different outcomes) but never
  chained in one sitting on a single dispatch. Lower priority now that
  every individual transition + ledger write has been verified
  separately, including twice this continuation.
- [ ] Owner review of all 11 screens against Paper — not started

### Two more real bugs found and fixed in this continuation session

1. **Numeral clipping in `discrepancy-resolution-screen.tsx`'s `GapCard`**
   — the four big stat numbers (DISPATCHED/CONFIRMED/GAP/VALUE) were
   visually clipped top and bottom. Root cause: `font-wds-mono` paired
   with `text-wds-kpi` on all four numerals — `text-wds-kpi` is a real,
   registered token (28px/34px line-box), but Geist Mono's glyph metrics
   don't fit that line-box the way Geist (sans) does, so the digits
   rendered tight/clipped even though every class was individually valid
   (this is **not** the bare-fraction bug class from earlier in this
   file — everything here resolves to real CSS). Fixed by switching the
   three quantity numerals (DISPATCHED/CONFIRMED/GAP) to
   `font-wds-sans text-wds-kpi`, matching the working precedent already
   in the sibling `discrepancy-detail-screen.tsx`, which reserves
   `font-wds-mono` only for the currency numeral. Confirmed live via
   screenshot before/after.
2. **Resolved-state footer bar overlapping the left sidebar** — on the
   `isResolved` branch of `discrepancy-resolution-screen.tsx`, the root
   wrapper (`<div className="flex min-h-0 flex-1 flex-col overflow-hidden">`,
   around line 144) was missing `relative`. Its child footer bar uses
   `absolute inset-x-0 bottom-0`, which — with no positioned ancestor
   inside the content column — escaped up to the page root and spanned
   the *full window width*, rendering on top of the Central Store
   sidebar's bottom-left corner. Only visible above the `lg` (1024px)
   breakpoint, where the sidebar actually renders — invisible at the
   narrow MCP browser viewport this whole session had been screenshotting
   at by default, which is exactly why it went unnoticed through all of
   Screens 3/6/7/8/9/10/11's earlier "live-verified" passes. The sibling
   open-state root (same file, ~line 216) already had `relative` — this
   was the one inconsistent copy. Fixed by adding `relative` to the
   resolved-state root; confirmed via `emulate({ viewport: "1920x1080x1"
   })` before/after screenshots.

**Process lesson for next session**: the MCP chrome-devtools browser's
default/last-used viewport in this sandbox was ~914×791 — below the `lg`
breakpoint where this project's sidebars stop rendering entirely. Any
screen with a left/right sidebar needs at least one checkpoint screenshot
at a real desktop width (`emulate({ viewport: "1920x1080x1" })` or
similar) before being called gated, not just the default narrow viewport.
Re-verify no other screen in this feature has a `position: absolute`
child whose parent is missing `relative` — grepped this session
(`grep -n "absolute inset-x-0"` across the dispatch feature's screen
files) and confirmed `discrepancy-resolution-screen.tsx` was the only
file using that pattern, so this is unlikely to recur elsewhere in
Milestone Five, but worth the same grep on any new absolutely-positioned
footer/toolbar going forward.

**Also investigated and ruled out**: the sidebar gradient (`wds-gradient-
sidebar` / `--wds-sidebar-top/mid/bottom`) looked flat/non-gradient in a
live screenshot next to a Paper reference image that showed a more
visible light-to-dark sweep. Traced all the way through: live app's
computed `background-image` → pixel-sampled via canvas → confirmed
byte-exact match to Paper's own approved tokens (`--color-sidebar-top:
#2E1806` etc.) — the oklch conversion in `tokens.wds.css` is correct, not
a bug. Then screenshotted Paper's own artboards (`168U-0`, `16UG-0`)
directly and found **Paper's own rendering shows the same subtly-flat
gradient** — the top and mid stops really are only ~2 RGB values apart in
the approved design itself. The pasted reference image with the more
visible gradient was not conclusively traced to a specific artboard in
this file; the working theory is a different render/zoom/export of the
same design rather than a different token set — not chased further since
the live app is proven faithful to the current approved tokens. No code
or token change made.

## `web-design-guidelines` pass (2026-09-22, third continuation)

Ran against all 5 screens built for Milestone Five Session B. Findings and
outcome:

**Fixed immediately** (both real, both cheap, both live-verified):
- `confirm-receipt-screen-mobile.tsx:52,68` — the +/− stepper buttons on
  the mobile Confirm receipt screen were icon-only with no `aria-label`.
  A screen-reader user had no way to tell which button increased vs.
  decreased the confirmed quantity. Fixed: `aria-label="Decrease/Increase
  confirmed quantity for {itemName}"` on each.
- `discrepancies-list-screen.tsx:98,134` — the "Open only" filter toggle
  was local `useState`, not reflected in the URL — refreshing or sharing
  the link always reset to the default. Fixed: filter state now reads
  from and writes to `?open=false` via `useSearchParams`/`router.replace`
  (`scroll: false`, so toggling doesn't jump the page). Also added
  `role="checkbox"`/`aria-checked` to the same button while touching it —
  it was a checkbox-shaped toggle with no accessible role. Both page
  files (`app/app/inventory/(shell)/discrepancies/page.tsx`,
  `app/app/branch/(shell)/deliveries/discrepancies/page.tsx`) wrapped in
  `Suspense` per this project's documented `useSearchParams()` gotcha.
  Verified live: toggling updates the URL, a hard reload preserves the
  unfiltered view instead of resetting.

**Logged, not fixed** (smaller, same class as pre-existing patterns
elsewhere in the app, not new regressions from this build) — a follow-up
ticket if anyone wants to sweep them, not a blocker:
- `discrepancy-resolution-screen.tsx:188` — "View follow-up dispatch" is
  a `<button>` doing pure `router.push` navigation; should be `<a>`/
  `<Link>` for Cmd/Ctrl+click support.
- `discrepancy-resolution-screen.tsx:242` — outcome-selection buttons
  (radio-like, single-select) have no `aria-pressed`/`role="radio"`.
- `discrepancy-resolution-screen.tsx:267,269,297` — resolution note has
  no `aria-required`/inline error if left empty; `resolveError` block
  not `aria-live="polite"`; disabled "Sign resolution" has no
  `aria-disabled` + reason.
- `confirm-receipt-screen-mobile.tsx:236` — `confirmError` block not
  `aria-live="polite"`.
- `delivery-note-screen.tsx:150` — back-button icon `<svg>` not
  `aria-hidden="true"` (decorative, label already on the button).

`discrepancy-detail-screen.tsx` and `printable-delivery-note.tsx` passed
clean (read-only screens, no forms/icon-buttons/interactive state).

Re-ran `pnpm build` (both backend and frontend) and `pnpm test` after the
two fixes — all clean (982/982 backend tests, frontend build + the
`check-wds-tokens.ts` gate).

## Immediate next steps, in order

Everything except the owner review is now done (see "Definition of done"
and the `web-design-guidelines` section above). What's left:

1. **Close the full Flow 9→10→11 loop once, end to end, in one sitting**:
   fresh requisition → approve → dispatch → receive with a deliberate
   discrepancy → resolve it. Lower priority — every individual transition
   has been verified separately (including all three resolution outcomes,
   each on its own fresh dispatch, across two continuations), but never
   chained start-to-finish in one sitting. Optional at this point, not a
   blocker for the owner review.
2. Owner review of all 11 screens against Paper — this is what actually
   closes out Milestone Five. Update `docs/features/inventory/MILESTONES.md`
   per its existing convention for a shipped milestone only after that
   review.
3. **Before that owner review**, re-screenshot every screen at a real
   desktop width (`emulate({ viewport: "1920x1080x1" })`, not the MCP
   browser's narrower default) — the second continuation found a
   sidebar-overlap bug on screen 8's resolved state that was invisible at
   the narrower viewport used for every earlier "gated" pass (now fixed).
   Confirm no other screen has the same class of issue before calling the
   owner review ready.

## Skill usage reminder for whoever picks this up

Per `session-b-plan.md`: `run-frontend-browser` for live verification
(though this session found chrome-devtools MCP more reliable than
Playwright specifically for the print route — use whichever is actually
responsive when you start, don't assume); `web-design-guidelines` after
each screen is gated (not yet run this session, see step 5 above);
`vercel-composition-patterns` was already consulted before building the
discrepancy-resolution screen, no need to re-read unless building another
role/status-branching screen.
