# Central Store go-live: Step 4 (Purchasing front-end live)

You are a tech lead on Wendo RMS. Read `CLAUDE.md` first (its rules apply: a `Why:` line before every Edit/Write, Edit/Write tools only and never sed/python/heredocs, pnpm only, a 5-line plain-English recap at the end, Playwright or chrome-devtools MCP to use the screens in a browser before calling UI work done). The owner wants a visible task list: check whether a task tool (TaskCreate/TodoWrite) exists this session; if none, say so once and post a short checklist in chat, updated at each stage. Then read `docs/sessions/central-store-go-live-step-3-continue-2.md` (what Step 3 built) only as needed, `docs/features/inventory/purchasing-plan.md`, and `frontend/features/inventory/purchasing/README.md`.

## State (6 Oct 2026, end of Step 3)
Branch `feat/central-store-go-live`, **not pushed**, 16 commits ahead of `47a4735`, worktree clean except the two `.claude/` files and `docs/sessions/*.md` (never stage those). Never commit on `main`. End commits with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Backend: build clean, 1,635 tests green. Frontend: `pnpm build` clean (it still uses the mock).

Step 3 is done: the back-end is at `/inventory/purchasing`, the old receiving flow and tables are gone (migration `20261006140000_drop_old_purchasing`, applied to the local DB; CI runs `migrate deploy` on push). **The API as built is documented in `docs/API_CONTRACT.md` §31 and §31.9 (read §31.9 first: it lists every place the live API differs from the mock).** Rows were verified end to end with real requests as Store Manager, Accountant and Attendant.

## The goal of Step 4
Swap the mock for the real API, remove the demo bar, add the typed-price field to the receive screen, make the Attendant screens follow the new access rule, then the owner approves the built screens against Paper.

## What is already in place on the front end
- `frontend/features/inventory/purchasing/services/purchasing-service.ts` is the ONE interface the screens use (`PurchasingService`); `mock/mock-service.ts` implements it in the browser; the `hooks/` supply it. The plan: write an HTTP implementation of the same interface (`purchasing-api-service.ts` or similar, using `lib/apiClient`) and have the hooks return it. Screens should not need to change except where listed below.
- `mock-isolation.test.ts` forbids the Purchasing screens from importing the real API client. Update the guard to the new rule (screens still import only the service interface and hooks; the HTTP implementation may use the API client) rather than deleting it.
- `purchasing-service.contract.test.ts` checks the interface; extend it so the HTTP implementation is tested against mocked fetch responses with the shapes in §31.
- `mock/` (engine, fixtures, scenarios, store, demo actors) and `components/demo-bar.tsx`, `demo-banner.tsx`: delete once nothing imports them (check the Suppliers pages, which also show mock orders, owing and statement: they must read the live endpoints `GET /inventory/purchasing/suppliers/:id/orders` and `/statement`). The System Admin demo bar goes with them.
- Types are `types/index.ts`; the live shapes match them except the points below. Update the types, never cast around them.

## Where the live API differs from the mock (all in §31.9; the ones that change screens)
1. **Receive screen needs a typed-price field.** Per line: `{lineId, receivedQty, deliveredPrice: string | null, priceConfirmed}`. `deliveredPrice` is what the receiver read on the delivery note when it differs (`null` = as ordered); a differing price needs `priceConfirmed: true` or the API returns `422 PRICE_CHANGE_UNCONFIRMED`. Only an approver's typed price changes the order's own price. PIN is 4 digits. Receiving nothing at all is refused. Needs a delivery note number and a note photo id (upload first with `POST /uploads`, multipart `file`).
2. **The Attendant now sees item prices and order totals** (owner rule: item costs are visible; see the memory note `feedback_attendant_sees_item_costs`). Money, invoice, payments, due labels and the supplier statement stay hidden for the Attendant. The mock's Attendant screens show no prices: show them now. The Attendant desktop screens (same shell at every width, no bottom tabs) are built to the access table (`GET /inventory/permissions/me`, `usePermissions()`), not to a role list.
3. **Responses:** a deposit returns the `Payment`; a payment or reversal returns `{payment, order}`; reversal body is `{reason, note, approverPin}` (a Store Manager or System Admin PIN, found by PIN).
4. **LPO print** carries no prices, total or amount in words (already true of the mock after Step 1).
5. **Audit log:** Purchasing and Payments rows come from the existing `GET /inventory/audit-log` with `area=PURCHASING|PAYMENTS`; an entry has `actor.role` and `purchasing: {action, document, detail, orderId, orderReference, supplierName}`. The mock's own audit path is gone. The existing Audit log screen under `features/inventory/audit-log/` needs the two new areas in its filter and rows (link a row to its purchase file).
6. **Errors:** codes are in §31.6. Show the plain messages the API returns; handle `409 SUPPLIER_ORDER_OPEN`, `INVOICE_DISPUTED`, `PAYMENT_EXCEEDS_BALANCE` (resend with `confirmOverpay`), `DUPLICATE_INVOICE_NUMBER` (resend with `differentInvoice: true` when the person says it is different).
7. **Amounts and ids:** decimals are strings; the order id is a uuid; references (LPO-nnnn, GRN-nnnn, PAY-nnnn) are given by the server, a draft has none.

## Plan
1. Read §31 and §31.9, the service interface, the hooks and the mock service, then post a task list.
2. Write the HTTP service against the interface; unit-test it (contract test). Switch the hooks over. Delete the demo bar, banner and `mock/`, and fix the guard test.
3. Receive screen: typed-price field, confirmation, errors. Attendant screens: prices and totals visible, money hidden, built from permissions.
4. Suppliers pages and the Audit log screen onto live data.
5. Sidebar: the Purchasing rows are in `components/app/shell/nav-table.ts` (key `purchasing`, `newHref`); check the Attendant and Branch Manager see what the access table says.
6. Verify in a real browser (chrome-devtools or Playwright MCP, not the `run-frontend-browser` skill). The backend must run from source: the owner's dev server on port 4000 is started by them and may be on old code; start your own on another port (`PORT=4010 npx tsx src/server.ts` in `backend/`) and point the frontend at it (`NEXT_PUBLIC_API_URL`). Real local logins: `store.manager@wendo.test`, `accountant@wendo.test`, `store.attendant@wendo.test`, password `password123`, signing PIN `1234` (the System Admin `admin@wendo.test` has no PIN locally). Walk one order raise to payment as each role, check the Attendant sees prices but no money, read the console for errors, and stop your test server afterwards. Do not print request headers (bearer tokens).
7. Per-screen visual check against the approved Paper file ("Wendo RMS · Approved designs", `01M3TP8J54R83RHC9FJ7RAHGKG`), by eye and with `get_computed_styles`; never an automated pixel diff. The owner approves screen by screen.
8. `cd frontend && pnpm build`, `pnpm test`, and `cd backend && pnpm build && pnpm test`. Logical commits, do not push. Update `docs/PROJECT_STATUS.md` (Step 4 row), the front-end README for purchasing, and `docs/features/inventory/README.md`.

## PINs (go-live blocker, tell the owner in the recap)
Every role can set their own PIN already: Profile → "Signing PIN" card, Settings › My PIN (Store Manager), the sign sheet's "Set your PIN" step before a first signature, and `POST /users/me/pin` (changing an existing PIN needs the account password). Store Manager can reset an attendant's PIN in Settings › Team. In production only 1 of 2 Accountants has a PIN; the Store Manager, Attendant, System Admin and Directors have none. Do not set PINs for people. Before the deploy the owner tells each person to set theirs; re-check with a read-only `pin_hash IS NOT NULL` query on the server. Verify that the System Admin account (no organization) can open the PIN screen, and that at least one Store Manager or System Admin has a PIN (payment reversal needs it).

## Decisions made in Step 3 (owner may overrule; mention them)
A discarded draft is deleted with its audit rows; a non-approver's typed order price is ignored (the supplier's price is used); receiving with nothing received is refused ("cancel the order instead"); `GET /suppliers/:id/orders` needs `suppliers.read`; `GET /summary` and the order list need `orders.read`; the supplier statement reads at most 2,000 orders per supplier; "orderable" (what an item needs to appear on a new order) is my definition and the owner may overrule it.

## Gotchas
- zsh: quote globs. The Postgres MCP is read-only (use `docker compose exec postgres psql` to change local data). `docker compose up api` does not work locally (needs a registry login and `backend/.env` has a line compose rejects): run the API from source.
- `prisma migrate dev` is refused in a non-interactive shell; use `prisma migrate diff` and `migrate deploy` locally. Never run migrate commands against production. `prisma format` rewrites every schema file: do not run it.
- Frontend hook stability rules in `CLAUDE.md` apply (stable action references, no inline functions in effect deps).
- One shell, one navigation table: no role logic in the shell; `nav-table.test.ts` must stay green.

## Finish
End with the 5-line plain-English recap (what changed, which files, how the owner checks it), the PIN blocker, the decisions list, and what is left for the owner's screen approval. Then outline Step 5 (Prep rebuild: back-end, front-end, Attendant desktop, ledger writes onto the door) in plain words and do not start it.
