# Phase 8 — Other Income — Implementation Plan

## Goal

Allow Waiters to record revenue from non-food income streams (pool table, events, merchandise,
etc.) at the point of collection. Directors configure which income categories exist. Managers
and Directors can view and audit entries. The Accountant sees all entries aggregated alongside
F&B revenue so that total revenue figures are complete and accurate.

---

## What This Is NOT

- Not an order. No prep tickets, no kitchen workflow, no menu items.
- Not a modification to the existing `Order` model or payment flow.
- A separate, lightweight ledger that sits beside orders in reporting.

---

## Data Model

### New enum: `OtherIncomePaymentMethod`

```prisma
enum OtherIncomePaymentMethod {
  CASH
  MPESA
  CARD
}
```

Rationale: Other income cannot be charged to credit accounts (house/corporate/customer credit)
because those are food-order constructs with credit-limit enforcement. Cash, M-Pesa, and card
are the only sensible payment methods for incidental revenue.

### New model: `OtherIncomeCategory`

```prisma
model OtherIncomeCategory {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  name           String                            // e.g. "Pool Table", "Event Hire"
  isActive       Boolean  @default(true)  @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt      @map("updated_at")

  organization   Organization       @relation(fields: [organizationId], references: [id])
  entries        OtherIncomeEntry[]

  @@index([organizationId])
  @@map("other_income_categories")
}
```

### New model: `OtherIncomeEntry`

```prisma
model OtherIncomeEntry {
  id             String                    @id @default(uuid())
  organizationId String                    @map("organization_id")
  categoryId     String                    @map("category_id")
  amount         Decimal                   @db.Decimal(10, 2)
  paymentMethod  OtherIncomePaymentMethod  @map("payment_method")
  description    String?
  entryDate      DateTime                  @db.Date @map("entry_date")
  recordedById   String                    @map("recorded_by_id")
  createdAt      DateTime                  @default(now()) @map("created_at")
  updatedAt      DateTime                  @updatedAt      @map("updated_at")

  organization   Organization         @relation(fields: [organizationId], references: [id])
  category       OtherIncomeCategory  @relation(fields: [categoryId], references: [id])
  recordedBy     User                 @relation("OtherIncomeRecordedBy", fields: [recordedById], references: [id])

  @@index([organizationId])
  @@index([organizationId, entryDate])
  @@index([categoryId])
  @@map("other_income_entries")
}
```

### Back-relations to add

On `Organization`:
```prisma
otherIncomeCategories OtherIncomeCategory[]
otherIncomeEntries    OtherIncomeEntry[]
```

On `User`:
```prisma
otherIncomeEntries OtherIncomeEntry[] @relation("OtherIncomeRecordedBy")
```

---

## RBAC Matrix

| Action | SYSTEM_ADMIN | DIRECTOR | MANAGER | ACCOUNTANT | WAITER |
|---|---|---|---|---|---|
| Create category | ✓ | ✓ | — | — | — |
| Edit / deactivate category | ✓ | ✓ | — | — | — |
| List categories (active only) | ✓ | ✓ | ✓ | ✓ | ✓ |
| List categories (all incl. inactive) | ✓ | ✓ | — | — | — |
| Record entry | ✓ | ✓ | ✓ | — | ✓ |
| List entries (own branch, today) | ✓ | ✓ | ✓ | — | ✓ |
| List entries (all branches, any date range) | ✓ | ✓ | — | ✓ | — |
| Delete entry (own, same day) | — | ✓ | ✓ | — | ✓ |

---

## Backend Slices

### Slice 1 — Schema & Migration

1. Edit `backend/prisma/schema.prisma`:
   - Add `OtherIncomePaymentMethod` enum
   - Add `OtherIncomeCategory` model
   - Add `OtherIncomeEntry` model
   - Add back-relations on `Organization` and `User`
2. Run migration locally:
   ```powershell
   Set-Location "d:\AI applications\web\V3-RMS\backend"
   npx prisma migrate dev --name add_other_income
   ```
3. Commit migration file.

### Slice 2 — Categories CRUD

**File: `backend/src/repositories/other-income-repository.ts`**

```typescript
findAllCategories(organizationId: string): Promise<OtherIncomeCategory[]>
  // Returns all (active + inactive) — for management views
findActiveCategories(organizationId: string): Promise<Pick<OtherIncomeCategory, 'id' | 'name'>[]>
  // Returns only active — for the Waiter entry form dropdown
createCategory(organizationId: string, name: string): Promise<OtherIncomeCategory>
updateCategory(id: string, organizationId: string, data: { name?: string; isActive?: boolean }): Promise<OtherIncomeCategory>
```

**File: `backend/src/services/other-income-service.ts`**

```typescript
listCategories(actor: AuthUser): Promise<OtherIncomeCategory[]>
  // DIRECTOR/SYSTEM_ADMIN → all; MANAGER/ACCOUNTANT/WAITER → active only
createCategory(actor: AuthUser, name: string): Promise<OtherIncomeCategory>
  // DIRECTOR/SYSTEM_ADMIN only
updateCategory(actor: AuthUser, id: string, data: UpdateCategoryDto): Promise<OtherIncomeCategory>
  // DIRECTOR/SYSTEM_ADMIN only; guard: category.organizationId === actor.organizationId
```

**File: `backend/src/validators/other-income-schemas.ts`**

```typescript
CreateCategorySchema   = z.object({ name: z.string().min(1).max(50) })
UpdateCategorySchema   = z.object({ name: z.string().min(1).max(50).optional(), isActive: z.boolean().optional() })
CategoryIdParamSchema  = z.object({ id: z.string().uuid() })
```

**File: `backend/src/controllers/other-income-controller.ts`**

```typescript
listCategories   // GET /other-income/categories
createCategory   // POST /other-income/categories
updateCategory   // PATCH /other-income/categories/:id
```

**File: `backend/src/routes/other-income-routes.ts`**

```typescript
GET    /other-income/categories        — authenticate, requireRole(all roles)
POST   /other-income/categories        — authenticate, requireRole(DIRECTOR, SYSTEM_ADMIN)
PATCH  /other-income/categories/:id   — authenticate, requireRole(DIRECTOR, SYSTEM_ADMIN)
```

### Slice 3 — Income Entries CRUD

**Repository additions (same file):**

```typescript
createEntry(data: CreateEntryData): Promise<OtherIncomeEntry>
  // data includes: organizationId, categoryId, amount, paymentMethod, description?, entryDate, recordedById

findEntries(organizationId: string, filters: EntryFilters): Promise<{ entries: OtherIncomeEntry[]; total: number }>
  // filters: startDate, endDate, categoryId?, recordedById?, page, perPage
  // Always scoped to organizationId

findEntryById(id: string, organizationId: string): Promise<OtherIncomeEntry | null>

deleteEntry(id: string): Promise<void>
  // Called only after service validates ownership + same-day rule
```

**Service additions:**

```typescript
createEntry(actor: AuthUser, dto: CreateEntryDto): Promise<OtherIncomeEntry>
  // All roles except ACCOUNTANT, CHEF, BARISTA, KITCHEN_DISPLAY, BARISTA_DISPLAY
  // Validates: category is active and belongs to actor.organizationId
  // Sets recordedById = actor.id, organizationId = actor.organizationId

listEntries(actor: AuthUser, filters: ListEntriesDto): Promise<PaginatedResult<OtherIncomeEntry>>
  // WAITER: scoped to actor.id (own entries only), today only
  // MANAGER: scoped to actor.organizationId (branch), any date range
  // DIRECTOR/SYSTEM_ADMIN/ACCOUNTANT: full org view, any date range

deleteEntry(actor: AuthUser, id: string): Promise<void>
  // WAITER: can only delete own entries created today
  // MANAGER: can delete any entry in their org created today
  // DIRECTOR/SYSTEM_ADMIN: can delete any entry in their org
  // ACCOUNTANT: cannot delete
```

**Validators:**

```typescript
CreateEntrySchema = z.object({
  categoryId:    z.string().uuid(),
  amount:        z.string().regex(/^\d+(\.\d{1,2})?$/).refine(v => parseFloat(v) > 0),
  paymentMethod: z.enum(['CASH', 'MPESA', 'CARD']),
  description:   z.string().max(200).optional(),
  entryDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // YYYY-MM-DD
})

ListEntriesSchema = z.object({
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoryId:  z.string().uuid().optional(),
  page:        z.coerce.number().int().min(1).default(1),
  perPage:     z.coerce.number().int().min(1).max(100).default(20),
})

EntryIdParamSchema = z.object({ id: z.string().uuid() })
```

**Routes:**

```typescript
GET    /other-income/entries       — authenticate, requireRole(WAITER, MANAGER, DIRECTOR, SYSTEM_ADMIN, ACCOUNTANT)
POST   /other-income/entries       — authenticate, requireRole(WAITER, MANAGER, DIRECTOR, SYSTEM_ADMIN)
DELETE /other-income/entries/:id   — authenticate, requireRole(WAITER, MANAGER, DIRECTOR, SYSTEM_ADMIN)
```

Note: Register `/entries` routes BEFORE `/:id` (same pattern as Cloudinary upload route).

### Slice 4 — Report Integration

**Changes to `backend/src/types/report.types.ts`:**

```typescript
// Add to DailySummaryReport:
otherIncomeTotal: string;
otherIncomeByCategory: Array<{ categoryId: string; name: string; total: string }>;
```

**Changes to `backend/src/repositories/report-repository.ts`:**

In `getDailySummaryByDate`:
- Add a `groupBy` query on `OtherIncomeEntry` for the given `organizationId` and `date`
- Sum amounts per category
- Append `otherIncomeTotal` and `otherIncomeByCategory` to the returned object

In `getDailySummaryInRange` (loops getDailySummaryByDate — no change needed if the above is correct).

In the Director cross-branch overview:
- Add `otherIncomeTotal` to `BranchOverview` interface
- Include other income in the branch-level and aggregate `totalRevenue` figure

**Important:** `totalRevenue` in `DailySummaryReport` currently only sums order totals. After
Phase 8 it must include `otherIncomeTotal`:
```
totalRevenue = sum(closed orders) + otherIncomeTotal
```
This is a **breaking change** to the report shape — update both backend and frontend types
together in this slice.

**Register routes in `backend/src/routes/index.ts`:**

```typescript
import { otherIncomeRoutes } from './other-income-routes';
// ...
router.use('/other-income', otherIncomeRoutes);
```

---

## Frontend Slices

### Slice 5 — Types & Service

**File: `frontend/types/otherIncome.ts`**

```typescript
export type OtherIncomePaymentMethod = 'CASH' | 'MPESA' | 'CARD';

export interface OtherIncomeCategory {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface OtherIncomeCategoryDropdownItem {
  id: string;
  name: string;
}

export interface OtherIncomeEntry {
  id: string;
  categoryId: string;
  category: OtherIncomeCategoryDropdownItem;
  amount: string;
  paymentMethod: OtherIncomePaymentMethod;
  description: string | null;
  entryDate: string;
  recordedById: string;
  recordedBy: { id: string; name: string };
  createdAt: string;
}

export interface CreateOtherIncomeEntryDto {
  categoryId: string;
  amount: string;
  paymentMethod: OtherIncomePaymentMethod;
  description?: string;
  entryDate: string;
}

export interface CreateOtherIncomeCategoryDto {
  name: string;
}

export interface UpdateOtherIncomeCategoryDto {
  name?: string;
  isActive?: boolean;
}
```

**File: `frontend/services/otherIncomeService.ts`**

```typescript
export const otherIncomeService = {
  listCategories(accessToken: string): Promise<OtherIncomeCategory[]>
  createCategory(dto: CreateOtherIncomeCategoryDto, accessToken: string): Promise<OtherIncomeCategory>
  updateCategory(id: string, dto: UpdateOtherIncomeCategoryDto, accessToken: string): Promise<OtherIncomeCategory>
  listEntries(params: ListEntriesParams, accessToken: string): Promise<{ entries: OtherIncomeEntry[]; pagination: PaginationMeta }>
  createEntry(dto: CreateOtherIncomeEntryDto, accessToken: string): Promise<OtherIncomeEntry>
  deleteEntry(id: string, accessToken: string): Promise<void>
}
```

### Slice 6 — Waiter: Record Other Income

**File: `frontend/app/app/other-income/new/page.tsx`**

Single-purpose form page accessible to WAITER (also MANAGER/DIRECTOR).

Fields:
- **Category** — Select dropdown (active categories only)
- **Amount** — numeric input (KES)
- **Payment Method** — Select: Cash / M-Pesa / Card
- **Description** — optional text input (max 200 chars)
- **Date** — defaults to today; WAITER cannot change it; MANAGER/DIRECTOR can

On submit: `POST /other-income/entries` → success toast → navigate back to dashboard.

**File: `frontend/app/app/other-income/history/page.tsx`**

WAITER's own entry history — shows their entries for the current day (last 20).
Simple list with: category name, amount, payment method, time recorded, delete button (same-day only).
MANAGER sees all branch entries for today; add a date range filter for MANAGER.

### Slice 7 — Director: Manage Categories

**File: `frontend/app/app/director/other-income-categories/page.tsx`**

Table of all categories (name, status, entry count). Actions:
- **Add Category** — modal with name field
- **Edit name** — inline edit via modal
- **Deactivate / Reactivate** — toggle isActive

This is a config page, not a data-entry page.

### Slice 8 — Accountant & Director: Analytics Integration

**Changes to `frontend/types/report.ts`:**

Add `otherIncomeTotal` and `otherIncomeByCategory` to `DailySummaryReport`.

**Changes to `frontend/app/app/accountant/analytics/page.tsx`:**

In the Revenue Overview tab, add an **Other Income** row/section to the revenue breakdown card
showing:
- Total other income for the period
- Breakdown by category (bar or simple table)

**Changes to `frontend/app/app/director/analytics/page.tsx`** (if it exists, or the director
analytics tab inside accountant):

Show other income total per branch alongside F&B revenue.

### Slice 9 — Waiter Dashboard Integration

**Changes to `frontend/app/app/dashboard/page.tsx`:**

Add an **"Other Income"** quick-action button to the waiter dashboard that navigates to
`/app/other-income/new`. Place it alongside the "New Order" button.

Optionally: show today's other income total as a third stat card next to "Orders Today" and
"Total Value Today".

### Slice 10 — Navigation

**Changes to `frontend/app/app/layout.tsx`:**

WAITER mobile nav — add "Other Income" link (icon: `Banknote` or `PlusCircle`) pointing to
`/app/other-income/new` and `/app/other-income/history`.

MANAGER sidebar — add "Other Income" section with "Record Entry" and "Today's Entries".

DIRECTOR sidebar — add "Other Income" section with "Categories" (config) and "Entries".

ACCOUNTANT sidebar — no entry point needed (sees it in analytics).

---

## File Checklist

### Backend
- [ ] `backend/prisma/schema.prisma` — new enum + 2 new models + back-relations
- [ ] `backend/prisma/migrations/YYYYMMDDHHMMSS_add_other_income/` — generated migration
- [ ] `backend/src/repositories/other-income-repository.ts` — new file
- [ ] `backend/src/services/other-income-service.ts` — new file
- [ ] `backend/src/validators/other-income-schemas.ts` — new file
- [ ] `backend/src/controllers/other-income-controller.ts` — new file
- [ ] `backend/src/routes/other-income-routes.ts` — new file
- [ ] `backend/src/routes/index.ts` — register otherIncomeRoutes
- [ ] `backend/src/types/report.types.ts` — extend DailySummaryReport, BranchOverview
- [ ] `backend/src/repositories/report-repository.ts` — include other income in getDailySummaryByDate + cross-branch totals
- [ ] `backend/tests/setup.ts` — no new env vars needed

### Frontend
- [ ] `frontend/types/otherIncome.ts` — new file
- [ ] `frontend/types/report.ts` — extend DailySummaryReport
- [ ] `frontend/services/otherIncomeService.ts` — new file
- [ ] `frontend/app/app/other-income/new/page.tsx` — new file
- [ ] `frontend/app/app/other-income/history/page.tsx` — new file
- [ ] `frontend/app/app/director/other-income-categories/page.tsx` — new file
- [ ] `frontend/app/app/accountant/analytics/page.tsx` — add Other Income section
- [ ] `frontend/app/app/dashboard/page.tsx` — add quick-action button + stat card
- [ ] `frontend/app/app/layout.tsx` — add nav entries for WAITER, MANAGER, DIRECTOR

---

## Key Decisions

1. **Separate model, not a fake Order.** Other income has no kitchen workflow. Forcing it into
   the Order model would pollute order counts, prep tickets, and the order lifecycle. A dedicated
   model keeps concerns clean.

2. **OtherIncomePaymentMethod is a new enum, not the existing PaymentMethod.**
   The existing enum includes `HOUSE_ACCOUNT`, `CORPORATE_ACCOUNT`, `CUSTOMER_CREDIT` which
   are meaningless for incidental revenue. A separate enum enforces the constraint at the DB level.

3. **Waiters record entries, not managers.** Waiters are the ones collecting pool table fees and
   event payments at the point of collection — same as they collect order payments.

4. **Waiter can only view/delete own entries from today.** Prevents tampering with historical
   records. Managers can see all branch entries and delete any same-day entry. Directors have
   full access.

5. **totalRevenue in DailySummaryReport must include other income.** Otherwise the Accountant
   analytics page shows a total that does not match actual cash collected.

6. **entryDate is explicit (not derived from createdAt).** Handles edge cases where an entry
   is recorded just after midnight for the previous day's collections.

7. **No `branchId` on OtherIncomeEntry.** The system is currently single-branch-per-org at the
   data layer (organizationId is the branch scope). This is consistent with the rest of the schema.
   If multi-branch-per-org is introduced later, a `branchId` column can be added in a future
   migration.

---

## Notes for the Implementing Agent

- Backend uses **relative imports** (`../config/env`), NOT `@/` path aliases.
- `amount` is stored as `Decimal` — always call `.toFixed(2)` when serialising to JSON.
- The `entryDate` field uses `@db.Date` (date only, no time component) — same as `Order.orderDate`.
- Register `/other-income/entries` BEFORE `/other-income/entries/:id` in the route file.
- The `getDailySummaryByDate` function in `report-repository.ts` is long (~200 lines). Read it
  fully before editing — the other income query result must be shaped to match the new fields
  added to `DailySummaryReport`.
- When updating `totalRevenue` to include other income, use `Prisma.Decimal` arithmetic
  (`.add()`), not JavaScript number addition, to avoid floating-point errors.
- Phase 7 context note: `revenueByPaymentMethod` already has 7 keys. The other income total
  is a separate top-level field on `DailySummaryReport`, not a new payment method key.
- Tests: at minimum, write service-layer unit tests for the RBAC rules (waiter cannot manage
  categories, WAITER list is scoped to self, delete guard checks same-day rule).
