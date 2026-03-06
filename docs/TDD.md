# Technical Design Document
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-02-22  
**Author:** System Architect  

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [System Overview](#2-system-overview)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Technology Stack](#4-technology-stack)
5. [Application Architecture](#5-application-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Backend Architecture](#7-backend-architecture)
8. [Real-Time Architecture](#8-real-time-architecture)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [API Design Principles](#10-api-design-principles)
11. [Error Handling Architecture](#11-error-handling-architecture)
12. [Notification Architecture](#12-notification-architecture)
13. [Geofencing Implementation](#13-geofencing-implementation)
14. [Order Processing Architecture](#14-order-processing-architecture)
15. [Background Jobs](#15-background-jobs)
16. [Caching Strategy](#16-caching-strategy)
17. [Security Architecture](#17-security-architecture)
18. [Offline Resilience Strategy](#18-offline-resilience-strategy)
19. [Performance Considerations](#19-performance-considerations)
20. [Deployment Architecture](#20-deployment-architecture)
21. [Observability](#21-observability)
22. [Architecture Decision Records](#22-architecture-decision-records)
23. [Open Questions](#23-open-questions)

---

## 1. Problem Statement

Wendo Coffee Bistro operates two branches in Nyeri, Kenya, with plans to expand to 10 branches incrementally starting next month. The business currently runs on paper-based order management, manual record keeping, and shared POS devices. This approach is unsustainable at scale.

The system must solve the following:
- Replace paper orders with a digital, real-time order flow from waiter to prep station
- Route orders automatically to the correct prep station (Kitchen or Barista)
- Give every staff member a personal account to perform their role from their device
- Give management real-time operational visibility without being physically present
- Collect structured operational data to drive business decisions
- Support 2 branches at launch and scale to 10+ without re-architecture

---

## 2. System Overview

The Wendo RMS is a **multi-tenant, real-time restaurant management platform** built as a unified web application with role-based interfaces. It consists of:

- A **mobile-first web app** used by waiters, chefs, and baristas on their personal phones and shared tablets
- A **web dashboard** used by managers and the director for oversight, scheduling, and reporting
- A **REST API backend** that handles all business logic, data persistence, and real-time coordination
- A **WebSocket layer** for pushing real-time events to all connected clients
- A **background job system** for scheduled tasks like shift reminders
- A **caching layer** for high-frequency read operations

All interfaces are role-aware — the same application serves a different view based on the authenticated user's role. A waiter sees the order-taking interface. A chef sees the Kitchen Display System. A manager sees the branch operations dashboard.

---

## 3. Architecture Diagram

### System-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐   │
│  │Waiter Phone │  │ KDS Tablet  │  │  Manager / Director   │   │
│  │(mobile web) │  │(tablet web) │  │    (web dashboard)    │   │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬───────────┘   │
│         │                │                      │               │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
          │         HTTPS + WSS (TLS)              │
          │                │                      │
┌─────────▼────────────────▼──────────────────────▼───────────────┐
│                     BACKEND (DigitalOcean)                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Express API Server                     │   │
│  │                                                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │   │
│  │  │  Routes &  │  │  Service   │  │   Repository       │ │   │
│  │  │Controllers │→ │   Layer    │→ │   Layer (Prisma)   │ │   │
│  │  └────────────┘  └────────────┘  └────────────────────┘ │   │
│  │                                                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │   │
│  │  │ Middleware │  │  Socket.io │  │   BullMQ Jobs      │ │   │
│  │  │(Auth/RBAC) │  │  Server   │  │  (Background)      │ │   │
│  │  └────────────┘  └────────────┘  └────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────┬───────────────────────┘
                       │                  │
          ┌────────────▼───┐    ┌─────────▼──────┐
          │  PostgreSQL    │    │   Redis         │
          │  (PostgreSQL)    │    │   (Redis)     │
          │                │    │                 │
          │  - All data    │    │  - Session cache│
          │  - Migrations  │    │  - Menu cache   │
          └────────────────┘    │  - Job queues   │
                                └─────────────────┘
                                        │
                               ┌────────▼────────┐
                               │  Firebase (FCM) │
                               │  Push Notifs    │
                               └─────────────────┘
```

### Layered Architecture (Per Request)

```
┌─────────────────────────────┐
│     Client (Next.js)        │  Presentation — renders UI, calls API
├─────────────────────────────┤
│  API Layer (Express Routes) │  Validates input (Zod), delegates to service
├─────────────────────────────┤
│     Service Layer           │  All business logic lives here
├─────────────────────────────┤
│  Repository Layer (Prisma)  │  All database queries live here
├─────────────────────────────┤
│   Database (PostgreSQL)     │  Data storage only
└─────────────────────────────┘
```

**Layer rules — non-negotiable:**
- The frontend never queries the database directly
- Controllers never contain business logic — they validate input and delegate to services
- Services never write raw SQL — they call repositories
- Repositories never contain business logic — they only query
- Each layer calls only the layer directly below it, never skips

---

## 4. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend Framework | Next.js latest (App Router) + TypeScript | SSR, routing, API routes, single deployment |
| Styling | Tailwind CSS | Utility-first, fast, consistent design system |
| State Management | Zustand | Lightweight, minimal boilerplate, sufficient for our needs |
| Backend | Node.js + Express + TypeScript | Proven, performant, large ecosystem |
| Validation | Zod | Runtime type safety at API boundaries |
| ORM | Prisma | Type-safe queries, clean migrations, PostgreSQL native |
| Database | PostgreSQL 16 (Docker on DigitalOcean) | Relational integrity, ACID compliance, low-cost co-located deployment |
| Real-time | Socket.io | WebSocket abstraction with auto-reconnect |
| Caching | Redis 7 (Docker on DigitalOcean) | Fast in-memory cache, BullMQ backing, no external network hop |
| Background Jobs | BullMQ | Reliable job queuing backed by Redis |
| Push Notifications | Firebase Cloud Messaging (FCM) | Industry standard, free, Android web push support |
| Frontend Hosting | Vercel | Zero-config Next.js deployment, global CDN |
| Backend Hosting | DigitalOcean Droplet + Docker Compose | Full control, low cost, containerized API/worker runtime |
| Database Hosting | PostgreSQL container + DigitalOcean backups + daily dumps | Predictable recovery model with infra-level and logical backups |
| Redis Hosting | Redis container on DigitalOcean | Simple ops, local network performance, no external dependency |

---

## 5. Application Architecture

### Single Unified Application — Role-Based Views

The entire system is one Next.js application and one Express backend. When a user authenticates, their role determines the interface they see. This eliminates maintaining multiple codebases across what would otherwise be 4–5 separate applications.

```
Same URL, different experience based on role:

WAITER      → /app/orders         (order taking interface)
CHEF        → /app/kitchen        (KDS interface)
BARISTA     → /app/barista        (BDS interface)
MANAGER     → /app/dashboard      (branch management dashboard)
DIRECTOR    → /app/director       (cross-branch overview)
SYSTEM_ADMIN → /app/admin         (system configuration)
```

### Shared Tablet Accounts (KDS / BDS)

Each branch has two dedicated display accounts — one for the Kitchen Display, one for the Barista Display. These accounts hold the `KITCHEN_DISPLAY` and `BARISTA_DISPLAY` roles respectively.

The manager creates these accounts once during branch setup. The tablets stay permanently logged in. These accounts are scoped to see only their station's prep tickets — nothing else in the system is accessible.

If a tablet is compromised or lost, the manager can revoke the account from their dashboard and create a new one.

### Project Structure

```
wendo-rms/
│
├── frontend/                        # Next.js application
│   ├── app/                         # App Router pages
│   │   ├── (auth)/                  # Login, password reset
│   │   ├── app/                     # Authenticated app routes
│   │   │   ├── orders/              # Waiter order interface
│   │   │   ├── kitchen/             # KDS interface
│   │   │   ├── barista/             # BDS interface
│   │   │   ├── dashboard/           # Manager dashboard
│   │   │   └── director/            # Director dashboard
│   │   └── layout.tsx
│   ├── components/                  # Reusable UI components
│   │   ├── ui/                      # Base components (buttons, modals, cards)
│   │   ├── orders/                  # Order-specific components
│   │   ├── kitchen/                 # KDS-specific components
│   │   └── dashboard/               # Dashboard components
│   ├── hooks/                       # Custom React hooks
│   ├── services/                    # API call functions (fetch wrappers)
│   ├── store/                       # Zustand stores
│   ├── lib/                         # Utilities, socket client setup
│   └── types/                       # TypeScript type definitions
│
├── backend/                         # Express application
│   ├── src/
│   │   ├── config/                  # DB, Redis, Firebase, Socket setup
│   │   ├── controllers/             # Route handlers (thin — validate + delegate)
│   │   ├── services/                # Business logic
│   │   ├── repositories/            # Prisma queries
│   │   ├── middleware/              # Auth, RBAC, error handler, logger
│   │   ├── routes/                  # Express route definitions
│   │   ├── sockets/                 # Socket.io event handlers
│   │   ├── jobs/                    # BullMQ job definitions and processors
│   │   ├── validators/              # Zod schemas for all request validation
│   │   ├── utils/                   # Shared helpers (haversine, etc.)
│   │   └── types/                   # TypeScript interfaces and types
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
│
└── shared/                          # Types shared between frontend and backend
    └── types/
```

---

## 6. Frontend Architecture

### Routing Strategy

Next.js App Router. Route groups separate authenticated from unauthenticated routes. Middleware redirects unauthenticated users to login and authenticated users to their role-appropriate landing page.

```typescript
// middleware.ts — runs on every request
// Checks JWT from cookie, redirects based on role
export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')
  if (!token) return redirect('/login')
  
  const { role } = verifyToken(token)
  const path = request.nextUrl.pathname
  
  // Enforce role-based route access
  if (path.startsWith('/app/dashboard') && role !== 'MANAGER') {
    return redirect(getRoleHomePage(role))
  }
  // ... etc
}
```

### State Management — Zustand

Three primary stores:

**`useAuthStore`** — current user, role, branch, token state  
**`useOrderStore`** — active orders for the waiter interface, real-time updates  
**`useKitchenStore`** — prep tickets for KDS/BDS, real-time claim and status updates  

Stores are updated both from API responses (initial load) and WebSocket events (real-time updates). This keeps the UI always in sync with the server.

### Hook Stability and Effect Safety

To prevent refetch loops, UI flicker, and request storms:

- Custom hooks that return functions used by `useEffect` or `useCallback` dependencies must return stable references.
- Zustand usage should select specific actions (`useStore((s) => s.action)`) instead of destructuring the full store object.
- Data-loading effects should depend on stable callbacks only.
- Do not remove dependencies from hook arrays to silence lint warnings unless the omission is explicitly documented and proven safe.
- Shared hooks used across multiple pages (for example, notifications/toast helpers) must stabilize returned callbacks in the hook implementation.

### Real-Time Client (Socket.io)

A single socket connection is established on login and torn down on logout. The client joins a branch-specific room immediately after connecting.

```typescript
// lib/socket.ts
const socket = io(process.env.NEXT_PUBLIC_API_URL, {
  auth: { token: accessToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
})

socket.on('connect', () => {
  socket.emit('join:branch', { organizationId })
})

// Order events update Zustand stores directly
socket.on('order:new', (order) => {
  useKitchenStore.getState().addPendingTicket(order)
})
```

### API Service Layer

All API calls go through typed service functions — never raw `fetch` calls scattered across components.

```typescript
// services/orders.ts
export const orderService = {
  create: (data: CreateOrderDto) =>
    apiClient.post<Order>('/orders', data),
  
  getActive: () =>
    apiClient.get<Order[]>('/orders/active'),
  
  updateStatus: (id: string, status: OrderStatus) =>
    apiClient.patch<Order>(`/orders/${id}/status`, { status }),
}
```

---

## 7. Backend Architecture

### Controller — Thin by Design

Controllers do exactly three things: validate the request with Zod, call the appropriate service, and return the response. No business logic ever lives here.

```typescript
// controllers/orderController.ts
export const createOrder = async (req: Request, res: Response) => {
  const data = CreateOrderSchema.parse(req.body)  // Zod validation — throws if invalid
  const order = await orderService.create(data, req.user)
  res.status(201).json(successResponse(order, 'Order created'))
}
```

### Service Layer — Business Logic Home

All decisions, calculations, and orchestration live in services. Services call repositories for data, call other services if needed, emit socket events after state changes, and queue background jobs.

```typescript
// services/orderService.ts
export const orderService = {
  create: async (data: CreateOrderDto, actor: AuthUser) => {
    // 1. Validate menu items are available at this branch
    await menuService.validateItemsAvailable(data.items, actor.organizationId)
    
    // 2. Calculate totals
    const { subtotal, deliveryFee, total } = await pricingService.calculate(data)
    
    // 3. Persist the order and its items in a transaction
    const order = await orderRepository.createWithItems({ ...data, subtotal, deliveryFee, total })
    
    // 4. Generate prep tickets and route to stations
    const tickets = await prepTicketService.generateAndRoute(order)
    
    // 5. Emit real-time events to the relevant prep stations
    socketService.emitToStation(actor.organizationId, tickets)
    
    return order
  }
}
```

### Repository Layer — Database Queries Only

Repositories contain Prisma queries and nothing else. Every repository query that reads business data always includes `organizationId` in the where clause — no exceptions.

```typescript
// repositories/orderRepository.ts
export const orderRepository = {
  findActive: async (organizationId: string) => {
    return prisma.order.findMany({
      where: {
        organizationId,        // always scoped to branch
        status: { not: 'CLOSED' },
        deletedAt: null,
      },
      include: { items: true, prepTickets: true },
      orderBy: { createdAt: 'asc' },
    })
  },
}
```

### Global Error Handler

A single Express error-handling middleware catches all errors thrown anywhere in the stack and formats them into the standard response envelope. Route handlers never send error responses directly — they throw and let the handler format.

```typescript
// middleware/errorHandler.ts
export const globalErrorHandler = (
  err: Error, req: Request, res: Response, next: NextFunction
) => {
  logger.error({ err, path: req.path, method: req.method })

  if (err instanceof ValidationError) {
    return res.status(400).json(errorResponse('VALIDATION_ERROR', err.message, err.details))
  }
  if (err instanceof AuthorizationError) {
    return res.status(403).json(errorResponse('AUTHORIZATION_ERROR', err.message))
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json(errorResponse('NOT_FOUND', err.message))
  }

  // Unknown errors — don't leak internals to the client
  return res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'))
}
```

### Standard Response Envelope

Every API response — success or error — follows this structure without exception:

```json
// Success
{
  "success": true,
  "data": {},
  "message": "Order created successfully"
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Table number is required for dine-in orders",
    "details": []
  }
}

// Paginated List
{
  "success": true,
  "data": [],
  "pagination": {
    "total": 84,
    "page": 1,
    "perPage": 20,
    "totalPages": 5
  }
}
```

---

## 8. Real-Time Architecture

### WebSocket Design (Socket.io)

Every real-time event in the system flows through Socket.io. The server maintains a persistent connection with every connected client. Clients are organised into **branch rooms** — events for Kingz branch never reach Town branch clients.

### Room Structure

```
Room: branch:{organizationId}           — all clients at a branch
Room: branch:{organizationId}:kitchen   — KDS tablet + chefs' phones
Room: branch:{organizationId}:barista   — BDS tablet + baristas' phones
Room: branch:{organizationId}:waiters   — waiters at this branch
Room: user:{userId}                     — direct messages to a single user
```

### Event Catalogue

| Event Name | Direction | Payload | Recipients |
|---|---|---|---|
| `order:new` | Server → Client | PrepTicket data | Kitchen or Barista room |
| `order:claimed` | Server → Client | ticketId, claimedBy | Waiter (user room) |
| `order:ready` | Server → Client | orderId, station | Waiter (user room) |
| `order:modified` | Server → Client | Updated ticket data | Affected station room |
| `ticket:status_changed` | Server → Client | ticketId, newStatus | Branch room |
| `join:branch` | Client → Server | organizationId | — |

### Connection Lifecycle

```
1. User logs in → receives JWT access token
2. Frontend establishes WebSocket connection with token in auth header
3. Server validates token on connection → associates socket with userId and organizationId
4. Server adds socket to appropriate rooms based on role
5. On disconnect → Socket.io handles cleanup automatically
6. On reconnect → client re-joins rooms, fetches latest state via REST API to sync
```

### Why REST + WebSockets Together

REST handles all **actions** (create order, claim ticket, mark ready). WebSockets handle all **reactions** (notifying other clients about state changes). This separation keeps the architecture clean — WebSockets are never used to perform actions, only to broadcast events.

```
Waiter submits order    → POST /api/v1/orders  (REST)
                        ↓
Server creates order    → emits order:new to kitchen room  (WebSocket)
                        ↓
KDS receives event      → updates UI instantly
```

---

## 9. Authentication & Authorization

### JWT Authentication

```
Login flow:
1. POST /api/v1/auth/login with email + password
2. Server verifies password hash (bcrypt, 12 rounds)
3. Server issues:
   - Access token (JWT, 15 min expiry) — returned in response body
   - Refresh token (JWT, 7 days expiry) — set as HTTP-only cookie
4. Client stores access token in memory (Zustand store) — never in localStorage
5. Every API request sends access token in Authorization header: Bearer <token>
6. When access token expires, client calls POST /api/v1/auth/refresh
7. Server reads refresh token from HTTP-only cookie, issues new access token
```

**Why access token in memory, not localStorage or cookies?**
localStorage is accessible to any JavaScript on the page — an XSS attack can steal it. An HTTP-only cookie is not readable by JavaScript. Access tokens in memory means they are lost on page refresh (handled by the refresh token flow) but cannot be stolen by scripts.

### Role-Based Access Control (RBAC)

Authorization is enforced in middleware before the route handler runs — never inside the handler.

```typescript
// middleware/rbac.ts
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      throw new AuthorizationError('You do not have permission to perform this action')
    }
    next()
  }
}

// Usage in routes
router.post('/orders', authenticate, requireRole('WAITER'), createOrder)
router.get('/reports/daily', authenticate, requireRole('MANAGER', 'DIRECTOR'), getDailyReport)
```

### Branch Isolation Middleware

In addition to role checks, every request from a branch-scoped user is verified to operate within their branch only. This is a second layer of protection — even if a bug in business logic forgets to filter by `organizationId`, the middleware has already attached the correct `organizationId` from the token to the request object.

```typescript
// middleware/branchScope.ts
// Attaches verified organizationId from JWT to req.user
// Service and repository layers always use req.user.organizationId
// Never trust organizationId from req.body or req.params
```

---

## 10. API Design Principles

### Versioning
All routes prefixed with `/api/v1/`. Breaking changes introduce `/api/v2/`. Old versions deprecated with notice, never deleted immediately.

### RESTful Resource Naming
```
GET    /api/v1/orders              — list orders (filtered by branch automatically)
GET    /api/v1/orders/:id          — get specific order
POST   /api/v1/orders              — create order
PATCH  /api/v1/orders/:id          — update order
DELETE /api/v1/orders/:id          — soft delete order

POST   /api/v1/prep-tickets/:id/claim   — claim a prep ticket
PATCH  /api/v1/prep-tickets/:id/ready   — mark prep ticket as ready
```

### Input Validation with Zod
Every endpoint that accepts a request body has a corresponding Zod schema in `/validators/`. Validation runs in the controller before any service call. If validation fails, a `ValidationError` is thrown and the global error handler formats the 400 response.

---

## 11. Error Handling Architecture

### Custom Error Classes

```typescript
// All application errors extend AppError
class AppError extends Error {
  constructor(public message: string, public statusCode: number, public code: string) {
    super(message)
  }
}

class ValidationError extends AppError { /* 400 */ }
class AuthenticationError extends AppError { /* 401 */ }
class AuthorizationError extends AppError { /* 403 */ }
class NotFoundError extends AppError { /* 404 */ }
class ConflictError extends AppError { /* 409 */ }
class InternalError extends AppError { /* 500 */ }
```

### Error Flow

```
Route Handler throws ValidationError("Table number required")
        ↓
Express catches it → passes to globalErrorHandler middleware
        ↓
globalErrorHandler formats standard error response envelope
        ↓
Client receives: { success: false, error: { code, message, details } }
```

No try-catch blocks scattered across controllers. One place handles all errors.

---

## 12. Notification Architecture

### Two Notification Channels

**In-App (WebSocket)** — for users who have the app open. Instant, under 500ms. Used for all operational events (order ready, order claimed).

**Push Notification (FCM)** — for when the app is in the background or device is locked. Used for: order ready alerts to waiters, shift reminders to staff.

### FCM Device Token Management

When a user logs in on a device, the browser requests notification permission and registers an FCM device token. This token is sent to the backend and stored against the user's account. When a push notification is needed, the backend sends via FCM using the stored token.

### Shift Reminder Job

Shift reminders (24 hours before shift start) are handled by a BullMQ scheduled job — not by a request handler. The job scheduler runs nightly, queues reminder notifications for all shifts starting in the next 24 hours, and the job processor sends them via FCM.

---

## 13. Geofencing Implementation

### Clock-In Flow

```
1. Staff taps "Clock In" on their device
2. Browser Geolocation API requests GPS coordinates from device
3. Coordinates sent to POST /api/v1/clock/in
4. Server retrieves branch coordinates from database (or Redis cache)
5. Server calculates distance using Haversine formula
6. Server enforces "one open clock record per user" before creating a new clock-in, including manager overrides
7. If distance ≤ configured radius (default 50 metres) → clock-in approved, record saved with method: GPS
8. If distance > configured radius → 403 error returned with structured details (`distanceMetres`, `allowedRadiusMetres`)
9. Manager override → POST /api/v1/clock/override with reason note → saved with method: OVERRIDE
10. Valid override action is derived from the current attendance state; the UI must not ask the manager to guess when a staff member should clock in vs clock out
```

### Haversine Formula

The Haversine formula calculates the distance between two points on Earth's surface given their latitude and longitude. It accounts for the curvature of the Earth and is accurate at short distances like 50 metres.

```typescript
// utils/haversine.ts
export function getDistanceMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // Earth's radius in metres
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
```

### Security Consideration

The geofence check is **server-side only**. Client-side GPS coordinates are untrusted input — the server validates them against the stored branch coordinates. A staff member cannot bypass geofencing by manipulating their device.

### Reliability Constraints

- All "today" attendance checks use `Africa/Nairobi` business date semantics.
- Clock-out writes must be guarded against stale concurrent updates; repeated or raced requests return a deterministic `409` instead of silently overwriting attendance state.
- Client UX must treat geolocation failures separately from attendance-state conflicts (for example: permission denied vs already clocked in).

---

## 14. Order Processing Architecture

### Order Submission Flow (Critical Path)

This is the most important operation in the system. It must be reliable, atomic, and fast.

```
POST /api/v1/orders
        ↓
1. Zod validates request shape
2. Auth middleware verifies JWT
3. RBAC middleware confirms role = WAITER
4. orderService.create() begins:
   │
   ├── 5. Validate all menu items exist and are available at this branch
   ├── 6. Snapshot current prices for all items
   ├── 7. Calculate subtotal, delivery fee, total
   │
   ├── 8. DATABASE TRANSACTION begins
   │       ├── Generate daily order number (count today's orders + 1)
   │       ├── INSERT order record
   │       ├── INSERT order_items records (with snapshotted prices)
   │       ├── INSERT prep_ticket(s) — one per station involved
   │       └── TRANSACTION commits (all or nothing)
   │
   ├── 9. Emit socket event to relevant station room(s)
   └── 10. Return order to waiter
```

**Why a database transaction for steps 8?** If the order inserts but a prep ticket insert fails, we'd have an order with no ticket — it would never reach the kitchen. The transaction guarantees all records are created together or none are.

### Order Number Generation

Inside the transaction, the daily order number is generated safely:

```typescript
// Within the same transaction that creates the order
const todayCount = await tx.order.count({
  where: {
    organizationId,
    orderDate: today,
  }
})
const dailyNumber = todayCount + 1
```

The transaction lock prevents two concurrent order submissions from receiving the same number.

### Order Modification Flow

When a waiter modifies an order while it is still Pending:

```
PATCH /api/v1/orders/:id/items
        ↓
1. Verify order exists and belongs to waiter's branch
2. Verify at least one prep ticket for the affected station is still PENDING
3. DATABASE TRANSACTION:
   ├── Delete existing order items for the modified station
   ├── Insert new order items with updated quantities/prices
   ├── Recalculate and update order subtotal and total
   └── Regenerate the JSON items snapshot on the affected PrepTicket
4. Emit order:modified socket event to the affected station room
5. Return updated order
```

---

## 15. Background Jobs

All long-running or scheduled operations run as BullMQ jobs — never inside request handlers.

| Job | Trigger | Action |
|---|---|---|
| `shift.reminder` | Nightly scheduler (9pm) | Queues FCM push notifications for all staff with shifts the next day |
| `report.daily` | Nightly scheduler (11pm) | Pre-computes and caches the daily sales summary for fast dashboard load |

### BullMQ Setup

```typescript
// config/queues.ts
import { Queue } from 'bullmq'
import { redis } from './redis'

export const notificationQueue = new Queue('notifications', { connection: redis })
export const reportQueue = new Queue('reports', { connection: redis })
```

---

## 16. Caching Strategy

Redis is used to cache data that is read frequently but changes rarely. Every cache entry has an explicit TTL (time to live) and a defined invalidation trigger.

| Cache Key | Data | TTL | Invalidated When |
|---|---|---|---|
| `menu:{organizationId}` | Full menu with availability for a branch | 1 hour | Manager marks item available/unavailable |
| `branch:{organizationId}` | Branch details including coordinates | 24 hours | System Admin updates branch |
| `delivery_zones:{organizationId}` | Delivery zones and fees for a branch | 1 hour | Manager adds/edits/removes a zone |
| `shift_today:{organizationId}` | Today's shift assignments for a branch | Until midnight | Manager updates schedule |

### Cache-Aside Pattern

Read from cache first. On miss, read from database, write to cache, return result.

```typescript
// Example: menu cache
async getMenu(organizationId: string) {
  const cacheKey = `menu:${organizationId}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  const menu = await menuRepository.getWithAvailability(organizationId)
  await redis.setex(cacheKey, 3600, JSON.stringify(menu))
  return menu
}
```

---

## 17. Security Architecture

### Input Security
- All request bodies validated with Zod before reaching the service layer
- SQL injection impossible — Prisma uses parameterized queries exclusively
- No raw SQL unless Prisma cannot handle the query; must be documented with a comment

### Data Security
- Passwords hashed with bcrypt, minimum 12 rounds
- Access tokens stored in memory only (not localStorage)
- Refresh tokens in HTTP-only, Secure, SameSite=Strict cookies
- `organizationId` in all business queries always sourced from the verified JWT, never from request input
- Sensitive fields (passwordHash, tokens) never returned in API responses — enforced by selecting specific fields in all user queries

### Transport Security
- HTTPS enforced end-to-end (Vercel + Cloudflare tunnel + TLS)
- WebSocket connections over WSS (TLS)

### Rate Limiting
- Auth endpoints (login, refresh) rate limited to 10 requests per minute per IP
- General API rate limit: 200 requests per minute per authenticated user

---

## 18. Offline Resilience Strategy

### Detection

The frontend monitors two signals simultaneously:
- `navigator.onLine` browser API
- WebSocket connection status (connected/disconnected)

Either signal going offline triggers the offline state.

### Behaviour When Offline

| Interface | Offline Behaviour |
|---|---|
| Waiter app | Shows offline banner. Order submission disabled with clear message. Already-loaded menu still browsable. |
| KDS / BDS | Already-loaded tickets remain visible and interactive. New tickets cannot arrive. Offline banner shown. |
| Manager dashboard | Read-only data remains visible. Write actions disabled. |

### Reconnection and Sync

When connectivity is restored:
1. WebSocket reconnects automatically (Socket.io handles this)
2. Frontend detects reconnection event
3. Frontend calls a sync endpoint — `GET /api/v1/sync` — which returns the full current state for that client's role
4. Zustand store is updated with the fresh state
5. UI reflects the current server state
6. Offline banner is dismissed

---

## 19. Performance Considerations

### Expected Load

At launch (2 branches): approximately 20–30 concurrent users during peak hours. At 10 branches: 100–150 concurrent users. The system is designed to handle 500 concurrent users before needing horizontal scaling.

### Database Performance

- All foreign keys indexed (defined in Data Model)
- The two most frequent queries — active orders per branch and pending prep tickets per station — have dedicated composite indexes
- Pagination enforced on all list queries — no unbounded database reads
- N+1 queries eliminated by using Prisma's `include` for related data
- Slow query logging enabled (queries over 200ms logged as warnings)

### API Performance

- Menu data cached in Redis — the most frequently read, least frequently changed data
- Daily report pre-computed nightly — manager dashboard load is a cache read, not a complex aggregation query
- Response compression enabled (gzip) on the Express server

### Frontend Performance

- Next.js serves static assets from Vercel's global CDN
- Route-based code splitting — the waiter doesn't download the manager dashboard code
- Optimistic UI updates — the waiter's cart clears immediately on submission without waiting for server confirmation, then corrects itself if the server returns an error

---

## 20. Deployment Architecture

### Infrastructure Overview

```
Clients (phones/tablets/browsers)
  -> Vercel (Next.js frontend, global CDN)
  -> Cloudflare named tunnel (api.wendo-rms.co.ke, TLS, DDoS edge)
  -> DigitalOcean Droplet (Docker Compose)
       - nginx reverse proxy (80 -> 4000)
       - wendo-api (Express + Socket.io)
       - wendo-worker (BullMQ workers)
       - wendo-postgres (PostgreSQL)
       - wendo-redis (Redis)
  -> External services: Firebase FCM, Cloudinary, UptimeRobot
```

### Environments

| Environment | Purpose | Deployment Trigger |
|---|---|---|
| `development` | Local developer machines | Manual |
| `production` | Live system | Push to `main` (GitHub Actions deploy workflow) |

Note: A dedicated staging environment is not currently provisioned.

### Migration Strategy

- Never manually edit production database
- All schema changes via Prisma migrations
- Run only `npx prisma migrate deploy` on production (never `migrate dev`)
- Production deploy workflow runs migrations before rebuilding/restarting application containers
- Validate migrations locally (or on a temporary mirror) before merging to `main`

### Environment Variables

All secrets are environment variables. Production uses:
- server env file: `backend/.env`
- compose root env file: `.env` (for `POSTGRES_PASSWORD`)
- frontend env in Vercel dashboard

Required variables (core):
```
NODE_ENV
PORT
API_PREFIX
FRONTEND_ORIGIN
DATABASE_URL
REDIS_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
FIREBASE_SERVICE_ACCOUNT_JSON
VAPID_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SOCKET_URL
```

---

## 21. Observability

### Logging

Structured JSON logging using **Pino** (fast, low-overhead Node.js logger). Every log entry includes: timestamp, level, request ID, user ID, organization ID, and the message.

```typescript
// Every request gets a unique requestId for tracing
logger.info({
  requestId,
  userId: req.user?.id,
  organizationId: req.user?.organizationId,
  method: req.method,
  path: req.path,
  duration: Date.now() - startTime,
}, 'Request completed')
```

### Log Levels

| Level | Used For |
|---|---|
| `error` | Unexpected failures, uncaught exceptions |
| `warn` | Slow queries (>200ms), failed geofence attempts, rate limit hits |
| `info` | All API requests, successful auth events, order lifecycle events |
| `debug` | Detailed flow tracing — development only, off in production |

### Audit Trail

Sensitive operations are logged to a dedicated audit log:
- Staff account creation and deactivation
- Manager clock-in overrides (who overrode, for whom, reason)
- Menu item availability changes (who changed what, when)
- Payment recording (who marked which order as paid)

### Error Tracking

Unhandled errors and exceptions are captured and surfaced for review. The global error handler logs all 500-level errors with full stack traces.

### Health Check Endpoint

```
GET /health
→ { status: "ok", db: "connected", redis: "connected", uptime: 3600 }
```

Used by deployment automation and uptime monitoring to verify service health after deploys and during runtime.

---

## 22. Architecture Decision Records

### ADR-001 — Single Unified Application Over Multiple Apps

**Date:** 2026-02-22  
**Status:** Accepted

**Context:** The system serves 6 distinct roles across mobile phones and tablets, each needing a different interface.

**Decision:** Build one Next.js application with role-based routing rather than separate applications per role or interface type.

**Consequences:** One codebase to deploy, maintain, and update. Shared components across interfaces. Simpler onboarding for new developers. Trade-off: a single deployment failure affects all interfaces simultaneously — mitigated by Vercel's high availability.

---

### ADR-002 — WebSockets for Real-Time, REST for Actions

**Date:** 2026-02-22  
**Status:** Accepted

**Context:** The KDS must display new orders within 2 seconds of submission. The waiter must be notified when their order is ready.

**Decision:** Use WebSockets (Socket.io) for all real-time event broadcasting. Use REST for all state-changing actions (creating orders, claiming tickets, marking ready). Never use WebSockets to perform mutations.

**Consequences:** Clean separation between actions and reactions. REST provides reliable, idempotent operations with standard error handling. WebSockets provide instant broadcast. Trade-off: two connection types to manage — mitigated by Socket.io's abstraction.

---

### ADR-003 — PrepTicket as Independent Routing Entity

**Date:** 2026-02-22  
**Status:** Accepted

**Context:** An order can involve two independent preparation workflows (Kitchen and Barista) happening simultaneously, each with their own claimant and lifecycle.

**Decision:** Create a `PrepTicket` record per prep station involved in each order. Each ticket tracks its own status independently. The `Order` presents a unified view to the waiter.

**Consequences:** Clean modelling of parallel workflows. Independent prep time metrics per station. KDS/BDS queries are simple and fast. Trade-off: order status must be derived from ticket statuses — managed by explicit status updates in the service layer when tickets change.

---

### ADR-004 — Price Snapshotting on OrderItem

**Date:** 2026-02-22  
**Status:** Accepted

**Context:** Menu prices may change over time. Historical orders must always reflect the price at the time of ordering.

**Decision:** Copy `unitPrice` from `MenuItem.price` into `OrderItem.unitPrice` at the moment the order is created. OrderItem prices are immutable.

**Consequences:** Historical financial records are always accurate regardless of future price changes. Reports are trustworthy. Trade-off: price changes do not retroactively affect existing orders — this is the desired behaviour.

---

### ADR-005 — Server-Side Geofence Validation

**Date:** 2026-02-22  
**Status:** Accepted

**Context:** Staff clock-in must be validated as occurring within 50m of the branch. If validated only on the client, a staff member could spoof their GPS coordinates.

**Decision:** GPS coordinates are sent from the device to the server. The server performs the Haversine distance calculation against the stored branch coordinates. The client is untrusted for this check.

**Consequences:** Geofencing cannot be bypassed by manipulating the client. Trade-off: an extra network round-trip on clock-in — acceptable given this is not a time-critical operation.

---

## 23. Open Questions

| # | Question | Impact |
|---|---|---|
| OQ-01 | Grubba API documentation — when available, a delivery tracking integration should be designed for V2 | Order lifecycle for delivery |
| OQ-02 | What happens if the backend is unreachable during a peak service period? Should there be a fallback mechanism for order submission? | Reliability |
| OQ-03 | As branches expand, should each branch get its own backend instance, or does the single multi-tenant backend scale sufficiently? | Scalability |
| OQ-04 | Should manager override for clock-in require approval from the director, or is the manager's action sufficient? | Audit process |

---

*This document is the authoritative technical reference for the Wendo RMS V1. All development must conform to the architecture defined here. Deviations require an ADR entry and a document update before implementation.*


