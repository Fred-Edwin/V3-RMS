# API Contract
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 2.0
**Status:** Current
**Date:** 2026-05-04
**Base URL:** `https://api.wendo-rms.co.ke/api/v1`

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

#### GET `/house-account-auth`
**Access:** 🔑 MGR, DIR
Returns pending House Account authorization requests for the branch.

#### POST `/house-account-auth/:id/override`
**Access:** 🔑 MGR, DIR
Approves or rejects a pending House Account payment request.

**Request Body:**
```json
{ "action": "APPROVE" }
```

- On `APPROVE`: order is closed, `houseAccount.currentBalance` incremented atomically.
- On `REJECT`: order returns to `READY`, `PAYMENT_REJECTED` incident logged, waiter notified.

#### POST `/house-account-auth/:id/force-expire`
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
status          (optional) — PENDING | APPROVED | REJECTED | CANCELLED
organizationId  (optional, HR/DIR/SA)
```

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

