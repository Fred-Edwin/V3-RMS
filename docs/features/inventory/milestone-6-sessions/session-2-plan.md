# Milestone Six — Session 2 (Central Store counting) — Build Plan

## Paste this into a fresh Claude Code session

> You are the build agent for Wendo RMS, Milestone Six, **Session 2 — Central
> Store counting**. Your brief is
> `docs/features/inventory/milestone-6-sessions/session-2-plan.md`. Read it
> top to bottom before touching code, then follow it in order. The decisions
> in it are settled — don't re-open them. Session 1's outcome log
> (`session-1-plan.md` → "Outcome log") holds the lessons and the patterns to
> reuse; read its "Frontend gates" and "End-of-session summary" sections.
> Session 1 is merged to `main` (PR #38). Pull `main` and branch from it
> as `feat/m6-s2-counting`. If something here turns out wrong in the
> code or in Paper, fix it and record the correction in this file's outcome
> log — never silently work around it.

---

## Starting state

Session 1 shipped to production on 2026-09-29: PR #38 (`6559bba`) on top of
the Department Head restock hotfix, PR #37 (`365a2ee`). Start from an
up-to-date `main`:

```bash
git switch main && git pull --ff-only
git switch -c feat/m6-s2-counting
```

`feat/m6-s1-stock-waste` is merged — don't build on it.

---

## Read first (only the sections named)

1. `CLAUDE.md` — whole file.
2. `docs/features/inventory/milestone-6-plan.md` — §0 "Session 2" table,
   **§0.1 rows for Daily count / Verify / Spot count / Thresholds**, §1.1
   `StockCount`, §1.2 `StockCountLine`, §1.7 ledger additions, §1.8 enums,
   **§1.9 `CountingThresholds`**, §1.10, **§2.2 (your endpoints)**, §3
   (notifications), **§4 (build gate — binding)**, §5, §7 + Q-A…Q-E.
3. `session-1-plan.md` → Outcome log (lessons, reusable pieces, deviations).
4. `docs/FEATURE_REDO_PLAYBOOK.md` §9, `docs/CODING_STANDARDS.md` §4 / §9,
   `docs/DESIGN_SYSTEM.md` sections you touch.

**Paper:** file `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-G-0`. Load the Paper
guide once. Values from `get_jsx` / `get_computed_styles`, never
screenshots. Layers named `REMOVED (A#) …` are hidden on purpose — don't build
them.

---

## Context

Session 2 of 4. It makes the **daily blind count** real at the Central
Store, end to end, plus spot counts and the Store Manager's thresholds.

**Demo at the end:** the attendant counts blind on mobile and signs with a
PIN → the Store Manager verifies, **queries** a line → the count goes back to
the attendant, who recounts only that line (still blind) → the SM accepts,
gives a reason where required, approves with a PIN → `ADJUSTMENT` rows land
in the ledger with `ADJ-####` references (and the ledger's `?highlight=`
link lands on them) → the verification document prints. The hub's Counts
card and Today's-count KPI are live.

---

## Decisions already made (do not re-litigate)

- **Blind count, enforced server-side.** The attendant never receives
  `expectedQty`, variance or on-hand — `AttendantCountView` is a separate Zod
  response schema. Extend Session 1's blindness contract test to every
  attendant count response (serialize the JSON, assert the keys are absent).
- **`expectedQty` is snapshotted at submit** (`counterSignedAt`), so movements
  between counting and verifying don't create phantom variance.
- **Uncounted lines are never adjusted** (partial counts are allowed).
- **Query = send back.** Any `QUERIED` line blocks approval; "Send back"
  returns the count and **only the queried lines reopen** to the attendant.
  The note the attendant sees never states the expected figure.
- **Reason control** = preset `CountReason` list + "Other (describe)"; `OTHER`
  requires a note (Zod refinement + service check). Same control everywhere.
- **Thresholds are user-set** (§1.9): the SM sets the Central Store
  `reasonRequiredKes` (default 500) in a drawer. The Director amount
  (default 5,000) is shown read-only and set only via
  `PUT /inventory/thresholds/director`. Each line stores `reasonRequired` when
  its variance is computed — moving a threshold never changes a signed
  record.
- **Daily-count tabs = top-level categories** (Q-C), with live "8/24"
  counters.
- **No offline queue** — server-side partial save only.
- Adjustments get `reference = ADJ-####` (`ReferenceCounter`); their ledger
  counterparty ("Daily count · verified by J. Mwangi") is derived from
  `stockCountLineId`, replacing Session 1's fixture text.
- Notifications fire **after** commit, never inside the transaction:
  count submitted → SM; any line ≥ `directorAlertKes` → Directors.

---

## Screens this session builds

| # | Screen / state | Paper node(s) | Device |
|---|---|---|---|
| 1 | Daily count · blind entry | `18KU-0` | mobile |
| 2 | Daily count · PIN | `18MQ-0` | mobile |
| 3 | Daily count · submitted | `18P9-0` | mobile |
| 4 | Daily count · returned for recount | `1F4N-0` | mobile |
| 5 | Verify · awaiting | `181V-0` / `1C2H-0` + `1C47-0`; reason select open `1D7W-0`, "Other" `1DAK-0` | desktop / mobile list + detail |
| 6 | Verify · line queried → "Send back" footer | `1EUG-0` / `1F1I-0` | desktop / mobile |
| 7 | Verify · verified record | `18GE-0` / `1C71-0` | desktop / mobile |
| 8 | Spot count | `1BC1-0` / `1C8Y-0` | desktop / mobile |
| 9 | Thresholds · Store Manager | `1I9H-0` (drawer) / `1IY4-0` (mobile); save error `1III-0` | drawer / mobile |
| 10 | Print · variance flagged / clean | `1AMZ-0` / `1AP7-0` | A4 print route (pattern: `dispatch-print`) |
| 11 | Switch-ons from Session 1 | hub Counts card + Today's-count KPI (`1AYW-0`, `1J43-0`, `188X-0`); sidebar Daily count / Spot count; top-bar Thresholds + Spot count; attendant "Daily count" button | desktop + mobile |
| — | Loading / empty / error for 1–10 | States kit `1I6L-0` + §0.1 rows | both |

For #11, remove the "Coming with counting" disabled state everywhere
Session 1 added it (`COMING_WITH_COUNTING` in `inventory-shell.tsx`,
`ComingSoonButton`, the sidebar sub-links, the mobile hub buttons). Also give
the attendant's hub **Today's count** copy its real states.

---

## Backend build order

`backend/src/modules/inventory/` as `count-*` and `thresholds-*` siblings
(plan §5). Every route: `authenticate` + `requireRole`, Zod input, every
repository query org-scoped, business logic in services only.

1. **Migration (additive):** `StockCount`, `StockCountLine`
   (`reasonRequired` bool included), `CountReason`/status/kind enums,
   `CountingThresholds`; `InventoryTransaction.stockCountLineId` → real FK.
   Daily uniqueness via partial index on `(locationId, countDate)` where
   `kind = 'DAILY'`. `prisma migrate dev` refuses non-interactive shells —
   use `migrate diff --script` into a timestamped folder + `migrate deploy`
   (Session 1 outcome log, deviation 7).
2. **Endpoints (§2.2):** `GET /inventory/counts`, `GET /inventory/counts/today`
   (get-or-create), `PUT …/:id/lines`, `POST …/:id/submit` (PIN),
   `GET …/:id` (role-split views), `PATCH …/:id/lines/:lineId`,
   `POST …/:id/return`, `POST …/:id/approve` (PIN; 409 `REASON_REQUIRED` /
   queried lines), `POST /inventory/spot-counts` (PIN), `GET …/:id/print`,
   `GET/PUT /inventory/thresholds` (SM part), `PUT /inventory/thresholds/director`.
   Update `GET /inventory/stock/summary` `todaysCount` from "no count yet"
   to real data. Business date = Africa/Nairobi.
3. **Tests:** service tests (snapshot on submit; uncounted lines never
   adjusted; approve writes one `ADJUSTMENT` per accepted non-zero variance
   with `ADJ-` refs in one transaction; reason-required uses the stored
   threshold; send-back reopens only queried lines; spot count = verified +
   adjustments in one step; notifications after commit); contract tests
   freezing every response; **blindness test** over every attendant-facing
   count response; org-scoping + role tests (attendant can't verify, SM
   can't write branch threshold fields).
4. Docs: `API_CONTRACT.md` §26.2, `DATA_MODEL.md` next free §4.x.
5. `pnpm build && pnpm test` green → **commit (backend)**.

**Checkpoint (hard stop):** append a backend handoff to "Outcome log"
(endpoints with example responses, deviations, seed state). If context is
below ~40%, stop and tell the owner.

**Seed for the gate** (dev-only fixture script, idempotent, never
production): a submitted daily count matching `181V-0` (attendant Sarah
Achieng, "Submitted 07:10"); a verified record matching `18GE-0`; a spot
count; thresholds at defaults. **Write dates relative to "now" on every run**
— Session 1's fixture wrote them once, so they aged out of the 7-day window
within days (outcome log, "Seed drift").

---

## Frontend build order

`frontend/features/inventory/`; pages in `app/` are thin shells.

**At the start:** load `emil-design-eng`. While writing components:
`building-components`, `vercel-composition-patterns`. Audit step of each
gate: `web-design-guidelines`. Browser: `run-frontend-browser`
(chrome-devtools MCP).

1. Reuse Session 1's pieces — don't rebuild them: States kit
   (`components/stock/stock-states.tsx`), `StockMobileHeader`,
   `STOCK_DRAWER_MOTION` + `useReturnFocus`, `FormErrorBanner`,
   `HighlightOnChange`, `HintTooltip`, `stock-format.ts`, `useResource`
   (`hooks/use-stock.ts`), the existing PIN sign sheet
   (`components/app/shell/sign-sheet`).
2. Screens in demo order: Daily count (entry → PIN → submitted → returned)
   → Verify (awaiting → queried/send back → verified) → Spot count →
   Thresholds → Print → Session 1 switch-ons.
3. Wiring: hub Counts card "Verify" button → Verify; approve → toast +
   `HighlightOnChange` on hub KPIs; ledger `?highlight=` links from the
   verified record's adjustments.
4. `pnpm build` (incl. `check-wds-tokens`) green → **commit (frontend)**.

### The per-screen gate — plan §4.4, every state, before the next

Implement from `get_jsx`/`get_computed_styles` → screenshot Paper →
screenshot live (same viewport, real seeded data) → **eyeball** side by side
(no automated pixel-diff — banned) → interaction audit (§4.2 baseline +
list below) → `web-design-guidelines` → fix → re-check → one line in the
outcome log.

| Screen | Screen-specific interactions |
|---|---|
| Daily count | category tabs with live "8/24" counters; Enter auto-advances to the next count field; counted fields show a filled state; partial-save indicator ("Saved 07:08"); submit opens the PIN sheet; success screen; no animation on repeated typing |
| Returned recount | only queried lines editable; the SM's note shown without the expected figure |
| Verify | rail selection updates detail without a full reload; Accept/Query per line with a state-change animation; reason control appears (height transition) when required; footer switches between "Approve & sign" and "Send back to attendant" when any line is queried; Print opens the print route |
| Spot count | add-item combobox; rows removable; reason field on above-threshold lines; recent spot counts panel |
| Thresholds | KES input with the live example ("a −9 kg chicken gap at KES 90/kg = KES 810 → reason required"); Director amount read-only; Save disabled until dirty; dirty guard on close; success toast; "last changed by … on …" updates after save; save error = banner `1III-0` |

---

## Session 1 lessons to apply (from its outcome log)

- **Browser:** the owner's Chrome runs at 67% zoom — emulate `960x654x1`
  for a true 1440×981 desktop, `390x844x1,mobile,touch` for mobile. Under
  touch emulation the devtools `click` doesn't fire click events — use
  `evaluate_script` clicks. Wait for hydration before clicking or
  submitting (the login form). If a page renders but never hydrates after a
  branch switch, restart `next dev -p 3001` (stale `.next` chunks).
- **Frontend on port 3001** (`FRONTEND_ORIGIN`). `tsx watch` sometimes misses
  backend edits — `touch src/server.ts` and wait for `/health`.
- Type tokens don't map by name (`text-wds-field-label` ≠ `text-wds-label`;
  `text-wds-h1` is 26/32, Paper page titles are 24/30). Tailwind is v3 — use
  arbitrary values. Check line-heights: `text-wds-body-sm` carries 19px,
  Paper rows often use 16px.
- Disabled-but-drawn controls: `aria-disabled` + `HintTooltip`, never native
  `disabled`; hints must not overflow the viewport or sit under a scroll
  container's clip.
- State updates from rapid taps (steppers, count inputs): compute inside the
  `setState` updater.
- Anything `/app/branch/*` is MANAGER-only in `middleware.ts` unless widened
  (Session 1 widened ledger + waste for department heads).
- En-GB `Intl` prints "Sept" — use the `stock-format.ts` date helpers.

---

## Definition of done

- The demo in "Context" works end to end in a real browser (attendant
  mobile, SM desktop + mobile).
- Every screen/state in the table passed its gate and has a line in the
  outcome log.
- Postgres checks: every `ADJUSTMENT` from a count has `stockCountLineId`
  and an `ADJ-` reference; Σ ledger per item after approval = the counted
  figure for every accepted line; uncounted and queried lines wrote nothing;
  no attendant-facing response contains `expectedQty`/on-hand/variance (the
  contract test passes).
- `backend: pnpm build && pnpm test` and `frontend: pnpm build` green.
- Commits: backend, frontend (+ docs), each ending with the attribution line
  from the session's system reminder. Don't push unless the owner asks.
- `milestone-6-plan.md` §8 appended; `MILESTONES.md` Session 2 status; this
  file's "Outcome log" filled in.

---

## Outcome log

_(filled in by the build session — backend checkpoint first, then one line
per screen/state gate, then the end-of-session summary)_

### Checkpoint handoff — backend (2026-09-29, branch `feat/m6-s2-counting`)

**Shipped.** Migration `20260929090000_milestone6_session2_counting` (additive:
`StockCount`, `StockCountLine`, `CountingThresholds`, four enums,
`InventoryTransaction.stockCountLineId` → real FK + index; the DAILY-uniqueness
partial index is appended to the generated SQL). Module files in
`backend/src/modules/inventory/`: `count-{validators,types,repository,service,controller,routes,calc}`,
`thresholds-{validators,types,repository,service,controller}`,
`counting-thresholds.ts` (defaults). `fcmService` gained
`sendCountSubmittedPush` / `sendCountDirectorAlertPush` (called after commit,
never awaited inside a transaction). Docs: `API_CONTRACT.md` §26.2,
`DATA_MODEL.md` §4.70–4.72 + §4.52 update. `backend pnpm build` + `pnpm test`
green (86 files, 1,078 tests; 46 new incl. the blindness test on the serialized
JSON of every attendant-facing response).

**Verified live** (real API + local Postgres, before the fixture seed): attendant
`GET /counts/today` → 142-line blind sheet (7 category tabs, no expected/variance
keys), partial save, wrong PIN 401, submit; SM list/view/decide/return; the
attendant's RETURNED view shows only the queried line with the SM's note;
non-queried recount → 409 `COUNT_LOCKED`; resubmit before recount → 409
`RECOUNT_INCOMPLETE`; approve → `ADJ-0001…0003` rows in Postgres, each with
`stock_count_line_id`; ledger counterparty reads "Daily count · verified by
J. Mwangi"; spot count → `SPT-0001` VERIFIED + 1 adjustment; SM threshold save;
branch fields → 400; SM Director write → 403; attendant → 403 on SM routes.

**Endpoints** — see `API_CONTRACT.md` §26.2 for shapes. Example (fixture seed):
`GET /inventory/counts` → `[{reference:"CNT-2026-0929", status:"SUBMITTED", itemCount:142, varianceLines:6, netVarianceValue:"-3120"}, {reference:"CNT-2026-0928", status:"VERIFIED", itemCount:36, adjustmentCount:6, netVarianceValue:"-1240"}, {reference:"SPT-0001", directorNotified:true, netVarianceValue:"-6500"}, {reference:"SPT-0002", netVarianceValue:"-180"}]`;
`GET /inventory/counts/:id` (SM, today) → `totals {lines:142, matchedLines:136, varianceLines:6, aboveThreshold:2, netVarianceValue:"-3120"}`;
`GET /inventory/stock/summary` → `todaysCount {status:"SUBMITTED", submittedAt:"…T04:10:00Z" (07:10 Nairobi), submittedByName:"Sarah Achieng", countedLines:142, totalLines:142}`.

**Deviations from the plan (and why):**
1. **`StockCountLine.firstCountedQty` and `queryNote` added.** Send-back clears
   the queried line's `countedQty` (so the recount is genuinely blind, and
   "recounted?" is just `countedQty !== null`) — the first figure is kept in
   `firstCountedQty` for the audit trail. `1F4N-0` draws a per-line note ("Recount
   the back shelf…") in addition to the count-level note, hence `queryNote`.
2. **`CountingThresholds.directorUpdatedById/At` added** so the SM drawer's "last
   changed by" is never the Director's edit of the company-wide amount.
3. **`unitCost` frozen at submit** with the snapshot (plan §1.2 said "at verify")
   — otherwise `reasonRequired` (stored at submit) and the KES figure the SM sees
   could disagree if a receipt moved the current cost between the two.
4. **Approve also blocks `LINES_UNDECIDED`** (a counted variance line still
   PENDING) — the plan lists only `REASON_REQUIRED` / queried lines, but silently
   skipping an undecided variance would drop it from the ledger with no trace.
   Zero-variance counted lines are auto-`ACCEPTED` at submit, so the SM only
   decides real variances.
5. **`GET /inventory/counts` has no waste roll-up row** — the hub already has
   `GET /inventory/waste`; the frontend composes the roll-up row from it.
6. **`TodaysCount` gained `countedLines` / `totalLines`** (progress, never
   quantity; safe for the attendant) so the attendant hub can say "8 of 142
   counted" and SM/attendant cards have real states.
7. **`MANAGER` may `GET /inventory/thresholds`** (their branch row, defaults
   1,000 / 500) as the contract lists, but `PUT` stays SM-only until Session 3.
8. `prisma migrate dev` was not used (non-interactive) — `migrate diff --script`
   into a timestamped folder + `migrate deploy`, as in Session 1.

**Seed state** — `npx tsx src/scripts/seed-counting-dev-fixtures.ts
[--state=submitted|draft|returned|none]` (dev-only, idempotent, dates
recomputed from "now" every run; run after `seed-stock-waste-dev-fixtures.ts`).
It removes all previous count-derived rows, reshapes the catalog to the count
tabs (Dairy 24 · Dry goods 45 · Produce 18; the 142 live-item total is
unchanged — surplus filler items are renamed, not added; "Whole chicken 1.2kg" and
"Fresh cream 250ml" exist), then writes: yesterday's VERIFIED daily count
(`18GE-0`: 36 lines / 30 matched / 6 variance / net −KES 1,240, `ADJ-3402…3407`),
two VERIFIED spot counts (3 days ago — Director-flagged, Saffron −KES 6,500 — and
8 days ago, 1 adjustment −KES 180), and today's daily count in the chosen state:
`submitted` = `181V-0` (142 lines, 6 variance, 2 above threshold, net −KES 3,120,
submitted 07:10 by Sarah Achieng); `draft` = `18KU-0` (8 Dairy items counted);
`returned` = `1F4N-0` (chicken queried and sent back). Paper items other
sessions gate on are untouched (Milk 128, Coffee beans 12, Cooking oil 46, Rice
209 — Milk's yesterday variance is compensated by an earlier fixture receipt).
Thresholds row removed → defaults (500 / 5,000). Paper's Milk "124" reads 128
live (kept so Session 1's hub figures still hold).

**Context at checkpoint:** plenty remaining — continuing to the frontend in this session.
