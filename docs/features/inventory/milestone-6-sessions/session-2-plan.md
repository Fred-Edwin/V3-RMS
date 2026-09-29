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

### Frontend gates (2026-09-29)

_One line per screen/state gate (eyeball vs Paper → interaction audit → `web-design-guidelines` → fix → re-check). Browser: chrome-devtools MCP, mobile `390x844x1,mobile,touch`, desktop `960x654x1` (= 1440×981 CSS), the Store Manager in an isolated context so both roles run side by side._

- **Daily count · blind entry (`18KU-0`) — passed.** Tabs = top-level categories with live "8/24" counters, default tab = the one in progress; Enter advances field → field and, on a tab's last field, into the next tab; typing sanitised to digits + one point; autosave 700ms after the last keystroke, "Saved 12:03" / "Saving…" / "Not saved · retry" + the kit banner (verified with a PUT forced to fail, then recovered); counters update from the local draft. Deviations: the saved indicator lives in the category header (Paper draws only "8 of 24 counted" there — the plan asks for the indicator and the footer line has no room); a counted box reads by its ink figure and Paper's espresso border is the *focus* ring (the plan's "filled state" = white fill + ink figure); tabs scroll horizontally (Paper's "…" chip); rows sort by name, so Paper's Milk / Fresh cream / Butter order isn't reproduced.
- **Daily count · PIN (`18MQ-0`) — passed.** Shared `PinSheet` (mobile bottom sheet with drag handle + swipe-down dismiss and 250ms drawer curve; desktop reuses the centred `SignSheetDialog`). Found and fixed: `input-otp`'s `render` prop doesn't provide slot context (crash) → slots passed as props; the input lost focus after a failed PIN (disabled while signing) → refocused; wrong PIN clears the boxes and shows "Incorrect PIN" inline; a wrong PIN never writes.
- **Daily count · submitted (`18P9-0`) — passed.** Copy says "the Store Manager" where Paper names Joseph Mwangi — the blind view doesn't carry the SM's name (deliberate; the recount state does have `returnedByName`).
- **Daily count · returned for recount (`1F4N-0`) — passed.** Only the queried line is editable, the SM's note shown without any figure, "Only the queried line — still blind", footer "Sign & resubmit" (disabled until the line is recounted; Paper draws it enabled); caption names the SM from `returnedByName`. Real recount → resubmit verified end to end.
- **Verify · awaiting (`181V-0` / `1C2H-0` + `1C47-0`) — passed.** Desktop: KPI strip reused (`HubKpiStrip` moved to `stock/hub-kpi-strip.tsx`), full-bleed master-detail with the dark `neutral-800` hairline top + rail divider (from `get_computed_styles`), 380px rail, detail scrolls inside. Accept / Query per line (optimistic, PATCHes serialised), reason control appears with a grid-rows height transition, "Approve & sign" disabled with a hint listing what's missing ("2 lines need a decision"), approve → PIN → toast + KPI / rail refresh. Mobile: list (`1C2H-0`) → detail (`1C47-0`) via `?id=`, sticky footer. Deviations: a "Variances (6) / All lines (142)" filter (default Variances — 136 matching rows would bury the six that matter; Paper draws all 142 in order); undecided variance lines block approval (server `LINES_UNDECIDED`); the page-title size is the hub's `wds-h1` (Paper 24/30, S1 known); rail's waste roll-up row is composed from `GET /inventory/waste` and links to the hub.
- **Reason select open (`1D7W-0`) / "Other" (`1DAK-0`) — passed.** One `CountReasonControl` (preset list + "Other (describe)"): "Other" is held locally until it has a note (a PATCH without one is refused by the server — found the hard way), note capped at 120 chars with the "Required for Other · 73 / 120" counter as `1DAK-0` draws it.
- **Verify · line queried → "Send back" (`1EUG-0` / `1F1I-0`) — passed.** Query focuses the per-line note ("QUERY — sent to the attendant with the recount"), Undo restores, footer swaps to "NOTE FOR SARAH — optional · 1 line queried, sent back blind" + "Send back to attendant"; mobile adds Paper's grey explanation. **Correction to the backend:** the send-back note is optional (`1EUG-0` says so; the endpoint required it) — schema, service, tests, contract updated. Found and fixed: after send-back the queried line vanished from the list (its count is cleared) → queried lines stay listed with the first count and "recount pending".
- **Verify · verified record (`18GE-0` / `1C71-0`) — passed.** Adjustment table with `ADJ-####` links to the ledger (`?highlight=<txId>`), stats at Paper's sizes (28/24/28/20), Alex Brush signatures, Director-notified cell. Deviation: Paper's per-row "···" menu is omitted (its only action is the ADJ link). Mobile stat cells compact (12px padding).
- **Spot count (`1BC1-0` / `1C8Y-0`) — passed.** Add-item combobox over `GET /inventory/stock?search=` (debounced; Enter never picks from a stale list), rows removable (× — an addition to Paper), reason control per above-threshold line judged live against the stored threshold, recent-spot-counts panel, PIN → `VERIFIED` + adjustments, toast "1 adjustment written · net −KES 7,080 · a Director was alerted." Mobile category chips filter the picker. `beforeunload` guard while rows are typed (nothing is written before the signature).
- **Thresholds · Store Manager (`1I9H-0` / `1IY4-0` / error `1III-0`) — passed.** Desktop drawer 440px (250ms), mobile full-screen; live worked example recalculates against the typed value; Director amount read-only; Save disabled until dirty + valid; dirty-guard on close; "Last changed by … · 12 Sep" from the API (default: "Using the default — not changed yet"); failed PUT → kit banner with the edit kept. Wired from the top bar (own state inside `StockTopbar`) and the mobile hub.
- **Print · flagged / clean (`1AMZ-0` / `1AP7-0`) — passed.** `/app/inventory/count-print/[id]` outside `(shell)`, auto-prints, same Times New Roman A4 pattern; top-3 adjustments + "+ N more (ADJ-x–y)" beyond four; note text switches on clean / flagged / spot. Alex Brush falls back to a serif in this dev sandbox (Google Fonts unreachable) — production fetches it.
- **Session 1 switch-ons — passed.** "Coming with counting" removed everywhere (`COMING_WITH_COUNTING`, `ComingSoonButton`); sidebar Daily count (SM → Verify, attendant → blind count) / Spot count; top-bar Thresholds + Spot count; hub Counts card (real rows, Verify button on the pending count, empty/error/loading), Today's-count KPI (links to the count) and mobile card in every state; attendant hub copy per state.
- **Loading / empty / error.** Kit pieces throughout (`stock-states`): rail / detail skeletons, "Nothing to verify", "Couldn't load counts" (verified with the request forced to fail — found the detail pane stayed a skeleton forever → now "Pick a count on the left to review it."), count-sheet loading/error, save banners, sign banners.

### End-of-session summary (2026-09-29)

**Built:** backend `43844ef` (+ the optional-note correction) and the frontend commit on `feat/m6-s2-counting` (not pushed). Every screen in the table (1–11) and its loading / empty / error states passed the gate above.

**Functional pass (real browser, both roles):** attendant counts blind on mobile → autosave → PIN → SM verifies on desktop, queries the chicken → "Send back" → attendant recounts only that line → SM approves on **mobile** with a PIN → `ADJ-####` rows in the ledger; the ledger's `?highlight=` link lands on them; the verification document prints; hub KPIs / Counts card update; spot count signs and alerts a Director; thresholds save.

**Definition-of-done checks (Postgres):** every count `ADJUSTMENT` has `stock_count_line_id` and an `ADJ-` reference (0 exceptions); Σ ledger per item = the counted figure for every accepted line (Coffee beans 5 after the later spot count; chicken 26; …); uncounted and queried lines wrote nothing (0); adjustment quantity = counted − expected for every linked row (0 mismatches); the blindness contract test covers every attendant-facing response and the attendant's summary carries progress counts only. `backend pnpm build && pnpm test` (86 files, 1,079 tests) and `frontend pnpm build` (+ `check-wds-tokens`, 422 files) green.

**For the owner:** (1) the dev fixture seed now reshapes the catalog (Dairy 24 · Dry goods 45 · Produce 18) and renames filler items — see the backend checkpoint; (2) the seed's states (`--state=submitted|draft|returned|none`) reproduce each gate screen; (3) Paper's Milk "124" reads 128 live so Session 1's hub figures still hold; (4) the "Variances / All lines" filter, the removable spot rows and the saved-indicator placement are small additions to Paper listed above; (5) Session 3 can reuse `PinSheet`, `CountReasonControl`, `Reveal`, `StatCell` and the print pattern.

**Next:** Session 3 — Branch day close.
