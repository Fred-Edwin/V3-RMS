# Phase 8 — Other Income — Context (Living File)

This file is updated as tasks are completed. It is the agent's source of truth about what has been done and what decisions were made during this phase.

---

## Status
- [x] Phase 8 In Progress
- [x] Phase 8 Complete

---

## Completed Tasks

### Slice 1 — Schema & Migrations

- [x] Added `OtherIncomePaymentMethod` enum to `backend/prisma/schema.prisma`: `CASH`, `MPESA`, `CARD`, `SPLIT`
  - Note: `SPLIT` was added during the refinement session (not in the original plan) to support split payment recording matching the order payment flow
- [x] Added `OtherIncomeCategory` model (branch-scoped via `organizationId`)
- [x] Added `OtherIncomeEntry` model with all fields plus split payment columns: `mpesaCode`, `mpesaAmount`, `cashAmount`, `cardAmount`, `splitType`
- [x] Added back-relations on `Organization` (`otherIncomeCategories`, `otherIncomeEntries`) and `User` (`otherIncomeEntries`)
- [x] Migration 1: `backend/prisma/migrations/20260405150000_add_other_income/` — initial tables + enum
- [x] Migration 2: `backend/prisma/migrations/20260405160000_other_income_split_payment/` — adds `SPLIT` enum value + 5 nullable split payment columns to `other_income_entries`

### Slice 2 — Categories & Entries CRUD

- [x] `backend/src/repositories/other-income-repository.ts` — `findAllCategories`, `findActiveCategories`, `createCategory`, `updateCategory`, `createEntry`, `findEntries`, `findEntryById`, `deleteEntry`, `sumByCategory`
- [x] `backend/src/services/other-income-service.ts` — `listCategories`, `createCategory`, `updateCategory`, `createEntry`, `listEntries`, `deleteEntry`
- [x] `backend/src/validators/other-income-schemas.ts` — `CreateCategorySchema`, `UpdateCategorySchema`, `CategoryIdParamSchema`, `CreateEntrySchema` (with `SPLIT` paymentMethod + optional split fields + `splitType` enum), `ListEntriesSchema` (`perPage` max 100), `EntryIdParamSchema`
- [x] `backend/src/controllers/other-income-controller.ts` — `listCategories`, `createCategory`, `updateCategory`, `listEntries`, `createEntry`, `deleteEntry`
- [x] `backend/src/routes/other-income-routes.ts` — all 6 routes; `/categories` and `/entries` registered before `/:id` routes
- [x] `backend/src/routes/index.ts` — registered `otherIncomeRoutes` at `/other-income`

### Slice 3 — Report Integration

- [x] `backend/src/types/report.types.ts`:
  - Added `otherIncomeTotal: string` and `otherIncomeByCategory: OtherIncomeCategoryTotal[]` to `DailySummaryReport`
  - Added `otherIncomeTotal: string` to `BranchOverviewRow`
  - Added `totalOtherIncome: string` to `BranchOverviewReport`
- [x] `backend/src/repositories/report-repository.ts`:
  - `getDailySummaryByDate` — sums other income per category for the org + date; adds to `totalRevenue`
  - `getBranchOverview` — calls `otherIncomeRepository.sumByCategory` per branch; adds to `revenueDecimal`; returns `otherIncomeTotal` per row and `totalOtherIncome` on root
  - `getDirectorTrends` — fetches all `otherIncomeEntry` rows in range across all orgs; merges into `dailyRevenue` and `branchRevenue` maps so all trend charts include other income

### Slice 4 — Frontend Types & Service

- [x] `frontend/types/otherIncome.ts` — `OtherIncomePaymentMethod` (includes `'SPLIT'`), `OtherIncomeCategory`, `OtherIncomeCategoryDropdownItem`, `OtherIncomeEntry` (with split fields: `mpesaCode`, `mpesaAmount`, `cashAmount`, `cardAmount`, `splitType`), `CreateEntryInput` (with split fields + `splitType`)
- [x] `frontend/types/report.ts` — added `otherIncomeTotal` and `otherIncomeByCategory` to `DailySummary`; added `otherIncomeTotal: string` to `BranchOverviewRow`; added `totalOtherIncome: string` to `BranchOverview`
- [x] `frontend/services/otherIncomeService.ts` — `listCategories`, `createCategory`, `updateCategory`, `listEntries`, `createEntry`, `deleteEntry`

### Slice 5 — Waiter: Record Other Income

- [x] `frontend/app/app/other-income/new/page.tsx` — full split payment UI matching order payment flow:
  - `UiPaymentMethod` local type: `'CASH' | 'MPESA' | 'CARD' | 'SPLIT_MPESA_CASH' | 'SPLIT_MPESA_CARD' | 'SPLIT_CASH_CARD'`
  - M-Pesa code input shown when M-Pesa is selected (any variant)
  - Split amount inputs shown for split methods
  - `buildPayload()` maps UI state to `CreateEntryInput` (split types map to `paymentMethod: 'SPLIT'` + `splitType`)
  - Post-submit: `recordedEntry` state triggers success view with "Print Receipt" button
  - `handlePrintReceipt`: `window.open('', '_blank')` with formatted thermal receipt HTML; calls `win.print()`; closes window
  - Receipt shows: category, date, recorded by, payment method, M-Pesa code (if applicable), split breakdown (if split), TOTAL
- [x] `frontend/app/app/other-income/history/page.tsx` — entry history for WAITER/MANAGER; date range filters; delete support (same-day guard enforced by backend)

### Slice 6 — Director: Manage Categories & Entries

- [x] `frontend/app/app/director/other-income/page.tsx` — tabbed page (Categories + Entries):
  - **No top-level branch selector** — removed in refinement; each tab has its own independent branch selector
  - Categories tab: branch selector inline in action row next to "New Category" button (`catOrgId` state)
  - Entries tab: branch selector inline in date filter row (`entryOrgId` state)
  - New Category modal: "Visible To" select — `All branches` (null) or a specific branch

### Slice 7 — Navigation

- [x] `frontend/app/app/layout.tsx` — Other Income sections added:
  - `WAITER` mobile nav: "Record Income" + "History"
  - `MANAGER` sidebar: "Record Income" + "History"
  - `DIRECTOR` sidebar: "Categories & Entries" only — **no "Record Income" link**
  - `ACCOUNTANT`: no nav entry (accesses via analytics)
- [x] `frontend/components/ui/DirectorSidebarNav.tsx` — removed "Record Income" nav item and `Banknote` import
- [x] `frontend/middleware.ts` — `/app/other-income` permitted for WAITER/MANAGER/DIRECTOR/SYSTEM_ADMIN

### Slice 8 — Waiter Dashboard Integration

- [x] `frontend/app/app/dashboard/page.tsx`:
  - Loads today's other income entries on mount
  - Displays today's other income total as a stat alongside orders and revenue
  - "Record Income" quick-action button navigating to `/app/other-income/new`

### Slice 9 — Director & Accountant Dashboard + Analytics Integration

- [x] `frontend/components/dashboard/RevenueSourcesCard.tsx` — new component:
  - Two-segment bar: `bg-espresso` (Food & Beverage) + `bg-amber` (Other Income)
  - Shows percentage and KES amount per source
  - Returns `null` when `otherIncomeTotal === 0`
- [x] `frontend/app/app/director/page.tsx`:
  - Revenue Today KPI: food/other sub-lines below `DeltaBadge`, only when other income > 0
  - `BranchStatusRow`: amber micro-label `"+KES X other"` next to branch name when other income > 0
- [x] `frontend/app/app/accountant/page.tsx`:
  - Today's Revenue KPI: sub-line with order count + other income amount when other income > 0
  - MTD Revenue KPI: sub-line "KES X other income included" when other income > 0
  - Collections table: `+ Other` column (amber header + values, `—` for zero)
- [x] `frontend/app/app/accountant/analytics/page.tsx`:
  - Overview tab: `RevenueSourcesCard` above branch summary; `+ Other` column in branch summary table
  - Payment tab: amber `+ Other` summary card (5th card, `lg:grid-cols-5`); `+ Other` column in payment breakdown table
  - Fixed `perPage: 200` → `perPage: 100` (was exceeding `ListEntriesSchema` max of 100)

---

## Decisions Made

- **`SPLIT` added to `OtherIncomePaymentMethod`**: Not in the original plan. Added during refinement to match the order payment flow (M-Pesa + Cash, M-Pesa + Card, Cash + Card). Implemented as a proper DB migration (5 nullable columns on `other_income_entries`) rather than encoding split data in `description`, which would cause data loss.

- **Split payment columns on `OtherIncomeEntry`**: `mpesaCode`, `mpesaAmount`, `cashAmount`, `cardAmount`, `splitType`. All nullable — only populated when `paymentMethod = 'SPLIT'`. Mirrors the split payment columns on the `Order` model.

- **Client-side receipt printing**: The existing print system (`/print-jobs`) requires an `orderId` and is too heavy for other income. Solution: `window.open('', '_blank')` with formatted thermal receipt HTML written directly to the new window. No new backend endpoint needed.

- **Director categories page — per-tab branch selectors**: Original plan had a single top-level branch selector. Replaced with two independent selectors (`catOrgId` / `entryOrgId`) so switching tabs does not reset branch context.

- **Directors do not record income**: Directors manage categories (configuration) and audit entries, but do not collect cash at a branch. "Record Income" removed from Director sidebar and nav. Only WAITER, MANAGER, and SYSTEM_ADMIN can record entries.

- **`getBranchOverview.revenue` now includes other income**: `BranchOverviewRow.revenue` = food orders total + other income total. This feeds all multi-branch revenue surfaces from a single source of truth. `otherIncomeTotal` is exposed separately per row for breakdown rendering.

- **`getDirectorTrends` merges other income into revenue maps**: Aggregate and per-branch revenue trend lines include other income. The Director dashboard sparklines and analytics Revenue by Branch charts now reflect total revenue collected, not food orders only.

- **`sumByCategory` uses inclusive date bounds (`lte`)**: Unlike all other repository functions which use `lt endExclusive`, `sumByCategory` uses `lte endDate`. Callers must pass the original inclusive `endDate`. Do not pass `endExclusive` to this function.

- **`perPage` max is 100**: `ListEntriesSchema` enforces `perPage` max of 100. All callers use `perPage: 100` or lower.

- **`OtherIncomePaymentMethod` is separate from the order `PaymentMethod` enum**: `HOUSE_ACCOUNT`, `CORPORATE_ACCOUNT`, `CUSTOMER_CREDIT` are meaningless for incidental revenue. A separate enum enforces this at the DB level.

---

## Blockers / Issues

- **Silent submission on Waiter form**: After creating a pool table category and testing payment, clicking "Record Income" did nothing. Root cause: stale Docker image — the new `/other-income/entries` route was not in the running container. Express returned a 404 HTML page; `apiClient` threw a non-`ApiError`; the catch block showed a generic toast that was missed. Fix: `docker compose build api && docker compose up -d api` + `prisma migrate deploy`. **Lesson:** always rebuild the Docker image after adding new routes before testing.

- **Accountant analytics "Validation failed"**: `otherIncomeService.listEntries` was called with `perPage: 200`, exceeding the Zod max of 100. Backend returned 400. Fixed by changing call to `perPage: 100`.

- **`DirectorSidebarNav` import error after nav cleanup**: After removing the "Record Income" nav item, the `Banknote` lucide-react import was left behind. Fixed in the same edit pass.

---

## Notes for Next Phase (Phase 9)

- **`BranchOverviewRow.revenue` is total revenue (food + other)**: Do not treat it as food-only. `branch.otherIncomeTotal` is available separately if a breakdown is needed.

- **`BranchOverview.totalOtherIncome`** is a new field on the root object. Always handle it — do not assume it is absent.

- **`DailySummary.totalRevenue` includes other income**: Any daily summary consumer already receives the correct complete figure.

- **`OtherIncomePaymentMethod` has 4 values**: `CASH`, `MPESA`, `CARD`, `SPLIT`. When `paymentMethod = 'SPLIT'`, the `splitType` field holds `'MPESA_CASH' | 'MPESA_CARD' | 'CASH_CARD'`.

- **Receipt printing is client-side only**: No backend record of print events. If audit trails for receipts are needed, add a `printedAt` timestamp column to `OtherIncomeEntry` in a future migration.

- **`sumByCategory` date range is inclusive**: Pass `startDate`/`endDate` (not `endExclusive`) when calling this function. This is the only repository function with inclusive end-date semantics.

- **`otherIncomeService.listEntries` perPage max is 100**: Do not use values above 100 — they will cause a backend 400 validation error.

- **Two DB migrations for Phase 8**: Both must be applied in order. `prisma migrate deploy` on the production server will apply them sequentially. Do not skip the first migration — the second depends on the `other_income_entries` table existing.
