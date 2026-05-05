# Data Model
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 2.0
**Status:** Current
**Date:** 2026-05-04
**Stack:** PostgreSQL · Prisma ORM

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Entity Overview](#2-entity-overview)
3. [Entity Relationship Diagram](#3-entity-relationship-diagram)
4. [Schema Definitions](#4-schema-definitions)
   - [Organization (Branch)](#41-organization-branch)
   - [OrderCounter](#42-ordercounter)
   - [User](#43-user)
   - [StaffTransfer](#44-stafftransfer)
   - [RefreshToken](#45-refreshtoken)
   - [MenuCategory](#46-menucategory)
   - [MenuItem](#47-menuitem)
   - [BranchMenuItem](#48-branchmenuitem)
   - [DeliveryZone](#49-deliveryzone)
   - [Shift](#410-shift)
   - [ShiftAssignment](#411-shiftassignment)
   - [ClockRecord](#412-clockrecord)
   - [Order](#413-order)
   - [OrderItem](#414-orderitem)
   - [PrepTicket](#415-prepticket)
   - [OrderModificationRequest (Deprecated)](#416-ordermodificationrequest-deprecated)
   - [IncidentLog](#417-incidentlog)
   - [IdempotencyKey](#418-idempotencykey)
   - [PrintJob](#419-printjob)
   - [PrintStation](#420-printstation)
   - [HouseAccount](#421-houseaccount)
   - [HouseAccountSettlement](#422-houseaccountsettlement)
   - [HouseAccountAuthRequest](#423-houseaccountauthrequest)
   - [CorporateAccount](#424-corporateaccount)
   - [CorporateAccountSettlement](#425-corporateaccountsettlement)
   - [CustomerCreditAccount](#426-customercreditaccount)
   - [CustomerCreditSettlement](#427-customercreditsettlement)
   - [OtherIncomeCategory](#428-otherncomecategory)
   - [OtherIncomeEntry](#429-otherincomeentry)
   - [Discount](#430-discount)
   - [StaffDiscountAuthRequest](#431-staffdiscountauthrequest)
   - [CustomerDiscountAuthRequest](#432-customerdiscountauthrequest)
   - [DirectConversation](#433-directconversation)
   - [DirectMessage](#434-directmessage)
   - [Broadcast](#435-broadcast)
   - [BroadcastRecipient](#436-broadcastrecipient)
   - [FormalNotice](#437-formalnotice)
   - [FormalNoticeRecipient](#438-formalnoticerecipient)
   - [EmployeeProfile](#439-employeeprofile)
   - [LeaveBalance](#440-leavebalance)
   - [LeaveRequest](#441-leaverequest)
   - [DisciplinaryRecord](#442-disciplinaryrecord)
   - [HrDocument](#443-hrdocument)
5. [Enums](#5-enums)
6. [Key Design Decisions](#6-key-design-decisions)
7. [Index Strategy](#7-index-strategy)

---

## 1. Design Principles

Every design decision in this schema follows these rules, derived from the Engineering Standards:

**UUIDs everywhere.** All primary keys are UUIDs. This prevents enumeration attacks (a malicious user cannot guess `order/2` because they saw `order/1`) and makes IDs safe to expose in URLs and APIs.

**Multi-tenancy by `organization_id`.** Every table that holds branch-scoped business data carries an `organization_id` foreign key. Every query against such data filters by `organization_id`. This is enforced at the repository layer — not optionally, always. A user at one branch can never see data from another branch. System-level entities (e.g. `CorporateAccount`, `MenuItem`) are intentionally unscoped.

**Soft deletes for business data.** Orders, menu items, staff records, and other business entities are never permanently deleted. They receive a `deleted_at` timestamp. This preserves history for reporting and prevents accidental data loss.

**Timestamps on every table.** Every table has `created_at` and `updated_at`. No exceptions.

**Money as Decimal, never Float.** All monetary values use `Decimal(10, 2)`. Floating-point arithmetic causes rounding errors in financial calculations. This is non-negotiable.

**Enums for fixed value sets.** Any field with a known, finite set of values is an enum — not a raw string. This enforces data integrity at the database level.

---

## 2. Entity Overview

### Core Operations

| Entity | Description |
|---|---|
| `Organization` | A branch of Wendo (e.g., Kingz, Town). The top-level tenant unit. |
| `OrderCounter` | Atomic daily order number counter per branch. Prevents race conditions on `dailyNumber`. |
| `User` | Any person with a system account. Role determines access. |
| `StaffTransfer` | Audit record of a staff member moving from one branch to another. |
| `RefreshToken` | JWT refresh token hash, tied to a user. |
| `MenuCategory` | System-level grouping of menu items. Determines prep station routing. |
| `MenuItem` | A single item on the master menu. System-level, not branch-scoped. |
| `BranchMenuItem` | Branch-level availability override for a menu item. |
| `DeliveryZone` | A named delivery area and its fee, scoped to a branch. |
| `Shift` | A named time block defining working hours, per branch. |
| `ShiftAssignment` | Assigns a staff member to a shift on a specific date. |
| `ClockRecord` | Ground-truth attendance record: clock-in and clock-out timestamps per assignment. |
| `Order` | A customer order — top-level entity tracking lifecycle and payment. |
| `OrderItem` | A single line item within an order (price snapshotted at order time). |
| `PrepTicket` | A routed sub-order sent to one prep station (KDS or BDS). One per order-item line per station. |
| `OrderModificationRequest` | **Deprecated.** Retained for migration compatibility only. |
| `IncidentLog` | Immutable log of every non-happy-path event (cancellations, rejections, overrides). |
| `IdempotencyKey` | Prevents duplicate order creation on network retries. Pruned after 60 seconds. |
| `PrintJob` | A queued thermal receipt print request, claimed and executed by a `PrintStation`. |
| `PrintStation` | A registered thermal printer device, identified by a unique token. |

### Credit Accounts

| Entity | Description |
|---|---|
| `HouseAccount` | Staff benefit credit line. One per staff member. Requires authorization for guest charges. |
| `HouseAccountSettlement` | Records a balance repayment on a House Account. |
| `HouseAccountAuthRequest` | Authorization request when a House Account payment requires manager/director approval. |
| `CorporateAccount` | System-level (not branch-scoped) credit account for a corporate client. |
| `CorporateAccountSettlement` | Records a balance repayment on a Corporate Account. |
| `CustomerCreditAccount` | Branch-scoped credit line for a named customer. |
| `CustomerCreditSettlement` | Records a balance repayment on a Customer Credit Account. |

### Other Income & Discounts

| Entity | Description |
|---|---|
| `OtherIncomeCategory` | Named category for non-order revenue (e.g., Pool Table, Event Hire). |
| `OtherIncomeEntry` | A single recorded other-income transaction at a branch. |
| `Discount` | A named customer discount (percentage or fixed). Director-defined, optionally branch-scoped. |
| `StaffDiscountAuthRequest` | Authorization request for a 30% staff discount on a waiter's own order. |
| `CustomerDiscountAuthRequest` | Authorization request when a named customer discount requires manager approval. |

### Internal Communications

| Entity | Description |
|---|---|
| `DirectConversation` | A 1:1 conversation thread between two users within a branch. |
| `DirectMessage` | A single message within a `DirectConversation`. Soft-deletable. |
| `Broadcast` | A one-to-many message sent to a branch, role group, or the whole company. |
| `BroadcastRecipient` | Tracks per-user read and acknowledge status for a broadcast. |
| `FormalNotice` | An HR-grade notice requiring acknowledgement, with BullMQ escalation reminders. |
| `FormalNoticeRecipient` | Tracks per-user acknowledgement and reminder timestamps for a formal notice. |

### HR Module

| Entity | Description |
|---|---|
| `EmployeeProfile` | Extended HR record for a staff member (personal info, employment type, dates). 1:1 with User. |
| `LeaveBalance` | Tracks total, used, and pending leave days per type per year for an employee. |
| `LeaveRequest` | A staff leave application with full approval lifecycle. |
| `DisciplinaryRecord` | A formal disciplinary action record linked to an employee profile. |
| `HrDocument` | A Cloudinary-stored file (contract, certificate, etc.) linked to a profile, leave, or disciplinary record. |

---

## 3. Entity Relationship Diagram

```
Organization (Branch)
│
├── User (staff accounts, scoped to branch)
│   ├── EmployeeProfile (1:1 HR record)
│   │   ├── LeaveBalance (per leave type per year)
│   │   ├── LeaveRequest (leave applications)
│   │   ├── DisciplinaryRecord (formal actions)
│   │   └── HrDocument (Cloudinary files)
│   └── HouseAccount (1:1 staff benefit credit line)
│       ├── HouseAccountSettlement
│       └── HouseAccountAuthRequest
│
├── BranchMenuItem (availability overrides per branch)
│
├── DeliveryZone (delivery areas and fees per branch)
│
├── Shift (shift definitions per branch)
│   └── ShiftAssignment (staff assigned to shift on a date)
│       └── ClockRecord (clock-in/out per assignment)
│
├── Order (customer orders per branch)
│   ├── OrderItem (line items, price snapshotted)
│   ├── PrepTicket (one per order-item line per station)
│   ├── IncidentLog (non-happy-path events)
│   ├── PrintJob (thermal receipt queue)
│   ├── HouseAccountAuthRequest (if payment = HOUSE_ACCOUNT)
│   ├── StaffDiscountAuthRequest (if staff discount applied)
│   └── CustomerDiscountAuthRequest (if customer discount needs approval)
│
├── CustomerCreditAccount (branch-scoped customer credit)
│   └── CustomerCreditSettlement
│
├── OtherIncomeCategory (incidental revenue types)
│   └── OtherIncomeEntry (recorded transactions)
│
├── Discount (named customer discounts, may be branch-scoped)
│
├── DirectConversation (1:1 messaging)
│   └── DirectMessage
│
├── Broadcast (one-to-many messaging)
│   └── BroadcastRecipient
│
└── FormalNotice (HR notices with escalation)
    └── FormalNoticeRecipient

MenuCategory (system-level, no branch scope)
└── MenuItem (system-level master menu)
    └── BranchMenuItem (branch availability override)

CorporateAccount (system-level, no branch scope)
├── CorporateAccountSettlement
└── Order (via corporateAccountId FK)

StaffTransfer (audit log, references two Organizations)
OrderCounter (per-branch daily counter)
PrintStation (per-branch printer device)
IdempotencyKey (order dedup, global)
```

---

## 4. Schema Definitions

### 4.1 Organization (Branch)

Represents a single branch of Wendo. This is the **tenant unit** — all branch-scoped data references this table.

```prisma
model Organization {
  id              String   @id @default(uuid())
  name            String                          -- e.g., "Wendo Kingz", "Wendo Town"
  address         String
  city            String
  latitude        Decimal  @db.Decimal(10, 7)     -- GPS coordinates for geofencing
  longitude       Decimal  @db.Decimal(10, 7)
  phone           String?
  mpesaPaybill    String?  @map("mpesa_paybill")  -- for receipt printing
  accountNumber   String?  @map("account_number")
  googleReviewUrl String?  @map("google_review_url")
  isHub           Boolean  @default(false)        -- Director designates one branch as hub
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("organizations")
}
```

**Notes:**
- `latitude`/`longitude` stored as high-precision Decimal for accurate 50m geofencing.
- `isHub` — only one branch should be hub at a time, enforced at the application layer.
- `mpesaPaybill` and `accountNumber` populate the M-Pesa section of printed receipts.

---

### 4.2 OrderCounter

Atomic daily order number counter per branch. Prevents race conditions when multiple waiters submit orders simultaneously.

```prisma
model OrderCounter {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  orderDate      DateTime     @db.Date @map("order_date")
  lastNumber     Int          @default(0) @map("last_number")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  @@unique([organizationId, orderDate])
  @@map("order_counters")
}
```

**Notes:**
- Incremented inside a Prisma `$transaction` with a `SELECT FOR UPDATE` equivalent. The `lastNumber + 1` becomes the new order's `dailyNumber`.
- One record per branch per day; resets naturally as new dates create new rows.

---

### 4.3 User

Every person with a system account. One table for all roles — role determines what they can see and do.

```prisma
model User {
  id             String    @id @default(uuid())
  organizationId String?   @map("organization_id")   -- null for SYSTEM_ADMIN, DIRECTOR, HR_MANAGER, ACCOUNTANT
  name           String
  email          String    @unique
  phone          String?
  passwordHash   String    @map("password_hash")
  fcmToken       String?   @map("fcm_token")          -- Firebase Cloud Messaging token for push notifications
  role           UserRole
  isActive       Boolean   @default(true) @map("is_active")
  isTestUser     Boolean   @default(false) @map("is_test_user")  -- excluded from reports
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")         -- soft delete

  @@index([organizationId])
  @@index([email])
  @@index([role])
  @@map("users")
}
```

**Notes:**
- `organizationId` is nullable — `SYSTEM_ADMIN`, `DIRECTOR`, `HR_MANAGER`, and `ACCOUNTANT` are not tied to a single branch.
- `fcmToken` is set when the staff member enables push notifications in their Profile page. One token per device; re-registration overwrites the previous token.
- `isTestUser` — seed/demo accounts are flagged so they are excluded from revenue and performance reports.
- `deletedAt` — soft delete. `isActive: false` + `deletedAt` set when a manager deactivates a staff account. Records are preserved for historical reporting.

---

### 4.4 StaffTransfer

Immutable audit record when a staff member is transferred from one branch to another. The transfer also updates the user's `organizationId`.

```prisma
model StaffTransfer {
  id                 String       @id @default(uuid())
  userId             String       @map("user_id")
  fromOrganizationId String       @map("from_organization_id")
  toOrganizationId   String       @map("to_organization_id")
  notes              String?
  transferredAt      DateTime     @default(now()) @map("transferred_at")
  authorizedById     String       @map("authorized_by_id")  -- DIRECTOR or SYSTEM_ADMIN who approved

  @@index([userId])
  @@index([fromOrganizationId])
  @@index([toOrganizationId])
  @@map("staff_transfers")
}
```

---

### 4.5 RefreshToken

Stores the hashed refresh token issued on login. Used to issue new access tokens without re-authentication.

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tokenHash String   @unique @map("token_hash")  -- bcrypt hash of the raw token
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@map("refresh_tokens")
}
```

**Notes:**
- The raw token is sent to the client and never stored. Only the hash is persisted.
- `onDelete: Cascade` on the `User` relation — all tokens are invalidated when a user is deleted.

---

### 4.6 MenuCategory

System-level menu categories. Each category determines which prep station its items route to.

```prisma
model MenuCategory {
  id           String      @id @default(uuid())
  name         String      @unique             -- e.g., "Hot Drinks", "Mains", "Desserts"
  prepStation  PrepStation                     -- KITCHEN, BARISTA, PIZZA, or PASTRY
  displayOrder Int         @default(0) @map("display_order")
  isActive     Boolean     @default(true) @map("is_active")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")

  @@index([prepStation])
  @@map("menu_categories")
}
```

**Notes:**
- No `organizationId` — categories are global across the entire system.
- `prepStation` is the routing key: all items whose category maps to `KITCHEN` produce kitchen prep tickets; `BARISTA` produces barista prep tickets.

---

### 4.7 MenuItem

Individual items on the master menu. System-level — not scoped to a branch.

```prisma
model MenuItem {
  id          String    @id @default(uuid())
  categoryId  String    @map("category_id")
  name        String
  description String?
  imageUrl    String?   @map("image_url")   -- Cloudinary CDN URL (optional)
  price       Decimal   @db.Decimal(10, 2)  -- always KES, universal pricing
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")  -- soft delete

  @@index([categoryId])
  @@index([isActive])
  @@map("menu_items")
}
```

**Notes:**
- `price` is universal — the same price applies at all branches.
- `imageUrl` — uploaded via `POST /menus/items/upload-image`; served via Cloudinary CDN.
- `deletedAt` — items are soft-deleted so historical orders that reference them remain intact.

---

### 4.8 BranchMenuItem

Branch-level availability override. When a branch runs out of an item, the manager marks it unavailable at their branch without affecting the master menu.

```prisma
model BranchMenuItem {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  menuItemId     String   @map("menu_item_id")
  isAvailable    Boolean  @default(true) @map("is_available")
  updatedAt      DateTime @updatedAt @map("updated_at")
  updatedBy      String   @map("updated_by")  -- userId of manager who made the change

  @@unique([organizationId, menuItemId])
  @@index([organizationId])
  @@index([menuItemId])
  @@map("branch_menu_items")
}
```

**Notes:**
- `@@unique([organizationId, menuItemId])` — exactly one record per item per branch.
- Default-available pattern: if no record exists for an item at a branch, the item is considered available.

---

### 4.9 DeliveryZone

Delivery areas and fees, scoped per branch. Each branch has independent zones.

```prisma
model DeliveryZone {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  name           String                          -- e.g., "Kiganjo", "Karatina"
  fee            Decimal  @db.Decimal(10, 2)
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@index([organizationId])
  @@map("delivery_zones")
}
```

---

### 4.10 Shift

A named time block defining working hours. Defined per branch since branches may operate on different schedules.

```prisma
model Shift {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  name           String                         -- e.g., "Morning", "Evening"
  startTime      String   @map("start_time")    -- stored as "HH:MM"
  endTime        String   @map("end_time")      -- stored as "HH:MM"
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@index([organizationId])
  @@map("shifts")
}
```

**Notes:**
- `startTime`/`endTime` stored as `"HH:MM"` strings — shifts are recurring templates, not one-off events. The actual date comes from `ShiftAssignment.date`.

---

### 4.11 ShiftAssignment

Links a staff member to a shift on a specific date. The daily schedule.

```prisma
model ShiftAssignment {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  shiftId        String   @map("shift_id")
  userId         String   @map("user_id")
  date           DateTime @db.Date   -- the calendar date of the assignment
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([userId, date, shiftId])
  @@index([organizationId])
  @@index([userId])
  @@index([date])
  @@map("shift_assignments")
}
```

**Notes:**
- `@@unique([userId, date, shiftId])` prevents double-booking the same person to the same shift on the same day.

---

### 4.12 ClockRecord

Records actual clock-in and clock-out timestamps for a staff member on a given shift assignment. Ground truth for attendance reporting.

```prisma
model ClockRecord {
  id                String       @id @default(uuid())
  organizationId    String       @map("organization_id")
  shiftAssignmentId String       @unique @map("shift_assignment_id")  -- one record per assignment
  userId            String       @map("user_id")
  clockInAt         DateTime?    @map("clock_in_at")
  clockOutAt        DateTime?    @map("clock_out_at")
  clockInMethod     ClockMethod  @map("clock_in_method")   -- GPS or OVERRIDE
  clockOutMethod    ClockMethod? @map("clock_out_method")
  overrideById      String?      @map("override_by_id")    -- manager who performed override
  overrideNote      String?      @map("override_note")     -- required when OVERRIDE
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([userId])
  @@index([clockInAt])
  @@map("clock_records")
}
```

**Notes:**
- `clockInAt`/`clockOutAt` are nullable — a record may exist with only clock-in (staff is still on shift).
- Application invariant: only one open clock record (`clockOutAt = null`) allowed per user at a time.
- `overrideById`/`overrideNote` are required when `clockInMethod = OVERRIDE`.

---

### 4.13 Order

The central entity of the system. Represents a complete customer order from submission to payment or cancellation.

```prisma
model Order {
  id             String        @id @default(uuid())
  organizationId String        @map("organization_id")
  dailyNumber    Int           @map("daily_number")      -- e.g., 1, 2, 3... resets daily per branch
  orderDate      DateTime      @db.Date @map("order_date")
  type           OrderType                               -- DINE_IN, TAKE_AWAY, DELIVERY
  status         OrderStatus   @default(PENDING)
  tableNumber    String?       @map("table_number")      -- dine-in only
  notes          String?                                 -- customer instructions

  -- Financials
  subtotal       Decimal       @db.Decimal(10, 2)
  deliveryFee    Decimal       @default(0) @db.Decimal(10, 2) @map("delivery_fee")
  total          Decimal       @db.Decimal(10, 2)

  -- Payment (set when waiter records payment)
  paymentMethod  PaymentMethod? @map("payment_method")
  mpesaCode      String?        @map("mpesa_code")       -- M-Pesa transaction code
  mpesaAmount    Decimal?       @db.Decimal(10, 2) @map("mpesa_amount")
  cashAmount     Decimal?       @db.Decimal(10, 2) @map("cash_amount")
  cardAmount     Decimal?       @db.Decimal(10, 2) @map("card_amount")
  splitType      String?        @map("split_type")       -- "MPESA_CASH" | "MPESA_CARD" | "CASH_CARD"
  paidAt         DateTime?      @map("paid_at")

  -- Cancellation (set if order is cancelled)
  cancelReason   String?        @map("cancel_reason")
  cancelledById  String?        @map("cancelled_by_id")

  -- Credit account links (at most one is set)
  houseAccountId          String? @map("house_account_id")
  corporateAccountId      String? @map("corporate_account_id")
  corporateEmployeeRef    String? @map("corporate_employee_ref")  -- employee identifier on the invoice
  customerCreditAccountId String? @map("customer_credit_account_id")

  -- Discounts (at most one type is set)
  discountPercent Decimal? @db.Decimal(5, 2) @map("discount_percent")  -- staff discount: fixed 30%
  discountAmount  Decimal? @db.Decimal(10, 2) @map("discount_amount")   -- KES amount deducted
  discountedById  String?  @map("discounted_by_id")                     -- manager who approved staff discount
  discountId      String?  @map("discount_id")                          -- FK → Discount (customer discount)

  -- Foreign keys
  deliveryZoneId String?  @map("delivery_zone_id")
  createdById    String   @map("created_by_id")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  closedAt       DateTime? @map("closed_at")

  @@unique([organizationId, dailyNumber, orderDate])
  @@index([organizationId])
  @@index([organizationId, status])
  @@index([organizationId, orderDate])
  @@index([createdById])
  @@map("orders")
}
```

**Notes:**
- `dailyNumber` + `orderDate` + `organizationId` form the human-readable order reference. The `@@unique` constraint prevents duplicates.
- `subtotal`, `deliveryFee`, and `total` are denormalised (stored, not computed). This is intentional — it creates an immutable financial record; past totals survive future price changes.
- **Split payment fields** (`mpesaAmount`, `cashAmount`, `cardAmount`, `splitType`) are only populated when `paymentMethod = SPLIT`.
- **Credit account fields** — at most one of `houseAccountId`, `corporateAccountId`, `customerCreditAccountId` is set per order.
- **Discount fields** — `discountedById` (non-null) indicates a staff discount; `discountId` (non-null) indicates a named customer discount. They are mutually exclusive and also mutually exclusive with credit payment methods.
- `status = AWAITING_AUTHORIZATION` is set when either a House Account payment, staff discount, or approval-required customer discount is pending manager/director approval.
- `closedAt` provides a clean timestamp for reporting (time from submission to closure).

---

### 4.14 OrderItem

A single line item within an order. Price is snapshotted at order time.

```prisma
model OrderItem {
  id         String  @id @default(uuid())
  orderId    String  @map("order_id")
  menuItemId String  @map("menu_item_id")
  quantity   Int
  unitPrice  Decimal @db.Decimal(10, 2) @map("unit_price")  -- price at time of order
  subtotal   Decimal @db.Decimal(10, 2)                     -- quantity × unitPrice
  notes      String?                                         -- item-level special instructions

  @@index([orderId])
  @@index([menuItemId])
  @@map("order_items")
}
```

**Notes:**
- No `createdAt`/`updatedAt` — `OrderItem` records are immutable once created. Changes happen by deleting and recreating items while the order is still in `PENDING` status.
- `onDelete: Cascade` on `orderId` — items are deleted if the order is hard-deleted (edge case only; orders are never hard-deleted in practice).

---

### 4.15 PrepTicket

The routing entity. When an order is submitted, one `PrepTicket` is created **per order-item line per station** (not one ticket per station). This is the one-ticket-per-line design for workload fairness.

```prisma
model PrepTicket {
  id             String           @id @default(uuid())
  organizationId String           @map("organization_id")
  orderId        String           @map("order_id")
  station        PrepStation                             -- KITCHEN, BARISTA, PIZZA, or PASTRY
  sequence       Int              @default(1)            -- batch number for follow-up tickets
  status         PrepTicketStatus @default(PENDING)
  claimedById    String?          @map("claimed_by_id") -- chef/barista who claimed it
  claimedAt      DateTime?        @map("claimed_at")
  readyAt        DateTime?        @map("ready_at")
  rejectedById   String?          @map("rejected_by_id")
  rejectedReason String?          @map("rejected_reason")
  rejectedAt     DateTime?        @map("rejected_at")
  items          Json                                    -- snapshot: [{name, quantity, notes}]
  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt @map("updated_at")

  @@unique([orderId, station, sequence])
  @@index([organizationId])
  @@index([organizationId, station, status])  -- primary KDS/BDS query index
  @@index([claimedById])
  @@map("prep_tickets")
}
```

**Notes:**
- **One ticket per order-item line per station.** An order with `Latte ×2 + Cappuccino + Fries` produces 3 tickets (2 BARISTA + 1 KITCHEN). The `sequence` field and `@@unique([orderId, station, sequence])` constraint support multiple tickets per station.
- `items` is a JSON snapshot — the KDS/BDS renders a card without joining `OrderItem` rows.
- `status = REJECTED` — a rejected ticket reverts to `PENDING` (the station declined; item goes back to queue). Rejected tickets are excluded from the order-ready check.
- `rejectedById`/`rejectedReason`/`rejectedAt` are set on rejection and logged to `IncidentLog`.

---

### 4.16 OrderModificationRequest (Deprecated)

> **Deprecated.** The modification request workflow has been removed. PENDING orders can be freely edited; non-PENDING orders can only have items removed by a MANAGER (logged to IncidentLog). This model remains in the schema for migration compatibility. API routes are unregistered; the frontend does not use it.

---

### 4.17 IncidentLog

Immutable, append-only log of every non-happy-path event. Used by managers and directors to audit what happened during a service.

```prisma
model IncidentLog {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  orderId        String?      @map("order_id")      -- nullable; some incidents are not order-related
  type           IncidentType
  actorId        String?      @map("actor_id")      -- user who triggered the event
  details        Json                               -- event-specific payload
  createdAt      DateTime     @default(now()) @map("created_at")

  @@index([organizationId])
  @@index([organizationId, type])
  @@index([orderId])
  @@index([createdAt])
  @@map("incident_logs")
}
```

**Notes:**
- No `updatedAt` — incident logs are never modified after creation.
- `details` JSON shape varies by `type`. See `IncidentType` enum for all event types.

---

### 4.18 IdempotencyKey

Prevents duplicate order creation from double-taps or network retries. Keyed on a client-generated UUID per submission attempt.

```prisma
model IdempotencyKey {
  id        String   @id @default(uuid())
  key       String   @unique
  orderId   String   @map("order_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([key])
  @@map("idempotency_keys")
}
```

**Notes:**
- Keys are pruned by a background job after 60 seconds — long enough to cover any network retry window.

---

### 4.19 PrintJob

A queued thermal receipt print request. The Flutter print app polls for pending jobs, claims them with a lease, and marks them completed.

```prisma
model PrintJob {
  id                   String         @id @default(uuid())
  organizationId       String         @map("organization_id")
  orderId              String?        @map("order_id")           -- null for other-income receipts
  activeKey            String?        @unique @map("active_key") -- prevents duplicate queuing for same order
  receiptType          ReceiptType    @default(RECEIPT) @map("receipt_type")  -- BILL or RECEIPT
  copies               Int            @default(1)
  status               PrintJobStatus @default(PENDING)
  receiptData          Json           @map("receipt_data")       -- full receipt payload (no DB joins needed)
  requestedById        String         @map("requested_by_id")
  claimedByStationId   String?        @map("claimed_by_station_id")
  claimedAt            DateTime?      @map("claimed_at")
  leaseExpiresAt       DateTime?      @map("lease_expires_at")   -- lease expires after 30s if not printed
  printAttemptCount    Int            @default(0) @map("print_attempt_count")
  printedByStationId   String?        @map("printed_by_station_id")
  printedAt            DateTime?      @map("printed_at")
  failureReason        String?        @map("failure_reason")
  createdAt            DateTime       @default(now()) @map("created_at")
  updatedAt            DateTime       @updatedAt @map("updated_at")

  @@index([organizationId, status])
  @@index([orderId])
  @@map("print_jobs")
}
```

---

### 4.20 PrintStation

A registered thermal printer device. The Flutter print app authenticates using a unique `token`.

```prisma
model PrintStation {
  id             String    @id @default(uuid())
  organizationId String    @map("organization_id")
  name           String    @default("Default Printer")
  token          String    @unique   -- used by the print app to authenticate
  isActive       Boolean   @default(true) @map("is_active")
  lastSeenAt     DateTime? @map("last_seen_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([token])
  @@map("print_stations")
}
```

---

### 4.21 HouseAccount

A staff benefit credit line. One per staff member. Covers personal meals charged against the employee's account.

```prisma
model HouseAccount {
  id             String   @id @default(uuid())
  userId         String   @unique @map("user_id")     -- 1:1 with User
  creditLimit    Decimal? @db.Decimal(10, 2) @map("credit_limit")  -- null = no limit
  currentBalance Decimal  @default(0) @db.Decimal(10, 2) @map("current_balance")
  isActive       Boolean  @default(true) @map("is_active")
  grantedById    String   @map("granted_by_id")       -- DIRECTOR or SYSTEM_ADMIN who granted it
  requiresAuthorization Boolean @default(false) @map("requires_authorization")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@index([isActive])
  @@map("house_accounts")
}
```

**Notes:**
- `currentBalance` — the outstanding amount owed by the staff member. Incremented atomically when a House Account order is closed. Decremented on settlement.
- `requiresAuthorization` — when `true`, any payment against this account creates a `HouseAccountAuthRequest` and transitions the order to `AWAITING_AUTHORIZATION`.
- House Account orders are **excluded from all revenue totals** — they are accounts receivable, not collected revenue.

---

### 4.22 HouseAccountSettlement

Records a balance repayment on a House Account.

```prisma
model HouseAccountSettlement {
  id             String   @id @default(uuid())
  houseAccountId String   @map("house_account_id")
  amount         Decimal  @db.Decimal(10, 2)
  note           String?
  settledById    String   @map("settled_by_id")   -- MANAGER or ACCOUNTANT who recorded the settlement
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([houseAccountId])
  @@map("house_account_settlements")
}
```

---

### 4.23 HouseAccountAuthRequest

Created when a House Account payment requires manager or director approval before the order can close.

```prisma
model HouseAccountAuthRequest {
  id             String                 @id @default(uuid())
  organizationId String                 @map("organization_id")
  orderId        String                 @map("order_id")
  houseAccountId String                 @map("house_account_id")
  requestedById  String                 @map("requested_by_id")   -- waiter who submitted the order
  amount         Decimal                @db.Decimal(10, 2)
  status         HouseAccountAuthStatus @default(PENDING)
  bullmqJobId    String?                @map("bullmq_job_id")
  expiresAt      DateTime               @map("expires_at")        -- 24h from creation
  resolvedById   String?                @map("resolved_by_id")
  resolvedAt     DateTime?              @map("resolved_at")
  createdAt      DateTime               @default(now()) @map("created_at")
  updatedAt      DateTime               @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([orderId])
  @@index([houseAccountId])
  @@index([status])
  @@map("house_account_auth_requests")
}
```

**Notes:**
- On **Approve**: `recordPayment` closes the order and increments `houseAccount.currentBalance` atomically inside a `$transaction`.
- On **Reject**: order returns to `READY` status; `PAYMENT_REJECTED` incident is logged; waiter is notified to collect payment another way.

---

### 4.24 CorporateAccount

System-level (not branch-scoped) credit account for a corporate client. Can be used across all branches.

```prisma
model CorporateAccount {
  id              String   @id @default(uuid())
  -- No organizationId — corporate accounts are system-level
  companyName     String   @map("company_name")
  contactName     String   @map("contact_name")
  contactPhone    String   @map("contact_phone")
  contactEmail    String?  @map("contact_email")
  creditLimit     Decimal? @db.Decimal(10, 2) @map("credit_limit")  -- null = no limit
  currentBalance  Decimal  @default(0) @db.Decimal(10, 2) @map("current_balance")
  billingCycleDay Int      @default(1) @map("billing_cycle_day")   -- day of month for billing
  isActive        Boolean  @default(true) @map("is_active")
  createdById     String   @map("created_by_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([isActive])
  @@index([companyName])
  @@map("corporate_accounts")
}
```

**Notes:**
- No `organizationId` — corporate accounts are accessible from any branch. DIRECTOR and SYSTEM_ADMIN manage them.
- `corporateEmployeeRef` on `Order` identifies the employee on the corporate invoice.

---

### 4.25 CorporateAccountSettlement

Records a balance repayment on a Corporate Account.

```prisma
model CorporateAccountSettlement {
  id                 String   @id @default(uuid())
  corporateAccountId String   @map("corporate_account_id")
  amount             Decimal  @db.Decimal(10, 2)
  note               String?
  settledById        String   @map("settled_by_id")
  createdAt          DateTime @default(now()) @map("created_at")

  @@index([corporateAccountId])
  @@map("corporate_account_settlements")
}
```

---

### 4.26 CustomerCreditAccount

Branch-scoped credit line for a named customer. Managed by the branch manager.

```prisma
model CustomerCreditAccount {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")   -- branch-scoped
  customerName   String   @map("customer_name")
  customerPhone  String   @map("customer_phone")
  creditLimit    Decimal  @db.Decimal(10, 2) @map("credit_limit")
  currentBalance Decimal  @default(0) @db.Decimal(10, 2) @map("current_balance")
  notes          String?
  isActive       Boolean  @default(true) @map("is_active")
  createdById    String   @map("created_by_id")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([organizationId, isActive])
  @@index([customerPhone])
  @@map("customer_credit_accounts")
}
```

**Notes:**
- Unlike `CorporateAccount`, customer credit accounts are branch-scoped. A customer credit at Kingz branch is not visible at Town branch.
- Credit limit is checked inside a `$transaction` to prevent race conditions.

---

### 4.27 CustomerCreditSettlement

Records a balance repayment on a Customer Credit Account.

```prisma
model CustomerCreditSettlement {
  id                      String   @id @default(uuid())
  customerCreditAccountId String   @map("customer_credit_account_id")
  amount                  Decimal  @db.Decimal(10, 2)
  note                    String?
  settledById             String   @map("settled_by_id")
  createdAt               DateTime @default(now()) @map("created_at")

  @@index([customerCreditAccountId])
  @@map("customer_credit_settlements")
}
```

---

### 4.28 OtherIncomeCategory

Named categories for non-order revenue (e.g., Pool Table, Event Hire, Parking). Defined by the Director; can be scoped to all branches or a single branch.

```prisma
model OtherIncomeCategory {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")  -- the org that owns this category
  branchId       String?  @map("branch_id")        -- null = available to all branches
  name           String
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([branchId])
  @@map("other_income_categories")
}
```

---

### 4.29 OtherIncomeEntry

A single recorded other-income transaction at a branch.

```prisma
model OtherIncomeEntry {
  id             String                   @id @default(uuid())
  organizationId String                   @map("organization_id")  -- org that owns the record
  branchId       String                   @map("branch_id")        -- branch where income was collected
  categoryId     String                   @map("category_id")
  amount         Decimal                  @db.Decimal(10, 2)
  paymentMethod  OtherIncomePaymentMethod @map("payment_method")   -- CASH, MPESA, CARD, SPLIT
  mpesaCode      String?                  @map("mpesa_code")
  mpesaAmount    Decimal?                 @db.Decimal(10, 2) @map("mpesa_amount")
  cashAmount     Decimal?                 @db.Decimal(10, 2) @map("cash_amount")
  cardAmount     Decimal?                 @db.Decimal(10, 2) @map("card_amount")
  splitType      String?                  @map("split_type")  -- "MPESA_CASH" | "MPESA_CARD" | "CASH_CARD"
  description    String?
  entryDate      DateTime                 @db.Date @map("entry_date")
  recordedById   String                   @map("recorded_by_id")
  createdAt      DateTime                 @default(now()) @map("created_at")
  updatedAt      DateTime                 @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([branchId])
  @@index([organizationId, entryDate])
  @@index([categoryId])
  @@map("other_income_entries")
}
```

**Notes:**
- Split payment fields (`mpesaAmount`, `cashAmount`, `cardAmount`, `splitType`) are only populated when `paymentMethod = SPLIT`.
- `otherIncomeTotal` is included in `BranchOverviewRow.revenue` — it contributes to total revenue alongside food orders.
- `sumByCategory` date range is **inclusive** on both ends — pass `startDate`/`endDate` directly, not `endExclusive`.

---

### 4.30 Discount

A named customer discount (percentage or fixed amount). Defined by the Director; can be scoped to all branches or a specific branch.

```prisma
model Discount {
  id               String       @id @default(uuid())
  organizationId   String?      @map("organization_id")  -- null = all branches (system-level)
  name             String                                 -- e.g., "Birthday Sale", "VIP"
  type             DiscountType                           -- PERCENTAGE or FIXED_AMOUNT
  value            Decimal      @db.Decimal(5, 2)        -- e.g., 10.00 for 10% or KES 500
  requiresApproval Boolean      @default(false) @map("requires_approval")
  isActive         Boolean      @default(true) @map("is_active")
  createdById      String       @map("created_by_id")
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([isActive])
  @@map("discounts")
}
```

**Notes:**
- `organizationId = null` means the discount is available at all branches. Queries use an OR filter: `organizationId IS NULL OR organizationId = branchId`.
- Auto-apply discounts (`requiresApproval = false`) are applied instantly at checkout.
- Approval-required discounts create a `CustomerDiscountAuthRequest` and set order to `AWAITING_AUTHORIZATION`.
- Mutually exclusive with credit payment methods (`HOUSE_ACCOUNT`, `CORPORATE_ACCOUNT`, `CUSTOMER_CREDIT`).

---

### 4.31 StaffDiscountAuthRequest

Created when a waiter applies a 30% staff discount to their own order, requiring manager approval.

```prisma
model StaffDiscountAuthRequest {
  id              String                  @id @default(uuid())
  organizationId  String                  @map("organization_id")
  orderId         String                  @map("order_id")
  requestedById   String                  @map("requested_by_id")  -- the waiter
  discountPercent Decimal                 @db.Decimal(5, 2) @map("discount_percent")  -- always 30.00
  originalAmount  Decimal                 @db.Decimal(10, 2) @map("original_amount")
  discountAmount  Decimal                 @db.Decimal(10, 2) @map("discount_amount")
  status          StaffDiscountAuthStatus @default(PENDING)
  resolvedById    String?                 @map("resolved_by_id")
  resolvedAt      DateTime?               @map("resolved_at")
  createdAt       DateTime                @default(now()) @map("created_at")
  updatedAt       DateTime                @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([orderId])
  @@index([status])
  @@map("staff_discount_auth_requests")
}
```

**Notes:**
- On approval: discount fields are written to the `Order` (`discountPercent`, `discountAmount`, `discountedById`); order returns to `READY`.
- On rejection: no discount fields are set; order returns to `READY`; waiter pays full price.
- Disambiguation rule: if `order.discountedById` is set, it is a staff discount. If `order.discountId` is set, it is a customer discount.

---

### 4.32 CustomerDiscountAuthRequest

Created when a named customer discount with `requiresApproval = true` is applied at checkout.

```prisma
model CustomerDiscountAuthRequest {
  id              String                     @id @default(uuid())
  organizationId  String                     @map("organization_id")
  orderId         String                     @map("order_id")
  discountId      String                     @map("discount_id")
  requestedById   String                     @map("requested_by_id")
  discountPercent Decimal?                   @db.Decimal(5, 2) @map("discount_percent")  -- set if PERCENTAGE
  discountFixed   Decimal?                   @db.Decimal(10, 2) @map("discount_fixed")   -- set if FIXED_AMOUNT
  originalAmount  Decimal                    @db.Decimal(10, 2) @map("original_amount")
  discountAmount  Decimal                    @db.Decimal(10, 2) @map("discount_amount")
  status          CustomerDiscountAuthStatus @default(PENDING)
  resolvedById    String?                    @map("resolved_by_id")
  resolvedAt      DateTime?                  @map("resolved_at")
  createdAt       DateTime                   @default(now()) @map("created_at")
  updatedAt       DateTime                   @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([orderId])
  @@index([status])
  @@map("customer_discount_auth_requests")
}
```

---

### 4.33 DirectConversation

A 1:1 conversation thread between two users within a branch. Created on first message; reused on subsequent messages.

```prisma
model DirectConversation {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  participantAId String   @map("participant_a_id")
  participantBId String   @map("participant_b_id")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([organizationId, participantAId, participantBId])
  @@index([organizationId])
  @@index([participantAId])
  @@index([participantBId])
  @@map("direct_conversations")
}
```

**Notes:**
- `@@unique([organizationId, participantAId, participantBId])` ensures one thread per pair per branch.
- Participants are stored in a canonical order at creation time (lower UUID = participantA) to prevent duplicates from both directions.

---

### 4.34 DirectMessage

A single message within a `DirectConversation`. Supports soft delete.

```prisma
model DirectMessage {
  id             String    @id @default(uuid())
  conversationId String    @map("conversation_id")
  organizationId String    @map("organization_id")
  senderId       String    @map("sender_id")
  bodyHtml       String    @map("body_html")    -- HTML content
  attachmentUrl  String?   @map("attachment_url")
  attachmentName String?   @map("attachment_name")
  readAt         DateTime? @map("read_at")      -- set when the recipient reads the message
  createdAt      DateTime  @default(now()) @map("created_at")
  deletedAt      DateTime? @map("deleted_at")   -- soft delete (sender deleted message)

  @@index([conversationId, createdAt])
  @@index([organizationId])
  @@map("direct_messages")
}
```

---

### 4.35 Broadcast

A one-to-many message sent to a branch, a role group, or the whole company. Recipients are materialized at send time.

```prisma
model Broadcast {
  id             String         @id @default(uuid())
  organizationId String         @map("organization_id")
  senderId       String         @map("sender_id")
  scope          BroadcastScope                     -- COMPANY, BRANCH, or ROLE_GROUP
  targetRole     UserRole?      @map("target_role") -- set when scope = ROLE_GROUP
  subject        String
  bodyHtml       String         @map("body_html")
  attachmentUrl  String?        @map("attachment_url")
  attachmentName String?        @map("attachment_name")
  requiresAck    Boolean        @default(false) @map("requires_ack")  -- requires explicit acknowledgement
  createdAt      DateTime       @default(now()) @map("created_at")

  @@index([organizationId, createdAt])
  @@map("broadcasts")
}
```

---

### 4.36 BroadcastRecipient

Tracks per-user read and acknowledge status for a broadcast.

```prisma
model BroadcastRecipient {
  id             String    @id @default(uuid())
  broadcastId    String    @map("broadcast_id")
  organizationId String    @map("organization_id")
  userId         String    @map("user_id")
  readAt         DateTime? @map("read_at")
  acknowledgedAt DateTime? @map("acknowledged_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  @@unique([broadcastId, userId])
  @@index([broadcastId])
  @@index([userId])
  @@index([organizationId])
  @@map("broadcast_recipients")
}
```

---

### 4.37 FormalNotice

An HR-grade notice requiring acknowledgement. Escalating BullMQ reminders are sent at 24h and 48h if unacknowledged.

```prisma
model FormalNotice {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  issuerId       String   @map("issuer_id")   -- HR_MANAGER, DIRECTOR, or MANAGER who issued it
  subject        String
  bodyHtml       String   @map("body_html")
  attachmentUrl  String?  @map("attachment_url")
  attachmentName String?  @map("attachment_name")
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([organizationId, createdAt])
  @@map("formal_notices")
}
```

---

### 4.38 FormalNoticeRecipient

Tracks per-user acknowledgement and reminder timestamps for a formal notice.

```prisma
model FormalNoticeRecipient {
  id                 String    @id @default(uuid())
  noticeId           String    @map("notice_id")
  organizationId     String    @map("organization_id")
  userId             String    @map("user_id")
  acknowledgedAt     DateTime? @map("acknowledged_at")
  reminder24SentAt   DateTime? @map("reminder_24_sent_at")
  escalation48SentAt DateTime? @map("escalation_48_sent_at")
  createdAt          DateTime  @default(now()) @map("created_at")

  @@unique([noticeId, userId])
  @@index([noticeId])
  @@index([userId])
  @@index([organizationId])
  @@index([acknowledgedAt, createdAt])  -- for querying unacknowledged notices due for reminders
  @@map("formal_notice_recipients")
}
```

---

### 4.39 EmployeeProfile

Extended HR record for a staff member. 1:1 with `User`. Created by HR_MANAGER when onboarding a new employee.

```prisma
model EmployeeProfile {
  id                 String         @id @default(uuid())
  userId             String         @unique @map("user_id")  -- 1:1 with User
  nationalId         String?        @map("national_id")
  dateOfBirth        DateTime?      @map("date_of_birth")
  personalPhone      String?        @map("personal_phone")
  personalEmail      String?        @map("personal_email")
  physicalAddress    String?        @map("physical_address")
  emergencyName      String?        @map("emergency_name")
  emergencyRelation  String?        @map("emergency_relation")
  emergencyPhone     String?        @map("emergency_phone")
  employmentType     EmploymentType @map("employment_type")  -- FULL_TIME, PART_TIME, CASUAL
  startDate          DateTime       @map("start_date")
  endDate            DateTime?      @map("end_date")         -- null = still employed
  probationEndDate   DateTime?      @map("probation_end_date")
  jobTitle           String?        @map("job_title")
  reportingManagerId String?        @map("reporting_manager_id")
  notes              String?
  createdAt          DateTime       @default(now()) @map("created_at")
  updatedAt          DateTime       @updatedAt @map("updated_at")

  @@index([userId])
  @@map("employee_profiles")
}
```

**Notes:**
- `LeaveBalance` records are auto-seeded on profile creation (one per leave type for the current year).
- `probationEndDate` — HR dashboard surfaces an alert when this is approaching.

---

### 4.40 LeaveBalance

Tracks total, used, and pending leave days per type per year for an employee.

```prisma
model LeaveBalance {
  id                String    @id @default(uuid())
  employeeProfileId String    @map("employee_profile_id")
  leaveType         LeaveType @map("leave_type")   -- ANNUAL, SICK, EMERGENCY, UNPAID
  totalDays         Int       @map("total_days")
  usedDays          Decimal   @default(0) @db.Decimal(5, 1) @map("used_days")
  pendingDays       Decimal   @default(0) @db.Decimal(5, 1) @map("pending_days")
  leaveYear         Int       @map("leave_year")   -- calendar year, e.g. 2026

  @@unique([employeeProfileId, leaveType, leaveYear])
  @@index([employeeProfileId])
  @@map("leave_balances")
}
```

**Notes:**
- `pendingDays` — days requested but not yet approved. Reserved at request time; committed to `usedDays` on approval.
- `@@unique([employeeProfileId, leaveType, leaveYear])` — one balance record per type per year per employee.

---

### 4.41 LeaveRequest

A staff leave application with full approval lifecycle (PENDING → APPROVED / REJECTED / CANCELLED).

```prisma
model LeaveRequest {
  id                String      @id @default(uuid())
  employeeProfileId String      @map("employee_profile_id")
  leaveBalanceId    String      @map("leave_balance_id")
  organizationId    String      @map("organization_id")
  leaveType         LeaveType   @map("leave_type")
  startDate         DateTime    @map("start_date")
  endDate           DateTime    @map("end_date")
  totalDays         Decimal     @db.Decimal(5, 1) @map("total_days")  -- working days only
  reason            String
  status            LeaveStatus @default(PENDING)
  reviewedById      String?     @map("reviewed_by_id")
  reviewedAt        DateTime?   @map("reviewed_at")
  reviewComment     String?     @map("review_comment")
  cancelledAt       DateTime?   @map("cancelled_at")
  cancelledById     String?     @map("cancelled_by_id")
  createdAt         DateTime    @default(now()) @map("created_at")
  updatedAt         DateTime    @updatedAt @map("updated_at")

  @@index([organizationId, status])
  @@index([employeeProfileId])
  @@map("leave_requests")
}
```

**Notes:**
- `totalDays` is calculated as working days (Monday–Friday) between `startDate` and `endDate` — weekends are excluded.
- On approval: `leaveBalance.pendingDays` decremented, `leaveBalance.usedDays` incremented.
- On rejection/cancellation: `leaveBalance.pendingDays` decremented (days returned to available).

---

### 4.42 DisciplinaryRecord

A formal disciplinary action record linked to an employee profile.

```prisma
model DisciplinaryRecord {
  id                String               @id @default(uuid())
  employeeProfileId String               @map("employee_profile_id")
  organizationId    String               @map("organization_id")
  incidentDate      DateTime             @map("incident_date")
  actionDate        DateTime             @map("action_date")
  category          DisciplinaryCategory -- INSUBORDINATION, ATTENDANCE, MISCONDUCT, etc.
  description       String
  actionTaken       DisciplinaryAction   @map("action_taken")  -- VERBAL_WARNING through TERMINATION
  outcome           String
  issuedById        String               @map("issued_by_id")
  witnesses         String?
  acknowledged      Boolean              @default(false)
  acknowledgedAt    DateTime?            @map("acknowledged_at")
  appealed          Boolean              @default(false)
  appealOutcome     String?              @map("appeal_outcome")
  expiresAt         DateTime?            @map("expires_at")   -- null = permanent record
  createdAt         DateTime             @default(now()) @map("created_at")

  @@index([organizationId])
  @@index([employeeProfileId])
  @@map("disciplinary_records")
}
```

**Notes:**
- No `updatedAt` — disciplinary records are immutable after creation.
- `expiresAt` — allows warnings to expire from an employee's active record after a set period.
- FCM push notification is sent to the employee on creation.

---

### 4.43 HrDocument

A Cloudinary-stored file linked to an employee profile, leave request, or disciplinary record.

```prisma
model HrDocument {
  id                   String         @id @default(uuid())
  employeeProfileId    String         @map("employee_profile_id")
  leaveRequestId       String?        @map("leave_request_id")       -- set if attached to a leave request
  disciplinaryRecordId String?        @map("disciplinary_record_id") -- set if attached to a disciplinary record
  documentType         HrDocumentType @map("document_type")          -- CONTRACT, ID_COPY, CERTIFICATE, etc.
  fileName             String         @map("file_name")
  fileUrl              String         @map("file_url")               -- Cloudinary URL
  uploadedById         String         @map("uploaded_by_id")
  createdAt            DateTime       @default(now()) @map("created_at")

  @@index([employeeProfileId])
  @@index([leaveRequestId])
  @@index([disciplinaryRecordId])
  @@map("hr_documents")
}
```

---

## 5. Enums

```prisma
-- Roles. SYSTEM_ADMIN and DIRECTOR have no branch scope.
-- HR_MANAGER and ACCOUNTANT are also cross-branch.
enum UserRole {
  SYSTEM_ADMIN
  DIRECTOR
  HR_MANAGER
  MANAGER
  ACCOUNTANT
  WAITER
  CHEF
  BARISTA
  KITCHEN_DISPLAY    -- read-only KDS view (tablet mounted in kitchen)
  BARISTA_DISPLAY    -- read-only BDS view (tablet mounted at barista station)
}

-- Prep stations for ticket routing
enum PrepStation {
  KITCHEN
  BARISTA
  PIZZA    -- future station; currently unused at runtime
  PASTRY   -- future station; currently unused at runtime
}

enum OrderType {
  DINE_IN
  TAKE_AWAY
  DELIVERY
}

-- Order status lifecycle:
-- PENDING → IN_PROGRESS → READY → CLOSED
-- PENDING → CANCELLED (any time before kitchen claims)
-- READY → AWAITING_AUTHORIZATION (House Account / discount pending approval)
-- AWAITING_AUTHORIZATION → READY (rejected) or CLOSED (approved)
enum OrderStatus {
  PENDING
  IN_PROGRESS
  READY
  AWAITING_AUTHORIZATION
  CLOSED
  CANCELLED
}

enum HouseAccountAuthStatus {
  PENDING
  APPROVED
  REJECTED
  TIMED_OUT   -- set if the request expires without action (24h)
}

enum PrepTicketStatus {
  PENDING       -- waiting to be claimed (also reset here after rejection)
  IN_PROGRESS   -- claimed, being prepared
  READY         -- preparation complete
  REJECTED      -- chef/barista rejected; ticket reverts to PENDING; incident logged
}

-- All payment methods accepted by the system.
-- SPLIT indicates a mixed payment; split component fields on Order are populated.
-- HOUSE_ACCOUNT, CORPORATE_ACCOUNT, CUSTOMER_CREDIT are credit paths.
-- Credit orders are EXCLUDED from all revenue totals.
enum PaymentMethod {
  MPESA
  CASH
  CARD
  SPLIT
  HOUSE_ACCOUNT
  CORPORATE_ACCOUNT
  CUSTOMER_CREDIT
}

enum OtherIncomePaymentMethod {
  CASH
  MPESA
  CARD
  SPLIT
}

enum ClockMethod {
  GPS       -- verified by geofencing at clock time
  OVERRIDE  -- manually performed by a MANAGER
}

enum IncidentType {
  ORDER_CANCELLED       -- order was cancelled
  TICKET_REJECTED       -- chef/barista rejected a prep ticket
  MODIFICATION_REQUESTED  -- deprecated
  MODIFICATION_APPROVED   -- deprecated
  MODIFICATION_REJECTED   -- deprecated
  TICKET_UNCLAIMED      -- chef/barista unclaimed a previously claimed ticket
  ORDER_STALE           -- order has been pending too long
  ORDER_ITEM_REMOVED    -- MANAGER removed one or more items from a non-PENDING order
  PAYMENT_REJECTED      -- House Account payment was rejected by the account holder
}

enum ModificationRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

-- Used for receipt type on PrintJob
enum PrintJobStatus {
  PENDING    -- queued, waiting for a printer to claim it
  PRINTING   -- claimed by a PrintStation, lease active
  COMPLETED
  FAILED
}

enum ReceiptType {
  BILL     -- pre-payment bill (shows total due)
  RECEIPT  -- post-payment receipt (shows amount paid)
}

enum DiscountType {
  PERCENTAGE   -- value = percentage points, e.g. 10 = 10%
  FIXED_AMOUNT -- value = KES amount, e.g. 500 = KES 500 off
}

enum StaffDiscountAuthStatus {
  PENDING
  APPROVED
  REJECTED
}

enum CustomerDiscountAuthStatus {
  PENDING
  APPROVED
  REJECTED
}

enum BroadcastScope {
  COMPANY     -- all branches (DIRECTOR only)
  BRANCH      -- one branch
  ROLE_GROUP  -- specific role at one branch
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CASUAL
}

enum LeaveType {
  ANNUAL
  SICK
  EMERGENCY
  UNPAID
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum DisciplinaryCategory {
  INSUBORDINATION
  ATTENDANCE
  MISCONDUCT
  PERFORMANCE
  POLICY_VIOLATION
  OTHER
}

enum DisciplinaryAction {
  VERBAL_WARNING
  WRITTEN_WARNING
  FINAL_WARNING
  SUSPENSION
  TERMINATION
}

enum HrDocumentType {
  CONTRACT
  ID_COPY
  CERTIFICATE
  MEDICAL_CERTIFICATE
  INCIDENT_REPORT
  WARNING_LETTER
  OTHER
}
```

---

## 6. Key Design Decisions

### Why a separate PrepTicket table instead of status flags on Order?

An order can involve two independent workflows simultaneously — the kitchen preparing food while the barista makes drinks. Each workflow has its own claim, its own In-Progress, its own Ready. `PrepTicket` gives each workflow its own clean lifecycle, its own claimant, and its own timestamps, while the `Order` still presents a unified view to the waiter.

### Why one PrepTicket per order-item line (not per station)?

This is the workload-fairness design. An order with `Latte ×2 + Cappuccino` produces two separate BARISTA tickets — one for the Latte batch and one for the Cappuccino. This allows two different baristas to claim different items from the same order, distributing the work fairly. A single "all BARISTA items" ticket would force one person to make everything. See `docs/context/PHASE_3_ENHANCEMENT_TICKET_SPLITTING.md` for full rationale.

### Why store `items` as JSON on PrepTicket?

The KDS and BDS need to render order cards quickly in a single query. If items were in a join table, every card render would require a join. The JSON snapshot means the station sees all the display information for a ticket without extra queries. The tradeoff: changes to `OrderItem` records do not automatically propagate to the snapshot — this is intentional.

### Why is OrderItem price snapshotted?

Menu prices change over time. If we looked up the live price at read time, historical orders would show incorrect totals after a price change. Snapshotting `unitPrice` at order creation preserves the exact financial record permanently.

### Why is Organization the tenant, not User?

The tenant boundary is the branch. Staff belong to a branch, orders belong to a branch, shifts belong to a branch. All data isolation is at `organization_id`. This supports the Director's cross-branch read access (queries across all organizations) and the Manager's isolation (all queries filtered to one `organization_id`).

### Why do House Account orders not count as revenue?

House Account orders are accounts receivable — the money is owed but not collected at the time of order. Including them in revenue would inflate the daily collection figure. Revenue reports reflect only cash, M-Pesa, card, and credit account collections where money actually changed hands. `houseAccount.currentBalance` tracks the outstanding receivable separately.

### Why is CorporateAccount system-level (no organizationId)?

Corporate clients transact across all branches — a company has one account, not one per branch. Making the account system-level means any branch can charge against it. The individual `Order` record retains its `organizationId` for branch-level reporting.

### Why a separate StaffDiscountAuthRequest table (not reusing HouseAccountAuthRequest)?

Isolation. Staff discounts and House Account payments are fundamentally different flows (discount vs. credit). Separate tables prevent schema coupling, make queries simpler, and allow the two flows to evolve independently. The `AWAITING_AUTHORIZATION` status is shared because both flows pause the order, but the auth request type is disambiguated by checking which FK is set on the `Order` (`discountedById` vs `houseAccountId` vs `discountId`).

---

## 7. Index Strategy

| Table | Index | Reason |
|---|---|---|
| `users` | `organizationId` | All staff queries filter by branch |
| `users` | `email` | Login lookup — must be instant |
| `users` | `role` | Role-based queries (e.g., list all waiters at a branch) |
| `orders` | `(organizationId, status)` | Manager dashboard: active orders at this branch |
| `orders` | `(organizationId, orderDate)` | Daily reporting queries |
| `prep_tickets` | `(organizationId, station, status)` | Primary KDS/BDS query |
| `prep_tickets` | `claimedById` | Staff performance: all tickets claimed by Chef X |
| `shift_assignments` | `(userId, date)` | Geofencing: does this user have a shift today? |
| `clock_records` | `(userId, clockInAt)` | Attendance reports |
| `branch_menu_items` | `(organizationId, menuItemId)` | Menu availability lookup per branch |
| `incident_logs` | `(organizationId, type)` | Manager incident filter |
| `incident_logs` | `createdAt` | Time-range incident queries |
| `house_accounts` | `userId` | Lookup staff member's own account |
| `house_account_auth_requests` | `status` | Dashboard: all pending auth requests |
| `customer_credit_accounts` | `(organizationId, isActive)` | Branch customer credit list |
| `customer_credit_accounts` | `customerPhone` | Customer lookup by phone |
| `other_income_entries` | `(organizationId, entryDate)` | Daily other-income totals |
| `discounts` | `(organizationId, isActive)` | Checkout: fetch available discounts |
| `broadcast_recipients` | `userId` | Inbox: all broadcasts for a user |
| `formal_notice_recipients` | `(acknowledgedAt, createdAt)` | BullMQ reminder job: unacknowledged notices |
| `employee_profiles` | `userId` | HR: fetch profile by user |
| `leave_requests` | `(organizationId, status)` | HR dashboard: pending approvals |
| `leave_balances` | `employeeProfileId` | Leave request: check available days |

---

*This data model is the authoritative schema definition for Wendo RMS. Any structural change must be reflected here, in the Prisma schema, and in a corresponding migration file.*
