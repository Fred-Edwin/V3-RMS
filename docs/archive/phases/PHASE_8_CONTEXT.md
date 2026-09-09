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

- **`REJECTED` tickets excluded from order READY check** (bug fix, 2026-04-08): When a waiter removes an item from a PENDING order, the system voids the item's prep ticket by setting its status to `REJECTED` with `items: []`. Previously, the `allReady` check in `prep-ticket-service.ts` required every ticket to be `READY` — including these voided `REJECTED` tickets — permanently blocking the order from completing. Fixed by filtering out `REJECTED` tickets before the check: only active (non-rejected) tickets must be `READY` for the order to promote. File changed: `backend/src/services/prep-ticket-service.ts` line 292.

- **House accounts excluded from all revenue surfaces** (post-phase, 2026-04-08): All revenue totals — including `totalRevenue` in daily summary, branch overview, director trends, branch trends, and waiter my-performance — exclude `HOUSE_ACCOUNT` payment orders. The `RevenueSourcesCard`, branch overview totals, director dashboard KPIs, and accountant analytics figures all derive from these repository functions and therefore reflect this exclusion automatically. The `paymentBreakdown.houseAccount` field is preserved for informational display but does not contribute to any total. See Phase 7 context for full rationale.

- **`OtherIncomePaymentMethod` is separate from the order `PaymentMethod` enum**: `HOUSE_ACCOUNT`, `CORPORATE_ACCOUNT`, `CUSTOMER_CREDIT` are meaningless for incidental revenue. A separate enum enforces this at the DB level.

---

## Blockers / Issues

- **Silent submission on Waiter form**: After creating a pool table category and testing payment, clicking "Record Income" did nothing. Root cause: stale Docker image — the new `/other-income/entries` route was not in the running container. Express returned a 404 HTML page; `apiClient` threw a non-`ApiError`; the catch block showed a generic toast that was missed. Fix: `docker compose build api && docker compose up -d api` + `prisma migrate deploy`. **Lesson:** always rebuild the Docker image after adding new routes before testing.

- **Accountant analytics "Validation failed"**: `otherIncomeService.listEntries` was called with `perPage: 200`, exceeding the Zod max of 100. Backend returned 400. Fixed by changing call to `perPage: 100`.

- **`DirectorSidebarNav` import error after nav cleanup**: After removing the "Record Income" nav item, the `Banknote` lucide-react import was left behind. Fixed in the same edit pass.

---

## Post-Phase Addendum — Staff Financial Data Audit (2026-04-06)

Following client feedback, a financial controls audit was conducted on all staff-facing screens
(WAITER, CHEF, BARISTA). The director's concern: staff should only see what they need to do their
job — no aggregate revenue or financial totals.

### Findings

| Screen | Role | Issue | Action |
|---|---|---|---|
| `dashboard/page.tsx` | WAITER | "Food & Drinks Today" stat card showed KES total of day's orders | Removed |
| `dashboard/page.tsx` | WAITER | "Other Income Today" stat card showed KES total of other income | Removed |
| `history/page.tsx` | WAITER | Summary bar showed `PriceDisplay` KES total of filtered orders | Hidden for WAITER role |
| `performance/page.tsx` | WAITER | "Average Order Value" stat card | Removed |
| `performance/page.tsx` | WAITER | "Revenue Generated" stat card | Removed |
| `kitchen/page.tsx`, `barista/page.tsx` | CHEF, BARISTA | No financial data found | No change |
| `other-income/history/page.tsx` | WAITER | Already scoped to today's own entries, no totals across staff | No change |

### Files Changed

- `frontend/app/app/dashboard/page.tsx` — removed `todayTotalValue` + `todayOtherIncome` state,
  removed `otherIncomeService` import, removed two financial stat cards. Waiter stat strip now shows
  "Orders Today" only. "Record Other Income" quick-action link retained (waiter still records income,
  just does not see running totals).
- `frontend/app/app/history/page.tsx` — `PriceDisplay` in summary bar now gated on
  `role !== 'WAITER'`. Order count is still visible.
- `frontend/app/app/performance/page.tsx` — removed "Average Order Value" and "Revenue Generated"
  stat cards from waiter section. Removed unused `DollarSign` import. Waiter performance now shows
  "Orders Handled" and "Busiest Day" only.

### Design Rationale

This implements the **principle of least privilege** for financial data. Waiters need to know their
active orders and handle payments on individual orders — they do not need aggregate collection totals,
which are management-level data. Chefs and baristas are unaffected as no financial data was ever
exposed on their screens.

---

## Post-Phase Addendum — Manager Order Edit & Director Incident Log (2026-04-08)

### Manager Order Item Removal (commits `1312182`)

Managers can remove specific items from any PENDING / IN_PROGRESS / READY order. Removing all items cancels the order instead of leaving an empty one. Every removal is logged to `IncidentLog` as `ORDER_ITEM_REMOVED` with the actor, reason, removed item list, and whether the order was cancelled as a result.

**Backend:**
- `backend/prisma/schema.prisma` — added `ORDER_ITEM_REMOVED` and `PAYMENT_REJECTED` to `IncidentType` enum
- `backend/prisma/migrations/20260408000001_add_order_item_removed_incident_type/` — migration applied
- `backend/src/services/order-service.ts` — `managerRemoveItems()`: validates ownership, voids affected prep tickets (status → REJECTED), recalculates totals atomically, writes incident log entry
- `backend/src/repositories/order-repository.ts` — `removeItems()` repository method
- `backend/src/controllers/order-controller.ts` — `managerRemoveItems` handler
- `backend/src/routes/order-routes.ts` — `POST /orders/:id/remove-items` (MANAGER role)
- `backend/src/validators/order-schemas.ts` — `ManagerRemoveItemsSchema`: `removeItemIds: uuid[]`, `reason: string`

**Frontend:**
- `frontend/components/orders/ManagerOrderEditSheet.tsx` — new bottom sheet: item checklist with select-all, reason textarea, submit with confirmation
- `frontend/components/orders/OrderDetailBottomSheet.tsx` — "Edit Order" button shown to MANAGER role; opens `ManagerOrderEditSheet`
- `frontend/app/app/orders/page.tsx` — wires up edit sheet state
- `frontend/app/app/layout.tsx` — `MANAGER` nav updated
- `frontend/services/orderService.ts` — `removeOrderItems(orderId, payload)`
- `frontend/types/order.ts` — `ManagerRemoveItemsInput` type

**Business rules:**
- CLOSED and CANCELLED orders are immutable.
- Voiding a prep ticket is forced regardless of `IN_PROGRESS` / `READY` status — manager has override authority.
- A READY order with remaining items is reopened to `IN_PROGRESS` after the edit.
- Role check is enforced at the service layer (`actor.role !== 'MANAGER'` throws `ForbiddenError`), not only via middleware.

---

### Director Cross-Branch Incident Log (commit `9936aea`)

Directors can now view incidents across all branches from a dedicated page, with optional per-branch filtering. Managers continue to see only their own branch.

**Backend:**
- `backend/src/repositories/incident-repository.ts` — `getMany()` accepts optional `organizationId` (null = all branches) and `branchId` filter; joins `organization` to include branch name
- `backend/src/services/incident-service.ts` — `getMany()` signature updated to `organizationId: string | null`; `serialize()` now includes `branchName` from the joined organization
- `backend/src/types/incident.types.ts` — `IncidentLogRecord` gains `branchName: string`
- `backend/src/validators/incident-schemas.ts` — `IncidentQuerySchema` gains optional `branchId: uuid`
- `backend/src/controllers/incident-controller.ts` — passes `null` as `organizationId` for DIRECTOR/SYSTEM_ADMIN roles

**Frontend:**
- `frontend/app/app/director/incidents/page.tsx` — new page: branch selector dropdown, date range filters, paginated incident table with `branchName` column
- `frontend/services/incidentService.ts` — `Incident` type gains `branchName: string`; `GetIncidentsParams` gains `branchId?: string`; query string builder includes it
- `frontend/app/app/manage/incidents/page.tsx` — adds `ORDER_ITEM_REMOVED` display label + amber badge color; truncated modification type labels; `branchName: ''` placeholder for socket-pushed incidents (managers are branch-scoped, socket payload has no org name)
- `frontend/components/ui/DirectorSidebarNav.tsx` — "Operations" section added with "Incident Log" → `/app/director/incidents`

---

## Bug Fixes (Post-Phase 8)

### KDS Missing Ticket for Duplicate Item Lines (2026-04-08, commit `7ef34bf`)

**Symptom:** When a waiter added a second instance of an already-ordered item (e.g. Beef Wrap added to an order that already had Beef Wrap), the new ticket never appeared on the KDS.

**Root cause:** `orderService.updateItems` identified prep tickets by a key of `(menuItemId + notes)`. Two identical item lines produced the same key. In the PENDING path, `editableTicketsByKey` was a `Map` — the second `.set()` overwrote the first, so only one entry existed and no new ticket was created. In the IN_PROGRESS path, `allExistingKeys` was a `Set` — same deduplication, same result.

**Fix:** Keys are now occurrence-indexed: `(menuItemId, notes, N)`. The Nth duplicate gets key `N`, making every line unique. The "started items cannot be removed" guard was updated to use count-comparison (multiset) instead of key-set membership.

**Files changed:** `backend/src/services/order-service.ts`

### Frontend Cart Merging Duplicate Lines (2026-04-08, commit `df226e1`)

**Symptom:** Adding a second Americano (or any already-carted item) on the edit order page produced one cart line with `quantity: 2` instead of two separate lines. The backend received one item, matched the existing ticket, updated its quantity — no new ticket, no BDS notification.

**Root cause:** `addToCart` in `orderStore.ts` found an existing entry by `menuItemId` and incremented its quantity instead of appending a new line.

**Fix:** `addToCart` always appends a new line. Each `CartItem` now has a `lineId` (UUID) generated at add time. `removeFromCart` and `updateCartQuantity` key off `lineId` instead of `menuItemId`. The tile badge still sums quantities across all lines for the same item. `setCart` (used when loading an existing order) assigns a fresh `lineId` to each line.

**UX rule:** Tap once + use **+** stepper → one ticket with quantity N. Tap N times → N separate tickets of quantity 1 each.

**Files changed:** `frontend/store/orderStore.ts`, `frontend/components/orders/CheckoutSheet.tsx`, `frontend/components/orders/EditCheckoutSheet.tsx`, `frontend/app/app/orders/[id]/edit/page.tsx`

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

---

## House Account Payment Authorization Layer (cross-phase, added 2026-04-08)

### What Was Built
A full authorization flow for House Account payments where the account holder (e.g. a director) must approve or reject a charge before the order closes.

### DB Changes
New table `house_account_auth_requests` (migration `20260408120000_add_house_account_auth_request`):
- `id`, `orderId`, `houseAccountId`, `requestedById`, `amount`, `status` (`PENDING | APPROVED | REJECTED | TIMED_OUT`), `expiresAt` (24h, not enforced — no timeout job), `resolvedById`, `resolvedAt`, `createdAt`
- New `OrderStatus` value: `AWAITING_AUTHORIZATION`

### Flow
1. Waiter selects House Account payment → `POST /api/v1/orders/:id/payment`
2. If the House Account has `requiresAuthorization: true` → order set to `AWAITING_AUTHORIZATION`, auth request created, waiter sees amber "Awaiting Authorization" banner
3. Account holder + all branch managers notified via FCM push + socket `order:auth_pending` (broadcast to both waiter user room and branch room)
4. Manager/director sees amber widget on their dashboard with Approve/Reject buttons
5. On **Approve**: payment recorded atomically (`recordPayment` closes the order, increments `houseAccount.currentBalance`), order status → `CLOSED`, `order:auth_resolved` broadcast to branch room + waiter user room
6. On **Reject**: order status → `READY`, incident logged (`PAYMENT_REJECTED`), waiter notified via socket + FCM to collect payment another way

### Key Implementation Details
- `recordPayment` WHERE clause accepts `{ in: [READY, AWAITING_AUTHORIZATION] }` — required because auth-path orders are in `AWAITING_AUTHORIZATION`, not `READY`, when approval fires. **Do not revert this to `status: READY` only.**
- `emitAuthResolved` broadcasts to **both** `branchRoom(organizationId)` and `userRoom(waiterId)` — without the branch room broadcast, managers/directors never receive the socket event and their order list stays frozen.
- Director users have `organizationId = null` in the DB (system-level). `listPending` for directors queries by `houseAccount.userId` (their own account) instead of by `organizationId`.
- No BullMQ timeout job — the dashboard widget persists until a human acts. `expiresAt` is set to 24h but is not enforced.
- Manager override (approve/reject from the order bottom sheet) uses `POST /house-auth/:authRequestId/override`.
- `forceExpire` endpoint (`POST /house-auth/:authRequestId/force-expire`) exists as an escape hatch for genuinely expired orders but is rarely needed.

### New Routes
| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| GET | `/house-auth` | MANAGER, DIRECTOR | List pending auth requests |
| POST | `/house-auth/:id/override` | MANAGER, DIRECTOR | Approve or reject |
| POST | `/house-auth/:id/force-expire` | MANAGER, DIRECTOR | Force-expire a stuck order |

### New Files
- `backend/src/services/house-account-auth-service.ts`
- `backend/src/repositories/house-account-auth-request-repository.ts`
- `backend/src/controllers/house-account-auth-controller.ts`
- `backend/src/routes/house-account-auth-routes.ts`
- `backend/src/validators/house-account-auth-schemas.ts`
- `backend/src/types/house-account-auth.types.ts`
- `backend/src/jobs/house-account-auth-timeout.ts` (stub, not active)
- `frontend/services/houseAccountAuthService.ts`
- `frontend/types/houseAccountAuth.ts`
- `frontend/app/app/house-account/authorize/page.tsx`

### Revenue vs Outstanding Balances
House Account payments **are included in revenue** (order is CLOSED, counted in sales reports). Outstanding balances (`houseAccount.currentBalance`) are a separate receivables figure. A House Account charge appears in both: once as revenue earned, once as a debt created. These are complementary — not the same number.
