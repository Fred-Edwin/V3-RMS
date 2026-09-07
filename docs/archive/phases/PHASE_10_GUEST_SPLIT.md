# Phase 10 — Guest Split Payment

**Status:** Complete  
**Date:** 2026-05-11  
**Branch:** `codex/hr-shift-scheduling` (merged to main via CI/CD)

---

## What Was Built

Guest split payment allows a single order to be settled by multiple guests, each paying their own share using any supported method (Cash, M-Pesa, Card, House Account). A waiter selects the number of guests, adds a payment line per guest with an amount and method, and closes the order when all lines sum to the total.

---

## Backend Changes

### New Model — `SplitPaymentLine`
`backend/prisma/schema.prisma`

```prisma
model SplitPaymentLine {
  id        String   @id @default(cuid())
  orderId   String   @map("order_id")
  label     String                          // e.g. "Guest 1"
  amount    Decimal  @db.Decimal(10, 2)
  method    String                          // CASH | MPESA | CARD | HOUSE_ACCOUNT
  mpesaCode String?  @map("mpesa_code")
  createdAt DateTime @default(now()) @map("created_at")
  order     Order    @relation(fields: [orderId], references: [id])

  @@map("split_payment_lines")
}
```

`GUEST_SPLIT` added to `PaymentMethod` enum.

Migration: `backend/prisma/migrations/20260511_add_guest_split/`

### New API Endpoints

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/orders/:id/split-lines` | WAITER, MANAGER, ADMIN | Add a payment line |
| `GET` | `/orders/:id/split-lines` | WAITER, MANAGER, ADMIN | List all lines for order |
| `DELETE` | `/orders/:id/split-lines/:lineId` | WAITER, MANAGER, ADMIN | Remove a line |

`PATCH /orders/:id/payment` now accepts `paymentMethod: GUEST_SPLIT`. Validation requires all split lines to sum to the order total before closing.

### Timezone Bug Fix — `normalizeOrderDate`
`backend/src/services/order-service.ts`

`normalizeOrderDate` used JavaScript local-time methods (`getFullYear`, `getMonth`, `getDate`). Docker containers run UTC. Orders created near midnight Nairobi time (UTC+3) were stored with yesterday's date, causing them to disappear from the KDS `activeOnly` filter.

**Fix:** Removed `normalizeOrderDate`. Both `order_date` assignment points now call `getTodayDateOnly()` from `backend/src/utils/date-only.ts`, which uses `Intl.DateTimeFormat` with `Africa/Nairobi` and is timezone-correct in any container.

### Receipt Payload — `print-service.ts`

For `GUEST_SPLIT` orders, the receipt JSON now includes:

```json
{
  "splitPaymentLines": [
    { "label": "Guest 1", "amount": 450.00, "method": "MPESA", "mpesaCode": "QHJ34K" },
    { "label": "Guest 2", "amount": 550.00, "method": "CASH",  "mpesaCode": null }
  ]
}
```

`print-repository.ts` `findOrderForReceipt` query updated to select `splitPaymentLines`.

---

## Frontend Changes

### Guest Count Picker
`frontend/components/orders/OrderDetailBottomSheet.tsx`

When GUEST_SPLIT is selected and `guestCount` is `null`, a full-screen picker renders instead of the split panel:
- Large stepper (− / number / +), range 2–20
- Quick-tap chips for 2, 3, 4, 5, 6
- "Split between N guests" confirm button
- On confirm, `initSlots(count)` pre-fills the panel with N empty guest lines

### GuestSplitPanel Wiring
`frontend/app/app/orders/page.tsx`  
`frontend/app/app/dashboard/page.tsx`

Both pages now pass `onAddSplitLine` and `onDeleteSplitLine` callbacks to `<OrderDetailBottomSheet>`. After each mutation the local `selectedOrder` state is updated optimistically so the panel reflects the new line without a full refetch.

### TypeScript Fix — TS2367 False Positive
In the ternary `uiPaymentMethod === 'GUEST_SPLIT' ? <panel> : <cards>`, TypeScript narrows `uiPaymentMethod` in the else branch to exclude `GUEST_SPLIT`, making `selected={uiPaymentMethod === 'GUEST_SPLIT'}` always-false by type. Fixed by passing `selected={false}` directly — semantically correct because the card is rendered only when another method is active.

---

## Android Print App Changes

> **Note:** The Flutter source is in `receipt-printing-app/` which is gitignored and not pushed to GitHub. Changes must be deployed manually as an APK update.

### `lib/models/receipt_data.dart`
- Added `SplitPaymentLine` class with `label`, `amount`, `method`, `mpesaCode` fields and `fromJson` constructor
- Added `List<SplitPaymentLine>? splitPaymentLines` field to `ReceiptData`

### `lib/services/printer_service.dart`
- Added `'GUEST_SPLIT': 'Split between guests'` to `_formatPaymentMethod`
- Payment print block now branches on `paymentMethod == 'GUEST_SPLIT'`:
  - Prints `Payment: Split between guests` header
  - Prints a divider line
  - For each line: label + amount right-aligned, then method + M-Pesa code (if present) indented on the next line
  - Prints a closing divider line
  - Falls through to the existing single-method block otherwise

---

## Docs Updated

| File | Change |
|---|---|
| `docs/PRD.md` | Added FR-ORD-06a (Guest Split Payment); updated FR-ORD-06 payment method list; added receipt printing note |
| `docs/API_CONTRACT.md` | Updated `PATCH /orders/:id/payment` validation rules; added three new `/split-lines` endpoints |
| `docs/DATA_MODEL.md` | Added `GUEST_SPLIT` to `PaymentMethod` enum; added full `SplitPaymentLine` model schema; added `splitPaymentLines` relation on `Order` |
| `docs/DEPLOYMENT.md` | Version 2.0 → 2.1; date updated |
| `receipt-printing-app/RECEIPT_PRINTING_SPEC.md` | Version 1.0 → 1.1; expanded receipt data shape with all fields and all payment variants; added GUEST_SPLIT JSON example |

---

## Deployment Notes

- Migration is committed and will be applied automatically by CI/CD (`prisma migrate deploy`) on next push to `main`.
- No manual server steps required.
- Flutter APK must be rebuilt and re-distributed to print station devices separately.
