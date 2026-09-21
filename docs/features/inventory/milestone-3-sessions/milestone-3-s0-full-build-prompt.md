# S0 — Backend + frontend, full vertical slice: Milestone Three (Prep)

Paste everything below the line to the agent running this session. This is a
**Step 7 build session** — the plan is owner-approved and every open modeling
question is resolved. Your job is to build the entire Prep milestone,
backend through frontend, in one session: schema → migration → contract →
backend service/endpoints/tests → frontend screens against your own
real endpoints. Do not stop after the backend and call it a full session —
the frontend half is this session's job too, unless you hit the handoff
condition described at the bottom.

---

You are running **S0** of Inventory Milestone Three's Step 7 session
breakdown (`docs/features/inventory/milestone-3-plan.md` §5). You are acting
as a **full-stack engineer on this feature** — this session is deliberately
not split into a backend agent and a separate frontend agent. Build the
backend for real, verify it works, then build the frontend against it in the
same session.

## Read first, in this order

1. `docs/features/inventory/milestone-3-plan.md` — the whole doc. It is
   short and it is the actual spec for this session: §0 (scope), §1 (data
   model — read the reasoning for every "stored, not derived" field, not
   just the shape), §2 (migration), §3 (API contract sketch — you are
   turning this into real Zod schemas, not copying it verbatim), §5 (this
   session's own scope and the handoff condition), §6 (the four resolved
   questions — the thresholds and rolling-average window are not
   negotiable, they're owner decisions).
2. `docs/features/inventory/02-flows.md` Flow 3 and Flow 3a — the actual
   user-facing behavior the endpoints and screens must match. Read this
   before the plan's §3 sketch, not after; the plan is a translation of
   these flows, and if the two ever seem to disagree, the flows doc plus
   asking is the tie-breaker, not silently picking one.
3. `docs/features/inventory/04-components.md`'s **Milestone Three**
   section (near the end of the file — search for `## Milestone Three`) —
   the reuse audit. This tells you what NOT to build: no new primitives, one
   thin new composite pattern (Prep run detail's read-only drawer wrapper).
   Read this before writing any frontend component so you don't rebuild
   something that already exists.
4. `docs/API_CONTRACT.md` §22 (Milestone Two) — the sibling contract
   section and its conventions (decimal-as-string, envelope shape). Your
   new §23 follows the same conventions, is a new section, not a merge into
   §22.
5. `backend/src/modules/inventory/receiving-validators.ts` /
   `receiving-service.ts` / `receiving-repository.ts` — Milestone Two's real
   code, for the two patterns you are directly reusing: the atomic
   `$transaction` write shape, and `referenceCounterRepository` (you likely
   will NOT need a reference number for `PrepRun` — the plan says why in
   §1.1 — but check the plan's reasoning holds before assuming).
6. `frontend/features/inventory/components/screens/goods-receipt-detail-screen.tsx`,
   `receipt-line-list-readonly.tsx`, `history-list-screen.tsx`,
   `kpi-strip.tsx`, `drawer-shell.tsx` — the exact composites/screens
   `04-components.md`'s Milestone Three section tells you to structurally
   copy or reuse. Read the real files, not just the doc's description of
   them.
7. `docs/CODING_STANDARDS.md`, `docs/TDD.md`, and `CLAUDE.md`'s
   Non-Negotiables section (organizationId scoping, no business logic in
   controllers/repositories, Zod on every endpoint, tests required).

## Role

You are a full-stack engineer building one milestone of the Inventory &
Procurement feature redo end to end. You are not a planner — the plan is
already approved, don't re-litigate §6's resolved questions or redesign the
approved Paper screens. You are not just a backend or just a frontend
engineer this session — build both, backend first, verified, before frontend
touches it.

## What to build

### Backend (build and fully verify before touching frontend)

1. **Schema + migration** (plan §1, §2): `PrepRun` + `PrepRunInputLine`
   models, restore `InventoryTransaction.prepRecordId` as a real FK, add the
   index. `npx prisma migrate dev --name inventory_milestone_three_prep`,
   commit the generated SQL file.
2. **Contract** (plan §3): `backend/src/modules/inventory/prep-validators.ts`
   + `prep.types.ts`. Turn plan §3.3's sketch into real Zod schemas —
   every decimal as a string on the wire, matching §22's conventions. Add
   `API_CONTRACT.md` §23 documenting the 5 endpoints and shapes, same
   format as §22. Mirror the types to
   `frontend/features/inventory/types/prep.ts`.
3. **Service + endpoints**: `prep-repository.ts`, `prep-service.ts`,
   `prep-controller.ts`, `prep-routes.ts` (wired into `routes/index.ts`,
   alongside the existing `receiving-*` routes — same module). All 5
   endpoints from plan §3.2. The one real risk area, per the plan's own
   note: the atomic `$transaction` (N `PREP_CONSUME` negative-signed + 1
   `PREP_PRODUCE` positive-signed + `InventoryItem.currentCost` update on
   the output item only, all-or-nothing) and the rolling-average query
   (last 10 runs or last 30 days, whichever fewer, never excluding
   flagged/outlier runs — plan §1.3, §6 Q3/Q3b). Yield-variance
   label/threshold logic uses the resolved ±15% warn / ±35% notify-SM
   constants (§6 Q1) as named constants, not inline magic numbers.
   `notifiedStoreManager` only records the fact a run crossed the
   threshold — do not build any actual notification delivery, that's
   explicitly out of scope (plan §0).
4. **organizationId scoping on every query** (Non-Negotiable #3) —
   this is checked, not assumed.
5. **Tests**: unit (cost math, threshold logic, rolling-average calc),
   integration (the full transaction succeeds/rolls back correctly,
   pagination/filters on `GET /prep/runs`, org scoping), contract tests
   for all 5 response shapes.
6. **Verify before moving to frontend**: `pnpm build` and `pnpm test` both
   clean in `backend/`. This is the checkpoint — do not start frontend work
   with a red build or failing tests underneath it.

### Frontend (only after backend is built and verified)

All 8 screens (4 screens × 2 breakpoints) from the approved Paper page
(`Milestone Three · Prep`, `p-D-0`, file `01M1ZZJ6S3FZGF5C7PPBGTKY89`),
built against your own real backend endpoints from this same session — not
mocks:

1. **Prep runs list** (desktop `Z61-0` / mobile `ZGY-0`) — reuses `KpiStrip`
   for the 3-tile summary, same table/row pattern as the existing catalog
   table. Truncated-inputs "+N more" text treatment and the `UNIT COST`
   column are part of this screen's real design, not optional polish —
   check the Paper node if anything is ambiguous.
2. **New prep run** (desktop drawer `ZAR-0` / mobile `ZIY-0` + confirm
   sheet `ZKJ-0`) — reuses `Sheet`/`DrawerShell` directly (it has a real
   primary action, "Confirm run").
3. **Prep run detail** (desktop drawer `ZMU-0` / mobile `ZUK-0`) — **do
   not use `DrawerShell`** for this one, it assumes an edit/primary-action
   flow this screen doesn't have. Build a plain wrapper directly over
   `Sheet` (desktop) / a full-screen route (mobile), following
   `GoodsReceiptDetailScreen`'s content structure (header block, read-only
   line table modeled on `ReceiptLineListReadonly`, footer stat) — this is
   the one genuinely new small composite in this milestone.
4. **Prep History** (desktop `ZZQ-0` / mobile `10AN-0`) — structurally copy
   `HistoryListScreen`'s pattern (search + filters + sticky-header table on
   desktop, card list on mobile, pagination), not a redesign. Includes the
   KPI summary strip (Runs in range / Total input cost / Yield flags)
   scoped to the active filter range — reuses `KpiStrip` again.

Loading/error/empty states via the shared `shell-states.tsx`/
`mobile-states.tsx` primitives, screen-mirroring skeletons where a screen
has real layout to mirror (per this feature's non-negotiable table/list
quality bar in `04-components.md`). Every interactive element needs hover/
focus-visible/active/disabled states per the same doc's rules.

**Verify**: `pnpm build` clean in `frontend/`. Then use Playwright or
chrome-devtools MCP to actually drive the built screens in a real browser —
this is required before calling frontend work done, not optional (per
`CLAUDE.md`'s MCP tooling guidance).

## Mid-session handoff — read this before you start, act on it only if needed

This session is scoped as one continuous vertical slice on purpose — do not
pre-emptively split it into a "backend session" and a "frontend session."
But if you are genuinely running low on context partway through:

**The only safe place to stop is right after the backend checkpoint above**
— schema, migration, contract, all 5 endpoints, `pnpm build` + `pnpm test`
both clean, everything committed. If you reach that point and are low on
budget, stop there, summarize exactly what's built and verified, and end
the session cleanly rather than starting frontend work you can't finish.
**Do not stop mid-transaction-logic, mid-endpoint, or partway through the
frontend screens** — those don't hand off cleanly to a fresh session; a
half-built transaction or half-built screen costs more to pick back up than
to have not started.

If you do stop at the backend checkpoint, the next session should be told:
"Backend for Milestone Three (Prep) is done and verified — schema,
migration, contract (`API_CONTRACT.md` §23), all 5 endpoints,
`pnpm build`/`pnpm test` clean. Read `docs/features/inventory/milestone-3-plan.md`
and `04-components.md`'s Milestone Three section, then build the 8 frontend
screens against the real endpoints." That's a clean restart — it re-reads
the plan and the already-built backend code, it does not re-derive
anything.

## What NOT to do

- Do not touch requisitions, dispatch, branch receiving, counts, or waste —
  out of scope (plan §0).
- Do not build the store prep performance report or any notification
  delivery mechanism — explicitly deferred (plan §0, §6).
- Do not build a Store-Manager target-yield override — raised and
  deliberately deferred this session, no approved screen shows it (plan
  §1.3's "Flagged follow-up" note).
- Do not re-open any of the four §6 questions — they're resolved, owner
  decisions, not open for re-litigation.
- Do not edit `receiving-validators.ts`/`receiving.types.ts` or
  `API_CONTRACT.md` §22 — Milestone Two's contract, frozen and shipped.

## When you're done

Update `docs/features/inventory/milestone-3-plan.md` §5's S0 row with what
was actually built/found (matching how Milestone Two's plan doc logs each
session's real outcome, including any bugs found and fixed along the way),
and `MILESTONES.md`'s Milestone Three status line.
