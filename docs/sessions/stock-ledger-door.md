# Code session: the stock ledger door (Inventory step 1b)

Paste this whole file as the first message of a new agent session. It is a **code lane**. It touches only `backend/src/modules/inventory/` (plus docs), so it can run next to the Workforce design lane and, later, next to the Access & Organisation lane.

## Why this session exists
Stock on hand is derived from the append-only `InventoryTransaction` table (the ledger). Today every flow writes to it on its own. Three Inventory rebuilds (Purchasing, Prep, Stock and counts) would otherwise each invent their own way to post a movement. This session builds **one function that every flow uses to post a stock movement**, with tests, and a guard that stops new direct writes.

## Read first
- `CLAUDE.md` (all of it: Non-Negotiables 3 to 5, 8 and 12 to 14; the migration workflow; the two Key rules for the Central Store).
- `docs/features/inventory/README.md` (standing rules) and `docs/features/inventory/roadmap.md` (row 1b).
- `backend/src/modules/inventory/stock/README.md` (the ledger belongs to the `stock` sub-module) and `docs/features/inventory/decisions.md`.
- `docs/PARALLEL_WORKFLOW.md`, including "Finish: merge and clean up".
- `backend/prisma/schema/inventory/stock.prisma` (the `InventoryTransaction` model and `InventoryTransactionType` enum).
- `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` (the hub rule the door must keep).

## State when this brief was written (4 Oct 2026)
- `main` is at the Company/Site rename (PR #72). In code a branch or the Central Store is a **Site** and the field is `siteId`. The database column is still `organization_id`. The API still says `organizationId`.
- Migrations now live in `backend/prisma/schema/migrations/`.
- The lane template database is refreshed (79 migrations).
- After the rename, the alignment of columns in the `.prisma` files drifted. `pnpm exec prisma format` fixes it. If you touch a schema file, do the format as its own first commit.

## Step 0: isolate yourself
Run `scripts/lane.sh list` first. Stop and tell the owner if two other code lanes are already active. Then run `scripts/lane.sh up 1 feat/stock-ledger-door` (or a free lane) and work only in that worktree, on that lane's ports, database and browser. Do not touch the owner's main folder, untracked files, or processes you did not start. Never touch production.

## What exists today (checked 4 Oct 2026; verify before you rely on it)
Direct writes with `tx.inventoryTransaction.create` in app code, 11 call sites in 7 files:

| Flow | File | Movement type(s) |
|---|---|---|
| Receiving | `purchasing/receiving-service.ts` | `RECEIVE` |
| Prep | `prep/prep-service.ts` (2 sites) | `PREP_CONSUME`, `PREP_PRODUCE` |
| Counting | `counting/count-service.ts` | `ADJUSTMENT` |
| Dispatch | `dispatch/dispatch-service.ts` (2 sites) | `DISPATCH_OUT`, `DISPATCH_IN` |
| Discrepancy | `dispatch/discrepancy-service.ts` (3 sites) | dispatch and adjustment rows |
| Waste | `waste/waste-service.ts` | `WASTE` (negative quantity) |
| Branch day | `branch-day/branch-day-repository.ts` (`writeAdjustment`) | `ADJUSTMENT` |

Also: seven dev seed scripts in `backend/src/scripts/` write the ledger directly (leave them; see the guard below). `MARKET_RECEIVE` and `SALE` exist in the enum, but no flow posts them. Out of scope.

Facts about a ledger row (confirm each in the code):
- On hand is a plain sum of `quantity`. Quantity is **signed**: `WASTE`, `PREP_CONSUME` and `DISPATCH_OUT` are negative.
- A row carries `siteId`, `locationId`, `inventoryItemId`, `type`, `quantity`, `unitCost`, `userId`, an optional `reason`, and **one** source link that fits its type (for example `goodsReceiptLineId`, `wasteLogId`, `prepRecordId`, `dispatchLineId`, `branchDayLineId`, `openingLineId`).
- `ADJUSTMENT` rows also carry a `reference` (`ADJ-####`, from the `ReferenceCounter`). A correction is a **new** row with `reversesTransactionId` set. A row can be reversed at most once (unique index).
- Services write the table directly inside `prisma.$transaction`. Non-Negotiable 5 says plain database writes belong in repositories.

## Decide with the owner first (ask before any code, with your recommendation)
1. **Where it lives and what it is called.** Recommendation: a `ledger` area inside the `stock` sub-module (`modules/inventory/stock/`), with a repository function that takes a transaction client and a public function exported through the Inventory module's public file, so other sub-modules import the door and never the table.
2. **Who owns the sign.** Recommendation: the caller passes a positive quantity and the movement type, and the door applies the sign from the type. `ADJUSTMENT` is the exception: the caller passes the signed quantity, because a count can go either way. This removes the "forgot to negate" bug class. Show the owner the per-type sign table before you code it.
3. **How many existing writers move now.** Recommendation: the door plus tests that prove every existing call shape can be expressed, and move **one** simple writer as proof (Waste). The rest move when their sub-module is rebuilt, as the roadmap says. Do not move all 11 sites in this session.
4. **The guard.** Recommendation: a test that fails when code outside the door and an allow-list calls `inventoryTransaction.create`, `createMany`, `update` or `delete`. The allow-list lists today's call sites and **shrinks** as rebuilds move onto the door. Seed scripts are excluded.

## What the door must enforce
Check each rule against the code before you write it, and cite the file in the code comment or README.
- **Append-only.** The door can create. It cannot update or delete. A correction is a new linked row (`reversesTransactionId`), and the door rejects a second reversal of the same row.
- **Site matches location.** The row's `siteId` is the owning site of the `locationId` (not the item's owner). Verify how Waste and Dispatch pick it today, and keep that behaviour.
- **Hub rule (D-15).** Central Store rows live on the hub site. Branch department rows live on the branch site. Do not weaken the existing service guards.
- **Exactly one valid source link for the type,** and the link points at a row in the same site.
- **`ADJUSTMENT` gets its `ADJ-####` reference** from the existing counter, in the same transaction.
- **Same transaction as the caller.** The door takes the caller's transaction client. It never opens its own.
- **Errors** use the existing error classes (`ValidationError`, `ConflictError` and so on), with messages a screen can show.

## Out of scope
- Rebuilding any screen, or moving more than the one proof writer.
- `SALE` and `MARKET_RECEIVE` (no flow posts them).
- Changing how on-hand is calculated, or any read query (the `groupBy` and `aggregate` reads stay where they are).
- The two open owner decisions in `docs/features/inventory/decisions.md` (miscount-correction ledger effect; attendant on-hand in dispatch fulfil). Do not decide them. If your design depends on one, stop and ask.
- A database trigger that blocks UPDATE and DELETE on the ledger. It is a good idea. Write it up as a follow-up for the owner. Do not build it here.
- A schema migration. None is expected. If you think you need one, stop and ask first.

## Tests (Non-Negotiable 8)
- Unit tests for each movement type: sign, link, cost, reference.
- Tests for every rejection: second reversal, wrong site, missing or extra link, unknown type.
- A test that the door joins the caller's transaction and rolls back with it.
- At least one test against the **real lane database** (not mocks) that posts a movement and reads on-hand back. Existing Inventory tests mock Prisma, and a mocked test hid a raw SQL bug in the rename session. Do not rely on mocks alone.
- The guard test from decision 4.
- Keep the existing 1,581 backend tests green. Do not remove or weaken any.

## Gates (all green before the PR, and again after the final rebase)
- Backend `pnpm build`, `pnpm test`, `pnpm check:imports` (0 errors; the 17 existing warnings may shrink). Frontend `pnpm build` and `pnpm check:imports` too. If you changed nothing in `frontend/`, they should still pass; say so in the PR.
- If you moved the Waste writer: use the lane's browser to log a waste entry as the Store Manager (`store.manager@wendo.test`, password `password123`) and confirm the stock figure drops by the right amount. Check the database with the Postgres MCP.
- A before/after check for the moved writer: the ledger row it writes is identical to what the old code wrote (same fields, same sign, same cost).

## Docs to update
`backend/src/modules/inventory/stock/README.md` (the door: purpose, signature, rules, the allow-list), `docs/features/inventory/roadmap.md` (row 1b status), `docs/features/inventory/README.md` (add a standing rule: post stock movements through the door), and one line in `CLAUDE.md` under the Inventory key rules. Update the sub-module README of the writer you moved.

## Finish
Follow "Finish: merge and clean up" in `docs/PARALLEL_WORKFLOW.md`. **Do not merge until the owner says "merge".** There is no migration in this change, so no production backup is needed unless that changes. After the merge, watch the deploy. If it fails, report and stop. End with the short plain-English recap (about 5 lines): what changed, which files, how the owner can verify it.
