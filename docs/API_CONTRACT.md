# API Contract
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-02-22  
**Base URL:** `https://api.wendorms.co.ke/api/v1`  

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Menu](#3-menu)
4. [Orders](#4-orders)
5. [Prep Tickets](#5-prep-tickets)
6. [Staff](#6-staff)
7. [Shifts & Scheduling](#7-shifts--scheduling)
8. [Clock Records](#8-clock-records)
9. [Delivery Zones](#9-delivery-zones)
10. [Branches](#10-branches)
11. [Reports](#11-reports)
12. [System Admin](#12-system-admin)
13. [Health](#13-health)
14. [WebSocket Events](#14-websocket-events)

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
| 🔑 MGR | Manager and above |
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
            "price": "350.00",
            "isAvailable": true
          },
          {
            "id": "uuid",
            "name": "Flat White",
            "description": "Double shot with velvety microfoam",
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

### POST `/menu/items`
**Access:** 🔑 SA, DIR  
Creates a new menu item.

**Request Body:**
```json
{
  "categoryId": "uuid",
  "name": "Iced Latte",
  "description": "Chilled espresso with cold milk",
  "price": "400.00"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "categoryId": "uuid",
    "name": "Iced Latte",
    "description": "Chilled espresso with cold milk",
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
  "price": "420.00",
  "isActive": true
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Iced Latte", "price": "420.00", "isActive": true },
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
Modifies the items on an order. Only allowed while at least one prep ticket for the affected items is still `PENDING`.

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
- If all prep tickets are `IN_PROGRESS` or `READY`, modification is rejected with `409 CONFLICT`
- Only items routed to stations still in `PENDING` can be changed

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
    "message": "Order cannot be modified. Preparation has already started at all stations."
  }
}
```

**Notes:**
- Recalculates subtotal and total
- Regenerates the JSON items snapshot on the affected PrepTicket(s)
- Emits `order:modified` WebSocket event to affected station room(s)

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
- `paymentMethod` required: `MPESA | CASH | CARD`
- Delivery orders only accept `MPESA`
- Order must be in `READY` status before payment can be recorded
- For delivery orders, all prep tickets must be `READY`

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

### PATCH `/orders/:id/cancel`
**Access:** 🔑 WAITER, MGR  
Cancels an order. Only allowed while all prep tickets are still `PENDING`.

**Request Body:**
```json
{
  "reason": "Customer left"
}
```

**Response `200`:**
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
    "message": "Order cannot be cancelled. Preparation has already started."
  }
}
```

---

## 5. Prep Tickets

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

---

## 6. Staff

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
**Access:** 🔑 MGR, DIR  
Returns shift definitions for the branch.

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
**Access:** 🔑 MGR  
Creates a new shift definition.

**Request Body:**
```json
{
  "name": "Morning",
  "startTime": "06:00",
  "endTime": "14:00"
}
```

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
**Access:** 🔑 MGR  
Updates a shift definition.

**Request Body:** (all fields optional)
```json
{
  "name": "Early Morning",
  "startTime": "05:30",
  "endTime": "13:30"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { /* updated shift object */ },
  "message": "Shift updated successfully"
}
```

---

### GET `/shift-assignments`
**Access:** 🔑 MGR, ALL (staff see their own only)  
Returns shift assignments. Managers see all assignments for their branch. Staff see only their own.

**Query Params:**
```
startDate   (required) — YYYY-MM-DD
endDate     (required) — YYYY-MM-DD
userId      (optional, MGR only) — filter by staff member
shiftId     (optional) — filter by shift
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
**Access:** 🔑 MGR  
Assigns a staff member to a shift on a specific date.

**Request Body:**
```json
{
  "userId": "uuid",
  "shiftId": "uuid",
  "date": "2026-02-23"
}
```

**Validation Rules:**
- `userId` must belong to the manager's branch
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
- User must not already be clocked in

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
    "code": "AUTHORIZATION_ERROR",
    "message": "You must be at the branch to clock in. You are approximately 120 metres away."
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

---

### POST `/clock/override`
**Access:** 🔑 MGR  
Manager override for a staff member's clock-in or clock-out.

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

## 12. System Admin

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

## 13. Health

### GET `/health`
**Access:** Public  
Returns system health status. Used by Render for uptime monitoring.

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

## 14. WebSocket Events

WebSocket connection is established at: `wss://api.wendorms.co.ke`

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

### Server → Client Events

| Event | Payload | Recipient |
|---|---|---|
| `order:new` | `PrepTicket` object | Kitchen or Barista room (based on station) |
| `order:claimed` | `{ orderId, ticketId, station, claimedBy: { id, name } }` | Waiter user room |
| `order:ready` | `{ orderId, ticketId, station, orderDailyNumber }` | Waiter user room |
| `order:all_ready` | `{ orderId, orderDailyNumber }` | Waiter user room |
| `order:modified` | Updated `PrepTicket` object | Affected station room |
| `order:cancelled` | `{ orderId, orderDailyNumber }` | Kitchen and Barista room |
| `ticket:status_changed` | `{ ticketId, orderId, status, claimedBy }` | Branch room |

### Connection Error Handling

| Error | Cause | Client Behaviour |
|---|---|---|
| `connect_error` | Invalid token or server unavailable | Show offline banner, retry with exponential backoff |
| `disconnect` | Network loss | Show offline banner, auto-reconnect |
| `reconnect` | Connection restored | Re-fetch latest state via `GET /api/v1/sync`, dismiss banner |

---

*This API Contract is the authoritative reference for all frontend-backend communication in the Wendo RMS V1. Every endpoint reflects the data model, business rules, and architectural decisions defined in the PRD, Data Model, and TDD. Any new endpoint or change to an existing one must be documented here before implementation.*
