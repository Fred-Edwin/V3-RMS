# Milestone Six (Counting, Closing & Discrepancies) — Step 5 High-Level Plan

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Milestone:** **Six — Counting, Closing & Discrepancies** — Stage 8
(consumption: no new build, still count/waste-driven) + Stage 9 (Counting &
closing the day), Central Store and Branch.
**Step:** 5 of the per-feature pipeline — high-level plan
**Status:** Draft for owner review, 2026-09-24. Alignment answers and the
Q-A/Q-B/Q-C + thresholds decisions folded in (see §7). **Blocked on:** the Paper design pass (§6.0), which must land and be
owner-approved before Session 1 starts.
**Date:** 2026-09-24

**Traces to:**
`01-description.md` §3 Stage 8, Stage 9 ·
`02-flows.md` Flows 4, 5, 5a, 6, 12, 12a, 12b, 12c, 13, 19, 20, 21, Appendix A/B/C ·
Paper page `Milestone Six · Counting, Closing & Discrepancies` (`p-G-0`) in
file `01M1ZZJ6S3FZGF5C7PPBGTKY89` ·
`milestone-5-plan.md` (the precedent this plan follows; its §4 build gate is
carried forward and tightened here) ·
`WALKTHROUGH_FINDINGS.md` §2 (the interactivity gaps earlier milestones
shipped with — the reason §4 of this plan exists) ·
`docs/FEATURE_REDO_PLAYBOOK.md` §5, §7, §8, §9 ·
`docs/CODING_STANDARDS.md` · `docs/API_CONTRACT.md` §26 (new) ·
`docs/DATA_MODEL.md` §4.66+ (new).

---

## Context

Milestones One–Five shipped; the two interactivity catch-up sessions
(`WALKTHROUGH_FINDINGS.md` Sessions 2–3, commit `f44d3f9`) fixed screens that
matched Paper visually but shipped static — no hover, no in-flight state, no
feedback. **The single most important process goal of this milestone is that
no such catch-up pass is needed afterwards.** §4 is how.

"Discrepancies" in this milestone's name is mostly already built: transit
discrepancies (resolve + list, Flow 11) were pulled forward into Milestone
Five. What remains here is **count-variance alerting** (Flow 20, count branch)
only. No alert inbox.

### What already exists and is reused (verified in code 2026-09-24)

| Piece | Where | Used for |
|---|---|---|
| Live on-hand derivation | `inventory-repository.ts` `sumOnHandByItemForLocation` | stock list, expected qty, ledger running balance |
| `RestockLevel` + `GET/PUT /inventory/restock-levels` | Milestone One | restock drawer/mobile (SM), DH restock screen already built (`DepartmentRestockLevelsScreen`) |
| `ReferenceCounter` | Milestone Two | `CNT-`, `SPT-`, `ADJ-` numbering |
| PIN signing (`comparePin`, `sign-sheet.tsx`, Radix-based, spinner "Signing…") | M4/M5 | daily count submit, verify approve, spot count, day close |
| Unconfirmed-dispatch state (`Dispatch.status = IN_TRANSIT`) | `dispatch-repository.ts` | "Barista · blocked" |
| Fire-and-forget push (`fcmService.send…Push`) | M4/M5 | count submitted, variance alerts, overnight variance |
| `allowDepartmentHead(requireRole('MANAGER'))` | requisitions routes | DH-scoped branch endpoints |
| `Location` per (branch org, `DepartmentTag`) + `InventoryItem.departmentTags` | M1/M4 | which items each department counts |
| ui2 primitives: `sheet`, `toast`, `skeleton`, `toggle-group`, `input-otp`, `select`, `combobox`, `confirm-dialog`, `table`, `status-dot` | `frontend/components/ui2/` | every screen here |
| `HighlightOnChange`, `skeletons.tsx`, `kpi-strip.tsx`, `drawer-shell.tsx`, `restock-level-grid.tsx` | features/inventory, requisitions | KPI flashes, loading states, drawers |
| Department landing placeholders ("Opening count", "Log waste" — disabled) | `department-landing-screen.tsx:176-207` | wired live in S1 (waste) / S4 (opening) |
| Branch shell nav "Day" + "Waste" (`href: '#'`) | `branch-shell.tsx:31-32` | "Day" wired in S3; "Waste" stays placeholder (out of scope) |

### Housekeeping debt found

`docs/API_CONTRACT.md` has no §25 (Milestone Five) and `DATA_MODEL.md` has no
`Dispatch`/`DispatchLine`/`Discrepancy` entries — Milestone Five's plan named
them but they were never written. Session 1 backfills both before adding this
milestone's §26 / §4.66+, so numbering stays honest.

---

## §0. Scope — artboards by session

Node IDs are on page `p-G-0`. **Rows marked (DP) are added or changed by the
design pass (§6.0); that session fills in their node IDs here.** Loading /
empty / error states are **not** drawn per screen (owner decision
2026-09-25): every screen builds them from the States kit artboard plus the
per-screen copy in §0.1. "+L/E/Err" in a row means "see §0.1".

### Session 1 — Stock position & waste

| Screen | Node(s) | Device | Notes |
|---|---|---|---|
| Stock & counts hub · SM | `1AYW-0` | desktop | landing page; "Counts" card + "Today's count" KPI render their *no count yet* state until S2 · top bar now Thresholds · Restock levels · Log waste · Spot count (DP) · +L/E/Err → §0.1 (worked example `1FG7-0`) |
| Stock & counts hub · Attendant | `188X-0` (DP — quantities removed, see §7 Q-A; removed layers kept hidden as `REMOVED (A1 …)`) | mobile | +L/E/Err → §0.1 (worked example `1G39-0`) |
| Stock & counts hub · SM mobile | `1J43-0` | mobile | added 2026-09-25 (owner): same screen as `188X-0`, role-aware — SM adds Spot count + Thresholds actions, KPI cards, On hand list |
| All items | `1B5U-0` / `1BRS-0` | desktop / mobile | +L/E(no match)/Err → §0.1 |
| Stock ledger drill | `197U-0` / `1BPY-0` | desktop / mobile | "Viewing as" control removed on `197U-0` (hidden layer `REMOVED (A9)`); no-item picker for the bare "Stock ledger" sub-link: `1F7B-0` / `1FDY-0` · +L/E/Err → §0.1 |
| Restock levels · Central Store | `18ZV-0` / `1BV6-0` | drawer / mobile | reuses `restock-level-grid.tsx` |
| Restock levels · Department | `1AEE-0` | mobile | **already built** (M1) — parity check only |
| Log waste · Central Store | `18VZ-0` / `1BX0-0` | drawer / mobile | mobile shared by SM + Attendant; Attendant hint shows cost only (note in artboard names) · submit error: worked example `1I1M-0` |
| Log waste · Department | `1ACM-0` | mobile | wires the DH landing "Log waste" placeholder |
| S2 features in S1 (owner 2026-09-25) | — | desktop | Thresholds button, Daily count / Spot count sub-links and the Counts card render as drawn but **disabled** with a "Coming with counting" tooltip until S2 |
| Sidebar sub-links under Stock & counts | ref `1BI5-0` | desktop | on **every** Stock & counts page — done on `1AYW-0`, `1B5U-0`, `181V-0`, `18GE-0`, `1BC1-0`, `18VZ-0`, `18ZV-0`, `197U-0` with the right sub-link active |

### Session 2 — Central Store counting

| Screen | Node(s) | Device | Notes |
|---|---|---|---|
| Daily count · blind entry | `18KU-0` | mobile | tabs relabelled to categories (DP, §7 Q-C) |
| Daily count · PIN | `18MQ-0` | mobile | info-strip overflow fixed (DP) |
| Daily count · submitted | `18P9-0` | mobile | status bar order fixed (DP) |
| Daily count · returned for recount | `1F4N-0` | mobile | new state — queried lines only, still blind |
| Verify · awaiting | `181V-0` / `1C2H-0` + `1C47-0` | desktop / mobile list + detail | reason control unified; select open `1D7W-0`, "Other" chosen `1DAK-0` |
| Verify · line queried → "Send back" footer | `1EUG-0` / `1F1I-0` | desktop / mobile | new state; the query note sent to the attendant never states the expected figure |
| Verify · verified record | `18GE-0` / `1C71-0` | desktop / mobile | rail width + KPI label type made consistent with `181V-0` |
| Spot count | `1BC1-0` / `1C8Y-0` | desktop / mobile | reason is the unified select |
| Thresholds · Store Manager | `1I9H-0` (E1) / `1IY4-0` (E2); save error `1III-0` (E5) | drawer / mobile | opened from the Stock & counts top bar; §1.9 |
| Print · variance flagged / clean | `1AMZ-0` / `1AP7-0` | A4 | print route, same pattern as `dispatch-print` |

### Session 3 — Branch day close

| Screen | Node(s) | Device | Notes |
|---|---|---|---|
| Today's day · overview + dept detail (review) | `19C8-0` / `1CDC-0` + `1CFK-0` | desktop / mobile | mobile label/number error fixed; quiet Thresholds entry (desktop top bar, mobile header next to History) |
| Today's day · **count entry** (Counted column as inputs) | `1E13-0` / `1E8C-0` | desktop / mobile | new state — §7 Q-1 |
| Today's day · all counted → Sign & close enabled | `1EE4-0` / `1EPU-0` | desktop / mobile | |
| Today's day · closed (with Reopen entry point) | `1EJY-0` / `1ERZ-0` | desktop / mobile | new — the missing Reopen button |
| Sign & close · PIN | reuse `sign-sheet` | both | same sheet as S2 |
| Signed day-close document | `19S2-0` | desktop + print | |
| Reopen a closed day | `19PY-0` / `1BYP-0` | drawer / mobile | mobile submit button added |
| Thresholds · Branch Manager | `1IR9-0` (E3) / `1J2L-0` (E4); save error `1III-0` (E5) | drawer / mobile | opened from Today's day; §1.9 |

### Session 4 — History, next-morning opening, integration

| Screen | Node(s) | Device | Notes |
|---|---|---|---|
| Day close history · list | `1BN0-0` / `1CB2-0` | desktop / mobile | "Never closed — flagged to Director" row removed (hidden layer `REMOVED (A11)`, §7 Q-5) |
| Day close history · detail | `1CMM-0` / `1CSZ-0` + `1D2G-0` | desktop / mobile | reasons read-only; "Reopen day" beside "View signed document" |
| Next-morning opening · review sheet | `1A5R-0` | mobile | over the DH landing (M4 screen 0) |
| Next-morning opening · accepted | `1BIS-0` | mobile | landing card + toast |

### §0.1 States — loading / empty / error

Built from the **States kit** artboard `1I6L-0` (rules + pieces). Worked
examples: `1FG7-0` (hub · SM desktop · loading), `1G39-0` (hub · Attendant
mobile · empty), `1I1M-0` (log waste drawer · submit error). In code:
`shell-states.tsx` `EmptyState` / `ErrorState` + ui2 `Skeleton`. Chrome
(nav, top bar, title, filters, primary actions) never skeletons. Every page
error ends in **Retry**; every drawer/sheet/form error is the kit banner at
the top of the body, input kept, primary button retries. "—" = no empty state
(the screen can't be empty).

| Screen | Loading pieces | Empty — title / body / action | Error — title / body |
|---|---|---|---|
| Hub · SM (desktop) | KPI "—" ×4; table row ×7; list row ×2 (Counts); short row ×3 (Waste) | Counts card: "No count yet today" / "The attendant's daily count will appear here once submitted." / — · Waste card: "No waste logged in the last 7 days" / "Anything spoiled, expired or damaged goes through Log waste." / — | "Couldn't load the stock position" / "Check your connection and try again. Nothing has changed at the Central Store." |
| Hub · Attendant (mobile) | status card; short row ×4 | as example `1G39-0`: count card "No count yet today — tap Daily count to start."; waste "No waste logged in the last 7 days" / as above / — | "Couldn't load today's count and waste" / "Check your connection and try again. You can still start the daily count." |
| All items | desktop table row ×7 / mobile list row ×7; footer "Loading items…" | "No items match these filters" / "Nothing called "{query}" in the Central Store catalog. Try another name, or clear the filters." / **Clear filters** | "Couldn't load the item list" / "Check your connection and try again. Your filters are kept." |
| Stock ledger · item selected | KPI "—" ×3 (location stays real); table row ×4 / mobile movement row ×4; footer "Loading movements…" | "No movements in the last {range}" / "{Item} hasn't been received, dispatched, wasted or adjusted since {last date}. Try a longer range." / **Show 30 days** | "Couldn't load the ledger" / "Check your connection and try again. The ledger itself is safe — nothing was changed." |
| Stock ledger · no item (`B8`) | recently-viewed list row ×4 | recently viewed empty: "No items viewed yet" / "Search above to open an item's ledger." / — | "Couldn't load items" / "Check your connection and try again." |
| Restock levels · CS (drawer / mobile) | grid rows ×4 (table row) | "No Central Store items have a restock level yet" / "Add an item to start flagging low stock." / **Add an item** | drawer banner: "Couldn't save restock levels" / "The connection dropped before the save finished. Your changes are still here — press Save again." · load: "Couldn't load restock levels" / "Check your connection and try again." |
| Log waste · CS + Department | item picker only (the form is static) | — | banner (example `1I1M-0`): "Couldn't log waste — try again" / "Nothing was written to the ledger. Your entry is still filled in below." |
| Daily count · blind entry | category tabs real; mobile list row ×5 | category tab with no items: "No {category} items to count" / "Pick another category." / — | save: banner "Couldn't save — your counts are kept" / "What you've typed is still on screen and counts saved earlier are safe on the server. Try again." (no offline queue — §7 #6) · load: "Couldn't load today's count sheet" / "Check your connection and try again." |
| Daily count · returned for recount | mobile list row ×1 | — | as blind entry |
| Verify · list (rail / `1C2H-0`) | list row ×4 | "Nothing to verify" / "Counts appear here once the attendant signs them." / — | "Couldn't load counts" / "Check your connection and try again." |
| Verify · detail | stats "—" ×4; table row ×6 | — (a count always has lines) | "Couldn't load this count" / "Check your connection and try again. Nothing has been accepted yet." · approve / send-back: banner "Couldn't {sign / send back} — try again" / "Your decisions on each line are kept." |
| Spot count | table row ×2 after an item is added | "No items added yet" / "Search above to add the items you want to spot count." / — | sign: banner "Couldn't save the spot count" / "Your counts and reasons are kept. Try again." |
| Thresholds (SM / BM) | field skeleton ×1–2 | — | banner (E5): "Couldn't save thresholds" / "Nothing changed — the previous values still apply. Try again." |
| Today's day | KPI "—" ×4; dept rail list row ×5; detail stats "—" + table row ×8 | dept with no tagged items is auto-done (§7 Q-D), not empty | "Couldn't load today's day" / "Check your connection and try again. Counts already entered are saved." · close / count save: banner "Couldn't save — your counts are kept" / "Try again." |
| Reopen (drawer / mobile) | — | — | banner "Couldn't reopen the day" / "The day is still closed. Your reason is kept — try again." |
| Day close history · list | table row ×6 / mobile list row ×5 | "No closed days in this range" / "Days appear here once they're signed and closed." / **Show month** | "Couldn't load day close history" / "Check your connection and try again." |
| Day close history · detail | KPI "—" ×4; rail list row ×5; table row ×8 | — | "Couldn't load this day" / "Check your connection and try again." |
| Next-morning opening · sheet | sheet header real; mobile list row ×5 | "Nothing to open" / "Last night's close had no lines for your department." / — | accept: banner "Couldn't accept the opening figures" / "Nothing was changed. Try again." |

---

## §1. Data model — new `DATA_MODEL.md` §4.66+

All models carry `organizationId` (Non-Negotiable #3). Hub models live on the
hub org (D-15); branch models on the branch org.

### 1.1 `StockCount` (hub)

| Field | Type | Notes |
|---|---|---|
| `id`, `organizationId`, `locationId` | | Central Store location |
| `kind` | enum `DAILY \| SPOT` | spot counts kept separate so they don't distort daily-rhythm reporting (Flow 5a) |
| `countDate` | `Date` | business date, Africa/Nairobi. `@@unique([locationId, kind, countDate])` for `DAILY` via partial index |
| `status` | enum `DRAFT \| SUBMITTED \| RETURNED \| VERIFIED` | spot counts are created `VERIFIED` in one step |
| `reference` | string | `CNT-YYYY-MMDD` (daily), `SPT-####` (spot, `ReferenceCounter`) |
| `counterId`, `counterSignedAt` | | attendant (daily) / SM (spot) |
| `verifierId`, `verifiedAt` | nullable | SM |
| `returnNote`, `returnedAt` | nullable | last send-back |
| `directorNotified` | bool | shown on verified record |

### 1.2 `StockCountLine`

| Field | Notes |
|---|---|
| `stockCountId`, `inventoryItemId` | `@@unique([stockCountId, inventoryItemId])` |
| `countedQty` | nullable while draft; **uncounted lines are never adjusted** (partial counts, Flow 4) |
| `expectedQty` | **snapshot = ledger on-hand as of `counterSignedAt`**, written server-side on submit. Never serialized to `STORE_ATTENDANT`. Snapshotting at submit means stock movements between 07:10 (count) and 08:42 (verify) don't create phantom variance |
| `decision` | enum `PENDING \| ACCEPTED \| QUERIED` |
| `reason` | `CountReason` enum + `reasonNote` (required when `OTHER`) |
| `unitCost` | frozen at verify (current cost now — Appendix A) |

`InventoryTransaction.stockCountLineId` becomes a real FK (restored, as M2/M3/M5 did for theirs).

### 1.3 `WasteLog`

`locationId` (Central Store or department), `inventoryItemId`, `quantity`,
`reason` enum `SPOILAGE | EXPIRY | DAMAGE_IN_STORE | PREP_ERROR`, `note?`,
`unitCost` (Central Store: current cost now; department: cost carried into
the department — latest `DISPATCH_IN` unit cost, falling back to item current
cost), `loggedById`. One line per entry (the design logs one item at a time).
`InventoryTransaction.wasteLogId` becomes a real FK. Not signed (Appendix B).

### 1.4 `BranchDay` + `BranchDayDepartment` + `BranchDayLine` (branch org)

- `BranchDay`: `businessDate` (`@@unique([organizationId, businessDate])`),
  `status` `OPEN | CLOSED`, `closedById?`, `closedAt?`, `reference`
  (`DAY-####`), `reopenCount`. Created lazily the first time the BM opens
  Today's day for that date.
- `BranchDayDepartment`: `departmentTag`, `locationId`, `status`
  `NOT_STARTED | COUNTED` (BLOCKED is **derived** at read time from
  `IN_TRANSIT` dispatches to that department — never stored, so confirming a
  dispatch unblocks instantly), `countedById?`, `countedAt?`.
- `BranchDayLine`: `inventoryItemId`, `countedQty?`, `expectedQty` (snapshot
  = department on-hand as of the moment the line's count is saved, excluding
  this day's own close adjustments), `reason?` (`GapReason` enum) +
  `reasonNote?`, `unitCost` (cost carried into the department).
- `InventoryTransaction.branchDayLineId` — new nullable FK.

### 1.5 `BranchDayReopen`

`branchDayId`, `reopenedById`, `reopenedAt`, `reason` (required, free text).
Immutable, append-only. Reopen authority: `MANAGER` (own branch) or
`DIRECTOR` (API only — no Director shell yet).

### 1.6 `DepartmentOpening` + `DepartmentOpeningLine`

`branchDayId` (the day being opened), `departmentTag`, `acceptedById?`,
`acceptedAt?`. Lines: `inventoryItemId`, `prefilledQty` (department on-hand
at open time — which after last night's close equals the closing count),
`acceptedQty`, `overnightVariance`. The difference posts as `ADJUSTMENT`,
reason "overnight variance" (Flow 12c).
`InventoryTransaction.openingLineId` — new nullable FK.

### 1.7 `InventoryTransaction` additions

- `reference String?` — `ADJ-####` on every `ADJUSTMENT` row (the designs
  link `ADJ-3402` to the ledger).
- `reversesTransactionId String?` — self-relation. Re-close and opening
  recompute **reverse** superseded adjustments with a linked, equal-and-
  opposite row; nothing is ever updated or deleted (Flow 12b).
- Ledger "counterparty" text (`Daily count · verified by J. Mwangi`,
  `End-of-day count`) is **derived from whichever FK is set** — no new
  free-text column.

### 1.8 Enums

- `CountReason` (Central Store): `SUSPECTED_MISCOUNT`, `UNLOGGED_SPOILAGE`,
  `SUSPECTED_LOSS`, `WITHIN_NORMAL_RANGE`, `OTHER`.
- `GapReason` (branch): `CONSUMPTION`, `UNLOGGED_WASTE`, `WALK_IN_COMP`,
  `SUSPECTED_LOSS`, `OTHER`.
- `OTHER` always requires a note (Zod refinement + service check).

### 1.9 `CountingThresholds` — set by the people who own them

Owner decision 2026-09-24: thresholds are **user-set, each by whoever owns
the stock or receives the alert**, not hard-coded. One row per organization
(`@@unique([organizationId])`), created lazily with defaults. Values are
**absolute line value in KES** (|variance| × unit cost):

| Field | Lives on | Set by | Default | Meaning |
|---|---|---|---|---|
| `reasonRequiredKes` | hub org row | Store Manager | 500 | Central Store: reason required on accept / spot count |
| `reasonRequiredKes` | each branch org row | that branch's Branch Manager | 1,000 | Branch: reason required on a gap (higher because branch gaps include consumption, Stage 8) |
| `overnightAlertKes` | each branch org row | that branch's Branch Manager | 500 | overnight variance → Branch Manager push (Flow 12c) |
| `directorAlertKes` | **hub org row only** (company-wide) | Director | 5,000 | any store count or branch gap line at or above → Director push (Flow 20) |

Plus `updatedById`, `updatedAt` on each row, so the drawer can say who last
changed it. Defaults live in `counting-thresholds.ts` as the fallback when no
row exists. There's no company model above `Organization`; the hub org is the
company-level unit (D-15), which is why the company-wide Director amount
lives on its row.

**Rules:**
- Values are whole KES, `min 0`, `max 1,000,000`. `0` means "always".
- Changes apply **going forward only**. A count already submitted keeps the
  threshold it was judged against: each `StockCountLine` / `BranchDayLine`
  stores `reasonRequired` (bool) when its variance is computed, so moving a
  threshold never changes a signed record.
- **The Director amount has no UI this milestone.** It is set through
  `PUT /inventory/thresholds/director` (DIRECTOR only) and seeded at 5,000
  until the Director shell is redone. Both drawers show it read-only
  ("Director alerts from KES 5,000 · set by the Director").

### 1.10 Migration plan

One additive migration per session (S1: `WasteLog` + ledger FK restore +
`reference`/`reversesTransactionId`; S2: `StockCount*` + `CountingThresholds`; S3: `BranchDay*` +
`BranchDayReopen`; S4: `DepartmentOpening*`). All nullable/new-table, so
nothing needs a backfill and rollback is "drop the new tables/columns". The
whole data model above is frozen at plan approval, so later sessions only
*add* what was already specified — no session reshapes an earlier session's
tables.

---

## §2. API contract — new `API_CONTRACT.md` §26

Every route: `authenticate` + `requireRole`, Zod-validated, org-scoped.
Frozen per session with a contract test (`*-contract.test.ts`), same as M2–M5.

### 2.1 Stock position, ledger, waste (S1) — `modules/inventory/stock-*`

| Method & path | Roles | Notes |
|---|---|---|
| `GET /inventory/stock` | SM | `search, type, categoryId, belowRestock, negative, page, pageSize` → rows `{item, type, category, onHand, usageUnit, restockLevel, currentCost, value, isLow, isNegative}` + `{total, page, pageCount}`. Page-based (design shows "Page 1 of 18"). `attention=true` returns the hub's attention subset |
| `GET /inventory/stock/summary` | SM, Attendant | SM: `{onHandValue, itemCount, lowCount, negativeCount, todaysCount}`. **Attendant: `{todaysCount}` only** (§7 Q-A) |
| `GET /inventory/stock/items/:itemId/ledger` | SM (hub), MANAGER (own branch departments), DEPARTMENT_HEAD (own department) | `locationId, from, to, type, page` → `{summary:{onHand, currentCost, value, restockLevel, location}, rows:[{at, type, counterparty, qty, runningOnHand, reference}]}`. **Attendant: 403.** Running balance computed in SQL window function, not in JS |
| `POST /inventory/waste` | SM, Attendant (hub); DEPARTMENT_HEAD (own department) | `{inventoryItemId, quantity, reason, note?}`; location resolved server-side from the actor, never trusted from the client. Writes `WasteLog` + negative `WASTE` row in one transaction. Negative stock allowed + flagged (Flow 21) |
| `GET /inventory/waste` | SM, Attendant, DEPARTMENT_HEAD | `days=7` → entries + total value |
| `GET/PUT /inventory/restock-levels` | existing | verify Central Store scope works for the SM drawer; no contract change expected |

### 2.2 Central Store counting (S2) — `modules/inventory/count-*`

| Method & path | Roles | Notes |
|---|---|---|
| `GET /inventory/counts` | SM | list for the "Counts & waste" list on the left (daily + spot + a waste roll-up row), oldest-pending first |
| `GET /inventory/counts/today` | Attendant | get-or-create today's `DAILY` draft → **counted-only projection** (`AttendantCountView`: no `expectedQty`, no variance, no on-hand — a separate Zod response schema, so the omission is structural, not a filtered field) |
| `PUT /inventory/counts/:id/lines` | Attendant | save partial `{lines:[{inventoryItemId, countedQty}]}`; allowed in `DRAFT`/`RETURNED` only |
| `POST /inventory/counts/:id/submit` | Attendant | `{pin}` → snapshots `expectedQty`, status `SUBMITTED`, push SM |
| `GET /inventory/counts/:id` | SM (full `VerifierCountView`), Attendant (`AttendantCountView`) | |
| `PATCH /inventory/counts/:id/lines/:lineId` | SM | `{decision, reason?, reasonNote?}` |
| `POST /inventory/counts/:id/return` | SM | `{note}` → `RETURNED`; only `QUERIED` lines reopen to the attendant |
| `POST /inventory/counts/:id/approve` | SM | `{pin}`; blocked (409 `REASON_REQUIRED`) if any above-threshold accepted line lacks a reason, or any line is still `QUERIED`. One transaction: `ADJUSTMENT` per accepted non-zero variance (`ADJ-` numbered), status `VERIFIED`; after commit, Director push if any line ≥ `directorAlertKes` |
| `POST /inventory/spot-counts` | SM | `{lines:[{inventoryItemId, countedQty, reason?}], pin}` → `VERIFIED` + adjustments in one step |
| `GET /inventory/counts/:id/print` | SM | data for the A4 verification document |
| `GET /inventory/thresholds` | SM, MANAGER | own org's row (defaults if none) + the company-wide `directorAlertKes`, read-only, with `updatedBy`/`updatedAt` |
| `PUT /inventory/thresholds` | SM (hub: `reasonRequiredKes`), MANAGER (own branch: `reasonRequiredKes`, `overnightAlertKes`) | the Zod schema is chosen by role, so an SM can't send branch fields and vice versa. Built in S2 (SM), extended in S3 (BM) |
| `PUT /inventory/thresholds/director` | DIRECTOR | `{directorAlertKes}` on the hub row. API only this milestone |

### 2.3 Branch day (S3/S4) — new `modules/branch-day/`

| Method & path | Roles | Notes |
|---|---|---|
| `GET /branch-day/today` | MANAGER | get-or-create today → `{id, date, status, departments:[{tag, status (incl. derived BLOCKED + blockingDispatchLabel), countedBy, countedAt, itemCount, gapsAboveThreshold}], yesterday:{status, closedAt, closedBy} \| null, canClose, closeBlockers[]}` |
| `GET /branch-day/:id/departments/:tag` | MANAGER | lines `{item, expected, counted, gap, gapValue, reasonRequired, reason, reasonNote}` |
| `PUT /branch-day/:id/departments/:tag/lines` | MANAGER | save counts + reasons (partial allowed); status → `COUNTED` when every line has a count. Only while `OPEN` |
| `POST /branch-day/:id/close` | MANAGER | `{pin}`. Requires all 5 departments `COUNTED`, none BLOCKED, every above-threshold gap reasoned (409 with the blocker list otherwise). One transaction: `ADJUSTMENT` per non-zero gap at the department location. Director push per line ≥ `directorAlertKes` |
| `POST /branch-day/:id/reopen` | MANAGER, DIRECTOR | `{reason}` → `OPEN`, writes `BranchDayReopen`. Re-close **reverses every active adjustment from the previous close** (linked rows) and writes fresh ones; if the next day's opening was already accepted, its overnight adjustment is reversed and recomputed too (S4 hook) |
| `GET /branch-day/:id/document` | MANAGER | signed day-close document data |
| `GET /branch-day/history` | MANAGER | `from, to` (Day/Week/Month/Custom) → past days with status `CLOSED \| REOPENED_ONCE… \| OPEN`. No "never closed" flag, no job (§7 Q-5) |
| `GET /branch-day/:id` | MANAGER | history detail: KPIs, departments, read-only lines, reopen audit trail |
| `GET /branch-day/opening` | DEPARTMENT_HEAD (own dept) | today's pre-fill for the actor's department |
| `POST /branch-day/opening/accept` | DEPARTMENT_HEAD | `{lines:[{inventoryItemId, acceptedQty}]}` → overnight `ADJUSTMENT`s; BM push if any line ≥ `overnightAlertKes` |

---

## §3. Notifications (Appendix C, trimmed)

Reuse `fcmService` fire-and-forget; one new method each, called **after**
the transaction commits (never inside it):

| Event | Recipient | Session |
|---|---|---|
| Central Store count submitted | Store Manager | S2 |
| Count variance ≥ `directorAlertKes` (store or branch) | Directors | S2 (store), S3 (branch) |
| Overnight variance ≥ `overnightAlertKes` | Branch Manager | S4 |

**Out of scope:** "branch day not closed → Director" — no job, no flag, no
notification (owner decision, §7 Q-5).

---

## §4. Build discipline — per-screen gate (binding for all four sessions)

Carries forward `milestone-5-plan.md` §4 and adds the one thing that was
missing: **the interactions are written down per screen before the screen is
built**, because Paper is static and can't carry them. An agent can't forget
something that's on a checklist it has to tick.

### 4.1 Skills the build agent loads

- `emil-design-eng` — **at the start of every session, before the first
  screen.** It sets the motion/interaction bar for everything below.
- `building-components` + `vercel-composition-patterns` — while writing each
  component.
- `web-design-guidelines` — the audit step of every screen's gate.
- `run-frontend-browser` — dev server + chrome-devtools MCP for screenshots.

### 4.2 Interaction baseline — applies to every screen

| Element | Required behaviour |
|---|---|
| Buttons (all variants) | hover colour shift (150ms ease-out), `:active` press `scale(0.98)`, visible `focus-visible` ring, `disabled` look + `cursor-not-allowed`, **in-flight: spinner + verb-ing label ("Saving…", "Signing…") and disabled against double-submit** |
| Clickable rows (tables, rails, mobile lists) | hover `bg-wds-neutral-100` (non-selected only), pointer cursor, trailing chevron nudges on hover, whole row is one focusable target with Enter/Space activation, selected row has the accent-rail treatment |
| Inputs / steppers | focus border in primary, `aria-invalid` + inline error text on validation failure, numeric `inputMode="decimal"`, stepper buttons with press state; Enter moves to the next count field on count screens |
| Filter chips / toggle groups / tabs | hover, selected state animated (background slides or cross-fades ≤200ms), keyboard arrows, active state reflected in the URL where the page is linkable |
| Drawers (desktop) | slide-in from right 250ms with a strong ease-out curve (per `emil-design-eng`), backdrop fade, focus trap, Escape + backdrop click close, focus returns to the trigger, **dirty-form guard** on close |
| Bottom sheets (mobile) | slide up with drag handle, swipe-down dismiss, same focus/escape rules |
| Async data | layout-mirroring skeleton (never a spinner-only page), empty state per design pass, inline error with Retry (`aria-live="polite"`) — never a silent failure |
| Mutations | success toast (or inline confirmation where the design shows one), KPI/number changes flash via `HighlightOnChange`, optimistic update only where rollback is trivial |
| Status dots / badges | colour + label, never colour alone |
| Motion hygiene | all motion wrapped in `prefers-reduced-motion`; no animation on actions repeated dozens of times in a row (count entry typing, stepper spam); nothing animates layout on scroll |

### 4.3 Per-screen interaction list — screen-specific additions

The session plan for each session (`milestone-6-sessions/session-N-plan.md`,
written after the design pass) copies the relevant rows below and extends
them. Starting set:

| Screen | Screen-specific interactions |
|---|---|
| Hub (SM) | KPI cards clickable → pre-filtered All items; attention-table filter chips; top-bar Restock / Log waste / Spot count open drawer/page; "Verify" button on the pending count |
| All items | debounced search (250ms) with clear button; filters combine; pagination keeps filters; row → ledger |
| Stock ledger | date-range toggle group; type select; `highlight` row gets a one-time fade-from-caramel on load and scrolls into view; pagination |
| Restock levels | inline numeric edit per row; changed rows marked; live "flags it low right away" note updates as values change; Save disabled until dirty; dirty-guard on close |
| Log waste | item combobox with on-hand/cost hint; stepper; reason chips (single-select, required); waste value recalculates live with number transition; submit → toast + drawer closes + hub waste card and KPIs refresh |
| Daily count | tab per category with live "8/24" counters; field auto-advance; counted fields show filled state; partial-save indicator ("Saved 07:08"); submit opens PIN sheet; success screen |
| Verify | rail selection updates detail without full reload; Accept/Query per line toggle with state change animation; reason control appears (height transition) when required; footer primary switches between "Approve & sign" and "Send back to attendant" when any line is queried; Print opens print route |
| Spot count | add-item combobox; rows removable; reason field appears per above-threshold line; recent-spot-counts panel |
| Today's day | department rail with live status dots; count inputs; gap column recalculates live; reason select appears when gap ≥ threshold; blockers message + disabled "Sign & close" with a tooltip listing blockers; close → PIN → closed state |
| Reopen | reason textarea required (button disabled until non-empty); destructive-tone confirm button; success → day returns to Open with toast |
| History | Day/Week/Month/Custom range (custom = date-range popover); row → detail; read-only detail; "View signed document" |
| Thresholds drawer | KES inputs with live example ("a −9 kg chicken gap at KES 90/kg = KES 810 → reason required"); Director amount shown read-only; Save disabled until dirty; dirty-guard on close; success toast; "last changed by … on …" updates after save |
| Opening sheet | per-line recount stepper; overnight-variance note animates in when recount ≠ pre-fill; Accept → sheet dismisses → landing card flips to Confirmed + toast |

### 4.4 The gate — run for every artboard state, in order, before starting the next

1. Implement the screen/state against `get_jsx` / `get_computed_styles`
   values from Paper (never from screenshots).
2. Screenshot the Paper artboard.
3. Screenshot the live page at the same viewport and in the same state (real
   API data, seeded to match).
4. **Eyeball** side by side — spacing, type, tokens, hairlines (dark
   `neutral-800` structural, light `neutral-200` row dividers), primary-action
   gradient/sheen. **No automated pixel-diff** (standing rule).
5. **Interaction audit:** walk every row of §4.2 and that screen's §4.3 list
   in the browser — hover it, tab to it, press it, trigger its error, trigger
   its in-flight state (throttle the network in devtools), open/close its
   drawer or sheet. Tick each item.
6. Run `web-design-guidelines` over the files written for this state.
7. Fix everything from steps 4–6 together, re-screenshot, re-audit.
8. Record the state as done in the session's outcome log with a one-line note
   of anything deviated from and why.

No state counts as built until steps 4, 5 and 6 all pass. The end-of-session
pass is **functional only** (real flows end to end, cross-screen consistency,
Postgres checks of ledger effects).

### 4.5 Backend verification — every session

- Service unit tests for every rule (thresholds, blocked close, reason
  required, reversal math, partial counts, negative stock allowed).
- Threshold tests: defaults apply when no row exists; SM can't write branch
  fields and a BM can't write another branch's row; only DIRECTOR can set
  `directorAlertKes`; changing a threshold never alters a line that already
  has `reasonRequired` recorded.
- Contract tests freezing each response schema. **Mandatory S2 test: no
  attendant-facing count/stock response contains `expectedQty`, variance, or
  on-hand — asserted on the serialized JSON, not the TS type.**
- Org-scoping tests: hub actor can't read branch day; DH can't read or write
  another department; MANAGER can't reach another branch.
- Ledger integrity check in Postgres after the browser pass: Σ ledger per
  (location, item) equals what the UI shows; reversal pairs net to zero.
- `backend: pnpm build && pnpm test` and `frontend: pnpm build` (incl.
  `check-wds-tokens`) clean before the session closes.

---

## §5. Module placement

- Backend: hub-side files as siblings in `modules/inventory/`
  (`stock-*`, `waste-*`, `count-*`, `counting-thresholds.ts`), matching how
  `prep-*` and `receiving-*` live there; branch-side in new
  `modules/branch-day/`.
- Frontend: hub screens, ledger, waste and restock in `features/inventory/`;
  branch day + history + opening in new `features/branch-day/`. The DH
  landing (`features/requisitions`) imports the opening sheet and waste
  screen through each feature's `index.ts` only.
- Routes (thin shells in `app/`): `/app/inventory/stock`, `…/stock/items`,
  `…/stock/counts`, `…/stock/spot-count`, `…/stock/ledger/[itemId]`,
  `…/stock/daily-count` (attendant), `/app/inventory/count-print/[id]`;
  `/app/branch/day`, `…/day/history`, `…/day/history/[id]`,
  `/app/branch/day-print/[id]`, `/app/branch/ledger/[itemId]`,
  `/app/branch/waste/new` (DH).

---

## §6. Session breakdown

### 6.0 Paper design pass (before Session 1) — prompt: `milestone-6-sessions/design-pass-prompt.md`

Fixes every design gap found in the 2026-09-24 review and draws the
loading / empty / error states. Updates §0 of this doc with the new node IDs.
Owner approves the changed artboards before Session 1.

### Session 1 — Stock position & waste

Backfill `API_CONTRACT.md` §25 / `DATA_MODEL.md` M5 entries, then: S1
migration; stock list/summary, ledger, waste endpoints + tests; hub (SM +
Attendant), All items, ledger (desktop + mobile), restock (SM drawer +
mobile, DH parity check), log waste (drawer + 2 mobile), sidebar sub-links;
wire the DH landing "Log waste". **Demo:** SM browses live stock, logs waste,
sees it land in the ledger and the hub's waste card.

### Session 2 — Central Store counting

S2 migration; count endpoints + attendant-blindness contract test; daily
count (entry, PIN, submitted, returned), verify (desktop master-detail +
mobile list/detail, awaiting, queried, verified), spot count, both prints,
count notifications, `CountingThresholds` + the Store Manager thresholds
drawer (read by every verify/spot-count rule); hub's Counts card + Today's-count KPI go live. **Demo:**
attendant counts blind → SM queries a line → attendant recounts → SM approves
→ adjustments in the ledger with `ADJ-` links → print.

### Session 3 — Branch day close

S3 migration; branch-day today/department/close/reopen/document endpoints +
reversal tests; Today's day (desktop + mobile, count entry, blocked, ready,
closed), sign & close, signed document, reopen (drawer + mobile) with
re-close reversal, Branch Manager thresholds drawer; wire branch nav "Day". **Demo:** BM counts 5 departments,
sees Barista blocked until its dispatch is confirmed, closes, reopens,
re-closes — Postgres shows linked reversal pairs.

### Session 4 — History, opening, integration

S4 migration; history + detail + opening endpoints; history list/detail
(desktop + mobile); opening sheet + accepted state wired into the DH landing;
re-close → opening recompute hook; overnight notification. Then the
**milestone integration pass**: Flows 4, 5, 5a, 6, 12, 12a, 12b, 12c, 13, 19,
20, 21 walked end to end in a real browser across roles, plus a regression
click-through of M2–M5 screens that touch the ledger (receiving, prep,
dispatch, receiving at branch) to confirm on-hand still reconciles.

### Every session

- Starts with a session plan in `milestone-6-sessions/session-N-plan.md`
  (written by the orchestrator after the design pass, with exact node IDs and
  the §4.3 interaction rows for its screens).
- Ends with an outcome log appended to §8 of this doc, `MILESTONES.md`
  updated, one commit per logical unit (backend, frontend), both build checks
  green.

---

## §7. Decisions (owner alignment, 2026-09-24)

| # | Question | Decision |
|---|---|---|
| 1 | Who enters branch counts? | **Branch Manager**, on Today's day — Counted column becomes inputs while the day is Open (Stage 9 [OWNER]). New state drawn in the design pass |
| 2 | Fix Paper gaps first? | **Yes** — short design pass before Session 1 (§6.0) |
| 3 | Reason control | **Preset list + "Other (describe)"**, identical control everywhere; `CountReason` for the store, `GapReason` for branches (§1.8) |
| 4 | Thresholds | **User-set, by whoever owns them** (§1.9): SM sets the Central Store reason threshold, each BM sets their branch's reason and overnight thresholds, the Director sets the company-wide alert amount (API only until the Director shell exists). Small drawers built in S2 (SM) and S3 (BM); designed via a design-pass addendum |
| 5 | "Never closed — flagged to Director" | **Not implemented.** No job, no flag, no notification. History shows past days as Closed / Reopened / Open only; the design pass removes the flagged row |
| 6 | Offline | **Server-side partial save only**; no offline queue |
| 7 | Ledger scope | **SM, BM, DH** (and Attendant — see Q-A); "Viewing as" control dropped; Accountant/Director views wait for their shells |
| 8 | Undrawn states | **Drawn in the design pass** (owner override) — loading, empty, error for every screen |
| 9 | Session count | **Four** build sessions |

### Findings from the planning review (Q-A, Q-B, Q-C owner-confirmed 2026-09-24; Q-D, Q-E defaults stand)

| # | Finding | Decision |
|---|---|---|
| Q-A | The Attendant mobile hub (`188X-0`) shows live on-hand per item and links rows to the ledger — that exposes the expected figure the blind count exists to hide ([OWNER] rule, "enforced server-side, not merely hidden"). The waste drawer's "On hand −4 kg" hint does the same. | **Attendant sees no on-hand quantities anywhere**: hub keeps the action buttons, today's-count status and the waste list; no KPIs, no on-hand list, no ledger; waste hint shows unit cost only. Server enforces it (§2.1). Design pass redraws `188X-0` |
| Q-B | Verification per-line "Query" isn't followed through anywhere in the designs (no send-back state, no attendant recount state) | Queried lines send the count back; the attendant recounts **only the queried lines**, still blind. Two states drawn in the design pass |
| Q-C | Daily-count tabs say "Cold room / Dry store / Produce" — storage areas don't exist in the catalog | **Tabs = top-level categories** (Dairy / Dry goods / Produce …, same as the All items chips). No new storage-area field |
| Q-D | Close precondition | Sign & close enabled only when all 5 departments are counted, none blocked, and every above-threshold gap has a reason. A department with no tagged items counts as done automatically |
| Q-E | Branch gaps include consumption (Stage 8), so most lines will show a gap nightly | Branch default reason threshold starts higher than the store's (1,000 vs 500), `CONSUMPTION` is a reason option, and each Branch Manager can now tune their own threshold (§1.9) |

---

## §8. Outcome log

_(appended per session)_

### Session 1 — Stock position & waste (built 2026-09-25 → 2026-09-29, shipped 2026-09-29)

Merged to `main` as PR #38 (`6559bba`); the Department Head restock fix shipped first as PR #37 (`365a2ee`). All eleven screen rows of the session table plus their loading / empty / error states passed the §4.4 gate in a real browser; per-gate lines and every deviation are in `milestone-6-sessions/session-1-plan.md` → Outcome log. Headlines:
- **Blind count holds on the wire**: the attendant's summary is `{todaysCount}` only and the waste picker carries no `onHand`; contract test green.
- **Milestone One bug found and fixed**: a Department Head's restock screen was always empty and every save 404'd (items looked up on the branch org, which has no catalog) — affects production today; fixed with regression tests and shipped as hotfix PR #37.
- Restock levels now list only items with a level plus "Add an item", as Paper and §0.1 draw them; the M1 560px-with-search drawer returns to Paper's 440px.
- DH routes needed a middleware change (`/app/branch/ledger`, `/app/branch/waste` admit department heads); the DH ledger uses Paper's light branch header.
- Open for the owner: no DH entry point to their stock ledger yet (the route exists; the landing has no link).
- Checks: `backend pnpm build && pnpm test` (82 files, 1,033 tests) and `frontend pnpm build` (+ `check-wds-tokens`) green; Postgres — Σ ledger matches every screen checked, 0 `WASTE` rows without a `WasteLog`, 0 `WasteLog`s without exactly one equal-and-opposite row.

### Session 2 — Central Store counting (built 2026-09-29)

On branch `feat/m6-s2-counting` (backend `43844ef` + frontend commit; not pushed). All screens in the Session 2 table plus their loading / empty / error states passed the §4.4 gate in a real browser; per-gate lines, the backend checkpoint and every deviation are in `milestone-6-sessions/session-2-plan.md` → Outcome log. Headlines:
- **Blind count enforced structurally:** `AttendantCountView` is its own Zod schema (undeclared keys are stripped); a contract test scans the serialized JSON of every attendant-facing count response for expected / variance / on-hand / cost keys, with a control proving the scan can fail.
- **Snapshot at sign:** `expectedQty`, `unitCost` and `reasonRequired` are written server-side when the attendant signs (a resubmit re-snapshots only the queried lines); moving a threshold never changes a signed record.
- **One transaction on approve:** one `ADJUSTMENT` per accepted non-zero variance with `ADJ-####` and `stockCountLineId`; Directors notified after commit. Postgres: 0 exceptions on reference / link / quantity / Σ-ledger checks.
- **Plan corrections recorded:** `firstCountedQty` + `queryNote` on lines, Director "last changed" pair on thresholds, `unitCost` frozen at submit, approve also blocks undecided variance lines, the send-back note is optional (`1EUG-0`), `todaysCount` gains progress counts.
- Dev fixture seed (`seed-counting-dev-fixtures.ts`, states `submitted|draft|returned|none`) writes every date relative to "now".

### Session 3 — Branch day close (built 2026-09-29)

On branch `feat/m6-s3-day-close` (backend `bd5e838` + frontend commit; not pushed). Every screen in the Session 3 table plus their loading / error states passed the §4.4 gate in a real browser; per-gate lines, the backend checkpoint and every deviation are in `milestone-6-sessions/session-3-plan.md` → Outcome log. Headlines:
- **Close and re-close are append-only and reconcile:** one `ADJUSTMENT` per non-zero gap (`ADJ-####`, `branchDayLineId`) in one transaction; a re-close first reverses every standing adjustment with a linked equal-and-opposite row, then writes fresh ones — Postgres confirms each reversal points at its original and Σ ledger equals the counted figure.
- **BLOCKED is derived, never stored** (any `IN_TRANSIT` dispatch to the department) and the expected quantity is snapshotted per saved line, excluding the day's own close adjustments.
- **Branch Manager thresholds** live on the branch's own `CountingThresholds` row; the role picks the write schema (each `.strict()`), the org always comes from the actor.
- **Deviations to confirm:** "Counted" status in green (Paper draws it red), counted figures stay editable while the day is open, mobile History link disabled until Session 4.

### Session 4 — History, opening, integration (built 2026-09-29, merged 2026-09-30)

Merged to `main` as PR #46 (`aed016a`) and deployed; migration `20260930100000_milestone6_session4_opening` applied by the pipeline. Plan, owner decisions and per-screen notes: `milestone-6-sessions/session-4-plan.md`. Headlines:
- **History reads what was signed:** list and detail aggregate from saved lines only; a past day's expected figures are cut off at the end of that business day, so a reopened old day is never judged against today's ledger. Detail reuses the S3 read-only panes through a saved-count adapter (one layout, as Paper `1CMM-0` matches `19C8-0`).
- **Opening + recompute:** accept posts linked `ADJ-` overnight rows in one transaction; a re-close reverses and re-derives them. Verified in Postgres on real data: reversal = exact opposite of its original, on-hand equals the accepted figure, every adjustment has a reference and exactly one source link.
- **Additions beyond the plan table:** `GET /branch-day/:id/overview` (recount a reopened past day; `?day=<id>` on the day screen), reopened-but-open days labelled "Reopened · open" instead of "Never closed", shared PIN sheet fixed (clears after a wrong PIN, refocuses, Enter submits).
- **Owner decisions at session start:** S3 deviations accepted; DH "Stock ledger" quick action already existed (Paper variant `1L02-0` added); SM mobile Thresholds already drawn/wired.
- Checks: backend build + 1,176 tests, frontend build + token check green. Dev seed `seed-branch-day-history-dev-fixtures.ts` (run after the S3 seed).

### Integration pass — local rehearsal (2026-09-30)

Ran on a wiped local DB seeded by `backend/src/scripts/seed-rehearsal-reference.ts`
(reference data only: 3 orgs, 9 people with PIN `1234`, 54 items, 7 suppliers, restock
levels, thresholds, store opening stock, Nyeri Town Kitchen opening balance). Rerun:
`cd backend && REHEARSAL_SEED_CONFIRM=YES npx tsx src/scripts/seed-rehearsal-reference.ts`
(local database only; refuses production). The day was then driven end to end against the
real API/services (receiving → prep → count → requisition → dispatch → receive → discrepancy
→ branch close → reopen/re-close → opening → negative stock), with Postgres checks after each
role and browser spot-checks of the Store Manager stock hub, Prep, Dispatch, Discrepancies
and the Branch Manager Day and History screens. Production run sheet:
`production-run-sheet.md`.

**Confirmed working:** price-change alert with a confirm gate (Flow 2d, "38% above last");
pack-unit conversion on receipt; both payment terms; invoice dispute + part payment (AP);
prep yield strip / "Yield flags" KPI / low-yield notify flag (Flow 3a); blind count on the
wire (no expected/on-hand/variance/cost key in any attendant count response); query →
recount returns only the queried line and rejects edits elsewhere (409); reason required
above the threshold (at approve, and on spot counts); Director alert flag; ADJ-#### with
exactly one source link on every count/close/opening adjustment; reversals exact and linked;
dispatch_out at hub / dispatch_in at branch org only for confirmed quantities; unconfirmed
dispatch blocks the department count server-side; close refused without a reason and with a
wrong PIN; negative stock allowed and flagged (Flow 21); no cross-org rows.

| # | Sev | Finding | Status |
|---|---|---|---|
| F2 | must-fix | Dispatch-discrepancy write-off ADJUSTMENTs had no `ADJ-####` reference and no reason | **Fixed** — both outcomes now number via the org's ADJ counter and record "Transit loss" / "Receiving miscount"; unit tests added. Rows written before the fix (none in production expected) stay unnumbered |
| F3 | must-fix | Dispatch stayed `DISCREPANCY_OPEN` after every discrepancy was RESOLVED (Flow 11 step 4) | **Fixed** — `closeDispatchIfResolved` runs in the resolve transaction; verified live (→ CONFIRMED) |
| F5 | can-wait | "1 branches fully out" | **Fixed** (plural). Not changed: a fully dispatched branch still appears under "Waiting" |
| F1 | must-fix (owner decision) | `MISCOUNT_CORRECTED` writes the *gap* at the branch (−40) although the note says all 400 arrived, and the request carries no corrected quantity — Barista lids went 360 → 320 | **Open.** Recommend adding a required `correctedQty` and writing `correctedQty − confirmedQty`. Do not demo this outcome until decided |
| F4 | decision | `GET /dispatch/:id/fulfil` returns `onHandQty` to the Store Attendant (and the prefill `min(requested, onHand)` reveals it); plan Q-A says the attendant sees no on-hand anywhere | **Open.** The M5-approved fulfil screen needs it to show shortages; either accept as a documented exception or send only an "insufficient stock" flag to the Attendant |
| F6 | note | The handoff said the attendant gets no cost on waste; plan Q-A explicitly allows unit cost there | Not a bug — handoff wording corrected here |

**Not verified in this pass:** the Attendant/Department Head mobile layouts; the M2–M5 ledger
screens clicked through one by one in the browser (their effects were confirmed in Postgres
and the Store Manager/Branch Manager desktop screens were spot-checked); the department head's
opening card UI; print documents; push notifications; Director/Accountant screens (not built).
The next-morning opening was exercised by moving the closed day back one calendar day in the
local DB (dates only). Data entry for receiving, prep, counts, requisitions, dispatch and the
branch close went through the real API endpoints (same services and ledger writes as the UI),
not form-by-form — apart from one goods receipt signed through the UI.

---

## Verification

Milestone Six is done when: all four sessions' gates passed for every
artboard state in §0; the S4 integration pass walked every listed flow with
real data and Postgres confirmed the ledger effects; the attendant-blindness
contract test passes; both build checks green; `MILESTONES.md`,
`API_CONTRACT.md` §25–26 and `DATA_MODEL.md` updated; deployed via the normal
`main` pipeline.
