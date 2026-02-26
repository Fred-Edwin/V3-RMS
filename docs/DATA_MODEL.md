# Data Model
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-02-22  
**Stack:** PostgreSQL · Prisma ORM  

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Entity Overview](#2-entity-overview)
3. [Entity Relationship Diagram](#3-entity-relationship-diagram)
4. [Schema Definitions](#4-schema-definitions)
   - [Organization (Branch)](#41-organization-branch)
   - [User](#42-user)
   - [MenuCategory](#43-menucategory)
   - [MenuItem](#44-menuitem)
   - [BranchMenuItem](#45-branchmenuitem)
   - [DeliveryZone](#46-deliveryzone)
   - [Shift](#47-shift)
   - [ShiftAssignment](#48-shiftassignment)
   - [ClockRecord](#49-clockrecord)
   - [Order](#410-order)
   - [OrderItem](#411-orderitem)
   - [PrepTicket](#412-prepticket)
5. [Enums](#5-enums)
6. [Key Design Decisions](#6-key-design-decisions)
7. [Index Strategy](#7-index-strategy)

---

## 1. Design Principles

Every design decision in this schema follows these rules, derived from the Engineering Standards:

**UUIDs everywhere.** All primary keys are UUIDs. This prevents enumeration attacks (a malicious user cannot guess `order/2` because they saw `order/1`) and makes IDs safe to expose in URLs and APIs.

**Multi-tenancy by `organization_id`.** Every table that holds business data carries an `organization_id` foreign key. Every query against business data filters by `organization_id`. This is enforced at the repository layer — not optionally, always. A user at one branch can never see data from another branch.

**Soft deletes for business data.** Orders, menu items, staff records, and other business entities are never permanently deleted. They receive a `deleted_at` timestamp. This preserves history for reporting and prevents accidental data loss.

**Timestamps on every table.** Every table has `created_at` and `updated_at`. No exceptions.

**Money as Decimal, never Float.** All monetary values use `Decimal(10, 2)`. Floating-point arithmetic causes rounding errors in financial calculations. This is non-negotiable.

**Enums for fixed value sets.** Any field with a known, finite set of values is an enum — not a raw string. This enforces data integrity at the database level.

---

## 2. Entity Overview

| Entity | Description |
|---|---|
| `Organization` | A branch of Wendo (e.g., Kingz, Town). The top-level tenant unit. |
| `User` | Any person with a system account — Admin, Director, Manager, Waiter, Chef, Barista. |
| `MenuCategory` | A grouping of menu items (e.g., Hot Drinks, Mains). Determines prep station routing. |
| `MenuItem` | A single item on the master menu (e.g., Chicken Burger, Cappuccino). |
| `BranchMenuItem` | Branch-level override — marks a menu item as unavailable at a specific branch. |
| `DeliveryZone` | A named delivery area and its fee, scoped to a branch. |
| `Shift` | A named time block (e.g., Morning 6am–2pm), defined per branch. |
| `ShiftAssignment` | Assigns a specific staff member to a specific shift on a specific date. |
| `ClockRecord` | Records a staff member's clock-in and clock-out for a given shift. |
| `Order` | A customer order — the top-level entity that holds all items and tracks overall lifecycle. |
| `OrderItem` | A single line item within an order (menu item + quantity + price at time of order). |
| `PrepTicket` | A routed sub-order sent to one prep station (KDS or BDS). Tracks that station's workflow independently. |

---

## 3. Entity Relationship Diagram

```
Organization (Branch)
│
├── User (staff accounts, scoped to branch)
│
├── BranchMenuItem (availability overrides per branch)
│
├── DeliveryZone (delivery areas and fees per branch)
│
├── Shift (shift definitions per branch)
│   └── ShiftAssignment (staff assigned to shift on a date)
│       └── ClockRecord (clock-in/out record per assignment)
│
└── Order (customer orders per branch)
    ├── OrderItem (line items within the order)
    └── PrepTicket (routed to Kitchen or Barista station)
        └── (links back to OrderItems for that station)

MenuCategory (system-level, no branch scope)
└── MenuItem (system-level master menu items)
    └── BranchMenuItem (branch-level availability override)

User
├── Order (waiter who created the order)
├── ShiftAssignment (staff member assigned to shift)
├── ClockRecord (staff member's clock record)
└── PrepTicket (claimed_by — chef or barista who claimed it)
```

---

## 4. Schema Definitions

### 4.1 Organization (Branch)

Represents a single branch of Wendo. This is the **tenant unit** — all branch-scoped data references this table.

```prisma
model Organization {
  id          String   @id @default(uuid())
  name        String                          -- e.g., "Wendo Kingz", "Wendo Town"
  address     String
  city        String
  latitude    Decimal  @db.Decimal(10, 7)     -- GPS coordinates for geofencing
  longitude   Decimal  @db.Decimal(10, 7)
  isHub       Boolean  @default(false)        -- Director designates one branch as hub
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())        @map("created_at")
  updatedAt   DateTime @updatedAt             @map("updated_at")

  -- Relations
  users             User[]
  branchMenuItems   BranchMenuItem[]
  deliveryZones     DeliveryZone[]
  shifts            Shift[]
  orders            Order[]

  @@map("organizations")
}
```

**Notes:**
- `latitude` and `longitude` stored as high-precision Decimal for accurate 50m geofencing calculations.
- `isHub` — only one branch should be hub at a time. Enforced at the application layer (when one is set to hub, others are unset).
- `isActive` — allows a branch to be deactivated without deleting it.

---

### 4.2 User

Every person with a system account. One table for all roles — role determines what they can see and do.

```prisma
model User {
  id             String    @id @default(uuid())
  organizationId String?   @map("organization_id")   -- null for System Admin and Director (not branch-scoped)
  name           String
  email          String    @unique
  phone          String?
  passwordHash   String    @map("password_hash")
  role           UserRole
  isActive       Boolean   @default(true)             @map("is_active")
  createdAt      DateTime  @default(now())            @map("created_at")
  updatedAt      DateTime  @updatedAt                 @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")         -- soft delete

  -- Relations
  organization      Organization?    @relation(fields: [organizationId], references: [id])
  ordersCreated     Order[]          @relation("OrderCreatedBy")
  shiftAssignments  ShiftAssignment[]
  clockRecords      ClockRecord[]
  prepTicketsClaimed PrepTicket[]   @relation("PrepTicketClaimedBy")

  @@index([organizationId])
  @@index([email])
  @@index([role])
  @@map("users")
}
```

**Notes:**
- `organizationId` is nullable — System Admin and Director are not tied to a single branch.
- `email` is the login identifier. Must be unique across the entire system.
- `passwordHash` — bcrypt, minimum 12 rounds. Never stored in plaintext.
- `deletedAt` — soft delete. When a manager deactivates a staff account, `deletedAt` is set and `isActive` is false. The record is preserved for historical reporting (e.g., orders they handled).

---

### 4.3 MenuCategory

System-level menu categories. Each category determines which prep station its items route to.

```prisma
model MenuCategory {
  id           String       @id @default(uuid())
  name         String       @unique             -- e.g., "Hot Drinks", "Mains", "Desserts"
  prepStation  PrepStation                      -- KITCHEN or BARISTA
  displayOrder Int          @default(0)         @map("display_order")  -- controls sort on menu UI
  isActive     Boolean      @default(true)      @map("is_active")
  createdAt    DateTime     @default(now())     @map("created_at")
  updatedAt    DateTime     @updatedAt          @map("updated_at")

  -- Relations
  menuItems    MenuItem[]

  @@index([prepStation])
  @@map("menu_categories")
}
```

**Notes:**
- No `organization_id` — categories are global across the entire system.
- `prepStation` is the routing key — when an order is split, all items whose category has `prepStation = KITCHEN` go to KDS; `prepStation = BARISTA` go to BDS.
- `displayOrder` controls the visual order of categories on the menu interface.

---

### 4.4 MenuItem

Individual items on the master menu. System-level — not scoped to a branch.

```prisma
model MenuItem {
  id          String      @id @default(uuid())
  categoryId  String      @map("category_id")
  name        String
  description String?
  imageUrl    String?     @map("image_url")    -- Cloudinary CDN URL (optional)
  price       Decimal     @db.Decimal(10, 2)   -- always KES, universal pricing
  isActive    Boolean     @default(true)       @map("is_active")  -- master-level active/inactive
  createdAt   DateTime    @default(now())      @map("created_at")
  updatedAt   DateTime    @updatedAt           @map("updated_at")
  deletedAt   DateTime?   @map("deleted_at")  -- soft delete

  -- Relations
  category        MenuCategory     @relation(fields: [categoryId], references: [id])
  branchOverrides BranchMenuItem[]
  orderItems      OrderItem[]

  @@index([categoryId])
  @@index([isActive])
  @@map("menu_items")
}
```

**Notes:**
- `price` is universal — the same price applies at all branches.
- `isActive` at this level means the item exists on the master menu. A branch-level override (`BranchMenuItem`) handles per-branch availability separately.
- `deletedAt` — items are soft-deleted so historical orders that reference them remain intact and reportable.
- `imageUrl` — optional Cloudinary secure URL. Uploaded via `POST /menu/items/upload-image`; stored and served via Cloudinary CDN with auto-format and quality optimization. Items without an image render an `ImageOff` placeholder in the UI.

---

### 4.5 BranchMenuItem

Branch-level availability override. When a branch runs out of an ingredient, the manager marks that item unavailable at their branch. This is a separate table rather than a flag on `MenuItem` because availability is per-branch, while the menu item itself is global.

```prisma
model BranchMenuItem {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  menuItemId     String   @map("menu_item_id")
  isAvailable    Boolean  @default(true)         @map("is_available")
  updatedAt      DateTime @updatedAt              @map("updated_at")
  updatedBy      String   @map("updated_by")      -- userId of the manager who made the change

  -- Relations
  organization  Organization @relation(fields: [organizationId], references: [id])
  menuItem      MenuItem     @relation(fields: [menuItemId], references: [id])

  @@unique([organizationId, menuItemId])   -- one record per branch-item pair
  @@index([organizationId])
  @@index([menuItemId])
  @@map("branch_menu_items")
}
```

**Notes:**
- The `@@unique` constraint on `[organizationId, menuItemId]` ensures there is exactly one availability record per item per branch. No duplicates possible.
- If no `BranchMenuItem` record exists for an item at a branch, the item is assumed available (default-available pattern). Records are only created when a manager marks something unavailable.
- `updatedBy` provides an audit trail — we know which manager toggled availability and when.

---

### 4.6 DeliveryZone

Delivery areas and fees, scoped per branch. Each branch has independent zones since branches serve different surrounding areas.

```prisma
model DeliveryZone {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  name           String                           -- e.g., "Kiganjo", "Karatina"
  fee            Decimal  @db.Decimal(10, 2)      -- delivery fee in KES
  isActive       Boolean  @default(true)          @map("is_active")
  createdAt      DateTime @default(now())         @map("created_at")
  updatedAt      DateTime @updatedAt              @map("updated_at")

  -- Relations
  organization  Organization @relation(fields: [organizationId], references: [id])
  orders        Order[]

  @@index([organizationId])
  @@map("delivery_zones")
}
```

---

### 4.7 Shift

A named time block that defines working hours. Defined per branch since different branches may operate on different schedules.

```prisma
model Shift {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  name           String                          -- e.g., "Morning", "Evening"
  startTime      String   @map("start_time")     -- stored as "HH:MM" e.g., "06:00"
  endTime        String   @map("end_time")        -- stored as "HH:MM" e.g., "14:00"
  isActive       Boolean  @default(true)         @map("is_active")
  createdAt      DateTime @default(now())        @map("created_at")
  updatedAt      DateTime @updatedAt             @map("updated_at")

  -- Relations
  organization  Organization      @relation(fields: [organizationId], references: [id])
  assignments   ShiftAssignment[]

  @@index([organizationId])
  @@map("shifts")
}
```

**Notes:**
- `startTime` and `endTime` stored as `"HH:MM"` strings rather than timestamps. This is because shifts are recurring templates, not one-off calendar events — the actual date comes from `ShiftAssignment.date`.

---

### 4.8 ShiftAssignment

Links a staff member to a shift on a specific date. This is the daily schedule — the manager populates this to assign who works which shift on which day.

```prisma
model ShiftAssignment {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  shiftId        String   @map("shift_id")
  userId         String   @map("user_id")
  date           DateTime @db.Date               -- the calendar date of the assignment
  createdAt      DateTime @default(now())        @map("created_at")
  updatedAt      DateTime @updatedAt             @map("updated_at")

  -- Relations
  organization  Organization @relation(fields: [organizationId], references: [id])
  shift         Shift        @relation(fields: [shiftId], references: [id])
  user          User         @relation(fields: [userId], references: [id])
  clockRecord   ClockRecord?

  @@unique([userId, date, shiftId])   -- a user can only be assigned to a shift once per day
  @@index([organizationId])
  @@index([userId])
  @@index([date])
  @@map("shift_assignments")
}
```

**Notes:**
- `@@unique([userId, date, shiftId])` prevents double-booking the same person to the same shift on the same day.
- `date` uses `@db.Date` — date only, no time component. Time comes from the `Shift` definition.

---

### 4.9 ClockRecord

Records the actual clock-in and clock-out timestamps for a staff member on a given shift assignment. This is the ground truth for attendance and hours worked.

```prisma
model ClockRecord {
  id                 String          @id @default(uuid())
  organizationId     String          @map("organization_id")
  shiftAssignmentId  String          @unique @map("shift_assignment_id")  -- one record per assignment
  userId             String          @map("user_id")
  clockInAt          DateTime?       @map("clock_in_at")
  clockOutAt         DateTime?       @map("clock_out_at")
  clockInMethod      ClockMethod     @map("clock_in_method")    -- GPS or OVERRIDE
  clockOutMethod     ClockMethod?    @map("clock_out_method")
  overrideById       String?         @map("override_by_id")     -- manager who performed override
  overrideNote       String?         @map("override_note")      -- reason for override
  createdAt          DateTime        @default(now())            @map("created_at")
  updatedAt          DateTime        @updatedAt                 @map("updated_at")

  -- Relations
  shiftAssignment  ShiftAssignment @relation(fields: [shiftAssignmentId], references: [id])
  user             User            @relation(fields: [userId], references: [id])

  @@index([organizationId])
  @@index([userId])
  @@index([clockInAt])
  @@map("clock_records")
}
```

**Notes:**
- `clockInAt` and `clockOutAt` are nullable — a record may exist with only clock-in (staff is still on shift).
- `clockInMethod` and `clockOutMethod` distinguish GPS-verified clock actions from manager overrides. This is recorded permanently for audit and compliance.
- `overrideById` and `overrideNote` are required when `clockInMethod = OVERRIDE`.

---

### 4.10 Order

The central entity of the system. Represents a complete customer order from submission to payment.

```prisma
model Order {
  id               String      @id @default(uuid())
  organizationId   String      @map("organization_id")
  dailyNumber      Int         @map("daily_number")       -- e.g., 1, 2, 3... resets daily per branch
  orderDate        DateTime    @db.Date @map("order_date") -- the calendar date (for daily number scoping)
  type             OrderType                               -- DINE_IN, TAKE_AWAY, DELIVERY
  status           OrderStatus @default(PENDING)
  tableNumber      String?     @map("table_number")       -- dine-in only, free text
  notes            String?                                -- customer instructions
  subtotal         Decimal     @db.Decimal(10, 2)         -- sum of all order items
  deliveryFee      Decimal     @default(0) @db.Decimal(10, 2)  @map("delivery_fee")
  total            Decimal     @db.Decimal(10, 2)         -- subtotal + delivery fee
  paymentMethod    PaymentMethod? @map("payment_method")  -- set when waiter records payment
  paidAt           DateTime?   @map("paid_at")            -- when payment was recorded
  deliveryZoneId   String?     @map("delivery_zone_id")   -- delivery orders only
  createdById      String      @map("created_by_id")      -- waiter who created the order
  createdAt        DateTime    @default(now())             @map("created_at")
  updatedAt        DateTime    @updatedAt                  @map("updated_at")
  closedAt         DateTime?   @map("closed_at")           -- when order was marked Closed

  -- Relations
  organization   Organization  @relation(fields: [organizationId], references: [id])
  deliveryZone   DeliveryZone? @relation(fields: [deliveryZoneId], references: [id])
  createdBy      User          @relation("OrderCreatedBy", fields: [createdById], references: [id])
  items          OrderItem[]
  prepTickets    PrepTicket[]

  @@unique([organizationId, dailyNumber, orderDate])  -- ensures order numbers are unique per branch per day
  @@index([organizationId])
  @@index([organizationId, status])
  @@index([organizationId, orderDate])
  @@index([createdById])
  @@map("orders")
}
```

**Notes:**
- `dailyNumber` combined with `orderDate` and `organizationId` provides the human-readable order number (e.g., "Order #7 on 22 Feb at Kingz branch"). The `@@unique` constraint enforces no duplicates.
- `subtotal`, `deliveryFee`, and `total` are denormalised (stored, not calculated on the fly). This is intentional — it creates an immutable financial record. If a menu item's price changes tomorrow, old orders still reflect the price at the time of ordering.
- `status` at this level represents the overall order status, derived from the prep tickets but managed explicitly to avoid complex joins on every read.
- `closedAt` provides a clean timestamp for reporting — "how long from order creation to closure".

---

### 4.11 OrderItem

A single line item within an order. Captures the item, quantity, and price at the moment the order was placed.

```prisma
model OrderItem {
  id           String  @id @default(uuid())
  orderId      String  @map("order_id")
  menuItemId   String  @map("menu_item_id")
  quantity     Int
  unitPrice    Decimal @db.Decimal(10, 2)  @map("unit_price")  -- price at time of order
  subtotal     Decimal @db.Decimal(10, 2)                      -- quantity × unitPrice
  notes        String?                                          -- item-level special instructions

  -- Relations
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  menuItem  MenuItem @relation(fields: [menuItemId], references: [id])

  @@index([orderId])
  @@index([menuItemId])
  @@map("order_items")
}
```

**Notes:**
- `unitPrice` is copied from `MenuItem.price` at the time the order is placed. This is a deliberate snapshot — price history is preserved regardless of future menu changes.
- `onDelete: Cascade` — if an order is deleted (hard delete, only possible in edge cases), its items go with it. In practice, orders are never deleted.
- No `createdAt`/`updatedAt` on this table — `OrderItem` records are immutable once created. Any change (add/remove item) happens by deleting and recreating items while the order is still in Pending status.

---

### 4.12 PrepTicket

This is the routing entity. When an order is submitted, the system creates one `PrepTicket` per prep station involved. If an order has food and drinks, two PrepTickets are created — one for KITCHEN, one for BARISTA. Each ticket tracks its own preparation lifecycle independently.

This is the key to the split-order, unified-view design.

```prisma
model PrepTicket {
  id              String           @id @default(uuid())
  organizationId  String           @map("organization_id")
  orderId         String           @map("order_id")
  station         PrepStation                              -- KITCHEN or BARISTA
  status          PrepTicketStatus @default(PENDING)
  claimedById     String?          @map("claimed_by_id")  -- chef or barista who claimed it
  claimedAt       DateTime?        @map("claimed_at")
  readyAt         DateTime?        @map("ready_at")       -- when marked Ready
  items           Json                                     -- snapshot of items for this station
  createdAt       DateTime         @default(now())        @map("created_at")
  updatedAt       DateTime         @updatedAt             @map("updated_at")

  -- Relations
  organization  Organization @relation(fields: [organizationId], references: [id])
  order         Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  claimedBy     User?        @relation("PrepTicketClaimedBy", fields: [claimedById], references: [id])

  @@unique([orderId, station])   -- one ticket per station per order
  @@index([organizationId])
  @@index([organizationId, station, status])   -- primary KDS/BDS query index
  @@index([claimedById])
  @@map("prep_tickets")
}
```

**Notes:**
- `@@unique([orderId, station])` — an order can have at most one Kitchen ticket and one Barista ticket. Enforced at the database level.
- `items` is stored as `Json` — a snapshot of the items and quantities relevant to that station at the time the ticket was created. This makes the KDS/BDS display query fast (no joins needed to render a ticket card) and preserves the original state even if an order is subsequently modified.
- `claimedAt` and `readyAt` timestamps are the source of truth for **prep time metrics** (reports: average prep time per chef/barista).
- `PrepTicketStatus` is independent from `OrderStatus`. An order can have its food ticket In-Progress while its drinks ticket is still Pending.

---

## 5. Enums

```prisma
enum UserRole {
  SYSTEM_ADMIN
  DIRECTOR
  MANAGER
  WAITER
  CHEF
  BARISTA
}

enum PrepStation {
  KITCHEN
  BARISTA
}

enum OrderType {
  DINE_IN
  TAKE_AWAY
  DELIVERY
}

enum OrderStatus {
  PENDING       -- order submitted, no prep started anywhere
  IN_PROGRESS   -- at least one prep ticket has been claimed
  READY         -- all prep tickets are marked Ready
  CLOSED        -- payment recorded (or handed to Grubba for delivery)
  CANCELLED     -- order was cancelled before preparation
}

enum PrepTicketStatus {
  PENDING       -- waiting to be claimed
  IN_PROGRESS   -- claimed, being prepared
  READY         -- preparation complete
}

enum PaymentMethod {
  MPESA
  CASH
  CARD
}

enum ClockMethod {
  GPS           -- verified by geofencing
  OVERRIDE      -- manually overridden by manager
}
```

---

## 6. Key Design Decisions

### Why a separate PrepTicket table instead of status flags on Order?

An order can involve two independent workflows happening simultaneously — the kitchen preparing food while the barista makes drinks. Each workflow has its own claim, its own In-Progress, its own Ready. These cannot be cleanly modelled as flags on a single `Order` row without duplicating columns and creating an awkward schema. `PrepTicket` gives each workflow its own clean lifecycle, its own claimant, and its own timestamps — while the `Order` still presents a unified view to the waiter.

### Why store `items` as JSON on PrepTicket instead of a join table?

The KDS and BDS need to render order cards quickly. If items were stored in a separate join table, every ticket display would require a join. The JSON snapshot approach means the KDS can retrieve all the display information for a ticket in a single query. The tradeoff is that the JSON is a snapshot — changes to `OrderItem` records do not automatically update the ticket. This is intentional: when a waiter modifies an order while it's still Pending, the system must re-generate the PrepTicket's JSON snapshot and notify the station.

### Why is OrderItem price snapshotted instead of referenced live?

Menu prices may change over time. If we stored only a `menuItemId` reference and looked up the price at read time, historical orders would show incorrect totals after a price change. By snapshotting `unitPrice` at the time of ordering, we preserve the exact financial record permanently. This is standard practice in any commerce system.

### Why is Organization the tenant, not User?

The tenant boundary is the branch. Staff belong to a branch, orders belong to a branch, shifts belong to a branch. All data isolation happens at the `organization_id` level. This cleanly supports the Director's cross-branch access (they query across organizations) and the Manager's isolation (all their queries are filtered to their `organization_id`).

### Why nullable organizationId on User?

System Admin and Director are not associated with a single branch. They operate at the system level. Making `organizationId` nullable on `User` allows these roles to exist without forcing an artificial branch assignment, while branch-scoped roles always have a non-null `organizationId`.

---

## 7. Index Strategy

All indexes are defined on the schema explicitly. The key indexes and their justification:

| Table | Index | Reason |
|---|---|---|
| `users` | `organizationId` | All staff queries filter by branch |
| `users` | `email` | Login lookup — must be instant |
| `orders` | `(organizationId, status)` | Manager dashboard: "show all active orders at this branch" |
| `orders` | `(organizationId, orderDate)` | Daily reporting queries |
| `prep_tickets` | `(organizationId, station, status)` | Primary KDS/BDS query: "show all Kitchen tickets that are Pending at this branch" |
| `prep_tickets` | `claimedById` | Staff performance reports: "all tickets claimed by Chef X" |
| `shift_assignments` | `(userId, date)` | Geofencing check: "does this user have a shift today?" |
| `clock_records` | `(userId, clockInAt)` | Attendance reports |
| `branch_menu_items` | `(organizationId, menuItemId)` | Menu availability lookup per branch |

---

*This data model is the authoritative schema definition for Wendo RMS V1. Any structural changes must be reviewed here first, then reflected in the Prisma schema and a corresponding migration.*
