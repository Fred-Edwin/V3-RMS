# Milestone Six — Session 3 (Branch day close) — Build Plan

**Scope: exactly as `milestone-6-plan.md` §0 "Session 3" and §6 define it** (owner
confirmed 2026-09-29 — no S4 work folded in). History, next-morning opening,
`DepartmentOpening*` tables and the integration pass stay in Session 4.

## Starting state

Session 2 is merged (PR #39) and so is the demo seed (#44). Branch:
`feat/m6-s3-day-close` off `main` (`929768c`).

---

## Read first (only the sections named)

1. `CLAUDE.md` — whole file.
2. `docs/features/inventory/milestone-6-plan.md` — §0 "Session 3" table, **§0.1
   rows for Today's day / Reopen / Thresholds**, **§1.4 `BranchDay*`, §1.5
   `BranchDayReopen`**, §1.7, §1.8 (`GapReason`), **§1.9**, §1.10, **§2.1 thresholds
   rows + §2.3 (S3 rows)**, §3, **§4 (build gate — binding)**, §5, §7 + Q-D/Q-E.
3. `session-2-plan.md` → Outcome log (patterns: snapshot-at-write, one
   transaction, notifications after commit, fixture seed, blindness contract test).
4. `docs/FEATURE_REDO_PLAYBOOK.md` §9, `docs/CODING_STANDARDS.md` §4 / §9,
   `docs/02-flows.md` Flows 12, 12a, 12b (the close / reopen / re-close rules).

**Paper:** file `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-G-0`. Values from
`get_jsx` / `get_computed_styles`, never screenshots. Layers named
`REMOVED (A#) …` are hidden on purpose.

---

## Purpose — what "branch day close" is (plain terms)

Every branch (e.g. Nyeri Town) has five departments — Kitchen, Pastry,
Barista, Service, Housekeeping — each holding its own stock at its own
`Location`. During the day the ledger moves on its own: dispatches arrive,
prep and waste are logged. **Nothing records consumption** (Stage 8: nobody
scans a latte's milk). So the system's *expected* quantity slowly drifts from
what is physically on the shelf.

**Closing the day** is when the Branch Manager (BM) walks the departments,
**counts what is actually there**, and signs. The system compares counted vs
expected. The difference for each item is the **gap**:

- most of a gap is normal consumption (milk used in drinks) — hence
  `CONSUMPTION` is a preset reason and the branch threshold is higher than the
  store's;
- a large gap needs an explained **reason** (unlogged waste, walk-in comp,
  suspected loss, other);
- signing posts one `ADJUSTMENT` ledger row per non-zero gap, so tomorrow's
  expected quantity starts from the real count. The signed day becomes an
  immutable record; the Director is pushed if any line is at/above the
  company-wide alert amount.

**A normal day:** morning stock arrives and is confirmed (Barista shows
"blocked" while its dispatch is still `IN_TRANSIT` — you can't count a
department that has stock in the van) → service → evening: BM opens **Today's
day**, per department enters counted quantities (partial saves are fine),
gives a reason on any line at/above the branch threshold, when all 5 are
counted and none blocked, **Sign & close** (PIN). Mistake found afterwards →
**Reopen** (reason mandatory, appended to an audit trail) → fix counts →
re-close; the re-close **reverses** the earlier adjustments with linked
opposite rows and posts fresh ones. Nothing is ever edited or deleted.

**Why it matters:** it's the only place shrinkage becomes visible at branch
level, it turns "we think we have" into "we counted", and it gives the
Director a signed, tamper-evident daily record per branch.

---

## Decisions already made (do not re-litigate)

- **BM enters counts** (plan §7 Q-1). Counted column = inputs while `OPEN`.
- **Reasons:** preset `GapReason` list + Other (note required) — same control
  as S2's `CountReasonControl`, different option set.
- **Thresholds user-set** (§1.9): branch `reasonRequiredKes` (default 1,000) and
  `overnightAlertKes` (default 500) are set by that branch's BM in a drawer;
  Director amount is read-only there ("Director alerts from KES 5,000 · set by
  the Director"). `PUT /inventory/thresholds` extends to `MANAGER` this session
  (own org only; Zod schema chosen by role).
- **`reasonRequired` is stored on each line when its gap is computed** — moving a
  threshold never changes a saved/signed line (same as S2).
- **Close preconditions (Q-D):** all 5 departments `COUNTED` (a department with no
  tagged items counts as done automatically), none BLOCKED, every
  above-threshold gap reasoned → else 409 with a `closeBlockers[]` list.
- **BLOCKED is derived, never stored** — any `IN_TRANSIT` dispatch to that
  department (`Dispatch.toOrganizationId` + `departmentTag`), so confirming a
  dispatch unblocks instantly.
- **`expectedQty` is a snapshot** taken when the line's count is saved:
  department on-hand at that moment excluding this day's own close adjustments.
  `unitCost` = cost carried into the department, snapshotted the same way.
- **Re-close reverses, never edits:** every active adjustment from the previous
  close gets a linked equal-and-opposite `ADJUSTMENT` (`reversesTransactionId`,
  already on the schema from S1; a row can be reversed once), then fresh ones.
- **No "never closed → flagged to Director"** (§7 Q-5) — no job, flag or push.
- **No offline queue** — server-side partial save only.
- **Director alert push** for branch lines ≥ `directorAlertKes` (after commit,
  fire-and-forget). Overnight-variance push is S4.
- **Reopen authority:** `MANAGER` (own branch) or `DIRECTOR` (API only).
- **Out of scope here:** Waste nav link stays a placeholder; history/opening
  are S4; the DH landing is untouched.

---

## Screens this session builds

| Screen | Node(s) | Device |
|---|---|---|
| Today's day · overview + dept detail (review) | `19C8-0` / `1CDC-0` + `1CFK-0` | desktop / mobile |
| Today's day · count entry | `1E13-0` / `1E8C-0` | desktop / mobile |
| Today's day · all counted → Sign & close enabled | `1EE4-0` / `1EPU-0` | desktop / mobile |
| Today's day · closed (Reopen entry point) | `1EJY-0` / `1ERZ-0` | desktop / mobile |
| Sign & close · PIN | reuse `PinSheet` (`features/inventory/components/stock/pin-sheet.tsx`) | both |
| Signed day-close document | `19S2-0` | desktop + print |
| Reopen a closed day | `19PY-0` / `1BYP-0` | drawer / mobile |
| Thresholds · Branch Manager | `1IR9-0` (E3) / `1J2L-0` (E4); save error `1III-0` (E5) | drawer / mobile |
| Loading / empty / error for each | plan §0.1 rows "Today's day", "Reopen", "Thresholds" — States kit `1I6L-0` | both |

Wire the branch sidebar **Day** link (`features/branch/components/branch-shell.tsx`,
was `href: '#'`) to `/app/branch/day`. `Waste` stays `#`.

Routes (thin shells in `app/`): `/app/branch/day`, `/app/branch/day-print/[id]`.
MANAGER-only in `middleware.ts` (already the default for `/app/branch/*`).

---

## Backend build order

New `backend/src/modules/branch-day/` (plan §5): `branch-day-{validators,types,
repository,service,controller,routes,calc}.ts` + tests. Every route
`authenticate` + `requireRole`, Zod input, every repository query org-scoped,
logic in services only (a `prisma.$transaction` in the service is allowed).
Wire the routes in `routes/index.ts`; extend `thresholds-*` in
`modules/inventory/`.

1. **Migration (additive):** `BranchDay` (`@@unique([organizationId,
   businessDate])`, `status OPEN|CLOSED`, `closedById?`, `closedAt?`,
   `reference DAY-####`, `reopenCount`), `BranchDayDepartment` (`departmentTag`,
   `locationId`, `status NOT_STARTED|COUNTED`, `countedById?`, `countedAt?`),
   `BranchDayLine` (`inventoryItemId`, `countedQty?`, `expectedQty`,
   `reason? GapReason`, `reasonNote?`, `unitCost`, `reasonRequired`),
   `BranchDayReopen` (append-only), enum `GapReason`,
   `InventoryTransaction.branchDayLineId` → real FK + index. `prisma migrate dev`
   refuses non-interactive shells — use `migrate diff --script` into a
   timestamped folder + `migrate deploy` (S1/S2 deviation).
2. **Endpoints (§2.3, S3 rows):** `GET /branch-day/today` (get-or-create) ·
   `GET /branch-day/:id/departments/:tag` · `PUT /branch-day/:id/departments/:tag/lines`
   (partial; status → COUNTED when every line counted; only while OPEN) ·
   `POST /branch-day/:id/close` (`{pin}`) · `POST /branch-day/:id/reopen`
   (`{reason}`) · `GET /branch-day/:id/document`. Extend
   `GET/PUT /inventory/thresholds` for `MANAGER`. Business date = Africa/Nairobi.
3. **Tests:** service tests for every rule in plan §4.5 — snapshot on save;
   partial counts; reason required uses the stored threshold; close blocked
   (uncounted / BLOCKED / unreasoned gap / wrong PIN); close writes one
   `ADJUSTMENT` per non-zero gap with `ADJ-` refs + `branchDayLineId` in one
   transaction; **reopen → re-close reversal math** (net of old + reversal = 0,
   fresh rows match the new counts, a row is never reversed twice); day is
   read-only once CLOSED; empty department auto-counted; Director push after
   commit. Org-scoping/role tests: hub actor can't read a branch day; DH → 403;
   MANAGER can't reach another branch; a BM can't write another branch's
   thresholds or the Director field. Contract tests freezing every response.
4. Docs: `API_CONTRACT.md` §26.3, `DATA_MODEL.md` next free §4.x.
5. `pnpm build && pnpm test` green → **commit (backend)**.

**Checkpoint (hard stop):** append a backend handoff to the Outcome log below
(endpoints + example responses, deviations, seed state).

**Seed for the gate** (dev-only, idempotent, dates recomputed from "now"; never
production): `seed-branch-day-dev-fixtures.ts --state=open|counting|ready|closed`
reproducing `19C8-0` (one department blocked by an `IN_TRANSIT` dispatch),
`1E13-0`, `1EE4-0`, `1EJY-0`.

---

## Frontend build order

New `frontend/features/branch-day/` (`components/ hooks/ services/ types/ index.ts`);
thin route shells in `app/`. Reuse: `PinSheet`, `CountReasonControl` (extend
with the `GapReason` option set, don't fork), `Reveal`, `StatCell`,
`HighlightOnChange`, S2's thresholds drawer (parametrize, don't copy), the
count-print pattern, `kpi-strip`, `drawer-shell`, `shell-states` +
`skeletons`.

Order: types/service/hooks → Today's day desktop (review → entry → ready →
closed) → mobile equivalents → PIN close flow → signed document + print →
Reopen (drawer + mobile) → Branch Manager thresholds drawer (E3/E4/E5) →
sidebar wire → loading/empty/error states per plan §0.1.

### The per-screen gate — plan §4.4, every state, before the next

Implement from Paper `get_jsx`/`get_computed_styles` → screenshot Paper →
screenshot live (same viewport, seeded state) → eyeball (no pixel-diff) →
interaction audit (§4.2 baseline + the rows below) → `web-design-guidelines` →
fix → record a line in the Outcome log. **Load `emil-design-eng` before the
first screen.**

### Screen-specific interaction rows (plan §4.3, extended)

| Screen | Interactions to tick |
|---|---|
| Today's day | department rail rows clickable, live status dot + label (Not started / Counted / Blocked); selecting updates the detail pane with no full reload; Counted column inputs (decimal keypad, Enter → next field, filled state); **gap + gap value recalculate live**; reason control appears (height transition) when the line reaches the branch threshold and is required; partial-save indicator ("Saved 18:02"); blocked department shows why + which dispatch, inputs disabled; **Sign & close** disabled with an `aria-disabled` + `HintTooltip` listing blockers; Sign & close → PIN sheet ("Signing…") → closed state; Thresholds + History entry points |
| Closed day | fully read-only; Reopen button opens the drawer / mobile sheet; "View signed document" |
| Reopen | reason textarea required (button disabled until non-empty), destructive-tone confirm, in-flight "Reopening…", success → day returns to OPEN + toast |
| Signed document | read-only, Print opens the print route (same pattern as `count-print`) |
| Thresholds (BM) | KES inputs with live example; Director amount read-only; Save disabled until dirty; dirty-guard on close; success toast; "last changed by … on …" updates |

## Session 1–2 lessons to apply

- Browser: owner's Chrome is at 67% zoom — emulate `960x654x1` for a true
  1440×981 desktop, `390x844x1,mobile,touch` for mobile. Under touch emulation
  use `evaluate_script` clicks. Wait for hydration before clicking/submitting.
  If a page never hydrates after a branch switch, restart `next dev -p 3001`.
- Frontend on port 3001 (`FRONTEND_ORIGIN`). `tsx watch` sometimes misses
  backend edits — `touch src/server.ts` and wait for `/health`.
- Type tokens don't map by name; Tailwind is v3 — use arbitrary values; check
  line-heights against Paper.
- Disabled-but-drawn controls: `aria-disabled` + `HintTooltip`, never native
  `disabled`.
- State updates from rapid taps/typing: compute inside the `setState` updater.
- `/app/branch/*` is MANAGER-only in `middleware.ts`.
- En-GB `Intl` prints "Sept" — use the `stock-format.ts` date helpers.

---

## Definition of done

- Demo works in a real browser: BM counts 5 departments; Barista is blocked
  until its dispatch is confirmed; closes with PIN; reopens; re-closes —
  Postgres shows linked reversal pairs.
- Every screen/state in the table passed its gate and has an Outcome-log line.
- Postgres checks: every close `ADJUSTMENT` has `branchDayLineId` + `ADJ-`
  reference; Σ ledger per (department, item) after close = counted figure; each
  reversal pair nets to zero and no row is reversed twice; nothing written for
  uncounted lines; a CLOSED day rejects line edits.
- `backend: pnpm build && pnpm test` and `frontend: pnpm build` (incl.
  `check-wds-tokens`) green.
- Commits: backend, frontend (+ docs), each ending with the attribution line from
  the session's system reminder. Don't push unless the owner asks.
- `milestone-6-plan.md` §8 appended; `MILESTONES.md` updated (also fix its stale
  M5 "Not started" and S2 "built on branch" lines); this file's Outcome log filled.

---

## Outcome log

### Backend (2026-09-29, branch `feat/m6-s3-day-close`, commit `bd5e838`)

**Shipped.** Migration `20260930090000_milestone6_session3_branch_day` (additive: `BranchDay`, `BranchDayDepartment`, `BranchDayLine`, `BranchDayReopen`, `BranchDayStatus`/`BranchDayDepartmentStatus`/`GapReason`, `InventoryTransaction.branchDayLineId` → real FK + index). New `backend/src/modules/branch-day/` (`-validators/-types/-repository/-service/-controller/-routes/-calc`). `PUT /inventory/thresholds` now accepts a Branch Manager (`{reasonRequiredKes, overnightAlertKes}`, own org only, `.strict()`). `fcmService.sendBranchDayDirectorAlertPush` (after commit). Ledger counterparty reads "End-of-day count" / "End-of-day count · reversed". Docs: `API_CONTRACT.md` §26.3, `DATA_MODEL.md` §4.73–4.76 + §4.52. `pnpm build` + `pnpm test` green (91 files, 1,155 tests; 36 new across `branch-day-service`, `branch-day-contract`, `thresholds-service`).

**Verified live** (real API + local Postgres): today get-or-create with derived BLOCKED; partial saves with server snapshot; close blockers → 409 `DAY_NOT_READY`; wrong PIN 401; close → `ADJ-` rows with `branch_day_line_id`; save on a closed day → 409 `DAY_CLOSED`; reopen; **re-close reversed both standing adjustments with linked equal-and-opposite rows and wrote the fresh one — Σ ledger per (department, item) equals the counted figure (coffee beans 12, croissants 4) and every reversal points at its original.**

**Deviations from the plan (and why):**
1. **Item set per department = tagged items ∪ items currently holding stock there.** A dispatch can land an untagged item (dev data has Baking Flour at Kitchen); leaving it uncounted would let it drift forever.
2. **`BranchDayLine` rows are created at the first save of an item's count** (uncounted items have no row; the read model shows the live expected figure). A cleared count keeps its last snapshot.
3. **`expectedQty` excludes this day's own close adjustments *and their reversals*** (all rows carrying a line of this day), so a re-count after reopen judges against the pre-close position.
4. **Departments show `COUNTING` (derived) between `NOT_STARTED` and `COUNTED`** — the design's rail draws it; only the first and last are stored.
5. **`yesterday.id` added** to `GET /branch-day/today` so the KPI card can link to the signed document.
6. **A reason is only kept on a `reasonRequired` line** — anything else is dropped on save so stale reasons never linger.
7. `prisma migrate dev` not used (non-interactive) — `migrate diff --script` + `migrate deploy`, as in S1/S2.

**Seed** — `npx tsx src/scripts/seed-branch-day-dev-fixtures.ts [--state=none|open|counting|ready|closed] [--block=BARISTA|none]` (dev-only, idempotent; drives the real service functions; sets the Nyeri Town manager's PIN to 1234; **rewrites the branch's dev dispatch fixtures** — confirms in-transit ones and re-points one at the blocked department).

### Frontend gates (2026-09-29)

New `frontend/features/branch-day/` + routes `/app/branch/day`, `/app/branch/day/document/[id]`, `/app/branch/day-print/[id]`; sidebar "Day" wired. Shared pieces reused from `features/inventory` through its `index.ts` (`PinSheet`, `CountReasonControl` — generalised over the reason set with a `flagEmpty` prop —, `Reveal`, `StatCell`, `StatusDot`, `HighlightOnChange`, states kit, `StockMobileHeader`, drawer motion, formatters, `useResource`). Every state below was compared against Paper in a real browser (desktop 1440×981 via 960×654 emulation, mobile 390×844) and its interactions exercised.

- **Today's day · overview + count entry (`19C8-0` / `1E13-0`; `1CDC-0` / `1E8C-0`) — passed.** Live gap and reason reveal (height transition), autosave with "Saved HH:MM", Enter → next field, department rail with derived status dots, blocker footer with `aria-disabled` + tooltip. Mobile KPI cells, faint sub-lines and 52px footer button aligned to Paper's values after a `get_jsx` pass.
- **Ready (`1EE4-0` / `1EPU-0`) — passed.** 5 / 5 in success green, success footer line, primary button. PIN sheet: wrong PIN inline "Incorrect PIN", correct PIN → toast "Day closed".
- **Closed (`1EJY-0` / `1ERZ-0`) — passed.** Read-only rows, "Closed" pill, View signed document + Reopen day.
- **Reopen (`19PY-0` / `1BYP-0`) — passed.** Button disabled until a reason; destructive tone; "Reopening…" in flight; day returns to Open + toast.
- **Thresholds · Branch Manager (`1IR9-0` / `1J2L-0`) — passed.** Live worked example, thousands separators, Director amount read-only, saves to the branch's own row (Postgres-checked), toast, dirty guard.
- **Signed document (`19S2-0`) + print — passed.** Signature in the bundled signature font; print route renders and calls `window.print`.
- **States kit** — loading skeletons mirror the layout with chrome intact (desktop verified); error card with Retry recovers (verified after clearing an API 429 caused by repeated test logins); blocked-department view shows inputs disabled with the explanation.

**Deviations from Paper (owner to confirm):**
1. **"Counted" status text reads success-green**; Paper draws it in the error red on `19C8-0`/`1EE4-0`, which reads as a fault (Closed is green on `1EJY-0`).
2. **Counted figures stay editable while the day is open** (Paper draws a fully-counted department as read-only text). A mistake found before signing shouldn't need a reopen.
3. **The mobile "History" link is drawn but disabled** (`aria-disabled` + tooltip) — Day close history is Session 4.
4. **Rail second line shows who counted (the Branch Manager)** — the design names the department head; counts are entered by the Branch Manager (§7 Q-1).
5. The shared PIN sheet's desktop dialog doesn't clear the boxes after a wrong PIN and Enter doesn't submit — that is Session 2's component; noted, not changed here.

**Checks:** `backend pnpm build && pnpm test` (91 files, 1,155 tests) and `frontend pnpm build` (+ `check-wds-tokens`) green; `vitest features/branch-day` 6 tests; eslint clean on all new code (15 pre-existing errors in `features/inventory`, unchanged).

**For the owner:** (1) the five deviations above; (2) `use-stock.ts` gained `'use client'` because the inventory barrel now re-exports `useResource` and server-component pages import that barrel; (3) the dev fixture seed rewrites Nyeri Town's dispatch fixtures; (4) Session 4 is next — history list/detail, next-morning opening, integration pass.
