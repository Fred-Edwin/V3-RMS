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

> **Note (Oct 2026): wire names are unchanged by design.** In the backend code an
> Organization is now a `Site` and `organizationId` is `siteId`. Everything that leaves or
> enters the API keeps the old spelling: JSON response and request keys (`organizationId`,
> `organizationName`, `organization`, `toOrganizationId`, ...), query strings, socket event
> payloads, validation error `path`s, and the login token claim. The frontend is deployed
> separately from the API, so a renamed field would break the live app between the two
> deploys. One translation layer does this (`backend/src/shared/utils/wire-names.ts`,
> applied in `middleware/wire-names.ts`, `utils/jwt.ts`, `sockets/socket.ts`). The
> `/branches` responses also keep their original shape: the new `companyId` and `type`
> columns are not sent. The frontend is renamed module by module as each is rebuilt.

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
| `POST` | `/inventory/items` | SM, SA *(SA: stocked / raw only — §29.4)* |
| `PATCH` | `/inventory/items/:id` | SM |
| `DELETE` | `/inventory/items/:id` | SM |
| `POST` | `/inventory/items/:id/restore` | SM |
| `GET` | `/inventory/suppliers` | SM, ACC, DIR *(SA stripped list — superseded by §27)* |
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

> **STATUS: HISTORY — replaced by §33 (Prep rebuild, frozen 7 Oct 2026).** These five
> endpoints stay live on branch `feat/prep-rebuild` only until Slice 2 deletes them; do not
> build anything new against this section.
>
> (Original status: BUILDING — S0, started 2026-09-19. Plan:
> `docs/features/inventory/milestone-3-plan.md`.)

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
  `stockCountLineId`; a branch close reads "End-of-day count", a next-morning
  opening "Overnight variance", each with "· reversed" on its linked reversal
  row — derived from `branchDayLineId` / `openingLineId`). `reference` = the row's own `reference` (`ADJ-####`)
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

### 26.4 Day close history & next-morning opening (Session 4)

Schemas: `backend/src/modules/branch-day/branch-day-validators.ts` (frozen by contract tests). Decimals are strings; business dates `YYYY-MM-DD`.

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/branch-day/history?from&to` | MANAGER | Closed days in range plus any earlier day still open; never today's open day. Range ≤ 92 days (`from ≤ to`). Row: `{id, reference, date, status, reopenCount, closedAt, closedBy, departmentsClosed, departmentsTotal, gapLines, netAdjustmentValue}` — aggregated from saved lines, never recomputed from the live ledger. No "never closed → Director" flag (decision Q-5). |
| `GET` | `/branch-day/:id` | MANAGER | History detail: `kpis`, every department's `summary` + saved `lines` (read-only), `reopens[]` audit trail (oldest first). Own branch only (404 otherwise). |
| `GET` | `/branch-day/:id/overview` | MANAGER | Same shape as `/branch-day/today` for any of the branch's own days — how a reopened past day is recounted and re-closed. A past day's expected figures are taken at the end of that business day (Nairobi midnight), not from today's ledger. |
| `GET` | `/branch-day/opening` | Department Head | Own department only (tag comes from the token). `status` `PENDING` → live pre-fill (department on-hand); `ACCEPTED` → the signed figures. `lastCloseAt` null when yesterday was never closed. |
| `POST` | `/branch-day/opening/accept` | Department Head | `{lines:[{inventoryItemId, acceptedQty}]}` — only recounted items need listing; the rest are accepted at pre-fill. One transaction: `DepartmentOpening` + a line per item + one linked `ADJUSTMENT` ("Overnight variance", `ADJ-####`, `openingLineId`) per differing line. 409 `OPENING_ALREADY_ACCEPTED` on a second accept the same day. After commit: Branch Manager push if any line ≥ `overnightAlertKes`. |

**Recompute hook.** `POST /branch-day/:id/close` (re-close) also reverses the standing overnight adjustments of any opening already accepted for the *next* day (linked, equal and opposite), re-derives each line's pre-fill from the ledger without the opening's own rows, and writes a fresh overnight adjustment for whatever still differs. The department head's accepted figure stays authoritative.

---

## 27. Inventory — Suppliers expansion

> **STATUS: BACKEND BUILT (2026-09-30), awaiting frontend.** Extends and, where
> noted, supersedes the supplier rows of §21.3. Plan (authoritative for scope):
> `docs/features/inventory/suppliers-plan.md`.

| | |
|---|---|
| **Schemas (authoritative)** | `backend/src/modules/inventory/supplier-validators.ts` |
| **Types** | `supplier.types.ts` (inferred) |
| **Contract tests** | `supplier-contract.test.ts` (shapes, attendant blindness scan, route role matrix), `supplier-documents.test.ts`, `supplier-service.test.ts`, `tests/inventory-suppliers.test.ts` |
| **Migration** | `20260930120000_suppliers_expansion` |
| **Data model** | `DATA_MODEL.md` §4.50, §4.79–§4.83 |

Inherits §21.2 / §22.2: standard envelope, decimals as strings, hub-org scoping
(D-15 — every supplier lives on the hub org; a non-hub actor gets 403; a supplier
outside the caller's org is 404 on every sub-resource). All routes carry
`authenticate` + `requireRole`, all inputs are Zod-validated, and the service
re-checks the role (defence in depth). `SM` Store Manager · `ACC` Accountant ·
`DIR` Director · `SA` Store Attendant.

### 27.1 Endpoints

| Method | Path | Roles | Notes |
|---|---|---|---|
| `GET` | `/inventory/suppliers` | SM, ACC, DIR, SA | Query: `page`, `perPage`, `search` (name, trading name, code, contact phone), `status`, `type`, `categoryId`, `profileNotFinished=true` (only suppliers missing a profile check, §30.9), legacy `includeRetired` (default false: hides ARCHIVED unless `status` is given). **SA gets the stripped row** `{id, code, name, type, primaryPhone}` and only ACTIVE suppliers, whatever the filters. |
| `GET` | `/inventory/suppliers/:id` | SM, ACC, DIR | Detail (§27.2). `paymentMethods` are masked. |
| `POST` | `/inventory/suppliers` | SM | Extended body (§27.3). Code generated in the create transaction. |
| `PATCH` | `/inventory/suppliers/:id` | SM | Partial; `code` and `status` are not editable here. |
| `POST` | `/inventory/suppliers/quick` | SM, SA | `{name, phone, confirmDuplicate?}` → ONE_OFF supplier, address `—`, one primary contact. SA gets the stripped row, SM the list row. |
| `PATCH` | `/inventory/suppliers/:id/status` | SM | `{status, reason?}` (§27.4). |
| `GET` | `/inventory/suppliers/:id/summary` | SM, ACC, DIR | §27.7. |
| `GET` `POST` | `/inventory/suppliers/:id/contacts` | read SM, ACC, DIR · write SM | |
| `PATCH` `DELETE` | `/inventory/suppliers/:id/contacts/:cid` | SM | |
| `GET` | `/inventory/suppliers/:id/payment-methods` | SM, ACC, DIR | List — **account number masked** (`accountNumberMasked`). |
| `GET` | `/inventory/suppliers/:id/payment-methods/:pid` | SM, ACC, DIR | **Only response carrying the full `accountNumber`** (the "Show" action). |
| `POST` `PATCH` `DELETE` | `/inventory/suppliers/:id/payment-methods[/:pid]` | SM, ACC | Responses use the masked shape. |
| `GET` | `/inventory/suppliers/:id/items` | SM, ACC, DIR | Catalog rows. |
| `POST` | `/inventory/suppliers/:id/items` | SM | **Add one pack line** (§28.3). `409 PACK_LINE_EXISTS` when the line key already exists. |
| `PUT` `DELETE` | `/inventory/suppliers/:id/items/:itemId` | SM | `PUT` upserts on the **line key** `(supplier, item, buyUnit, packSize)`; optional `lineId` edits one line (§28.3). `DELETE` takes optional `?lineId=`. |
| `GET` | `/inventory/suppliers/:id/pack-mismatches` | SM, ACC, DIR | Receipt lines whose pack matched no catalog line (§28.4). |
| `GET` | `/inventory/suppliers/:id/documents` | SM, ACC, DIR | Timeline + uploads, §27.6. Query `limit` (default 100, max 200). |
| `POST` | `/inventory/suppliers/:id/documents` | SM, ACC | `multipart/form-data`: file part `file` + text fields `docType`, `docDate?` (`YYYY-MM-DD`), `note?`, `goodsReceiptId?`, `supplierInvoiceId?`. |
| `GET` | `/inventory/suppliers/:id/documents/:docId/download` | SM, ACC, DIR | `{url, expiresAt, fileName}` — signed URL, valid 5 minutes. |
| `DELETE` | `/inventory/suppliers/:id/documents/:docId` | SM | Removes the row and the stored object. |

### 27.2 Read models

**List row (`SupplierListRowSchema` = `SupplierSchema` + `profileDone`, `owedAmount`, §30.9)** — `id, code, name, tradingName, status, type,
category{id,name}|null, address, mapUrl, primaryContact{id,name,role,phone,whatsapp,email}|null,
defaultPaymentTerms, paymentDays, createdAt, updatedAt`. (The deprecated keys
`contactName`, `phone`, `email`, `location` and `retiredAt` were **removed in Session 7**, 3 Oct 2026: read
`primaryContact`, `address` and `status`.)

**Detail (`SupplierDetailSchema`)** = list row + `kraPin, vatRegistered, notes,
creditLimit (string|null), contacts[], paymentMethods[] (masked), createdBy{id,name}|null,
updatedBy{id,name}|null`.

Contact: `{id, name, role, phone, whatsapp, email, isPrimary, createdAt, updatedAt}`.
Payment method: `{id, type, isDefault, bankName, bankBranch, accountName,
accountNumberMasked, paybillNumber, accountReference, tillNumber, phone,
registeredName, createdAt, updatedAt}`; the single-method GET adds `accountNumber`.
Catalog row: `{id, inventoryItemId, itemName, itemBuyUnit, itemUsageUnit, itemConversionFactor|null, lastReceipt|null, priceAlert|null (§30.11), supplierItemName, supplierItemCode,
buyUnit, packSize, lastPrice, lastPriceAt, isPreferred, preferredNeedsConfirm}` (`lastPrice` is per **buy** unit;
`id` is the pack line's id — a supplier may have several lines for one item, §28.3).

### 27.3 Create / update bodies

`POST /inventory/suppliers`: `name` (required), `address` (required; send `—` when unknown), `tradingName?, type` (default `REGULAR`), `categoryId?, kraPin?,
vatRegistered` (default false), `notes?, mapUrl?, defaultPaymentTerms` (default
`INVOICE_TO_FOLLOW`), `paymentDays?, creditLimit?` (decimal string), `contacts?`
(array of `{name, role, phone?, whatsapp?, email?, isPrimary?}`; first, or the one
flagged, is primary), `confirmDuplicate?`. `PATCH` accepts the same fields, all
optional, at least one required.

The old write aliases (`location`, `contactName`, `phone`, `email`) are gone (Session 7): the keys are ignored, and a create with no `address` is a `400`. The archive and restore aliases `DELETE /suppliers/:id` and `POST /suppliers/:id/restore` are gone too; use `PATCH …/status`.

Enums — status `ACTIVE | ON_HOLD | ARCHIVED`; type `REGULAR | OCCASIONAL | ONE_OFF | MARKET`;
contact role `SALES_REP | ACCOUNTS | DELIVERY | OWNER | OTHER`; payment method type
`BANK_TRANSFER | MPESA_PAYBILL | MPESA_TILL | MPESA_SEND_MONEY | CASH | CHEQUE` (§28.1); document type
`INVOICE | DELIVERY_NOTE | RECEIPT | PRICE_LIST | CONTRACT | TAX_DOCUMENT | OTHER`.

Payment-method bodies are a union on `type`: bank transfer needs `bankName`,
`accountName`, `accountNumber` (`bankBranch?`); paybill needs `paybillNumber`
(`accountReference?`); till needs `tillNumber`; send money needs `phone`,
`registeredName`; cash has none. Fields foreign to the type are dropped. `type`
cannot be changed on PATCH (delete and re-add).

### 27.4 Behaviours that are contract

1. **Code** `SUPPLIER-0001…` comes from `ReferenceCounter` (prefix `SUPPLIER`, pad 4) inside the create transaction; never reused (even after a rollback or delete elsewhere), never editable.
2. **Duplicate check** on create, quick-add and rename: same normalized name (case, spaces and punctuation ignored) **and** a matching contact phone (last nine digits; or no phone on either side) → `409 DUPLICATE_SUPPLIER` with `details.matches[{id,code,name}]`; resend with `confirmDuplicate: true` to proceed. **Exception:** an *exactly* equal live name (case-insensitive) is still refused by the Milestone One unique index (`409`, "A live supplier already has exactly this name") and `confirmDuplicate` does not override it.
3. **One primary contact.** First contact is primary; `isPrimary:true` demotes the old one atomically; un-flagging or deleting the primary while other contacts exist is `409 PRIMARY_CONTACT_REQUIRED`.
4. **One default payment method** — same rules, `409 DEFAULT_METHOD_REQUIRED`. Every create/update/delete/default change writes an audit row (account numbers masked).
5. **Status.** ACTIVE ↔ ON_HOLD, any → ARCHIVED, ARCHIVED → ACTIVE/ON_HOLD. A no-op is `409 STATUS_UNCHANGED`. Archiving is `409 SUPPLIER_HAS_OPEN_INVOICES` (`details.openInvoices`) while any invoice is not fully paid; it also clears the supplier's preferred marks. ON_HOLD / ARCHIVED suppliers cannot be used for new expected deliveries or goods receipts (`409`); pass `status=ACTIVE` when filling receiving pickers. History is untouched.
6. **Preferred supplier.** `PUT …/items/:itemId {isPreferred:true}` makes this supplier the item's single preferred one and sets `InventoryItem.preferredSupplierId`; `false` clears it only if it was this supplier's. Setting `preferredSupplierId` on an item (Milestone One endpoints) marks the matching catalog row.
7. **Price sync.** Signing a goods receipt sets, in the same transaction, `SupplierItem.lastPrice` / `lastPriceAt` for every line (creating the catalog row if missing). The receipt price alert (§22.4) compares against the supplier's own `lastPrice` when one exists, otherwise the item's most recent signed receipt price from any supplier (unchanged behaviour).
8. **Attendant blindness.** The attendant never receives payment methods, KRA PIN, credit limit, terms, notes, e-mail or documents, on any supplier endpoint; a contract test scans the serialized attendant list/quick-add JSON for forbidden keys.
9. **Account numbers** appear in full only in `GET …/payment-methods/:pid`; never in lists, the detail, write responses, audit rows or error messages.

### 27.5 Errors

`400` validation · `403` role / non-hub · `404` not in org (supplier, contact, method, item, document) · `409` (duplicate, archive block, primary/default rules, status unchanged, supplier not ACTIVE for new receipts) · `422` file rejected — `FILE_TYPE_NOT_ALLOWED` (only JPEG, PNG, WebP and PDF, checked from file content, not extension or declared type) or `FILE_TOO_LARGE` (> 10 MB) · `503 STORAGE_NOT_CONFIGURED` (production without the R2 env vars).

### 27.6 Documents

`GET …/documents` returns one array of entries, newest first, each
`{kind, id, occurredAt, title, reference, amount, actor}` (`actor{id,name}|null`: who signed the receipt or recorded the invoice or payment; `null` for an upload, which names its uploader on `document`, and for a dispute) where `kind` is `RECEIPT`
(signed goods receipt), `INVOICE`, `PAYMENT`, `DISPUTE` (an invoice with a dispute) or
`UPLOAD` (which adds `document{id, fileName, mimeType, sizeBytes, docType, docDate, note,
goodsReceiptId, supplierInvoiceId, uploadedBy{id,name}, createdAt}`). The storage object key
never leaves the server. Files live in a private Cloudflare R2 bucket under
`org/<orgId>/suppliers/<supplierId>/<uuid>`; downloads are 5-minute signed URLs issued only after
the same role + org + supplier check. Without R2 env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) non-production uses an in-memory fake (files vanish on
restart); production refuses (503).

### 27.7 Summary

`{totalSpend (string), lastPurchaseAt, receiptsCount, averageDaysToPay (number|null), priceAlerts, shortDeliveries}`.
Spend / count / last date come from signed (non-cancelled) receipts; `averageDaysToPay` is the mean days from invoice
date to the last (non-reversal) payment over fully paid invoices; `priceAlerts` counts receipt lines that fired an alert;
`shortDeliveries` counts signed receipts (raised against an estimate) where an item arrived under its estimated quantity.

## 28. Inventory — Central Store catalog, suppliers and restock levels (Part B services)

Plan: `docs/features/inventory/central-store/catalog-suppliers-restock-plan.md` §3 (B1–B8).
Migration: `catalog_cheque_and_pack_lines` (Session 1) and `receipt_line_pack_and_preferred_audit`
(Session 2). All changes are additive; existing request shapes keep working.

### 28.1 Cheque payment method (B1)

`POST /inventory/suppliers/:id/payment-methods` accepts `type: "CHEQUE"`:
`registeredName` (**payable to**, required), `bankName` (required), `note?`, `reason` (**required**, ≤ 300 chars; never stored on the method, written to the audit row and the notification; required for every type since §30.10),
`isDefault?`.
`PATCH …/payment-methods/:pid` may change `registeredName`, `bankName`, `note` on a cheque method.

Payment-method read shape gains `note: string | null`. Creating a cheque method writes the usual
`PAY_METHOD_CREATED` audit row whose `after` carries `summary: "cheque method added"` and the `reason`,
and notifies every active **Accountant** of the hub (socket event `supplier:cheque-method-added` +
FCM push, fire-and-forget, never fails the request).

### 28.2 Cheque payments (B2)

`POST /inventory/supplier-payments`: `method` is now `BANK | CASH | MPESA | CHEQUE`. For `CHEQUE`,
`reference` is the **cheque number** and is required (`400` otherwise). The response gains
`duplicateChequeNumber: boolean` — true when another non-reversal CHEQUE payment to the **same
supplier** already carries the same number (trimmed, case-insensitive). It is a warning flag only; the
payment is still recorded (`201`). Every other payment read returns `method` + `reference` unchanged,
so the payment advice and the closed purchase file print "Cheque" and the number from those two
fields (print is front-end work, Session 3). `SupplierPayment.method` in responses is the same
four-value enum (the separate read-only enum is gone).

### 28.3 Pack lines (B3, B5, B8)

A supplier may sell one item in several packs. The **line key** is
`(supplier, item, buyUnit, packSize)`; a missing `buyUnit` and `''` are the same, a missing `packSize`
and `0` are the same (as the database index `supplier_items_line_key`). Matching is exact otherwise.

- `POST …/items` body `{inventoryItemId, supplierItemName?, supplierItemCode?, buyUnit?, packSize?, isPreferred?}`
  → `201` catalog row. `buyUnit` defaults to the item's buy unit. If the key already exists:
  `409 PACK_LINE_EXISTS`, message e.g. `"Samrat already has this pack: Sugar white · bag · 50 (their code 190035)"`,
  `details.existingLine` = the catalog row.
- `PUT …/items/:itemId` body adds optional `lineId`.
  - With `lineId`: edits that line (`404` if it is not this supplier's line for this item). Changing
    `buyUnit`/`packSize` to another existing line's key → `409 PACK_LINE_EXISTS` naming that line.
  - Without `lineId`, with `buyUnit` and/or `packSize`: matches on the full key; found → updates it,
    not found → creates a new line (this is what Add several uses; re-adding never duplicates).
  - Without `lineId`, `buyUnit` or `packSize` (the legacy shape, e.g. `{isPreferred:true}`): targets the
    supplier's oldest line for the item, or creates one when none exists (unchanged behaviour).
  - Only fields present in the body are changed (an omitted name/code is no longer wiped).
- `DELETE …/items/:itemId[?lineId=]`: with several lines for the item and no `lineId` → `409 MULTIPLE_PACK_LINES`.
- `supplierItemName` / `supplierItemCode` (B5) are optional on POST and PUT, and are returned on: the
  supplier catalog rows, `GET /inventory/items/:id` (`suppliers[]`, below), goods-receipt lines and
  expected-delivery lines (`supplierItemName`, `supplierItemCode`: the matched pack line's, else null).
  Internal screens show **our** name as primary and theirs as secondary.
- `GET /inventory/items/:id` gains `suppliers: [{lineId, supplierId, supplierCode, supplierName,
  supplierItemName, supplierItemCode, buyUnit, packSize, lastPrice, lastPriceAt, isPreferred,
  preferredNeedsConfirm}]` (SM only endpoint, as today).
- **Preferred (B8).** `preferredNeedsConfirm` is true on a line seeded as "Preferred · confirm". Setting
  a line preferred (`PUT {isPreferred:true[, lineId]}`) or confirming one that is already preferred (the
  same call) clears it. Clearing preferred, or another line becoming preferred, also clears it. Each
  set or confirm writes a supplier audit row `PREFERRED_SET` / `PREFERRED_CONFIRMED` (`entityId` = line id,
  `before`/`after` = `{inventoryItemId, lineId, preferredNeedsConfirm}`). Only one line per item is ever
  preferred (database index), including two lines of the same supplier.

### 28.4 Receipt price follows the pack (B4)

Goods-receipt lines (`POST`/`PATCH /goods-receipts`) accept optional `packBuyUnit` and `packSize`
(what the goods were bought in); both are stored and returned, with `packNotOnFile: boolean`.
Signing a receipt always posts stock and updates `InventoryItem.currentCost` as before. The
**supplier's catalog price** is written like this, per line:

1. The supplier has **no** line for the item → a line is created (as before), keyed by the receipt line's pack (else the item's buy unit).
2. The receipt line names a pack → the line with the same full key gets `lastPrice`/`lastPriceAt`. No match → **no price is written** and the receipt line is stamped `packNotOnFile = true`.
3. The receipt line names no pack → the supplier's single line for the item is used; with two or more lines it is ambiguous, so no price is written and the line is flagged (never guessed).

The receipt price alert compares against the same matched line's `lastPrice` (not another pack's).
`GET /inventory/suppliers/:id/pack-mismatches` (SM, ACC, DIR) lists flagged receipt lines of that
supplier that **still** match no catalog line:
`[{receiptLineId, goodsReceiptId, reference, signedAt, inventoryItemId, itemName, packBuyUnit, packSize, unitPrice}]`,
newest first; adding the missing pack line removes the row.

### 28.5 Catalog search (B6)

`GET /inventory/items?search=` (the parameter keeps its name `search`) matches, case-insensitively: the
item name (partial), a supplier's **item code** (exact) and a supplier's **item name** (partial).
Each list row gains `matchedOn: {supplier: {id, name}, field: "supplierItemCode" | "supplierItemName", value} | null`
— null when the item's own name matched or no search was given; otherwise the first supplier line that matched.

### 28.6 Supplier-facing documents (B7)

`GET /inventory/expected-deliveries/:id/supplier-document` (SM) → `{lpo, whatsapp}`; `409` when the
estimate has no supplier. Each line shows **the supplier's name and code first**, our item second, and
falls back to ours when the supplier has no name on file.

```
lpo: { reference, createdAt, expectedDate|null,
       supplier: {id, code, name, address, contactName|null, phone|null},
       lines: [{lineNo, itemName (ours), supplierItemName|null, supplierItemCode|null,
                displayName, displayCode|null, ourItemLabel|null,
                quantity, buyUnit, estimatedUnitPrice, lineTotal}],
       estimatedTotal }
whatsapp: { to: phone|null, body }
```
`displayName` = supplier name ?? ours; `ourItemLabel` = `"Our item: <ours>"` only when `displayName` is
the supplier's. Body: one line per item `"1. <displayName> (<code>) — <qty> <unit>"` followed by
`"   Our item: <ours>"`. No prices in the message. The phone "Check the goods" screen is unchanged
(our name only). Internal endpoints return both names, ours primary.

## 29. Inventory — Central Store catalog, suppliers and restock levels (Part B services, B9–B13)

Plan: `docs/features/inventory/central-store/catalog-suppliers-restock-plan.md` §3 (B9–B13).
Migration: `restock_level_changes` (Session 3, owner-approved: the History / Put-back screens need
a real change log). Everything else is additive. SM = Store Manager, SA = Store Attendant,
DH = department head (a marker on a base role, not a role), ACC = Accountant, DIR = Director.
Hub scoping (D-15) is unchanged: every call below except a DH's own-department restock call needs a
hub-org actor, and a non-hub actor gets `403`.

### 29.1 Housekeeping (B9)

No change to request or response shapes. `HOUSEKEEPING` is a `DepartmentTag` (and was already accepted
by the item `departmentTags` / list `departmentTag` filters, restock levels, requisitions, dispatch,
branch day and department-head assignment). A Housekeeping head is `isDepartmentHead = true` +
`departmentTag = "HOUSEKEEPING"` on a base role (`HOUSEKEEPING` or any other); there is no new
`UserRole` value. Restock-level scoping resolves their branch's Housekeeping location exactly as it
does for Kitchen.

### 29.2 Restock levels for any department (B10)

`GET` and `PUT /inventory/restock-levels` (SM, DH) — the existing `locationId` form keeps working. The
Store Manager may instead name **whose levels** with:

| Field | Meaning |
|---|---|
| `scope` | `"CENTRAL_STORE"` or a `DepartmentTag` (`KITCHEN`, `PASTRY`, `BARISTA`, `SERVICE`, `HOUSEKEEPING`) |
| `branchId` | The branch organization. **Required** when `scope` is a department (each branch has its own Kitchen, Pastry …); **rejected** (`400`) with `CENTRAL_STORE` |
| `reason` | PUT only, optional, ≤ 200 chars. Stored on each change row |

Rules: `locationId` and `scope` are mutually exclusive (`400`); a SM must send one of them. A department
scope resolves the branch's `BRANCH_DEPARTMENT` location for that tag (`404` if the branch has none,
`400` if `branchId` is the hub or unknown). Only items tagged for that department can be given a level
(`403`, as for a DH). A DH may send neither field (`403` otherwise) and stays limited to their own department.
Responses are the existing `RestockLevelRow[]`, with these **additive** fields on every row:

`status: "OUT" | "LOW" | "OK" | "NO_LEVEL"` — `NO_LEVEL` when no level is set; `OUT` when a level is set and
`onHandQty ≤ 0`; `LOW` when a level is set and `0 < onHandQty < level`; else `OK` (`isBelowLevel` = `OUT` or `LOW`).
`suggestedLevel: string | null`, `suggestionNote: "NEEDS_HISTORY" | null` — see §29.5.

**Change log.** Every save (SM or DH, and the inline level on item create/update) writes one
`restock_level_changes` row per level that actually changed, in the same transaction as the upsert:
`{id, organizationId (the location's org), locationId (for whom), inventoryItemId, oldLevel|null,
newLevel|null (null = cleared), changedById (who), reason|null, createdAt}`. An unchanged level writes nothing.
(No read endpoint this session; the History / Put-back screen is Part C.)

### 29.3 Summary strips (B11)

All counts are integers; money is a decimal string. Nothing here is cached.

**Catalog** — `GET /inventory/items` `meta` gains `needsSetup`, `lowOrOut`, `addedThisWeek` (alongside the
existing `itemsTracked` …). `lowOrOut` is `null` for anyone but SM (restock levels are not for the SA / DH).
Counts cover **all live items**, regardless of the list's filters.

- **Needs setup** = a live item with *placeholder units from seeding*: `lower(trim(usageUnit)) = lower(trim(buyUnit))`
  **and** `packSize IS NULL` **and** `conversionFactor IS NULL`. Entering a conversion factor (even `1`) or a pack
  size takes it out of the set. *Known limit: with no schema flag, a genuine "bought and used in the same unit
  with no conversion" item also counts until a conversion factor is entered — flagged to the owner.*
- **Low or out** = Central Store items with a level set and `onHand < level` (= `LOW` + `OUT` in §29.2).
- **Added this week** = live items created in the last 7 × 24 h.
- The list takes `needsSetup=true` (new query flag): only those items, **oldest `createdAt` first** (then `id`).

**Restock levels** — `GET /inventory/restock-levels/summary` (SM, DH; same `locationId` / `scope` / `branchId`
query as the list) → `{total, out, low, ok, noLevel, suggestionsDiffer}`; `total` = rows, the four statuses sum to it.
`suggestionsDiffer` is defined in §29.5.

**Suppliers** — `GET /inventory/suppliers/summary` (SM, ACC, DIR; registered before `/:id`) →
`{active, onHold, profileNotFinished, owedAmount (string), suppliersOwed}`. `active` / `onHold` count by `status`
(archived excluded from everything). `profileNotFinished` counts non-archived suppliers missing any of the **7** profile
checks (matches the drawn "Profile 4 of 7" for a new supplier): name · type · phone (primary contact) · address (not
blank / "—") · **contact person** (a contact whose name differs from the supplier's name) · **payment details**
(≥ 1 pay method) · KRA PIN. `owedAmount` = Σ over all non-archived suppliers' invoices of
`amountBilled + Σ adjustments − Σ allocations`, counting only invoices with a positive balance; `suppliersOwed` = how many
suppliers have such an invoice.

**Supplier Catalog tab** — `GET /inventory/suppliers/:id/catalog-summary` (SM, ACC, DIR) →
`{itemsTheySell, priceAlerts, lastReceiptAt|null, spend90Days (string)}`. `itemsTheySell` = distinct items on their
catalog lines; `priceAlerts` = lines with a price alert on signed receipts from the last 90 days; `lastReceiptAt` = latest
`signedAt` of a signed receipt (any age); `spend90Days` = Σ `receiptTotal` of signed, non-cancelled receipts signed in the
last 90 days. `404` for a supplier outside the hub org.

### 29.4 Attendant item creation (B12) and attendant blindness

`POST /inventory/items` is now **SM, SA**. For an SA the service enforces:

- `type` must be `STOCKED` or `RAW_INGREDIENT`; `PREPPED` → **`403`** (a permission rule, not a field error).
- Allowed body fields: `name, type, buyUnit, usageUnit, conversionFactor, packSize`. Sending
  `categoryId`, `categoryName`, `preferredSupplierId`, `departmentTags` (non-empty) or `centralStoreRestockLevel`
  → `403` (the SM finishes those; the item shows under *Needs setup*).
- The response `data.item` omits `currentCost`, `centralStoreRestockLevel`, `preferredSupplier`, `preferredSupplierId`.
  The SA read paths (`GET /inventory/items`, `GET /inventory/items/:id`) now omit the same four keys (and, on
  `:id`, the supplier lines' prices) — **a behaviour change**: before this session they leaked them.

### 29.5 Suggested restock level (provisional — formula needs the owner's sign-off)

Used by §29.2 rows and the `suggestionsDiffer` count. Constants live in `restock-suggestion.ts`.

- *Use* at a location = −(Σ ledger `quantity`) of types `PREP_CONSUME`, `DISPATCH_OUT`, `WASTE`, `SALE` (reversals net out).
- *History* = days from the item's first use row at that location to now. Under **14 days** → `suggestedLevel = null`,
  `suggestionNote = "NEEDS_HISTORY"` ("Needs 14 days of use first"). No use at all → `suggestedLevel = null`, note `null`.
- Otherwise `avgDaily = use in the last min(30, history) days ÷ that many days`; `suggestedLevel = ceil(avgDaily × 15, 2dp)`
  (15 days of cover for every item — per-item cover is an open owner question).
- **Suggestions differ** = a level is set, a suggestion exists, and `|suggested − level| > 20 % of level`
  (a level of 0 differs whenever a suggestion > 0).

### 29.6 Review-a-change summary (B13)

`GET /inventory/items/:id/change-review` (SM) — for the unit / pack / type / retire "Review change" step. The plan said to
extend an existing summary; **none existed**, so this is a new endpoint. Always returns every count, zero when empty,
never `null` or missing:

`{inventoryItemId, itemName, onHandQty (string, all locations), locationsHoldingStock, stockEntries (ledger rows),
receipts (distinct goods receipts that include the item), receiptLines, openOrders (distinct AWAITING expected
deliveries with the item), hasHistory}`.
`hasHistory` is false exactly when `stockEntries`, `receiptLines` and `openOrders` are all 0 (the "no history" wording, 9b).
`404` for an unknown item / other org; `403` for a non-hub actor.

---

## 30. Inventory — Central Store catalog, suppliers and restock levels (backend gaps, Session 4b)

Plan: `docs/features/inventory/central-store/session-4-log.md` ("Deferred to the backend session") plus the restock history
and put-back that Session 5 needs. Migration `item_history_price_source` (one: `inventory_item_changes`, `supplier_items.last_price_set_by_id`,
audit action `LINE_PRICE_SET`). Everything else is additive. SM = Store Manager, SA = Store Attendant, DH = department head.
Hub scoping (D-15) is unchanged: every call below needs a hub-org actor except a DH's own-department restock calls.

### 30.1 Catalog list and detail additions

`GET /inventory/items`
- New query: `sort` = `name` (default) | `newest` (newest `createdAt` first, then `id`); `lowOrOut=true` = only Central Store items with a level
  set and on-hand below it (`LOW` + `OUT`, §29.2) — **SM only**, `403` for anyone else. With `needsSetup=true` the two filters intersect;
  `needsSetup` alone still lists oldest first unless `sort` is given.
- Each row gains `supplierCount` (integer: suppliers with at least one catalog line for the item; all roles) and `matchedOn.supplierItemName`
  (the matched line's name for the item, or `null`) — so a code match can show "Their name: …".
- `meta` gains `typeCounts: {STOCKED, RAW_INGREDIENT, PREPPED}` (live items, regardless of the list's filters) and `addedByAttendant`
  (live items created in the last 7 × 24 h whose creator was a Store Attendant; items made before item history existed count as 0).

`GET /inventory/items/:id` (SM, SA)
- SM only: `centralStoreOnHand` (string; on-hand at the Central Store only, from the ledger, may be negative; `"0"` when none).
- `suppliers[].lastPriceSetBy: {id, name} | null` — who set the price by hand; `null` when it came from a signed receipt or is unset. Omitted for SA
  (with the other price fields, §29.4).

### 30.2 Usual price on item create

`POST /inventory/items` body gains optional `usualPrice` (positive decimal, **per buy unit**). **SM only**: an SA sending it gets `403`
(money field, §29.4). The service stores `currentCost = usualPrice ÷ (conversionFactor ?? 1)` (per usage unit, 4 dp). It does **not** create a
supplier line. It is written in the item's history (`CREATED`, `after.usualPrice`).

### 30.3 Hand-set supplier price

`POST /inventory/suppliers/:id/items` and `PUT /inventory/suppliers/:id/items/:itemId` bodies gain optional `price` (positive decimal, **per the
line's buy unit**; cannot be cleared). SM only (as today). Effects, in the same transaction as the line write:
- `lastPrice = price`, `lastPriceAt = now`, `lastPriceSetById = actor`.
- Supplier audit row `LINE_PRICE_SET`: `entityId` = line id, `before`/`after` = `{inventoryItemId, lineId, price}` (`before.price` null when none).
- Item history row `SUPPLIER_PRICE_SET`.
- A later signed receipt overwrites the price exactly as before **and clears `lastPriceSetById`** (the source is then the receipt).
- Catalog rows (supplier Catalog tab) and `GET /items/:id` `suppliers[]` carry `lastPriceSetBy`.
- `price` sent unchanged (equal to the current price) writes nothing.

### 30.4 Item history and reasons

Table `inventory_item_changes`: `{id, organizationId, inventoryItemId, kind, summary, before, after, reason, changedById, createdAt}`.
Kinds: `CREATED`, `UPDATED`, `RETIRED`, `RESTORED`, `SUPPLIER_ADDED`, `SUPPLIER_PRICE_SET`. One row per action, written in the same transaction
as the change. `summary` is a sentence **without the actor** ("added Samrat Supermarket Ltd at KES 8,900 per bag, preferred"); the screen
shows `"{changedBy.name} {summary}"`, except `CREATED`, which it shows as "Created by {name}".

| Action | kind | summary example |
|---|---|---|
| `POST /items` | `CREATED` | `created the item` |
| `PATCH /items/:id` | `UPDATED` (only when something changed) | `changed the pack from 1 bag = 25 kg to 1 bag = 24 kg; renamed it from Wheat flour to Wheat flour 2` |
| `DELETE /items/:id` | `RETIRED` | `retired the item` |
| `POST /items/:id/restore` | `RESTORED` | `restored the item` |
| supplier line added (`POST …/items`, or `PUT` that creates) | `SUPPLIER_ADDED` | `added Samrat Supermarket Ltd (bag of 50 kg) at KES 8,900 per bag, preferred` |
| price set by hand | `SUPPLIER_PRICE_SET` | `set Samrat Supermarket Ltd's price to KES 9,100 per bag (was KES 8,900)` |

`reason` (optional, ≤ 200 characters, never required): `PATCH /items/:id` body field; `DELETE /items/:id?reason=`; `POST /items/:id/restore` body
`{reason?}`. It is stored on the history row. An update whose only field is `reason` is rejected (`At least one field must be provided`).

`GET /inventory/items/:id/history?limit=` (SM; `limit` 1–200, default 50) → newest first:
`[{id, kind, summary, reason, before, after, changedBy: {id, name}, createdAt}]`. `404` unknown item / other org; `403` non-hub.
`before` / `after` hold only the fields that changed. No restock-level changes appear here (they have their own history, §30.5).

### 30.5 Restock level history and put back

`GET /inventory/restock-levels/history` (SM, DH). Same scope query as the list (`locationId`, or `scope` + `branchId`; a DH sends neither and gets their
own department), plus `inventoryItemId` (one item) and `limit` (1–200, default 50). Newest first:
`[{id, inventoryItemId, itemName, usageUnit, oldLevel | null, newLevel | null, reason | null, changedBy: {id, name}, createdAt}]`.
Without `inventoryItemId` it is the location's recent changes across items (the department head's "Your recent changes").

`POST /inventory/restock-levels/changes/:changeId/put-back` (SM, DH), optional body `{reason?}` (≤ 200, default `"Put back"`). Restores the level the
change replaced (`oldLevel`) and writes a **new** history entry; the old entry stays. Returns the new entry (same shape as above).
- `400` when the change had no earlier level (`oldLevel` null): nothing to put back.
- `409` when the level is already at that value.
- `404` unknown change / other org / retired item. A DH may only put back changes at their own department's location (`403` otherwise); an SM may
  put back at any location in the hub scope (Central Store or a branch department they can see).

### 30.6 Branches for "Whose levels" (Session 5, owner-approved 3 Oct 2026)

`GET /inventory/restock-levels/branches` (SM; hub-scoped, a non-hub actor gets `403`) → `[{id, name}]` — active branch organizations, hub excluded,
oldest first. The Store Manager picks one next to a department chip on the Restock levels page; the chosen `id` is sent as `branchId` with `scope` (§29.2).
`GET /branches` is not usable for this: it is for Director / Admin / Accountant / HR and returns profile fields (KRA PIN, M-Pesa) a Store Manager has no need for.

### 30.7 Item type on restock rows (Session 5 follow-up)

Every `RestockLevelRow` (§29.2, list and save responses) gains `itemType: "STOCKED" | "RAW_INGREDIENT" | "PREPPED"`, the item's own type. The Restock levels page
shows "kg · Prepped" under the unit for Prepped items. Additive; no other change.

### 30.8 Days of cover per item (Session 5 follow-up, owner-approved 3 Oct 2026)

Migration `add_item_days_of_cover`: nullable `inventory_items.days_of_cover` `Decimal(6,2)`. Null means the default of 15 (§29.5).

- **Item** (`InventoryItem`, create `POST /inventory/items` and update `PATCH /inventory/items/:id`): `daysOfCover: string | null`, a decimal greater than 0 and at most 365, up to 2 decimals (`"1.5"`, `"5"`). `null` on an update clears it. Store Manager only: omitted from the Store Attendant's item responses, and a Store Attendant who sends it on create gets `403` ("The Store Manager sets … days of cover").
- **Suggestion** (§29.5): `suggestedLevel = ceil(avgDaily × daysOfCover, 2dp)` using the item's own `daysOfCover`, or 15 when it has none. "Suggestions differ" uses the same suggestion.
- **Restock row** (§29.2, §30.7): gains `daysOfCover: string`, the days the suggestion used (the item's, or `"15"`), so a screen can write "12 kg a day, 5 days of cover".
- **Item history** (§30.4): a change is logged as "set the days of cover to 5", "changed the days of cover from 5 to 1.5" or "cleared the days of cover (back to 15)".
- Not modelled: meal services ("at lunch"). The page says "{n} a day" only.

### 30.9 Profile and owed on the suppliers list (Session 6, owner-approved 3 Oct 2026)

`GET /inventory/suppliers` (SM, ACC, DIR; the attendant's stripped row is unchanged):
- Each row gains `profileDone` (integer 0 to 7: how many of the seven profile checks of §29.3 pass) and `owedAmount` (KES, decimal string: the sum of the
  supplier's invoices that still have a positive balance, the same rule as the strip). They are worked out for every status, archived included.
- New query flag `profileNotFinished=true`: only non-archived suppliers missing at least one check. It is resolved over all live suppliers first, then
  `status`, `type`, `categoryId`, `search` and paging apply on top, so `pagination.total` is the filtered count. Ignored for the attendant.

### 30.10 Payment details: reason, Accountant notice and history (Session 6, owner-approved 3 Oct 2026)

- `POST …/payment-methods` now requires `reason` (≤ 300 chars) for **every** type, not only `CHEQUE`; a missing or blank one is `400`. It goes to the
  audit row's `after.reason`, never onto the method.
- `PATCH …/payment-methods/:pid` accepts `reason` and **requires it whenever any detail field is sent**; a body that only toggles `isDefault` needs none.
  A body that is only a `reason` is `400`.
- The hub's Accountant(s) (never the actor) are told on every add (a cheque keeps `supplier:cheque-method-added`; any other type) and on every change of
  details: socket event `supplier:pay-method-changed` `{supplierId, supplierName, changedByName, summary, reason}` plus an FCM push. Fire-and-forget; never
  fails the request. Making a method the default, and removing one, tell nobody.
- `GET /inventory/suppliers/:id/payment-methods/history` (SM, ACC, DIR; registered before `/:pid`) → the 50 most recent payment-method audit rows,
  newest first: `[{id, at, action, summary, reason|null, actor{id,name}}]`. `summary` is built from the masked audit snapshots in plain words
  ("Added cheque, payable to Samrat Supermarket Ltd", "Changed the account number on the bank transfer"); no account number or digit of one appears.
  `reason` is null for rows written before this change. Attendant: `403`.

### 30.11 Catalog tab extras (Session 6, owner-approved 3 Oct 2026)

Every supplier catalog row (`GET/POST/PUT …/suppliers/:id/items`) gains:
- `itemUsageUnit` (the item's usage unit, "kg") and `itemConversionFactor` (decimal string or null): so the pack reads "50 kg bag" and the price "per kg".
- `lastReceipt: {id, reference} | null`: the signed receipt that set the current price (`lastPriceAt` equals its `signedAt`). Null when the price was set by hand or is unset.
- `priceAlert: {pct, previousPrice|null, previousAt|null} | null`: the newest price alert fired on this pack by a signed receipt in the last 90 days (`pct` is the rise
  as a percentage, `previousAt` the date of the supplier's earlier receipt for the item). A receipt line that names a pack belongs to the line with exactly that key;
  one that names none belongs to the item's only line, never guessed between two.

`lastReceipt` and `priceAlert` are filled in by the list (`GET …/items`) only; the add and edit responses return them as `null`.

### 30.12 Audit log (Session 7, owner-approved 3 Oct 2026)

`GET /inventory/audit-log` (SM, ACC, DIR; hub only, `403` otherwise). One read-only list of what changed in the **Catalog**, **Suppliers**
and **Restock levels**, newest first, with who, when and why. Query: `area` (`CATALOG | SUPPLIERS | RESTOCK_LEVELS`; omit for all),
`actorId`, `from` (ISO timestamp, inclusive), `to` (exclusive; `from` must be before it), `page` (default 1), `perPage` (1–100, default 50).

Response `data`: `{entries[], actors[], pagination{total, page, perPage, totalPages}}`.
- `entries[]`: `{id, at, actor{id,name}, area, what, reason|null}`. `id` is prefixed by its source (`item:`, `supplier:`, `created:`, `restock:`).
  `what` is a plain sentence ("Retired Sugar, brown", "Samrat: put on hold", "Kitchen · Nyeri Town: Chapati dough 12 → 14 kg"); no account number can appear in it.
  `reason` is the reason stored on the source row (item history reason, supplier status or payment-detail reason, restock change reason).
- `actors[]`: everyone who changed something in the period (ignoring `actorId`), for the "Who" filter.

Sources: `inventory_item_changes` (Catalog), `supplier_audit_logs` and supplier creation (`suppliers.created_by_id`) (Suppliers),
`restock_level_changes` (Restock levels: the Central Store, and every branch department the hub's branches own). Every read is filtered by
organization: the hub for the first three, the hub and its active branches for restock changes.

### 30.13 Central Store access (Session 7 roles pass, owner-approved 3 Oct 2026)

Every role list in §27–§30 and §22 (suppliers, catalog, restock levels, what we owe, the audit log) is now a **capability** check against one table
(`backend/src/modules/inventory/_shared/central-store-access.ts`). The role lists written in the tables above describe the **old** access; the rule now:

- Every desktop role (Store Manager, Accountant, Director, Branch Manager, System Admin) **reads** every Central Store endpoint above, except supplier payment details, which the Branch Manager does not get (`403` on `…/payment-methods*`; the supplier detail returns `paymentMethods: []` and `paymentMethodCount`).
- **Writes:** Store Manager and System Admin write the catalog, restock levels and suppliers; the Accountant also records supplier invoices, payments, adjustments, payment methods and documents (`POST /supplier-invoices` is now Accountant, Store Manager, System Admin); the Director and Branch Manager write nothing.
- The Store Attendant: `GET /items`, `GET /items/:id` (price-free), `POST /items` (§29.4), `GET /suppliers` (stripped), `POST /suppliers/quick`. Nothing else. Item history and the change-review are not theirs.
- A department head's `GET /items` is price-free, like the attendant's.
- Hub rule (D-15): reads are open to any role holding `central_store.read_any_org` from outside the hub; writes need the hub organization, except the System Admin (no organization).
- `GET /inventory/permissions/me` (any signed-in user) → `{role, isDepartmentHead, capabilities[]}`: the capabilities that role holds. The front end uses it for the sidebar, the page gate and every Edit/Add/Record button.
- Supplier detail gains `paymentMethodCount` (additive).

---

## 31. Inventory — Purchasing and Receiving (mock-first)

**Status: built on the server (6 Oct 2026), not yet used by the front end (Step 4 swaps the mock for it).** The shapes below are the mock's; §31.9 lists where the built API differs. The old `/inventory/expected-deliveries`, `/inventory/goods-receipts`, `/inventory/purchasing/{summary,history}`, `/inventory/receiving/history` and `/inventory/ap/*` routes are **removed** (§22 to §30 describe them as history only). Rules in plain English: `docs/features/inventory/purchasing-mock/backend-rules.md`. Screens: `…/screen-inventory.md`. Choices still open are Q-01 to Q-13 there; where a shape depends on one it says so.

**Conventions.** Base `/inventory/purchasing`. Standard envelope (§1). Decimals cross the wire as **strings** (`"13776.00"`, quantities `"82.000"`); ids are strings; timestamps ISO 8601 UTC; dates `YYYY-MM-DD`. Every route has `authenticate` and a `requireCapability(...)` (never `requireRole`); hub rule D-15 applies as for the rest of the Central Store (reads: `requireHubReader`; writes: `requireHubActor`). `PIN` fields are the actor's own PIN (an approver's, where stated), 4 to 6 digits, never logged or returned. Capabilities: `orders.read` (proposed, Q-13), `orders.request`, `orders.approve`, `orders.cancel`, `orders.receive`, `payables.record_deposit`, `payables.record_invoice`, `payables.record_payment`, `payables.read`. SM = Store Manager, SA = System Admin, ATT = Store Attendant, ACC = Accountant.

### 31.1 Types

`OrderStatus` = `DRAFT | AWAITING_APPROVAL | RETURNED | APPROVED | SENT | DELIVERED | INVOICED | CLOSED | CANCELLED`.
`Stage` (tabs) = `NEEDS | APPROVAL | RECEIVE | INVOICE | PAY | CLOSED`.
`PayMethod` = `BANK_TRANSFER | MPESA_PAYBILL | MPESA_TILL | MPESA_SEND_MONEY | CHEQUE | CASH` (§28.1).
`LineResult` = `AS_ORDERED | PRICE_CHANGED | SHORT | NOT_SUPPLIED`.

```
OrderLine {
  id, inventoryItemId, itemName, supplierItemName | null, supplierItemCode | null,
  buyUnit, packSize | null, orderedQty: string, unitPrice: string, lineTotal: string,
  previousPrice: string | null,            // last order's price for this supplier line, for the "▲ 4%" flag; null for ATT callers (Q-02)
  receivedQty: string | null, confirmedPrice: string | null, result: LineResult | null
}
Order {
  id, reference: string | null,            // "LPO-0044"; null for a draft (Q-05)
  status: OrderStatus, stage: Stage,
  supplier: {id, name, code, contactName | null, whatsapp | null, termsDays: number | null},
  raisedBy: {id, name, role}, raisedAt, submittedAt | null,
  approvedBy: {id, name, role, signedAt} | null,
  returnedNote: string | null, returnedBy: {id, name} | null,
  sentAt | null, sentVia: 'WHATSAPP' | 'PRINT' | 'LINK' | 'MANUAL' | null,
  expectedDate | null, supplierNote: string | null, attendantNote: string | null,
  lines: OrderLine[], orderedTotal: string,
  deliveredTotal: string | null, delivery: Delivery | null,
  invoice: Invoice | null, payments: Payment[],
  money: {ordered, delivered | null, invoiced | null, paid, stillToPay},   // strings; omitted entirely for ATT callers
  dueLabel: 'DUE_TODAY' | 'OVERDUE' | 'UPCOMING' | null, dueInDays: number | null,
  cancelled: {reason, note | null, by: {id, name}, at} | null,
  tracker: [{step: 'RAISED'|'APPROVED'|'SENT'|'DELIVERED'|'INVOICED'|'PAID', state: 'DONE'|'CURRENT'|'TODO', at | null, note | null}],
  can: {edit, submit, approve, return, send, cancel, receive, recordDeposit, addInvoice, recordPayment}   // booleans for THIS caller and state
}
Delivery { id, reference ("GRN-0012"), deliveryNoteNo, photo: FileRef | null, receivedBy: {id, name, role}, receivedAt, deliveredTotal: string, notSuppliedTotal: string }
Invoice { id, number, date, dueDate, amount, status: 'OPEN'|'PAID'|'VOIDED', disputed: boolean, varianceAmount: string | null, varianceReason: string | null, advanceApplied: string, balance: string, photo: FileRef | null, enteredBy: {id, name}, enteredAt }
Payment { id, reference ("PAY-0031"), kind: 'ADVANCE'|'INVOICE'|'REVERSAL', amount, paidOn, method: PayMethod, methodRef: string | null, chequeNo: string | null, status: 'RECORDED'|'REVERSED', reversesId: string | null, recordedBy: {id, name}, recordedAt }
FileRef { id, fileName, size: number, thumbnail: string | null }
```

Money fields (`unitPrice`, `lineTotal`, `previousPrice`, `confirmedPrice`, `money`, `deliveredTotal`, `invoice`, `payments`) are **removed** from responses to a caller without `payables.read` (the Store Attendant), and an ATT receiving response carries `priceChanged: boolean` per line instead of figures (Q-02 default).

### 31.2 Reads

| Method | Path | Capability | Notes |
|---|---|---|---|
| `GET` | `/summary` | `orders.read` or `orders.request` | `{counts: {needs, approval, receive, invoice, pay, closed}, awaitingApprovalValue, dueToReceiveCount}` for the tab badges and sidebar |
| `GET` | `/needs-restocking` | `orders.read` or `orders.request` | Query `group=supplier\|item` (default `supplier`), `supplierId`, `q`, `sort=urgent\|name\|value`. ATT callers get Low and Out only and no prices. Response `{itemCount, supplierCount, groups[]}`; group `{supplier \| null, termsLabel, itemCount, estimatedTotal, lines[]}`; line `{inventoryItemId, itemName, subLabel, status: 'LOW'\|'OUT', onHand, level, usageUnit, supplierOptions[{supplierId, name, lastPrice, lastBoughtAt \| null, preferred, cheaperBy \| null}], chosenSupplierId \| null, suggestedQty, buyUnit, lastPrice, estimatedTotal}` |
| `GET` | `/orders` | `orders.read`, or `orders.request` / `orders.receive` (own orders for ATT) | Query `stage`, `supplierId`, `raisedBy`, `q`, `page`, `perPage` (default 50). `{orders: OrderRow[], total, valueTotal}`; row = Order without `lines` plus `itemSummary` ("2 items · chicken breast, chicken wings") |
| `GET` | `/orders/:id` | as above | The purchase file: `Order` plus `documents: [{kind: 'LPO'\|'DELIVERY_NOTE'\|'INVOICE'\|'PAYMENT_ADVICE', title, at, fileRef \| null}]` and `activity: [{at, actor: {id, name}, what}]` |
| `GET` | `/orders/:id/lpo` | `orders.read` or `orders.request` | Print data: letterhead, reference, date, supplier address and contact, terms, expected date, deliver to, raised by, lines (supplier name and code first, "Our item" second), total, amount in words, notes, signatures `{name, role, signedAt}` for Raised by and Authorised by, link for the QR |
| `GET` | `/orders/:id/whatsapp` | `orders.approve` or `orders.request` | `{to, phone, message, pdfFileName, pdfSizeLabel}`; the link to open is built on the client |
| `GET` | `/catalog` | `orders.request` | Query `supplierId`, `q`, `category`, `filter=low\|all\|selected`; the supplier's catalog lines for New order: `{items[{inventoryItemId, itemName, category, status: 'LOW'\|'OUT'\|'OK', onHand, level, soldAs, price, qty \| null}], shown, total}` |

### 31.3 Order writes

| Method | Path | Capability | Body → result |
|---|---|---|---|
| `POST` | `/orders` | `orders.request` | `{supplierId, expectedDate \| null, supplierNote \| null, attendantNote \| null, lines[{inventoryItemId, qty, unitPrice}]}` → `Order` in `DRAFT`. `409 SUPPLIER_ORDER_OPEN` (Q-07) with `{openOrderId, openReference}`; `409 SUPPLIER_ON_HOLD`; `409 ITEM_SETUP_INCOMPLETE`; `422` for no lines or a non-positive qty |
| `PATCH` | `/orders/:id` | `orders.request` (raiser) or `orders.approve` | Same body, any field optional, only in `DRAFT` or `RETURNED`; `409 ORDER_WRONG_STATE` otherwise |
| `DELETE` | `/orders/:id` | the raiser | Discards a `DRAFT` only |
| `POST` | `/orders/:id/submit` | `orders.request` | `{}` → `AWAITING_APPROVAL` (assigns the LPO number, Q-05); clears `returnedNote` |
| `POST` | `/orders/:id/approve` | `orders.approve` | `{pin}` → `APPROVED` (from `AWAITING_APPROVAL`, or from `DRAFT` for an approver's own order, which also assigns the number). `401 INVALID_PIN` |
| `POST` | `/orders/:id/return` | `orders.approve` | `{note}` (required) → `RETURNED` |
| `POST` | `/orders/:id/send` | `orders.approve` or `orders.request` (Q-09) | `{via: 'WHATSAPP'\|'PRINT'\|'LINK'\|'MANUAL'}` → `SENT`; idempotent for an already `SENT` order (keeps the first `sentAt`) |
| `POST` | `/orders/:id/cancel` | `orders.cancel` | `{reason: 'ORDERED_BY_MISTAKE'\|'SUPPLIER_CANNOT_SUPPLY'\|'NO_LONGER_NEEDED'\|'OTHER', note \| null, pin}` → `CANCELLED`. `409 CANNOT_CANCEL_AFTER_DELIVERY` once delivered |

### 31.4 Deposit, receiving

| Method | Path | Capability | Body → result |
|---|---|---|---|
| `POST` | `/orders/:id/deposits` | `payables.record_deposit` | `{amount, paidOn, method, methodRef \| null, chequeNo \| null, note \| null}` → `Payment` (`kind: ADVANCE`). Only from `APPROVED` to `INVOICED`. `422 DEPOSIT_EXCEEDS_ORDER`; `403` for the Branch Manager's payment details on read |
| `POST` | `/uploads` | any signed-in caller with a capability above | multipart `file` (image or PDF, ≤ 10 MB) → `FileRef`; `422 UPLOAD_TOO_LARGE`, `422 UPLOAD_BAD_TYPE`, `503 UPLOAD_FAILED` (the retry state) |
| `POST` | `/orders/:id/receive` | `orders.receive` | `{lines[{lineId, receivedQty, priceConfirmed: boolean}], deliveryNoteNo, deliveryNotePhotoId, pin}` → `Order` in `DELIVERED` with `delivery`. `409 ORDER_WRONG_STATE` (not `SENT`/`APPROVED`); `422 RECEIVED_EXCEEDS_ORDERED` (Q-10); `422 PRICE_CHANGE_UNCONFIRMED` with `{lineIds}`; `422 DELIVERY_NOTE_REQUIRED`; `401 INVALID_PIN` |

### 31.5 Invoice and payment (built in the mock, Session 2, 5 Oct 2026)

Shape changes made while building, which the table below follows: `Invoice` also carries `settled {agreedAmount, note, by, at} | null` and `voided {reason, by, at} | null`; `Payment` also carries `reason`, `invoiceId`, `proof: FileRef | null` and `approvedBy`; `can` also has `settleDispute`, `voidInvoice`, `reversePayment`, `addDocument`. Void reasons: `WRONG_AMOUNT | WRONG_SUPPLIER_OR_ORDER | DUPLICATE | OTHER`. Reverse reasons: `WRONG_AMOUNT | WRONG_REFERENCE | WRONG_INVOICE | PAYMENT_BOUNCED | OTHER`. New errors: `INVOICE_NOT_DISPUTED`, `INVOICE_NOT_FOUND`, `PAYMENT_NOT_FOUND`, `PAYMENT_ALREADY_REVERSED`, `SUPPLIER_NOT_FOUND` (the not-found ones are 404). A payment needs no approval (Q-14). The statement response is `{supplier, from, to, openingBalance, lines[{date, reference, description, kind, debit, credit, balance, superseded}], totalDebit, totalCredit, closingBalance, ageing{current, days1to30, days31to60, days61to90, days90plus}}` (credit adds to what we owe). `GET /suppliers/:id/orders` returns `{owing{owing, overdue, overdueCount, openInvoices, disputedAmount, creditHeld, nextDueDate, late{…}, invoices[]}, orders[]}`. `GET /audit-log` rows are `{at, actor{name, role}, action, area: Purchasing|Payments, document, detail}`. `POST /orders/:id/documents` `{title, fileId}` adds a document to the purchase file. The mock service interface (`purchasing-service.ts`) is the exact list of operations.

| Method | Path | Capability | Body → result |
|---|---|---|---|
| `POST` | `/orders/:id/invoice` | `payables.record_invoice` | `{number, date, amount, photoId \| null, varianceReason \| null}` → `Invoice`. One per order: `409 INVOICE_EXISTS`. `409 DUPLICATE_INVOICE_NUMBER` with `{existingOrderId}`; `422 REASON_REQUIRED` when amount differs from the delivered value |
| `POST` | `/invoices/:id/settle-dispute` | `payables.record_invoice` | `{agreedAmount, note}` → `Invoice` (Q-06) |
| `POST` | `/invoices/:id/void` | `payables.record_invoice` | `{reason, pin}` → order back to `DELIVERED`. `409 INVOICE_HAS_PAYMENTS` |
| `POST` | `/invoices/:id/payments` | `payables.record_payment` | `{amount, paidOn, method, methodRef \| null, chequeNo \| null, proofPhotoId \| null, confirmOverpay?: boolean}` → `Payment` (`kind: INVOICE`) and a payment advice `PAY-nnnn`. `422 PAYMENT_EXCEEDS_BALANCE` (resend with `confirmOverpay`); `422 CHEQUE_NUMBER_REQUIRED`; `409 INVOICE_DISPUTED` until settled (Q-06) |
| `POST` | `/payments/:id/reverse` | `payables.record_payment` | `{reason, approverPin}` where `approverPin` is a Store Manager's (or System Admin's) PIN → the `REVERSAL` line; `401 INVALID_PIN`; `403` if the approver cannot approve |
| `GET` | `/payments/:id/advice` | `payables.read` | Print data for the payment advice |
| `GET` | `/suppliers/:id/orders` | `orders.read` | The supplier's Orders tab |
| `GET` | `/suppliers/:id/statement` | `payables.read` | Query `from`, `to`; opening balance, transactions with running balance, ageing, totals; `?format=csv` for CSV. Branch Manager gets it without payment details |
| `GET` | `/audit-log` | `audit.read` | Purchasing rows join the existing log (§30.12) |

### 31.6 Errors

Standard error envelope with a stable `code`:
`INVALID_PIN` (401, "That PIN is not right."), `ORDER_NOT_FOUND` (404), `ORDER_WRONG_STATE` (409, "This order is {status}, so you cannot do that."), `SUPPLIER_ORDER_OPEN` (409), `SUPPLIER_ON_HOLD` (409), `ITEM_SETUP_INCOMPLETE` (409), `CANNOT_CANCEL_AFTER_DELIVERY` (409, "Once goods have arrived an order can't be cancelled."), `PRICE_CHANGE_UNCONFIRMED` (422), `RECEIVED_EXCEEDS_ORDERED` (422), `DELIVERY_NOTE_REQUIRED` (422), `DEPOSIT_EXCEEDS_ORDER` (422), `INVOICE_EXISTS` (409), `DUPLICATE_INVOICE_NUMBER` (409), `REASON_REQUIRED` (422), `INVOICE_HAS_PAYMENTS` (409), `INVOICE_DISPUTED` (409), `PAYMENT_EXCEEDS_BALANCE` (422), `CHEQUE_NUMBER_REQUIRED` (422), `UPLOAD_TOO_LARGE`/`UPLOAD_BAD_TYPE` (422), `UPLOAD_FAILED` (503), `403 FORBIDDEN` ("You do not have permission to perform this action", from `requireCapability`).

### 31.7 Access and the permissions endpoint

`GET /inventory/permissions/me` (§30.13) gains `orders.read`, `orders.request`, `orders.approve`, `orders.cancel`, `orders.receive`, `payables.record_deposit`. The table (`central-store-access.ts`) is the only place access is decided; a client change to who can do what is a row edit there.

### 31.8 Numbering

`LPO-nnnn` (order), `PAY-nnnn` (payment and advance), `GRN-nnnn` (receipt) are gap-free per site from the reference counter table, taken in the same transaction as the document. The supplier's invoice number and delivery note number are typed in and never generated.

### 31.9 As built (6 Oct 2026): where it differs from the mock

Code: `backend/src/modules/inventory/purchasing/` (six folders, one `purchasing-routes.ts`). Every route is under `/inventory/purchasing`.

- **Receive** (`POST /orders/:id/receive`): each line is `{lineId, receivedQty, deliveredPrice: string | null, priceConfirmed}`. `deliveredPrice` is what the receiver read on the delivery note when it differs from the order (`null` = as ordered); a differing price must also have `priceConfirmed: true` or the call fails `422 PRICE_CHANGE_UNCONFIRMED`. Only an approver's typed price changes the order's own price: for anyone else the supplier's price is used. The PIN is 4 digits. Each received line posts one RECEIVE row through `postStockMovement` with `purchaseDeliveryLineId`, sets the supplier price and the item's cost. Receiving with nothing received at all is refused (`422 VALIDATION`, "cancel the order instead").
- **Attendant (Q-02):** the Attendant now sees item prices and order totals (per the owner's rule that item costs are visible). Invoice, payments, `money`, due labels and anything financial are removed by `_shared/order-view.ts`, the one place that applies the blind rule. The mock's Attendant screens (no prices) therefore differ from the live ones.
- **LPO print** (`GET /orders/:id/lpo`): carries **no prices, no total and no amount in words**; the lines show quantities and supplier names and codes only. Internal screens keep prices.
- **Responses:** `POST /orders/:id/deposits` returns the `Payment`. `POST /invoices/:id/payments` and `POST /payments/:id/reverse` return `PaymentResult = {payment, order}` so the screen refreshes the file in one call. Reversal needs a Store Manager or System Admin PIN, found by PIN (`approverPin`).
- **Discard** (`DELETE /orders/:id`) deletes a draft together with its audit rows (a draft was never submitted, so no record is lost).
- **Access:** `GET /summary` and `GET /orders` need `orders.read`; `GET /suppliers/:id/orders` needs `suppliers.read` (the Attendant has only the stripped supplier picker list); the statement needs `payables.read`; `GET /suppliers/:id/statement?format=csv` returns CSV. The statement reads at most 2,000 orders per supplier.
- **Audit log:** there is no `/inventory/purchasing/audit-log`. Purchasing and Payments rows come from `GET /inventory/audit-log` (§30.12) with `area=PURCHASING|PAYMENTS`; each such entry carries `actor.role` and `purchasing: {action, document, detail, orderId, orderReference, supplierName}`. Capability `audit.read`.
- **Uploads:** `POST /uploads` and `GET /uploads/:id/url` (a signed link; invoice and payment files are withheld from a caller blind to money).
- **Not built (mock only):** the demo bar and the mock's `GET /audit-log` path.

## 32. Workforce — foundation (slice 0, built 6 Oct 2026)

Source of truth: `docs/features/workforce/slice-0-contract.md`. Standard envelope (§1). Access is by capability from `modules/workforce/_shared/workforce-access.ts`, never `requireRole`. Slice 0 has no write endpoint; rule edits are service functions until slice 4.

### 32.1 `GET /workforce/permissions/me`

`authenticate` only. Optional `?asRole=ROLE` (System Admin only, demo preview; ignored for anyone else and for unknown roles). `200`: `{ success: true, data: { role, siteId, isDepartmentHead, departmentTag, tracksTime, capabilities: [{ capability, scope }] } }`, where `scope` is `own | dept | unit | all`. `401` when not signed in.

### 32.2 `GET /workforce/rules/effective?siteId=<uuid>&date=YYYY-MM-DD`

`authenticate`, `requireCapability('rules.read')`. `date` defaults to today (Nairobi). `200`: `{ groups: [...] }`, ten groups, each `{ group, values, isDefault, companyVersion, siteVersion, effectiveFrom, requiredConfirmations, missingConfirmations }`, or `{ group: 'STATUTORY', locked: true }` without `payrun.read`. `400` bad uuid or date; `401`; `403` no `rules.read`, or a branch holder asking another site; `404` unknown site.

### 32.3 `GET /workforce/rules/:group/versions?siteId=<uuid>`

Same guard. Newest first; no `siteId` means company-default versions. Each item: `{ id, group, siteId, version, effectiveFrom, createdAt, createdBy, reason, values, changedFields, requiredConfirmations, confirmations }`. `STATUTORY` comes back `{ group, locked: true }` without `payrun.read`. `404` unknown group.

## 33. Inventory — Prep rebuild (BUILT, contract frozen 7 Oct 2026)

> **STATUS: BUILT on branch `feat/prep-rebuild` (all 17 endpoints; live once merged and deployed). Shapes unchanged since the freeze.** Differences from the first text of this section, as built: a repeat means the same output and amounts within the last 2 hours (owner decision), not "same Nairobi day"; a zero amount is `422 QUANTITY_NOT_POSITIVE`, not a schema 400; the Prep-again tiles count recorded runs only (corrected originals and cancelled runs do not count). Source of truth in code: `backend/src/modules/inventory/prep/_shared/prep-contract.ts` (Zod), mirrored by hand in `frontend/features/inventory/prep/_shared/types/prep-contract.ts`; both are checked against `prep-contract.fixtures.json` by `prep-contract.test.ts`. Plan and reasons: `docs/features/inventory/prep-plan.md` §3. Replaces §23. A change needs the owner and a same-commit change to the schema file, the mirror, the fixtures and this section.

### 33.1 Conventions

- Base `/inventory/prep`. Standard envelope `{ success, data }` (§1). Every route has `authenticate` and `requireCapability(...)`; never `requireRole`. Reads resolve the site with `requireHubReader`, writes with `requireHubActor` (D-15, Central Store hub site).
- Decimals are **strings**; ids strings; timestamps ISO 8601 UTC; dates `YYYY-MM-DD` read as **Africa/Nairobi** days. Quantities are in the item's usage unit.
- Run numbers `PREP-nnnn`, gap-free per site (reference counter prefix `PREP`).
- Record and correct carry an `idempotencyKey` (UUID the form makes when it opens). The same `(site, user, key)` returns the already-recorded run with `200` (first time `201`).
- Capabilities (role grid in `central-store-access.ts`): `prep.read`, `prep.see_costs`, `prep.read_flags`, `prep.record`, `prep.fix_any`, `prep.review`, `prep.recipes_write`. A "cap" field below is **absent** (not null) for a caller without that capability.
- Standard errors: `400` validation, `401`, `403`, `404`, `409`, `422`. Prep error codes (in `error.code`): `RECIPE_UNCHANGED`, `REASON_REQUIRED`, `MAIN_INGREDIENT_REQUIRED`, `INPUT_IS_OUTPUT`, `DUPLICATE_INPUT_LINE`, `QUANTITY_NOT_POSITIVE`, `PREP_RUN_LOCKED` (403), `RUN_NOT_OPEN` (409), `EXPORT_TOO_LARGE` (422).

### 33.2 Blind rule per role

| Field | Needs | Store Attendant | Manager roles (SM, Admin, Accountant, Director, Branch Mgr) |
|---|---|---|---|
| unit costs, line costs, `totalInputCost`, `outputUnitCost`, `cost`, `costPerUnitNow`, `prepValue7d`, `costNow`, `unitCostBefore/After` | `prep.see_costs` | absent | present |
| `needsLook`, `reviewedBy/At`, `flags`, `exceedsStock`, Needs a look, Export | `prep.read_flags` | **absent, never in a payload** | present |
| stock figures: `onHand`, `stock`, cancel preview | `restock.read` | absent | present where the role holds it |
| `can.correct/cancel` | `prep.record`; own run within 24 h, or `prep.fix_any` | own run, 24 h | Store Manager and Admin any run; others false |
| `can.review` | `prep.review` | false | Store Manager and Admin only |

An Attendant opening someone else's run gets it read-only (`can` all false, no flags, no costs). The 24-hour window and "own run" are service rules: a caller without `prep.fix_any` is allowed only when `run.createdById === actor.id` and `now − run.createdAt ≤ 24 h`, else `403 PREP_RUN_LOCKED` ("Ask the Store Manager").

### 33.3 Endpoints

| # | Method, path | Capability | Request | Response | Errors |
|---|---|---|---|---|---|
| 1 | `GET /recipes` | `prep.read` | query `search`, `show=all\|has\|none`, `changed=any\|30d\|older`, `page`, `perPage` (25, max 100) | `{ items: RecipeRow[], total, totalItems, withoutRecipe }` | |
| 2 | `GET /recipes/:itemId` | `prep.read` | | `RecipeDetail` | 404 item not prepped or not found |
| 3 | `PUT /recipes/:itemId` | `prep.recipes_write` | `RecipeInput` | `RecipeDetail` (new version) | 422 `RECIPE_UNCHANGED`, `REASON_REQUIRED` (not the first version, no reason), `MAIN_INGREDIENT_REQUIRED`; 409 item retired |
| 4 | `GET /outputs` | `prep.record` | | `{ items: { itemId, name, unit, hasRecipe, expectedText, lastRun }[] }` | every live PREPPED item |
| 5 | `GET /prep-again` | `prep.record` | | `{ tiles: { itemId, name, ingredientsText, expectedText, lastRun }[] }` (max 3) | most made in 30 days, filled from all time |
| 6 | `POST /runs/check` | `prep.record` | `CheckInput` | `CheckResult` | no write, no log |
| 7 | `POST /runs` | `prep.record` | `RecordInput` | `RunDetail` | 201 new, 200 replayed; 404; 409 item retired; 422 `INPUT_IS_OUTPUT`, `DUPLICATE_INPUT_LINE`, `QUANTITY_NOT_POSITIVE` |
| 8 | `GET /runs` | `prep.read` | query `search`, `outputItemId`, `personId`, `status`, `needsLook` (read only with `prep.read_flags`, else ignored), `mine`, `from`, `to`, `page`, `perPage` | `{ items: RunSummary[], total, page, perPage }` | newest first |
| 9 | `GET /runs/summary` | `prep.read_flags` | | `{ runsThisWeek, runsToday, needsLookCount, prepValue7d? }` | |
| 10 | `GET /runs/:id` | `prep.read` | | `RunDetail` | 404 |
| 11 | `POST /runs/:id/correct` | `prep.record` | `CorrectInput` | `RunDetail` of the **new** run | 403 `PREP_RUN_LOCKED`; 409 `RUN_NOT_OPEN`; 404 |
| 12 | `POST /runs/:id/cancel` | `prep.record` | `CancelInput` | `RunDetail` | same; a replay returns 409 `RUN_NOT_OPEN` |
| 13 | `GET /runs/:id/cancel-preview` | `restock.read` | | `{ items: { itemId, itemName, onHandNow, onHandAfter, unit, belowZero }[] }` | |
| 14 | `GET /needs-a-look` | `prep.read_flags` | `page`, `perPage` | `{ count, items: (RunSummary & { reasons: string[] })[] }` | |
| 15 | `GET /needs-a-look/count` | `prep.read_flags` | | `{ count }` | sidebar badge |
| 16 | `POST /runs/:id/review` | `prep.review` | | `RunDetail` | idempotent; 409 `RUN_NOT_OPEN` for a cancelled run |
| 17 | `GET /runs/export` | `prep.read_flags` | filters of #8, no paging | `text/csv`, UTF-8 with BOM; When, Run, Output, Made, Unit, Vs usual, By, Status, Reviewed by (+ Unit cost with `prep.see_costs`) | file `prep-history-<from>-<to>.csv`; 422 `EXPORT_TOO_LARGE` over 10,000 rows |

Route order: `/runs/check`, `/runs/summary` and `/runs/export` are registered before `/runs/:id`.

### 33.4 Shapes

Request and response shapes are exactly the schemas in `prep-contract.ts` (`RunSummary`, `RunDetail`, `RecipeRow`, `RecipeDetail`, `RecipeInput`, `InputLine`, `CheckInput`, `CheckResult`, `RecordInput`, `CorrectInput`, `CancelInput`, `ExpectedYield`, `VsUsual`, `Person`); the file is the reference, this section does not repeat it. Plan §3 explains each field.

### 33.5 Rules the services apply

- **Judging a run:** expected = recipe scaling (`targetYield × mainUsed ÷ recipeMainAmount`) when the run uses the recipe's main ingredient, else the mean of the last 10 `RECORDED` runs of that output or those of the last 30 days (whichever gives fewer), else none. ≤15% on target; >15% low or high (manager flag); >35% also notifies (in-app flag only). Typo suspect: made over 3× or under ⅓ of expected; warns, never blocks. A repeat (same output, same input amounts, recorded within the last 2 hours; owner decision 7 Oct 2026, narrowed from "same Nairobi day") warns, never blocks; neither is stored.
- **Recording:** one transaction. One `PREP_CONSUME` per input and one `PREP_PRODUCE` through `postStockMovement`; the output item's `currentCost` becomes total input cost ÷ made; `needsLook` is set when the yield is off or an input exceeded expected stock.
- **Correct and cancel:** reversing rows (original type, opposite sign, linked by `reversesTransactionId`, once per row); the old run becomes `CORRECTED` (or `CANCELLED`), the new run is `RECORDED` with `replacesRunId`. Output cost changes only when the run fixed is the latest `RECORDED` run of that output; a cancel leaves it unchanged. A cancel may take stock below zero. An Attendant's correction goes to Needs a look.
- **Audit log:** `GET /inventory/audit-log` gains area `PREP` (Recorded, Corrected, Cancelled, Reviewed, Recipe set, Recipe changed), derived from run and recipe-version columns.

## 34. Inventory — Stock, Counting and Waste rebuild (BUILT, contract frozen 8 Oct 2026)

> **STATUS: BUILT on branch `feat/stock-count-waste` (39 endpoints; live once merged and deployed). Replaces the Counting, Stock and Central Store waste parts of §26 (the old `/inventory/counts`, `/inventory/spot-counts`, `/inventory/stock` and `/inventory/waste` Central Store routes are deleted); the Department Head's branch waste (`GET /inventory/waste/items`, `GET`/`POST /inventory/waste`) is unchanged and lives in `waste/department/`, and the Branch Manager's `GET`/`PUT /inventory/thresholds` stay (branch day).** Source of truth in code: `backend/src/modules/inventory/{counting,stock,waste}/_shared/*-contract.ts` (Zod), mirrored by hand in `frontend/features/inventory/{counting,stock,waste}/_shared/types/*-contract.ts`; the three `*-contract.test.ts` files check both against the shared `*-contract.fixtures.json`. A change needs the owner and a same-commit change to the schema file, the mirror, the fixtures and this section.

### 34.1 Conventions

- Counting and Stock under **`/inventory/stock`**, Waste under **`/inventory/stock/waste`**. Standard envelope `{ success, data }` (§1). Every route has `authenticate` and `requireCapability(...)`, never `requireRole`; reads resolve the site with `requireHubReader`, writes with `requireHubActor` (D-15). Every query carries the hub `siteId`.
- Decimals are strings, ids strings, timestamps ISO 8601 UTC, dates `YYYY-MM-DD` read as Africa/Nairobi days. Tables return numbered pages (`page`, `pageSize` 25, 50 or 100, default 50).
- Counts are `CNT-{year}-{nnnn}` and adjustments `ADJ-nnnn`, gap-free per site through the reference counter. Start, sign and approve carry an `idempotencyKey`; a repeat returns the same record with `200` (first time `201`). Waste log carries one per batch.
- Capabilities (role grid in `central-store-access.ts`): `stock.read`, `counts.read`, `counts.record`, `counts.resolve`, `counts.setup`, `counts.acknowledge`, `counts.set_director_alert`, `waste.read`, `waste.log`, `waste.reverse_own`, `waste.reverse_any`. Store Manager and System Admin hold the writes; the Attendant holds `counts.record`, `waste.read`, `waste.log`, `waste.reverse_own` (no `stock.read`, so every Stock endpoint is `403` for them); the Director holds the reads plus `counts.acknowledge` and `counts.set_director_alert`; the Accountant and Branch Manager hold the reads only.
- Only signing a count (C13) and approving one (C29) are PIN-signed (the caller's **own** PIN; a missing or wrong PIN is `INVALID_PIN` on the server, and the shell sign dialog sets a first PIN before it signs). **No PIN anywhere in Waste.**
- Error codes (in `error.code`): `YOU_HAVE_OPEN_COUNT`, `SECTION_BUSY`, `NOTHING_TO_COUNT`, `RECOUNT_NOT_ALLOWED`, `NOTHING_COUNTED`, `CAUSE_REQUIRED`, `COUNT_NOT_OPEN`, `COUNT_NOT_SUBMITTED`, `LINES_UNDECIDED`, `INVALID_PIN`, `SECTION_NAME_TAKEN`, `LAYOUT_CHANGED` (409), `MOVE_ALREADY_UNDONE`, `ITEM_RETIRED`, `NOT_YOUR_ENTRY`, `REVERSAL_WINDOW_PASSED`, `ALREADY_REVERSED`, `DATE_IN_FUTURE`, `RANGE_INVALID`, `EXPORT_TOO_LARGE` (413).

### 34.2 Blind rule

One view builder per response decides which keys exist (`count-view.ts`, `stock-view.ts`, `waste-view.ts`), never a role-name check. A caller without `restock.read` (the Attendant) never receives `expectedQty`, `difference`, `value`, `percent`, `result`, `figures`, `shortStreak` or any stock figure; for them the section-end check names lines and typed numbers only. Money follows `catalog.see_costs`: the Attendant sees item cost and price, never financials or totals of stock. A waste list for a caller without `stock.read` is their **own entries only**, whatever `scope` says (decided by that capability, not a role).

### 34.3 Counting endpoints (30)

| # | Method, path | Capability (+ service rule) | Notes |
|---|---|---|---|
| C1 | `GET /counts/summary` | `counts.read` | The Manager's strip (Waiting, In progress, Exceeded 7 days, Longest without a count) or the Director's (Flagged, Net difference, Short 3 counts running, Longest without a count) |
| C2 | `GET /counts` | `counts.read` | Query `status`, `search`, page; chips; `differencesText` needs `restock.read` |
| C3 | `GET /counts/flagged` | `counts.read` | Lines flagged to the Director |
| C4 | `GET /counts/repeat-shortfalls` | `counts.read` | Items short three counts running |
| C5 | `GET /counts/:id` | `counts.read`, or `counts.record` and the caller is the counter | Registered last |
| C6 | `GET /counts/:id/print` | `counts.read` | Printed count record data |
| C7 | `GET /counts/blank-sheet` | `counts.read` or `counts.record` | No stock figures |
| C8 | `GET /counts/start-options` | `counts.record` | Sections, who is busy, the caller's open count, `?recountLineId=` |
| C9 | `POST /counts` | `counts.record` | `YOU_HAVE_OPEN_COUNT`, `SECTION_BUSY`, `NOTHING_TO_COUNT`, `RECOUNT_NOT_ALLOWED` |
| C10 | `PUT /counts/:id/lines` | `counts.record`, the counter, OPEN | Autosave; a number and `skipped` are exclusive |
| C11 | `POST /counts/:id/check` | `counts.record`, the counter, OPEN | Section-end check, offered once per line |
| C12 | `GET /counts/:id/sign-preview` | `counts.record`, the counter, OPEN | |
| C13 | `POST /counts/:id/sign` | `counts.record`, the counter, OPEN. **Own PIN** | Attendant: OPEN → SUBMITTED. Holder of `counts.resolve`: OPEN → APPROVED, every non-zero line posts, outside-range lines flagged to the Director. `INVALID_PIN`, `NOTHING_COUNTED`, `CAUSE_REQUIRED`, `COUNT_NOT_OPEN` |
| C14 | `PUT /counts/section-order/today` | `counts.record` | The Attendant's order for today |
| C15 | `GET /count-setup` | `counts.read` | Stamps the visit ("moved since your last visit") |
| C16 | `GET /count-setup/sections/:id/items` | `counts.read` | `unsectioned` allowed |
| C17 | `POST /count-setup/sections` | `counts.setup` | `SECTION_NAME_TAKEN` |
| C18 | `PUT /count-setup/layout` | `counts.setup` | 409 `LAYOUT_CHANGED` on a stale `version` |
| C19 | `GET /count-setup/add-items` | `counts.setup` | Type-ahead, filters, numbered pager |
| C20 | `POST /count-setup/sections/:id/items` | `counts.setup` | Items in another section move (logged) |
| C21 | `POST /count-setup/items/:itemId/move` | `counts.record` | Applies at once, logged; an item inside an OPEN count keeps its line |
| C22 | `POST /count-setup/moves/:id/undo` | `counts.setup` | `MOVE_ALREADY_UNDONE` |
| C23 | `GET /count-settings` | `counts.read` | Range in KES and %, repeat-shortfall switch, alert amount |
| C24 | `GET /count-settings/preview` | `counts.read` | The last 7 days recomputed with proposed numbers |
| C25 | `PUT /count-settings` | `counts.setup` | Applies from the next signed count |
| C26 | `PUT /count-settings/director-alert` | `counts.set_director_alert` | The only Director setting write |
| C27 | `POST /counts/:id/decisions` | `counts.resolve`, SUBMITTED | One line, several, or a group; `COUNT_NOT_SUBMITTED` |
| C28 | `GET /counts/:id/approve-preview` | `counts.resolve`, SUBMITTED | |
| C29 | `POST /counts/:id/approve` | `counts.resolve`, SUBMITTED. **Own PIN** | One `ADJUSTMENT` per posting line in one transaction, all or none. `LINES_UNDECIDED`, `INVALID_PIN` |
| C30 | `POST /counts/seen` | `counts.acknowledge` | Mark seen; only lines flagged to the Director |

### 34.4 Stock endpoints (5, all `stock.read`)

| # | Method, path | Notes |
|---|---|---|
| S1 | `GET /overview` | Four KPI cells, today's counts, longest without a count; `can.startCount` |
| S2 | `GET /items` | All items: search, `status` chips, `categoryId`, `type`, `departmentTag`, `sectionId`, numbered pager; value at the current cost |
| S3 | `GET /ledger` | Ledger summary per item for `from`..`to` (default 30 days); opening + in + sentOut + prepUse + waste + adjusted = closing, valued at each row's own cost; `chip` all, adjustments, waste, negative |
| S4 | `GET /ledger/export` | The same query as CSV, at most 10,000 rows (413 `EXPORT_TOO_LARGE`); registered before S5 |
| S5 | `GET /ledger/:itemId` | Stock card, `show=byDay` (5 most recent days and one collapsed earlier row) or `entries` |

### 34.5 Waste endpoints (4, base `/inventory/stock/waste`)

| # | Method, path | Capability (+ service rule) | Notes |
|---|---|---|---|
| W1 | `GET /items` | `waste.log` | `often` = the caller's most logged in 60 days (up to 6) |
| W2 | `POST /` | `waste.log` | One transaction: a `WasteLog` and a WASTE ledger row per entry through the door; negative stock allowed and flagged, never blocked; `ITEM_RETIRED` |
| W3 | `GET /` | `waste.read` | `period` today, 7d, reversed; own entries only without `stock.read`; KPI strip; the Attendant's banner |
| W4 | `POST /:id/reverse` | `waste.reverse_any`, or `waste.reverse_own` on the caller's entry the same Nairobi day. **No PIN** | A linked opposite-sign row; the original stays. `NOT_YOUR_ENTRY`, `REVERSAL_WINDOW_PASSED`, `ALREADY_REVERSED` |

### 34.6 Rules the services apply

- **Judging a line:** `difference = counted − expected`; within range when `|value| ≤ rangeKes` **and** `percent ≤ rangePercent` (ties within); an exact match is within range; `expected ≤ 0` makes any difference exceed; a skipped line is never judged or adjusted.
- **Sign freezes figures:** expected stock is the ledger on-hand at `signedAt`, and the settings in force are frozen on the count.
- **One open count per person; a section is in one open count at a time** (two partial unique indexes back the service rules). Many counts a day. No spot count, no cancel (a stuck count is finished by its counter).
- **Ledger:** every stock movement goes through `postStockMovement`; a count line links by `count_line_id`; a waste reversal keeps the original's type with the opposite sign. The old `stock_count_line_id` link and the old count tables were dropped by the `stock_count_waste_contract` migration.
- **Director:** *flagged* = every outside-range line of a count the Manager signs herself, until marked seen; *alert* = any line whose value reaches the alert amount raises a push on that sign or approval, held 22:00 to 05:00 Africa/Nairobi. No inbox row.
- **Sections:** one `SUPPLIER` section per supplier with items (name and supplier fixed) plus `MANUAL` sections ("Others", "Packaging"); "Not in any section" is computed at read time.

---

## 35. Workforce — People and Organisation (slices 1a and 1b, BUILT 17 Oct 2026, back end only)

Source of truth: `backend/src/modules/workforce/people/README.md`. Standard envelope (§1); lists add `pagination: { total, page, perPage, totalPages }`. **Wire names:** the API says `organization` where the code says `site` (`organizationId`, `organizations`). Dates `YYYY-MM-DD` (Nairobi); money is a **string** with up to two decimals. Every route is `authenticate`, then the Workforce subject (head rows, real "clocks in"), then `requireCapability(...)`; never `requireRole`. Out-of-scope reads answer `404`, writes `403`. Error codes beyond the standard ones are `409` with a `code`: `DUPLICATE_NATIONAL_ID`, `DUPLICATE_PHONE`, `EMAIL_IN_USE`, `POSITION_NOT_OFFERED`, `CASUALS_NOT_ALLOWED`, `PROBATION_LIMIT`, `NO_PROBATION`, `CONTRACT_EXISTS`, `ALREADY_EXITED`, `NOT_EXITED`, `UNDO_WINDOW_CLOSED`, `UNDO_WINDOW_OPEN`, `TRANSFER_SCHEDULED`, `PAY_CHANGE_PENDING`, `PAY_CHANGE_NOT_PENDING`, `LOGIN_EXISTS`, `MOVE_NOT_SCHEDULED`, `MOVE_NOT_ACTIVE`; `403` codes `FIELD_NOT_ALLOWED`, `SELF_APPROVAL`, `FILE_LOCKED_FOR_EDIT`, `ROLE_NOT_ALLOWED`.

`GET /workforce/permissions/me` (§32.1) now also returns `headOfDepartmentIds` and the real `tracksTime`; `isDepartmentHead` is also true for a head by head rows.

### 35.1 Reads (`/workforce/people...`)

| # | Route | Capability | Notes |
|---|---|---|---|
| R1 | `GET /workforce/people?filter&q&organizationId&departmentId&page&perPage` | `employee.read_basic` | filters `all`, `needs_finishing`, `no_contract`, `casual_pool`, `on_probation`, `exited`; a Branch/Store Manager sees their own site, a head sees the departments they head; each row carries only the `gaps` the viewer may see |
| R2 | `GET .../summary` | `employee.read_basic` | counts |
| R3 | `GET .../lookups` | `employee.read_basic` or `org.read` | `organizations`, departments, positions, exit and pay-change reasons, contract types, the probation rule, `assignableLoginRoles`, `exitUndoDays` |
| R4 | `GET .../duplicate-check?nationalId&phone&email` | `employee.write_basic` | booleans only, never a name |
| R5 | `GET .../unlinked-accounts` | `employee.lifecycle` | active human logins with no file (to adopt) |
| R6 | `GET .../me` | `me.file` | own file, clear values |
| R7 | `GET .../:id` | `employee.read_basic` or `me.file` | `EmployeeFileView`: sensitive fields omitted with `locked` listing the groups; IDs and bank numbers masked (`•••• 5678`) unless it is the person's own; `completeness`, `probation`, `exit`, `timeline`, `nextSteps` and `actions` (which buttons the viewer may show) |
| R8 | `GET .../:id/pay` | `payprofile.read` or `me.payprofile` | `PayView` with history, pending change, hourly equivalent; **writes `people.pay_opened`** unless own |
| R9, R10 | `GET .../:id/documents`, `.../:id/documents/:docId` | `employee.read_sensitive` or `me.file` | list (or `{ locked }`), then `{ url }`; opening writes `people.document_opened` unless own |
| R11 | `GET .../pay-changes?status=PENDING` | `payprofile.approve` or `payprofile.write` | for the Director's list |

### 35.2 Writes

| # | Route | Capability | Body (Zod in `people-validators.ts`) |
|---|---|---|---|
| W1–W4 | `GET/POST/PATCH/DELETE .../drafts[/:id]` | `employee.write_basic` | `DraftBodySchema` (a draft is not a person; the only delete) |
| W5 | `POST /workforce/people` → `201 { employee, login: { created, reason? }, nextStep }` | `employee.write_basic` | `HireBodySchema`: `who`, `job`, optional `pay` (HR), `statutory` (HR), `login` (HR), `existingUserId` (adopt), `confirmDuplicatePhone`. Pay set at hire is in force at once |
| W6 | `PATCH .../:id` | `employee.write_basic` / `employee.write_sensitive` | `UpdateEmployeeSchema` (strict; a manager only while the file is `ONBOARDING`) |
| W7, W8 | `PATCH .../me`, `POST .../:id/photo`, `.../me/photo` | `me.file` / `employee.write_basic` | `PatchMeSchema`; photo multipart `file` (JPEG, PNG, WebP, 5 MB) |
| W9 | `PUT .../:id/pay-profile` | `payprofile.write` | payout, bank, hours (never the amount); a `reason` when an existing bank account changes |
| W10, W11 | `POST .../:id/pay-changes`, `POST .../pay-changes/:changeId/decision` | `payprofile.write`, `payprofile.approve` | request, then APPROVE or DECLINE (a decline needs a note); never your own |
| W12 | `POST .../:id/contract` | `employee.write_sensitive` | `ContractSchema`; completes a waiting probation confirmation |
| W13, W14 | `POST .../:id/probation-decision`, `.../probation-notes` | `employee.lifecycle`, `probation.note` | CONFIRM, EXTEND (months, reason) or END (returns `{ next: 'EXIT', suggestedLastDay }`, changes nothing) |
| W15–W18 | `POST .../:id/transfer/preview`, `.../transfer`, `.../loan`, `.../moves/:moveId/cancel`, `.../end` | `employee.lifecycle` | dated; a transfer or loan starting later is applied by the scheduler |
| W19–W22 | `POST .../:id/exit/preview`, `.../exit`, `PATCH .../exit/checklist`, `POST .../exit/undo` | `employee.lifecycle` | `ExitSchema`; undo to 7 days after the last day, returns the file plus `notRestored[]` |
| W23, W24 | `POST .../:id/rehire`, `.../login` | `employee.lifecycle` | rehire only after the undo window; login returns `{ userId }` |
| W25–W28 | `POST .../:id/file-requests`, `.../file-requests/:requestId/remind`, `.../verify-statutory`, `.../documents` (multipart), `.../reveal` | `employee.write_basic`, `employee.write_sensitive`, `employee.read_sensitive` or `me.file` | reveal returns the clear value of one ID or bank field and writes `people.sensitive_revealed` unless own |

### 35.3 Organisation: departments, heads and positions (slice 1b, BUILT 17 Oct 2026, back end only)

All routes run `authenticate`, then the Workforce subject (head rows), then `requireCapability`. Success is `{ success: true, data }` (`201` for creates). A read out of the caller's scope answers `404`; a missing capability `403`; a write out of scope `403`. Errors carry a `code`.

| # | Method and path | Capability | Request | Response `data` | Errors |
|---|---|---|---|---|---|
| O1 | `GET /workforce/org` | `org.read` | `?includeRetired=true\|false` | `{ organizations: [{ id, name, type, isHub, headsAllowed, gaps, departments: [DepartmentSummary] }], counts: { sites, departments, heads, gaps } }` | 401, 403 |
| O2 | `GET /workforce/org/departments/:id` | `org.read` | `?page&perPage` (default 1, 50) | `DepartmentView`: summary + `siteName`, `isHub`, `positions`, `peoplePage`, `casualPool` (`dailyRate` only with pay read), `can: { edit, assignHead }` | 400, 401, 403, 404 |
| O3 | `POST /workforce/org/departments` | `org.write` | `{ siteId, name, description?, positionIds[] }` | `201 DepartmentView` | 400 (`SITE_NOT_AVAILABLE`, `POSITION_NOT_AVAILABLE`), 403, 409 `DEPARTMENT_NAME_TAKEN` |
| O4 | `PATCH /workforce/org/departments/:id` | `org.write` | any of `{ name, description \| null, positionIds[] }` | `DepartmentView` | 400, 403, 404, 409 (`DEPARTMENT_NAME_TAKEN`, `DEPARTMENT_RETIRED`, `POSITION_HELD`) |
| O5 | `POST /workforce/org/departments/:id/retire`, `.../restore` | `org.write` | none | `DepartmentView` | 403, 404, 409 (`DEPARTMENT_HAS_PEOPLE`, `DEPARTMENT_MANAGED_BY_INVENTORY`, `DEPARTMENT_RETIRED`, `DEPARTMENT_NOT_RETIRED`) |
| O6 | `GET /workforce/org/departments/:id/head-candidates` | `org.write_heads` | none | `[{ employeeId, userId, name, positionName, startDate, isActingHere, recommended }]` | 403, 404, 409 (`HUB_HAS_NO_HEADS`, `DEPARTMENT_RETIRED`) |
| O7 | `POST .../departments/:id/head/preview` | `org.write_heads` | `AssignHead` | `{ department, employee, mode, effectiveOn, returnsOn, endsHeadRoleOf[], claims: { before, after }, impacts[], notified[] }` | as O8 |
| O8 | `POST .../departments/:id/head` | `org.write_heads` | `{ employeeId, mode: "REPLACE" \| "ACTING", returnsOn?, replaceActing?, reason? }` (ACTING needs `returnsOn`, after today) | `DepartmentView` | 400 (`INVALID_RETURN_DATE`), 403, 404, 409 (`HEAD_NOT_ELIGIBLE` with `details.reason`, `ALREADY_HEAD`, `ACTING_HEAD_EXISTS`, `HUB_HAS_NO_HEADS`, `HEAD_CHANGED_MEANWHILE`) |
| O9 | `POST .../departments/:id/head/end` | `org.write_heads` | `{ which: "HEAD" \| "ACTING" (default HEAD), reason }` | `DepartmentView` | 403, 404, 409 `NO_HEAD_TO_END` |
| O10 | `GET /workforce/org/positions` | `org.read` | `?departmentId&includeRetired&q` | `[PositionView]` (`holderCount` company-wide) | 400, 403 |
| O11 | `GET /workforce/org/positions/:id` | `org.read` | none | `PositionView` + `holders[]` (only those the viewer may see) | 400, 403, 404 |
| O12 | `POST /workforce/org/positions` | `org.write` (all) | `{ name, defaultTracksTime, loginRole \| null, casualsAllowed, departmentIds[] }` | `201` position with holders | 400, 403, 409 `POSITION_NAME_TAKEN` |
| O13 | `GET .../positions/:id/impact?defaultTracksTime=` | `org.write` (all) | query | `{ people[], count, impacts[] }` | 400, 403, 404 |
| O14 | `PATCH .../positions/:id` | `org.write` (all) | any of the O12 fields + `acknowledgedPeople` | position with holders | 400, 403, 404, 409 (`ACKNOWLEDGE_IMPACT` with `details.count`, `POSITION_NAME_TAKEN`, `POSITION_RETIRED`, `POSITION_HELD`) |
| O15 | `POST .../positions/:id/retire`, `.../restore` | `org.write` (all) | none | position with holders | 403, 404, 409 (`POSITION_HELD` with `details.holders`, `POSITION_RETIRED`, `POSITION_NOT_RETIRED`) |

`DepartmentSummary` is `{ id, siteId (wire: organizationId), name, inventoryTag, description, isActive, people, head, actingHead, hasGap }`; a head is `{ employeeId, userId, name, isActing, since, returnsOn }`. Changing a head writes the head row, `User.isDepartmentHead` / `departmentTag` (for departments with an inventory tag), the audit entry and, after commit, the `department.head_changed` event. Spec and decisions: `backend/src/modules/workforce/people/README.md` and `docs/features/workforce/decisions-1b-backend.md`.

## 36. Workforce — Rota (slice 2, BUILT 18 Oct 2026, back end only)

Base `/api/v1/workforce/rota`. Every route: `authenticate`, `attachWorkforceSubject`, `requireCapability(...)`; scope is checked in the service. **There is no publish or amend step:** every edit is saved at once, live to staff, and audited (one entry per request, no pay figures). A person is told once, after 5 minutes without a further change to their shifts (`rota.shifts_changed`, delivery only logs until Notifications). Dates are Nairobi `YYYY-MM-DD`; a week starts on the Rules "week starts on" day. Wire names say `organization` where the code says `site`. Spec: `backend/src/modules/workforce/rota/README.md`; decisions: `docs/features/workforce/decisions-2-rota-backend.md`.

| # | Method and path | Capability | Body or query | Success | Errors |
|---|---|---|---|---|---|
| T1 | `GET /templates` | `rota.read` | `siteId?`, `weekStart?`, `includeRetired?` | `{ templates: TemplateView[], weekStart }` | 403, 404 |
| T2 | `POST /templates` | `rota.template_write` | `{ siteId (null = company-wide), name, letter?, colour, startTime, endTime, unpaidBreakMinutes?, departmentIds? }` | 201 `TemplateView` | 400 `OVERNIGHT_SHIFT`, `BREAK_TOO_LONG`, `DEPARTMENT_NOT_AVAILABLE`; 403; 409 `TEMPLATE_NAME_TAKEN`, `TEMPLATE_LETTER_TAKEN` |
| T3 | `PATCH /templates/:id` | `rota.template_write` | any of the T2 fields, `reason?` | `TemplateView` (a new version when past days used the old times) | 400; 403; 404; 409 `REASON_REQUIRED`, `TEMPLATE_RETIRED` |
| T4 | `POST /templates/:id/retire` | `rota.template_write` | none | `TemplateView` | 403, 404, 409 `TEMPLATE_IN_USE` (`details.upcoming`), `TEMPLATE_RETIRED` |
| T5 | `POST /templates/:id/restore` | `rota.template_write` | none | `TemplateView` | 403, 404, 409 `TEMPLATE_NOT_RETIRED`, `TEMPLATE_SUPERSEDED` |
| G1 | `GET /week` | `rota.read` (unit, dept or all) | `weekStart`, `siteId?`, `departmentId?` | `WeekView` | 400 `WEEK_START_INVALID`, `WEEK_OUT_OF_RANGE`; 403; 404 |
| G2 | `GET /week/print` | `rota.read` | as G1 | `PrintedRota` (no cost) | as G1 |
| G3 | `GET /mine` | `rota.read` | `from?`, `to?` | `{ from, to, shifts: MyShift[] }` | 404 (no employee file) |
| G4 | `PUT /cells` | `rota.write` | `{ siteId?, changes: [{ employeeId, date, templateIds[] }], reason?, overrideReason? }` | `{ changedCells, peopleAffected, leaveOverrides }` | 400 `TEMPLATE_NOT_AVAILABLE`, `EMPLOYEE_NOT_ON_ROTA`, `WEEK_OUT_OF_RANGE`; 403; 404; 409 `PAST_DAY_READ_ONLY`, `REASON_REQUIRED` (`details.dates`), `LEAVE_OVERRIDE_REQUIRED` (`details.cells`) |
| G5 | `POST /fill`, `POST /pattern` | `rota.write` | `{ siteId?, employeeIds[], dates[], templateId \| null, reason?, overrideReason? }`; `{ employeeIds[], weekStart, byWeekday: { 1..7: templateId \| null } }` | as G4 | as G4 |
| G6 | `POST /copy/preview` | `rota.write` | `{ siteId?, weekStart, departmentId? }` | `{ weekStart, copiedFrom, shiftsCopied, people, kept, skippedPast, clashes[], reasonRequired }`; writes nothing | 400, 403 |
| G7 | `POST /copy` | `rota.write` | as G6, `reason?` | `{ changedCells, peopleAffected, leaveOverrides, clashes[], kept }` | 409 `NOTHING_TO_COPY`, `REASON_REQUIRED`, `PAST_DAY_READ_ONLY` |

`WeekView` is `{ siteId, weekStart, today, days[{ date, isPast, people, byDepartment }], departments[{ id, name, people, shifts, headName }], templates[], people[{ employeeId, name, departmentId, positionName, cells{ date: [{ entryId, templateId, overrideReason }] }, leaveDates[], plannedMinutes, contractMinutes }], totals, warnings[{ code: LEAVE \| THIN_COVERAGE \| WEEKLY_HOURS \| DOUBLE_SHIFT, employeeId, departmentId, date, message, detail }], cost: { amount, basis } \| null, can: { write, writeTemplates, readCost } }`. `cost` is absent (null) unless the caller reads everyone's pay (HR, Director). A clash is `{ employeeId, name, date, kind: ON_LEAVE \| LOANED_OUT \| NOT_EMPLOYED \| SHIFT_UNAVAILABLE, detail }`.


## 37. Workforce — Attendance (slice 3, BUILT 18 Oct 2026, back end only)

Base `/api/v1/workforce/attendance`. Every route: `authenticate`, `attachWorkforceSubject`, `requireCapability(...)`; scope is checked in the service on the person. Another branch answers 404; a role or head without the capability or department answers 403. Detail, errors and who sees what: `backend/src/modules/workforce/attendance/README.md`; choices: `docs/features/workforce/decisions-3-attendance-backend.md`.

| # | Method and path | Capability | Body or query | Success |
|---|---|---|---|---|
| C1 | `GET /me` | `time.own` | | `MyDayView` (`enabled:false` while the branch is on the old clock) |
| C2 | `POST /clock-in` | `time.own` | `{ clientEventId, rotaEntryId?, deviceAt?, sentAt?, latitude?, longitude? }` | 201 (200 on a retry) `{ replayed, event, undoUntil, lateness }` |
| C3 | `POST /clock-out` | `time.own` | as C2 + `reasonCode?`, `reason?` (required before the scheduled end) | 201 / 200 `{ replayed, event, undoUntil, leftEarlyMinutes }` |
| C4 | `POST /undo` | `time.own` | `{ clientEventId }` | `{ replayed, undid }` |
| C5 | `POST /shift-end` | `time.own` | `{ rotaEntryId, answer: 'STAY_ON', reasonCode, estimateMinutes? }` | 201 / 200 |
| B1 | `GET /board` | `today.read` | `siteId?`, `date?` | `BoardView` (tiles, departments, people, attention) |
| B2 | `POST /clock-for` | `today.act` | `{ employeeId, type: IN\|OUT, at, reason, rotaEntryId? }` | 201 |
| F1 | `GET /day` | `timesheet.read` | `employeeId`, `date` | `DayHistory` (every event with its status) |
| F2 | `POST /fixes/preview` | `time.fix` | as F3 | `{ before, after }` in minutes |
| F3 | `POST /fixes` | `time.fix` | `{ action: EDIT\|ADD\|VOID, employeeId, date, eventId? / type?, at?, reason, rotaEntryId? }` | 201 `{ eventId, before, after }` |
| L1 | `GET /lateness` | `timesheet.read` | `from`, `to`, `siteId?`, `employeeId?`, `includeOnTime?` | `{ lines[], summary[] }` |
| S1 | `GET /switch` | `today.read` | `siteId?` | `{ enabled, enabledAt }` |
| S2 | `PUT /switch` | `attendance.switch` | `{ siteId, enabled }` | `{ enabled, carriedFromLegacy, mirroredToLegacy, notMirrored }`; 409 `OPEN_LEGACY_CLOCK_IN` |

While a site's switch is on, the four legacy routes `POST /clock/in`, `/clock/out`, `/clock/undo-out` and `/clock/override` answer 409 `CLOCK_MOVED_TO_NEW_ATTENDANCE` for that site and change nothing; for every other site they behave as before.

## 38. Workforce — Timesheets, overtime and requests (slice 4a, BUILT 18 Oct 2026; reworked by Segment 1A, 19 Oct 2026, back end only)

Base `/api/v1/workforce/timesheets`. Every route: `authenticate`, `attachWorkforceSubject`, `requireCapability(...)`; scope is checked in the service. Success envelope `{ success: true, data }` (the export answers with the file). A write without the capability is 403; another site is 404. Timesheets exist only for branches whose attendance switch is on (`GET /months` answers `{ enabled: false }` otherwise). **A timesheet is one calendar month per site**: `monthKey` `YYYY-MM` (the month of its last day). Its state is `OPEN`, `TO_APPROVE` (derived: the month has ended and nobody has approved it) or `APPROVED`. **Nothing closes by itself; there is no early close and no reopen.** A week that runs into the neighbouring month shows in My time with `partWeek: true`. Lists take `page` and `rows` or `pageSize`. **No response carries a pay figure.** Dates are Nairobi dates, times are ISO instants or `HH:MM`. The built `/periods...` routes (list, read, a person's period, report, sign, close early, reopen) are **removed**; the months routes replace them.

**Segment 1A routes**

| # | Method and path | Capability | Body or query | Success |
|---|---|---|---|---|
| MO1 | `GET /months` | `timesheet.read` | `site?`, `page`, `rows` (default 5, max 24) | `{ enabled, months[], page, rows, total }`; newest first, the current month created on first read. Each month: `monthKey`, `label`, `state`, `workedMinutes`, `headcount`, `soFarThroughDate` and `plannedSoFarMinutes` (open month only: hours so far, open shifts not counted), `needsYouCount`, `approvedAt`, `approvedBy { name, role }`, `documentNumber` (`TSH-0009`) |
| MO2 | `GET /months/:monthKey` | `timesheet.read` | `site?`, `from?` and `to?` (both or neither, inside the month) | `{ monthKey, label, site, state, window, range, kpis { workedMinutes, plannedMinutes, headcount, overtime { recordedMinutes, approvedMinutes, partNotApprovedMinutes, toDecideMinutes }, lateCount, absentDays }, soFar, needsYou { clockOutFixes, overtimeDecisions, requestsWithManager, daysToLookAt, requestsWithHr, total }, approval, rulesUsed[], otherSites[], capabilities { canApprove, canExport, canDecide }, approvableFrom }`. The KPIs follow the range; `needsYou` and `approval` are always the whole month. Reading refreshes an open month (at most every 20 s) and never alters an approved one. 400 `RANGE_OUTSIDE_MONTH`, `BAD_MONTH`; 404 `NO_TIMESHEET` |
| MO3 | `GET /months/:monthKey/people` | `timesheet.read` | `site?`, `from?`, `to?`, `q?`, `dept?`, `view` (`needs`, `late`, `all`), `sort` (`department`, `person`, `worked`, `overtime`, `late`), `dir`, `page`, `rows` (5 to 100, default 50) | `{ rows[], total, page, pageSize, counts { needs, late, all } }`; per row `employeeId`, `name`, `department`, `plannedMinutes`, `workedMinutes`, `overtimeMinutes`, `overtimeAuthorisedMinutes`, `lateMinutes`, `lateDays`, `absentDays`, `leaveDays`, `needsYou`, `status { kind, date?, minutes?, count?, days? }`. The chip counts follow the range and department, not the search |
| MO4 | `GET /months/:monthKey/people/:employeeId` | `timesheet.read` | `site?`, `from?`, `to?` | the drawer: `{ employee, month, range, workingDays, totals, needLook[], lastDays[7], neighbours, decisions[] }` (`decisions` only for an approved month, `needLook` empty then) |
| MO5 | `GET /months/:monthKey/people/:employeeId/days` | `timesheet.read` | `site?`, `from?`, `to?`, `view` (`all`, `needs`, `worked`), `page`, `rows` | the full month: `{ employee, month, days[], total, counts, glance[], totals, neighbours }`; one row per date including rest days, with planned and clocked times, a second shift, `resultKey`, `needsLook`, `overtimeItemId`, `requestId`, `editedById`, `beforeEmployment` |
| MO6 | `POST /months/:monthKey/approve` | `timesheet.close` | `{ pin, idempotencyKey (8 to 80), expectedTotals { workedMinutes, overtimeAuthorisedMinutes, headcount }, site? }` | `{ monthKey, state: APPROVED, approvedAt, documentNumber, documentHashPrefix, repeat }`. Order of checks: 403/404; a repeat of the same key answers the first result, another key `409 ALREADY_APPROVED`; `409 MONTH_NOT_ENDED` (`approvableFrom`); `409 NEEDS_YOU_REMAINS` (the counts); `409 PIN_NOT_SET`, `401 INVALID_PIN`; `409 NOTHING_TO_APPROVE`; `409 CHANGED_UNDERNEATH` (the fresh totals) |
| MO7 | `POST /months/:monthKey/exports` | `timesheet.export` | `{ format: pdf\|xlsx, scope: month\|range, from?, to?, employeeId?, idempotencyKey, site? }` | **the file** (`Content-Type` PDF or xlsx, `Content-Disposition: attachment; filename="Timesheet-Nyeri-Town-2026-09.pdf"`, `X-Document-Number` when approved, `Cache-Control: no-store`). 400 `RANGE_OUTSIDE_MONTH`; 413 `EXPORT_TOO_LARGE` (over 400 people); 429 `EXPORT_RATE_LIMIT` (12 per person per 10 minutes); 504 `EXPORT_TOO_SLOW`. Audited once per key. A draft is stamped "Draft, not approved" (no number, signature or QR) |
| O3 | `GET /overtime/:id` | `timesheet.read` | | `{ id, version, status, shiftDate, person, site, plannedStart, plannedEnd, workedStart, workedEnd, extraMinutes, autoMinutes, authorisedMinutes, part { min, max, step }, evidence { reasonGiven, openWork, colleagues { team, rostered, present }, ordersTaken, ticketsCleared, askedInAdvance, headNote }, limits { weekMinutes, weekCapMinutes, monthMinutes, branchWeekMinutes, branchBudgetMinutes, branchUsedMinutes }, decision, month { state }, canDecide, canNote }`. Counts only, never takings |
| O4 | `POST /overtime/:id/note` | `overtime.note` | `{ text }` (2 to 140 characters) | `{ id, text, at }`. Once, only while pending. 403 outside the head's own department; 409 `ALREADY_NOTED`, `NOT_PENDING`, `PERIOD_APPROVED` |

**Changed routes**

| # | Method and path | Capability | Body or query | Success |
|---|---|---|---|---|
| T5 | `GET /days/:id` | `timesheet.read` | | `{ day, person, history, overtime (with evidence and limits; no takings), requests }` |
| T6 | `POST /days/:id/decision` | `timesheet.approve` (the site's manager) or `manager_time.decide` (a site manager's own day: the Director) | `{ outcome: ACCEPT, reason? }` or `{ outcome: EXCUSE\|HOLD, reason }` | the day. 409 `PERIOD_APPROVED`, `NOTHING_TO_DECIDE`, `OVERTIME_UNDECIDED`, `NOT_LATE`, `EXCUSE_WINDOW_OVER`. Late and absent days need no decision (the month approves them with it) |
| O1 | `GET /overtime` | `timesheet.read` | `siteId?`, `periodId?`, `status` (`PENDING`, `DECIDED`, `ALL`), paging | `{ rows[] (each with person, evidence, limits, overdue, version, headNote), total }` |
| O2 | `POST /overtime/:id/decision` | `overtime.approve` (the site's manager) or `manager_time.decide` (a site manager's own item: the Director) | `{ decision: APPROVE_ALL\|APPROVE_PART\|DECLINE, approvedMinutes? (part: 5 to extra minus 5, steps of 5), reason? (5 to 280 characters, needed for part or none), pin, version }` | the item (`status` `APPROVED`, `APPROVED_PART` or `DECLINED`, `authorisedMinutes`, `version`). Authorises the time only. 401 `INVALID_PIN`; 409 `CHANGED_UNDERNEATH`, `PART_OUT_OF_RANGE`, `REASON_REQUIRED_OVER_LIMIT`, `NOTHING_TO_DECIDE`, `PERIOD_APPROVED`. Can be changed until the month is approved |
| R2 | `POST /requests/:id/decision` | `time_request.answer` | `{ outcome: APPROVE, reason? }` or `{ outcome: DECLINE, reason }` | the request with `answerAfter`. An accepted clock request makes the correction through the attendance fix door. 403 `HR_ONLY`, `MISTAKE_NOT_YOURS`, `CANNOT_FIX_TIME`; 409 `ALREADY_ANSWERED`, `PERIOD_APPROVED` |

**Unchanged from slice 4a**

| # | Method and path | Capability | Body or query | Success |
|---|---|---|---|---|
| R1 | `GET /requests` | `timesheet.read` | `siteId?`, `state` (`WAITING`, `ANSWERED`, `ALL`), `search?`, paging | the inbox, oldest waiting first (`canAct` follows `time_request.answer`) |
| R3 | `GET /requests/:id` | `timesheet.read` or `time.own` | | the request (its owner, or a reader in scope) |
| R4 | `GET /me/requests` | `time.own` | `state?` (`OPEN`, `ALL`) | `{ requests[] }` with `waitingOnName`, `waitingDays`, `escalatedToHr`, `answerAfter` |
| R5 | `POST /me/requests` | `time.own` | one of six kinds, see below | 201 the request (a second identical open request returns the first) |
| R6 | `POST /me/requests/:id/withdraw` | `time.own` | | the request. 409 `NOT_WAITING` |
| M1 | `GET /me/time` | `time.own` | `periodId?` | `{ enabled, period, periods, days[], weeks[], totals, openRequests }`, own record only. Each day also carries `clockIn` and `clockOut` (ISO instants of the first shift, null when not clocked; corrections applied) |
| M2 | `GET /me/rota` | `time.own` | `from?`, `to?` (up to 62 days; default today and 13 days) | `{ enabled, from, to, shifts[] }` |

R5 bodies (all carry `date` and a one-line `note`): `CLOCK_TIME_WRONG { type: IN\|OUT, at }`, `WORKED_NOT_RECORDED { clockIn, clockOut }`, `CLOCKED_OUT_BY_MISTAKE { at? }` (no time takes the clock-out away), `ROTA_WRONG`, `OVERTIME_MISSING { minutes? }`, `PAY_OTHER`. Errors: 409 `ATTENDANCE_NOT_ENABLED`, `NOTHING_TO_REVERSE`; 400 `DATE_IN_FUTURE`, `DATE_TOO_OLD` (over 45 days).

The scheduled task `timesheets.sweep` (every 10 minutes, Nairobi time) brings open months up to date and moves requests unanswered for 3 days to HR; it closes nothing. An **approved** month refuses attendance fixes (`409 PERIOD_APPROVED`, "This month is approved. Ask HR to correct the payslip.", on `POST /workforce/attendance/fixes` and its preview, HR included), day decisions and overtime decisions; a new request about an approved day goes straight to HR. The door has `getApprovedHours(userId, period)` (approved minutes from approved months only). Attendance reads `GET /workforce/attendance/lateness` and `GET /workforce/attendance/day` also accept `today.read` (a department head's own department). Segment 1A decisions: `docs/features/workforce/decisions-1a-timesheets-backend.md`.

## 39. Workforce — Rules (segment 1B, BUILT 19 Oct 2026, back end only)

Base `/api/v1/workforce/rules`. Source of truth: `backend/src/modules/workforce/rules/README.md` and `docs/features/workforce/decisions-1b-rules-backend.md`. Every route: `authenticate`, `requireCapability(...)`, Zod. **Wire names:** `siteId`, `siteName`, `sites` read `organizationId`, `organizationName`, `organizations` in replies (both spellings are accepted in requests). Groups are the codes `LATENESS`, `OVERTIME`, `ATTENDANCE`, `LEAVE`, `PROBATION`, `CASUAL_WORK`, `CONDUCT`, `STATUTORY`, `HOLIDAYS`, `WEEK_AND_BREAKS`. §32.3 is replaced by R4.

| # | Method and path | Capability | Body or query | Success |
|---|---|---|---|---|
| R1 | `GET /effective?siteId&date` | `rules.read` | unchanged from §32.2 | `{ groups[] }`; each group also has `pendingConfirmations` |
| R2 | `GET /access-table` | `rules.read` | | `{ rows[10] }`: `group, slug, label, changedBy[{role,scope,rows}], confirmedBy[{role,what}], told[{role}], text{changedBy,confirmedBy,told}` |
| R3 | `GET /:group?siteId` | `rules.read` | | the tab: `values, companyValues, version, siteVersion, effectiveFrom, isDefault, expectedVersion, expectedSiteVersion, scheduled, pendingConfirmations[], ownFields[], rows{id:{fields,kind,canChange,lockedReason,confirmedBy,waitingForConfirmation,ownRule}}, sitesWithOwnRule[], sites[]`, or `{ group, locked: true }` (Statutory without `payrun.read`). A holder limited to one site always gets their own site |
| R4 | `GET /:group/versions?siteId&page&pageSize` | `rules.read` | pageSize 10, 25, 50, 100 | `{ items[] (version view + status, changedSummary, told, withdrawn), total, page, pageSize, sites[], canWithdraw }` or locked |
| R5 | `POST /:group/versions/preview` | any `rules.edit.*` | `{ siteId?, effectiveFrom, values, useCompanyRuleFor?, expectedVersion? }` | `{ canSave, errors[{code,message,field,details}], changedFields, becomes, impact[], told[], toldWithoutFigures, needsConfirmation[], confirmsWithYourPin[], approvedMonthsAffected, earliestEffectiveFrom, defaultEffectiveFrom, expectedVersion }`. No writes |
| R6 | `POST /:group/versions` | any `rules.edit.*` | R5 body plus `reason` (1 to 500), `pin` (4 digits), `idempotencyKey?` or header `Idempotency-Key` | `201 { version, notice: { told[] }, confirmed[], waiting[] }`; `200` same shape on a retry |
| R7 | `POST /versions/:id/confirm` | any `rules.confirm.*` | `{ scope, note?, pin }` | `{ version }`; idempotent |
| R8 | `POST /versions/:id/withdraw` | any `rules.edit.*` | `{ reason, pin }` | `{ version }` (status `WITHDRAWN`); idempotent |

Errors: `400` `RULE_BACKDATED`, `RULE_MONTH_APPROVED`, `RULE_DATE_TOO_FAR`, `RULE_DATE_NOT_WEEK_START`, `RULE_FIELD_UNKNOWN`; `403` `RULE_FIELD_NOT_EDITABLE`, `RULE_CONFIRM_NOT_ALLOWED`, `PIN_INVALID`, `PIN_NOT_SET`; `404` another site (reads) or unknown version or group; `409` `RULE_NO_CHANGE`, `RULE_STALE` (`details.latestVersion`), `RULE_FUTURE_VERSION_EXISTS` (`details.version, effectiveFrom, withdrawable`), `RULE_CONFIRM_NOT_REQUIRED`, `RULE_VERSION_STARTED`, `RULE_VERSION_NOT_LATEST`, `RULE_VERSION_WITHDRAWN`, `RULE_IDEMPOTENCY_KEY_REUSED`; `422` `RULE_SITE_FIELD_NOT_OVERRIDABLE`; `429` `PIN_LOCKED`.

---

## 40. Workforce — Payroll, part 1 (segment 2A, BUILT 20 Oct 2026, back end only)

Base `/api/v1/workforce/payroll`. Source of truth: `backend/src/modules/workforce/payroll/README.md` and `docs/features/workforce/decisions-2a-payroll-backend.md`. Every route: `authenticate`, `attachWorkforceSubject`, `requireCapability(...)`, Zod. **Wire names:** `siteId`, `siteName`, `sites` read `organizationId`, `organizationName`, `organizations` in replies (exact keys only). `:monthKey` is `YYYY-MM`. Money is a string with two decimals. Every write takes `idempotencyKey` (8 to 80 characters; the same key answers the first result with `repeat: true`) and `stateVersion` (the version the screen showed). Part 2 adds publish, corrections, the bank file, Mark as paid and the exports.

| # | Method and path | Capability | Body or query | Success |
|---|---|---|---|---|
| P1 | `GET /months` | `payroll.read` | | the months, newest first, with stage and KPIs |
| P2 | `GET /months/:monthKey` | `payroll.read` | | the month: `state`, `stateVersion`, stage line, `kpis`, banner (why it waits), sites with approval status, `tabs[]`, `capabilities` |
| P3 | `GET /months/:monthKey/rules-applied` | `payroll.read` | | the rule versions the month froze, as cards |
| P4 | `GET /months/:monthKey/tax` | `payroll.read` | | one panel per statutory table, in the Accountant's order, with a worked example from a real line |
| P5 | `GET /months/:monthKey/casual` | `payroll.read` | | the casual pay memo |
| P6 | `GET /months/:monthKey/totals` | `payroll.read` | | `total` (`gross, net, taxStatutory, other, people`) and by site |
| P7 | `GET /months/:monthKey/payslips` | `payroll.read` | | the payslips list (drafts are visible to payroll readers only) |
| P8 | `GET /months/:monthKey/payslips/:payslipId` | `payroll.read` | | one payslip: `totals`, `lines[]` each with its working |
| P9 | `GET /months/:monthKey/estimate` | `payroll.estimate.read` | | the stored estimate of an open month |
| P10 | `GET /months/:monthKey/review` | `payroll.read` | `kind, state (OPEN, CHECKED), severity (BLOCK, TICK), q, siteId, page, rows (25, 50, 100)` | `{ lines[], counts{total,checked,blocking}, stale, stateVersion }` |
| P11 | `POST /months/:monthKey/recalculate` | `payroll.review` | `{ idempotencyKey, stateVersion }` | a new run; ticks cleared |
| P12 | `POST /months/:monthKey/review/:lineId/check` | `payroll.review` | `{ checked, stateVersion }` | the line; does not bump the version |
| P13 | `POST /months/:monthKey/review/check-kind` | `payroll.review` | `{ kind, stateVersion }` | the count ticked |
| P14 | `POST /months/:monthKey/review/:lineId/leave-out` | `payroll.review` | `{ reason, stateVersion, idempotencyKey }` | `{ recalculated: { runNumber, headcount, stateVersion } }` |
| P15 | `POST /months/:monthKey/adjustments` | `payroll.review` | `{ employeeId, type, label, amount, taxable, reason, pin, idempotencyKey, stateVersion }`; `type` is `ALLOWANCE, INCENTIVE, ARREARS, OTHER_EARNING, ADVANCE_REPAID, HELB, OTHER_DEDUCTION`; amount 1 to 10,000,000 | `201` the line; the month is worked again |
| P16 | `DELETE /months/:monthKey/adjustments/:id` | `payroll.review` | `{ stateVersion, idempotencyKey }` | `200` |
| P17 | `POST /months/:monthKey/send-to-accountant` | `payroll.review` | `{ idempotencyKey, stateVersion }` | the month, now `TO_APPROVE` |
| P18 | `POST /months/:monthKey/send-back` | `payroll.approve` | `{ reason (5 to 280, no amounts), idempotencyKey, stateVersion }` | the month, `IN_REVIEW`, ticks kept |
| P19 | `POST /months/:monthKey/approve` | `payroll.approve` | `{ pin, idempotencyKey, stateVersion, expectedTotals{gross,net,taxStatutory,other,headcount}, handChecked? }` | the month, `TO_PUBLISH`, `documentNumber` PAY-YYYY-MM; one frozen snapshot with a hash |
| P20 | `POST /months/:monthKey/sites/:siteId/remind` | `payroll.remind` | `{ idempotencyKey }` | at most one in 24 hours per site |
| P21 | `POST /months/:monthKey/sites/:siteId/approve-late` | `payroll.approve_site_late` | `{ pin, idempotencyKey, expectedTotals{workedMinutes,overtimeAuthorisedMinutes,headcount} }` | the site's timesheet month approved by the Director |

Errors: `400` `VALIDATION_ERROR`; `403` `PIN_INVALID`, `SELF_APPROVAL` (the approver prepared it), a missing capability; `404` unknown month or another site's data; `409` `CHANGED_UNDERNEATH` (`stateVersion` or the figures moved), `BLOCKING_LINES`, `MONTH_NOT_IN_REVIEW`, `MONTH_NOT_CALCULABLE`, `HAND_CHECK_REQUIRED` (a site's first payroll month), `ALREADY_APPROVED`, `PAID_IN_NEW_PAYROLL` (on the old `/payslips` write routes for a covered site and month).

## 41. Workforce — Payroll, part 2 (segment 2B, BUILT 20 Oct 2026, back end only)

**Browser headers (20 Oct 2026, front-end session):** the file downloads (P27 and P29) send `Access-Control-Expose-Headers` for `X-Bank-File-Hash`, `X-Document-Number` and `X-Revision`, so the page (on another origin) can read them; Mark as paid needs the hash. Test: `bank/bank-headers.test.ts`.

Same base, guards and wire names as §40. Source of truth: `backend/src/modules/workforce/payroll/README.md` and `docs/features/workforce/decisions-2b-payroll-backend.md`. Every POST takes an `idempotencyKey` (8 to 80 characters): the same key answers the first result (`repeat: true`), the same key for another action or month is `409 IDEMPOTENCY_KEY_REUSED`. A paid month answers every write below (and P11 to P21) with `409 MONTH_LOCKED`.

| # | Method and path | Capability | Body or query | Success |
|---|---|---|---|---|
| P22 | `POST /months/:monthKey/publish` | `payroll.publish` | `{ pin, idempotencyKey, stateVersion }` | `{ state: 'PUBLISHED', stateVersion, published }`; `ALREADY_PUBLISHED` for a second one |
| P23 | `GET /months/:monthKey/payslips/:payslipId/correction-inputs?version=` | `payroll.correct` | the version the screen shows | `{ current { lateDaysCounted, absentDays, overtimeAuthorisedMinutes, basicAmount, extraLines[] }, bankFile }` |
| P24 | `POST .../payslips/:payslipId/correction-preview` | `payroll.correct` | `{ change, expectedVersion }`; `change` is `{ kind, changes }` with `kind` `LATE_DAYS { lateDaysCounted }`, `UNPAID_ABSENCE { absentDays }`, `OVERTIME { ordinaryDay, restDay, publicHoliday }` (minutes), `BASIC { amount }`, `EXTRA_LINE { add[{type,label,amount,taxable}], removeIds[] }` | `{ lines[{code,label,now,corrected}], netNow, netCorrected, netChange, totals, voidsBankFile }`; saves nothing |
| P25 | `POST .../payslips/:payslipId/correct` | `payroll.correct` | `{ change, reason (5 to 280, no amounts), pin, expectedVersion, idempotencyKey }` | `{ payslipId, version, netBefore, netAfter, bankFileVoided, stateVersion }` |
| P26 | `GET /months/:monthKey/payout` | `payroll.read` | | `{ methods[{ method: 'BANK', people, amount, file{ state NONE/DOWNLOADED/VOIDED, version, filename, hash, downloadedBy, downloadedAt, voidReason } }], cannotPay[], nothingToPay[], otherMethods[], canMarkPaid, blockedBy, nextFilename }`; never an account number |
| P27 | `POST /months/:monthKey/bank-file` | `payroll.pay` | `{ idempotencyKey }` | the CSV (`text/csv`, `Cache-Control: no-store`, `X-Bank-File-Hash`, `X-Bank-File-Version`, `bank-2026-09.csv`, `-v2` after a void) |
| P28 | `POST /months/:monthKey/mark-paid` | `payroll.pay` | `{ pin, idempotencyKey, stateVersion, bankFileHash? }` (the hash is required when anyone is paid by bank) | `{ state: 'PAID', stateVersion, paidAt }` |
| P29 | `POST /months/:monthKey/exports` | `payroll.export` | `{ kind: REGISTER or SUMMARY or STATUTORY or PAYSLIPS, format: pdf or xlsx or zip, idempotencyKey }`; a kind takes only its own formats (register: pdf or xlsx; summary: pdf; statutory: xlsx; payslips: zip) | the file, with `X-Document-Number` (`PAY-2026-09` or `draft`) and `X-Revision` |

Also changed: P2's `capabilities` now has `canPay` (published) and `canCorrect` (published); the month carries `lockedAt`, `publishedAt`, `paidAt`; P7 takes `status=corrected` and returns `counts { all, corrected, leftOut }`, `documentNumber` (`PS-nnnn`) and `locked`; P8 returns `replacesVersion`, `replacedBy`, `versions[]`; P6 and P2's KPIs follow the latest payslip versions.

Errors added: `403` `SELF_CORRECTION`; `404` `NO_PAYSLIP`; `409` `ALREADY_PUBLISHED`, `ALREADY_PAID`, `MONTH_LOCKED`, `MONTH_NOT_APPROVED`, `CORRECTIONS_NOT_OPEN`, `PAYSLIP_CHANGED` (the version moved), `BANK_FILE_REQUIRED`, `BANK_FILE_CHANGED`, `BANK_FILE_NOT_AVAILABLE`, `PEOPLE_CANNOT_BE_PAID`, `NOTHING_CALCULATED`, `PAYSLIPS_NOT_PUBLISHED`; `422` `NO_CHANGE`, `NEGATIVE_NET`, `CORRECTION_NOT_ALLOWED`, `CORRECTION_NOT_CALCULABLE`; `413` `EXPORT_TOO_LARGE`; `429` `EXPORT_RATE_LIMIT`, `BANK_FILE_RATE_LIMIT`; `504` `EXPORT_TOO_SLOW`.

## 42. Workforce — Payslips, casual pay and the P9 (segment 3, BUILT 20 Oct 2026, back end only)

All routes: `authenticate`, `attachWorkforceSubject`, a capability. Success is `{ success: true, data }`. Errors: `400` validation; `403` missing capability (and the codes below); `404` a payslip, sheet or card outside the caller's reach (the same answer as a missing one); `409` state or version. Money is a string with two decimals; no pay figure is ever in a notification or audit entry.

### Payslips, base `/workforce/payslips`

Staff reads that show pay need two headers: `x-device-id` (the phone's own random id, 8 to 64 characters) and `x-payslip-unlock` (the token from Unlock). Without a live token they answer `403 UNLOCK_REQUIRED` (not 401: the apps would sign the person out). The System Admin has no payslip (`403`).

| Route | Capability | Notes |
|---|---|---|
| `GET /me` | `me.payslip` | Locked list, no amounts, no token: `{ unlockRequired, hasCode, items[{id, month, versionNumber, correctedAt, payDay, paidOn, status}], legacyAvailable, legacy{onNewSystem, hasOldPayslips, card, historyRow, emptyReason} }` |
| `POST /me/unlock` | `me.payslip` | `{ code, deviceId }` -> `{ unlockToken, expiresAt, idleSeconds }`. `403 CODE_WRONG` (`details.waitSeconds` from the 5th wrong try), `429 CODE_SLOWED` (`details.waitSeconds`), `409 NO_CODE_SET` |
| `POST /me/code` | `me.payslip` | First code `{ code, deviceId }`, `201`, returns an unlock token; `409 CODE_EXISTS` |
| `POST /me/lock` | `me.payslip` | `{ deviceId }` |
| `GET /me/home` | unlock | `{ latest, ytd{fromMonth,toMonth,earned,takenOff,net}, recent[], legacy }` |
| `GET /me/history?year=` | unlock | `{ years[], items[], p9{year,status,availableFrom}, legacy }` |
| `GET /me/:id?v=` | unlock | One payslip: this month and year to date, working lines, `correctedFrom`, bank (last 4), `hrContact`, `versions[]`, document path. Audited |
| `GET /me/:id/versions` | unlock | `[{versionNumber, createdAt, replacedAt, current}]` |
| `GET /me/:id/document?v=&purpose=view\|download\|share` | unlock | The stored A4 PDF, inline, `Cache-Control: private, no-store`. Audited with its purpose |
| `GET /me/p9/:year` | `me.payslip` | `{ year, status: NOT_YET\|WAITING_FORMAT\|READY, availableFrom, formatConfirmed }` |
| `GET /me/p9/:year/document` | unlock | The P9 PDF; `409 P9_NOT_AVAILABLE`, `P9_NO_KRA_PIN`, `P9_MONTH_MISSING`. Audited |
| `GET /:id`, `GET /:id/document` | `payslip.read_any` (HR, Accountant) | Anyone's published payslip, no staff code, audited, counted for the Director |
| `GET /opens?day=` | `audit.read.payslip_access` (Director) | `[{openerId, name, role, day, count}]` |
| `POST /p9/format/confirm` | `p9.confirm_format` (Accountant) | `{ pin }` |
| `POST /p9/:year/people/:employeeId/generate` | `p9.generate` (HR, Accountant) | Returns the P9 PDF for that person |

### Casual pay, base `/workforce/casuals`

Capabilities `casual.record` (a department head, own department), `casual.approve` (Branch or Store Manager, own site; the Director), `casual.read` (head, manager, HR, Accountant, Director); any of the three may read.

| Route | Capability | Notes |
|---|---|---|
| `GET /sheets?siteId&departmentId&date` | read | The day's sheet or an empty one with the rate (`noRate` when Rules have none) |
| `PUT /sheets/lines` | record | `{ siteId, departmentId, date, version, idempotencyKey, lines[{casualId,start,end,endsNextDay?}] }` creates or replaces; `409 CHANGED_UNDERNEATH`, `WORKER_OVERLAP`, `NO_DAILY_RATE`, `SHEET_NOT_EDITABLE`; `400/422` `DAY_TOO_OLD`, `DAY_IN_FUTURE`, `DAY_TOO_LONG`, `END_BEFORE_START`, `DUPLICATE_WORKER` |
| `GET /sheets/waiting` | approve | `{ toApprove[], unsigned[] }` |
| `GET /sheets/recent?siteId&departmentId?` | read | Last 7 days |
| `GET /sheets/:id` | read | One sheet |
| `GET /people?siteId&departmentId&q` / `POST /people` | read / record | My casuals / add one (`409 CASUAL_EXISTS` returns the existing record) |
| `POST /sheets/:id/send`, `/take-back` | record | `{ version, idempotencyKey }`; `409 SHIFT_NOT_ENDED`, `RATE_CHANGED` |
| `POST /sheets/:id/approve` | approve | `{ pin, version, expectedTotal, idempotencyKey }`; `403 PIN_INVALID`, `SELF_APPROVAL`, `DIRECTOR_ONLY`; `409 CHANGED_UNDERNEATH`, `SHEET_NOT_WAITING`, `ALREADY_DECIDED` |
| `POST /sheets/:id/send-back`, `/void` | approve | reason (and PIN for void); `409 ALREADY_SIGNED` |
| `POST /sheets/:id/corrections`, `DELETE /sheets/:id/corrections/:correctionId` | record | `201`; `422 NO_SIGNED_DAY`, `TOTAL_NEGATIVE` |
| `POST /sheets/:id/lines/:lineId/receive` | record | `{ name, idempotencyKey }`; `409 ALREADY_RECEIVED`, `SHEET_NOT_APPROVED` |
| `GET /sheets/:id/preview`, `/document` | read | Draft PDF (`CPS-draft`) / approved PDF |
| `GET /months/:monthKey/summary` | `payroll.read` | Approved sheets of the month for Payroll's Casual pay tab |

## 43. Workforce — Shared parts, back end A (segment 6a, BUILT 20 Oct 2026, back end only)

All routes: `authenticate`, `attachWorkforceSubject`, a capability; success `{ success: true, data }`. Every `/workforce` route also passes the session gate (`401 SESSION_ENDED`, `403 PASSWORD_RESET_REQUIRED`, `401 PHONE_REMOVED`). Every `5xx` carries `error.reference` (`WF-XXXX`). New capabilities: `needs_you.read` (Branch and Store Manager unit; Accountant, HR, Director, System Admin all), `needs_you.remind` (Director), `notifications.own` and `security.phones.own` (everyone with a login), `security.alerts.read`, `security.alerts.clear` (System Admin), `audit.verify_chain` (Director, System Admin). Changed: the signing PIN no longer locks: `429 PIN_SLOWED` (with `waitSeconds`) and `403 PIN_INVALID`; `PIN_LOCKED` is gone.

| Endpoint | Capability | Notes |
|---|---|---|
| `GET /workforce/notifications`, `/unread-count`; `POST /read`, `/read-all` | `notifications.own` | Own Inbox rows |
| `GET /workforce/security/phones/me` | `security.phones.own` | This phone from header `x-device-id` |
| `POST .../phones/me/current/seen { deviceId }`, `.../current/answer { deviceId, answer: REMEMBER\|ONCE, idempotencyKey }`, `.../:id/confirm`, `.../:id/remove` | `security.phones.own` | `404 PHONE_NOT_FOUND`, `409 THIS_PHONE` |
| `GET /workforce/security/alerts?status&kind&siteId&from&to&page&pageSize`, `/alerts/counts` | `security.alerts.read` | |
| `POST .../alerts/:id/clear { note, idempotencyKey }`, `POST .../alerts/start` | `security.alerts.clear` | `409 ALREADY_CLEARED`, `404 ALERT_NOT_FOUND` |
| `POST .../security/wasnt-me { deviceId?, entryId?, idempotencyKey }`, `POST .../reset-password { newPassword, confirm }`, `GET .../state` | signed in | `409 RESET_NOT_REQUIRED` |
| `GET /workforce/needs-you`, `/counts`, `/attention`; `POST /seen`, `/:id/undo` | `needs_you.read` (404 without) | `404 UNDO_UNAVAILABLE` |
| `GET /workforce/needs-you/overdue`; `POST /:id/remind { idempotencyKey }` | `needs_you.remind` (404 without) | `403 REMINDER_ALREADY_SENT`, `404 ITEM_NOT_OVERDUE` |

## 44. Workforce — Conduct (segment 5, BUILT 20 Oct 2026, back end only)

Base `/api/v1/workforce/conduct`. Source of truth: `backend/src/modules/workforce/conduct/README.md` and `docs/features/workforce/decisions-5-conduct-backend.md`. Every route: `authenticate`, `attachWorkforceSubject`, `requireCapability(...)`, Zod (`.strict()`); success `{ success: true, data }`. A notice outside the caller's reach is `404`; one in reach but not allowed is `403`. Everything is behind the branch's attendance switch: `409 CONDUCT_NOT_ENABLED` to issue while it is off, and the old HR screen answers `409 CONDUCT_IN_NEW_SYSTEM` while it is on. A push or lock-screen text never carries the reason. PINs go through the shared pause door: wrong tries are logged and slowed, never a lock.

**New capability (one row in `workforce-access.ts`):** `discipline.decide`. HR: all. Director: all, narrowed in the service to notices HR issued (`403 NOT_DECIDER` otherwise). Branch Manager, staff, heads, Accountant and System Admin do not have it. System Admin and Accountant have no `discipline.*` row at all.

| Endpoint | Capability | Notes |
|---|---|---|
| `GET /conduct/me`, `GET /conduct/badge` | `discipline.read_own` | The caller's own notices; the badge counts the rows the Needs-you card shows (staff have no `needs_you.read`) |
| `GET /conduct?status=active\|appealed\|ended&site&q&page&pageSize` | `discipline.read` | Site-scoped for a Branch Manager; pageSize 25, 50 or 100 |
| `GET /conduct/people?q`, `GET /conduct/draft?personId&about&month` | `discipline.issue` | People in reach; the draft carries the frozen facts and the suggested level |
| `POST /conduct/draft/preview { personId, level, about, factsMonth?, ownLine }` | `discipline.issue` | A4 PDF stamped DRAFT, nothing stored; `422 NO_LETTER` for a verbal note |
| `POST /conduct { personId, level, about, factsMonth?, ownLine, pin, idempotencyKey }` | `discipline.issue` | `201`; same key again returns the same notice; `422 NO_FACTS`, `409 LEVEL_NOT_IN_RULES`, `403 ISSUE_NOT_ALLOWED` (a notice to oneself), `409 IDEMPOTENCY_KEY_REUSED`, `403 PIN_INVALID` |
| `GET /conduct/:id` | `discipline.read` or `discipline.read_own` | 404 outside reach; a head sees nothing unless named witness |
| `GET /conduct/:id/document?version=1\|2\|3\|latest&inline=0\|1` | same | `application/pdf`, `private, no-store`, ETag is the file hash; a manager's open writes `conduct.document_read`, the person's own does not; `404 DOCUMENT_VERSION_NOT_FOUND` |
| `POST /conduct/:id/sign { code, deviceId, idempotencyKey }` | `discipline.read_own` | Wrong code `403 PIN_INVALID` (paused, never locked); `409 NOT_SIGNABLE`, `409 INVALID_TRANSITION` |
| `POST /conduct/:id/appeal { reasonKey: FACTS_WRONG\|GOOD_REASON\|TOO_STRONG\|OTHER, text, idempotencyKey }` | `discipline.read_own` | No PIN; one per notice within 7 days: `409 ALREADY_APPEALED`, `409 APPEAL_WINDOW_CLOSED`, `409 NOT_APPEALABLE` |
| `POST /conduct/:id/not-signed { reason: REFUSED\|NOT_REACHED\|NO_LOGIN, witnessId, pin, idempotencyKey }` | `discipline.issue` | Issuer or HR; `422 LOGIN_EXISTS`, `422 NO_LOGIN_ONLY`, `422 TOO_EARLY`, `422 WITNESS_NOT_ALLOWED`, `409 ALREADY_RECORDED`, `409 ALREADY_SIGNED` |
| `GET /conduct/:id/witness-options?q` | `discipline.issue` | Colleagues at the site who could witness |
| `GET /conduct/:id/witness`, `POST /conduct/:id/witness { confirmed, code? }` | `notifications.own` | 404 unless named; a code is needed to confirm; no reason is shown; answering twice returns the first answer |
| `POST /conduct/:id/decision/preview { outcome }`, `POST /conduct/:id/decision { outcome: KEEP\|REDUCE_TO_WRITTEN\|REDUCE_TO_VERBAL\|WITHDRAW, reason, pin, idempotencyKey }` | `discipline.decide` | Reduce makes a new linked notice and the old letter gains a decision page as version 2; `409 ALREADY_DECIDED` for the second decider, `409 NOTHING_TO_DECIDE`, `422 REDUCE_NOT_POSSIBLE`, `403 SELF_DECISION`, `403 NOT_DECIDER` |
| `GET /workforce/people/:id/conduct` | `discipline.read` | The employee file tab: new notices plus "Before the new system" rows from the old table, read only |

Events: `conduct.appeal_sent`, `conduct.appeal_decided`. A nightly job (00:10 Nairobi) ends notices past their end date, tells the Director once about an appeal past 7 days, and reports a silent witness. The documents door (back end B) takes the named hook `registerConductDocuments`.
