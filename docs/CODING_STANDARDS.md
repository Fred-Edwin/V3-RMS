# Coding Standards
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 1.0
**Status:** Draft
**Date:** 2026-02-22
**Author:** System Architect

---

## Table of Contents

1. [Purpose & Non-Negotiables](#1-purpose--non-negotiables)
2. [TypeScript Standards](#2-typescript-standards)
3. [Naming Conventions](#3-naming-conventions)
4. [Backend: Project Structure Rules](#4-backend-project-structure-rules)
5. [Backend: Controller Standards](#5-backend-controller-standards)
6. [Backend: Service Layer Standards](#6-backend-service-layer-standards)
7. [Backend: Repository Layer Standards](#7-backend-repository-layer-standards)
8. [Backend: Validation with Zod](#8-backend-validation-with-zod)
9. [Backend: Error Handling Standards](#9-backend-error-handling-standards)
10. [Backend: Prisma & Database Standards](#10-backend-prisma--database-standards)
11. [Backend: WebSocket Standards](#11-backend-websocket-standards)
12. [Backend: Testing Standards](#12-backend-testing-standards)
13. [Frontend: Project Structure Rules](#13-frontend-project-structure-rules)
14. [Frontend: Component Standards](#14-frontend-component-standards)
15. [Frontend: State Management Standards](#15-frontend-state-management-standards)
16. [Frontend: API Service Standards](#16-frontend-api-service-standards)
17. [Frontend: Styling Standards](#17-frontend-styling-standards)
18. [Git & Version Control](#18-git--version-control)
19. [Code Review Checklist](#19-code-review-checklist)

---

## 1. Purpose & Non-Negotiables

These standards exist for one reason: to make the codebase predictable. When every file is structured the same way, every developer — including an AI agent working from a spec — can find anything in seconds, understand it in seconds, and modify it safely.

Predictability is not bureaucracy. It is the foundation of a system that can be maintained, extended, and debugged under pressure.

### The Non-Negotiables

These rules are never broken. There are no exceptions, no "just this once", no "we can clean it up later."

1. **TypeScript strict mode is always on.** No `any` types. If you do not know the type, figure it out.
2. **Every API route is authenticated and role-checked.** No unprotected routes in production.
3. **Every query includes `organizationId`.** No exceptions. This is the multi-tenancy boundary.
4. **Business logic lives in the service layer only.** Never in controllers, never in repositories.
5. **Database queries live in the repository layer only.** Never in services, never in controllers.
6. **Every endpoint has a Zod schema.** Input is validated before it reaches the service.
7. **Passwords are never logged, returned in responses, or stored in plain text.**
8. **A feature without tests is not considered complete.**

---

## 2. TypeScript Standards

### Strict Mode

`tsconfig.json` always has `strict: true`. This enables all strict checks including `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and more.

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### No `any`

Never use `any`. If TypeScript cannot infer the type, define it explicitly. If you are working with genuinely unknown external data (like a webhook payload), use `unknown` and narrow it with a type guard before use.

```typescript
// ❌ Never
function processPayload(data: any) { ... }

// ✅ Always
function processPayload(data: unknown) {
  const validated = WebhookPayloadSchema.parse(data)
  // now validated is properly typed
}
```

### Type vs Interface

- Use `interface` for object shapes that describe entities or component props — they are extendable and show clearer error messages.
- Use `type` for unions, intersections, mapped types, and utility types.

```typescript
// ✅ Interface for entity shapes
interface User {
  id: string
  name: string
  role: UserRole
  organizationId: string | null
}

// ✅ Type for unions and computed types
type UserRole = 'SYSTEM_ADMIN' | 'DIRECTOR' | 'MANAGER' | 'WAITER' | 'CHEF' | 'BARISTA'
type CreateUserDto = Omit<User, 'id'>
```

### Enums

Use string literal union types instead of TypeScript `enum`. Enums compile to objects and have edge cases. Union types are simpler, serialise correctly, and work better with Prisma.

```typescript
// ❌ Avoid TypeScript enum
enum OrderStatus { PENDING, IN_PROGRESS }

// ✅ Use string literal union
type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'CLOSED' | 'CANCELLED'
type PrepStation = 'KITCHEN' | 'BARISTA'
type OrderType = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY'
```

### Return Types

Always explicitly annotate the return type of functions in service and repository layers. This makes the contract clear and catches errors at the function boundary.

```typescript
// ❌ Implicit return type
async function getOrder(id: string) {
  return prisma.order.findUnique({ where: { id } })
}

// ✅ Explicit return type
async function getOrder(id: string): Promise<Order | null> {
  return prisma.order.findUnique({ where: { id } })
}
```

### Nullability

Never use `!` (non-null assertion) to bypass nullability. Always handle the null case explicitly.

```typescript
// ❌ Non-null assertion — hides bugs
const name = user!.name

// ✅ Explicit null check
if (!user) throw new NotFoundError('User not found')
const name = user.name
```

---

## 3. Naming Conventions

Consistency in names means you can predict a file's path, a function's name, and a variable's meaning without reading the code around it.

### Files and Folders

```
kebab-case          for all files and folders
                    orderService.ts ✅     OrderService.ts ❌
                    prep-tickets/   ✅     PrepTickets/    ❌

[resource]Service.ts          — service files
[resource]Repository.ts       — repository files
[resource]Controller.ts       — controller files
[resource]Router.ts           — route definition files
[resource]Schema.ts           — Zod validation schemas
[resource]Types.ts            — TypeScript types and interfaces

// Frontend
[ComponentName].tsx           — React components (PascalCase)
use[HookName].ts              — custom hooks (camelCase, use prefix)
[storeName]Store.ts           — Zustand stores
```

### Variables and Functions

```typescript
camelCase           for variables, function names, method names
PascalCase          for classes, interfaces, types, React components
SCREAMING_SNAKE     for true constants that never change

// ✅ Examples
const organizationId = req.user.organizationId
async function createOrder(data: CreateOrderDto): Promise<Order>
const MAX_RETRY_ATTEMPTS = 3
class AuthenticationError extends AppError {}
interface CreateOrderDto { ... }
const OrderCard: React.FC<OrderCardProps> = ({ ... }) => { ... }
```

### Functions Should Read Like Sentences

Name functions by what they do, not by how they do it. A reader should understand the intent without reading the body.

```typescript
// ❌ Describes implementation
async function dbQueryOrders(branchId: string) { ... }
async function checkIfUserCanModify(orderId: string) { ... }

// ✅ Describes intent
async function getActiveOrdersByBranch(organizationId: string) { ... }
async function assertOrderIsModifiable(orderId: string, userId: string) { ... }
```

### Boolean Variables

Boolean variables and functions that return booleans are named with `is`, `has`, `can`, or `should` prefixes.

```typescript
const isActive: boolean
const hasOpenOrders: boolean
function canModifyOrder(order: Order): boolean
function isWithinGeofence(distance: number): boolean
```

### Event Handlers (Frontend)

Event handler functions are prefixed with `handle`.

```typescript
const handleSubmitOrder = async () => { ... }
const handleClaimTicket = (ticketId: string) => { ... }
const handlePaymentMethodChange = (method: PaymentMethod) => { ... }
```

---

## 4. Backend: Project Structure Rules

The folder structure defines the architecture. Violating the structure violates the architecture.

```
backend/src/
  config/           — one file per external connection (db, redis, firebase, socket)
  controllers/      — one file per resource (orderController.ts)
  services/         — one file per resource (orderService.ts)
  repositories/     — one file per resource (orderRepository.ts)
  middleware/       — authenticate.ts, rbac.ts, errorHandler.ts, requestLogger.ts
  routes/           — one file per resource (orderRoutes.ts), index.ts aggregates all
  sockets/          — socketHandlers.ts, roomManager.ts
  jobs/             — one file per job (shiftReminderJob.ts, reportJob.ts)
  validators/       — one Zod schema file per resource (orderSchemas.ts)
  utils/            — pure utility functions (haversine.ts, dateHelpers.ts)
  types/            — shared TypeScript types (auth.types.ts, order.types.ts)
  app.ts            — Express app setup (no business logic)
  server.ts         — HTTP server entry point (starts app, attaches Socket.io)
```

**Rules:**
- One controller, one service, one repository per resource. Never split a resource across multiple files of the same type.
- `app.ts` only sets up middleware and routes. No business logic ever appears here.
- `config/` files only establish connections and export clients. No logic.
- Nothing in `utils/` has side effects or calls external services. Pure functions only.

---

## 5. Backend: Controller Standards

Controllers are thin. They do exactly three things and nothing more:

1. Validate the request input using the Zod schema
2. Call the appropriate service method
3. Return the response

**No business logic in controllers.** If you find yourself writing an `if` statement that decides what to do based on data — that logic belongs in the service.

### Controller Template

```typescript
// controllers/orderController.ts
import { Request, Response } from 'express'
import { CreateOrderSchema, UpdateOrderItemsSchema } from '../validators/orderSchemas'
import { orderService } from '../services/orderService'
import { successResponse } from '../utils/response'

// Every controller function follows this exact pattern:
// 1. Parse/validate input with Zod (throws ValidationError on failure)
// 2. Call service with validated data and auth context
// 3. Return success response

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const data = CreateOrderSchema.parse(req.body)
  const order = await orderService.create(data, req.user)
  res.status(201).json(successResponse(order, 'Order created successfully'))
}

export const getActiveOrders = async (req: Request, res: Response): Promise<void> => {
  const orders = await orderService.getActive(req.user.organizationId)
  res.status(200).json(successResponse(orders))
}

export const updateOrderItems = async (req: Request, res: Response): Promise<void> => {
  const data = UpdateOrderItemsSchema.parse(req.body)
  const order = await orderService.updateItems(req.params.id, data, req.user)
  res.status(200).json(successResponse(order, 'Order updated successfully'))
}
```

### What Controllers Must Never Do

```typescript
// ❌ Never — business logic in controller
export const createOrder = async (req: Request, res: Response) => {
  // Controllers do not calculate prices
  const total = req.body.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Controllers do not query the database
  const branch = await prisma.organization.findUnique({ where: { id: req.user.organizationId } })

  // Controllers do not make decisions based on data
  if (branch.isHub) {
    // different logic for hub branches
  }
}

// ❌ Never — try/catch in controllers
// Errors propagate to the global error handler automatically
export const createOrder = async (req: Request, res: Response) => {
  try {
    const order = await orderService.create(req.body, req.user)
    res.json({ success: true, data: order })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}
```

Controllers never have try/catch. All errors propagate to the global error handler middleware, which formats and sends the error response. This means error formatting is consistent across the entire API without duplication.

### Route Definitions

Routes are defined in resource-specific router files, never inline in `app.ts`.

```typescript
// routes/orderRoutes.ts
import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { requireRole } from '../middleware/rbac'
import * as orderController from '../controllers/orderController'

const router = Router()

// The middleware chain on each route is the access control policy.
// It is read left to right: authenticate → check role → run handler
router.get('/', authenticate, requireRole('WAITER', 'MANAGER', 'DIRECTOR'), orderController.getOrders)
router.get('/active', authenticate, requireRole('WAITER', 'MANAGER'), orderController.getActiveOrders)
router.post('/', authenticate, requireRole('WAITER'), orderController.createOrder)
router.patch('/:id/items', authenticate, requireRole('WAITER'), orderController.updateOrderItems)
router.patch('/:id/payment', authenticate, requireRole('WAITER'), orderController.recordPayment)
router.patch('/:id/cancel', authenticate, requireRole('WAITER', 'MANAGER'), orderController.cancelOrder)

export default router
```

---

## 6. Backend: Service Layer Standards

Services are where every business decision is made. If the system has a rule — a rule about who can do what, when something is allowed, how a value is calculated — that rule lives in a service.

### Service Structure

Services are plain objects exporting async functions. No classes.

```typescript
// services/orderService.ts
import { orderRepository } from '../repositories/orderRepository'
import { menuService } from './menuService'
import { prepTicketService } from './prepTicketService'
import { socketService } from './socketService'
import { calculateOrderTotals } from '../utils/pricing'
import { NotFoundError, ConflictError } from '../utils/errors'
import type { CreateOrderDto, AuthUser, Order } from '../types'

export const orderService = {

  create: async (data: CreateOrderDto, actor: AuthUser): Promise<Order> => {
    // 1. Validate business rules (not input shape — Zod handles that)
    await menuService.assertItemsAvailableAtBranch(data.items, actor.organizationId)

    // 2. Snapshot prices and calculate totals
    const itemsWithPrices = await menuService.snapshotPrices(data.items)
    const totals = calculateOrderTotals(itemsWithPrices, data.deliveryFee ?? 0)

    // 3. Persist — delegate to repository
    const order = await orderRepository.createWithItemsAndTickets({
      ...data,
      ...totals,
      organizationId: actor.organizationId,
      createdById: actor.id,
    })

    // 4. Side effects after successful persistence
    socketService.emitNewOrder(actor.organizationId, order.prepTickets)

    return order
  },

  getActive: async (organizationId: string): Promise<Order[]> => {
    return orderRepository.findActive(organizationId)
  },

  updateItems: async (orderId: string, data: UpdateOrderItemsDto, actor: AuthUser): Promise<Order> => {
    // Assert the order belongs to the actor's branch
    const order = await orderRepository.findByIdAndOrg(orderId, actor.organizationId)
    if (!order) throw new NotFoundError('Order not found')

    // Assert modification is still allowed
    const allTicketsBeyondPending = order.prepTickets.every(t => t.status !== 'PENDING')
    if (allTicketsBeyondPending) {
      throw new ConflictError('Order cannot be modified. Preparation has already started at all stations.')
    }

    const itemsWithPrices = await menuService.snapshotPrices(data.items)
    const totals = calculateOrderTotals(itemsWithPrices, order.deliveryFee)

    const updatedOrder = await orderRepository.updateItems(orderId, itemsWithPrices, totals)

    socketService.emitOrderModified(actor.organizationId, updatedOrder)

    return updatedOrder
  },
}
```

### Service Rules

**Services only call repositories and other services.** Never Prisma directly. Never `req` or `res`.

**Services never format HTTP responses.** They return data or throw errors.

**Services assert business rules by throwing typed errors.** The global error handler converts these to the correct HTTP status codes.

**Side effects (socket events, push notifications, job queuing) happen after successful database writes.** Never before. An event must not be emitted about a state change that has not yet been committed.

**One service per resource.** `orderService` handles orders. If it needs menu data, it calls `menuService` — it does not import `menuRepository` directly.

---

## 7. Backend: Repository Layer Standards

Repositories contain Prisma queries and nothing else. Every query is a named function with a clear, descriptive name. No anonymous inline queries scattered around the codebase.

### Repository Template

```typescript
// repositories/orderRepository.ts
import { prisma } from '../config/database'
import type { Order, Prisma } from '@prisma/client'
import type { CreateOrderWithItemsDto } from '../types'

export const orderRepository = {

  // Every read query scoped to organizationId — always
  findActive: async (organizationId: string): Promise<Order[]> => {
    return prisma.order.findMany({
      where: {
        organizationId,           // ← always present
        status: { not: 'CLOSED' },
        deletedAt: null,
      },
      include: {
        items: true,
        prepTickets: {
          include: { claimedBy: { select: { id: true, name: true } } },
        },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  },

  findByIdAndOrg: async (id: string, organizationId: string): Promise<Order | null> => {
    return prisma.order.findFirst({
      where: { id, organizationId, deletedAt: null },  // findFirst with org check, not findUnique
      include: { items: true, prepTickets: true },
    })
  },

  // Transactions are wrapped at the repository level for multi-step writes
  createWithItemsAndTickets: async (data: CreateOrderWithItemsDto): Promise<Order> => {
    return prisma.$transaction(async (tx) => {
      // Step 1: Generate daily order number safely within the transaction
      const todayCount = await tx.order.count({
        where: {
          organizationId: data.organizationId,
          orderDate: data.orderDate,
        },
      })
      const dailyNumber = todayCount + 1

      // Step 2: Create the order
      const order = await tx.order.create({
        data: {
          ...data,
          dailyNumber,
          items: { create: data.items },
        },
        include: { items: true },
      })

      // Step 3: Create prep tickets
      const tickets = await tx.prepTicket.createMany({ data: data.prepTickets })

      return prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, prepTickets: true },
      })
    })
  },
}
```

### Repository Rules

**Every query that reads business data includes `organizationId` in the `where` clause.** No exceptions. This is the multi-tenancy boundary — it prevents one branch from ever reading another branch's data.

**Use `findFirst` with both `id` and `organizationId` instead of `findUnique` with only `id`** when fetching a single record by ID in a branch-scoped context. This prevents a user from a different branch fetching records by guessing IDs.

```typescript
// ❌ Does not enforce branch ownership
prisma.order.findUnique({ where: { id } })

// ✅ Enforces branch ownership
prisma.order.findFirst({ where: { id, organizationId } })
```

**Transactions wrap all multi-step writes.** If two or more tables must be written together atomically (like creating an Order, its OrderItems, and its PrepTickets), they are always inside `prisma.$transaction()`.

**Never put business logic in repositories.** A repository function may only decide *how* to query — not *whether* to query or *what to do* with the result.

**Select only the fields needed.** For user queries, always use `select` to exclude `passwordHash`.

```typescript
// ❌ Returns passwordHash to caller
prisma.user.findUnique({ where: { id } })

// ✅ Explicitly selects safe fields
prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true, role: true, organizationId: true },
})
```

---

## 8. Backend: Validation with Zod

Every endpoint that accepts a request body has a corresponding Zod schema. Schemas live in `validators/[resource]Schemas.ts`.

### Schema Patterns

```typescript
// validators/orderSchemas.ts
import { z } from 'zod'

// Base item schema — reused across create and update
const OrderItemSchema = z.object({
  menuItemId: z.string().uuid('Menu item ID must be a valid UUID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  notes: z.string().max(500).nullable().optional(),
})

// Discriminated union for order type — enforces conditional required fields
export const CreateOrderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('DINE_IN'),
    tableNumber: z.string().min(1, 'Table number is required for dine-in orders'),
    notes: z.string().max(1000).optional(),
    items: z.array(OrderItemSchema).min(1, 'Order must contain at least one item'),
  }),
  z.object({
    type: z.literal('TAKE_AWAY'),
    notes: z.string().max(1000).optional(),
    items: z.array(OrderItemSchema).min(1, 'Order must contain at least one item'),
  }),
  z.object({
    type: z.literal('DELIVERY'),
    deliveryZoneId: z.string().uuid('Delivery zone ID must be a valid UUID'),
    notes: z.string().max(1000).optional(),
    items: z.array(OrderItemSchema).min(1, 'Order must contain at least one item'),
  }),
])

export const UpdateOrderItemsSchema = z.object({
  items: z.array(OrderItemSchema).min(1, 'Updated order must contain at least one item'),
})

export const RecordPaymentSchema = z.object({
  paymentMethod: z.enum(['MPESA', 'CASH', 'CARD']),
})

// Infer types from schemas — single source of truth
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>
export type UpdateOrderItemsDto = z.infer<typeof UpdateOrderItemsSchema>
```

### Validation Rules

**Schemas are the source of truth for DTO types.** Use `z.infer<typeof Schema>` to derive TypeScript types from schemas — never define the type separately and risk it diverging from the schema.

**Error messages are human-readable.** Every `.min()`, `.max()`, `.uuid()` etc. includes a clear message that can be shown to the user.

**Use `z.discriminatedUnion` for types with conditional required fields** (like order type — DINE_IN requires `tableNumber`, DELIVERY requires `deliveryZoneId`). This is cleaner and safer than optional fields with manual runtime checks.

**Schemas export both the schema and the inferred type.** The controller uses the schema. The service uses the type.

---

## 9. Backend: Error Handling Standards

### Custom Error Classes

All application errors extend `AppError`. These live in `utils/errors.ts`.

```typescript
// utils/errors.ts

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}
```

### Global Error Handler

One middleware catches all errors. It lives in `middleware/errorHandler.ts`.

```typescript
// middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors'
import { logger } from '../config/logger'

export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Always log the error with request context
  logger.error({
    err,
    requestId: req.id,
    userId: req.user?.id,
    organizationId: req.user?.organizationId,
    method: req.method,
    path: req.path,
  }, 'Request error')

  // Zod validation errors — from schema.parse() in controllers
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      },
    })
    return
  }

  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    })
    return
  }

  // Unknown errors — never expose internals
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  })
}
```

### Throwing Errors in Services

```typescript
// ✅ Services throw typed errors — the handler converts them to HTTP responses
async function claimPrepTicket(ticketId: string, actor: AuthUser): Promise<PrepTicket> {
  const ticket = await prepTicketRepository.findByIdAndOrg(ticketId, actor.organizationId)

  if (!ticket) throw new NotFoundError('Prep ticket not found')
  if (ticket.status !== 'PENDING') throw new ConflictError('This order has already been claimed')

  return prepTicketRepository.claim(ticketId, actor.id)
}
```

**Never throw generic `Error`.** Always throw a typed `AppError` subclass so the handler knows the correct HTTP status.

**Never catch errors in services to re-throw them as generic errors.** Let them propagate naturally to the global handler.

---

## 10. Backend: Prisma & Database Standards

### Query Patterns

**Always use `select` on user queries** to prevent `passwordHash` from leaking.

**Use `findFirst` with `organizationId` for branch-scoped single-record lookups** — not `findUnique` with just `id`.

**Use `$transaction` for any operation that writes to more than one table.**

**Never use raw SQL** unless Prisma's query API genuinely cannot express the query. If raw SQL is necessary, it must have a comment explaining why.

```typescript
// ❌ Raw SQL without justification
const orders = await prisma.$queryRaw`SELECT * FROM orders WHERE ...`

// ✅ If raw SQL is unavoidable — comment is mandatory
// Raw SQL required here because Prisma does not support window functions
// needed for the daily order number generation with row locking
const result = await prisma.$queryRaw`
  SELECT COUNT(*) as count
  FROM orders
  WHERE organization_id = ${organizationId}
    AND order_date = ${today}
  FOR UPDATE
`
```

### Decimal Handling

All monetary values are stored as `Decimal` in PostgreSQL via Prisma. When returning them to the client, always convert to string to preserve precision. Never convert to `Number` — JavaScript floats lose precision.

```typescript
// ❌ Loses precision
const total = Number(order.total)

// ✅ Preserves precision
const total = order.total.toString()

// In API responses, Prisma Decimal fields automatically serialise to strings
// when passed through JSON.stringify — verify this in your Prisma version
```

### Migration Rules

- Never edit the database directly on staging or production — all schema changes go through migrations
- Migration files are named descriptively: `20260222_add_delivery_zones`, not `migration_1`
- Run `npx prisma migrate deploy` on production — never `migrate dev`
- Always test migrations on staging before applying to production
- Every migration must be reversible — include a rollback plan in a comment at the top of the migration file

### Soft Deletes

Business data is never hard-deleted. Use the `deletedAt` timestamp pattern.

```typescript
// ❌ Hard delete — data is gone forever
await prisma.menuItem.delete({ where: { id } })

// ✅ Soft delete — data is preserved, just hidden
await prisma.menuItem.update({
  where: { id },
  data: { deletedAt: new Date() },
})

// All find queries for soft-deletable models must filter out deleted records
where: { id, organizationId, deletedAt: null }
```

---

## 11. Backend: WebSocket Standards

### Event Naming

WebSocket events use the format `resource:action` — always lowercase, always separated by a colon.

```
order:new               — new order created, sent to station room
order:claimed           — ticket claimed, sent to waiter's user room
order:ready             — ticket ready, sent to waiter's user room
order:all_ready         — all tickets ready, sent to waiter's user room
order:modified          — order items changed, sent to affected station room
order:cancelled         — order cancelled, sent to station rooms
ticket:status_changed   — generic status update, sent to branch room
```

### Emit After Commit

Socket events are always emitted **after** the database transaction commits successfully — never inside the transaction, never before.

```typescript
// ✅ Emit after successful db write
const order = await orderRepository.createWithItemsAndTickets(data)  // db commit
socketService.emitNewOrder(organizationId, order.prepTickets)         // then emit

// ❌ Never emit inside the transaction
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ ... })
  socketService.emitNewOrder(...)  // BAD — tx may still roll back
})
```

### Socket Service

All socket emit calls go through `socketService` — never call `io.to().emit()` directly from a service.

```typescript
// sockets/socketService.ts
import { io } from '../config/socket'

export const socketService = {
  emitNewOrder: (organizationId: string, tickets: PrepTicket[]): void => {
    tickets.forEach(ticket => {
      const room = `branch:${organizationId}:${ticket.station.toLowerCase()}`
      io.to(room).emit('order:new', ticket)
    })
  },

  emitOrderClaimed: (organizationId: string, waiterId: string, payload: OrderClaimedPayload): void => {
    io.to(`user:${waiterId}`).emit('order:claimed', payload)
  },

  emitOrderReady: (organizationId: string, waiterId: string, payload: OrderReadyPayload): void => {
    io.to(`user:${waiterId}`).emit('order:ready', payload)
  },
}
```

---

## 12. Backend: Testing Standards

### Integration Test Structure

```typescript
// controllers/orderController.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../app'
import { prisma } from '../config/database'
import { createTestUser, createTestBranch, createTestMenuItem, generateTestToken } from '../test/helpers'

describe('POST /api/v1/orders', () => {
  let waiterToken: string
  let organizationId: string
  let menuItemId: string

  // Set up fresh test data before each test
  // Each test is independent — never rely on state from another test
  beforeEach(async () => {
    const branch = await createTestBranch()
    const waiter = await createTestUser({ role: 'WAITER', organizationId: branch.id })
    const menuItem = await createTestMenuItem({ organizationId: branch.id, price: '350.00' })

    organizationId = branch.id
    menuItemId = menuItem.id
    waiterToken = generateTestToken(waiter)
  })

  it('creates a dine-in order with items and prep tickets', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        type: 'DINE_IN',
        tableNumber: '4',
        items: [{ menuItemId, quantity: 2, notes: null }],
      })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.dailyNumber).toBe(1)
    expect(response.body.data.status).toBe('PENDING')
    expect(response.body.data.prepTickets).toHaveLength(1) // one ticket (BARISTA for drinks)

    // Verify database state
    const order = await prisma.order.findUnique({
      where: { id: response.body.data.id },
      include: { items: true, prepTickets: true },
    })
    expect(order).not.toBeNull()
    expect(order!.items).toHaveLength(1)
    expect(order!.items[0]!.unitPrice.toString()).toBe('350.00') // price snapshotted
  })

  it('returns 400 when items array is empty', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ type: 'DINE_IN', tableNumber: '4', items: [] })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when called by a chef', async () => {
    const chef = await createTestUser({ role: 'CHEF', organizationId })
    const chefToken = generateTestToken(chef)

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${chefToken}`)
      .send({ type: 'DINE_IN', tableNumber: '4', items: [{ menuItemId, quantity: 1 }] })

    expect(response.status).toBe(403)
  })
})
```

### Testing Rules

**Each test is fully independent.** Tests set up their own data in `beforeEach` and never rely on state created by another test. Tests can be run in any order and still pass.

**Test database is separate from development database.** Use a `.env.test` file with a different `DATABASE_URL`. The test database is reset between test runs.

**Test helpers live in `test/helpers.ts`.** Functions like `createTestUser`, `createTestBranch`, and `generateTestToken` are shared utilities — never repeated inline in each test file.

**Describe blocks group related tests for the same endpoint.** Within a describe block, each `it` tests one specific behaviour — one success case or one specific failure case. No test does double duty.

**Assert both the response and the database state** for write operations. A 201 response is not enough — verify the record was actually created correctly in the database.

**Test names read like specifications.** `'creates a dine-in order with items and prep tickets'` and `'returns 400 when items array is empty'` tell you what the system does — not how it is implemented.

### Unit Test Structure

```typescript
// utils/haversine.test.ts
import { describe, it, expect } from 'vitest'
import { getDistanceMetres } from './haversine'

describe('getDistanceMetres', () => {
  it('returns 0 when both points are identical', () => {
    expect(getDistanceMetres(-0.4167, 36.9500, -0.4167, 36.9500)).toBe(0)
  })

  it('returns approximately 111km for 1 degree of latitude difference', () => {
    const distance = getDistanceMetres(0, 0, 1, 0)
    expect(distance).toBeCloseTo(111_195, -2)  // within 100m
  })

  it('returns distance within geofence threshold for nearby points', () => {
    // Wendo Kingz coordinates with a point 30 metres north
    const distance = getDistanceMetres(-0.4167, 36.9500, -0.41643, 36.9500)
    expect(distance).toBeLessThan(50)  // within 50m geofence
  })

  it('returns distance beyond geofence for a point 200 metres away', () => {
    const distance = getDistanceMetres(-0.4167, 36.9500, -0.4149, 36.9500)
    expect(distance).toBeGreaterThan(50)
  })
})
```

---

## 13. Frontend: Project Structure Rules

```
frontend/
  app/                          — Next.js App Router pages
    (auth)/
      login/
        page.tsx
    app/
      layout.tsx                — shared layout for authenticated routes
      dashboard/
        page.tsx                — waiter dashboard
      orders/
        page.tsx                — create order
        history/
          page.tsx              — order history
      kitchen/
        page.tsx                — KDS
      barista/
        page.tsx                — BDS
      manager/
        page.tsx                — manager dashboard
        staff/page.tsx
        menu/page.tsx
        shifts/page.tsx
        attendance/page.tsx
        orders/page.tsx
        delivery-zones/page.tsx
        reports/page.tsx
      director/
        page.tsx
        reports/page.tsx
      admin/
        page.tsx
        branches/page.tsx
        menu/page.tsx
        users/page.tsx
      profile/
        page.tsx                — all roles
      shifts/
        page.tsx                — staff shift view
      clock/
        page.tsx                — clock in/out
      performance/
        page.tsx                — personal performance (waiter, chef, barista)
      design/
        page.tsx                — component preview (dev only, not deployed)

  components/
    ui/                         — base components (Button, Input, Modal, etc.)
    orders/                     — order-specific components
    kitchen/                    — KDS/BDS components
    menu/                       — menu components
    staff/                      — staff and shift components
    dashboard/                  — dashboard-specific components

  hooks/                        — custom React hooks
  services/                     — API call functions
  store/                        — Zustand stores
  lib/                          — utilities (socket.ts, apiClient.ts, cn.ts)
  types/                        — TypeScript types shared across the frontend
  middleware.ts                 — Next.js route protection middleware
```

**Rules:**
- Pages live in `app/`. They are thin — they import components and pass data. No JSX logic in pages beyond layout composition.
- Components live in `components/`. The sub-folder reflects the domain, not the page. A component used on two different pages lives in the right domain folder, not duplicated.
- Custom hooks that fetch data or manage state live in `hooks/`. They are the bridge between components and services/stores.
- API calls live in `services/`. Components never call `fetch` directly.

---

## 14. Frontend: Component Standards

### Component Template

```typescript
// components/orders/OrderCard.tsx
import { Clock, ChefHat, Coffee } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { Order } from '@/types'

// Props interface — always defined above the component
interface OrderCardProps {
  order: Order
  onTap?: (order: Order) => void
  className?: string
}

// Named export — never default export for components
// Default exports make refactoring and tree-shaking harder
export const OrderCard = ({ order, onTap, className }: OrderCardProps) => {
  const statusBorderColour = {
    PENDING: 'border-l-[#F0D080]',
    IN_PROGRESS: 'border-l-[#F5B87A]',
    READY: 'border-l-[#86EFAC]',
    CLOSED: 'border-l-stone-300',
    CANCELLED: 'border-l-[#F5A898]',
  }[order.status]

  return (
    <div
      className={cn(
        'bg-white rounded-md shadow-sm border border-stone-200 border-l-4 p-4',
        'cursor-pointer transition-shadow duration-fast hover:shadow-md',
        statusBorderColour,
        className,
      )}
      onClick={() => onTap?.(order)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onTap?.(order)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-sans text-heading-sm text-espresso font-semibold">
          #{order.dailyNumber}
        </span>
        <Badge status={order.status} />
      </div>

      <div className="text-body-sm text-stone-700">
        {order.items.slice(0, 2).map(item => (
          <span key={item.id}>{item.quantity}× {item.name}</span>
        ))}
        {order.items.length > 2 && (
          <span className="text-stone-500"> +{order.items.length - 2} more</span>
        )}
      </div>
    </div>
  )
}
```

### Component Rules

**Named exports only.** `export const OrderCard` — never `export default`. Named exports make it clear what is being imported and enable better tooling support.

**One component per file.** If a file has two components, one of them belongs in its own file.

**Props interface is defined directly above the component.** Not in a separate types file — keep props and component together.

**Components are pure presentational where possible.** Pass data in through props. Data fetching and business state live in hooks and stores, not inside components.

**Use `cn()` utility for conditional class names.** Never string concatenation.

```typescript
// utils/cn.ts — standard implementation
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
className={cn('base-class', isActive && 'active-class', className)}
```

**All interactive elements are keyboard accessible.** If it has an `onClick`, it also has `onKeyDown` handling for Enter/Space, and a `tabIndex` and `role` if it is not a native interactive element.

**Images always have `alt` text.** Empty string `alt=""` for decorative images. Descriptive alt for meaningful images.

---

## 15. Frontend: State Management Standards

### Zustand Store Structure

```typescript
// store/orderStore.ts
import { create } from 'zustand'
import type { Order, CartItem } from '@/types'

// Define the full store shape as an interface
interface OrderStore {
  // State
  activeOrders: Order[]
  cart: CartItem[]
  isLoading: boolean

  // Actions — grouped after state
  setActiveOrders: (orders: Order[]) => void
  addOrderRealTime: (order: Order) => void
  updateOrderStatusRealTime: (orderId: string, updates: Partial<Order>) => void
  addToCart: (item: CartItem) => void
  removeFromCart: (menuItemId: string) => void
  updateCartQuantity: (menuItemId: string, quantity: number) => void
  clearCart: () => void
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  // Initial state
  activeOrders: [],
  cart: [],
  isLoading: false,

  // Actions
  setActiveOrders: (orders) => set({ activeOrders: orders }),

  addOrderRealTime: (order) =>
    set(state => ({ activeOrders: [order, ...state.activeOrders] })),

  updateOrderStatusRealTime: (orderId, updates) =>
    set(state => ({
      activeOrders: state.activeOrders.map(o =>
        o.id === orderId ? { ...o, ...updates } : o,
      ),
    })),

  addToCart: (item) =>
    set(state => {
      const existing = state.cart.find(c => c.menuItemId === item.menuItemId)
      if (existing) {
        return {
          cart: state.cart.map(c =>
            c.menuItemId === item.menuItemId
              ? { ...c, quantity: c.quantity + 1 }
              : c,
          ),
        }
      }
      return { cart: [...state.cart, item] }
    }),

  removeFromCart: (menuItemId) =>
    set(state => ({ cart: state.cart.filter(c => c.menuItemId !== menuItemId) })),

  updateCartQuantity: (menuItemId, quantity) =>
    set(state => ({
      cart: quantity === 0
        ? state.cart.filter(c => c.menuItemId !== menuItemId)
        : state.cart.map(c => c.menuItemId === menuItemId ? { ...c, quantity } : c),
    })),

  clearCart: () => set({ cart: [] }),
}))
```

### Store Rules

**One store per domain.** `useOrderStore` for orders, `useAuthStore` for auth, `useKitchenStore` for kitchen state. Never one giant store.

**Stores hold client-side state only.** Data fetched from the API is loaded into the store via hook calls, not directly inside the store.

**Real-time WebSocket updates are applied through store actions.** The socket listener calls a store action — it never mutates the DOM directly.

```typescript
// hooks/useOrderRealTime.ts — connects WebSocket events to store actions
export function useOrderRealTime() {
  const addOrder = useOrderStore(s => s.addOrderRealTime)
  const updateOrder = useOrderStore(s => s.updateOrderStatusRealTime)

  useEffect(() => {
    socket.on('order:new', addOrder)
    socket.on('order:all_ready', (payload) => updateOrder(payload.orderId, { status: 'READY' }))

    return () => {
      socket.off('order:new', addOrder)
      socket.off('order:all_ready')
    }
  }, [addOrder, updateOrder])
}
```

---

## 16. Frontend: API Service Standards

All API calls go through typed service functions. Components never call `fetch` directly.

### API Client

```typescript
// lib/apiClient.ts
import { useAuthStore } from '@/store/authStore'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = useAuthStore.getState().accessToken

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const data = await response.json()

  if (!response.ok) {
    // Throw a structured error the UI can handle
    throw new ApiError(data.error?.message ?? 'Request failed', response.status, data.error?.code)
  }

  return data.data as T
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
```

### Service Functions

```typescript
// services/orderService.ts
import { apiClient } from '@/lib/apiClient'
import type { Order, CreateOrderDto } from '@/types'

export const orderService = {
  create: (data: CreateOrderDto) =>
    apiClient.post<Order>('/orders', data),

  getActive: () =>
    apiClient.get<Order[]>('/orders/active'),

  getById: (id: string) =>
    apiClient.get<Order>(`/orders/${id}`),

  updateItems: (id: string, data: UpdateOrderItemsDto) =>
    apiClient.patch<Order>(`/orders/${id}/items`, data),

  recordPayment: (id: string, paymentMethod: PaymentMethod) =>
    apiClient.patch<Order>(`/orders/${id}/payment`, { paymentMethod }),

  cancel: (id: string, reason: string) =>
    apiClient.patch<Order>(`/orders/${id}/cancel`, { reason }),
}
```

### Data Fetching with Custom Hooks

Data fetching happens in custom hooks — never directly inside components.

```typescript
// hooks/useActiveOrders.ts
import { useEffect, useState } from 'react'
import { orderService } from '@/services/orderService'
import { useOrderStore } from '@/store/orderStore'

export function useActiveOrders() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setActiveOrders = useOrderStore(s => s.setActiveOrders)

  useEffect(() => {
    orderService.getActive()
      .then(orders => {
        setActiveOrders(orders)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setIsLoading(false)
      })
  }, [setActiveOrders])

  const activeOrders = useOrderStore(s => s.activeOrders)
  return { activeOrders, isLoading, error }
}
```

---

## 17. Frontend: Styling Standards

### Use the Design System — Always

Every colour, font size, spacing value, shadow, and border radius used in the UI must come from the Tailwind configuration defined in `DESIGN_SYSTEM.md` Section 13. No arbitrary values without a documented reason.

```typescript
// ❌ Arbitrary values — never
<div className="text-[13px] bg-[#2C1810] p-[18px]">

// ✅ Design system tokens — always
<div className="text-label-md bg-espresso p-4">
```

### Class Organisation

Order Tailwind classes consistently within each element:

```
1. Layout (display, position, flex/grid)
2. Sizing (width, height, min/max)
3. Spacing (margin, padding)
4. Typography (font, text)
5. Colours (bg, text, border colour)
6. Border (border, rounded)
7. Effects (shadow, opacity)
8. Transitions and animations
9. Responsive modifiers (sm:, md:, lg:)
10. State modifiers (hover:, focus:, disabled:)
```

### No Inline Styles

Never use `style={{ }}` in JSX. If the design requires something Tailwind cannot express, add it to the global CSS file with a comment explaining why.

```typescript
// ❌
<div style={{ backgroundColor: '#2C1810', padding: '16px' }}>

// ✅
<div className="bg-espresso p-4">
```

### Mobile-First

All styles are written mobile-first. Start with the mobile layout. Add responsive modifiers for tablet and desktop.

```typescript
// ✅ Mobile-first: single column → two columns on desktop
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

// ❌ Desktop-first (requires overrides for mobile)
<div className="grid grid-cols-2 max-lg:grid-cols-1 gap-6">
```

---

## 18. Git & Version Control

### Branch Strategy

```
main          — production. Only receives merges from staging after verification.
staging       — staging environment. Features merge here for testing before main.
feature/*     — individual feature branches. Branch from staging, merge back to staging.
fix/*         — bug fix branches.
```

### Branch Naming

```
feature/phase-2-auth-login
feature/phase-4-order-creation
feature/phase-4-kds-display
fix/order-number-duplicate
fix/geofence-calculation
```

### Commit Messages

Follow Conventional Commits format: `type(scope): description`

```
feat(orders): add order creation endpoint with prep ticket routing
feat(kds): add real-time claim and ready flow
fix(geofence): correct haversine calculation for southern hemisphere
test(orders): add integration tests for order creation
refactor(auth): extract token refresh logic into utility
chore(deps): update prisma to 5.10.0
```

**Types:** `feat`, `fix`, `test`, `refactor`, `chore`, `docs`, `style`

**Rules:**
- Commits are atomic — one logical change per commit
- The description is imperative mood: "add order creation" not "added order creation"
- Never commit directly to `staging` or `main`
- Never commit: `.env` files, `node_modules`, build artifacts

### Pull Request Rules

- Every PR has a description explaining what changed and why
- Every PR passes all automated tests before merge
- Every PR is reviewed against the Code Review Checklist below
- Squash-merge feature branches into staging — keeps history clean
- Merge staging into main only after manual verification on the staging environment

---

## 19. Code Review Checklist

Before any PR is merged, it must be reviewed against this checklist. Every item is checked — not skimmed.

### Architecture
- [ ] Business logic is in the service layer only — not in controllers or repositories
- [ ] Database queries are in the repository layer only — no Prisma calls in services or controllers
- [ ] The layered call chain is respected: controller → service → repository

### Security
- [ ] Every new route has `authenticate` middleware
- [ ] Every new route has `requireRole` middleware with the correct roles
- [ ] Every repository query that reads business data includes `organizationId` in the where clause
- [ ] No sensitive data (passwords, tokens) is returned in any API response
- [ ] No sensitive data is logged

### TypeScript
- [ ] No `any` types
- [ ] No non-null assertions (`!`)
- [ ] Return types are explicitly annotated on service and repository functions
- [ ] Props interfaces are defined for all new React components

### Validation
- [ ] Every new endpoint with a request body has a Zod schema
- [ ] Zod schema is parsed in the controller before the service is called
- [ ] DTO types are inferred from the Zod schema — not defined separately

### Error Handling
- [ ] Services throw typed `AppError` subclasses — not generic `Error`
- [ ] No try/catch in controllers
- [ ] No unhandled promise rejections (all async functions are awaited or have `.catch`)

### Database
- [ ] Multi-step writes use `prisma.$transaction`
- [ ] Soft-deletable resources filter `deletedAt: null` in all find queries
- [ ] User queries use `select` to exclude `passwordHash`
- [ ] No raw SQL without a comment explaining why it is necessary

### WebSocket
- [ ] Socket events are emitted after the database transaction commits — never inside it
- [ ] All socket emits go through `socketService` — not `io.to().emit()` directly

### Frontend
- [ ] No arbitrary Tailwind values — all tokens from the design system
- [ ] No inline `style={{ }}` attributes
- [ ] All interactive elements are keyboard accessible
- [ ] No `fetch` calls directly in components — all calls go through service functions
- [ ] No business logic inside components — only in hooks and stores

### Testing
- [ ] Every new API endpoint has at least one integration test (success case)
- [ ] Every new API endpoint has integration tests for relevant failure cases (wrong role, missing fields, conflict)
- [ ] Every new complex business logic function has unit tests
- [ ] Test names read as specifications — they describe the expected behaviour
- [ ] Tests are independent — no shared mutable state between tests

### Design System (Frontend PRs)
- [ ] UI conforms to DESIGN_SYSTEM.md — correct colours, typography, spacing, shadows
- [ ] Component handles all states: loading, empty, error, and success
- [ ] Offline states are handled where the component makes network requests

---

*These standards are the engineering contract for the Wendo RMS codebase. They are not suggestions — they are the agreed way this system is built. Every developer, and every AI agent generating code for this project, works within these boundaries.*
