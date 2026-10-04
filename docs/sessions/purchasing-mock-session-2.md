# Code session: Purchasing and Receiving, mock-data front-end (Session 2 of 2)

Paste this whole file as the first message of a new agent session. It is a **code lane**, front-end only. Run it in the **same lane number** as Session 1, **after Session 1 is merged** (never in parallel with it). Session 1 brief: [purchasing-mock-session-1.md](purchasing-mock-session-1.md).

## What we are doing and why
Session 1 built the foundations (the mock engine, the Central Store sidebar group, the demo bar and banner, the order-to-delivery screens). Session 2 builds the rest of the flow on the same mock: the invoice, the money, the purchase file in every state, the Attendant's full day, and every exception. It ends with a demo script for the owner and the plain-English back-end rules the later back-end session builds from. No back-end tables, no migrations.

The decisions are in `docs/features/inventory/decisions.md`, section "One screen set, mock first (owner decisions, 4 Oct 2026)". Read it first. The same rules apply as in Session 1: one screen set for every desktop role; write buttons by capability and hidden otherwise; access in one table; the Accountant does not raise orders; Branch Manager and Director are read-only; System Admin does everything and signs with their own PIN; do **not** edit Paper (gaps are built from existing patterns).

## Read first
- `CLAUDE.md`, `docs/features/inventory/decisions.md`, `docs/PARALLEL_WORKFLOW.md` ("Finish: merge and clean up"), `docs/UI_BUILD_RULES.md`, `docs/DESIGN_SYSTEM.md`.
- Everything Session 1 left: `frontend/features/inventory/purchasing/README.md`, `docs/features/inventory/purchasing-mock/` (**screen-inventory.md**, **backend-rules.md**), the "Purchasing and Receiving (mock-first)" section of `docs/API_CONTRACT.md`, the mock engine and its tests.
- **Owner feedback:** if `docs/features/inventory/purchasing-mock/demo-feedback.md` exists, it holds what the client and roles said after the Session 1 demo. Apply it **first**: it can change screens, rules, the contract and the permissions table (a role's access is a one-row edit). If it asks for something that changes a business rule, update `backend-rules.md` and the contract in the same commit. If the file does not exist, say so and continue.
- Paper: file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`), page "Inventory · Purchasing" (`p-3-0`). Load the guide (`get_guide` `paper-mcp-instructions`), read artboards by name, never from memory or screenshots. Visual fidelity per screen by eye plus computed styles; automated pixel diff is banned.

## Step 0: start state and lane
1. `scripts/lane.sh list`; stop and tell the owner if two other code lanes are active. Confirm Session 1 is merged (`git log origin/main` shows it) and the lane is free; `scripts/lane.sh up 1 feat/purchasing-mock-2` (or the same lane number as Session 1). Work only in that worktree. Never touch the owner's main folder or production.
2. Re-read the Session 1 inventory. Every Session 2 row (below) must already be in it as `IN PAPER` or `NOT IN PAPER`. If a screen or state turned up that the inventory missed, add it before building.

## Scope: chapters 6 to 10 and the supplier page
Build, in Paper order, checking each screen against its artboard before the next (steps refer to the Screens index):
- **Chapter 6, the invoice arrives (Accountant):** orders awaiting an invoice (16), add invoice empty and filled (17, 18).
- **Chapter 4, deposit (Accountant)** if Session 1 left it: record advance (10).
- **Chapter 7, pay the supplier (Accountant):** Orders to pay (19, the "To pay" tab inside Purchasing), record payment (20), by cheque (20b), payment advice printed (21, 21b).
- **Chapter 8, everything in one place:** the closed purchase file (22), the audit log (23), every state of a purchase file (24), the supplier orders tab (25), the supplier statement (26) and printed (27).
- **Chapter 9, the Store Attendant's day (phone):** needs restocking (28), my orders (29), check the goods (30), delivery note and signature (31).
- **Chapter 10, when things go wrong:** order returned with a note (32), short delivery and price change (33), invoice higher than delivery (34), photo upload problems (35, component states), cancel an order (36), void an invoice (37), reverse a payment (38, the Accountant requests, the Store Manager approves), confirm payment (39), warnings before a mistake (40).
- **The supplier page:** it still shows "what we owe" and the record-invoice/payment drawers from the **old** back-end through `frontend/features/inventory/suppliers/legacy-payables/`. Replace them: in demo mode the supplier page's owing figures, orders tab and statement come from the **mock engine**, the record-invoice/payment actions become the new Accountant drawers, then **delete `legacy-payables/`** (and its re-exports in `features/inventory/types/index.ts` and `services/index.ts`). The rest of the supplier page, which is real, stays as it is. Check the supplier page for every role afterwards.

## The mock must cover what can happen live
The mock engine is the executable spec of the future back-end. Finish it so every flow above works end to end, including the awkward cases: a part-delivered order delivered again; a not-supplied line; a price change confirmed or refused; an invoice higher than the delivery, disputed and settled; a deposit applied to the invoice; an overdue order; payment by cash, M-Pesa, bank and cheque; a payment reversed; an invoice voided; an order cancelled; a wrong PIN; the System Admin signing with their own PIN (wording per the Paper reference table). Add the scenarios the demo needs (register every scenario Session 1 left open) so the owner can jump to any state from the demo bar. Extend the contract tests to every operation. Keep `docs/API_CONTRACT.md` and `backend-rules.md` exactly in step with what the mock does: if you change a rule or a shape, change the docs in the same commit.

## The coverage rule (read this twice)
- The inventory is a checklist. By the end **every row** (Sessions 1 and 2) is built and checked in the browser as the right role through the demo bar. Tick each row with its route. You may not end with an unticked row.
- **Not in Paper:** if it needs only existing patterns (states kit, drawers, tables, hiding a button), build it and mark `BUILT, NOT IN PAPER`. If it needs a **new flow, new data or a product decision**, stop and ask the owner. Do not invent.
- **Unclear rule:** ask. Do not guess a business rule.

## Deliverables beyond the screens
1. **Demo script** `docs/features/inventory/purchasing-mock/demo-script.md`: a walkthrough per role (Store Manager, Attendant, Accountant, Director, Branch Manager, System Admin) that says which scenario to jump to, what to click, and what to point out. It must also list the open choices the client should be asked about (who approves what, whether the Attendant needs desktop access, and so on).
2. **Back-end brief** finish `docs/features/inventory/purchasing-mock/backend-rules.md`: the complete rules, the data each operation stores, the permissions per operation, the real PIN and stock effects the mock only simulates (receiving writes the ledger through `postStockMovement`, one ledger row per received line), and the migrations the data implies in plain English (purchase orders and lines, order requests, deposits, deliveries, invoices, payments, reversals). Note that the old back-end purchasing code and tables are replaced wholesale then. This is the hand-over to the back-end session; do not build any of it now.

## Out of scope
New back-end tables, migrations or endpoints; calling the real purchasing back-end; phone versions for desktop roles; editing Paper; refactoring the old System Admin screens; moving the receiving ledger write onto the ledger door (back-end session).

## Tests (Non-Negotiable 8)
Mock-engine unit tests for every rule; the contract tests for every operation; component tests for role-based button visibility on each flow's key action; a test that no mock screen imports the real purchasing API service. Keep every existing back-end and front-end test green; do not remove or weaken any.

## Gates (all green before the PR, and again after the final rebase)
Backend `pnpm build`, `pnpm test`, `pnpm check:imports` (0 errors). Frontend `pnpm build`, `pnpm check:imports` (0 errors), type-check. Walk **every chapter as every relevant role** in the lane's browser (chrome-devtools MCP) through the demo bar, including the supplier page and the phone views; the console must be clean. Say in the PR exactly what you checked and did not.

## Docs to update
`frontend/features/inventory/purchasing/README.md`, `docs/features/inventory/roadmap.md` (row 2: mock complete, awaiting client approval, then the back-end session), `docs/features/inventory/README.md`, `docs/API_CONTRACT.md`, and the `CLAUDE.md` Current Work line. Remove any mention of `legacy-payables`.

## Finish
Follow "Finish: merge and clean up" in `docs/PARALLEL_WORKFLOW.md`. **Do not merge until the owner says "merge".** No migration, so no production backup is needed unless that changes. After the merge, watch the deploy; if it fails, report and stop. End with a short plain-English recap (about 5 lines): what changed, which files, how the owner runs the demo, and that the next step is the client demo, then feedback, then the back-end session.
