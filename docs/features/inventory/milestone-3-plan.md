# Inventory & Procurement — Milestone Three High-Level Plan (Step 5)

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Milestone:** **Three — Prep** — Stage 3 (Central Store). See `MILESTONES.md`
for why Prep stands alone (single-station, no cross-branch dependency, no
other milestone depends on it existing first).
**Step:** 5 of the per-feature pipeline — high-level plan
**Status:** SHIPPED — 2026-09-21. S0/S1 (Step 7 build + Step 8 integration)
ran as one continuous session; see §5's outcome log for what was built and
every bug found/fixed during real-browser verification and the owner's
manual walkthrough.
**Date:** 2026-09-19 (plan) / 2026-09-21 (build complete)

**Traces to:**
`01-description.md` (§3 Stage 3, §6 "Prep yield far off the norm") ·
`02-flows.md` (Flow 3, Flow 3a) ·
`02-screens-by-role.md` (screens 22–23, Store Manager; screens 5–6, Store
Attendant mobile) ·
Paper page `Milestone Three · Prep` (`p-D-0`) in `01M1ZZJ6S3FZGF5C7PPBGTKY89` ·
`04-components.md` (Milestone Three reuse audit — no new primitives/composites) ·
`milestone-2-plan.md` (the precedent this plan follows) ·
`docs/FEATURE_REDO_PLAYBOOK.md` §5, §7, §8, §9 ·
`docs/CODING_STANDARDS.md`, `docs/API_CONTRACT.md` §22 (Milestone Two, the
sibling contract section this one sits beside).

---

## 0. Scope

8 screens on Paper page `p-D-0`, all reviewed and approved by the owner this
session (desktop + mobile):

| # | Screen | Desktop | Mobile | Surface |
|---|---|---|---|---|
| 1 | Prep runs list | `Z61-0` | `ZGY-0` | route (own nav item) |
| 2 | New prep run | `ZAR-0` (drawer) | `ZIY-0` + confirm sheet `ZKJ-0` | drawer / full-screen |
| 3 | Prep run detail | `ZMU-0` (drawer) | `ZUK-0` | drawer / full-screen |
| 4 | Prep History | `ZZQ-0` | `10AN-0` | route |

**In scope:** recording a prep run (inputs consumed → output produced, one
atomic ledger transaction), latest-cost costing on the output item, yield vs.
rolling-average as a non-blocking nudge + flag, browsing/searching all past
runs, and opening a single run's immutable record.

**Explicitly out of scope** — named so build sessions don't drift:
requisitions, dispatch, branch receiving, counts, waste (as its own flow —
waste triggered *by* a bad prep run is Flow 3's error path, see §7 Q2), the
**store prep performance report** (Flow 3a's "variance surfaced... on the
store prep performance report" — belongs to the Reports pass, same deferral
pattern as Milestone Two's AP reconciliation workspace), and any
Store-Manager notification delivery mechanism beyond writing the fact that a
run crossed the notify threshold (§7 Q1).

**This milestone is the second writer to the stock ledger**, after Milestone
Two. It restores `InventoryTransaction.prepRecordId` as a real FK — this
column already exists, nullable, reserved for this exact purpose (schema
comment: *"prepRecordId... retained as unlinked nullable columns: the models
they referenced were dropped by Milestone One... restored as a real FK when
the milestone that rebuilds that flow lands"*). It also activates
`PREP_CONSUME` and `PREP_PRODUCE`, both already reserved in
`InventoryTransactionType` since Phase 1.

---

## 1. Data model

Small. One new model (`PrepRun` + `PrepRunInputLine`), no new top-level
document-numbering pattern (runs aren't identified by a reference number
anywhere in the approved screens — by timestamp + output + attendant
instead, matching `Z61-0`'s `WHEN` column, not a `PREP-0001` style ref).
Everything else — `InventoryItem`, `InventoryTransaction`,
`InventoryTransactionType` — already exists and needs no shape change beyond
activating the two reserved enum values and the one reserved FK column.

### 1.1 `PrepRun` + `PrepRunInputLine`

Derived from: New prep run (`ZAR-0`/`ZIY-0`), Prep run detail (`ZMU-0`/
`ZUK-0`), Prep runs list (`Z61-0`/`ZGY-0`), Prep History (`ZZQ-0`/`10AN-0`).

```
PrepRun
  id, organizationId
  outputItemId         -> InventoryItem
  actualYield           Decimal(12,4)   // in the output item's usage unit
  outputUnitCost         Decimal(12,4)   // snapshot: totalInputCost / actualYield, becomes InventoryItem.currentCost at write time
  totalInputCost          Decimal(12,2)   // snapshot, sum of input lines' lineCost — stored, not derived, for the same reason GoodsReceipt.receiptTotal is stored (an immutable record must not drift if a later query changes how it's computed)
  typicalYieldAtRunTime    Decimal(12,4)?  // the rolling-average figure shown on the Confirm screen at the moment of this run, snapshotted — "Typical: ~6kg chicken -> ~22L" must read the same on a signed record forever, even after 50 more runs shift the rolling average
  yieldVarianceLabel        String?         // e.g. "normal" | "low yield" | "high yield" — derived at write time from actualYield vs typicalYieldAtRunTime, stored so History/detail render it without recomputing against a now-different rolling average
  notifiedStoreManager       Boolean  @default(false)  // did this run cross the "notify SM" threshold (±35%, §6 Q1)
  locationId              -> Location       // Central Store — same pattern as GoodsReceipt.locationId
  createdById             -> User            // the Attendant (or SM, desktop) who recorded it
  createdAt               DateTime @default(now())
  // No updatedAt, no status enum, no signedAt/signedById — Flow 3 explicitly
  // has no signature step ("No signature — the ledger records who and
  // when", confirmed on both New Prep Run drawer/screen and Prep run detail)
  // and the run is immutable from the instant it's confirmed (Flow 3 error
  // path: "prep runs are immutable once confirmed... not editable after
  // confirm to keep the ledger append-only").

  @@index([organizationId])
  @@index([organizationId, outputItemId])   // rolling-average query, History "Output" filter
  @@index([locationId])

PrepRunInputLine
  id, prepRunId          -> PrepRun (onDelete: Cascade)
  inputItemId            -> InventoryItem   // may itself be a prepped item — two-stage prep is allowed (Flow 3)
  quantity                Decimal(12,4)     // in the input item's usage unit
  unitCostAtRunTime         Decimal(12,4)     // snapshot of InventoryItem.currentCost at the moment consumed — "costed at each input's current cost in force now" (Flow 3 step 6); must never be recomputed later, same immutability principle as GoodsReceiptLine's priceAlertPrevPrice
  lineCost                 Decimal(12,2)     // quantity * unitCostAtRunTime, stored
  lineOrder                Int

  @@index([prepRunId])
  @@index([inputItemId])
```

- **Why snapshot `unitCostAtRunTime` per line instead of joining
  `InventoryItem.currentCost` live:** the input's cost keeps moving after
  this run (more receipts, more prep). A detail screen opened next week must
  show the cost *as it was consumed*, not today's. This mirrors
  `GoodsReceiptLine.priceAlertPrevPrice`'s exact rationale in the Milestone
  Two schema comment.
- **Why `typicalYieldAtRunTime` and `yieldVarianceLabel` are stored, not
  derived on read:** same reasoning — the rolling average is a moving
  target (it's computed from *all* runs for that output, including ones
  recorded after this one). A signed/immutable record's "Typical: ~6kg → ~22L"
  line and its "low yield" flag must not silently change value as more runs
  come in. This is the same "stored, not derived" call the plan made for
  `ExpectedDelivery.estimatedTotal` and `GoodsReceipt.receiptTotal`.
- **`PrepRun` has no `PREP-` reference number.** Checked all 8 approved
  screens — none show one. Unlike `GoodsReceipt`/`ExpectedDelivery`, a prep
  run isn't a document handed to anyone; it's identified by
  when/output/attendant, which the `WHEN` + `OUTPUT` + `BY` columns already
  cover. `referenceCounterRepository.nextReference` (already generic, not
  Receiving-specific) is available if a future review decides one is needed,
  but nothing in this milestone's approved design calls for it.

### 1.2 `InventoryTransaction` — activating the reserved shape

No new columns. `prepRecordId` is restored as a real FK (was previously an
orphaned nullable column, same restoration Milestone Two did for
`goodsReceiptLineId`):

```prisma
model InventoryTransaction {
  // ...unchanged...
  prepRecordId String? @map("prep_record_id")   // now: -> PrepRun.id (was: dangling, no model)

  prepRun PrepRun? @relation(fields: [prepRecordId], references: [id])

  @@index([prepRecordId])   // new index, matching the goodsReceiptLineId precedent
}
```

One atomic `$transaction` per confirmed run writes:
- N `PREP_CONSUME` rows (one per input line), **quantity negative-signed**
  (stock decreasing). Confirmed, not assumed: on-hand is computed at
  `inventory-repository.ts:505` as a plain `_sum: { quantity: true }` across
  all ledger rows for an item/location, explicitly "derived live, never
  stored" — so on-hand only comes out correct if every consuming ledger type
  is negative-signed and every producing type is positive. `RECEIVE` is the
  only type with a real writer today and it's positive (stock increasing);
  `WASTE`/`ADJUSTMENT` are reserved but unwritten, so `PREP_CONSUME` is
  actually the *first* negative-signed writer in this codebase — get it
  right here since `WASTE` will need to match it later, not the reverse.
- 1 `PREP_PRODUCE` row for the output, `quantity = actualYield`, positive,
- an `InventoryItem` update on the **output** item:
  `currentCost = outputUnitCost` (same "latest-price costing, no averaging"
  write Milestone Two does on `GoodsReceipt` sign — confirmed at
  `receiving-service.ts:1002`, `data: { currentCost: line.unitPrice }`).

**No write to the input items' `currentCost`.** Consuming stock doesn't
change what it costs — only receiving (Milestone Two) or producing (this
milestone) does.

### 1.3 Rolling average — read-time computation, not stored per-item

"Typical: ~6 kg chicken → ~22 portions" (New Prep Run's nudge) is computed
at request time from recent `PrepRun` rows for that `outputItemId`:
**the last 10 runs, or the last 30 days, whichever is fewer data points**
(§6 Q3, resolved). Flagged/outlier runs are **always included**, never
excluded (§6 Q3b, resolved) — no separate "is this an outlier" logic to
maintain. It is **not** a maintained running average on `InventoryItem`,
because Milestone Two never introduced a "maintained aggregate" pattern
anywhere else in this feature; every derived figure so far is computed at
read time from the ledger (`current on-hand`, `what we owe`) except the
explicitly-justified stored exceptions in §1.1 above.

**One catalog item = one recipe/rolling-average** (§6 Q4, resolved). No
recipe/variant concept on `PrepRun` — if two genuinely different recipes
need separate typical-yield figures, that's expressed as two catalog items,
not a new field here.

**Flagged follow-up, deliberately out of scope this milestone (raised
2026-09-19, during Step 5 planning):** a Store-Manager-set target/override
for the "typical yield" figure, replacing or seeding the computed average —
useful for a brand-new output item with no run history yet, or to anchor
the nudge to a known recipe standard rather than whatever a recent bad
stretch happened to average. **Not built this milestone** — no screen in
the 8 approved artboards shows an SM editing a target yield, and adding one
would reopen Step 3 (design) for this milestone. Revisit once real usage
shows the computed-only average is actually a problem, same deferral
pattern as Milestone Two's overpayment-credit UI (§7 Q5 there).

---

## 2. Migration plan

One migration: `PrepRun` + `PrepRunInputLine` tables, the `prepRecordId` FK
restoration on `InventoryTransaction`, the new index. No backfill — this is
a new writer, no existing data to migrate. Run
`npx prisma migrate dev --name inventory_milestone_three_prep` locally,
commit the generated SQL, `prisma migrate deploy` on the server per the
project's standard migration workflow (`CLAUDE.md`).

---

## 3. API contract

New file pair, same convention as Milestone Two:
`backend/src/modules/inventory/prep-validators.ts` /
`prep.types.ts`, mirrored to
`frontend/features/inventory/types/prep.ts`. A new `## 23. Inventory —
Milestone Three (Prep)` section in `API_CONTRACT.md`, sibling to §22 — not
merged into it, since Receiving and Prep are different Stages with no
shared endpoint.

**Note on naming collision:** `API_CONTRACT.md` §5 "Prep Tickets &
Incidents" already exists — a completely different domain (BDS/KDS
order-item prep tickets, the "one ticket per order-item line" system
described in `CLAUDE.md`'s Critical Domain Knowledge). No route or schema
name may collide with `/prep-tickets`. This contract uses `/inventory/prep/…`
throughout, never a bare `/prep…` path, to keep the two systems visually and
textually distinct in the contract doc and in route tables.

### 3.1 Conventions (inherited from §22, restated)

- Standard envelope unchanged.
- Every decimal crosses the wire as a string.
- All routes under `/api/v1/inventory/…`.
- **No role-based response narrowing.** Unlike Receiving/AP, both
  `STORE_MANAGER` and `STORE_ATTENDANT` see identical Prep data including
  cost figures — confirmed against the approved screens: `KES 47/L` unit
  cost is shown on both the SM desktop table (`Z61-0`) and the SA mobile
  cards (`ZGY-0`, History `10AN-0`). No `ExpectedDeliverySummary`-style
  narrowing pattern applies here.

### 3.2 Endpoints

| Method | Path | Roles |
|---|---|---|
| `GET` | `/inventory/prep/runs` | SM, SA |
| `GET` | `/inventory/prep/runs/:id` | SM, SA |
| `POST` | `/inventory/prep/runs` | SM, SA |
| `GET` | `/inventory/prep/summary` | SM, SA |
| `GET` | `/inventory/items/:id/typical-yield` | SM, SA |

- **`GET /inventory/prep/runs`** — paginated (`limit`/`cursor`, per this
  feature's non-negotiable table/list standard), backs both the Prep runs
  list preview (last 4-5) and Prep History's full browse. Query params:
  `search` (output name / attendant name), `outputItemId`, `yieldFlag`
  (`'normal' | 'low' | 'high'`), `dateFrom`/`dateTo` — matching the filters
  drawn on `ZZQ-0`/`10AN-0`.
- **`GET /inventory/prep/runs/:id`** — the immutable detail record. No
  `PATCH`, no `DELETE` — Flow 3 is explicit that a run is never edited after
  confirm.
- **`POST /inventory/prep/runs`** — the one write endpoint. Body:
  `outputItemId`, `inputLines: {inventoryItemId, quantity}[]`,
  `actualYield`. Server computes `totalInputCost`, `outputUnitCost`,
  `typicalYieldAtRunTime`, `yieldVarianceLabel`, `notifiedStoreManager`
  inside the same `$transaction` that writes the ledger rows — none of
  these are client-supplied, same trust boundary Milestone Two uses for
  `receiptTotal`/price-alert fields.
- **`GET /inventory/prep/summary`** — backs the KPI strip on both the Prep
  hub (Runs this week / Yield flags / Prep value) and Prep History (Runs in
  range / Total input cost / Yield flags), parameterized by the same
  `dateFrom`/`dateTo` filters as the list endpoint so History's strip stays
  scoped to the active filter range, per the owner's explicit request this
  session.
- **`GET /inventory/items/:id/typical-yield`** — powers the New Prep Run
  nudge. Separate from `/prep/runs` so the New Prep Run screen can fetch it
  the moment an output is picked, before any input lines exist to post.

### 3.3 Response shapes (sketch — full Zod schemas written at contract freeze, S2)

```
PrepRunSummary   // list row shape
  id, when (ISO), outputItemId, outputName,
  inputsPreview: { firstItemLabel: string, remainingCount: number },  // backs "6 kg chicken +2 more"
  actualYield, yieldUnit,
  yieldVarianceLabel, yieldVarianceDelta (string, signed, e.g. "+0.5"),
  outputUnitCost,
  createdByInitials

PrepRunDetail   // extends PrepRunSummary
  createdByName, createdAt (full ISO),
  inputLines: { itemName, quantity, unit, unitCostAtRunTime, lineCost }[],
  totalInputCost, typicalYieldAtRunTime

PrepSummary
  runsInRange, totalInputCost, yieldFlagCount

TypicalYield
  outputItemId, typicalInputSummary (string, e.g. "~6 kg chicken"),
  typicalYield (string, e.g. "~22 L"), sampleSize (number of runs averaged)
```

---

## 4. Production data check

No existing Prep-adjacent data to check against — this is a new writer, same
situation Milestone Two was in for the stock ledger's first `RECEIVE` row.
Nothing to reconcile before build starts.

---

## 5. Session breakdown (Step 7)

**Two sessions, backend+frontend combined in the first — not split by
layer.** Given Step 4's reuse audit found no new primitives and one thin
new composite, and §6 is now fully resolved (no open modeling questions
left to destabilize a contract mid-build), the sequencing risk that
justified Milestone Two's 9-session, strictly-alternating
backend-slice/frontend-slice discipline doesn't apply here: Prep has one
write endpoint, one small new model, one atomic transaction. A single
agent can hold this milestone's whole vertical slice in mind without
losing coherence. The **order inside the session still matters** — backend
built, tested, and verified working before the first line of frontend is
written against it, same principle Milestone Two's split enforced — it's
just no longer a session boundary.

| # | Session | Depends on | Scope | Session prompt |
|---|---|---|---|---|
| **S0** | **Backend + frontend, full vertical slice** | plan approved | Schema + migration (§1, §2) → contract freeze (§3, Step 6) → service + all 5 endpoints (§1.2 atomic transaction, §1.3 rolling average, §6 Q1's thresholds) → backend tests, `pnpm build`+`pnpm test` clean → **then, same session**, all 8 frontend screens (4 screens × 2 breakpoints) against those real, already-working endpoints, reusing `KpiStrip`/`Sheet`/`DrawerShell`/`HistoryListScreen`'s structure/`ReceiptLineListReadonly`'s row skeleton per `04-components.md`'s Milestone Three section → `pnpm build` clean. | `milestone-3-sessions/milestone-3-s0-full-build-prompt.md` |
| **S1** | **Integration (Step 8)** | S0 | Real-browser (Playwright) walkthrough of Flow 3 and Flow 3a end to end: a normal run, a two-stage-prep run (input is itself a prepped item), a yield-variance warning (±15%), an SM-notify-threshold run (±35%), a negative-stock input (allowed, flagged per Flow 21), Prep History's search/filter/date-range, Prep run detail opened from both the list and History. Fix anything found in-session, same pattern as Milestone Two's S9. | ran directly, no separate prompt (matches Milestone Two's S9) |

**S0/S1 outcome (2026-09-19–21, ran as one continuous session, no
handoff seam needed):**

Backend built exactly per plan — schema/migration
(`20260919144255_inventory_milestone_three_prep`), `prep-validators.ts` +
`prep.types.ts` (`API_CONTRACT.md` §23), `prep-repository.ts`/
`-service.ts`/`-controller.ts`/`-routes.ts`, atomic transaction writing
negative-signed `PREP_CONSUME` + positive `PREP_PRODUCE` + output-item
`currentCost` update, rolling-average + yield-variance threshold logic. 28
new tests (unit/integration/contract); full backend suite green
(845/845). Five contract-formatting gaps left open by §3.3's sketch
(`yieldUnit` source, `inputsPreview` format, `yieldFlag`/label mapping,
signed-delta meaning, `createdByInitials` derivation) were resolved during
build, documented in `prep-validators.ts`'s header and `API_CONTRACT.md`
§23.4 — not new modeling questions, contract formatting the build session
owns per the same post-freeze-amendment pattern Milestone Two used.

Frontend: all 8 screens built, `PrepRunsListScreen`/`NewPrepRunDrawer`/
`PrepRunDetailDrawer`/`PrepHistoryScreen`, mounted as inline drawers from
the list/History screens (`ItemFormDrawer` pattern) rather than separate
routes for New/detail. Route wiring added at `/app/inventory/prep` +
`/app/inventory/prep/history`; nav sidebar's placeholder Prep link pointed
at the real route.

**Real-browser verification (S1, Playwright) found and fixed, in order:**
1. `perPage: 200` on the New Prep Run item fetch exceeded the backend's
   `perPage` max of 100 (Zod-rejected), silently emptying the output-item
   picker — found on the first full end-to-end run. Fixed to `100`.
2. **Visual-alignment pass against the approved Paper artboards** (plan's
   own S0 build-prompt requirement) found real deviations on all 4 desktop
   screens versus `Z61-0`/`ZAR-0`/`ZMU-0`/`ZZQ-0`: missing page title/
   subtitle blocks, a materially different runs-list table column set (no
   "Vs average" column, no Output/Flagged-only toolbar), no live
   output-unit-cost preview on New Prep Run, a simplified detail-drawer
   layout (missing the When/Recorded-by/Yield-vs-average strip and the
   Output-produced block), and a thin History filter bar (missing Output
   filter, date-range picker, Clear filters). All four screens rebuilt to
   match Paper's exact structure/copy/columns; re-verified via fresh
   screenshots after each fix.
3. Screen-mirroring loading skeletons (KPI strip + table shape, both
   breakpoints) added to `skeletons.tsx` — `PrepKpiSkeletonDesktop`,
   `PrepRunsListSkeletonDesktop`/`Mobile`, `PrepHistorySkeletonDesktop`/
   `Mobile` — replacing the generic `LoadingState`/`MobileLoadingState`,
   per this feature's non-negotiable table/list quality bar
   (`04-components.md`).
4. Owner-reported bugs from a manual walkthrough, fixed same-session:
   - Mobile crash (`TypeError: Cannot read properties of undefined
     (reading 'map')`) opening the detail drawer — root cause was
     `usePrepRunDetail` not clearing its previous `run` state when `id`
     changes, so switching between two rows' drawers without an
     intervening close could render one tick of the old run's (or a
     partial) shape against the new fetch's in-flight status. Fixed by
     clearing `run` on every new load and requiring `status === 'ready' &&
     run` together before rendering the body, plus a defensive `lines ??
     []` guard.
   - Runs-list/History tables: the `WHEN` column wrapped to two lines
     (`formatWhen`'s comma pushed past the column's real width) and
     `UNIT COST` wrapped and collided with `BY`. Fixed the date format to
     match Paper's exact "12 Sep 07:20" (no comma) and converted both
     tables from fixed-pixel to proportional (`basis-[N%]`) column widths.
   - Nav sidebar's active-item highlight stayed on "Catalog" while viewing
     any `/app/inventory/prep*` route — `activeKeyFromPathname` in
     `app/app/inventory/(shell)/layout.tsx` had no `prep` case and fell
     through to its `catalog` default. Added the missing check.

Both `pnpm build`/`pnpm test` clean (backend 845/845, frontend build +
WDS-token check) after every fix. Milestone Three (Prep) is complete.

**Context-budget note, not a reason to pre-split.** S0 is a large session —
schema through working UI — and it's fair to worry it might not fit one
context window. The right response is a **planned mid-session handoff
seam, not pre-splitting S0 into smaller sessions out of caution.**
Pre-splitting brings back exactly the coordination overhead combining was
meant to avoid (re-establishing context, re-verifying what's already built)
for a risk that may never materialize — Milestone Two's split existed for
real technical reasons (a contract that might still move, money-state-
machine edge cases), not context management, and Prep doesn't have those
reasons. **The seam, if needed: backend fully done, tested, and committed**
(schema + migration + contract + endpoints + `pnpm build`/`pnpm test`
clean) **is a self-contained checkpoint.** If S0 runs long, stop there and
hand off — a fresh session picks up "backend is done and verified, build
the frontend against these real endpoints," reading only this plan doc +
the now-existing backend code, not re-deriving anything. Don't stop
mid-transaction-logic or mid-component-build; those don't hand off cleanly.

---

## 6. Questions for the owner — RESOLVED 2026-09-19

All four went with the stated recommendation, owner-approved as the
default. Kept here as the record of what was decided and why; §1 and §3
above already reflect the resolutions.

**Q1 — resolved: ±15% warn / ±35% notify SM.** Flow 3a says a warning shows
at one threshold ("far off the norm") and a *larger* threshold additionally
notifies the Store Manager; neither number was specified anywhere in
`01-description.md` or `02-flows.md`. Resolved as a named constant (not
hardcoded inline), same shape as the count-discrepancy threshold precedent
in `01-description.md` C3 — tunable after a week of real data, not a
one-time guess treated as final. Now folded into `PrepRun.notifiedStoreManager`'s
comment in §1.1.

**Q2 — resolved: purely informational, no automatic waste/adjustment.** A
flagged/low-yield run posts exactly as entered — a flag, and per Q1 possibly
an SM notification, but `POST /prep/runs` never auto-creates a waste or
adjustment row. Confirmed against Flow 3's own error path: a *wrong input
recorded* is corrected via a separate, deliberate Attendant action
afterward (a spot-count adjustment or a waste entry), never something the
system does automatically — auto-creating one would also mislabel a
perfectly legitimate lean batch as waste, which it may not be.

**Q3 — resolved: last 10 runs or last 30 days, whichever is fewer;
outliers always included, never excluded.** `02-flows.md` only said
"recent," no concrete window. Resolved to cap the sample (avoids one very
active output being averaged over ancient runs, while a rarely-made output
still gets a reasonable sample once it has history) and to never exclude
flagged runs from the average (avoids a circular definition — excluding
"outliers" requires already knowing what's typical, which is the thing
being computed). Folded into §1.3.

**Q4 — resolved: non-issue, catalog is the source of truth.** If two
genuinely different recipes need separate rolling averages, that's
expressed as two catalog items, not a recipe/variant concept on `PrepRun`.
Keeps this milestone's scope matching what Flow 3 actually describes — no
new concept introduced. Folded into §1.3.

**Follow-up raised during this session, deliberately deferred, not a §6
question:** a Store-Manager-set target/override for the typical-yield
figure (see §1.3's "Flagged follow-up" note) — **not built this
milestone**, no approved screen shows it, revisit if the computed-only
average proves to be a real problem once the feature is live.

---

## 7. Test classification

Following `docs/TDD.md`'s project convention (same split Milestone Two
used):
- **Unit-level:** rolling-average computation, yield-variance
  label/threshold logic, cost math (`totalInputCost`, `outputUnitCost`)
  isolated from the transaction.
- **Integration-level:** the full atomic `$transaction` (N `PREP_CONSUME` +
  1 `PREP_PRODUCE` + `InventoryItem.currentCost` update, all-or-nothing on
  failure), pagination/filter correctness on `GET /prep/runs`,
  organizationId scoping (Non-Negotiable #3) on every endpoint.
- **Contract tests:** response shape for all 5 endpoints, matching §3.3's
  sketch once frozen into real Zod schemas at S0.

---

## 8. Structure

Backend: `backend/src/modules/inventory/` — add `prep-validators.ts`,
`prep.types.ts`, `prep-repository.ts`, `prep-service.ts`, route wiring
alongside the existing `receiving-*` files (same module, not a new
top-level module — Prep is still Inventory & Procurement).

Frontend: `frontend/features/inventory/` — add
`components/screens/prep-runs-screen.tsx`,
`components/screens/new-prep-run-drawer.tsx` (+ mobile variant or a shared
component with a `surface` prop, consistent with how Milestone Two's
drawer/full-screen pairs were built — check `record-supplier-invoice-drawer.tsx`
for the established pattern before deciding),
`components/screens/prep-run-detail.tsx`,
`components/screens/prep-history-screen.tsx`, `types/prep.ts`,
`hooks/use-prep-runs.ts` / `use-prep-run-detail.ts` / `use-typical-yield.ts`.
