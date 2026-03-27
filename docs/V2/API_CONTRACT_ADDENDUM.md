# API Contract Addendum
## Wendo Coffee Bistro — RMS V2
**Version:** 2.0
**Status:** Draft
**Date:** 2026-03-22
**Extends:** `docs/API_CONTRACT.md` (V1 — do not modify V1 doc)

---

## Overview

This document defines only the new API endpoints introduced in V2. All V1 conventions apply:

- Every response uses the standard envelope: `{ success, data, message, meta? }`
- All endpoints require `Authorization: Bearer <token>` unless explicitly marked **[PUBLIC]**
- All list endpoints support `?page=&limit=` pagination unless noted
- Error codes follow V1 conventions: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`

---

## 1. Inventory — Central Kitchen (`/api/v1/inventory`)

### Suppliers

#### `GET /inventory/suppliers`
**Auth:** `STORE_MANAGER`, `DIRECTOR`

Response:
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Kamau Farms", "phone": "0712345678", "email": null, "isActive": true }
  ]
}
```

#### `POST /inventory/suppliers`
**Auth:** `STORE_MANAGER`, `DIRECTOR`

Request:
```json
{ "name": "Kamau Farms", "phone": "0712345678", "email": "kamau@farms.ke" }
```

#### `PATCH /inventory/suppliers/:id`
**Auth:** `STORE_MANAGER`, `DIRECTOR`

Request: any subset of supplier fields.

---

### Raw Ingredients

#### `GET /inventory/ingredients`
**Auth:** `STORE_MANAGER`, `DIRECTOR`

Response includes `currentStockCk` and `reorderThreshold`. Returns all active ingredients.

#### `POST /inventory/ingredients`
**Auth:** `DIRECTOR` only (setup action)

Request:
```json
{ "name": "Chicken Breast", "unit": "kg", "reorderThreshold": 5.000 }
```

#### `PATCH /inventory/ingredients/:id`
**Auth:** `DIRECTOR`

#### `GET /inventory/ingredients/:id/conversions`
**Auth:** `STORE_MANAGER`, `DIRECTOR`

Returns all menu items that use this ingredient with their `quantityPerPortion`.

#### `POST /inventory/ingredients/:id/conversions`
**Auth:** `DIRECTOR`

Request:
```json
{ "menuItemId": "uuid", "quantityPerPortion": 0.1500 }
```

---

### Supplier Deliveries

#### `GET /inventory/deliveries`
**Auth:** `STORE_MANAGER`, `DIRECTOR`
**Query:** `?ingredientId=&supplierId=&from=&to=`

#### `POST /inventory/deliveries`
**Auth:** `STORE_MANAGER`, `DIRECTOR`

Request:
```json
{
  "ingredientId": "uuid",
  "supplierId": "uuid",
  "quantity": 50.000,
  "notes": "Morning delivery"
}
```

Response: delivery record + updated `currentStockCk` value.

---

### Requisitions — Central Kitchen View

#### `GET /inventory/requisitions`
**Auth:** `STORE_MANAGER`, `DIRECTOR`
**Query:** `?status=&date=` (defaults to today)

Returns all requisitions from all branches for the given date, with branch name and status.

#### `GET /inventory/requisitions/:id`
**Auth:** `STORE_MANAGER`, `DIRECTOR`

Returns full requisition with items. Each item includes:
- `requestedQty`
- `canFulfilQty` — computed from current `RawIngredient.currentStockCk` via `IngredientConversion`
- `dispatchedQty` (null if not yet dispatched)
- `receivedQty` (null if not yet received)

#### `POST /inventory/requisitions/:id/dispatch`
**Auth:** `STORE_MANAGER`, `DIRECTOR`

Request:
```json
{
  "items": [
    { "requisitionItemId": "uuid", "dispatchedQty": 40 },
    { "requisitionItemId": "uuid", "dispatchedQty": 15 }
  ]
}
```

Business rules (enforced in service layer):
- Sets `Requisition.status` to `DISPATCHED`
- Deducts corresponding raw ingredient quantities from `RawIngredient.currentStockCk` inside a `prisma.$transaction`
- Sends FCM push to branch manager: "Your requisition has been dispatched"

---

### Central Kitchen Stocktake

#### `GET /inventory/stocktake/central`
**Auth:** `STORE_MANAGER`, `DIRECTOR`
**Query:** `?date=`

#### `POST /inventory/stocktake/central`
**Auth:** `STORE_MANAGER`, `DIRECTOR`

Request:
```json
{
  "date": "2026-03-22",
  "entries": [
    { "ingredientId": "uuid", "actualQty": 18.500 }
  ]
}
```

---

## 2. Inventory — Branch (`/api/v1/inventory`)

### Requisitions — Branch View

#### `GET /inventory/requisitions/branch`
**Auth:** `MANAGER`

Returns requisitions for the authenticated user's branch.

#### `POST /inventory/requisitions`
**Auth:** `MANAGER`

Request:
```json
{
  "notes": "Expecting school group at lunch",
  "items": [
    { "menuItemId": "uuid", "requestedQty": 40 },
    { "menuItemId": "uuid", "requestedQty": 20 }
  ]
}
```

Validation:
- Rejected after 6:00 AM cutoff for morning requisitions (service layer enforces)
- Mid-day requisitions bypass the cutoff check when `isMidDay: true` is set in the request

#### `POST /inventory/requisitions/:id/receive`
**Auth:** `MANAGER`, `WAITER` (head waiter can receive)

Request:
```json
{
  "items": [
    { "requisitionItemId": "uuid", "receivedQty": 40 },
    { "requisitionItemId": "uuid", "receivedQty": 12 }
  ]
}
```

Business rules:
- Sets `Requisition.status` to `RECEIVED` or `PARTIAL` depending on whether all items matched
- Increments `BranchStock.currentQty` for each received item
- Restores `BranchMenuItem.isAvailable = true` for items that were hidden due to zero stock
- Records discrepancy for any item where `receivedQty < dispatchedQty`

---

### Branch Stock

#### `GET /inventory/stock/branch`
**Auth:** `MANAGER`, `WAITER`, `CHEF`, `BARISTA`

Returns live stock levels for the authenticated user's branch.

Response:
```json
{
  "success": true,
  "data": [
    {
      "menuItemId": "uuid",
      "menuItemName": "Chicken Burger",
      "currentQty": 38,
      "lowStockThreshold": 5,
      "isAvailable": true
    }
  ]
}
```

---

### Branch Stocktake

#### `GET /inventory/stocktake`
**Auth:** `MANAGER`
**Query:** `?from=&to=`

#### `POST /inventory/stocktake`
**Auth:** `MANAGER`

Request:
```json
{
  "date": "2026-03-22",
  "entries": [
    {
      "station": "KITCHEN",
      "menuItemId": "uuid",
      "expectedQty": 4,
      "actualQty": 2,
      "note": "Could not account for 2 portions"
    },
    {
      "station": "WAITER",
      "consumableId": "uuid",
      "expectedQty": 10,
      "actualQty": 10,
      "note": null
    }
  ]
}
```

`variance` is computed server-side as `actualQty - expectedQty`.

---

### Inventory Overview — Director

#### `GET /inventory/overview`
**Auth:** `DIRECTOR`, `STORE_MANAGER`

Returns:
- All branches: today's requisition status, discrepancy count, total shrinkage
- Central Kitchen: current ingredient stock levels, items below reorder threshold

#### `GET /inventory/reports/shrinkage`
**Auth:** `DIRECTOR`
**Query:** `?branchId=&from=&to=`

#### `GET /inventory/reports/discrepancies`
**Auth:** `DIRECTOR`, `STORE_MANAGER`
**Query:** `?branchId=&from=&to=`

---

## 3. HR (`/api/v1/hr`)

#### `GET /hr/staff/:userId/profile`
**Auth:** `DIRECTOR`, `MANAGER` (branch-scoped — cannot view another branch's staff)

Returns:
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "name": "John Mwangi", "role": "WAITER" },
    "performance": {
      "ordersThisMonth": 312,
      "avgOrdersPerShift": 18,
      "attendanceRate": 0.96,
      "lateClockIns": 2
    },
    "assessments": [ /* latest 5 */ ],
    "disciplinaryRecords": [ /* all */ ]
  }
}
```

#### `POST /hr/assessments`
**Auth:** `DIRECTOR`, `MANAGER`, supervisor roles (CHEF with head waiter flag — pending scoping)

Request:
```json
{
  "staffId": "uuid",
  "periodStart": "2026-03-01",
  "periodEnd": "2026-03-22",
  "dimensions": { "conduct": 4, "punctuality": 3, "teamwork": 5, "quality": 4 },
  "overallScore": 4.0,
  "notes": "Consistent performance, excellent with customers."
}
```

#### `GET /hr/assessments`
**Auth:** `DIRECTOR`, `MANAGER`
**Query:** `?userId=&from=&to=`

#### `POST /hr/disciplinary`
**Auth:** `DIRECTOR`, `MANAGER`

Request:
```json
{
  "staffId": "uuid",
  "type": "WRITTEN",
  "description": "Unauthorised absence on 2026-03-20",
  "notes": "Staff member was spoken to verbally on 2026-03-15 — this is the first written record"
}
```

#### `GET /hr/disciplinary`
**Auth:** `DIRECTOR`, `MANAGER`
**Query:** `?userId=`

#### `GET /hr/reports/performance`
**Auth:** `DIRECTOR`, `MANAGER`
**Query:** `?branchId=&from=&to=`

#### `GET /hr/reports/disciplinary`
**Auth:** `DIRECTOR`, `MANAGER`
**Query:** `?branchId=&from=&to=`

#### `GET /hr/reports/attendance`
**Auth:** `DIRECTOR`, `MANAGER`
**Query:** `?branchId=&from=&to=`

---

## 4. Payments — Mpesa STK Push (`/api/v1/payments/mpesa`)

#### `POST /payments/mpesa/stk-push`
**Auth:** `WAITER`, `MANAGER`

Request:
```json
{
  "orderId": "uuid",
  "phoneNumber": "0712345678"
}
```

Business rules (service layer):
- Normalises phone number to international format (0712... → 254712...)
- Looks up the branch's Mpesa configuration from `Organization`
- Calls Daraja API (or Pesapal) STK push
- Stores `mpesaRequestId` on the `Order` record
- Returns immediately — payment confirmation comes via callback

Response:
```json
{
  "success": true,
  "data": { "requestId": "ws_CO_...", "message": "STK push sent to 254712345678" }
}
```

#### `POST /payments/mpesa/callback` **[PUBLIC — NO AUTH]**

Receives Safaricom Daraja callback. This route has **no `authenticate` middleware**. Verify the request originates from Safaricom using their callback signature or IP whitelist.

Request body (Safaricom format):
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "ws_CO_...",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": { "Item": [ ... ] }
    }
  }
}
```

Business rules:
- Matches `CheckoutRequestID` to `Order.mpesaRequestId`
- `ResultCode === 0`: mark order as paid, set `paidAt`, extract and store `mpesaCode`
- `ResultCode !== 0`: order remains unpaid, emit `payment:failed` Socket.io event to waiter
- Store raw callback body in `Order.mpesaCallbackRaw` for audit

#### `POST /payments/mpesa/stk-push/:requestId/retry`
**Auth:** `WAITER`, `MANAGER`

Resends the STK push for a pending payment. Validates that the original request is still in a pending state.

#### `GET /payments/mpesa/status/:orderId`
**Auth:** `WAITER`, `MANAGER`

Returns current payment status for an order. Used by the frontend to poll when a Socket.io event is not received within the timeout window.

#### `GET /payments/mpesa/config` (Director only)
**Auth:** `DIRECTOR`

Returns Mpesa configuration for all branches (credentials masked — keys shown as `***`).

#### `PUT /payments/mpesa/config/:organizationId`
**Auth:** `DIRECTOR`

Updates Mpesa credentials for a branch. Credentials are never returned in any other response.

---

## 5. Communications (`/api/v1/communications`)

### Announcements

#### `POST /communications/announcements`
**Auth:** `DIRECTOR`, `MANAGER`

Request:
```json
{
  "title": "New shift policy effective Monday",
  "body": "Please note that all clock-ins must...",
  "organizationId": null,
  "targetRoles": ["WAITER", "CHEF", "BARISTA"],
  "requiresAck": true
}
```

`organizationId: null` = company-wide. `MANAGER` can only set their own `organizationId`.

#### `GET /communications/announcements`
**Auth:** All authenticated roles

Returns announcements relevant to the authenticated user (matching their role and branch). Includes `hasAcked: boolean` per announcement.

#### `POST /communications/announcements/:id/ack`
**Auth:** All authenticated roles

Marks the announcement as acknowledged by the current user. Idempotent — second call is a no-op.

---

### Direct Messages

#### `POST /communications/messages`
**Auth:** `DIRECTOR`, `MANAGER`, supervisor roles

Request:
```json
{ "toUserId": "uuid", "body": "Please come see me at 2pm regarding your shift." }
```

RBAC (enforced in service layer):
- `DIRECTOR` can message anyone
- `MANAGER` can message staff within their branch only
- Operational staff (WAITER, CHEF, BARISTA) cannot initiate — they can only reply

#### `GET /communications/messages`
**Auth:** All authenticated roles

Returns a list of conversation threads (unique `fromUserId`/`toUserId` pairs) with the most recent message and unread count per thread.

#### `GET /communications/messages/:userId`
**Auth:** All authenticated roles

Returns full message thread between authenticated user and `userId`. Marks all unread messages as read.

#### `GET /communications/messages/unread-count`
**Auth:** All authenticated roles

Returns total unread message count. Used for the notification badge in the nav.

---

## 6. Socket.io Events — V2 Additions

All V1 Socket.io events remain unchanged.

| Event | Direction | Payload | Description |
|---|---|---|---|
| `inventory:low_stock` | Server → Client | `{ organizationId, menuItemId, currentQty }` | Stock dropped below threshold |
| `inventory:out_of_stock` | Server → Client | `{ organizationId, menuItemId }` | Stock hit zero, item auto-hidden |
| `inventory:requisition_dispatched` | Server → Client | `{ requisitionId, organizationId }` | CK has dispatched a branch's requisition |
| `payment:confirmed` | Server → Client | `{ orderId, mpesaCode, amount }` | Mpesa callback received and order confirmed paid |
| `payment:failed` | Server → Client | `{ orderId, reason }` | Mpesa payment failed or expired |
| `communications:new_message` | Server → Client | `{ messageId, fromUserId, fromName }` | New direct message received |
| `communications:new_announcement` | Server → Client | `{ announcementId, title, requiresAck }` | New announcement for this user's role/branch |
