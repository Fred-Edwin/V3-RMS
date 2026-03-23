# V2.1 Inventory Management — Implementation Plan

## Context

V1 (Phases 0–7) is complete and stable. V2.1 adds end-to-end inventory tracking: supplier deliveries at the Central Kitchen, ingredient-to-menu-item conversion ratios, branch requisitions with a 6 AM cutoff, CK dispatch with automatic raw stock deduction, branch receipt with discrepancy tracking, automatic stock depletion when a PrepTicket is marked READY, low-stock alerts via Socket.io, end-of-day stocktake, and management dashboards for Director and Store Manager.

All changes are **additive**. The only modification to existing V1 code is `prepTicketService.markReady()` — wrapped in a transaction with a graceful no-op guard for missing BranchStock rows.

---

## Critical Pre-Implementation Notes

1. **`STORE_MANAGER` must be in the Prisma schema and client regenerated before any route/service file references it** — TypeScript will not compile otherwise. Migration must run first.
2. **`/inventory/requisitions/branch` must be registered before `/inventory/requisitions/:id`** in the router — same route ordering gotcha as other parameterised routes.
3. **`parsePrepTicketItems` already extracts `menuItemId`** from the JSON snapshot in `prep-ticket-service.ts:108`. The deduction loop must guard for `!menuItemId` before calling the inventory service.
4. **Socket events are emitted AFTER `prisma.$transaction` resolves** — never inside the transaction callback.
5. **Inventory tests use supertest** (already installed, unused) — same pattern as order tests but calling real HTTP layer with mocked services.

---

## Step 1 — Prisma Schema Migration

**File:** `backend/prisma/schema.prisma`

### Enum changes
- Add `STORE_MANAGER` to `UserRole` (between MANAGER and WAITER)
- Add new enum `RequisitionStatus { PENDING, APPROVED, DISPATCHED, RECEIVED, PARTIAL }`
- Add new enum `StocktakeStation { KITCHEN, BARISTA, WAITER }`

### New models (in this order)
```
Supplier           — no organizationId (CK-level)
RawIngredient      — no organizationId, currentStockCk Decimal(10,3), reorderThreshold Decimal(10,3)
IngredientConversion — menuItemId + ingredientId + quantityPerPortion Decimal(10,4), @@unique([menuItemId, ingredientId])
SupplierDelivery   — ingredientId, supplierId, quantity, loggedById, no updatedAt (append-only)
Requisition        — organizationId, submittedById, status RequisitionStatus, submittedAt, dispatchedAt?, receivedAt?
RequisitionItem    — requisitionId, menuItemId, requestedQty Int, dispatchedQty Int?, receivedQty Int?, hasDiscrepancy Boolean @default(false)
BranchStock        — organizationId, menuItemId, currentQty Int @default(0), lowStockThreshold Int @default(5), @@unique([organizationId, menuItemId])
Consumable         — name unique, unit, station StocktakeStation, isActive Boolean @default(true)
ConsumableStock    — organizationId, consumableId, currentQty Decimal(10,2), @@unique([organizationId, consumableId])
StocktakeSession   — organizationId, conductedById, date @db.Date, completedAt?, @@unique([organizationId, date])
StocktakeEntry     — sessionId, station, menuItemId?, consumableId?, expectedQty, actualQty, variance, note?
```

### Back-relations on existing models
- `MenuItem`: add `conversions IngredientConversion[]`, `requisitionItems RequisitionItem[]`, `branchStock BranchStock[]`, `stocktakeEntries StocktakeEntry[]`
- `Organization`: add `requisitions Requisition[]`, `branchStock BranchStock[]`, `consumableStock ConsumableStock[]`, `stocktakeSessions StocktakeSession[]`
- `User`: add `supplierDeliveries SupplierDelivery[]`, `requisitionsSubmitted Requisition[] @relation("RequisitionSubmittedBy")`, `stocktakeSessions StocktakeSession[]`

### After schema edit
```powershell
Set-Location "d:\AI applications\web\V3-RMS\backend"
npx prisma migrate dev --name add_inventory_v2
```

---

## Step 2 — Validators

**New file:** `backend/src/validators/inventory-schemas.ts`

Schemas (all use Zod, no `any`):
- `CreateSupplierSchema` — name required, phone/email optional
- `UpdateSupplierSchema` — all optional
- `CreateIngredientSchema` — name, unit, reorderThreshold
- `UpdateIngredientSchema` — all optional
- `CreateIngredientConversionSchema` — menuItemId uuid, quantityPerPortion positive number
- `LogDeliverySchema` — ingredientId, supplierId, quantity positive, notes optional
- `CreateRequisitionSchema` — notes optional, isMidDay boolean optional, items array (menuItemId uuid, requestedQty positive int)
- `DispatchRequisitionSchema` — items array (requisitionItemId uuid, dispatchedQty non-negative int)
- `ReceiveRequisitionSchema` — items array (requisitionItemId uuid, receivedQty non-negative int)
- `StocktakeEntrySchema` — station StocktakeStation, menuItemId? uuid, consumableId? uuid, expectedQty, actualQty, note optional; `.refine(d => !!(d.menuItemId) !== !!(d.consumableId), 'Exactly one of menuItemId or consumableId must be set')`
- `SubmitStocktakeSchema` — date string, entries array of StocktakeEntrySchema
- `SubmitCentralStocktakeSchema` — date string, entries array of { ingredientId uuid, actualQty }
- `InventoryReportQuerySchema` — from date, to date, branchId optional

---

## Step 3 — Repository

**New file:** `backend/src/repositories/inventory-repository.ts`

Import: `import { prisma } from '../config/database'`
All tx-capable functions accept optional `tx?: Prisma.TransactionClient` and use `(tx ?? prisma)` for queries.

### Suppliers
- `createSupplier(data)` → Supplier
- `getSuppliers()` → Supplier[]
- `updateSupplier(id, data)` → Supplier

### Raw Ingredients
- `createIngredient(data)` → RawIngredient
- `getIngredients()` → RawIngredient[] with conversions + menuItem
- `updateIngredient(id, data)` → RawIngredient
- `incrementIngredientStock(id, qty, tx?)` → RawIngredient
- `decrementIngredientStock(id, qty, tx?)` → RawIngredient

### Ingredient Conversions
- `createConversion(data)` → IngredientConversion
- `getConversionsForMenuItem(menuItemId)` → IngredientConversion[] with ingredient
- `getConversionsForIngredient(ingredientId)` → IngredientConversion[] with menuItem

### Supplier Deliveries
- `createDelivery(data)` → SupplierDelivery
- `getDeliveries(filters: { ingredientId?, supplierId?, from?, to? })` → SupplierDelivery[]

### Requisitions
- `createRequisition(data)` — header + items in one `prisma.$transaction`
- `getRequisitionById(id)` — include items with menuItem
- `getRequisitionsForCK(filters: { status?, date? })` — all branches, include organization name
- `getRequisitionsForBranch(organizationId, filters?)` — branch-scoped
- `dispatchRequisition(id, items: { requisitionItemId, dispatchedQty }[], tx?)` — sets DISPATCHED + timestamps
- `receiveRequisition(id, items: { requisitionItemId, receivedQty }[], tx?)` — sets RECEIVED/PARTIAL + timestamps

### Branch Stock
- `getBranchStock(organizationId)` — include menuItem
- `getBranchStockItem(organizationId, menuItemId)` — single row or null
- `incrementBranchStock(organizationId, menuItemId, qty, tx?)` → BranchStock
- `decrementBranchStock(organizationId, menuItemId, qty, tx?)` → BranchStock
- `upsertBranchStock(organizationId, menuItemId, qty)` → BranchStock

### Stocktake
- `createStocktakeSession(data)` — session + entries in transaction, compute variance per entry
- `getStocktakeSessions(organizationId, filters?)` — include entries
- `getCentralStocktakeSessions(filters?)`

---

## Step 4 — Service

**New file:** `backend/src/services/inventory-service.ts`

No Prisma calls — repository only. Import `prisma` only for `prisma.$transaction` coordinator.

### Key functions

**`logDelivery(data, loggedById)`**
- `prisma.$transaction`: createDelivery + incrementIngredientStock

**`createRequisition(organizationId, submittedById, data)`**
- If `!data.isMidDay && new Date().getHours() >= 6` → throw `AppError('Morning requisitions must be submitted before 6:00 AM', 400, 'REQUISITION_CUTOFF')`
- Call `inventoryRepository.createRequisition(...)`

**`getRequisitionWithCapacity(id)`**
- Fetch requisition with items + conversions + ingredients
- For each item: `canFulfilQty = Math.min(...conversions.map(c => Math.floor(ingredient.currentStockCk / c.quantityPerPortion)))`
- If no conversions: `canFulfilQty = 0`
- Return augmented requisition

**`dispatchRequisition(id, items, dispatchedById)`**
- Inside `prisma.$transaction`:
  1. For each dispatched item, fetch conversions for menuItemId
  2. `decrementIngredientStock(ingredientId, dispatchedQty * quantityPerPortion, tx)` per conversion
  3. `dispatchRequisition(id, items, tx)`
- After tx: FCM push to MANAGER users in that organization

**`receiveRequisition(id, items, receivedById)`**
- Inside `prisma.$transaction`:
  1. `receiveRequisition(id, items, tx)`
  2. For each item: `incrementBranchStock(organizationId, menuItemId, receivedQty, tx)`
  3. If `receivedQty < dispatchedQty`: set `hasDiscrepancy = true`
  4. If BranchMenuItem.isAvailable = false AND newQty > 0 → set isAvailable = true
- After tx: if discrepancies → FCM push to Store Manager

**`deductStockForPrepTicket(organizationId, menuItemId, qty, tx)`** ← called from prepTicketService
- `tx` is **required** (passed in from outer transaction)
- `const stock = await inventoryRepository.getBranchStockItem(organizationId, menuItemId)` using tx
- If !stock: `console.warn(...)` and return `{ newQty: 0, isLowStock: false, isOutOfStock: false }` (V1 safety)
- Decrement via tx
- `isOutOfStock = newQty <= 0` → if so, set BranchMenuItem.isAvailable = false via tx
- `isLowStock = newQty > 0 && newQty <= stock.lowStockThreshold`
- Return `{ newQty, isLowStock, isOutOfStock }`

**`submitStocktake(organizationId, conductedById, data)`**
- Compute variance per entry server-side
- `createStocktakeSession` in one transaction

**`getInventoryOverview()`**
- Aggregate: all branch requisition statuses today, discrepancy counts, shrinkage from latest stocktake
- CK raw stock levels, items below reorderThreshold

---

## Step 5 — Modify `prepTicketService.markReady()`

**File:** `backend/src/services/prep-ticket-service.ts` — line 260

**Change**: wrap the repository call in `prisma.$transaction`, deduct stock per order item, emit socket events after commit.

```typescript
// Import at top of file (add):
import { prisma } from '../config/database'
import { inventoryService } from './inventory-service'

// In markReady(), replace the prepTicketRepository.markReady() call with:
const result = await prisma.$transaction(async (tx) => {
  const readyTicket = await prepTicketRepository.markReady(ticketId, organizationId, tx)
  if (!readyTicket) return null

  const stockResults: Array<{ menuItemId: string; newQty: number; isLowStock: boolean; isOutOfStock: boolean }> = []
  const items = parsePrepTicketItems(readyTicket.items)
  for (const item of items) {
    if (!item.menuItemId) continue  // guard for untracked items
    const stockResult = await inventoryService.deductStockForPrepTicket(
      organizationId, item.menuItemId, item.quantity, tx
    )
    stockResults.push({ menuItemId: item.menuItemId, ...stockResult })
  }
  return { readyTicket, stockResults }
})

// After transaction: emit stock events
for (const r of result?.stockResults ?? []) {
  const room = `org:${organizationId}`
  if (r.isOutOfStock) {
    io.to(room).emit('inventory:out_of_stock', { organizationId, menuItemId: r.menuItemId })
  } else if (r.isLowStock) {
    io.to(room).emit('inventory:low_stock', { organizationId, menuItemId: r.menuItemId, currentQty: r.newQty })
  }
}
```

**Note**: `prepTicketRepository.markReady` needs a `tx?` parameter added so it can participate in the transaction. Add optional `tx?: Prisma.TransactionClient` to its signature.

---

## Step 6 — Controller

**New file:** `backend/src/controllers/inventory-controller.ts`

Thin handlers — validate → call service → return envelope. No logic.

Handlers (one per endpoint):
`getSuppliers`, `createSupplier`, `updateSupplier`,
`getIngredients`, `createIngredient`, `updateIngredient`,
`getIngredientConversions`, `createIngredientConversion`,
`getDeliveries`, `logDelivery`,
`getRequisitions` (CK), `getRequisitionsForBranch`, `getRequisitionById`,
`createRequisition`, `dispatchRequisition`, `receiveRequisition`,
`getBranchStock`,
`submitStocktake`, `getStocktakes`,
`submitCentralStocktake`, `getCentralStocktakes`,
`getInventoryOverview`, `getShrinkageReport`, `getDiscrepancyReport`

---

## Step 7 — Routes

**New file:** `backend/src/routes/inventory-routes.ts`

Route ordering (critical):
```typescript
router.get('/requisitions/branch', authenticate, requireRole('MANAGER'), controller.getRequisitionsForBranch)
router.get('/requisitions/:id', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR', 'MANAGER'), controller.getRequisitionById)
```

Full role assignments:
| Endpoint group | Roles |
|---|---|
| Suppliers CRUD | STORE_MANAGER, DIRECTOR |
| Ingredients GET | STORE_MANAGER, DIRECTOR |
| Ingredients POST/PATCH | DIRECTOR |
| Conversions GET | STORE_MANAGER, DIRECTOR |
| Conversions POST | DIRECTOR |
| Deliveries | STORE_MANAGER, DIRECTOR |
| Requisitions CK inbox | STORE_MANAGER, DIRECTOR |
| Requisitions dispatch | STORE_MANAGER, DIRECTOR |
| Requisitions branch GET/POST | MANAGER |
| Requisitions receive | MANAGER, WAITER |
| Branch stock | MANAGER, WAITER, CHEF, BARISTA |
| Stocktake branch | MANAGER |
| Stocktake central | STORE_MANAGER, DIRECTOR |
| Overview | DIRECTOR, STORE_MANAGER |
| Reports shrinkage | DIRECTOR |
| Reports discrepancies | DIRECTOR, STORE_MANAGER |

**Register in** `backend/src/routes/index.ts`:
```typescript
import inventoryRoutes from './inventory-routes'
router.use('/inventory', inventoryRoutes)
```

---

## Step 8 — Frontend Types

**New file:** `frontend/types/inventory.ts`

Types (no `any`):
- `Supplier`, `RawIngredient`, `IngredientConversion`, `SupplierDelivery`
- `Requisition`, `RequisitionItem`, `RequisitionWithCapacity` (extends RequisitionItem with `canFulfilQty: number`)
- `BranchStockItem` — `{ menuItemId, menuItemName, currentQty, lowStockThreshold, isAvailable }`
- `Consumable`, `ConsumableStock`
- `StocktakeSession`, `StocktakeEntry`
- `InventoryOverview`
- `RequisitionStatus` and `StocktakeStation` as const enums

---

## Step 9 — Frontend API Service

**New file:** `frontend/services/inventoryService.ts`

All functions use `apiClient` from `frontend/lib/apiClient.ts`. Accept `accessToken: string` as last param.

Functions mirror the endpoint list from Step 6 exactly.

---

## Step 10 — Zustand Store + Socket Handlers

**New file:** `frontend/store/inventoryStore.ts`

```typescript
interface InventoryStore {
  branchStock: BranchStockItem[]
  requisitions: Requisition[]
  activeRequisition: Requisition | null
  fetchBranchStock(token: string): Promise<void>
  fetchRequisitions(token: string): Promise<void>
  updateStockItem(menuItemId: string, newQty: number): void
  setItemUnavailable(menuItemId: string): void
}
```

Select individual actions (V1 hook stability rule): `useInventoryStore(s => s.fetchBranchStock)`.

**Socket handlers** — add to existing socket setup (wherever V1 socket events are wired):
```typescript
socket.on('inventory:low_stock', ({ menuItemId, currentQty }) => {
  inventoryStore.getState().updateStockItem(menuItemId, currentQty)
  // toast: "Chicken Burger is down to N portions"
})
socket.on('inventory:out_of_stock', ({ menuItemId }) => {
  inventoryStore.getState().setItemUnavailable(menuItemId)
  // toast: "Chicken Burger is out of stock — hidden from menu"
})
```

---

## Step 11 — Frontend Pages (15 pages)

Build order: Store Manager → Branch Manager → Director.

### New StoreLayout
**New file:** `frontend/app/app/store/layout.tsx`
Desktop sidebar, 240px, max-width 1280px. Nav sections: Dashboard, Ingredients, Suppliers, Deliveries, Requisitions, Stocktake.

### Store Manager Pages (`/app/store/`)

| Route | Description |
|---|---|
| `/app/store/dashboard` | Two panels: today's branch requisitions (status badges) + CK raw ingredient stock table with reorder indicators |
| `/app/store/ingredients` | Table of ingredients with stock. Inline add form. Link to conversion ratios |
| `/app/store/suppliers` | Table with add/edit modal |
| `/app/store/deliveries/new` | Form: ingredient, quantity, supplier, notes, confirm |
| `/app/store/requisitions` | All branches' requisitions today with status pills |
| `/app/store/requisitions/[id]` | Dispatch form: requestedQty, canFulfilQty, editable dispatchedQty. Dispatch button |
| `/app/store/stocktake` | CK stocktake form: each ingredient with actual count input |

### Branch Manager Pages (`/app/manage/`)

| Route | Description |
|---|---|
| `/app/manage/inventory` | Live stock table with colour-coded level indicators (green/amber/red). Socket.io live updates |
| `/app/manage/requisitions` | List with status badges |
| `/app/manage/requisitions/new` | One row per menu item with qty input. Disabled after 6 AM |
| `/app/manage/requisitions/[id]` | Read-only status + items. If DISPATCHED: show "Confirm Receipt" section with editable received qtys |
| `/app/manage/stocktake` | Tabbed form: Kitchen / Barista / Waiter. Expected qty prefilled. Single Submit |
| `/app/manage/stocktake/history` | List of past sessions with variance summary |

### Director Pages (`/app/admin/`)

| Route | Description |
|---|---|
| `/app/admin/inventory` | Cross-branch overview table + CK stock panel |
| `/app/admin/inventory/reports` | Tabs: Shrinkage / Discrepancies with date range filter |

### Navigation updates
- Add `STORE_MANAGER` role handling to `frontend/app/app/layout.tsx` (sidebar nav, no bottom nav)
- Add "Inventory" + "Requisitions" to manage nav (`/app/manage/`)
- Add "Inventory" to admin nav (`/app/admin/`)

### Design System (enforced on every page)
- `bg-crema` (#F5F0E8) on all page backgrounds — never `bg-white`
- `bg-parchment` (#EDE7DC) on all cards with `shadow-md`
- `bg-espresso text-white` on primary action buttons only
- Status badges: PENDING amber, DISPATCHED orange, RECEIVED green, PARTIAL yellow, discrepancy red
- `font-display` (Cormorant Garamond) for page titles (h1 only); `font-sans` (Jost) for everything else
- h-11 minimum on all interactive elements
- Wendo voice copy (see plan doc / design system examples)
- Use existing `Button`, `Badge`, `Card`, `Table`, `Input`, `Select`, `Modal`, `Tabs` from `frontend/components/ui/`

---

## Step 12 — Tests

### Unit tests
**New file:** `backend/src/services/inventory-service.test.ts`

1. `computeCanFulfilQty` — correct minimum across multiple ingredients, returns 0 with no conversions
2. Requisition cutoff — rejects after 6 AM, allows `isMidDay: true`
3. Variance calculation — positive, negative, zero

### Integration tests
**New file:** `backend/tests/inventory.test.ts` (supertest, mocked services via vi.spyOn)

1. POST /inventory/deliveries — stock increments, blocks MANAGER role
2. POST /inventory/requisitions — creates with items, rejects after 6 AM, allows isMidDay
3. GET /inventory/requisitions/:id — canFulfilQty computed correctly
4. POST /inventory/requisitions/:id/dispatch — stock decremented, status DISPATCHED, blocks MANAGER
5. POST /inventory/requisitions/:id/receive — BranchStock incremented, RECEIVED vs PARTIAL

**Extend:** `backend/src/services/prep-ticket-service.test.ts`

6. BranchStock decremented when ticket marked READY
7. isAvailable becomes false when stock hits zero
8. No throw when BranchStock row doesn't exist

**Extend:** `backend/tests/inventory.test.ts`

9. POST /inventory/stocktake — session created, variance correct, XOR validation (both ids rejects, neither rejects)

---

## Files Modified (Summary)

### Backend — modify
- `backend/prisma/schema.prisma`
- `backend/src/services/prep-ticket-service.ts` (markReady only)
- `backend/src/repositories/prep-ticket-repository.ts` (add tx? param to markReady)
- `backend/src/routes/index.ts` (register inventory routes)
- `backend/src/services/prep-ticket-service.test.ts` (add 3 stock deduction tests)

### Backend — create
- `backend/src/validators/inventory-schemas.ts`
- `backend/src/repositories/inventory-repository.ts`
- `backend/src/services/inventory-service.ts`
- `backend/src/controllers/inventory-controller.ts`
- `backend/src/routes/inventory-routes.ts`
- `backend/src/services/inventory-service.test.ts`
- `backend/tests/inventory.test.ts`

### Frontend — modify
- `frontend/app/app/layout.tsx` (STORE_MANAGER role + nav)
- (socket handler file — wherever V1 socket events are wired)

### Frontend — create
- `frontend/types/inventory.ts`
- `frontend/services/inventoryService.ts`
- `frontend/store/inventoryStore.ts`
- `frontend/app/app/store/layout.tsx`
- `frontend/app/app/store/dashboard/page.tsx`
- `frontend/app/app/store/ingredients/page.tsx`
- `frontend/app/app/store/suppliers/page.tsx`
- `frontend/app/app/store/deliveries/new/page.tsx`
- `frontend/app/app/store/requisitions/page.tsx`
- `frontend/app/app/store/requisitions/[id]/page.tsx`
- `frontend/app/app/store/stocktake/page.tsx`
- `frontend/app/app/manage/inventory/page.tsx`
- `frontend/app/app/manage/requisitions/page.tsx`
- `frontend/app/app/manage/requisitions/new/page.tsx`
- `frontend/app/app/manage/requisitions/[id]/page.tsx`
- `frontend/app/app/manage/stocktake/page.tsx`
- `frontend/app/app/manage/stocktake/history/page.tsx`
- `frontend/app/app/admin/inventory/page.tsx`
- `frontend/app/app/admin/inventory/reports/page.tsx`

---

## Verification

```powershell
# 1. Backend build
Set-Location "d:\AI applications\web\V3-RMS\backend"
pnpm build  # must succeed with zero errors

# 2. Backend tests
pnpm test  # all tests must pass

# 3. Rebuild Docker API
Set-Location "d:\AI applications\web\V3-RMS"
docker compose up -d --build api worker

# 4. Health check
Invoke-RestMethod http://localhost:4000/api/v1/health

# 5. Frontend typecheck
Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm typecheck  # zero errors

# 6. Frontend build
pnpm build  # must succeed
```
