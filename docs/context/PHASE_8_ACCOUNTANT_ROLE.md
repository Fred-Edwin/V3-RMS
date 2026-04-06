# ACCOUNTANT Role — Context (Addendum to Phase 8)

This file documents the full implementation of the ACCOUNTANT role. The work spans Phase 7
(credit account access extensions) and Phase 8 (reporting infrastructure and purpose-built
screens). It is a standalone addendum so future agents have a single reference without needing
to diff against Phase 7 context.

---

## Status
- [x] Backend RBAC extensions — Complete
- [x] Credit account service extensions — Complete
- [x] Accountant-specific reporting endpoint — Complete
- [x] Accountant dashboard screen — Complete
- [x] Accountant reconciliation screen — Complete
- [x] Accountant analytics screen — Complete
- [x] Unified credit accounts screen — Complete
- [x] System Admin: Leadership Accounts improvements — Complete

---

## What ACCOUNTANT Can Do (RBAC Summary)

| Capability | Notes |
|---|---|
| View branch overview (all branches) | Same as DIRECTOR — cross-branch, read-only |
| View director trends report | Same as DIRECTOR — cross-branch |
| Export branch overview CSV | Same as DIRECTOR |
| View accountant reconciliation report | ACCOUNTANT + SYSTEM_ADMIN only |
| View outstanding balances | All branches |
| View + record settlements on House Accounts | Read + write (settlement only — no create/edit account) |
| View + record settlements on Corporate Accounts | Read + write (settlement only) |
| View + record settlements on Customer Credit Accounts | Read + write; must pass `?branchId=` to scope per branch |
| Staff performance / hourly heatmap | Blocked — branch-scoped operations only |

---

## Backend Changes

### `backend/src/services/report-service.ts`

**`resolveBranchScopedOrganizationId`**
- Added `actor.role === 'ACCOUNTANT'` alongside `DIRECTOR` so the function accepts `?branchId=`
  query param from cross-branch roles instead of reading `organizationId` from the JWT.
- Without this fix the endpoint throws `"Branch context missing for this user"`.

**`getBranchOverview`, `getDirectorTrends`, `exportBranchOverviewCsv`**
- Changed guard from `actor.role !== 'DIRECTOR'` → `actor.role !== 'DIRECTOR' && actor.role !== 'ACCOUNTANT'`
  in all three functions.
- Without this fix the endpoint throws `"Only directors can access branch overview reports"`.

**`getAccountantReconciliation` (new)**
- Guards: ACCOUNTANT and SYSTEM_ADMIN only.
- Delegates to `reportRepository.getAccountantReconciliation(organizationId, date)`.
- `organizationId` resolved via `resolveBranchScopedOrganizationId` — caller must pass `?branchId=`.

---

### `backend/src/repositories/report-repository.ts`

**`getBranchOverview`**
- Added `paymentOrders` fetch per branch: queries closed orders for today and computes
  `paymentBreakdown` using `computePaymentBreakdown`.
- Result shape extended: each branch row now includes `paymentBreakdown: WaiterPaymentBreakdown`.

**`getAccountantReconciliation` (new)**
- Returns `{ date, organizationId, organizationName, summary, waiters, orders }`.
- `summary`: aggregated M-Pesa / Cash / Card / Credit totals for the day.
- `waiters`: per-waiter breakdown (name, M-Pesa, Cash, Card, Credit, total).
- `orders`: full order list for the day with payment method, amount, waiter name, table, time.

---

### `backend/src/types/report.types.ts`

- `BranchOverviewRow` extended: added `paymentBreakdown: WaiterPaymentBreakdown`.
- New interfaces added:
  - `AccountantReconciliationOrder`
  - `AccountantReconciliationWaiterRow`
  - `AccountantReconciliationReport`

---

### `backend/src/validators/report-schemas.ts`

- Added `AccountantReconciliationQuerySchema`: `{ date: isoDateString, organizationId: uuid }`.
- Exported `AccountantReconciliationQueryInput` type.

---

### `backend/src/controllers/report-controller.ts`

- Added `getAccountantReconciliation` handler using `AccountantReconciliationQuerySchema`.

---

### `backend/src/routes/report-routes.ts`

- Added `GET /reports/accountant-reconciliation` — roles: ACCOUNTANT, SYSTEM_ADMIN.

---

### `backend/src/services/house-account-service.ts`

**`requireDirectorOrAdmin`** (internal guard)
- Added `actor.role !== 'ACCOUNTANT'` so ACCOUNTANTs can call list, getOwn, recordSettlement.

**`recordSettlement` guard**
- Added `actor.role !== 'ACCOUNTANT'` to allow settlement recording.

---

### `backend/src/services/corporate-account-service.ts`

**`requireDirectorOrAdmin`** (internal guard)
- Added ACCOUNTANT — same pattern as house account service.

**`getOrderHistory` inline guard**
- Added ACCOUNTANT.

---

### `backend/src/services/customer-credit-service.ts`

**Key architectural change:** Replaced `requireOrganizationId(actor)` with
`resolveOrganizationId(actor, requestedOrgId?)` throughout the service.

- ACCOUNTANT has no `organizationId` in their JWT (cross-branch role).
- ACCOUNTANT must pass `?branchId=` as a query param, which the controller reads and
  passes to the service as `requestedOrgId`.
- All other roles continue to use `actor.organizationId` from the token.

**`requireManager`** (internal guard)
- Added ACCOUNTANT.

**`list`, `recordSettlement`, `getOrderHistory`**
- Now accept optional `requestedOrgId?: string` parameter.

---

### `backend/src/controllers/customer-credit-controller.ts`

- `list`, `recordSettlement`, `getOrderHistory`: read `branchId` from `req.query` and pass to
  service as `requestedOrgId`.

---

## Frontend Changes

### Types

**`frontend/types/report.ts`**
- `BranchOverviewRow` extended: added `paymentBreakdown: WaiterPaymentBreakdown`.
- New interfaces: `AccountantReconciliationOrder`, `AccountantReconciliationWaiterRow`,
  `AccountantReconciliationReport`, `AccountantReconciliationQuery`.

---

### Services

**`frontend/services/reportService.ts`**
- Added `getAccountantReconciliation(token, query)` → `GET /reports/accountant-reconciliation`.

**`frontend/services/houseAccountService.ts`**
- Added `getOrderHistory(id, token, page, perPage)` → `GET /house-accounts/:id/orders`.

**`frontend/services/corporateAccountService.ts`**
- Added `getOrderHistory(id, token, page, perPage)` → `GET /corporate-accounts/:id/orders`.

**`frontend/services/customerCreditService.ts`**
- `recordSettlement` now accepts `branchId?` and appends `?branchId=` to URL.
- Added `getOrderHistory(id, token, page, perPage, branchId?)` → `GET /customer-credit-accounts/:id/orders`.

---

### Pages

**`frontend/app/app/accountant/page.tsx`** — Dashboard
- 4 KPI stat cards: Today's Revenue, MTD Revenue, Outstanding Credit, Today's Cash Collected.
- Payment method table by branch: M-Pesa / Cash / Card / Credit / Total columns + totals row.
- MTD Revenue Allocation strip using `RevenueBreakdownCard` (VAT 16%, Tourism Levy 2%, etc.).
- Loads `getBranchOverview` (today + MTD) and `getOutstandingBalances` in parallel.

**`frontend/app/app/accountant/reconciliation/page.tsx`** — Reconciliation
- Branch selector + date picker (defaults to yesterday) + Load Report button.
- Summary stat cards: M-Pesa, Cash, Card, Credit Extended.
- Waiter collections table: per-method columns (M-Pesa, Cash, Card, Credit, Total).
- Collapsible order drill-down with tabs (All / M-Pesa / Cash / Card / Credit) + CSV export.
- Workflow: summary-level match first; drill into orders only when a discrepancy is found.

**`frontend/app/app/accountant/analytics/page.tsx`** — Analytics
- 4 tabs: Revenue Overview, Payment Methods, Revenue Allocation, Staff Collections.
- Revenue Overview: `LineTrendChart` + `MultiLineTrendChart` + branch summary table.
- Payment Methods: summary cards + per-branch breakdown table.
- Revenue Allocation: `RevenueBreakdownCard` component.
- Staff Collections: waiter table with M-Pesa / Cash / Card columns.
- **Chart data shape:** `{ label: string, date: string, value: number }` — `label` is required
  by `ChartDatum`. `MultiLineSeries` uses `{ id, label, data }` not `{ id, name, points }`.

**`frontend/app/app/accountant/credit/page.tsx`** — Unified Credit Accounts
- `OutstandingHeader`: 3-column KPI strip (House / Corporate / Customer) + grand total.
- 3 tabs: House Accounts | Corporate Accounts | Customer Credit.
- Each tab: expandable rows (click row → load order history inline), settlement modal.
- Customer Credit tab has a branch selector to scope to a specific branch.
- Shared `SettlementModal` component used across all three account types.

---

### Navigation

**`frontend/app/app/layout.tsx`**
- ACCOUNTANT sidebar:
  - Financials section: Dashboard (`/app/accountant`), Reconciliation, Analytics.
  - Credit Accounts section: single link (`/app/accountant/credit`).
  - Account section: Profile.
- ACCOUNTANT mobile tabs: Dashboard, Reconcile, Analytics, Profile.
- Overflow tab: Credit Accounts.

---

### System Admin — Leadership Accounts (related improvement)

**`frontend/app/app/admin/page.tsx`**
- ACCOUNTANT users now loaded alongside DIRECTOR and MANAGER (three parallel `listStaff` calls).
- Stat strip expanded to 4 cards: Active Branches, Directors, Accountants, Managers.
- Role badges: amber for Director, purple for Accountant, neutral grey for Manager.
- "Branch" column shows "System-wide" for roles with no branch assignment (Director, Accountant).
- Per-row **Edit** button (pencil icon): opens modal to edit name, email, phone.
  - Role and branch cannot be changed post-creation (note shown in modal).
- Per-row **Reset Password** button (key icon): opens modal with show/hide toggles + confirm field.
  - Validates passwords match and are ≥ 8 characters before submitting.
- Create Account modal: show/hide toggle on temporary password field + helper text.

---

## Decisions Made

**ACCOUNTANT has no `organizationId` in their JWT.**
This is intentional — ACCOUNTANT is a cross-branch role, same as DIRECTOR. Any endpoint that
is branch-scoped must accept `?branchId=` (or `?organizationId=`) as a query param when called
by ACCOUNTANT. The pattern is handled in `resolveBranchScopedOrganizationId` and in
`resolveOrganizationId` in `customer-credit-service.ts`.

**`branchScope` middleware does NOT read query params.**
The `branchScope` middleware only sets `organizationId` from the JWT. It must not be placed on
ACCOUNTANT-accessible routes that require branch selection. Pass `branchId` through
controller → service instead.

**Do not reuse Director screens for the Accountant.**
Director screens are operational (managing staff, orders, branches). Accountant screens are
financial (reconciling cash, auditing payments, reviewing allocations). The workflows and
data-density requirements are different enough to warrant separate purpose-built pages.

**Reconciliation workflow: summary-level first, drill-down on discrepancy.**
Industry best practice for reconciliation at this scale. The accountant matches M-Pesa statement
totals vs system totals. Order-by-order verification is available via the drill-down tab but is
not the default view — too many orders for daily use.

**`RevenueBreakdownCard` reused for Revenue Allocation.**
The component already calculates VAT 16%, Tourism Levy 2%, Operational 50%, Savings 20%,
Misc 12% from a revenue figure. No new backend work was required for this section.

**Corporate account `list()` returns `CorporateAccount[]` for ACCOUNTANT (same as Director).**
The Director path already returns the full object. ACCOUNTANT receives the same shape.
The frontend casts appropriately.

---

## Known Gotchas

- `requireOrganizationId` was renamed to `resolveOrganizationId` in `customer-credit-service.ts`.
  If `createAccount` or `updateAccount` ever break with "requireOrganizationId is not a function",
  check that both methods use the new name.

- `ChartDatum` (in `PremiumChart.tsx`) requires a `label` field. Passing `{ date, value }` without
  `label` causes a TypeScript error that `tsc --noEmit` alone may not surface — only the full
  `pnpm build` catches it via ESLint. Always use `{ label: formatDay(p.date), date: p.date, value }`.

- `MultiLineSeries` uses `{ id, label, data: ChartDatum[] }` — NOT `{ id, name, points }`.
  The `name` and `points` keys are silently ignored, producing an empty chart with no error.

---

## Notes for Future Agents

- The ACCOUNTANT role is fully implemented. Do not add it to staff-facing flows (kitchen,
  barista display, order creation) — it is finance-only.
- If adding a new branch-scoped report endpoint accessible to ACCOUNTANT, follow the pattern in
  `resolveBranchScopedOrganizationId` and accept `?branchId=` as a required query param for
  cross-branch roles.
- If adding new credit account capabilities for ACCOUNTANT, extend the `requireDirectorOrAdmin`
  guard pattern in the relevant service — do not duplicate the role check inline.
- The `resolveOrganizationId` function in `customer-credit-service.ts` is the canonical pattern
  for services that must work for both org-scoped roles (MANAGER) and cross-branch roles
  (DIRECTOR, ACCOUNTANT). Replicate this pattern for any new service that needs it.
