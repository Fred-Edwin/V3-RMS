# Coding Standards — V2
## Wendo Coffee Bistro — RMS
**Version:** 2.0
**Status:** Active
**Extends:** `docs/CODING_STANDARDS.md` (V1 — all V1 rules remain in force)

---

## All V1 Rules Apply

Read `docs/CODING_STANDARDS.md` before reading this document. Every rule defined there applies to V2 code without exception. This document adds only V2-specific rules on top.

---

## V2-Specific Rules

### 1. The `STORE_MANAGER` Role

The Store Manager operates at the Central Kitchen level. Code that touches inventory routes must reflect this:

**Route guards for Central Kitchen operations:**
```typescript
// Correct — CK operations allow STORE_MANAGER and DIRECTOR
router.get('/inventory/ingredients', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), handler)

// Wrong — using MANAGER grants access to branch managers who should not see CK data
router.get('/inventory/ingredients', authenticate, requireRole('MANAGER'), handler)
```

**Repositories for Central Kitchen data never include `organizationId`:**
```typescript
// Correct — raw ingredients are global
const ingredients = await prisma.rawIngredient.findMany({ where: { isActive: true } })

// Wrong — there is no organizationId on RawIngredient
const ingredients = await prisma.rawIngredient.findMany({ where: { organizationId, isActive: true } })
```

**Repositories for branch inventory data always include `organizationId`:**
```typescript
// Correct — branch stock is scoped to a branch
const stock = await prisma.branchStock.findMany({ where: { organizationId, menuItemId } })

// Wrong — returns stock for all branches
const stock = await prisma.branchStock.findMany({ where: { menuItemId } })
```

---

### 2. Stock Deduction Must Be Atomic

When a `PrepTicket` is marked `READY`, the service must deduct from `BranchStock` in the same transaction as the status update. If either fails, both roll back.

```typescript
// Correct
await prisma.$transaction(async (tx) => {
  await tx.prepTicket.update({ where: { id }, data: { status: 'READY', readyAt: new Date() } })
  await tx.branchStock.update({
    where: { organizationId_menuItemId: { organizationId, menuItemId } },
    data: { currentQty: { decrement: portionQty } }
  })
})

// Wrong — two separate awaits can leave data inconsistent if the second fails
await prepTicketService.markReady(id)
await inventoryService.deductStock(organizationId, menuItemId, portionQty)
```

---

### 3. The Mpesa Callback Route Is Intentionally Public

The Daraja callback endpoint at `POST /payments/mpesa/callback` has no `authenticate` middleware. This is a deliberate exception. It must be documented clearly at the route definition:

```typescript
// PUBLIC ENDPOINT — No authenticate middleware.
// This route receives Safaricom Daraja callbacks.
// Safaricom does not send auth tokens. Validate by IP whitelist or callback signature instead.
router.post('/mpesa/callback', mpesaController.handleCallback)
```

Do not add `authenticate` middleware to this route. Do not remove the comment.

---

### 4. Mpesa Credentials Are Never Logged or Returned

`Organization.mpesaConsumerSecret` and `Organization.mpesaPasskey` must never appear in:
- API responses (even to `DIRECTOR`)
- Application logs
- Error messages

When returning organisation data that includes Mpesa config, always mask secrets:
```typescript
// Correct
const config = {
  mpesaTillNumber: org.mpesaTillNumber,
  mpesaConsumerKey: org.mpesaConsumerKey,
  mpesaConsumerSecret: '***',  // never expose
  mpesaPasskey: '***',         // never expose
}
```

---

### 5. Requisition Cutoff Enforcement Belongs in the Service

The 6:00 AM cutoff for morning requisitions is a business rule. It lives in `inventoryService`, not in the controller and not in the Zod schema.

```typescript
// Correct — in inventoryService.ts
const now = new Date()
const cutoffHour = 6
if (!isMidDay && now.getHours() >= cutoffHour) {
  throw new AppError('Morning requisitions must be submitted before 6:00 AM', 400, 'REQUISITION_CUTOFF')
}

// Wrong — in controller or validator
```

---

### 6. `StocktakeEntry` Must Have Exactly One of `menuItemId` or `consumableId`

Validate this at the service layer before writing to the database:

```typescript
// In inventoryService.ts
if ((!entry.menuItemId && !entry.consumableId) || (entry.menuItemId && entry.consumableId)) {
  throw new AppError('Each stocktake entry must reference either a menu item or a consumable, not both', 400, 'VALIDATION_ERROR')
}
```

---

### 7. HR Records Are Permanent

`DisciplinaryRecord` rows must never be deleted by any code path — including admin utilities, seed scripts, and test teardown.

```typescript
// Wrong — disciplinary records must not be deleted
await prisma.disciplinaryRecord.delete({ where: { id } })
await prisma.disciplinaryRecord.deleteMany({ where: { staffId } })

// Test teardown is the only exception — and only in test environments
// Add a guard:
if (process.env.NODE_ENV !== 'test') {
  throw new Error('Disciplinary records cannot be deleted outside of test environments')
}
```

---

### 8. Communication RBAC Is Enforced in the Service Layer

The permission rules for who can send messages to whom are business logic — they belong in `communicationsService`, not in route guards:

```typescript
// In communicationsService.ts
if (sender.role === 'WAITER' || sender.role === 'CHEF' || sender.role === 'BARISTA') {
  throw new AppError('Operational staff cannot initiate direct messages', 403, 'FORBIDDEN')
}
if (sender.role === 'MANAGER' && recipient.organizationId !== sender.organizationId) {
  throw new AppError('Managers can only message staff within their branch', 403, 'FORBIDDEN')
}
```

---

### 9. Frontend — Inventory Store Stability

Inventory state includes live stock levels that update frequently via Socket.io. Follow V1 hook stability rules strictly:

- Do not subscribe to Socket.io events inside render functions
- Use `useEffect` with a stable socket reference from the store
- Stock level updates should update Zustand store state, not trigger re-fetches

```typescript
// Correct — stable socket from store
const socket = useSocketStore((s) => s.socket)
useEffect(() => {
  if (!socket) return
  socket.on('inventory:low_stock', handleLowStock)
  return () => { socket.off('inventory:low_stock', handleLowStock) }
}, [socket]) // socket is stable — from Zustand store, not inline
```
