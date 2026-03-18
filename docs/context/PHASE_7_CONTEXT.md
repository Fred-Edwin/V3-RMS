# Phase 7 — Context (Living File)

This file is updated as tasks are completed. It is the agent's source of truth about what has been done and what decisions were made during this phase.

---

## Status
- [x] Phase 7 In Progress
- [x] Phase 7 Complete

---

## Completed Tasks

### Schema & Migration
- [x] Extended `PaymentMethod` enum in `backend/prisma/schema.prisma`: added `HOUSE_ACCOUNT`, `CORPORATE_ACCOUNT`, `CUSTOMER_CREDIT`
- [x] Added 6 new models: `HouseAccount`, `HouseAccountSettlement`, `CorporateAccount`, `CorporateAccountSettlement`, `CustomerCreditAccount`, `CustomerCreditSettlement`
- [x] Added 4 nullable FK fields on `Order`: `houseAccountId`, `corporateAccountId`, `corporateEmployeeRef`, `customerCreditAccountId`
- [x] Added back-relations to `User` (7 new arrays) and `Organization` (`customerCreditAccounts`)
- [x] Migration applied: `backend/prisma/migrations/20260318042315_add_credit_accounts/`

### Slice 1 — House Accounts
- [x] `backend/src/repositories/house-account-repository.ts` — `findAll`, `findAllActive`, `findById`, `findByUserId`, `create`, `update`, `incrementBalance`, `decrementBalance`, `findOrdersByAccountId`, `createSettlement`, `findSettlementsByAccountId`
- [x] `backend/src/services/house-account-service.ts` — `list`, `listActive`, `getOwn`, `grantAccount`, `updateAccount`, `recordSettlement`, `getOrderHistory`
- [x] `backend/src/validators/house-account-schemas.ts` — `CreateHouseAccountSchema`, `UpdateHouseAccountSchema`, `RecordHouseSettlementSchema`, `HouseAccountIdParamSchema`
- [x] `backend/src/controllers/house-account-controller.ts` — `listActive`, `list`, `getOwn`, `grantAccount`, `updateAccount`, `recordSettlement`, `getOrderHistory`
- [x] `backend/src/routes/house-account-routes.ts` — 7 routes; `/active` and `/my` registered before `/:id`
- [x] `frontend/services/houseAccountService.ts` — `listActive`, `list`, `getOwn`, `grantAccount`, `updateAccount`, `recordSettlement`; `HouseAccountDropdownItem` interface exported
- [x] `frontend/app/app/admin/house-accounts/page.tsx` — SYSTEM_ADMIN/DIRECTOR management page: grant, edit, settle, deactivate

### Slice 2 — Corporate Accounts
- [x] `backend/src/repositories/corporate-account-repository.ts` — no `organizationId`; `findAll`, `findAllActive` (dropdown shape), `findById`, `create`, `update`, `incrementBalance`, `findOrdersByAccountId`, `createSettlement`
- [x] `backend/src/services/corporate-account-service.ts` — WAITER/MANAGER get minimal active list; DIRECTOR/SYSTEM_ADMIN get full list; create/update/settle restricted to DIRECTOR/SYSTEM_ADMIN
- [x] `backend/src/validators/corporate-account-schemas.ts`
- [x] `backend/src/controllers/corporate-account-controller.ts`
- [x] `backend/src/routes/corporate-account-routes.ts` — no `branchScope` middleware
- [x] `frontend/services/corporateAccountService.ts` — `CorporateAccountDropdownItem` interface exported
- [x] `frontend/app/app/admin/corporate-accounts/page.tsx` — SYSTEM_ADMIN/DIRECTOR management page
- [x] `frontend/app/app/director/corporate-accounts/page.tsx` — re-exports admin page

### Slice 3 — Customer Credit Accounts
- [x] `backend/src/repositories/customer-credit-repository.ts` — branch-scoped (`organizationId` in all where clauses); `findAllActive` for dropdown
- [x] `backend/src/services/customer-credit-service.ts` — WAITER can create; MANAGER manages all; settlements MANAGER only
- [x] `backend/src/validators/customer-credit-schemas.ts` — `creditLimit` required (not nullable)
- [x] `backend/src/controllers/customer-credit-controller.ts`
- [x] `backend/src/routes/customer-credit-routes.ts` — uses `branchScope` middleware
- [x] `frontend/services/customerCreditService.ts` — `CustomerCreditDropdownItem` interface exported
- [x] `frontend/app/app/manage/customer-credit/page.tsx` — Manager: create, edit, settle, deactivate

### Order Integration
- [x] Extended `RecordPaymentSchema` in `backend/src/validators/order-schemas.ts`: added `houseAccountId?`, `corporateAccountId?`, `corporateEmployeeRef?`, `customerCreditAccountId?` with `superRefine` rules
- [x] `backend/src/services/order-service.ts` — pre-validation for each credit payment method (account existence, active status, credit limit)
- [x] `backend/src/repositories/order-repository.ts` — `recordPayment` uses `prisma.$transaction` for credit paths; balance incremented atomically; credit limit re-checked inside transaction
- [x] `frontend/types/order.ts` — extended `PaymentMethod` union with 3 new values; added 4 nullable FK fields to `OrderDetail`

### Slice 4 — Outstanding Balances & Reporting
- [x] `backend/src/repositories/report-repository.ts` — added `getOutstandingBalances(organizationId?)`
- [x] `backend/src/services/report-service.ts` — added `getOutstandingBalances(actor)`; MANAGERs scoped to their branch, others see all
- [x] `backend/src/controllers/report-controller.ts` — added `getOutstandingBalances` handler
- [x] `backend/src/routes/report-routes.ts` — `GET /reports/outstanding-balances` (no branchScope; SYSTEM_ADMIN/DIRECTOR/MANAGER)
- [x] `backend/src/types/report.types.ts` — added `OutstandingBalancesReport`, 3 row interfaces, 3 new `revenueByPaymentMethod` keys
- [x] `frontend/types/report.ts` — extended `DailySummary.revenueByPaymentMethod`; added `OutstandingBalancesReport` and row interfaces
- [x] `frontend/services/reportService.ts` — added `getOutstandingBalances`
- [x] `frontend/app/app/manage/outstanding-balances/page.tsx` — tabbed House/Corporate/Customer Credit view with summary total cards
- [x] `frontend/app/app/director/outstanding-balances/page.tsx` — re-exports manage page

### My Tab Page
- [x] `frontend/app/app/manage/my-tab/page.tsx` — shared for MANAGER and DIRECTOR; shows own house account balance/limit, settlement modal; 404 → "No active house account" empty state

### OrderDetailBottomSheet Integration
- [x] `frontend/components/orders/OrderDetailBottomSheet.tsx` — added `HOUSE_ACCOUNT`, `CORPORATE_ACCOUNT`, `CUSTOMER_CREDIT` payment options; account selector dropdowns for each; inline new customer form for CUSTOMER_CREDIT; `onCreateCustomerCredit` callback prop
- [x] `frontend/app/app/orders/page.tsx` — fetches `listActive`/`list` for all 3 account types on mount; passes to sheet; wires `onCreateCustomerCredit`
- [x] `frontend/app/app/dashboard/page.tsx` — same credit account fetch + props wired for manager dashboard's sheet

### Navigation
- [x] `frontend/app/app/layout.tsx` — SYSTEM_ADMIN sidebar: House Accounts, Corporate Accounts; DIRECTOR sidebar: Corporate Accounts, Outstanding Balances, My Tab (new Credit section); MANAGER sidebar: Customer Credit, Outstanding Balances, My Tab (Credit section); all mobile nav configs updated

### Routes Registration
- [x] `backend/src/routes/index.ts` — registered `houseAccountRoutes`, `corporateAccountRoutes`, `customerCreditRoutes`

---

## Decisions Made

- **Atomic balance updates**: `order-repository.ts` uses `prisma.$transaction` for all three credit payment paths. Balance is incremented inside the transaction. Credit limit is re-checked inside the transaction to prevent check-then-act race conditions. `CREDIT_LIMIT_EXCEEDED` thrown as plain `Error` inside transaction, caught and remapped to `ConflictError` in `order-service`.

- **Corporate accounts have no `organizationId`**: Mirrors the `MenuCategory`/`MenuItem` pattern. All branches share the same corporate account pool. The `branchScope` middleware is omitted from all corporate account routes.

- **`/house-accounts/active` and `/house-accounts/my` registered before `/:id`**: Express would otherwise match the literal strings `"active"` and `"my"` as UUID `id` parameters. Same pattern as the Cloudinary upload route.

- **`GET /house-accounts/active`**: Separate endpoint (MANAGER/WAITER/DIRECTOR/SYSTEM_ADMIN) returning minimal dropdown shape. The full `GET /house-accounts` remains restricted to DIRECTOR/SYSTEM_ADMIN only.

- **Inline customer credit creation**: WAITER/MANAGER can create a `CustomerCreditAccount` during the payment flow. The parent page calls `customerCreditService.createAccount` first, then passes the returned ID in the payment payload. If payment subsequently fails, the account exists with zero balance — acceptable; a manager can deactivate it.

- **Settlement guard**: `amount > currentBalance` → 422 `ValidationError`. Uses `{ decrement: amount }` Prisma atomic operation.

- **`CustomerCreditAccount.creditLimit` is required**: Never nullable (unlike House/Corporate where `null` means uncapped). Enforced at schema and validator level.

- **Manager settlement scope**: Managers can only record settlements on their own house account (`account.userId === actor.id`). Directors and System Admins can settle any account.

---

## Blockers / Issues
- No blocking issues remain.
- Local DB was wiped during development by accidental `prisma migrate reset --force`; restored from production snapshot and Phase 7 migration applied via `prisma migrate deploy` from host machine.

---

## Notes for Next Phase (Phase 8)
- Credit account balances are Prisma `Decimal` fields — always use `.toFixed(2)` when serialising to JSON; never do arithmetic on the raw string values on the frontend.
- The `revenueByPaymentMethod` object on `DailySummary` now has 7 keys: `MPESA`, `CASH`, `CARD`, `SPLIT`, `HOUSE_ACCOUNT`, `CORPORATE_ACCOUNT`, `CUSTOMER_CREDIT`. Any code that initialises or reads this object must include all 7.
- Corporate and house accounts are system-level — never add `organizationId` filtering to their repositories.
