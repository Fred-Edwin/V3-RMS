# Technical Design Document
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 2.0  
**Status:** Live — Phase 8 Complete  
**Date:** 2026-05-04  
**Author:** System Architect  
**Changelog:** v2.0 — added Phase 7 (Credit Account auth flow, AWAITING_AUTHORIZATION pattern, Accountant role architecture), Phase 8 (Other Income, Discount authorization flows, HR Module, Internal Communications real-time design, BullMQ job expansion, Staff Transfers); added ADR-006 through ADR-010; updated background jobs table; updated open questions.

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
22. [Credit Account Authorization Architecture](#22-credit-account-authorization-architecture)
23. [Discount Authorization Architecture](#23-discount-authorization-architecture)
24. [HR Module Architecture](#24-hr-module-architecture)
25. [Internal Communications Architecture](#25-internal-communications-architecture)
26. [Architecture Decision Records](#26-architecture-decision-records)
27. [Open Questions](#27-open-questions)

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
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        CLIENTS                                   â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚Waiter Phone â”‚  â”‚ KDS Tablet  â”‚  â”‚  Manager / Director   â”‚   â”‚
â”‚  â”‚(mobile web) â”‚  â”‚(tablet web) â”‚  â”‚    (web dashboard)    â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚         â”‚                â”‚                      â”‚               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
          â”‚                â”‚                      â”‚
          â”‚         HTTPS + WSS (TLS)              â”‚
          â”‚                â”‚                      â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     BACKEND (DigitalOcean)                             â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚                    Express API Server                     â”‚   â”‚
â”‚  â”‚                                                          â”‚   â”‚
â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚   â”‚
â”‚  â”‚  â”‚  Routes &  â”‚  â”‚  Service   â”‚  â”‚   Repository       â”‚ â”‚   â”‚
â”‚  â”‚  â”‚Controllers â”‚→ â”‚   Layer    â”‚→ â”‚   Layer (Prisma)   â”‚ â”‚   â”‚
â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚   â”‚
â”‚  â”‚                                                          â”‚   â”‚
â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚   â”‚
â”‚  â”‚  â”‚ Middleware â”‚  â”‚  Socket.io â”‚  â”‚   BullMQ Jobs      â”‚ â”‚   â”‚
â”‚  â”‚  â”‚(Auth/RBAC) â”‚  â”‚  Server   â”‚  â”‚  (Background)      â”‚ â”‚   â”‚
â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                       â”‚                  â”‚
          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”
          â”‚  PostgreSQL    â”‚    â”‚   Redis         â”‚
          â”‚  (PostgreSQL)    â”‚    â”‚   (Redis)     â”‚
          â”‚                â”‚    â”‚                 â”‚
          â”‚  - All data    â”‚    â”‚  - Session cacheâ”‚
          â”‚  - Migrations  â”‚    â”‚  - Menu cache   â”‚
          â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚  - Job queues   â”‚
                                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                        â”‚
                               â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”
                               â”‚  Firebase (FCM) â”‚
                               â”‚  Push Notifs    â”‚
                               â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Layered Architecture (Per Request)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚     Client (Next.js)        â”‚  Presentation — renders UI, calls API
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  API Layer (Express Routes) â”‚  Validates input (Zod), delegates to service
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚     Service Layer           â”‚  All business logic lives here
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Repository Layer (Prisma)  â”‚  All database queries live here
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚   Database (PostgreSQL)     â”‚  Data storage only
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
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
â”‚
â”œâ”€â”€ frontend/                        # Next.js application
â”‚   â”œâ”€â”€ app/                         # App Router pages
â”‚   â”‚   â”œâ”€â”€ (auth)/                  # Login, password reset
â”‚   â”‚   â”œâ”€â”€ app/                     # Authenticated app routes
â”‚   â”‚   â”‚   â”œâ”€â”€ orders/              # Waiter order interface
â”‚   â”‚   â”‚   â”œâ”€â”€ kitchen/             # KDS interface
â”‚   â”‚   â”‚   â”œâ”€â”€ barista/             # BDS interface
â”‚   â”‚   â”‚   â”œâ”€â”€ dashboard/           # Manager dashboard
â”‚   â”‚   â”‚   â””â”€â”€ director/            # Director dashboard
â”‚   â”‚   â””â”€â”€ layout.tsx
â”‚   â”œâ”€â”€ components/                  # Reusable UI components
â”‚   â”‚   â”œâ”€â”€ ui/                      # Base components (buttons, modals, cards)
â”‚   â”‚   â”œâ”€â”€ orders/                  # Order-specific components
â”‚   â”‚   â”œâ”€â”€ kitchen/                 # KDS-specific components
â”‚   â”‚   â””â”€â”€ dashboard/               # Dashboard components
â”‚   â”œâ”€â”€ hooks/                       # Custom React hooks
â”‚   â”œâ”€â”€ services/                    # API call functions (fetch wrappers)
â”‚   â”œâ”€â”€ store/                       # Zustand stores
â”‚   â”œâ”€â”€ lib/                         # Utilities, socket client setup
â”‚   â””â”€â”€ types/                       # TypeScript type definitions
â”‚
â”œâ”€â”€ backend/                         # Express application
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ config/                  # DB, Redis, Firebase, Socket setup
â”‚   â”‚   â”œâ”€â”€ controllers/             # Route handlers (thin — validate + delegate)
â”‚   â”‚   â”œâ”€â”€ services/                # Business logic
â”‚   â”‚   â”œâ”€â”€ repositories/            # Prisma queries
â”‚   â”‚   â”œâ”€â”€ middleware/              # Auth, RBAC, error handler, logger
â”‚   â”‚   â”œâ”€â”€ routes/                  # Express route definitions
â”‚   â”‚   â”œâ”€â”€ sockets/                 # Socket.io event handlers
â”‚   â”‚   â”œâ”€â”€ jobs/                    # BullMQ job definitions and processors
â”‚   â”‚   â”œâ”€â”€ validators/              # Zod schemas for all request validation
â”‚   â”‚   â”œâ”€â”€ utils/                   # Shared helpers (haversine, etc.)
â”‚   â”‚   â””â”€â”€ types/                   # TypeScript interfaces and types
â”‚   â””â”€â”€ prisma/
â”‚       â”œâ”€â”€ schema.prisma
â”‚       â””â”€â”€ migrations/
â”‚
â””â”€â”€ shared/                          # Types shared between frontend and backend
    â””â”€â”€ types/
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
                        â†“
Server creates order    → emits order:new to kitchen room  (WebSocket)
                        â†“
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
        â†“
Express catches it → passes to globalErrorHandler middleware
        â†“
globalErrorHandler formats standard error response envelope
        â†“
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
7. If distance â‰¤ configured radius (default 50 metres) → clock-in approved, record saved with method: GPS
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
  const Ï†1 = (lat1 * Math.PI) / 180
  const Ï†2 = (lat2 * Math.PI) / 180
  const Î”Ï† = ((lat2 - lat1) * Math.PI) / 180
  const Î”Î» = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Î”Ï† / 2) ** 2 +
    Math.cos(Ï†1) * Math.cos(Ï†2) * Math.sin(Î”Î» / 2) ** 2

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
        â†“
1. Zod validates request shape
2. Auth middleware verifies JWT
3. RBAC middleware confirms role = WAITER
4. orderService.create() begins:
   â”‚
   â”œâ”€â”€ 5. Validate all menu items exist and are available at this branch
   â”œâ”€â”€ 6. Snapshot current prices for all items
   â”œâ”€â”€ 7. Calculate subtotal, delivery fee, total
   â”‚
   â”œâ”€â”€ 8. DATABASE TRANSACTION begins
   â”‚       â”œâ”€â”€ Generate daily order number (count today's orders + 1)
   â”‚       â”œâ”€â”€ INSERT order record
   â”‚       â”œâ”€â”€ INSERT order_items records (with snapshotted prices)
   â”‚       â”œâ”€â”€ INSERT prep_ticket(s) — one per station involved
   â”‚       â””â”€â”€ TRANSACTION commits (all or nothing)
   â”‚
   â”œâ”€â”€ 9. Emit socket event to relevant station room(s)
   â””â”€â”€ 10. Return order to waiter
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

When a waiter modifies an order before it is closed/cancelled:

```
PATCH /api/v1/orders/:id/items
        ↓
1. Verify order exists and belongs to waiter's branch
2. Reject if order is CLOSED or CANCELLED
3. Station-aware rules:
   - Stations with only PENDING/REJECTED tickets are fully editable
   - Stations with any IN_PROGRESS/READY ticket are add-only (no remove/decrease)
   - Additions for add-only stations generate follow-up prep ticket batches (PENDING)
4. DATABASE TRANSACTION:
   - Replace OrderItems to match the new full order payload
   - Update order subtotal/total
   - Update JSON items snapshot on editable station tickets
   - Insert new PrepTicket rows for follow-up batches
   - If order was READY and new tickets were created, revert order status to IN_PROGRESS
5. Emit socket events:
   - order:modified → stations whose editable ticket snapshot changed
   - order:new      → stations receiving new follow-up ticket batches
6. Return updated order
```
---

## 15. Background Jobs

All long-running or scheduled operations run as BullMQ jobs — never inside request handlers.

| Job | Trigger | Action |
|---|---|---|
| `shift.reminder` | Nightly scheduler (9pm) | Queues FCM push notifications for all staff with shifts the next day |
| `report.daily` | Nightly scheduler (11pm) | Pre-computes and caches the daily sales summary for fast dashboard load |
| `print.expire` | Scheduled (hourly) | Marks PrintJob records older than 24h as EXPIRED |
| `formal_notice.reminder_24h` | Enqueued on FormalNotice creation | Sends FCM push to recipients who have not acknowledged after 24 hours |
| `formal_notice.reminder_48h` | Enqueued on FormalNotice creation | Sends FCM push to recipients who have not acknowledged after 48 hours |

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

Unhandled errors are captured by **Sentry** (`@sentry/node`), initialized in `backend/src/config/sentry.ts` and activated via the `SENTRY_DSN` environment variable. The global error handler (`middleware/error-handler.ts`) calls `Sentry.captureException()` for every 500-level response. 4xx errors (validation, not found, forbidden) are not sent to Sentry — they are expected application states, not bugs.

Sentry is opt-in: if `SENTRY_DSN` is not set, initialization is a no-op and nothing is captured. This means local development and CI are unaffected.

Known Prisma error codes are mapped to typed domain errors before reaching the global handler:
- `P2002` (unique constraint) → `ConflictError` (409)
- `P2025` (record not found during update) → `NotFoundError` (404) via global handler
- `P2003` (foreign key violation) → `ValidationError` (400)
- `P2000` (value too long) → `ValidationError` (400)

Use `mapPrismaError()` from `utils/prisma-errors.ts` in service catch blocks where a simple domain error re-throw is sufficient. For catch blocks with custom logic (returning existing records, counting skips), handle inline.

### Health Check Endpoint

```
GET /health
→ { status: "ok", db: "connected", redis: "connected", uptime: 3600 }
```

Used by deployment automation and uptime monitoring to verify service health after deploys and during runtime.

---

## 22. Credit Account Authorization Architecture *(Added Phase 7)*

### The AWAITING_AUTHORIZATION Pattern

When a waiter selects a payment method that requires management approval (House Account, Staff Discount, or approval-required Customer Discount), the order enters `AWAITING_AUTHORIZATION` status instead of closing immediately.

```
Waiter selects House Account / Staff Discount / Approval-Required Discount
        ↓
Order status → AWAITING_AUTHORIZATION
Socket event → auth:pending (broadcast to MANAGER + DIRECTOR rooms for the branch)
        ↓
Manager or Director sees pending authorization in their dashboard
        ↓
  [APPROVE]                          [REJECT]
     ↓                                  ↓
Increment credit balance        Order status → PENDING (returned to waiter)
Order status → CLOSED           Incident record created (PAYMENT_REJECTED)
Socket event: auth:approved     Socket event: auth:rejected → waiter
```

**Why not just let managers mark orders as paid?**  
The authorization model keeps the waiter in control of the order while giving management the approval step. The waiter does not need to find a manager physically — the approval happens asynchronously from the manager's dashboard.

### Credit Account Balance Model

Credit accounts are **additive ledgers** — each approved credit order increments the outstanding balance. Settlements decrement it. The current balance is always `SUM(credit orders) - SUM(settlements)` as stored in the denormalized `outstandingBalance` field (kept consistent via `prisma.$transaction`).

```typescript
// Atomic balance update on approval — order of ops matters
await prisma.$transaction([
  prisma.creditAccount.update({ where: { id }, data: { outstandingBalance: { increment: amount } } }),
  prisma.order.update({ where: { id: orderId }, data: { status: 'CLOSED' } }),
])
```

### Corporate vs Branch-Scoped Accounts

`CorporateAccount` records have no `organizationId` — they are system-level. This reflects the real-world scenario: a company like a law firm may have staff at multiple branches charging to the same account. `HouseAccount` and `CustomerCreditAccount` are branch-scoped (include `organizationId`) because benefits and credit tabs are managed per branch.

---

## 23. Discount Authorization Architecture *(Added Phase 8)*

### Two Discount Paths

| Discount Type | Trigger | Authorization Required | Record Table |
|---|---|---|---|
| Named Customer Discount | Waiter selects a Discount record | Optional (per-discount `requiresApproval` flag) | `CustomerDiscountAuthRequest` |
| Staff Discount | Waiter marks order as staff discount + selects beneficiary | Always | `StaffDiscountAuthRequest` |

### Disambiguation in Queries

A closed order may have had a discount applied. To determine which type:
- `order.discountId IS NOT NULL` → named customer discount applied
- `order.discountedById IS NOT NULL` → staff discount applied  
- Both fields null → no discount on this order

The discount amount itself is stored on the order (`discountAmount`, `discountedTotal`) at the time of authorization to snapshot the calculation.

### Authorization Tables

Separate `StaffDiscountAuthRequest` and `CustomerDiscountAuthRequest` tables are used rather than a polymorphic `AuthRequest` table. This avoids nullable polymorphic fields, keeps type-safe queries, and makes each auth flow independently queryable for reporting.

---

## 24. HR Module Architecture *(Added Phase 8)*

### EmployeeProfile — 1:1 Extension Pattern

`EmployeeProfile` is a 1:1 optional extension of `User`. The split keeps the `User` table focused on auth/session data (accessed on every request) while `EmployeeProfile` holds HR-only fields accessed rarely and only by HR-role users.

```
User (auth, role, branch) ←──── EmployeeProfile (contract, bank, emergency contacts)
          1                               0..1
```

### Leave Day Calculation — Working Days Only

Leave duration is always calculated in **working days (Monday–Friday)**. The calculation iterates each calendar day in the range and skips Saturday and Sunday. Public holidays are not currently tracked (planned future enhancement).

```typescript
function countWorkingDays(start: Date, end: Date): number {
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++ // skip Sun (0) and Sat (6)
    current.setDate(current.getDate() + 1)
  }
  return count
}
```

### Leave Balance Seeding

`LeaveBalance` records are created automatically — one per `LeaveType` per active staff member per calendar year. The seeding job runs annually (or on new staff member creation). HR Manager and Director can manually adjust balances if needed.

### HR Document Storage

HR documents (offer letters, contracts, warning letters) are uploaded to **Cloudinary** in an `hr-documents/` folder and stored as `HrDocument` records linked to the staff member's user ID. Cloudinary handles file hosting; the database stores only the URL and metadata.

---

## 25. Internal Communications Architecture *(Added Phase 8)*

### Three Communication Modes

| Mode | Model | Delivery | Persistence |
|---|---|---|---|
| Direct Message | `DirectConversation` + `DirectMessage` | Real-time WebSocket | Permanent (paginated history) |
| Broadcast | `Broadcast` + `BroadcastRecipient` | Real-time WebSocket + FCM push | Permanent per-recipient delivery status |
| Formal Notice | `FormalNotice` + `FormalNoticeRecipient` | Real-time WebSocket + FCM push + BullMQ reminders | Permanent with acknowledgement tracking |

### Real-Time Delivery

```
Sender sends DM / Broadcast / Formal Notice (REST POST)
        ↓
Service creates DB records
        ↓
Service emits Socket.io event to recipient room(s):
  - DM:        socket.to(`user:${recipientId}`).emit('message:new', payload)
  - Broadcast: socket.to(`org:${orgId}`).emit('broadcast:new', payload)  [scoped to branch/role if needed]
  - Notice:    socket.to(`org:${orgId}`).emit('notice:new', payload)
```

### Formal Notice Escalation (BullMQ)

When a Formal Notice is created, two delayed BullMQ jobs are enqueued immediately:

```typescript
await notificationQueue.add('notice.reminder', { noticeId }, { delay: 24 * 60 * 60 * 1000 })  // 24h
await notificationQueue.add('notice.reminder', { noticeId }, { delay: 48 * 60 * 60 * 1000 })  // 48h
```

When the job fires, the processor queries `FormalNoticeRecipient` records where `acknowledgedAt IS NULL` and sends FCM push notifications to those specific users only. Already-acknowledged recipients receive no reminder.

### Scope Filtering for Broadcasts

Broadcast recipients are determined server-side based on the `scope` field:
- `COMPANY` → all active users in the organization
- `BRANCH` → all active users in a specific branch
- `ROLE_GROUP` → all active users with a specific role in the organization

The recipient list is materialized into `BroadcastRecipient` rows at send time so delivery status is trackable per user.

---

## 26. Architecture Decision Records

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

### ADR-006 — PrepTicket Splitting: One Ticket Per Order-Item Line

**Date:** 2026-03-15  
**Status:** Accepted

**Context:** The original design grouped all items for a station (e.g., all drink items) into a single PrepTicket per order. This made the BDS show only one card per order regardless of how many drink items were in it, with no way to assign individual workload to individual baristas.

**Decision:** Create one PrepTicket per order-item line per station. An order with `Latte x2 + Cappuccino + Fries` produces 3 tickets: two for BARISTA (one per drink line) and one for KITCHEN. The `@@unique([orderId, station, sequence])` constraint with a per-station sequence number supports multiple tickets per station.

**Consequences:** Individual baristas can claim individual tickets. Workload is distributed fairly. Ticket counts are accurate per line. Trade-off: more rows in the PrepTicket table; negligible at scale. `createMany` must assign explicit per-station sequence numbers to avoid unique constraint violations.

---

### ADR-007 — AWAITING_AUTHORIZATION as a First-Class Order Status

**Date:** 2026-03-18  
**Status:** Accepted

**Context:** House account, staff discount, and approval-required customer discount all require manager/director approval before an order is closed. Several implementation approaches were considered: a separate `PendingApproval` table; a boolean flag on `Order`; or a dedicated status value.

**Decision:** Add `AWAITING_AUTHORIZATION` to the `OrderStatus` enum. The order remains in the normal order lifecycle but is held at this status until approved or rejected. No separate approval queue table is needed.

**Consequences:** The existing order status progression handles the hold state natively. Managers see authorization requests in the same dashboard as order monitoring. WebSocket events reuse the existing order room structure. Trade-off: order status progression is no longer strictly linear (an order can go from AWAITING_AUTHORIZATION back to PENDING on rejection) — this is intentional and documented.

---

### ADR-008 — Corporate Account at System Level (No organizationId)

**Date:** 2026-03-18  
**Status:** Accepted

**Context:** Corporate clients (e.g., companies, NGOs) may have staff at multiple Wendo branches all charging to the same account. If a corporate account were branch-scoped, a company would need separate accounts per branch.

**Decision:** `CorporateAccount` records have no `organizationId` — they are system-level entities. Only System Admin and Director can create or view them. The Accountant role can settle them.

**Consequences:** Cross-branch corporate billing works naturally. Outstanding balance is the total across all branches. Trade-off: `CorporateAccount` queries cannot use the standard `organizationId` filter — all queries must explicitly verify caller has Director or SYSTEM_ADMIN role.

---

### ADR-009 — Separate Auth Request Tables for Staff vs Customer Discounts

**Date:** 2026-04-01  
**Status:** Accepted

**Context:** Both staff discounts and customer discounts require authorization, so a polymorphic `DiscountAuthRequest` table was considered.

**Decision:** Separate `StaffDiscountAuthRequest` and `CustomerDiscountAuthRequest` tables with distinct fields for each flow. Staff auth requests include `beneficiaryId` (the staff member receiving the discount); customer discount requests include `discountId` (the named discount scheme applied).

**Consequences:** Type-safe, fully typed Prisma queries for each flow. Independent reporting on each discount type. No nullable polymorphic fields. Trade-off: two tables to query when building the combined auth request dashboard — handled by fetching both and merging in the service layer.

---

### ADR-010 — EmployeeProfile as Optional 1:1 Extension of User

**Date:** 2026-04-10  
**Status:** Accepted

**Context:** HR data (contract dates, bank details, emergency contacts, employment type) could be added directly to the `User` table or kept in a separate table.

**Decision:** `EmployeeProfile` is a separate table with a 1:1 optional relation to `User`. The `User` table stays focused on auth fields accessed on every API request. `EmployeeProfile` is only loaded when the HR module explicitly fetches it.

**Consequences:** Auth middleware stays fast — it never loads HR-specific fields. HR data is only queried by HR-role users. Adding new HR fields never touches the core `User` migration. Trade-off: a join is needed whenever HR profile data is required alongside user data — acceptable given the infrequency of HR queries.

---

## 27. Open Questions

| # | Question | Impact |
|---|---|---|
| OQ-01 | Grubba API documentation — when available, a delivery tracking integration should be designed for V2 | Order lifecycle for delivery |
| OQ-02 | What happens if the backend is unreachable during a peak service period? Should there be a fallback mechanism for order submission? | Reliability |
| OQ-03 | As branches expand, should each branch get its own backend instance, or does the single multi-tenant backend scale sufficiently? | Scalability |
| OQ-04 | Should manager override for clock-in require approval from the director, or is the manager's action sufficient? | Audit process |
| OQ-05 | Public holidays for leave calculation — should the system maintain a Kenya public holiday calendar to exclude those days from leave counts? | HR Module accuracy |
| OQ-06 | Message retention — should DirectMessage history be pruned after a period (e.g., 90 days) to control database growth? | Storage |
| OQ-07 | Payslip Phase 9 — should payslips be stored as structured records (with individual deduction fields) or as uploaded PDF blobs? Structured records allow in-app display and calculation validation; PDFs are simpler for admin entry. | Phase 9 design |

---

*This document is the authoritative technical reference for the Wendo RMS. All development must conform to the architecture defined here. Deviations require an ADR entry and a document update before implementation. Version 2.0 reflects the completed Phase 8 system state.*



