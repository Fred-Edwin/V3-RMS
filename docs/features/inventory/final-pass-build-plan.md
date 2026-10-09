# Final pass: build plan and status (written 8 Oct 2026, coordinator)

The last part of Inventory, built in code from the owner-approved Paper designs (file "Wendo RMS · Approved designs"): Requisitions, Dispatch and discrepancies, Branch waste, Branch day, and the role-coverage gap fixes. **Paper wins** wherever a document disagrees with it. Flows: `requisitions-flow.md`, `dispatch-flow.md`, `discrepancies.md`, `branch-day-flow.md`, `branch-waste-flow.md`; role matrix: `role-coverage.md`; Paper-versus-code list: `paper-updates-needed.md`. Model followed: `stock-count-waste-contract.md`.

This file is temporary working state (playbook §11). Extract anything still in force into READMEs and `decisions.md`, then delete it with the last block.

## Status table (the coordinator updates this after every session summary)

| Item | What | State | Contract | Owner check in production |
|---|---|---|---|---|
| Lane 0 | Status bar removed; Prep history dates; Audit log Area menu and range picker; Counts and Waste lists with date range and pager | merged to main (#102, 8 Oct) | amended the Stock/Counting/Waste contract (list filters; waiting counts always show) | pending |
| Block 1 | Requisitions + foundations (departments as data, branch code, numbering, notification layer, heads onto the shell) | **integrated on `feat/req-integration` (8 Oct), awaiting the owner's go.** Back end A and B, phone and desktop screens are merged and now run on the real API (mocks deleted). Walked in a real browser as a head, the Branch Manager, the Director, the Store Manager and the Accountant (Attendant by API). Found and fixed: stage tabs never fetched, screens did not update live, the worker's escalation nudge never reached any browser (Redis bridge + all-sites room), added lines counted twice, drawer overflowed at 390. Backend build and 3704 tests pass, frontend build and 578 tests pass, the two database test files now pass together. Release steps: `block-1-release.md`; screens built without a drawing: `block-1-undrawn-review.md`. Not pushed or merged | frozen, Amendments 1 and 2 | pending |
| Block 2 | Dispatch, deliveries and discrepancies | **integrated on `feat/dispatch-integration` (9 Oct), awaiting the owner's go.** Phone and desktop screens run on the real API (mocks, old screens, old hooks and the old pack route deleted). Added in integration: V7 `GET /inventory/deliveries/:id` (same blind and money rules), the first-view race fixed with a lock, REQ- reference and carrier on the Attendant's rows, department members on the one shell, the multiple-gap card with one Record a finding link per line. Walked in a real browser as the Attendant, a head, two members, the Branch Manager, the Store Manager, the Director, the Accountant and the System Admin, with sockets and both worker jobs. Back-end build and 4028 tests pass, the dispatch, deliveries and requisitions database files pass one at a time, front-end build and 694 tests pass. **Paper comparison:** measured against Paper and fixed: phone D1 to D12, N1, N1b, N2, N2b, N3a, G2, G3 and the chapter 10 screens; desktop D13, D14, D15, D16, D19, D20. **Deferred by the owner (9 Oct), to check by eye in the per-role production check:** D17, D17b, D17c (printed notes), D18 (Carriers), the 7c list, E1 to E3, D22; the 768 and 1024 spot-checks; the full keyboard pass on every drawer and dialog (the finding drawer was tested: focus in, Escape closes, focus returns); the error-with-Retry sweep on every screen. Release steps for both blocks: `block-1-release.md`; pieces built without a drawing: `block-2-undrawn-review.md`. Not pushed or merged | frozen (`dispatch-contract.md`, Amendment 1), plus V7 | pending |
| Block 3 | Branch waste | not started | to write after Block 2 | pending |
| Block 4 | Branch day | not started | to write after Block 3 | pending |
| Block 5 | Gap fixes: Attendant home (52), My counts (53), My waste today and earlier (54). Step 55 (department waste, today and earlier) proposed to move to Block 3 | amendment drafted (`stock-count-waste-amendment-2.md`), waiting for the owner's approval; two small sessions (back end, then front end) | draft amendment | pending |
| Paper session 4 | Stale stamps; the design for items, head and staff of an added department; catch-up for Block 1's undrawn pieces | prompt written (`docs/sessions/final-pass-paper-session-4-catch-up.md`) | none | n/a |

Sessions per block and their prompts: `docs/sessions/final-pass-*.md`. Common rules every prompt repeats: `docs/sessions/final-pass-session-common.md`.

## Order

1. **Lane 0** now (no contract). 2. **Block 1**, then 2, 3, 4 in order. 3. **Block 5** last, or beside Block 1 as its own session if the owner wants the Attendant's gaps sooner (different sub-modules; the orchestrator wires `routes/index.ts` and `nav-table.ts`). Each block ends with the owner's production check before the next starts.

Why this order: Requisitions carries the schema risk (departments become data, the branch code) and everything hangs off it. Dispatch needs approved requisitions. Waste is small and must be ready before the day, whose "Used today" shows waste as its own column. Branch day replaces the most old logic and needs confirmed deliveries as a close blocker.

## Defaults the owner accepted (8 Oct 2026, "go with your recommendation")

- **Mock first:** none. Real data per block, a seeded demo run by the System Admin for the client. (If the client has not approved a block, say so and that block gets a mock first.)
- **Branch code:** NYR for Nyeri Town, KRT for Karatina, until the owner corrects them. A setting on the branch. Counter per branch (`ReferenceCounter` prefix `REQ`, `DSP`, `DSC`, `DAY` on the branch site).
- **Departments as data:** a `departments` table per branch seeded with the five; old enum columns stay and are dual-written until the Block 4 contract migration (see `requisitions-contract.md` §2).
- **Old history:** stays readable, keeps its old numbers; migration back-fills `REQ-` references in open order per branch.
- **Cut-over:** release a block late evening after every branch has closed its day and nothing is mid-flight.
- **Floor-staff heads** (chef, barista, steward, housekeeping) move onto the shell in Block 1; their non-inventory rows (Shifts, Payslips and so on) stay as drawer links to the old pages.
- **Notification map:** row 13 (requisition cancelled): tell the head, and the store if it was approved. Row 15 (day closed): no alert. Rows 5 and 10 are decided as in the map page (a push when a dispatch is sent; the Director's count alert is a push and an Inbox row).
- **Dispatch:** Extra-line findings mirror the short-line ones; Store Manager and System Admin record and reverse findings; photos up to 3 per line, 5 MB each; the branch copy of the delivery note omits quantities; the 2-hour, 24-hour and 1-hour timers are fixed constants, not settings.
- **Nav:** one Requisitions row per role, with the Queue, Discrepancies and History sub-links Paper draws for the desktop roles; the Attendant keeps a Dispatch row; heads and members get the drawer rows from the map page.

## Code placement (the refactor rules, applied to every session)

Back end, `backend/src/modules/inventory/<sub>/`, one folder per thing the user does:

| Sub-module | Block | Notes |
|---|---|---|
| `requisitions/` | 1 | rebuilt in place; old files deleted |
| `departments/` | 1 | departments as data, per branch (settings) |
| `dispatch/` | 2 | packing, carriers, delivery note |
| `deliveries/` | 2 | the branch's blind count and confirm (new, split out of dispatch) |
| `discrepancies/` | 2 | findings and reversal (split out of dispatch) |
| `waste/branch/` | 3 | today's `waste/department/` renamed |
| `branch-day/` | 4 | rebuilt in place; reopen and thresholds deleted |
| `_shared/` | all | access rows, wire primitives, notification layer helpers |

Each sub-module: `README.md`, `<sub>-routes.ts`, `-controller.ts`, `-service.ts`, `-repository.ts`, `-validators.ts`, `<sub>.types.ts`, tests beside the code, and a frozen `_shared/<sub>-contract.ts` with fixtures and a contract test. Business rules in services only; Prisma in repositories only (a `$transaction` in a service is allowed); Zod on every input; `authenticate` and the access table on every route; `siteId` in every query; every stock movement through `postStockMovement`. Schema in `backend/prisma/schema/inventory/*.prisma`, migrations committed beside the schema.

Front end, `frontend/features/inventory/<sub>/{components,hooks,lib,services,store,types}`, `_shared/`, and the feature's public `index.ts`. `app/` pages are thin shells under the existing route groups. Primitives from `components/ui2/` and `wds-` tokens only, never `components/ui/`. Navigation only through rows in `components/app/shell/nav-table.ts`. Contract types mirrored by hand in `_shared/types` with the same fixtures. Other features import `features/inventory/index.ts` only. Old pages and components are deleted in the PR that replaces them. The structure test (`scw-boundary.test.ts` pattern) is extended for each new sub-module.

## Coordinator checklist for every returned summary (Phase 4)

Contract matched (no drift); nothing missing, nothing extra; folders and file names follow the placement above; old files deleted; README updated; tests listed and passing (backend build and test, frontend build); ledger guard allow-list lowered where a writer moved; Paper checked per screen at 390 and 1440 with `get_computed_styles`; accessibility checks done; every write has an error path tested; owner's production check scheduled. Anything that changes the plan is flagged and asked before it is changed.

## Owner to run (read-only, for the migration plan; paste results)

Run on the production database (`SELECT` only) and paste back before the Block 1 migration is written:

```sql
SELECT status, count(*) FROM requisitions GROUP BY status;
SELECT type, count(*) FROM requisitions GROUP BY type;
SELECT status, count(*) FROM dispatches GROUP BY status;
SELECT status, outcome, count(*) FROM discrepancies GROUP BY status, outcome;
SELECT status, count(*) FROM branch_days GROUP BY status;
SELECT count(*) FROM branch_day_reopens;
SELECT prefix, last_number FROM reference_counters WHERE prefix IN ('DSC','DAY','REQ','DSP');
SELECT id, name, type, is_hub FROM organizations ORDER BY type, name;
SELECT department_tag, count(*) FROM users WHERE department_tag IS NOT NULL GROUP BY department_tag;
```

If a table name differs, the back-end session corrects it and asks. Nothing here changes data.
