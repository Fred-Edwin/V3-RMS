# API Contract
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 2.1
**Status:** Partially stale — being replaced feature-by-feature
**Date:** 2026-05-04 (core) · 2026-09-07 (staleness note)
**Base URL:** `https://api.wendo-rms.co.ke/api/v1`

> **Note (2026-09-07).** Under the feature-by-feature redo
> (`docs/FEATURE_REDO_PLAYBOOK.md`), each feature's contract is being re-authored
> as **frozen shared Zod/TypeScript types committed to the code**, with a matching
> section here. The prose below covers the Phase ≤8 surface and is still broadly
> accurate for orders, auth, menu, staff, shifts, clock, and the account/credit
> flows.
>
> **Route groups NOT documented here** (present in `backend/src/routes/`, to be
> contracted during their redo): `department`, `dispatch`, `location`,
> `inventory-item`, `inventory-report`, `purchase-order`, `supplier`,
> `supplier-invoice`, `prep-record`, `stock-count`, `waste-log`, `requisition`
> (all Inventory); `payslip`; `staff-transfer`; `modification-request`;
> `order-correction`; `house-account-auth`, `staff-discount-auth`,
> `customer-discount-auth`, `order-cancellation-auth` (only lightly covered).
> For those, `backend/src/validators/` + `backend/src/routes/` are the source of
> truth until the feature is redone.

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Menu](#3-menu)
4. [Orders](#4-orders)
5. [Prep Tickets & Incidents](#5-prep-tickets--incidents)
6. [Staff & Transfers](#6-staff--transfers)
7. [Shifts & Scheduling](#7-shifts--scheduling)
8. [Clock Records](#8-clock-records)
9. [Delivery Zones](#9-delivery-zones)
10. [Branches](#10-branches)
11. [Reports](#11-reports)
12. [Receipt Printing](#12-receipt-printing)
13. [Credit Accounts](#13-credit-accounts)
14. [Other Income](#14-other-income)
15. [Discounts](#15-discounts)
16. [Internal Communications](#16-internal-communications)
17. [HR Module](#17-hr-module)
18. [System Admin](#18-system-admin)
19. [Health](#19-health)
20. [WebSocket Events](#20-websocket-events)

---

## 1. Conventions

### Standard Response Envelope

Every response — success or error — follows this structure without exception.

```json
// Success — single resource
{
  "success": true,
  "data": { },
  "message": "Order created successfully"
}

// Success — list
{
  "success": true,
  "data": [ ],
  "pagination": {
    "total": 84,
    "page": 1,
    "perPage": 20,
    "totalPages": 5
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [ ]
  }
}
```

### Error Codes

| HTTP Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body or params failed Zod validation |
| 401 | `AUTHENTICATION_ERROR` | Missing or invalid JWT |
| 403 | `AUTHORIZATION_ERROR` | Valid JWT but insufficient role or wrong branch |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Action conflicts with current state (e.g., claiming an already-claimed ticket) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### Authentication Header

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

### Role Permissions Key

| Symbol | Meaning |
|---|---|
| 🔑 SA | System Admin only |
| 🔑 DIR | Director and above |
| 🔑 HR | HR Manager (cross-branch HR access) |
| 🔑 MGR | Manager and above |
| 🔑 ACCT | Accountant (cross-branch read + settlement write) |
| 🔑 WAITER | Waiter (branch-scoped) |
| 🔑 CHEF | Chef (branch-scoped) |
| 🔑 BARISTA | Barista (branch-scoped) |
| 🔑 KDS | Kitchen Display account |
| 🔑 BDS | Barista Display account |
| 🔑 ALL | Any authenticated user |

---

## 2. Authentication

### POST `/auth/login`
**Access:** Public  
Authenticates a user and returns tokens.

**Request Body:**
```json
{
  "email": "jane@wendo.co.ke",
  "password": "securepassword"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "name": "Jane Mwangi",
      "email": "jane@wendo.co.ke",
      "role": "WAITER",
      "organizationId": "uuid",
      "organizationName": "Wendo Kingz"
    }
  },
  "message": "Login successful"
}
```

**Notes:**
- Refresh token is set as an HTTP-only cookie: `refreshToken`
- Rate limited: 10 requests per minute per IP

---

### POST `/auth/refresh`
**Access:** Public (requires valid `refreshToken` cookie)  
Issues a new access token using the refresh token cookie.

**Request Body:** None

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### POST `/auth/logout`
**Access:** 🔑 ALL  
Invalidates the refresh token cookie.

**Request Body:** None

**Response `200`:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST `/auth/register-device`
**Access:** 🔑 ALL  
Registers an FCM device token for push notifications.

**Request Body:**
```json
{
  "fcmToken": "fcm-device-token-string"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Device registered for notifications"
}
```

---

### PATCH `/auth/change-password`
**Access:** 🔑 ALL  
Allows a user to change their own password.

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

---

## 3. Menu

### GET `/menu`
**Access:** 🔑 ALL  
Returns the full menu with branch-level availability applied. Items marked unavailable at the requesting user's branch are excluded.

**Query Params:**
```
categoryId  (optional) — filter by category
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "Hot Drinks",
        "prepStation": "BARISTA",
        "displayOrder": 1,
        "items": [
          {
            "id": "uuid",
            "name": "Cappuccino",
            "description": "Rich espresso with steamed milk foam",
            "imageUrl": "https://res.cloudinary.com/...",
            "price": "350.00",
            "isAvailable": true
          },
          {
            "id": "uuid",
            "name": "Flat White",
            "description": "Double shot with velvety microfoam",
            "imageUrl": null,
            "price": "380.00",
            "isAvailable": true
          }
        ]
      },
      {
        "id": "uuid",
        "name": "Mains",
        "prepStation": "KITCHEN",
        "displayOrder": 2,
        "items": [
          {
            "id": "uuid",
            "name": "Chicken Burger",
            "description": "Grilled chicken with house sauce",
            "imageUrl": "https://res.cloudinary.com/...",
            "price": "850.00",
            "isAvailable": false
          }
        ]
      }
    ]
  }
}
```

**Notes:**
- Response is cached in Redis per branch (TTL: 1 hour)
- Cache is invalidated when a manager toggles item availability

---

### GET `/menu/categories`
**Access:** 🔑 MGR, SA, DIR  
Returns all menu categories (system-level, no branch filter).

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Hot Drinks",
      "prepStation": "BARISTA",
      "displayOrder": 1,
      "isActive": true,
      "itemCount": 6
    }
  ]
}
```

---

### POST `/menu/categories`
**Access:** 🔑 SA, DIR  
Creates a new menu category.

**Request Body:**
```json
{
  "name": "Cold Drinks",
  "prepStation": "BARISTA",
  "displayOrder": 3
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Cold Drinks",
    "prepStation": "BARISTA",
    "displayOrder": 3,
    "isActive": true
  },
  "message": "Category created successfully"
}
```

---

### PATCH `/menu/categories/:id`
**Access:** 🔑 SA, DIR  
Updates a menu category.

**Request Body:** (all fields optional)
```json
{
  "name": "Cold Beverages",
  "displayOrder": 4,
  "isActive": true
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Cold Beverages", "prepStation": "BARISTA", "displayOrder": 4, "isActive": true },
  "message": "Category updated successfully"
}
```

---

### DELETE `/menu/categories/:id`
**Access:** 🔑 SA, DIR  
Soft-deletes a menu category. Fails if category has active menu items.

**Response `200`:**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

**Error `409`:**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Cannot delete a category that has active menu items. Deactivate or reassign items first."
  }
}
```

---

### POST `/menu/items/upload-image`
**Access:** 🔑 SA, DIR
Uploads an image to Cloudinary and returns the CDN URL. Call this **before** creating or updating an item, then pass the returned `imageUrl` in the create/update body.

**Request:** `multipart/form-data`
```
field: image  (file — JPEG, PNG, or WebP, max 5 MB)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://res.cloudinary.com/your-cloud/image/upload/f_auto,q_auto/wendo/menu/abc123.webp"
  }
}
```

**Notes:**
- Images are stored under the `wendo/menu` folder in Cloudinary
- Cloudinary applies `fetch_format: auto, quality: auto` — WebP is served to browsers that support it
- The returned URL is a permanent CDN link; pass it as `imageUrl` in subsequent create/update item calls

---

### POST `/menu/items`
**Access:** 🔑 SA, DIR
Creates a new menu item.

**Request Body:**
```json
{
  "categoryId": "uuid",
  "name": "Iced Latte",
  "description": "Chilled espresso with cold milk",
  "imageUrl": "https://res.cloudinary.com/...",
  "price": "400.00"
}
```
> `imageUrl` is optional. Omit it if no image has been uploaded yet.

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "categoryId": "uuid",
    "name": "Iced Latte",
    "description": "Chilled espresso with cold milk",
    "imageUrl": "https://res.cloudinary.com/...",
    "price": "400.00",
    "isActive": true
  },
  "message": "Menu item created successfully"
}
```

---

### PATCH `/menu/items/:id`
**Access:** 🔑 SA, DIR
Updates a menu item's details at the master level.

**Request Body:** (all fields optional)
```json
{
  "name": "Iced Latte",
  "description": "Updated description",
  "imageUrl": "https://res.cloudinary.com/...",
  "price": "420.00",
  "isActive": true
}
```
> Pass `imageUrl: null` (or omit) to leave the existing image unchanged. To remove an image, pass `"imageUrl": ""`.

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Iced Latte", "imageUrl": "https://res.cloudinary.com/...", "price": "420.00", "isActive": true },
  "message": "Menu item updated successfully"
}
```

---

### DELETE `/menu/items/:id`
**Access:** 🔑 SA, DIR  
Soft-deletes a menu item from the master menu.

**Response `200`:**
```json
{
  "success": true,
  "message": "Menu item deleted successfully"
}
```

---

### PATCH `/menu/items/:id/availability`
**Access:** 🔑 MGR  
Toggles a menu item's availability at the manager's branch.

**Request Body:**
```json
{
  "isAvailable": false
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "menuItemId": "uuid",
    "organizationId": "uuid",
    "isAvailable": false,
    "updatedAt": "2026-02-22T10:30:00Z"
  },
  "message": "Item marked as unavailable at this branch"
}
```

**Notes:**
- Automatically invalidates the menu cache for this branch

---

## 4. Orders

### GET `/orders`
**Access:** 🔑 WAITER, MGR, DIR  
Returns orders for the authenticated user's branch.

**Query Params:**
```
status      (optional) — PENDING | IN_PROGRESS | READY | CLOSED | CANCELLED
type        (optional) — DINE_IN | TAKE_AWAY | DELIVERY
date        (optional) — YYYY-MM-DD (defaults to today)
view        (optional) — full | summary (summary omits heavy nested detail for list UIs)
page        (optional) — default 1
perPage     (optional) — default 20, max 100
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "dailyNumber": 7,
      "orderDate": "2026-02-22",
      "type": "DINE_IN",
      "status": "IN_PROGRESS",
      "tableNumber": "4",
      "notes": "No onions please",
      "subtotal": "1200.00",
      "deliveryFee": "0.00",
      "total": "1200.00",
      "paymentMethod": null,
      "paidAt": null,
      "createdAt": "2026-02-22T09:15:00Z",
      "createdBy": {
        "id": "uuid",
        "name": "James Kamau"
      },
      "prepTickets": [
        {
          "id": "uuid",
          "station": "KITCHEN",
          "status": "IN_PROGRESS",
          "claimedBy": { "id": "uuid", "name": "Chef Maina" },
          "claimedAt": "2026-02-22T09:16:30Z"
        },
        {
          "id": "uuid",
          "station": "BARISTA",
          "status": "PENDING",
          "claimedBy": null,
          "claimedAt": null
        }
      ]
    }
  ],
  "pagination": {
    "total": 43,
    "page": 1,
    "perPage": 20,
    "totalPages": 3
  }
}
```

---

### GET `/orders/active`
**Access:** 🔑 WAITER, MGR  
Returns all non-closed orders for the branch. Optimised for the live order feed on the waiter app and manager dashboard.

**Query Params:**
```
view        (optional) — full | summary (summary omits heavy nested detail for list UIs)
```

**Response `200`:**
```json
{
  "success": true,
  "data": [ /* same shape as GET /orders items */ ]
}
```

---

### GET `/orders/:id`
**Access:** 🔑 WAITER, MGR, DIR  
Returns a single order with full detail.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "dailyNumber": 7,
    "orderDate": "2026-02-22",
    "type": "DINE_IN",
    "status": "IN_PROGRESS",
    "tableNumber": "4",
    "notes": "No onions please",
    "subtotal": "1200.00",
    "deliveryFee": "0.00",
    "total": "1200.00",
    "paymentMethod": null,
    "paidAt": null,
    "closedAt": null,
    "createdAt": "2026-02-22T09:15:00Z",
    "createdBy": {
      "id": "uuid",
      "name": "James Kamau"
    },
    "items": [
      {
        "id": "uuid",
        "menuItemId": "uuid",
        "name": "Cappuccino",
        "quantity": 2,
        "unitPrice": "350.00",
        "subtotal": "700.00",
        "notes": null
      },
      {
        "id": "uuid",
        "menuItemId": "uuid",
        "name": "Chicken Burger",
        "quantity": 1,
        "unitPrice": "850.00",
        "subtotal": "850.00",
        "notes": "No onions"
      }
    ],
    "prepTickets": [
      {
        "id": "uuid",
        "station": "KITCHEN",
        "status": "IN_PROGRESS",
        "claimedBy": { "id": "uuid", "name": "Chef Maina" },
        "claimedAt": "2026-02-22T09:16:30Z",
        "readyAt": null
      },
      {
        "id": "uuid",
        "station": "BARISTA",
        "status": "PENDING",
        "claimedBy": null,
        "claimedAt": null,
        "readyAt": null
      }
    ],
    "deliveryZone": null
  }
}
```

---

### POST `/orders`
**Access:** 🔑 WAITER  
Creates a new order. This is the critical path — see TDD Section 14.

**Request Body — Dine-In:**
```json
{
  "type": "DINE_IN",
  "tableNumber": "4",
  "notes": "No onions please",
  "items": [
    { "menuItemId": "uuid", "quantity": 2, "notes": null },
    { "menuItemId": "uuid", "quantity": 1, "notes": "No onions" }
  ]
}
```

**Request Body — Take-Away:**
```json
{
  "type": "TAKE_AWAY",
  "notes": null,
  "items": [
    { "menuItemId": "uuid", "quantity": 1, "notes": null }
  ]
}
```

**Request Body — Delivery:**
```json
{
  "type": "DELIVERY",
  "deliveryZoneId": "uuid",
  "notes": "Call on arrival",
  "items": [
    { "menuItemId": "uuid", "quantity": 2, "notes": null }
  ]
}
```

**Validation Rules:**
- `type` is required
- `items` must have at least 1 item
- `items[].quantity` must be a positive integer (min 1)
- `tableNumber` required when `type = DINE_IN`
- `deliveryZoneId` required when `type = DELIVERY`
- All `menuItemId` values must exist and be available at the branch

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "dailyNumber": 8,
    "type": "DINE_IN",
    "status": "PENDING",
    "tableNumber": "4",
    "subtotal": "1550.00",
    "deliveryFee": "0.00",
    "total": "1550.00",
    "createdAt": "2026-02-22T09:20:00Z",
    "prepTickets": [
      { "id": "uuid", "station": "KITCHEN", "status": "PENDING" },
      { "id": "uuid", "station": "BARISTA", "status": "PENDING" }
    ]
  },
  "message": "Order #8 created successfully"
}
```

**Notes:**
- Wraps order, items, and prep ticket creation in a single DB transaction
- Emits `order:new` WebSocket event to the relevant station room(s) after commit

---

### PATCH `/orders/:id/items`
**Access:** 🔑 WAITER
Modifies the items on an order. Allowed as long as the order is not `CLOSED` or `CANCELLED`. Waiter must be the order creator (ownership check).

**Request Body:**
```json
{
  "items": [
    { "menuItemId": "uuid", "quantity": 3, "notes": null },
    { "menuItemId": "uuid", "quantity": 1, "notes": "Extra sauce" }
  ]
}
```

**Validation Rules:**
- `items` must have at least 1 item
- Order must not be `CLOSED` or `CANCELLED`
- Station-aware rules:
  - If a station has any prep ticket in `IN_PROGRESS` or `READY`, that station becomes add-only
  - For add-only stations, removals/decreases are rejected with `409 CONFLICT`
  - Additions for add-only stations create a new follow-up prep ticket batch (`PENDING`)

**Response `200`:**
```json
{
  "success": true,
  "data": { /* updated full order object */ },
  "message": "Order updated successfully"
}
```

**Error `409`:**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Order cannot be modified. Preparation has already started at one or more stations."
  }
}
```

**Notes:**
- Recalculates subtotal and total
- Updates PrepTicket JSON snapshots for stations still editable (`PENDING` / `REJECTED`)
- Creates follow-up PrepTickets for add-only station additions
- Emits `order:modified` for updated tickets and `order:new` for newly created tickets
- If the order was `READY` and new prep tickets are created, order status reverts to `IN_PROGRESS`

---
### PATCH `/orders/:id/payment`
**Access:** 🔑 WAITER  
Records payment for an order and marks it as closed. For delivery orders, marks as handed to Grubba.

**Request Body:**
```json
{
  "paymentMethod": "MPESA"
}
```

**Validation Rules:**
- `paymentMethod` required: `MPESA | CASH | CARD | SPLIT | GUEST_SPLIT | HOUSE_ACCOUNT | CORPORATE_ACCOUNT | CUSTOMER_CREDIT`
- Delivery orders only accept `MPESA`
- Order must be in `READY` status before payment can be recorded
- For delivery orders, all prep tickets must be `READY`
- For `GUEST_SPLIT`: persisted `SplitPaymentLine` records must sum to the order total (±1 KES). Use the split-line endpoints below to add lines before calling this endpoint.
- For `SPLIT`: include `splitType` (`MPESA_CASH | MPESA_CARD | CASH_CARD`), `mpesaCode` (if Mpesa involved), and the relevant amount fields.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CLOSED",
    "paymentMethod": "MPESA",
    "paidAt": "2026-02-22T09:45:00Z",
    "closedAt": "2026-02-22T09:45:00Z"
  },
  "message": "Payment recorded. Order closed."
}
```

---

### POST `/orders/:id/split-lines`
**Access:** 🔑 WAITER  
Adds a guest payment line for a Guest Split order. Each call records one guest's payment immediately in the DB. Lines can be deleted and re-added before the order is closed.

**Request Body:**
```json
{
  "label": "Guest 1",
  "amount": 750,
  "method": "MPESA",
  "mpesaCode": "QHX7K2P1MN"
}
```

**Validation Rules:**
- `label`: 1–100 characters
- `amount`: positive number
- `method`: `MPESA | CASH | CARD`
- `mpesaCode`: required when `method` is `MPESA`
- New cumulative sum must not exceed order total + 1 KES

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderId": "uuid",
    "label": "Guest 1",
    "amount": "750.00",
    "method": "MPESA",
    "mpesaCode": "QHX7K2P1MN",
    "paidAt": "2026-05-11T08:00:00Z",
    "createdAt": "2026-05-11T08:00:00Z"
  }
}
```

---

### GET `/orders/:id/split-lines`
**Access:** 🔑 WAITER, MGR, DIRECTOR  
Returns all split payment lines for an order.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "label": "Guest 1",
      "amount": "750.00",
      "method": "MPESA",
      "mpesaCode": "QHX7K2P1MN",
      "paidAt": "2026-05-11T08:00:00Z",
      "createdAt": "2026-05-11T08:00:00Z"
    }
  ]
}
```

---

### DELETE `/orders/:id/split-lines/:lineId`
**Access:** 🔑 WAITER  
Removes a guest payment line. Only allowed while the order is not yet closed.

**Response `200`:**
```json
{
  "success": true,
  "data": { "success": true }
}
```

---

### PATCH `/orders/:id/cancel`
**Access:** 🔑 WAITER, MGR, DIR
Requests or performs cancellation. Waiters can request cancellation for their own orders in `PENDING`, `IN_PROGRESS`, or `READY` status; this does **not** immediately cancel the order. The order moves to `AWAITING_CANCELLATION_APPROVAL` until a Manager or Director approves or rejects. Managers and Directors can directly cancel active orders in `PENDING`, `IN_PROGRESS`, or `READY` with the same reason payload. Direct cancellation of `IN_PROGRESS`/`READY` orders emits `order:force_cancelled`.

**Request Body:**
```json
{
  "reason": "Customer left",
  "reasonDetail": "Optional detail for 'Other' reason"
}
```

**Validation Rules:**
- `reason` required: one of `Customer changed their mind | Customer left | Duplicate order | Wrong items ordered | Item unavailable | Other`
- `reasonDetail` required when reason is `Other`
- Waiter must be the order creator (ownership check)
- Waiter path is rejected if the order already has a pending cancellation request
- Orders in `CLOSED`, `CANCELLED`, `AWAITING_AUTHORIZATION`, or `AWAITING_CANCELLATION_APPROVAL` cannot receive a new waiter cancellation request
- Manager/Director direct cancellation is allowed only from `PENDING`, `IN_PROGRESS`, or `READY`; orders in authorization hold states must be resolved through their approval flow

**Waiter Response `202`:**
```json
{
  "success": true,
  "data": {
    "order": { "id": "uuid", "status": "AWAITING_CANCELLATION_APPROVAL" },
    "cancellationRequest": {
      "id": "uuid",
      "orderId": "uuid",
      "status": "PENDING",
      "previousStatus": "IN_PROGRESS",
      "reason": "Customer left"
    }
  },
  "message": "Cancellation request sent for approval"
}
```

**Manager/Director Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "status": "CANCELLED" },
  "message": "Order cancelled"
}
```

**Error `409`:**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Order cannot be cancelled in its current state."
  }
}
```

---

### Order Cancellation Authorization

#### GET `/order-cancellation-auth`
**Access:** 🔑 MGR, DIR
Returns pending cancellation requests for the authenticated manager's branch. Directors may see requests across branches according to the same cross-branch access rules used by manager dashboards.

#### GET `/orders/:orderId/cancellation-auth`
**Access:** 🔑 WAITER, MGR, DIR
Returns the pending cancellation request for an order. Waiters can only fetch requests for their own orders.

#### POST `/order-cancellation-auth/:authRequestId/override`
**Access:** 🔑 MGR, DIR
Approves or rejects a pending cancellation request.

**Request Body:**
```json
{
  "decision": "APPROVED",
  "resolutionNote": "Optional note when rejecting or approving"
}
```

**Behavior:**
- On `APPROVE`: request status becomes `APPROVED`, order status becomes `CANCELLED`, cancellation fields are written to the order, `ORDER_CANCELLED` incident is logged, and prep stations plus the waiter are notified.
- On `REJECT`: request status becomes `REJECTED`, order status is restored to the request's `previousStatus`, rejection audit is logged, and the waiter is notified to continue handling the order.
- Approval/rejection is atomic with the order status update.

---

## 5. Prep Tickets & Incidents

### GET `/prep-tickets`
**Access:** 🔑 CHEF, KDS, BARISTA, BDS  
Returns prep tickets for the authenticated user's station and branch.

**Query Params:**
```
status   (optional) — PENDING | IN_PROGRESS | READY
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "orderDailyNumber": 7,
      "orderType": "DINE_IN",
      "tableNumber": "4",
      "orderNotes": "No onions please",
      "station": "KITCHEN",
      "status": "PENDING",
      "claimedBy": null,
      "claimedAt": null,
      "readyAt": null,
      "items": [
        { "name": "Chicken Burger", "quantity": 1, "notes": "No onions" }
      ],
      "createdAt": "2026-02-22T09:15:00Z"
    }
  ]
}
```

**Notes:**
- Station is automatically inferred from the user's role (CHEF/KDS → KITCHEN, BARISTA/BDS → BARISTA)
- This is the primary query for the KDS and BDS display

---

### PATCH `/prep-tickets/:id/claim`
**Access:** 🔑 CHEF, KDS, BARISTA, BDS  
Claims a prep ticket. Moves it from `PENDING` to `IN_PROGRESS`.

**Request Body:**
```json
{
  "claimedById": "uuid"
}
```

**Validation Rules:**
- `claimedById` must be a user currently on shift at the branch with the correct role (Chef for KITCHEN, Barista for BARISTA)
- Ticket must be in `PENDING` status — claiming an already-claimed ticket returns `409`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "IN_PROGRESS",
    "claimedBy": { "id": "uuid", "name": "Chef Maina" },
    "claimedAt": "2026-02-22T09:16:30Z"
  },
  "message": "Order claimed by Chef Maina"
}
```

**Error `409`:**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "This order has already been claimed."
  }
}
```

**Notes:**
- Emits `order:claimed` WebSocket event to the waiter's user room
- Updates the parent `Order.status` to `IN_PROGRESS` if it was `PENDING`

---

### PATCH `/prep-tickets/:id/ready`
**Access:** 🔑 CHEF, KDS, BARISTA, BDS  
Marks a prep ticket as ready. Moves it from `IN_PROGRESS` to `READY`.

**Request Body:** None

**Validation Rules:**
- Ticket must be in `IN_PROGRESS` status
- Personal chef/barista accounts may only mark tickets ready when `claimedById` matches the authenticated user
- Shared display accounts (`KDS`, `BDS`) may still complete tickets for the station queue

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "READY",
    "readyAt": "2026-02-22T09:28:00Z"
  },
  "message": "Order marked as ready"
}
```

**Notes:**
- Emits `order:ready` WebSocket event to the waiter's user room with station info
- If ALL prep tickets on the parent order are now `READY`, emits a combined `order:all_ready` event and updates `Order.status` to `READY`

**Error `409` (claimed by another staff member):**
```json
{
  "success": false,
  "error": {
    "code": "TICKET_ASSIGNED_TO_OTHER_STAFF",
    "message": "This ticket is assigned to Chef Maina.",
    "details": {
      "claimedById": "uuid",
      "claimedByName": "Chef Maina"
    }
  }
}
```

### PATCH `/prep-tickets/:id/reject`
**Access:** CHEF, KDS, BARISTA, BDS
Rejects a prep ticket and reverts it to `PENDING`. The ticket's claim is cleared, allowing the waiter to edit or cancel the order. If all tickets for the order are now `PENDING`, the order status is also reverted to `PENDING`.

**Request Body:**
```json
{
  "reason": "Item out of stock"
}
```

**Validation Rules:**
- `reason` required: predefined reasons include `Item out of stock | Equipment not working | Wrong station | Ingredient unavailable | Quality issue with ingredient | Other: {detail}`

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "status": "PENDING" },
  "message": "Prep ticket rejected"
}
```

**Notes:**
- Reverts ticket to PENDING (clears claimedBy/claimedAt)
- Stores rejection metadata (rejectedById, rejectedReason, rejectedAt) for audit
- Emits `ticket:rejected` to the waiter's user room
- Logs an incident of type `TICKET_REJECTED`
- If all order tickets are now PENDING, reverts order status to PENDING

---

### PATCH `/prep-tickets/:id/unclaim`
**Access:** CHEF, KDS, BARISTA, BDS
Unclaims a prep ticket (fix wrong claim). Only allowed within 2 minutes of claiming.

**Request Body:** None

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "status": "PENDING" },
  "message": "Prep ticket unclaimed"
}
```

**Notes:**
- Returns 409 if more than 2 minutes since claim
- Emits `ticket:unclaimed` to the waiter's user room
- Logs an incident of type `TICKET_UNCLAIMED`

---

### GET `/incidents`
**Access:** MGR, DIR
Returns paginated incident log entries for the manager's branch.

**Query Params:**
```
type       (optional) — ORDER_CANCELLED | TICKET_REJECTED | TICKET_UNCLAIMED | ORDER_STALE
startDate  (optional) — YYYY-MM-DD
endDate    (optional) — YYYY-MM-DD
orderId    (optional) — uuid
page       (optional, default 1)
perPage    (optional, default 20)
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "ORDER_CANCELLED",
      "orderId": "uuid",
      "actor": { "id": "uuid", "name": "John" },
      "details": { "reason": "Customer left", "dailyNumber": 42 },
      "createdAt": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": { "total": 15, "page": 1, "perPage": 20, "totalPages": 1 }
}
```

---

## 6. Staff & Transfers

### GET `/staff`
**Access:** 🔑 MGR, DIR, SA  
Returns staff for the authenticated manager's branch. Director and SA can pass `organizationId` as a query param to view any branch.

**Query Params:**
```
organizationId  (optional, DIR/SA only) — filter by branch
role            (optional)              — WAITER | CHEF | BARISTA
isActive        (optional)              — true | false
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "James Kamau",
      "email": "james@wendo.co.ke",
      "phone": "+254712345678",
      "role": "WAITER",
      "isActive": true,
      "organizationId": "uuid",
      "organizationName": "Wendo Kingz",
      "createdAt": "2026-01-10T08:00:00Z"
    }
  ],
  "pagination": { "total": 12, "page": 1, "perPage": 20, "totalPages": 1 }
}
```

---

### GET `/staff/:id`
**Access:** 🔑 MGR, DIR, SA  
Returns a single staff member's details.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "James Kamau",
    "email": "james@wendo.co.ke",
    "phone": "+254712345678",
    "role": "WAITER",
    "isActive": true,
    "organizationId": "uuid",
    "organizationName": "Wendo Kingz",
    "createdAt": "2026-01-10T08:00:00Z"
  }
}
```

---

### POST `/staff`
**Access:** 🔑 MGR (creates WAITER, CHEF, BARISTA), DIR/SA (creates MANAGER)  
Creates a new staff account.

**Request Body:**
```json
{
  "name": "Grace Njeri",
  "email": "grace@wendo.co.ke",
  "phone": "+254798765432",
  "role": "CHEF",
  "temporaryPassword": "WendoStaff2026!"
}
```

**Validation Rules:**
- `email` must be unique across the system
- `role` must be within the creator's permission scope
- Manager can only create staff for their own branch (organizationId from JWT)
- `temporaryPassword` — staff must change on first login

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Grace Njeri",
    "email": "grace@wendo.co.ke",
    "role": "CHEF",
    "organizationId": "uuid",
    "isActive": true
  },
  "message": "Staff account created successfully"
}
```

---

### PATCH `/staff/:id`
**Access:** 🔑 MGR, DIR, SA  
Updates a staff member's details.

**Request Body:** (all fields optional)
```json
{
  "name": "Grace Njeri Mwangi",
  "phone": "+254798765432"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { /* updated staff object */ },
  "message": "Staff updated successfully"
}
```

---

### PATCH `/staff/:id/deactivate`
**Access:** 🔑 MGR (own branch), SA  
Deactivates a staff account. Deactivated staff cannot log in.

**Request Body:** None

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "isActive": false },
  "message": "Staff account deactivated"
}
```

---

### PATCH `/staff/:id/reactivate`
**Access:** 🔑 MGR (own branch), SA  
Reactivates a previously deactivated staff account.

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "isActive": true },
  "message": "Staff account reactivated"
}
```

---

### Store Manager team management & signing PIN (Pre-Demo Fixes)

A `STORE_MANAGER` may call the staff routes below, **scoped in the service to `STORE_ATTENDANT` accounts on their own (hub) organization** — never branch staff or other store managers. Out-of-scope targets return `404`.

| Route | Access | Notes |
|---|---|---|
| `GET /staff` | MGR, DIR, HR, SA, STORE_MANAGER … | For `STORE_MANAGER`: hub-org attendants only, active **and** inactive, each row includes `hasPin: boolean` (never the hash). |
| `GET /staff/:id` | MGR, DIR, HR, SA, STORE_MANAGER | STORE_MANAGER: attendants only. |
| `PATCH /staff/:id/reset-password` | MGR, SA, STORE_MANAGER | Body `{ "temporaryPassword": string (min 8) }`. Revokes the target's sessions. |
| `PATCH /staff/:id/deactivate` · `/reactivate` | MGR, SA, STORE_MANAGER | Unchanged shape. |
| `PATCH /staff/:id/reset-pin` | SA, STORE_MANAGER | No body. Clears the target's signing PIN (`pin_hash = NULL`); they set a new one at next signing. The caller never sees or chooses a PIN. |

**Response `200` (`reset-pin`):** `{ "success": true, "message": "PIN cleared. The staff member will set a new one at their next signing." }`

### GET `/users/me/pin-status`
**Access:** 🔑 any authenticated role  
**Response `200`:** `{ "success": true, "data": { "hasPin": true } }` — a boolean only; the hash is never returned. The Sign Sheet reads this to decide whether to show the "Set your PIN" step.

### POST `/users/me/pin`
**Access:** 🔑 any authenticated role (always acts on the caller)  
**Request Body:** `{ "pin": "4821", "currentPassword": "…" }` — `pin` is exactly 4 digits. `currentPassword` is **required only when a PIN is already set** (changing); a first-time set needs no password. Wrong/missing password on a change → `400 VALIDATION_ERROR`.

---

## 7. Shifts & Scheduling

### GET `/shifts`
**Access:** 🔑 MGR, DIR, HR  
Returns shift definitions for a branch. Managers read their own branch. Directors and HR managers must specify the branch using `organizationId`.

**Query Params:**
```
organizationId  (optional for MGR; required for DIR/HR) — target branch id
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Morning",
      "startTime": "06:00",
      "endTime": "14:00",
      "isActive": true
    },
    {
      "id": "uuid",
      "name": "Evening",
      "startTime": "14:00",
      "endTime": "22:00",
      "isActive": true
    }
  ]
}
```

---

### POST `/shifts`
**Access:** 🔑 MGR, HR  
Creates a new shift definition.

**Request Body:**
```json
{
  "organizationId": "uuid",
  "name": "Morning",
  "startTime": "06:00",
  "endTime": "14:00"
}
```
`organizationId` is optional for managers and required for HR managers.

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Morning",
    "startTime": "06:00",
    "endTime": "14:00",
    "isActive": true
  },
  "message": "Shift created successfully"
}
```

---

### PATCH `/shifts/:id`
**Access:** 🔑 MGR, HR  
Updates a shift definition.

**Request Body:** (all fields optional)
```json
{
  "organizationId": "uuid",
  "name": "Early Morning",
  "startTime": "05:30",
  "endTime": "13:30"
}
```
`organizationId` is optional for managers and required for HR managers.

**Response `200`:**
```json
{
  "success": true,
  "data": { /* updated shift object */ },
  "message": "Shift updated successfully"
}
```

---

### DELETE `/shifts/:id`
**Access:** 🔑 MGR, HR  
Soft-deletes a shift definition. Deletion is blocked if future assignments exist for the shift.

**Query Params:**
```
organizationId  (optional for MGR; required for HR) — target branch id
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Shift deleted successfully"
}
```

**Error `409`:**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Cannot delete shift with future assignments"
  }
}
```

---

### GET `/shift-assignments`
**Access:** 🔑 MGR, DIR, HR, ALL (staff see their own only)  
Returns shift assignments. Managers read all assignments for their own branch. Directors and HR managers must specify `organizationId`. Staff always see only their own assignments.

**Query Params:**
```
startDate   (required) — YYYY-MM-DD
endDate     (required) — YYYY-MM-DD
userId      (optional, MGR/DIR/HR only) — filter by staff member
shiftId     (optional) — filter by shift
organizationId  (optional for MGR; required for DIR/HR) — target branch id
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "date": "2026-02-22",
      "shift": {
        "id": "uuid",
        "name": "Morning",
        "startTime": "06:00",
        "endTime": "14:00"
      },
      "user": {
        "id": "uuid",
        "name": "James Kamau",
        "role": "WAITER"
      },
      "clockRecord": {
        "clockInAt": "2026-02-22T05:58:00Z",
        "clockOutAt": null,
        "clockInMethod": "GPS"
      }
    }
  ]
}
```

---

### POST `/shift-assignments`
**Access:** 🔑 MGR, HR  
Assigns a staff member to a shift on a specific date.

**Request Body:**
```json
{
  "organizationId": "uuid",
  "userId": "uuid",
  "shiftId": "uuid",
  "date": "2026-02-23"
}
```
`organizationId` is optional for managers and required for HR managers.

**Validation Rules:**
- `userId` must belong to the selected branch
- No duplicate assignment (same user + shift + date)

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "date": "2026-02-23",
    "userId": "uuid",
    "shiftId": "uuid"
  },
  "message": "Shift assigned successfully"
}
```

---

### POST `/shift-assignments/reconcile-week`
**Access:** 🔑 MGR, HR  
Saves manual edits from the weekly spreadsheet roster. `shiftId: null` clears the staff member's assignment for that date (`OFF` in the UI).

**Request Body:**
```json
{
  "organizationId": "uuid",
  "weekStart": "2026-05-10",
  "changes": [
    { "userId": "uuid", "date": "2026-05-12", "shiftId": "uuid" },
    { "userId": "uuid", "date": "2026-05-13", "shiftId": null }
  ]
}
```
`organizationId` is optional for managers and required for HR managers.

**Validation Rules:**
- Changes are branch-scoped to the manager's branch or the HR-selected branch.
- `userId` must be an active WAITER, CHEF, or BARISTA in that branch.
- `shiftId` must be an active shift definition in that branch.
- Dates must fall within `weekStart` through `weekStart + 6 days`.
- Past dates and assignments with clock records are not modified.

**Response `200` or `207`:**
```json
{
  "success": true,
  "data": {
    "saved": 2,
    "skipped": 0,
    "errors": [],
    "assignments": []
  },
  "message": "2 changes saved, 0 skipped"
}
```

---

### DELETE `/shift-assignments/:id`
**Access:** 🔑 MGR  
Removes a shift assignment. Only allowed if the shift date is in the future.

**Response `200`:**
```json
{
  "success": true,
  "message": "Shift assignment removed"
}
```

---

## 8. Clock Records

### POST `/clock/in`
**Access:** 🔑 WAITER, CHEF, BARISTA  
Records a clock-in. Validates geofence on the server.

**Request Body:**
```json
{
  "latitude": -0.4167,
  "longitude": 36.9500,
  "shiftAssignmentId": "uuid"
}
```

**Validation Rules:**
- `shiftAssignmentId` must belong to the authenticated user and today's date
- User must not already have an open clock-in for any shift

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clockInAt": "2026-02-22T05:58:00Z",
    "clockInMethod": "GPS"
  },
  "message": "Clocked in successfully"
}
```

**Error `403` (outside geofence):**
```json
{
  "success": false,
  "error": {
    "code": "CLOCK_OUTSIDE_GEOFENCE",
    "message": "You must be at the branch to clock in. You are approximately 120 metres away.",
    "details": {
      "action": "clock in",
      "distanceMetres": 120,
      "allowedRadiusMetres": 50
    }
  }
}
```

**Error `409` (already clocked in on another shift):**
```json
{
  "success": false,
  "error": {
    "code": "CLOCK_ALREADY_IN",
    "message": "You already have an open clock-in for another shift.",
    "details": {
      "assignmentId": "uuid",
      "userId": "uuid",
      "openShiftAssignmentId": "uuid"
    }
  }
}
```

---

### POST `/clock/out`
**Access:** 🔑 WAITER, CHEF, BARISTA  
Records a clock-out with geofence validation.

**Request Body:**
```json
{
  "latitude": -0.4167,
  "longitude": 36.9500,
  "shiftAssignmentId": "uuid"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clockInAt": "2026-02-22T05:58:00Z",
    "clockOutAt": "2026-02-22T14:02:00Z",
    "clockOutMethod": "GPS"
  },
  "message": "Clocked out successfully"
}
```

**Error `409` (stale or already completed):**
```json
{
  "success": false,
  "error": {
    "code": "CLOCK_STALE_STATE",
    "message": "Attendance changed just now. Refresh and try again.",
    "details": {
      "assignmentId": "uuid",
      "userId": "uuid"
    }
  }
}
```

---

### POST `/clock/override`
**Access:** 🔑 MGR  
Manager override for a staff member's clock-in or clock-out. The client should present only the valid override action for the current attendance state.

**Request Body:**
```json
{
  "userId": "uuid",
  "shiftAssignmentId": "uuid",
  "action": "CLOCK_IN",
  "reason": "GPS unavailable on device"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clockInAt": "2026-02-22T06:05:00Z",
    "clockInMethod": "OVERRIDE",
    "overrideNote": "GPS unavailable on device"
  },
  "message": "Clock-in override applied for James Kamau"
}
```

**Error Codes**
- `CLOCK_ASSIGNMENT_INVALID` — assignment does not belong to the staff member for today's business date
- `CLOCK_OVERRIDE_NOT_ALLOWED` — override requested for a non-today assignment
- `CLOCK_ALREADY_IN` — staff member already has an open clock record
- `CLOCK_ALREADY_OUT` — the shift attendance is already complete
- `CLOCK_STALE_STATE` — another request completed the action first

---

## 9. Delivery Zones

### GET `/delivery-zones`
**Access:** 🔑 ALL (branch-scoped)  
Returns active delivery zones for the branch. Used to populate the delivery zone dropdown when creating a delivery order.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Kiganjo", "fee": "200.00", "isActive": true },
    { "id": "uuid", "name": "Karatina", "fee": "350.00", "isActive": true },
    { "id": "uuid", "name": "Mathira", "fee": "150.00", "isActive": true }
  ]
}
```

---

### POST `/delivery-zones`
**Access:** 🔑 MGR  
Creates a new delivery zone for the branch.

**Request Body:**
```json
{
  "name": "Karatina",
  "fee": "350.00"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Karatina", "fee": "350.00", "isActive": true },
  "message": "Delivery zone created successfully"
}
```

---

### PATCH `/delivery-zones/:id`
**Access:** 🔑 MGR  
Updates a delivery zone.

**Request Body:** (all optional)
```json
{
  "name": "Karatina Town",
  "fee": "380.00",
  "isActive": true
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Karatina Town", "fee": "380.00", "isActive": true },
  "message": "Delivery zone updated successfully"
}
```

---

### DELETE `/delivery-zones/:id`
**Access:** 🔑 MGR  
Deactivates a delivery zone. Cannot be deleted if it has associated orders.

**Response `200`:**
```json
{
  "success": true,
  "message": "Delivery zone deactivated"
}
```

---

## 10. Branches

### GET `/branches`
**Access:** 🔑 DIR, SA  
Returns all branches in the system.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Wendo Kingz",
      "address": "Kingz Plaza, Ground Floor",
      "city": "Nyeri",
      "latitude": "-0.4167",
      "longitude": "36.9500",
      "isHub": true,
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "name": "Wendo Town",
      "address": "Town Centre, Kimathi Street",
      "city": "Nyeri",
      "latitude": "-0.4200",
      "longitude": "36.9480",
      "isHub": false,
      "isActive": true,
      "createdAt": "2025-03-01T00:00:00Z"
    }
  ]
}
```

---

### POST `/branches`
**Access:** 🔑 SA  
Creates a new branch.

**Request Body:**
```json
{
  "name": "Wendo Nanyuki",
  "address": "Nanyuki Mall, 1st Floor",
  "city": "Nanyuki",
  "latitude": "-0.0167",
  "longitude": "37.0667"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Wendo Nanyuki", "isHub": false, "isActive": true },
  "message": "Branch created successfully"
}
```

---

### PATCH `/branches/:id`
**Access:** 🔑 SA  
Updates branch details.

**Request Body:** (all optional)
```json
{
  "name": "Wendo Nanyuki",
  "address": "Updated address",
  "latitude": "-0.0170",
  "longitude": "37.0670"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { /* updated branch object */ },
  "message": "Branch updated successfully"
}
```

---

### PATCH `/branches/:id/set-hub`
**Access:** 🔑 DIR, SA  
Designates a branch as the hub. Automatically removes hub status from the previous hub branch.

**Request Body:** None

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Wendo Kingz", "isHub": true },
  "message": "Wendo Kingz set as hub branch"
}
```

---

## 11. Reports

### GET `/reports/daily-summary`
**Access:** 🔑 MGR, DIR  
Returns the daily sales summary for a branch.

**Query Params:**
```
date            (optional) — YYYY-MM-DD, defaults to today
organizationId  (optional, DIR only) — specify branch
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "date": "2026-02-22",
    "organizationName": "Wendo Kingz",
    "totalRevenue": "48500.00",
    "orderCount": 43,
    "ordersByType": {
      "DINE_IN": 28,
      "TAKE_AWAY": 11,
      "DELIVERY": 4
    },
    "revenueByPaymentMethod": {
      "MPESA": "35000.00",
      "CASH": "10500.00",
      "CARD": "3000.00"
    },
    "topItems": [
      { "name": "Cappuccino", "quantitySold": 38, "revenue": "13300.00" },
      { "name": "Chicken Burger", "quantitySold": 22, "revenue": "18700.00" },
      { "name": "Flat White", "quantitySold": 19, "revenue": "7220.00" },
      { "name": "Waffles", "quantitySold": 15, "revenue": "9750.00" },
      { "name": "Iced Latte", "quantitySold": 14, "revenue": "5600.00" }
    ],
    "averagePrepTimeMinutes": {
      "KITCHEN": 14,
      "BARISTA": 6
    }
  }
}
```

---

### GET `/reports/staff-performance`
**Access:** 🔑 MGR, DIR  
Returns staff performance metrics for a given period.

**Query Params:**
```
startDate       (required) — YYYY-MM-DD
endDate         (required) — YYYY-MM-DD
organizationId  (optional, DIR only) — specify branch
role            (optional) — WAITER | CHEF | BARISTA
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "period": { "startDate": "2026-02-01", "endDate": "2026-02-28" },
    "organizationName": "Wendo Kingz",
    "staff": [
      {
        "id": "uuid",
        "name": "James Kamau",
        "role": "WAITER",
        "ordersHandled": 284,
        "averageOrderValue": "1120.00",
        "scheduledHours": 160,
        "actualHours": 158.5
      },
      {
        "id": "uuid",
        "name": "Chef Maina",
        "role": "CHEF",
        "ordersHandled": 312,
        "averagePrepTimeMinutes": 13,
        "scheduledHours": 160,
        "actualHours": 161.0
      },
      {
        "id": "uuid",
        "name": "Barista Aisha",
        "role": "BARISTA",
        "ordersHandled": 298,
        "averagePrepTimeMinutes": 5,
        "scheduledHours": 160,
        "actualHours": 159.0
      }
    ]
  }
}
```

---

### GET `/reports/branch-overview`
**Access:** 🔑 DIR  
Returns aggregated performance across all branches. Director-only.

**Query Params:**
```
startDate   (required) — YYYY-MM-DD
endDate     (required) — YYYY-MM-DD
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "period": { "startDate": "2026-02-01", "endDate": "2026-02-28" },
    "totalRevenue": "2840000.00",
    "totalOrders": 2184,
    "branches": [
      {
        "id": "uuid",
        "name": "Wendo Kingz",
        "revenue": "1540000.00",
        "orderCount": 1180,
        "averagePrepTimeMinutes": { "KITCHEN": 13, "BARISTA": 6 }
      },
      {
        "id": "uuid",
        "name": "Wendo Town",
        "revenue": "1300000.00",
        "orderCount": 1004,
        "averagePrepTimeMinutes": { "KITCHEN": 15, "BARISTA": 7 }
      }
    ]
  }
}
```

---

### GET `/reports/branch-trends`
**Access:** 🔑 MGR, DIR  
Returns daily trend points for a single branch. Managers are scoped to their branch. Directors must pass `organizationId`.

**Query Params:**
```
startDate       (required) — YYYY-MM-DD
endDate         (required) — YYYY-MM-DD
organizationId  (optional, DIR only; required for DIR) — target branch id
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "period": { "startDate": "2026-02-01", "endDate": "2026-02-28" },
    "organizationId": "uuid",
    "organizationName": "Wendo Kingz",
    "points": [
      {
        "date": "2026-02-01",
        "orders": 42,
        "revenue": "48500.00",
        "avgPrepKitchen": 13,
        "avgPrepBarista": 6,
        "avgPrepCombined": 10
      }
    ]
  }
}
```

---

### GET `/reports/director-trends`
**Access:** 🔑 DIR  
Returns cross-branch trend analytics for directors.

**Query Params:**
```
startDate   (required) — YYYY-MM-DD
endDate     (required) — YYYY-MM-DD
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "period": { "startDate": "2026-02-01", "endDate": "2026-02-28" },
    "aggregateSeries": [
      { "date": "2026-02-01", "totalRevenue": "89000.00", "totalOrders": 77 }
    ],
    "branchRevenueSeries": [{ "id": "uuid", "name": "Wendo Kingz", "points": [{ "date": "2026-02-01", "value": 48500 }] }],
    "branchOrdersSeries": [{ "id": "uuid", "name": "Wendo Kingz", "points": [{ "date": "2026-02-01", "value": 42 }] }],
    "branchContributionSeries": [{ "id": "uuid", "name": "Wendo Kingz", "points": [{ "date": "2026-02-01", "value": 54.49 }] }],
    "itemFamilySeries": [{ "id": "Beverages", "name": "Beverages", "points": [{ "date": "2026-02-01", "value": 26100 }] }],
    "branches": [{ "id": "uuid", "name": "Wendo Kingz" }]
  }
}
```

---

### GET `/reports/director-pulse`
**Access:** 🔑 DIR
Returns a real-time snapshot of live operations across all active branches — active orders, prep tickets in flight, and clocked-in staff.

**Query Params:** None

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "asOf": "2026-03-08T07:45:12.000Z",
    "totalActiveOrders": 14,
    "totalClockedIn": 9,
    "branches": [
      {
        "id": "uuid",
        "name": "Wendo Kingz",
        "activeOrders": 8,
        "pendingTickets": 3,
        "inProgressTickets": 2,
        "clockedInCount": 5,
        "clockedInStaff": [
          { "name": "James Mwangi", "role": "WAITER" },
          { "name": "Alice Njeri", "role": "CHEF" }
        ]
      }
    ]
  }
}
```

**Notes:**
- `activeOrders` counts orders with status `PENDING`, `IN_PROGRESS`, or `READY` (not yet closed).
- `pendingTickets` / `inProgressTickets` count prep tickets at those statuses at that branch.
- `clockedInStaff` lists staff whose `clockInAt IS NOT NULL AND clockOutAt IS NULL` at that branch.
- Response is live — no caching applied.

---

### GET `/reports/export`
**Access:** 🔑 MGR, DIR  
Exports a report as PDF or CSV.

**Query Params:**
```
reportType      (required) — daily_summary | staff_performance | branch_overview
format          (required) — pdf | csv
startDate       (required) — YYYY-MM-DD
endDate         (required) — YYYY-MM-DD
organizationId  (optional, DIR only)
```

**Response `200`:**  
Returns a file download (`Content-Disposition: attachment`).

---

## Payslips

### POST `/payslips/bulk-upsert`

Creates or updates payroll rows for a single branch and pay period. The request body contains `payPeriod`, `organizationId`, and `rows`.

Each row accepts these money fields as decimal strings: `grossPay`, `paye`, `sha`, `nssfTier1`, `nssfTier2`, `housingLevy`, optional `helb`, optional `advance`, optional `incentives`, optional `overtime`, optional `allowances`, and optional `otherDeductions[]` entries with required `label` and `amount`.

The server ignores client-computed totals and computes:

```text
totalDeductions = paye + sha + nssfTier1 + nssfTier2 + housingLevy + helb + advance + sum(otherDeductions)
netPay = grossPay + incentives + overtime + allowances - totalDeductions
```

`advance` reduces pay. `incentives`, `overtime`, and `allowances` increase pay.

---

## 18. System Admin

### GET `/admin/organizations`
**Access:** 🔑 SA  
Returns all branches including inactive ones.

### POST `/admin/organizations`
**Access:** 🔑 SA  
Same as `POST /branches` — creates a new branch.

### POST `/admin/users`
**Access:** 🔑 SA  
Creates System Admin, Director, or Manager accounts. Same shape as `POST /staff`.

### GET `/admin/users`
**Access:** 🔑 SA  
Returns all users across all branches with no branch filter.

---

## 19. Health

### GET `/health`
**Access:** Public
Returns system health status. Used by the DigitalOcean deployment for uptime monitoring.

**Response `200`:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-22T09:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  },
  "uptime": 86400
}
```

**Response `503` (degraded):**
```json
{
  "status": "degraded",
  "timestamp": "2026-02-22T09:00:00Z",
  "services": {
    "database": "connected",
    "redis": "disconnected"
  }
}
```

---

## 20. WebSocket Events

WebSocket connection is established at: `wss://api.wendo-rms.co.ke`

Authentication is passed on connection:
```javascript
const socket = io('wss://api.wendorms.co.ke', {
  auth: { token: accessToken }
})
```

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `join:branch` | `{ organizationId }` | Client joins their branch room. Sent immediately after connect. |
| `join:station` | `{ organizationId, station }` | Client joins a station room (KDS/BDS). |
| `join:user` | `{ userId }` | Client joins their personal user room. |

### Server → Client Events

**Order Events**

| Event | Payload | Recipient |
|---|---|---|
| `order:new` | `PrepTicket` object | Station room (KDS/BDS) |
| `order:claimed` | `{ orderId, ticketId, station, dailyNumber, claimedBy: { id, name } }` | Waiter user room |
| `order:ready` | `{ orderId, ticketId, station, dailyNumber }` | Waiter user room |
| `order:all_ready` | `{ orderId, dailyNumber }` | Waiter user room |
| `order:paid` | `{ orderId, dailyNumber }` | Waiter user room |
| `order:modified` | Updated `PrepTicket` object | Affected station room |
| `order:cancelled` | `{ orderId }` | Station rooms |
| `order:force_cancelled` | `{ orderId }` | Waiter user room + station rooms |
| `order:cancellation_pending` | `{ orderId, authRequestId, dailyNumber, requestedById, reason }` | Branch room + waiter user room |
| `order:cancellation_resolved` | `{ orderId, authRequestId, action: "APPROVED"\|"REJECTED", restoredStatus? }` | Branch room + waiter user room |
| `ticket:rejected` | `{ orderId, ticketId, station, reason }` | Waiter user room |
| `ticket:unclaimed` | `{ orderId, ticketId, station }` | Waiter user room |
| `incident:new` | `{ id, type, orderId?, actor, details, createdAt }` | Branch room (managers) |

**Authorization Events (House Account, Discounts)**

| Event | Payload | Recipient |
|---|---|---|
| `order:auth_pending` | `{ orderId, authRequestId, type: "HOUSE_ACCOUNT", amount }` | Branch room + waiter user room |
| `order:auth_resolved` | `{ orderId, action: "APPROVED"\|"REJECTED" }` | Branch room + waiter user room |
| `order:staff_discount_pending` | `{ orderId, authRequestId, discountAmount }` | Branch room + waiter user room |
| `order:staff_discount_resolved` | `{ orderId, action: "APPROVED"\|"REJECTED" }` | Waiter user room |
| `order:customer_discount_pending` | `{ orderId, authRequestId, discountAmount }` | Branch room + waiter user room |
| `order:customer_discount_resolved` | `{ orderId, action: "APPROVED"\|"REJECTED" }` | Waiter user room |

**Internal Communications Events**

| Event | Payload | Recipient |
|---|---|---|
| `comms:dm_received` | `{ conversationId, message: { id, senderId, bodyHtml, createdAt } }` | Recipient user room |
| `comms:message_read` | `{ conversationId, messageId, readAt }` | Sender user room |
| `comms:broadcast_received` | `{ broadcastId, subject, senderName }` | Branch room or role room |
| `comms:broadcast_read` | `{ broadcastId, userId, readAt }` | Sender user room |
| `comms:broadcast_acknowledged` | `{ broadcastId, userId, acknowledgedAt }` | Sender user room |
| `comms:notice_received` | `{ noticeId, subject, issuerId }` | Recipient user room |
| `comms:notice_acknowledged` | `{ noticeId, userId, acknowledgedAt }` | Issuer user room |
| `comms:typing_start` | `{ conversationId, userId }` | Conversation participant user room |
| `comms:typing_stop` | `{ conversationId, userId }` | Conversation participant user room |

### Connection Error Handling

| Error | Cause | Client Behaviour |
|---|---|---|
| `connect_error` | Invalid token or server unavailable | Show offline banner, retry with exponential backoff |
| `disconnect` | Network loss | Show offline banner, auto-reconnect |
| `reconnect` | Connection restored | Re-fetch latest state via `GET /api/v1/sync`, dismiss banner |

---

---

## 12. Receipt Printing

### GET `/print/jobs`
**Access:** Print Station token (Bearer)
The Flutter print app polls this endpoint to claim a pending print job.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "receiptType": "RECEIPT",
    "copies": 1,
    "receiptData": { /* full receipt payload */ },
    "leaseExpiresAt": "2026-05-04T10:00:30Z"
  }
}
```

---

### PATCH `/print/jobs/:id/complete`
**Access:** Print Station token
Marks a print job as completed.

**Response `200`:**
```json
{ "success": true, "message": "Print job completed" }
```

---

### PATCH `/print/jobs/:id/fail`
**Access:** Print Station token
Marks a print job as failed with a reason.

**Request Body:**
```json
{ "reason": "Paper out" }
```

---

### POST `/print/stations`
**Access:** 🔑 MGR, SA
Registers a new print station for the branch.

**Request Body:**
```json
{ "name": "Front Counter Printer" }
```

**Response `201`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Front Counter Printer", "token": "unique-token-string" }
}
```

**Notes:**
- The `token` is returned only once at creation. The Flutter app uses it as a Bearer token.
- Triggering a print job happens automatically on order close (`POST /orders/:id/payment`).

---

## 13. Credit Accounts

### House Accounts

#### GET `/house-accounts`
**Access:** 🔑 MGR, DIR, ACCT, SA
Returns all house accounts. Managers see only their branch staff. Directors and Accountants see all.

#### GET `/house-accounts/my`
**Access:** 🔑 ALL (staff with a house account)
Returns the authenticated user's own house account (balance, limit, settlement history).

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "creditLimit": "5000.00",
    "currentBalance": "1200.00",
    "isActive": true,
    "requiresAuthorization": false,
    "settlements": [
      { "id": "uuid", "amount": "500.00", "note": "Cash repayment", "createdAt": "2026-04-01T09:00:00Z" }
    ]
  }
}
```

#### POST `/house-accounts`
**Access:** 🔑 DIR, SA
Creates a house account for a staff member.

**Request Body:**
```json
{
  "userId": "uuid",
  "creditLimit": 5000,
  "requiresAuthorization": false
}
```

#### PATCH `/house-accounts/:id`
**Access:** 🔑 DIR, SA
Updates credit limit, active status, or authorization requirement.

#### POST `/house-accounts/:id/settle`
**Access:** 🔑 MGR, ACCT, SA
Records a balance repayment (decrements `currentBalance`).

**Request Body:**
```json
{ "amount": 500, "note": "Cash repayment" }
```

---

### House Account Authorization

#### GET `/house-auth`
**Access:** 🔑 MGR, DIR
Returns pending House Account authorization requests for the branch. Each request's
`order` includes `items` (menu item name, quantity, notes) so approvers can see what
was ordered before deciding.

#### GET `/house-auth/:authRequestId`
**Access:** 🔑 MGR, DIR, WAITER
Fetches a specific auth request by ID (account holder or manager/director).

#### GET `/orders/:orderId/house-auth`
**Access:** 🔑 MGR, DIR, WAITER
Fetches the pending auth request for an order.

#### POST `/house-auth/:authRequestId/resolve`
**Access:** 🔑 MGR, DIR
Account holder approves or rejects their own pending charge.

#### POST `/house-auth/:authRequestId/override`
**Access:** 🔑 MGR, DIR
Manager/director overrides a pending House Account payment request.

**Request Body:**
```json
{ "action": "APPROVE" }
```

- On `APPROVE`: order is closed, `houseAccount.currentBalance` incremented atomically.
- On `REJECT`: order returns to `READY`, `PAYMENT_REJECTED` incident logged, waiter notified.

#### POST `/house-auth/:authRequestId/force-expire`
**Access:** 🔑 MGR, DIR
Force-expires a stuck authorization request. Escape hatch for genuinely expired orders.

---

### Corporate Accounts

#### GET `/corporate-accounts`
**Access:** 🔑 DIR, ACCT, SA
Returns all corporate accounts (system-level, not branch-scoped).

#### POST `/corporate-accounts`
**Access:** 🔑 DIR, SA
Creates a corporate account.

**Request Body:**
```json
{
  "companyName": "Safaricom Ltd",
  "contactName": "Jane Mwangi",
  "contactPhone": "+254712345678",
  "contactEmail": "jane@safaricom.co.ke",
  "creditLimit": 200000,
  "billingCycleDay": 1
}
```

#### PATCH `/corporate-accounts/:id`
**Access:** 🔑 DIR, SA
Updates a corporate account.

#### POST `/corporate-accounts/:id/settle`
**Access:** 🔑 DIR, ACCT, SA
Records a balance repayment.

**Request Body:**
```json
{ "amount": 50000, "note": "Monthly invoice settlement" }
```

---

### Customer Credit Accounts

#### GET `/customer-credit`
**Access:** 🔑 MGR, DIR, ACCT, SA
Returns customer credit accounts. Branch-scoped for managers; requires `?branchId=` for directors/accountants.

#### POST `/customer-credit`
**Access:** 🔑 MGR, SA
Creates a customer credit account for the manager's branch.

**Request Body:**
```json
{
  "customerName": "John Kamau",
  "customerPhone": "+254798765432",
  "creditLimit": 10000,
  "notes": "Regular customer"
}
```

#### PATCH `/customer-credit/:id`
**Access:** 🔑 MGR, SA
Updates a customer credit account.

#### POST `/customer-credit/:id/settle`
**Access:** 🔑 MGR, ACCT, SA
Records a balance repayment.

---

### Outstanding Balances Report

#### GET `/reports/outstanding-balances`
**Access:** 🔑 DIR, ACCT, SA
Returns a summary of all outstanding credit balances across all account types.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "houseAccounts": {
      "totalOutstanding": "8500.00",
      "accounts": [
        { "staffName": "James Kamau", "balance": "1200.00", "creditLimit": "5000.00" }
      ]
    },
    "corporateAccounts": {
      "totalOutstanding": "125000.00",
      "accounts": [
        { "companyName": "Safaricom Ltd", "balance": "125000.00", "creditLimit": "200000.00" }
      ]
    },
    "customerCreditAccounts": {
      "totalOutstanding": "3200.00",
      "accounts": [
        { "customerName": "John Kamau", "balance": "1500.00", "creditLimit": "10000.00", "branch": "Wendo Kingz" }
      ]
    }
  }
}
```

---

## 14. Other Income

### GET `/other-income/categories`
**Access:** 🔑 ALL (branch-scoped)
Returns active other-income categories available at the user's branch.

### POST `/other-income/categories`
**Access:** 🔑 DIR, SA
Creates a new other-income category.

**Request Body:**
```json
{
  "name": "Pool Table",
  "branchId": null
}
```
> `branchId: null` makes the category available at all branches.

### PATCH `/other-income/categories/:id`
**Access:** 🔑 DIR, SA
Updates a category (name, active status).

### GET `/other-income/entries`
**Access:** 🔑 WAITER, MGR, DIR, ACCT, SA
Returns other-income entries. Branch-scoped for managers/waiters; requires `?branchId=` for directors/accountants.

**Query Params:**
```
startDate   (optional) — YYYY-MM-DD
endDate     (optional) — YYYY-MM-DD
categoryId  (optional)
page        (optional, default 1)
perPage     (optional, default 20, max 100)
```

### POST `/other-income/entries`
**Access:** 🔑 WAITER, MGR, SA
Records a new other-income transaction.

**Request Body:**
```json
{
  "categoryId": "uuid",
  "amount": "500.00",
  "paymentMethod": "MPESA",
  "mpesaCode": "QK12345678",
  "description": "1 hour pool table",
  "entryDate": "2026-05-04"
}
```

> For split payments, set `paymentMethod: "SPLIT"` and include `mpesaAmount`, `cashAmount`/`cardAmount`, and `splitType`.

### DELETE `/other-income/entries/:id`
**Access:** 🔑 WAITER (same-day only), MGR, SA
Deletes an other-income entry. Waiters can only delete entries they recorded on the same calendar day.

---

## 15. Discounts

### Named Customer Discounts

#### GET `/discounts`
**Access:** 🔑 WAITER, MGR, DIR, SA (branch-scoped; returns branch discounts + system-level discounts)
Returns active discounts available at the user's branch.

#### POST `/discounts`
**Access:** 🔑 DIR, SA
Creates a named customer discount.

**Request Body:**
```json
{
  "name": "Birthday Special",
  "type": "PERCENTAGE",
  "value": "10.00",
  "requiresApproval": false,
  "organizationId": null
}
```
> `organizationId: null` = available at all branches. Pass a branch UUID to scope to one branch.

#### PATCH `/discounts/:id`
**Access:** 🔑 DIR, SA
Updates a discount (name, value, active status, approval requirement).

#### DELETE `/discounts/:id`
**Access:** 🔑 DIR, SA
Deactivates a discount.

---

### Customer Discount Authorization

#### GET `/customer-discount-auth`
**Access:** 🔑 MGR, DIR
Returns pending customer discount authorization requests for the branch.

#### POST `/customer-discount-auth/:id/resolve`
**Access:** 🔑 MGR, DIR
Approves or rejects a pending customer discount request.

**Request Body:**
```json
{ "action": "APPROVE" }
```

- On `APPROVE`: discount fields written to the order; order returns to `READY`.
- On `REJECT`: order returns to `READY`; no discount applied; waiter notified.

---

### Staff Discount Authorization

#### GET `/staff-discount-auth`
**Access:** 🔑 MGR, DIR
Returns pending staff discount (30%) authorization requests for the branch.

#### POST `/staff-discount-auth/:id/resolve`
**Access:** 🔑 MGR, DIR
Approves or rejects a pending staff discount request.

**Request Body:**
```json
{ "action": "APPROVE" }
```

**Notes:**
- Staff discount is always 30% of the order total.
- The waiter must be the order creator (system enforced — waiters can only request discount on their own orders).
- On approval: `discountPercent`, `discountAmount`, `discountedById` written to the order; order returns to `READY`.

---

## 16. Internal Communications

All comms endpoints are under the `/comms` prefix.

### Direct Messages

#### GET `/comms/conversations`
**Access:** 🔑 ALL
Returns the authenticated user's conversation list with last-message preview.

#### GET `/comms/conversations/:id/messages`
**Access:** 🔑 ALL (conversation participant only)
Returns paginated messages for a conversation.

**Query Params:**
```
page     (optional, default 1)
perPage  (optional, default 30)
```

#### POST `/comms/conversations`
**Access:** 🔑 ALL
Creates or opens a direct conversation with another user.

**Request Body:**
```json
{ "recipientId": "uuid" }
```

#### POST `/comms/conversations/:id/messages`
**Access:** 🔑 ALL (conversation participant only)
Sends a message in a conversation. Emits `comms:dm_received` via Socket.io.

**Request Body:**
```json
{ "bodyHtml": "<p>Good morning!</p>" }
```

#### DELETE `/comms/messages/:id`
**Access:** 🔑 ALL (sender only)
Soft-deletes a sent message.

---

### Broadcasts

#### GET `/comms/broadcasts`
**Access:** 🔑 ALL
Returns broadcasts the authenticated user has received.

#### POST `/comms/broadcasts`
**Access:** 🔑 MGR, DIR, SA
Sends a broadcast. Recipients are materialized at send time.

**Request Body:**
```json
{
  "scope": "ROLE_GROUP",
  "targetRole": "WAITER",
  "subject": "Shift reminder",
  "bodyHtml": "<p>Please arrive 15 minutes early tomorrow.</p>",
  "requiresAck": false
}
```

> `scope` values: `COMPANY` (DIR only — all branches), `BRANCH`, `ROLE_GROUP`.

#### POST `/comms/broadcasts/:id/read`
**Access:** 🔑 ALL
Marks a broadcast as read for the authenticated user.

#### POST `/comms/broadcasts/:id/acknowledge`
**Access:** 🔑 ALL
Acknowledges a broadcast (only valid when `requiresAck = true`).

#### GET `/comms/broadcasts/:id/delivery`
**Access:** 🔑 MGR, DIR, SA
Returns the delivery/read/acknowledge status for all recipients of a broadcast.

---

### Formal Notices

#### GET `/comms/notices`
**Access:** 🔑 ALL
Returns formal notices the authenticated user has received.

#### POST `/comms/notices`
**Access:** 🔑 HR, MGR, DIR, SA
Issues a formal notice requiring acknowledgement.

**Request Body:**
```json
{
  "recipientIds": ["uuid", "uuid"],
  "subject": "Written Warning — Attendance",
  "bodyHtml": "<p>This formal notice confirms...</p>"
}
```

#### POST `/comms/notices/:id/acknowledge`
**Access:** 🔑 ALL (recipient only)
Acknowledges a formal notice.

**Notes:**
- BullMQ jobs schedule 24h and 48h reminder FCM push notifications to unacknowledged recipients.
- Escalation timestamps (`reminder24SentAt`, `escalation48SentAt`) are recorded on `FormalNoticeRecipient`.

#### GET `/comms/notices/:id/delivery`
**Access:** 🔑 HR, MGR, DIR, SA
Returns the acknowledgement status for all recipients of a formal notice.

---

## 17. HR Module

All HR endpoints are under the `/hr` prefix.

### Employee Profiles

#### GET `/hr/profiles`
**Access:** 🔑 HR, MGR, DIR, SA
Returns employee profiles. Managers see only their branch. HR, Directors, SA see all.

**Query Params:**
```
organizationId  (optional, HR/DIR/SA) — filter by branch
isActive        (optional)            — true | false
```

#### GET `/hr/profiles/:userId`
**Access:** 🔑 HR, MGR, DIR, SA (own profile also accessible to the employee)
Returns a single employee profile with leave balances and disciplinary summary.

#### POST `/hr/profiles`
**Access:** 🔑 HR, MGR, SA
Creates an employee profile for an existing user account.

**Request Body:**
```json
{
  "userId": "uuid",
  "employmentType": "FULL_TIME",
  "startDate": "2026-01-10",
  "jobTitle": "Senior Waiter",
  "nationalId": "12345678",
  "probationEndDate": "2026-04-10",
  "emergencyName": "Mary Kamau",
  "emergencyRelation": "Mother",
  "emergencyPhone": "+254712345678"
}
```

> Creating a profile auto-seeds `LeaveBalance` records for each `LeaveType` for the current year.

#### PATCH `/hr/profiles/:userId`
**Access:** 🔑 HR, MGR, SA
Updates an employee profile.

---

### Leave Management

#### GET `/hr/leave/requests`
**Access:** 🔑 HR, MGR, DIR, SA
Returns leave requests. Managers see only their branch; HR/Director see all.

**Query Params:**
```
status                   (optional) — PENDING | APPROVED | REJECTED | CANCELLED
organizationId            (optional, HR/DIR/SA)
resolvedSinceDays         (optional) — only include resolved (APPROVED/REJECTED) requests
                          reviewed in the last N days; PENDING requests are always included
excludeAcknowledgedByMe   (optional, boolean) — exclude requests the caller has already
                          acknowledged via POST /hr/leave/requests/:id/acknowledge
```

#### POST `/hr/leave/requests/:id/acknowledge`
**Access:** 🔑 HR, MGR, DIR, SA
Marks a resolved leave request as seen/dismissed by the caller (per-user, persisted in
the database). Used by dashboard widgets so old decisions don't pile up indefinitely.

#### POST `/hr/leave/requests/acknowledge-all`
**Access:** 🔑 HR, MGR, DIR, SA
Acknowledges every currently resolved (APPROVED/REJECTED) leave request in the caller's
scope in one call — backs the "Clear all" action on dashboard widgets.

#### GET `/hr/leave/requests/mine`
**Access:** 🔑 ALL
Returns the authenticated user's own leave requests and current leave balances.

#### POST `/hr/leave/requests`
**Access:** 🔑 ALL (staff apply for own leave)
Submits a leave request.

**Request Body:**
```json
{
  "leaveType": "ANNUAL",
  "startDate": "2026-06-01",
  "endDate": "2026-06-07",
  "reason": "Family vacation"
}
```

**Validation Rules:**
- `startDate` must not be in the past.
- `totalDays` is calculated server-side (working days Mon–Fri only).
- Available balance must cover the request; insufficient balance returns `409`.

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "leaveType": "ANNUAL",
    "startDate": "2026-06-01",
    "endDate": "2026-06-07",
    "totalDays": 5,
    "status": "PENDING"
  }
}
```

#### PATCH `/hr/leave/requests/:id/review`
**Access:** 🔑 HR, MGR, SA
Approves or rejects a leave request.

**Request Body:**
```json
{ "action": "APPROVE", "reviewComment": "Approved. Enjoy your vacation." }
```

- On `APPROVE`: `leaveBalance.pendingDays` decremented, `usedDays` incremented. FCM notification sent to staff.
- On `REJECT`: `leaveBalance.pendingDays` decremented (days returned). FCM notification sent to staff.

#### PATCH `/hr/leave/requests/:id/cancel`
**Access:** 🔑 ALL (own pending request only)
Cancels a pending leave request. Returns reserved days to available balance.

#### GET `/hr/leave/calendar`
**Access:** 🔑 MGR, HR, DIR, SA
Returns a monthly grid of approved leave for a branch (for scheduling reference).

**Query Params:**
```
year            (required)
month           (required, 1–12)
organizationId  (optional, HR/DIR/SA)
```

---

### Disciplinary Records

#### GET `/hr/disciplinary`
**Access:** 🔑 HR, MGR, DIR, SA
Returns disciplinary records. Managers see only their branch.

**Query Params:**
```
userId          (optional) — filter by staff member
organizationId  (optional, HR/DIR/SA)
```

#### POST `/hr/disciplinary`
**Access:** 🔑 HR, MGR, SA
Creates a disciplinary record. Sends an FCM push notification to the employee.

**Request Body:**
```json
{
  "employeeProfileId": "uuid",
  "incidentDate": "2026-04-28",
  "actionDate": "2026-04-29",
  "category": "ATTENDANCE",
  "description": "Staff was 45 minutes late without prior notification.",
  "actionTaken": "WRITTEN_WARNING",
  "outcome": "Formal written warning issued.",
  "expiresAt": "2026-10-29"
}
```

#### PATCH `/hr/disciplinary/:id/acknowledge`
**Access:** 🔑 ALL (subject of the record only)
Records the employee's acknowledgement of the disciplinary record.

---

### HR Documents

#### GET `/hr/documents`
**Access:** 🔑 HR, MGR, DIR, SA
Returns HR documents for an employee profile.

**Query Params:**
```
employeeProfileId  (required)
documentType       (optional)
```

#### POST `/hr/documents/upload`
**Access:** 🔑 HR, MGR, SA
Uploads an HR document to Cloudinary and creates the `HrDocument` record.

**Request:** `multipart/form-data`
```
field: file              (PDF, JPG, PNG — max 10 MB)
field: employeeProfileId (uuid)
field: documentType      (CONTRACT | ID_COPY | CERTIFICATE | MEDICAL_CERTIFICATE | INCIDENT_REPORT | WARNING_LETTER | OTHER)
field: leaveRequestId    (optional uuid)
field: disciplinaryRecordId (optional uuid)
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fileName": "contract_james_kamau.pdf",
    "fileUrl": "https://res.cloudinary.com/...",
    "documentType": "CONTRACT"
  }
}
```

---

### Attendance Analytics

#### GET `/hr/attendance`
**Access:** 🔑 HR, MGR, DIR, SA
Returns attendance analytics for a branch over a date range.

**Query Params:**
```
startDate       (required) — YYYY-MM-DD
endDate         (required) — YYYY-MM-DD
organizationId  (optional, HR/DIR/SA) — target branch
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "period": { "startDate": "2026-04-01", "endDate": "2026-04-30" },
    "staff": [
      {
        "userId": "uuid",
        "name": "James Kamau",
        "role": "WAITER",
        "scheduledDays": 22,
        "presentDays": 21,
        "lateDays": 2,
        "absentDays": 1,
        "attendanceRate": "95.5%"
      }
    ]
  }
}
```

> Late threshold: clock-in more than 15 minutes after `Shift.startTime` = marked as late.

#### GET `/hr/attendance/export`
**Access:** 🔑 HR, MGR, DIR, SA
Exports the attendance report as CSV.

---

### Staff Transfers

#### GET `/staff-transfers`
**Access:** 🔑 DIR, SA
Returns all staff transfer records.

#### POST `/staff-transfers`
**Access:** 🔑 DIR, SA
Transfers a staff member to another branch. Updates the user's `organizationId` and creates an audit `StaffTransfer` record.

**Request Body:**
```json
{
  "userId": "uuid",
  "toOrganizationId": "uuid",
  "notes": "Temporarily covering staffing shortage at Town branch"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "fromOrganizationId": "uuid",
    "toOrganizationId": "uuid",
    "transferredAt": "2026-05-04T08:00:00Z"
  },
  "message": "Staff transferred successfully"
}
```

---

## Order Correction Console (SYSTEM_ADMIN)

All endpoints require `Authorization: Bearer <token>` with `role: SYSTEM_ADMIN`. Every write operation atomically appends an `IncidentLog` row with `type: ORDER_CORRECTION`. Corrections on orders older than 7 days are rejected with `409`.

---

### GET `/admin/order-corrections`

Returns paginated list of orders across **all branches** (no organizationId filter — cross-branch view for SYSTEM_ADMIN).

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `branchId` | UUID (optional) | Filter by branch |
| `status` | string (optional) | Filter by order status |
| `dateFrom` | YYYY-MM-DD (optional) | Start date filter |
| `dateTo` | YYYY-MM-DD (optional) | End date filter |
| `search` | string (optional) | Free-text search (max 100 chars) |
| `page` | number (default 1) | Page number |
| `perPage` | number (default 50, max 100) | Results per page |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "uuid",
        "dailyNumber": 42,
        "orderDate": "2026-05-14",
        "type": "DINE_IN",
        "status": "CLOSED",
        "tableNumber": "5",
        "paymentMethod": "MPESA",
        "mpesaCode": "QKA123XY",
        "total": "700.00",
        "createdAt": "2026-05-14T10:00:00Z",
        "closedAt": "2026-05-14T11:30:00Z",
        "organizationId": "uuid",
        "organizationName": "Wendo Nyeri Central",
        "createdByName": "Waiter One"
      }
    ],
    "pagination": { "total": 1, "page": 1, "perPage": 50, "totalPages": 1 }
  }
}
```

---

### GET `/admin/order-corrections/:id`

Returns full order detail including items, prep tickets, and pending auth request ID.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "dailyNumber": 42,
    "status": "CLOSED",
    "paymentMethod": "MPESA",
    "mpesaCode": "QKA123XY",
    "subtotal": "700.00",
    "deliveryFee": "0.00",
    "total": "700.00",
    "items": [
      { "id": "uuid", "menuItemId": "uuid", "name": "Latte", "quantity": 2, "unitPrice": "350.00", "subtotal": "700.00", "notes": null }
    ],
    "prepTickets": [
      { "id": "uuid", "station": "BARISTA", "status": "READY", "sequence": 1 }
    ],
    "pendingAuthRequestId": null
  }
}
```

---

### GET `/admin/order-corrections/:id/audit-log`

Returns all `ORDER_CORRECTION` incident log entries for this order.

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "ORDER_CORRECTION",
      "actor": { "id": "uuid", "name": "System Admin" },
      "details": {
        "action": "CORRECT_MPESA_CODE",
        "field": "mpesaCode",
        "before": "QKA000YY",
        "after": "QKA123XY",
        "reason": "Customer provided correct code"
      },
      "createdAt": "2026-05-14T12:00:00Z"
    }
  ]
}
```

---

### PATCH `/admin/order-corrections/:id/mpesa-code`

Corrects the M-Pesa transaction code on a **CLOSED** order paid by MPESA, SPLIT, or GUEST_SPLIT.

**Request body**
```json
{ "mpesaCode": "QKA123XY", "reason": "Customer provided correct code (min 10 chars)" }
```

**Errors**: `409` if not CLOSED, not an M-Pesa payment, or older than 7 days.

---

### PATCH `/admin/order-corrections/:id/payment-method`

Changes the recorded payment method on a **CLOSED** order.

**Request body**
```json
{ "paymentMethod": "CASH", "reason": "Payment method was recorded incorrectly (min 10 chars)" }
```

**Valid values**: Any `PaymentMethod` enum value.  
**Errors**: `400` if new method equals current; `409` if not CLOSED or older than 7 days.

---

### POST `/admin/order-corrections/:id/force-ready`

Forces an **IN_PROGRESS** order to **READY** when a ghost rejected prep ticket is blocking automatic transition.

**Guard**: Order must be IN_PROGRESS; at least one ticket must be REJECTED; all non-REJECTED tickets must already be READY.

**Request body**
```json
{ "reason": "Ghost rejected ticket confirmed by kitchen; all items done (min 10 chars)" }
```

**Errors**: `409` if guard conditions not met or older than 7 days.

---

### POST `/admin/order-corrections/:id/revert-auth`

Reverts an **AWAITING_AUTHORIZATION** order to **READY** by deleting the pending house account auth request.

**Guard**: Order must be AWAITING_AUTHORIZATION and have a pending `HouseAccountAuthRequest`.

**Request body**
```json
{ "reason": "Customer will pay cash; house account auth cancelled (min 10 chars)" }
```

**Errors**: `409` if not in correct state, no pending auth request, or older than 7 days.

---

### POST `/admin/order-corrections/:id/tickets/:ticketId/revert-rejected`

Reverts a **REJECTED** prep ticket back to **PENDING** so the kitchen/barista station can re-attempt it. The station display is notified immediately via the `ticket:unclaimed` socket event.

**Guard**: The ticket must belong to the order and have status `REJECTED`.

**Request body**
```json
{ "reason": "Barista accidentally rejected the ticket; please re-attempt (min 10 chars)" }
```

**Errors**: `404` if the ticket is not found on the order; `409` if the ticket is not REJECTED or the order is older than 7 days.

---

### PATCH `/admin/order-corrections/:id/items/:itemId/remove`

Removes an item from the order and recalculates `subtotal` and `total` atomically.

**Guards**: Order must not be CANCELLED or PENDING; cannot remove the last item.

**Request body**
```json
{ "reason": "Item added by mistake; customer refused to pay (min 10 chars)" }
```

**Errors**: `409` if order is CANCELLED or last item; `404` if item not on order; `409` if older than 7 days.

---

### PATCH `/admin/order-corrections/:id/total`

Manually adjusts the order total (last-resort correction, e.g. post-close manager discount).

**Guards**: Order must not be CANCELLED. `newTotal` must be ≥ 0.

**Request body**
```json
{ "newTotal": 500.00, "reason": "Manager approved post-close discount (min 10 chars)" }
```

**Errors**: `400` if newTotal negative; `409` if CANCELLED or older than 7 days.

---

*This API Contract is the authoritative reference for all frontend-backend communication in Wendo RMS. Every endpoint reflects the data model, business rules, and architectural decisions defined in the PRD, Data Model, and TDD. Any new endpoint or change to an existing one must be documented here before implementation.*


---

## 21. Inventory — Milestone One (Catalog, Suppliers & Restock Levels)

> **STATUS: FROZEN — 2026-09-15.**
> Frozen per `docs/FEATURE_REDO_PLAYBOOK.md` Step 6, following owner approval of
> `docs/features/inventory/milestone-1-plan.md`. Backend and frontend build sessions run
> in parallel against this contract.
>
> **Amendment process (playbook Step 6):** if a build session finds the contract
> wrong, **all affected sessions stop**, the owner approves the amendment, then
> sessions resume. A session must never edit the contract unilaterally to unblock
> itself. Expect at least one amendment per feature — it is not a failure.

### 21.1 Source of truth

The contract is **committed code**, not this prose. This section is the index.

| | |
|---|---|
| **Schemas (authoritative)** | `backend/src/modules/inventory/inventory-validators.ts` |
| **Types (inferred from schemas)** | `backend/src/modules/inventory/inventory.types.ts` |
| **Frontend mirror** | `frontend/features/inventory/types/index.ts` — hand-mirrored; a backend contract test guards drift. (Corrected 2026-09-16 — this row previously pointed at `frontend/types/inventory.ts`, which is the *legacy* Phase 1 file, trimmed but never removed; it never held the Milestone One mirror.) |
| **Design** | Paper page `B-0`, file `01M1ZZJ6S3FZGF5C7PPBGTKY89` |
| **Plan** | `docs/features/inventory/milestone-1-plan.md` §5 |

There is no pnpm workspace in this repo, so there is no shared package to import
from — hence the mirror plus drift test. A proper shared package is booked as a
follow-up task after Milestone One ships (plan §8.2 q5).

### 21.2 Conventions specific to this contract

- Standard envelope (§1) unchanged.
- **Every decimal crosses the wire as a string** — quantities, conversion
  factors, pack sizes, costs, restock levels. Never a JS number; Prisma stores
  them as `Decimal` and coercing loses precision.
- Soft delete is `retiredAt` on the wire (`deletedAt` in the database). There is
  no hard delete on any resource in this milestone.
- All routes are under `/api/v1/inventory/…` — namespaced, and deliberately not
  colliding with the legacy flat `/inventory-items` and `/suppliers` routes
  during the transition.

### 21.3 Endpoints

All routes carry `authenticate` + `requireRole`. All inputs are Zod-validated.
`SM` = `STORE_MANAGER`, `SA` = `STORE_ATTENDANT`, `DH` = `DEPARTMENT_HEAD`,
`ACC` = `ACCOUNTANT`, `DIR` = `DIRECTOR`.

| Method | Path | Roles |
|---|---|---|
| `GET` | `/inventory/central-store-location` | SM |
| `GET` | `/inventory/categories` | SM, SA |
| `POST` | `/inventory/categories` | SM |
| `PATCH` | `/inventory/categories/:id` | SM |
| `DELETE` | `/inventory/categories/:id` | SM |
| `POST` | `/inventory/categories/:id/restore` | SM |
| `GET` | `/inventory/items` | SM, SA |
| `GET` | `/inventory/items/:id` | SM, SA |
| `POST` | `/inventory/items` | SM |
| `PATCH` | `/inventory/items/:id` | SM |
| `DELETE` | `/inventory/items/:id` | SM |
| `POST` | `/inventory/items/:id/restore` | SM |
| `GET` | `/inventory/suppliers` | SM, ACC, DIR |
| `GET` | `/inventory/suppliers/:id` | SM, ACC, DIR |
| `POST` | `/inventory/suppliers` | SM |
| `PATCH` | `/inventory/suppliers/:id` | SM |
| `DELETE` | `/inventory/suppliers/:id` | SM |
| `POST` | `/inventory/suppliers/:id/restore` | SM |
| `GET` | `/inventory/restock-levels` | SM, DH |
| `PUT` | `/inventory/restock-levels` | SM, DH |

Request/response shapes: see the schema file. Full rationale per endpoint,
including role reasoning and the D-15 scoping rule applied to each: plan §5.3.

### 21.4 Behaviours that are contract, not implementation detail

These are easy to "fix" into something more conventional and wrong. They are
specified:

1. **A duplicate item name returns `200` with a `warnings` array — it does not
   fail.** Flow 18: *"warned; allowed only with a distinguishing qualifier."*
   Create/update responses use the `ItemMutationResponse` envelope for this.
2. **A raw ingredient may never carry department tags** — rejected at the Zod
   layer with a field-level message on `departmentTags`, at the service layer,
   and by a database `CHECK` constraint. All three; the DB layer is what makes
   it a data rule rather than a convention.
3. **`PUT /inventory/restock-levels` is a bulk, atomic upsert**, not one request
   per row — both restock screens are a single "Save restock levels" button over
   many edited rows. `level: null` clears a row.
4. **`onHandQty` is derived live from the ledger on every read, never stored,
   and may be negative.** Negative stock is allowed and flagged, never blocked.
5. **`conversionFactor` and `packSize` are nullable** — "no conversion" and "—"
   are real, drawn states, not missing data.
6. **`categoryName` may be sent instead of `categoryId`** to create a category
   inline, in the same transaction. Exactly one of the two.

### 21.5 Amendments since freeze

- **2026-09-15 (backend build session).** `UpdateSupplierSchema` was built as
  `CreateSupplierSchema.partial()`, which kept `defaultPaymentTerms`'s
  `.default('INVOICE_TO_FOLLOW')` — Zod's `.partial()` makes fields optional
  to *provide*, it does not strip defaults. Any partial `PATCH
  /inventory/suppliers/:id` body, even one that never mentions
  `defaultPaymentTerms`, silently injected the default and overwrote a
  supplier's real terms (e.g. `PAY_NOW`) back to `INVOICE_TO_FOLLOW`. Found
  while writing the integration tests (a plain `{}` PATCH body should have
  been rejected by the "at least one field" refine but instead passed, since
  the injected default counted as a provided field). Fixed by rewriting
  `UpdateSupplierSchema` as its own object with every field genuinely
  optional (no inherited defaults), same fields and validation rules
  otherwise. No other endpoint's schema shares this pattern. Owner-approved
  during the session; the frontend session should treat `UpdateSupplierInput`
  as: send only the fields being changed, and `defaultPaymentTerms` is never
  implicitly reset.

- **2026-09-15 (integration — real backend wiring).** `GET
  /inventory/central-store-location` added. The frozen contract required the
  client to already know the Central Store's `locationId` (needed by both
  restock-level endpoints for a Store Manager caller — a Department Head's own
  department is resolved server-side instead), but gave it no way to look that
  id up: not in the JWT, not on the user profile, no locations endpoint in
  scope. Found when the frontend session swapped from the mock service to the
  real backend. `Location` itself is unchanged by this milestone (plan §1.3) —
  this is a minimal, read-only lookup against it, not a new resource. Response:
  `{ id: string }` (`CentralStoreLocationSchema`). Store-Manager-only,
  hub-scoped (D-15) — 404 if no Central Store is configured for the hub org.
  Owner-approved during the session.

---

## 22. Inventory — Milestone Two (Receiving & Supplier AP)

> **STATUS: SHIPPED — 2026-09-18** (deployed to production 2026-09-19).
> Frozen 2026-09-16 per `docs/FEATURE_REDO_PLAYBOOK.md` Step 6, following owner
> approval of `docs/features/inventory/milestone-2-plan.md` and resolution of
> all six of its §7 open questions. Backend and frontend build sessions
> (S3–S8) ran against this contract, then S9 integration testing (a real
> end-to-end browser walkthrough plus an owner manual walkthrough) found and
> fixed several service-layer bugs without changing any shape below — see
> `docs/features/inventory/milestone-2-plan.md` §5's S9 row for detail.
>
> **AMENDMENT 2026-09-16 (post-freeze, during S3):** `PurchasingHistoryRowSchema`
> added — `GET /inventory/purchasing/history`'s response shape was missed at
> freeze time. See §22.3 below.
>
> **AMENDMENT 2026-09-17 (New purchase redesign):** supplier becomes optional
> on an expected delivery (`CreateExpectedDeliverySchema.supplierId`/
> `paymentTerms`, `ExpectedDeliverySummarySchema.supplierId`/`supplierName`/
> `paymentTerms`). See §22.5 below.

### 22.1 Source of truth

The contract is **committed code**, not this prose. This section is the index.

| | |
|---|---|
| **Schemas (authoritative)** | `backend/src/modules/inventory/receiving-validators.ts` |
| **Types (inferred from schemas)** | `backend/src/modules/inventory/receiving.types.ts` |
| **Frontend mirror** | `frontend/features/inventory/types/receiving.ts`, re-exported from `frontend/features/inventory/types/index.ts` — hand-mirrored, same as Milestone One (no pnpm workspace, so no shared package to import from) |
| **Design** | Paper page `C-0` ("Milestone Two · Receiving & Supplier AP"), file `01M1ZZJ6S3FZGF5C7PPBGTKY89` |
| **Plan** | `docs/features/inventory/milestone-2-plan.md` §3 |
| **Migration** | `backend/prisma/migrations/20260916031604_inventory_milestone_two_receiving_ap` |

### 22.2 Conventions specific to this contract

- Standard envelope (§1) unchanged.
- **Every decimal crosses the wire as a string** — quantities, unit prices,
  line totals, invoice/payment amounts, outstanding balances. Never a JS
  number; Prisma stores them as `Decimal` and coercing loses precision.
- **Terminology: user-facing labels say "what we owe" / "how overdue", never
  "AP" / "aging"** (owner decision 2026-09-16 — those are accountant's terms,
  not the product's). Schema/type/field names stay technical
  (`SupplierApRow`, `/inventory/ap/…`) since those are never user-facing;
  only display copy at the component layer follows the plain-language rule.
- All routes are under `/api/v1/inventory/…`, alongside Milestone One's.
- `STORE_ATTENDANT` gets a **narrower response shape**, not a hidden UI
  element, on any endpoint touching money: `ExpectedDeliverySummary.
  estimatedTotal` is `null` in an Attendant's response, not merely omitted
  client-side. `STORE_ATTENDANT` is 403'd outright on every what-we-owe
  endpoint (invoices, payments, aging).

### 22.3 Endpoints

All routes carry `authenticate` + `requireRole`. All inputs are Zod-validated.
`SM` = `STORE_MANAGER`, `SA` = `STORE_ATTENDANT`, `ACC` = `ACCOUNTANT`,
`DIR` = `DIRECTOR`.

| Method | Path | Roles |
|---|---|---|
| `GET` | `/inventory/purchasing/summary` | SM, SA, ACC, DIR |
| `GET` | `/inventory/expected-deliveries` | SM, SA, ACC, DIR |
| `GET` | `/inventory/expected-deliveries/:id` | SM, SA, ACC, DIR |
| `POST` | `/inventory/expected-deliveries` | SM |
| `POST` | `/inventory/expected-deliveries/:id/cancel` | SM |
| `GET` | `/inventory/purchasing/history` | SM, SA, ACC, DIR |
| `GET` | `/inventory/goods-receipts` | SM, SA |
| `GET` | `/inventory/goods-receipts/:id` | SM, SA |
| `POST` | `/inventory/goods-receipts` | SM, SA |
| `PATCH` | `/inventory/goods-receipts/:id` | SM, SA |
| `POST` | `/inventory/goods-receipts/:id/sign` | SM, SA |
| `GET` | `/inventory/items/:id/last-price` | SM, SA |
| `GET` | `/inventory/ap/summary` | SM, ACC, DIR |
| `GET` | `/inventory/ap/suppliers` | SM, ACC, DIR |
| `GET` | `/inventory/ap/suppliers/:id` | SM, ACC, DIR |
| `POST` | `/inventory/supplier-invoices` | SM |
| `POST` | `/inventory/supplier-invoices/:id/adjustments` | SM, ACC |
| `POST` | `/inventory/supplier-payments` | SM, ACC |
| `POST` | `/inventory/supplier-payments/:id/reverse` | SM, ACC |

`STORE_ATTENDANT` is deliberately absent from every `ap/`, `supplier-invoices`,
and `supplier-payments` row — not an oversight (§22.2). Request/response
shapes: see the schema file. Full rationale per endpoint, including the
mismatch/dispute and overpayment/credit branches: plan §3.2.

**`GET /inventory/purchasing/history` response — `PurchasingHistoryRowSchema`,**
a discriminated union on `type` (`expectedDelivery` | `goodsReceipt`, matching
`purchasing-history-row.tsx`'s existing prop shape verbatim — the UI component
was built first and isn't re-diffed to match a server-picked casing). Each row
is pre-formatted for direct rendering (`detailLabel`, `statusLabel`,
`statusTone`, two `actions`), not raw record fields — the service, not the
component, owns turning an `ExpectedDelivery`/`GoodsReceipt` into display copy.
S3 emits only `expectedDelivery` rows for real (no `GoodsReceipt` rows exist
until S4); the `goodsReceipt` variant is declared now so S4 only adds to it.

### 22.4 Behaviours that are contract, not implementation detail

1. **A Goods Receipt's ledger write happens exactly once, at signing** — never
   on create or edit of a `DRAFT`. `POST /goods-receipts` and
   `PATCH /goods-receipts/:id` never touch `InventoryTransaction`;
   `POST /goods-receipts/:id/sign` is the only endpoint that does, inside one
   `prisma.$transaction` (plan §1.6).
2. **The price-alert comparison price is a snapshot, not a live join.**
   `GoodsReceiptLine.priceAlertPrevPrice` is written at signing and never
   recomputed — by the time a signed receipt is read back,
   `InventoryItem.currentCost` has already moved on to a later price (plan
   §1.2). Don't "simplify" this into a join against `InventoryItem` later;
   it will silently change what a signed, printed document says.
   **Cost units:** on signing, `InventoryItem.currentCost` and the RECEIVE
   ledger row's `unitCost` are written **per usage unit**
   (`unitPrice ÷ conversionFactor`); the receipt line's `unitPrice`, its
   `lineTotal` and the price-alert comparison stay **per buy unit**. Every
   `currentCost` / `unitCost` field elsewhere in this contract is per usage
   unit.
3. **Receipt↔invoice is many-to-many.** One invoice may bundle several
   receipts (`SupplierInvoiceReceipt`); `CreateSupplierInvoiceInput.
   goodsReceiptIds` takes an array, not a single id.
4. **"Record at billed — open dispute" and plain "Save invoice" are the same
   endpoint.** `CreateSupplierInvoiceInput.dispute` is optional on
   `POST /supplier-invoices`; there is no separate dispute-invoice endpoint.
   "Hold" (the third option on the mismatch callout) calls nothing at all.
5. **Dispute is independent of payment status, not a value within it.**
   `SupplierInvoice.status` (`UNPAID`/`PARTIALLY_PAID`/`PAID`) and
   `SupplierInvoice.dispute.status` (`OPEN`/`RESOLVED`) vary independently —
   a disputed invoice still ages and can still be paid (Flow 17a). Don't
   collapse these into one enum; a disputed-and-partly-paid invoice needs to
   be representable.
6. **Overpayment is allowed, not an error, and is never a stored balance.**
   `CreateSupplierPaymentInput.allocations` may sum to less than `amount`;
   the excess is a derived credit (`Σ payments.amount − Σ allocations.
   amount`), never a `creditBalance` column (plan §1.4, §1.5).
7. **Payments are immutable — a correction is a reversal, never an edit.**
   `POST /supplier-payments/:id/reverse` creates a new payment with
   `reversalOfId` set and a negative allocation; there is no
   `PATCH /supplier-payments/:id`.
8. **`dueDate` is computed once, at invoice creation, and stored** — as
   `invoiceDate + Supplier.paymentDays`. A later change to
   `Supplier.paymentDays` must never retroactively shift the due date, or
   status, of an invoice already recorded (plan §1.3, §7 Q3(b)).
9. **Aging buckets are always the same five** — `current`, `days1To30`,
   `days31To60`, `days61To90`, `days90Plus` (`AgingBucketsSchema`). Any
   screen showing fewer merges buckets for display; the underlying
   calculation and the wire shape are never four-bucket (plan §7 Q4).
10. **The `IN TRANSIT` KPI does not exist in this contract.** Dropped, not
    deferred (plan §7 Q1) — `PurchasingSummarySchema` has three tiles.
11. **The Flow 17 reconciliation workspace is out of scope.** The adjustment
    endpoint (`POST /supplier-invoices/:id/adjustments`) exists so a dispute
    opened by Flow 14 has somewhere to close, but there is no
    statement-import or matching endpoint this milestone (plan §7 Q6).

### 22.5 Amendments since freeze

> **AMENDMENT 2026-09-18 (owner feedback during S8 manual walkthrough):
> `GET /inventory/ap/suppliers` no longer excludes suppliers with zero
> invoices.** `supplierApRepository.findSuppliersWithInvoices` previously
> filtered to `supplierInvoices: { some: {} }` — a brand-new supplier
> (created via "New supplier" on this same screen) never appeared in the
> how-overdue table, which the owner found while testing and reasonably
> read as "the app didn't save it." Not a caching bug — the query itself
> excluded it by design. Fixed by dropping that filter (now `deletedAt:
> null` only, matching the rest of this module's soft-delete convention). A
> supplier with no invoices now returns a genuine zero row (every bucket
> "–", outstanding 0) rather than being silently omitted — derived from
> real (empty) data, not faked. No schema change — `SupplierApRowSchema`
> already tolerates zero amounts everywhere.

> **AMENDMENT 2026-09-18 (S8, Suppliers/Supplier-detail frontend build session):
> three gaps closed in the contract before the frontend could build to plan
> §0's stated scope.**
>
> 1. **`SupplierSchema` gains `paymentDays: number`.** A real `Supplier`
>    column since migration `20260916031604_inventory_milestone_two_receiving_ap`
>    (S7's `SupplierInvoice.dueDate` is computed from it) that no read model —
>    not `SupplierSchema`, not the AP read models — had exposed until now.
>    `CreateSupplierSchema`/`UpdateSupplierSchema` both gain an optional
>    `paymentDays` (the Prisma column default of 30 applies when omitted) so
>    the New/edit supplier form (`VU2-0`/`X6B-0`) can display and edit it, per
>    plan §0 item 5.
> 2. **New schema `SupplierApDetailSchema`** for `GET /inventory/ap/suppliers/:id`
>    (`VND-0`). This endpoint had no response schema or contract test at all
>    before this amendment — every other S7 read model did. Shape:
>    `{ supplier: SupplierSchema, row: SupplierApRowSchema, invoices:
>    SupplierInvoiceSchema[], payments: SupplierPaymentSchema[],
>    purchaseHistory: GoodsReceiptDetailSchema[] }`. `supplier` and
>    `purchaseHistory` are new on the wire — the endpoint previously returned
>    only `{ row, invoices, payments }`, missing the profile fields and
>    purchase history plan §0 names as in-scope for Supplier detail.
>    `purchaseHistory` reuses `goodsReceiptRepository.findAllByOrganization`
>    filtered by `supplierId` — no new query.
> 3. **`GET /inventory/ap/suppliers` (`listSupplierAp`) now actually applies
>    `limit`/`cursor`.** `ListSupplierApQuerySchema` accepted both since
>    freeze, but the service ignored them and derived every supplier-with-
>    invoices in the org, unbounded, on every request. `search`/`terms` (no
>    derivation needed) are now pushed into the DB query; `hasBalance`/
>    `agingBucket` stay as post-derivation filters; the final filtered set is
>    sorted by supplier name and paginated by `supplierId` cursor. No schema
>    change — the frontend infers `hasMore` from `data.length === limit`,
>    the same convention this module's other bare-array list endpoints
>    already use (`use-purchasing-history-list.ts`, `use-receiving-worklist.ts`).

> **AMENDMENT 2026-09-18 (S6 follow-up): signing a Goods Receipt now marks its
> linked ExpectedDelivery `FULFILLED`.** Previously `POST /goods-receipts/:id/
> sign` never touched the `ExpectedDelivery` row it was created against —
> `ExpectedDeliveryStatus.FULFILLED` existed in the enum but nothing ever set
> it, so a delivery stayed `AWAITING` (and kept showing on the Receiving
> worklist / Purchasing hub's "Expected" count) even after it was fully
> received and signed. Fixed inside `signGoodsReceipt`'s existing
> `prisma.$transaction`: if `receipt.expectedDeliveryId` is set, a new
> `expectedDeliveryRepository.markFulfilled(id, organizationId, tx)` call
> flips it to `FULFILLED`, conditioned on `status: 'AWAITING'` (a no-op, not
> an error, if it was already fulfilled/cancelled some other way). No new
> endpoint, no schema change — `ExpectedDeliveryStatus` already had this
> value. Receipts with no linked delivery (walk-in / no-expected-delivery
> receiving) are unaffected, since there's nothing to mark.

> **AMENDMENT 2026-09-17 (S6 follow-up): `GET /inventory/expected-deliveries/:id`
> added.** The frozen contract only ever defined a list and a cancel action for
> expected deliveries — no single-record read. The New Goods Receipt entry
> screen (`UQE-0`) needs to prefill its supplier, payment terms, and Receipt
> Line Grid from the expected delivery a Receiving-worklist "Receive" click
> carries (`?expectedDeliveryId=`), so a Store Manager/Attendant is confirming
> what already arrived against the estimate, not re-entering it from scratch.
>
> - New schema `ExpectedDeliveryDetailSchema` — `ExpectedDeliverySummarySchema`
>   extended with `lines: ExpectedDeliveryLineSchema[]`.
> - `ExpectedDeliveryLineSchema` gained `usageUnit` (alongside the existing
>   `buyUnit`) so the client can render the same "buy: X → usage: Y"
>   conversion label the Receipt Line Grid already shows for goods-receipt
>   lines — no schema change needed for the summary variant, which never
>   showed a per-line conversion label.
> - Same role set as the list endpoint (SM, SA, ACC, DIR) — this is a read,
>   no new access surface.
> - No Prisma migration — `ExpectedDeliveryLine`/`InventoryItem` already had
>   every field needed; only the repository's existing `include` gained
>   `usageUnit`/`conversionFactor` on the joined item.

> **AMENDMENT 2026-09-17 (New purchase redesign, owner-approved in Paper —
> `01M1ZZJ6S3FZGF5C7PPBGTKY89`, artboards `X9J-0`/`XXR-0`/`XN8-0`/`XOK-0`/
> `XUT-0`/`XXR-0`/`XZM-0`): supplier becomes optional on an expected
> delivery.** The redesigned New-purchase screen lets a Store Manager save a
> pure shopping list (items + quantities, no supplier assigned yet) —
> "Save purchase" no longer requires picking a supplier first.
>
> - `CreateExpectedDeliverySchema.supplierId` and `.paymentTerms` are now
>   both `.optional()` (paymentTerms in lockstep — terms are meaningless
>   without a supplier to owe them to; the screen greys the control out with
>   "Select a supplier to set payment terms" until one is picked).
> - `ExpectedDeliverySummarySchema.supplierId` and `.supplierName` are now
>   `.nullable()` (not empty-string sentinels — matches the existing
>   `estimatedTotal`/`expectedDate` convention); `.paymentTerms` is
>   `.nullable()` too.
> - Display copy: wherever a supplier name would render (Purchasing hub
>   Inbound band, `PurchasingHistoryRowSchema`'s `expectedDelivery` variant),
>   a null supplier renders the literal string **"No supplier"**; payment
>   terms render a dash. This is service-owned display copy
>   (`receiving-service.ts`'s `toHistoryRow`/`paymentTermsLabel`), not a
>   client-side fallback.
> - **What-we-owe (Supplier AP) is unaffected by construction.** Every AP
>   read model (`SupplierApRowSchema`, `AgingBucketsSchema`, `ApSummarySchema`)
>   is keyed by a non-nullable `supplierId` on `GoodsReceipt`/
>   `SupplierInvoice`/`SupplierPayment` — none of those three FKs changed.
>   `ExpectedDelivery` never feeds an AP row directly. See
>   `receiving-contract.test.ts`'s "AP exclusion invariant" tests.
> - Prisma: `ExpectedDelivery.supplierId` and `.paymentTerms` became nullable
>   columns — migration
>   `20260917134537_expected_delivery_optional_supplier`.
>   `GoodsReceipt`/`SupplierInvoice`/`SupplierPayment` are untouched.
> - Full rationale: `receiving-validators.ts`'s header comment (this file's
>   own amendment block, dated 2026-09-17, immediately above
>   `ExpectedDeliverySummarySchema`/`CreateExpectedDeliverySchema`).

---

## 23. Inventory — Milestone Three (Prep)

> **STATUS: BUILDING — S0 (Step 7, backend + frontend vertical slice)**,
> started 2026-09-19. Plan: `docs/features/inventory/milestone-3-plan.md`,
> all four §6 modeling questions owner-resolved 2026-09-19.

Prep is the **second writer to the stock ledger** after Milestone Two, and
the **first writer of a negative-signed ledger row** (`PREP_CONSUME`) — see
`prep-service.ts`'s `createPrepRun` comment. `InventoryTransaction.
prepRecordId` is restored as a real FK to `PrepRun.id` (was a dangling
nullable column since Milestone One), same restoration pattern Milestone Two
did for `goodsReceiptLineId`.

**Naming.** Routes live under `/inventory/prep/…` throughout, never a bare
`/prep…` path — §5 of this document, "Prep Tickets & Incidents", is a
completely different domain (BDS/KDS order-item prep tickets, see CLAUDE.md's
"one ticket per order-item line" system). No name or route may collide with
it.

### 23.1 Source of truth

| | |
|---|---|
| **Schemas (authoritative)** | `backend/src/modules/inventory/prep-validators.ts` |
| **Types (inferred from schemas)** | `backend/src/modules/inventory/prep.types.ts` |
| **Frontend mirror** | `frontend/features/inventory/types/prep.ts` — hand-mirrored, same as Milestone Two (no shared package to import from) |
| **Design** | Paper page `Milestone Three · Prep` (`p-D-0`), file `01M1ZZJ6S3FZGF5C7PPBGTKY89` |
| **Plan** | `docs/features/inventory/milestone-3-plan.md` §1, §3 |
| **Migration** | `backend/prisma/migrations/20260919144255_inventory_milestone_three_prep` |

### 23.2 Conventions specific to this contract

Inherits §22.2's conventions: standard envelope unchanged, every decimal
crosses the wire as a string, all routes under `/api/v1/inventory/…`.

**No role-based response narrowing.** Unlike Receiving/AP, both
`STORE_MANAGER` and `STORE_ATTENDANT` see identical Prep data including cost
figures — confirmed against the approved Paper screens (unit cost shown on
both roles' table/card views). No `ExpectedDeliverySummary`-style narrowing
pattern applies here.

### 23.3 Endpoints

| Method | Path | Roles |
|---|---|---|
| `GET` | `/inventory/prep/runs` | SM, SA |
| `GET` | `/inventory/prep/runs/:id` | SM, SA |
| `POST` | `/inventory/prep/runs` | SM, SA |
| `GET` | `/inventory/prep/summary` | SM, SA |
| `GET` | `/inventory/items/:id/typical-yield` | SM, SA |

- **`GET /inventory/prep/runs`** — paginated (`limit`/`cursor`), backs both
  the Prep runs list preview and Prep History's full browse. Query params:
  `search` (output item name or attendant name), `outputItemId`, `yieldFlag`
  (`'normal'|'low'|'high'`), `dateFrom`/`dateTo`.
- **`GET /inventory/prep/runs/:id`** — the immutable detail record. No
  `PATCH`, no `DELETE` — a prep run is never editable after confirm (ledger
  stays append-only).
- **`POST /inventory/prep/runs`** — the one write endpoint. Body:
  `outputItemId`, `inputLines: {inventoryItemId, quantity}[]`,
  `actualYield`. The server computes `totalInputCost`, `outputUnitCost`,
  `typicalYieldAtRunTime`, `yieldVarianceLabel`, `notifiedStoreManager`
  inside the same `$transaction` that writes the ledger rows — none of these
  are client-supplied.
- **`GET /inventory/prep/summary`** — KPI strip data (`runsInRange`,
  `totalInputCost`, `yieldFlagCount`), parameterized by the same
  `dateFrom`/`dateTo` as the list endpoint so Prep History's strip stays
  scoped to the active filter range.
- **`GET /inventory/items/:id/typical-yield`** — powers the New Prep Run
  screen's "Typical: ~6kg chicken → ~22L" nudge, fetched the moment an
  output item is picked, before any input lines exist to post.

### 23.4 Contract-formatting resolutions (not §6 modeling questions — build-time decisions)

The plan's §3.3 response-shape sketch left five formatting details open.
Resolved at S0 build time (see `prep-validators.ts`'s own header comment for
the full rationale of each):

1. `PrepRunSummary.yieldUnit` sources from the **output item's
   `usageUnit`**.
2. `inputsPreview.firstItemLabel` is formatted `"${quantity}${unit}
   ${itemName}"` (e.g. `"6kg chicken"`), matching `TypicalYield.
   typicalInputSummary`'s own `"~6 kg chicken"` convention.
3. `yieldVarianceLabel` is stored as `'normal'` (never `null`) once a
   typical yield exists but the run is within the warn band; `null` is
   reserved for "no typical yet, unflaggable" only.
4. `yieldVarianceDelta` is a signed **quantity** delta (`actualYield −
   typicalYieldAtRunTime`, one decimal place, e.g. `"+0.5"`), not a
   percentage — the percentage stays internal to threshold logic.
5. `createdByInitials` reuses this feature's existing
   `name.slice(0,2).toUpperCase()` convention.

### 23.5 Yield-variance thresholds and rolling-average window (plan §6 Q1, Q3)

Named constants in `prep-service.ts`, not inline magic numbers:

- **±15%** deviation from the rolling-average typical yield → non-blocking
  UI warning (`yieldVarianceLabel` becomes `'low yield'`/`'high yield'`).
- **±35%** deviation → additionally sets `notifiedStoreManager: true`.
  Records the fact only — no notification delivery is built this milestone
  (plan §0).
- Rolling average: **last 10 runs OR last 30 days, whichever gives fewer
  data points.** Flagged/outlier runs are always included in the average,
  never excluded (plan §6 Q3b) — avoids a circular "what's typical"
  definition.

## 24. Inventory — Milestone Four (Requisition & Branch Approval)

> **STATUS: BUILDING — Session A (Department Head fill)**, started
> 2026-09-21. Plan: `docs/features/inventory/milestone-4-sessions/
> session-a-plan.md`. Session B (branch-manager approve/return/edit,
> dispatch-queue visibility) is not built here — its endpoints are not yet
> in this section.

Requisition is the **first requisition milestone since Prep that does not
write to the ledger** — `Requisition`/`RequisitionSection`/`RequisitionLine`
are net-new models with no `InventoryTransaction` row written anywhere in
this session's endpoints (plan §0/§8). A requisition is one document per
branch-day-slot with exactly five sections, one per `DepartmentTag`, created
together at open time.

**Cross-department authorization is enforced in the service layer, not just
the route.** `requireDepartmentHead` middleware only confirms *a* department
head, not *which* department — every section-scoped method in
`requisitions-service.ts` additionally asserts `departmentTag ===
actor.departmentTag`, or throws `ForbiddenError`. This is the single
highest-risk check in this session (a Kitchen head could otherwise read/write
another department's section by editing the URL param).

### 24.1 Source of truth

| | |
|---|---|
| **Schemas (authoritative)** | `backend/src/modules/requisitions/requisitions-validators.ts` |
| **Types (inferred from schemas)** | `backend/src/modules/requisitions/requisitions.types.ts` |
| **Frontend mirror** | `frontend/features/requisitions/types/index.ts` — hand-mirrored (no shared package to import from) |
| **Design** | Paper page `Milestone Four · Requisition & Branch Approval` (`p-E-0`), file `01M1ZZJ6S3FZGF5C7PPBGTKY89` — fill-screen nodes `10PT-0`/`10J9-0`/`10LE-0`/`10NJ-0`/`10RO-0`/`10TV-0`, list `10HO-0`, landing `122U-0` |
| **Plan** | `docs/features/inventory/milestone-4-plan.md` §1–§3, `milestone-4-sessions/session-a-plan.md` |
| **Migrations** | `backend/prisma/migrations/20260921122901_add_category_parent_category_id`, `backend/prisma/migrations/20260921122951_inventory_milestone_four_requisition` |

### 24.2 Conventions specific to this contract

Inherits §22.2's conventions: standard envelope unchanged, every decimal
crosses the wire as a string, all routes under `/api/v1/…`.

**Routes are not namespaced under `/inventory/`** — `/requisitions/…`,
matching the plan's own route table (§3.2) and the new
`backend/src/modules/requisitions/` module boundary, distinct from
`backend/src/modules/inventory/`.

**Every route in this section is gated on the `requireDepartmentHead`
marker middleware** (`allowDepartmentHead`/`requireDepartmentHead` in
`backend/src/middleware/rbac.ts`), never `requireRole('DEPARTMENT_HEAD')` —
that enum value is dead since the 2026-09-03 department-head-marker
refactor. `POST /requisitions` and `GET /requisitions` are
department-head-only in Session A; `MANAGER` access to the same paths is
Session B's addition.

### 24.3 Endpoints (Session A — Department Head)

| Method | Path | Roles |
|---|---|---|
| `POST` | `/requisitions` | Department Head |
| `GET` | `/requisitions` | Department Head |
| `GET` | `/requisitions/:id/sections/:departmentTag` | Department Head (own department only) |
| `PATCH` | `/requisitions/:id/sections/:departmentTag/lines` | Department Head (own department only) |
| `POST` | `/requisitions/:id/sections/:departmentTag/submit` | Department Head (own department only) |
| `POST` | `/requisitions/:id/sections/:departmentTag/recall` | Department Head (own department only) |

- **`POST /requisitions`** — opens a requisition and creates all 5
  `RequisitionSection` rows (one per `DepartmentTag`, `NOT_STARTED`) in one
  transaction. Body: `type` (`MORNING`/`AFTERNOON`/`EVENING`/`AD_HOC`),
  optional `note`. Response is a `RequisitionListRow` scoped to the caller's
  own department (`mySectionStatus`).
- **`GET /requisitions`** — role-scoped list of the caller's branch
  requisitions. Every row surfaces only the caller's own department's
  section status (`mySectionStatus`), never other departments' — this is a
  read-side application of the same cross-department scoping the
  section-detail endpoints enforce. Query: `limit` (default 25).
- **`GET /requisitions/:id/sections/:departmentTag`** — fill-screen payload:
  lines with item name, usage unit, category + parent-category name,
  `parAtRequest` (nullable), `requestedQty` (nullable).
- **`PATCH /requisitions/:id/sections/:departmentTag/lines`** — bulk upsert.
  Body: `lines: {id?, inventoryItemId?, requestedQty}[]` (each entry needs
  either `id` — an existing-line qty edit, including `"0"` for zero-not-
  delete — or `inventoryItemId` — a new line, add-item; `requestedQty`
  rejects negative but allows `"0"` and `null`), optional `managerNote`.
  Rejected with `ConflictError` when the section is `SUBMITTED`/`RETURNED`.
  A new line's `parAtRequest` is snapshotted from `RestockLevel` at creation
  time, not read live later.
- **`POST /requisitions/:id/sections/:departmentTag/submit`** —
  `NOT_STARTED`/`DRAFT`/`RETURNED` → `SUBMITTED` (the `RETURNED` source state
  is the resubmit-after-bounce-back path — clears `returnedNote` server-side
  in the same write). Flips the parent `Requisition.status` `OPEN` →
  `PENDING_APPROVAL` only on the first section submitted across the
  requisition (subsequent submits are a no-op on that flip). Throws
  `ConflictError` on a zero-count race (already submitted concurrently).
- **`POST /requisitions/:id/sections/:departmentTag/recall`** — `SUBMITTED`
  → `DRAFT`. Rejected with `ConflictError` once the parent
  `Requisition.status` is `APPROVED` (Session B).

### 24.4 `parAtRequest` nullability (deviation from the milestone plan's literal sketch)

`RequisitionLine.parAtRequest` is `Decimal?` (nullable) — session-a-plan.md
decision #2, a deliberate, owner-flagged deviation from `milestone-4-plan.md`
§1.2's literal non-nullable sketch. `null` means no `RestockLevel` row
exists yet for `(this branch's department location, item)` — expected to be
common until Milestone One's restock-level flow is actually exercised
per-branch (itself unblocked this session by the `DEPARTMENT_HEAD` dead-role
fix in `backend/src/modules/inventory/inventory-routes.ts`/
`inventory-service.ts`). No fallback, no zero — the frontend renders `null`
as a blank/dash reference.

### 24.5 Deviation from the approved Paper mock: no "on hand" column, no pre-fill

Per `milestone-4-plan.md` §0 (owner-agreed 2026-09-21): the fill screen
drops the "on hand" column and the par-minus-on-hand auto pre-fill shown in
the Paper mock. No branch-department stock/ledger exists anywhere in the
schema yet — Milestone 5 (Dispatch) is the first time stock lands at a
branch department. The head sees `par` (a real figure) and enters
`requestedQty` manually; lines start at `requestedQty: null`.

### 24.6 Zero-not-delete vs. true deletion

Setting a line's `requestedQty` to `"0"` via the upsert endpoint is not a
deletion — the row stays (Flow 7 step 3, an explicit UI/service rule, not a
schema state). Session A has **no true server-side line deletion at all**:
omitting an existing, already-persisted line from the `PATCH` payload does
nothing to it server-side (the endpoint only touches lines it's told about)
— it is not interpreted as a delete. Because of this, the fill screen's
trash icon is only enabled for a line added and removed again **within the
same unsaved session, before it was ever sent to the server** — that case is
a true client-side no-op, since the line never existed server-side to begin
with. An already-saved line's trash icon is disabled (owner-flagged UI
correction, found during this session's browser verification against the
original draft's more permissive framing); a head who wants to zero out an
already-saved line uses the stepper (zero-not-delete), not the trash icon.
True soft-deletion (`RequisitionLine.deletedAt`, branch-manager delete with a
required reason) is Session B's `PATCH` endpoint, not built here.

---

## 25. Inventory — Milestone Five (Dispatch & Branch Receiving)

> **STATUS: SHIPPED** — Session A (dispatch) and Session B (branch
> receiving & discrepancy), 2026-09-22. *Backfilled 2026-09-25 by Milestone
> Six Session 1 from the shipped code — Milestone Five's plan named this
> section but it was never written.* Source of truth is the validators
> file below; this section summarizes it.

Milestone Five is where stock first moves between organizations: the
Central Store signs a department's share of an approved requisition out
(`DISPATCH_OUT`, negative, at the Central Store) and the department signs it
in (`DISPATCH_IN`, positive, at the department location). A mismatched
confirm never blocks — it opens a `Discrepancy` (Flow 10a) that the Store
Manager later resolves.

### 25.1 Source of truth

| | |
|---|---|
| **Schemas (authoritative)** | `backend/src/modules/dispatch/dispatch-validators.ts` |
| **Types** | `backend/src/modules/dispatch/dispatch.types.ts` |
| **Frontend mirror** | `frontend/features/dispatch/types/` — hand-mirrored |
| **Plan** | `docs/features/inventory/milestone-5-plan.md` §1–§2, `milestone-5-sessions/session-a-plan.md`, `session-b-plan.md` |
| **Migrations** | `20260922071002_milestone5_dispatch_dispatch_line`, `20260922111827_milestone5_session_b_discrepancy` |
| **Data model** | `DATA_MODEL.md` §4.66–4.68 |

### 25.2 Conventions specific to this contract

Inherits §22.2: standard envelope, every decimal a string, all routes under
`/api/v1/…`. Routes are **not** under `/inventory/` — `/dispatch/…`,
`/deliveries/…`, `/discrepancies/…`, one module (`modules/dispatch/`).
Every signing endpoint takes a 4-digit `pin` checked with `comparePin`
against the actor's `pinHash` (401 on mismatch). The hub's cross-org reads
enumerate active branch orgs explicitly (`findActiveBranchIds`), never an
unscoped query (`CENTRAL_STORE_SCOPING_DESIGN.md` §4).

### 25.3 Endpoints

| Method | Path | Roles |
|---|---|---|
| `GET` | `/dispatch/queue` | STORE_MANAGER, STORE_ATTENDANT (hub) |
| `GET` | `/dispatch/:requisitionId/fulfil` | STORE_MANAGER, STORE_ATTENDANT |
| `POST` | `/dispatch/:requisitionId/fulfil/:departmentTag` | STORE_MANAGER, STORE_ATTENDANT |
| `GET` | `/dispatch/:id/delivery-note` | STORE_MANAGER, STORE_ATTENDANT |
| `GET` | `/deliveries` | MANAGER, Department Head |
| `GET` | `/deliveries/:id` | MANAGER, Department Head (own department) |
| `POST` | `/deliveries/:id/confirm` | Department Head (own department) |
| `POST` | `/deliveries/:id/confirm-on-behalf` | MANAGER |
| `GET` | `/deliveries/:id/delivery-note` | MANAGER, Department Head |
| `GET` | `/discrepancies` | STORE_MANAGER, STORE_ATTENDANT, MANAGER |
| `GET` | `/discrepancies/:id` | STORE_MANAGER, STORE_ATTENDANT, MANAGER |
| `POST` | `/discrepancies/:id/resolve` | STORE_MANAGER |

- **`GET /dispatch/queue`** — approved requisitions across branch orgs:
  `DispatchQueueRow[]` (`requisitionId`, `branchName`, `requisitionType`,
  `openedAt`, `departments[{departmentTag, status (null = approved, not yet
  dispatched), totalUnits, dispatchId}]`). Query `limit` (default 50).
- **`GET /dispatch/:requisitionId/fulfil`** — `FulfilDetail`: per-department
  sections with lines (`requestedQty`, live Central Store `onHandQty`,
  pre-filled `dispatchQty = min(requested, onHand)`).
- **`POST /dispatch/:requisitionId/fulfil/:departmentTag`** — body
  `{lines[{requisitionLineId?, inventoryItemId, dispatchQty ≥ 0,
  isSubstitute?, substituteNote?}], pin}`; a substitute line requires a note.
  Creates the `Dispatch` + lines (status `IN_TRANSIT`) and one negative
  `DISPATCH_OUT` per non-zero line, `costAtDispatch` frozen from
  `currentCost`. 409 if the requisition isn't approved or the department
  was already dispatched. Pushes the department heads after commit.
- **`GET /dispatch/:id/delivery-note`**, **`GET /deliveries/:id/delivery-note`**
  — one `DeliveryNote` record for both print and on-screen views.
- **`GET /deliveries`** — the branch's dispatches: every department for the
  Branch Manager, own department only for a department head.
  `DeliveryRow[]`.
- **`POST /deliveries/:id/confirm`** — body `{lines[{dispatchLineId,
  confirmedQty ≥ 0}] (every dispatched line), pin}`. Writes `confirmedQty`
  and one positive `DISPATCH_IN` per line with `confirmedQty > 0` at the
  department location. Any line where confirmed ≠ dispatched creates an
  `OPEN` `Discrepancy` (`DSC-####`, `gapQty = confirmed − dispatched`) and
  sets the dispatch `DISCREPANCY_OPEN`; otherwise `CONFIRMED`. A Branch
  Manager calling this path gets 403 (they use confirm-on-behalf).
- **`POST /deliveries/:id/confirm-on-behalf`** — same write,
  `confirmedOnBehalf: true`, `confirmedById` = the real signer (Flow 10b).
- **`GET /discrepancies`** — one endpoint, role-scoped rows: the hub sees
  every branch, a Branch Manager their own branch (read-only).
  `DiscrepancyRow[]`; `GET /discrepancies/:id` → `DiscrepancyDetail`.
- **`POST /discrepancies/:id/resolve`** — Store Manager, body `{outcome,
  resolutionNote (required), pin}`. Ledger effect in the same transaction:
  `TRANSIT_LOSS_WRITEOFF` → negative `ADJUSTMENT` at the Central Store;
  `MISCOUNT_CORRECTED` → `ADJUSTMENT` of `gapQty` at the department;
  `FOUND_REDELIVERED` → a follow-up `Dispatch` for |gap| (+ its
  `DISPATCH_OUT`). Both adjustments carry `dispatchLineId`. 400 if already
  resolved.

### 25.4 Additive change elsewhere

`RequisitionHistoryRow` (§24) gained `dispatchSummary[{dispatchId,
departmentTag, status, sequenceLabel}]` — always an array, empty when
nothing is dispatched.

---

## 26. Inventory — Milestone Six (Counting, Closing & Discrepancies)

> **STATUS: BUILDING.** Session 1 (stock position & waste) — 2026-09-25.
> Session 2 (Central Store counting + thresholds, §26.2) — 2026-09-29.
> Sessions 3–4 add §26.3 (branch day). Plan: `docs/features/inventory/milestone-6-plan.md` §2.

### 26.1 Stock position, ledger, waste (Session 1)

| | |
|---|---|
| **Schemas (authoritative)** | `backend/src/modules/inventory/stock-validators.ts`, `waste-validators.ts` |
| **Types** | `stock.types.ts`, `waste.types.ts` (inferred) |
| **Frontend mirror** | `frontend/features/inventory/types/stock.ts`, `waste.ts` |
| **Contract tests** | `stock-contract.test.ts`, `waste-contract.test.ts` (incl. the blindness test), `stock-scope.test.ts` |
| **Migration** | `20260925090000_milestone6_session1_waste_log` |
| **Data model** | `DATA_MODEL.md` §4.52 (ledger additions), §4.69 `WasteLog` |

Inherits §22.2 (envelope, decimals as strings). **Blind count (plan §7
Q-A):** the Store Attendant sees no on-hand quantity anywhere. Their
responses are **separate schemas** without on-hand fields (not a filtered
shared shape), the service parses them through those schemas before
returning, and a contract test asserts on the serialized JSON that no
attendant-facing response has an on-hand / expected / variance key.

| Method | Path | Roles |
|---|---|---|
| `GET` | `/inventory/stock` | STORE_MANAGER |
| `GET` | `/inventory/stock/summary` | STORE_MANAGER, STORE_ATTENDANT |
| `GET` | `/inventory/stock/items/:itemId/ledger` | STORE_MANAGER (Central Store), MANAGER (own branch departments), Department Head (own department). **STORE_ATTENDANT → 403** |
| `POST` | `/inventory/waste` | STORE_MANAGER, STORE_ATTENDANT (Central Store); Department Head (own department) |
| `GET` | `/inventory/waste` | STORE_MANAGER, STORE_ATTENDANT, Department Head |
| `GET` | `/inventory/waste/items` | STORE_MANAGER, STORE_ATTENDANT, Department Head |
| `GET`/`PUT` | `/inventory/restock-levels` | unchanged (§21) — the SM drawer passes the Central Store `locationId` |

- **`GET /inventory/stock`** — Central Store position, page-based. Query:
  `search`, `type`, `categoryId` (a top-level id also matches its
  sub-categories), `belowRestock`, `negative`, `attention` (all
  `"true"`/`"false"`), `page` (1), `pageSize` (8, max 100). Response
  `{rows[{itemId, name, type, category|null, onHand, usageUnit,
  restockLevel|null, currentCost, value, isLow, isNegative}], total, page,
  pageSize, pageCount}`. `value = onHand × currentCost` (negative when
  on-hand is). `isLow = restockLevel set and onHand < restockLevel`.
  `attention=true` = the hub table: items that are negative or have a
  restock level, ordered negative first, then by on-hand ÷ restock level
  ascending, then name.
- **`GET /inventory/stock/summary`** — Store Manager: `{onHandValue,
  itemCount (live catalog items), lowCount (below restock, not negative),
  negativeCount, todaysCount}`. Store Attendant: `{todaysCount}` only.
  `todaysCount = {status: NOT_STARTED|DRAFT|SUBMITTED|RETURNED|VERIFIED,
  countId, submittedAt, submittedByName, countedLines, totalLines}` — read
  from today's DAILY count (§26.2); `NOT_STARTED` + nulls before one exists.
  `countedLines`/`totalLines` are progress only — never a quantity, so they
  are safe for the attendant.
- **`GET /inventory/stock/items/:itemId/ledger`** — query `locationId`
  (SM: omitted = Central Store, any other → 403; MANAGER: required, must be
  a department of their own branch, else 403; department head: omitted =
  own department, any other → 403), `from`, `to` (ISO), `type`, `page`,
  `pageSize` (25). Response `{summary{itemId, itemName, usageUnit,
  categoryName, onHand, currentCost, currentCostSince, value, restockLevel,
  isLow, location{id, name, departmentTag, branchName}, lastMovementAt},
  rows[{id, at, type, counterparty, qty (signed), runningOnHand,
  reference}], total, page, pageSize, pageCount}`. Rows are oldest first.
  `runningOnHand` is a SQL window over the item's **whole** ledger at that
  location, computed before the range/type filter. `counterparty` is
  derived from whichever FK the row carries (supplier; "Nyeri Town ·
  Barista"; "Central Store"; the waste reason; "Prep · {output}";
  "Transit discrepancy · DSC-####"; a count adjustment reads "Daily count ·
  verified by J. Mwangi" / "Spot count · …", derived from
  `stockCountLineId`). `reference` = the row's own `reference` (`ADJ-####`)
  else the GRN / DSC number.
- **`POST /inventory/waste`** — body (strict) `{inventoryItemId, quantity >
  0, reason: SPOILAGE|EXPIRY|DAMAGE_IN_STORE|PREP_ERROR, note? (≤500)}`. No
  location field: resolved from the actor. A department head may only log
  items tagged to their department (403). Writes one `WasteLog` + one
  negative `WASTE` row (`wasteLogId`, `reason`) in one transaction.
  Negative stock is allowed. `201` → SM / department head `{entry,
  onHandAfter, wentNegative}`; Store Attendant `{entry}`. `entry =
  {id, at, itemId, itemName, quantity, usageUnit, reason, note, unitCost,
  value, loggedByName}`.
- **`GET /inventory/waste`** — `days` (7, 1–90) → `{days, entries (newest
  first), totalValue}` for the actor's location.
- **`GET /inventory/waste/items`** — the Log waste item picker: `search`,
  `limit` (20). SM / department head: `{items[{itemId, name, usageUnit,
  unitCost, onHand}]}`; Store Attendant: the same **without `onHand`**.
  Department heads see only their department's tagged items; `unitCost` is
  the value the entry would get (department: latest `DISPATCH_IN` cost,
  else current cost).

**Deviations from plan §2.1** (recorded in `session-1-plan.md` outcome log):
`GET /inventory/waste/items` is new — the plan asked to verify the picker's
data source, and `/inventory/items` has no department carried-in cost and
no role-split projection. The ledger adds `currentCostSince`,
`lastMovementAt` (empty-state copy) and paging fields to the planned shape.

### 26.2 Central Store counting & thresholds (Session 2)

| | |
|---|---|
| **Schemas (authoritative)** | `backend/src/modules/inventory/count-validators.ts`, `thresholds-validators.ts` |
| **Types** | `count.types.ts`, `thresholds.types.ts` (inferred) |
| **Frontend mirror** | `frontend/features/inventory/types/count.ts`, `thresholds.ts` |
| **Contract tests** | `count-contract.test.ts` (incl. the blindness test), `count-service.test.ts`, `thresholds-service.test.ts` |
| **Migration** | `20260929090000_milestone6_session2_counting` |
| **Data model** | `DATA_MODEL.md` §4.70 `StockCount`, §4.71 `StockCountLine`, §4.72 `CountingThresholds`, §4.52 (ledger FK) |

Inherits §22.2 (envelope, decimals as strings). Business dates are
`YYYY-MM-DD` in Africa/Nairobi. Every route: `authenticate` + `requireRole`,
Zod input, hub-org scoped; the actor's organization must be the hub (403).
**Blind count:** the attendant's responses are the separate
`AttendantCountView` / `AttendantSaveResult` / `AttendantSubmitResult`
schemas — Zod strips undeclared keys, so `expectedQty`, variance, on-hand
and unit cost cannot reach the attendant; `count-contract.test.ts` asserts
on the serialized JSON for every attendant-facing response.

| Method | Path | Roles |
|---|---|---|
| `GET` | `/inventory/counts` | STORE_MANAGER |
| `GET` | `/inventory/counts/today` | STORE_ATTENDANT |
| `GET` | `/inventory/counts/:id` | STORE_MANAGER (full view), STORE_ATTENDANT (blind view, DAILY only) |
| `PUT` | `/inventory/counts/:id/lines` | STORE_ATTENDANT |
| `POST` | `/inventory/counts/:id/submit` | STORE_ATTENDANT |
| `PATCH` | `/inventory/counts/:id/lines/:lineId` | STORE_MANAGER |
| `POST` | `/inventory/counts/:id/return` | STORE_MANAGER |
| `POST` | `/inventory/counts/:id/approve` | STORE_MANAGER |
| `GET` | `/inventory/counts/:id/print` | STORE_MANAGER |
| `POST` | `/inventory/spot-counts` | STORE_MANAGER |
| `GET` | `/inventory/thresholds` | STORE_MANAGER, MANAGER |
| `PUT` | `/inventory/thresholds` | STORE_MANAGER (Central Store reason threshold), MANAGER (own branch's reason + overnight thresholds, Session 3) — schema chosen by role, each `.strict()` |
| `PUT` | `/inventory/thresholds/director` | DIRECTOR |

- **`GET /inventory/counts`** — query `kind` (DAILY|SPOT), `limit` (30).
  `{counts[{id, reference, kind, countDate, status, counterName,
  counterSignedAt, verifierName, verifiedAt, itemCount (counted lines),
  totalLines, varianceLines, adjustmentCount, netVarianceValue,
  directorNotified}]}`. Drafts are excluded. Awaiting the Store Manager
  (SUBMITTED, RETURNED) first, oldest first; then VERIFIED, newest first.
  The hub's "Waste log · last 7 days" roll-up row is composed by the
  frontend from `GET /inventory/waste`.
- **`GET /inventory/counts/today`** — get-or-create today's DAILY draft
  (a line for every live hub catalog item; items added later are appended
  while it is DRAFT). Response `AttendantCountView = {id, reference,
  countDate, status, counterName, totals{counted, total}, categories[{id|null,
  name, total, counted}] (top-level categories — the tabs, plan §7 Q-C),
  lines[{inventoryItemId, name, usageUnit, categoryId, categoryName,
  countedQty|null, editable, queryNote}], savedAt, submittedAt, returnNote,
  returnedAt, returnedByName}`. `lines`: DRAFT → all; RETURNED → the queried
  lines only; SUBMITTED / VERIFIED → none.
- **`PUT /inventory/counts/:id/lines`** — `{lines:[{inventoryItemId,
  countedQty (≥0 decimal string | null to clear)}]}` (strict, ≤1000). DRAFT:
  any line. RETURNED: queried lines only, else 409 `COUNT_LOCKED`. Returns
  `{savedAt, counted, total}`.
- **`POST /inventory/counts/:id/submit`** — `{pin}`. DRAFT needs ≥1 counted
  line (409 `NOTHING_COUNTED`); RETURNED needs every queried line recounted
  (409 `RECOUNT_INCOMPLETE`). Snapshots `expectedQty` (ledger on-hand *now*),
  `unitCost` and `reasonRequired` on the counted lines (only the queried lines
  on a resubmit); matching lines are auto-`ACCEPTED`, variance lines wait as
  `PENDING`; uncounted lines are untouched. Status → SUBMITTED. Wrong PIN →
  401, nothing written. After commit: push to the Store Manager. Returns
  `{id, reference, status, submittedAt, counted, total}`.
- **`GET /inventory/counts/:id` (Store Manager)** — `VerifierCountView =
  {id, reference, kind, countDate, status, counter{id,name}, counterSignedAt,
  verifier{id,name}|null, verifiedAt, returnNote, returnedAt,
  directorNotified, totals{lines, uncountedLines, matchedLines, varianceLines,
  aboveThreshold, queriedLines, netVarianceValue}, thresholds{reasonRequiredKes,
  directorAlertKes}, lines[{lineId, inventoryItemId, name, usageUnit,
  categoryName, countedQty|null, expectedQty|null, variance|null,
  varianceValue|null (signed KES), unitCost, decision, reason, reasonNote,
  reasonRequired, directorAlert, queryNote, firstCountedQty,
  adjustmentReference, adjustmentTransactionId}]}`. A DRAFT is 409
  `COUNT_NOT_SUBMITTED`.
- **`PATCH /inventory/counts/:id/lines/:lineId`** — `{decision: PENDING|
  ACCEPTED|QUERIED, reason?, reasonNote?, queryNote?}` (strict; `reason:
  OTHER` requires `reasonNote`). Only while SUBMITTED, only on a counted line
  (409 `COUNT_LOCKED` / `LINE_NOT_COUNTED`). A reason is kept only with
  ACCEPTED, a query note only with QUERIED. Returns the refreshed
  `VerifierCountView`.
- **`POST /inventory/counts/:id/return`** — `{note?}` (optional, ≤500). SUBMITTED with ≥1
  QUERIED line (409 `NO_QUERIED_LINES`) → RETURNED. Each queried line's
  figure moves to `firstCountedQty` and `countedQty` is cleared so the
  attendant recounts it blind; other lines stay as they are. `{count}`.
- **`POST /inventory/counts/:id/approve`** — `{pin}`. 409s, in order:
  `QUERIED_LINES`, `LINES_UNDECIDED` (a variance line still PENDING),
  `REASON_REQUIRED` (an accepted line whose stored `reasonRequired` is true
  has no reason, or `OTHER` with no note) — each with `details.lineIds`. One
  transaction: status VERIFIED + one `ADJUSTMENT` per accepted non-zero
  variance (signed `countedQty − expectedQty`, frozen `unitCost`,
  `stockCountLineId`, `reference ADJ-####` from `ReferenceCounter`, `userId`
  = the verifier). Uncounted, zero-variance and queried lines write nothing.
  After commit: Director push when any line's |value| ≥ `directorAlertKes`
  (`directorNotified` stored on the count). Returns `{count,
  adjustmentsWritten, netAdjustmentValue, directorNotified}`.
- **`POST /inventory/spot-counts`** — `{lines:[{inventoryItemId, countedQty,
  reason?, reasonNote?}] (1–50, unique items), pin}` (strict). Created
  VERIFIED in one step: `expectedQty` = ledger on-hand now; a reason is
  required above the threshold (409 `REASON_REQUIRED`, `details.itemIds`);
  `reference SPT-####`; adjustments as above. `201` → same shape as approve.
- **`GET /inventory/counts/:id/print`** — non-DRAFT only. `{reference, kind,
  countDate, status, locationName, totals, adjustments[{itemName, usageUnit,
  variance, reference, value, reason}] (largest |value| first),
  directorAlertItems[{itemName, variance, usageUnit}], directorNotified,
  counter{name, roleLabel, signedAt}, verifier{…}|null, generatedAt}`.
- **`GET /inventory/thresholds`** — `{reasonRequiredKes, overnightAlertKes|null,
  directorAlertKes, isDefault, updatedBy{id,name}|null, updatedAt|null,
  directorUpdatedBy, directorUpdatedAt}`. Defaults when no row: hub 500,
  branch 1,000 / overnight 500, Director 5,000 (`counting-thresholds.ts`).
  `directorAlertKes` always comes from the hub row and is read-only here.
- **`PUT /inventory/thresholds`** — Store Manager `{reasonRequiredKes}`
  (strict; whole KES 0…1,000,000; 0 = always). Branch fields → 400. The row is
  created lazily. Returns the same shape as GET. **Session 3:** a Branch Manager
  sends `{reasonRequiredKes, overnightAlertKes}` (strict) and writes only their
  own branch's row — the organization always comes from the actor, never the
  request; sending `directorAlertKes` or a Store Manager field → 400.
- **`PUT /inventory/thresholds/director`** — `{directorAlertKes}`, DIRECTOR
  only, hub row. API-only this milestone.

**Deviations from plan §2.2** (recorded in `session-2-plan.md` outcome log):
`StockCountLine` gains `firstCountedQty` and `queryNote`;
`CountingThresholds` gains `directorUpdatedById/At` (so the drawer's "last
changed by" is the Store Manager's, not the Director's); `unitCost` is frozen
at submit with the snapshot (not at verify) so `reasonRequired` and the KES
figure the Store Manager sees cannot drift; approve also blocks
`LINES_UNDECIDED`; `GET /inventory/counts` has no waste roll-up row.


### 26.3 Branch day close (Session 3)

| | |
|---|---|
| **Schemas (authoritative)** | `backend/src/modules/branch-day/branch-day-validators.ts` |
| **Types** | `branch-day.types.ts` (inferred) |
| **Frontend mirror** | `frontend/features/branch-day/types/branch-day.ts` |
| **Contract tests** | `branch-day-contract.test.ts`, `branch-day-service.test.ts`, `thresholds-service.test.ts` |
| **Migration** | `20260930090000_milestone6_session3_branch_day` |
| **Data model** | `DATA_MODEL.md` §4.73 `BranchDay`, §4.74 `BranchDayDepartment`, §4.75 `BranchDayLine`, §4.76 `BranchDayReopen`, §4.52 (ledger FK) |

Inherits §22.2. Business dates `YYYY-MM-DD` (Africa/Nairobi); decimals as
strings. Every route: `authenticate` + `requireRole`, Zod input. The day is
always found through the **actor's own branch org** (a manager cannot reach
another branch's day — 404); only `DIRECTOR` reopen is unscoped.

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/branch-day/today` | MANAGER | get-or-create today → `BranchDayToday`: departments (derived status `NOT_STARTED\|COUNTING\|COUNTED\|BLOCKED\|CLOSED`, `blockingDispatches`, `countedLines/itemCount`, `gapsAboveThreshold`, `netAdjustmentValue`), `yesterday`, `reasonRequiredKes`, `canClose`, `closeBlockers[]` (`NOT_COUNTED\|BLOCKED\|REASON_REQUIRED`) |
| `GET` | `/branch-day/:id/departments/:tag` | MANAGER | `DepartmentDayDetail` — lines `{expectedQty, countedQty, gap, gapValue, unitCost, reasonRequired, reason, reasonNote}` |
| `PUT` | `/branch-day/:id/departments/:tag/lines` | MANAGER | `{lines:[{inventoryItemId, countedQty\|null, reason?, reasonNote?}]}` — partial saves; snapshots expected/cost/`reasonRequired` per saved line; → `{savedAt, detail}`. 409 `DAY_CLOSED`, 409 `DEPARTMENT_BLOCKED`, 400 `ITEM_NOT_IN_DEPARTMENT` |
| `POST` | `/branch-day/:id/close` | MANAGER | `{pin}` → 409 `DAY_NOT_READY` (`details.blockers`) before the PIN is checked, 401 wrong PIN. One transaction: reverses every standing adjustment of the day (re-close), then one `ADJUSTMENT` per non-zero gap. → `{adjustmentCount, reversalCount, netAdjustmentValue, directorNotified}`. Director push (lines ≥ `directorAlertKes`) after commit |
| `POST` | `/branch-day/:id/reopen` | MANAGER, DIRECTOR | `{reason}` (required) → day `OPEN`, `BranchDayReopen` row; never touches the ledger. 409 `DAY_NOT_CLOSED` |
| `GET` | `/branch-day/:id/document` | MANAGER | signed day-close document (409 `DAY_NOT_CLOSED` until closed) |

History (`/branch-day/history`, `/branch-day/:id`) and opening
(`/branch-day/opening…`) arrive in Session 4.
