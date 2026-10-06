# Data Model
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 2.2
**Status:** Partially stale — see note below
**Date:** 2026-05-04 (core) · 2026-09-07 (staleness note + HR additions) · 2026-09-19 (Inventory Milestones One & Two)
**Stack:** PostgreSQL · Prisma ORM

> **Staleness note (2026-09-19).** This document was written at Phase 8. The
> schema is now at 66 models / 34 enums. **`backend/prisma/schema.prisma` is the
> source of truth.** Known gaps in this doc:
> - **HR:** `ContractType`, `LeavePolicy`, `LeaveRequestAcknowledgement`,
>   `Payslip` are documented in §4.44–4.47 below (added 2026-09-07). The
>   `EmployeeProfile` block in §4.39 predates the statutory-ID / bank-details /
>   contract-type fields — check the schema.
> - **Inventory (Milestones One & Two, shipped and live in production):**
>   `Category`, `InventoryItem`, `Supplier`, `RestockLevel`, `InventoryTransaction`,
>   `ReferenceCounter`, `ExpectedDelivery(+Line)`, `GoodsReceipt(+Line)`,
>   `SupplierInvoice(+Receipt/Adjustment)`, `SupplierPayment(+Allocation)` are
>   documented in §4.48–4.62 below (added 2026-09-19). These **replace** the
>   pre-redo Phase 1 models (`SupplierItem`, `PurchaseOrder(+Line)`,
>   `PrepRecipe(+Line)`, `PrepRecord(+Line)`, `StockCount(+Line)`, `WasteLog`,
>   `ParLevel`) named in earlier copies of this note — those models no longer
>   exist; do not reference them. `Location` (unchanged by the redo) is not yet
>   documented here.
> - **Inventory Milestone Three (Prep), shipped and live in production
>   (2026-09-21):** `PrepRun(+InputLine)` are net-new models, not yet
>   documented in this file — see `docs/API_CONTRACT.md` §23 and
>   `backend/prisma/schema.prisma` in the meantime.
> - **Inventory Milestone Four (Requisition & Branch Approval), Session A
>   underway (2026-09-21):** `Category.parentCategoryId` and
>   `Requisition`/`RequisitionSection`/`RequisitionLine` are documented in
>   §4.63–4.65 below. **The pre-redo Phase 2 `requisitions`/
>   `requisition_lines`/`dispatches` tables no longer exist** — they were
>   dropped by the Milestone One catalog migration
>   (`20260915065051_inventory_milestone_one_catalog`); this correction
>   replaces the previous (stale) claim that they still exist. Session B
>   (branch-manager approve/return/edit) and Milestones 5–6 (Dispatch/Branch
>   Receiving, Counting/Closing) are not yet built — see
>   `docs/features/inventory/MILESTONES.md`.
> - **Inventory Milestone Five (Dispatch & Branch Receiving), shipped
>   2026-09-22:** `Dispatch`, `DispatchLine`, `Discrepancy` are documented in
>   §4.66–4.68 (backfilled 2026-09-25).
> - **Inventory Milestone Six (Counting, Closing & Discrepancies), Session 1
>   (2026-09-25):** `WasteLog` is §4.69; `InventoryTransaction` gained
>   `reference` / `reversesTransactionId` and a real `wasteLogId` FK (§4.52).
>   Session 2 added `StockCount*` and `CountingThresholds` (§4.70–4.72);
>   Session 3 (2026-09-30) added `BranchDay`, `BranchDayDepartment`,
>   `BranchDayLine`, `BranchDayReopen` (§4.73–4.76) and
>   `InventoryTransaction.branchDayLineId` (§4.52). Session 4 adds
>   `DepartmentOpening*`.
> - **Order/menu/staff core:** additions from Phases 10–12 (guest split,
>   cancellation approval, order correction) and the department-head marker are
>   not reflected in §4.13–4.15 / §4.3.

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
   - [OrderCancellationRequest](#413a-ordercancellationrequest)
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
   - [ContractType](#444-contracttype)
   - [LeavePolicy](#445-leavepolicy)
   - [LeaveRequestAcknowledgement](#446-leaverequestacknowledgement)
   - [Payslip](#447-payslip)
   - [Category (Inventory)](#448-category)
   - [InventoryItem](#449-inventoryitem)
   - [Supplier](#450-supplier)
   - [RestockLevel](#451-restocklevel)
   - [InventoryTransaction](#452-inventorytransaction)
   - [ReferenceCounter](#453-referencecounter)
   - [ExpectedDelivery](#454-expecteddelivery)
   - [ExpectedDeliveryLine](#455-expecteddeliveryline)
   - [GoodsReceipt](#456-goodsreceipt)
   - [GoodsReceiptLine](#457-goodsreceiptline)
   - [SupplierInvoice](#458-supplierinvoice)
   - [SupplierInvoiceReceipt](#459-supplierinvoicereceipt)
   - [SupplierInvoiceAdjustment](#460-supplierinvoiceadjustment)
   - [SupplierPayment](#461-supplierpayment)
   - [SupplierPaymentAllocation](#462-supplierpaymentallocation)
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
| `OrderCancellationRequest` | Approval request created when a waiter asks to cancel an active order. |
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
| `StaffDiscountAuthRequest` | Authorization request for a 20% staff discount on a waiter's own order. |
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
│   ├── OrderCancellationRequest (if waiter cancellation needs approval)
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

> **Renamed in code (Oct 2026): this is now the `Site` model, with `siteId` fields.**
> A Site is a branch or the Central Store (`type`: `BRANCH` | `CENTRAL_STORE`) and belongs to a
> `Company` (`companyId`; one row today, "Wendo Coffee Bistro"). The database did **not** change:
> the table is still `organizations` and every column is still `organization_id`, via
> `@@map` / `@map` in the schema. `isHub` and its one-Central-Store unique index are unchanged.
> The SQL examples and the `Organization` model below show the original shape; read
> `Organization` as `Site` and `organizationId` as `siteId` in code. The API, socket events and the
> login token still use the `organization*` names (see `API_CONTRACT.md`).

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

  splitPaymentLines SplitPaymentLine[]
  cancellationRequests OrderCancellationRequest[]

  @@unique([organizationId, dailyNumber, orderDate])
  @@index([organizationId])
  @@index([organizationId, status])
  @@index([organizationId, orderDate])
  @@index([createdById])
  @@map("orders")
}

model SplitPaymentLine {
  -- One record per guest for GUEST_SPLIT orders.
  -- Written immediately when the waiter confirms each guest's payment.
  -- Deleted and re-added if the waiter corrects an entry before closing.

  id        String        @id @default(uuid())
  orderId   String        @map("order_id")
  label     String                             -- "Guest 1", "Guest 2", etc.
  amount    Decimal       @db.Decimal(10, 2)
  method    PaymentMethod                      -- MPESA | CASH | CARD only
  mpesaCode String?       @map("mpesa_code")
  paidAt    DateTime      @default(now()) @map("paid_at")
  createdAt DateTime      @default(now()) @map("created_at")

  order     Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@map("split_payment_lines")
}
```

**Notes:**
- `dailyNumber` + `orderDate` + `organizationId` form the human-readable order reference. The `@@unique` constraint prevents duplicates.
- `subtotal`, `deliveryFee`, and `total` are denormalised (stored, not computed). This is intentional — it creates an immutable financial record; past totals survive future price changes.
- **Split payment fields** (`mpesaAmount`, `cashAmount`, `cardAmount`, `splitType`) are only populated when `paymentMethod = SPLIT`.
- **Credit account fields** — at most one of `houseAccountId`, `corporateAccountId`, `customerCreditAccountId` is set per order.
- **Discount fields** — `discountedById` (non-null) indicates a staff discount; `discountId` (non-null) indicates a named customer discount. They are mutually exclusive and also mutually exclusive with credit payment methods.
- `status = AWAITING_AUTHORIZATION` is set when either a House Account payment, staff discount, or approval-required customer discount is pending manager/director approval.
- `status = AWAITING_CANCELLATION_APPROVAL` is set when a waiter cancellation request is pending. The matching `OrderCancellationRequest.previousStatus` restores the order if the request is rejected.
- `closedAt` provides a clean timestamp for reporting (time from submission to closure).

---

### 4.13a OrderCancellationRequest

Approval record created when a waiter requests order cancellation. This is separate from House Account and discount authorization because cancellation is an operational control, not a payment or discount approval.

```prisma
model OrderCancellationRequest {
  id             String                    @id @default(uuid())
  organizationId String                    @map("organization_id")
  orderId        String                    @map("order_id")
  requestedById  String                    @map("requested_by_id")
  reason         String
  reasonDetail   String?                   @map("reason_detail")
  previousStatus OrderStatus               @map("previous_status")
  status         CancellationRequestStatus @default(PENDING)
  resolvedById   String?                   @map("resolved_by_id")
  resolvedAt     DateTime?                 @map("resolved_at")
  resolutionNote String?                   @map("resolution_note")
  createdAt      DateTime                  @default(now()) @map("created_at")
  updatedAt      DateTime                  @updatedAt @map("updated_at")

  order       Order @relation(fields: [orderId], references: [id])
  requestedBy User  @relation("OrderCancellationRequestedBy", fields: [requestedById], references: [id])
  resolvedBy  User? @relation("OrderCancellationResolvedBy", fields: [resolvedById], references: [id])

  @@index([organizationId])
  @@index([orderId])
  @@index([requestedById])
  @@index([status])
  @@map("order_cancellation_requests")
}
```

**Notes:**
- `previousStatus` is required so rejection restores the order to `PENDING`, `IN_PROGRESS`, or `READY` exactly as it was before the request.
- Only one pending cancellation request may exist per order. Enforce this with a partial unique migration index on `order_id WHERE status = 'PENDING'` plus service-level conflict handling.
- The Prisma schema must include inverse relation arrays on `Order` and `User` for `OrderCancellationRequest`.
- On approval: the order becomes `CANCELLED`, cancellation fields are written to `Order`, and an `ORDER_CANCELLED` incident is logged.
- On rejection: the order returns to `previousStatus`; the rejected request remains as permanent audit history.

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

Created when a waiter applies a 20% staff discount to their own order, requiring manager approval.

```prisma
model StaffDiscountAuthRequest {
  id              String                  @id @default(uuid())
  organizationId  String                  @map("organization_id")
  orderId         String                  @map("order_id")
  requestedById   String                  @map("requested_by_id")  -- the waiter
  discountPercent Decimal                 @db.Decimal(5, 2) @map("discount_percent")  -- always 20.00
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

### 4.44 ContractType

Named employment contract template (e.g. "Permanent", "6-Month Fixed Term").
Owns a set of `LeavePolicy` rows that determine leave entitlements for any
`EmployeeProfile` assigned this contract type. Added in the HR Profile Overhaul.

```prisma
model ContractType {
  id             String   @id @default(uuid())
  organizationId String?  @map("organization_id")  -- null = system-wide template
  name           String
  durationMonths Int?     @map("duration_months")  -- null = open-ended
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization     Organization?     @relation(fields: [organizationId], references: [id])
  leavePolicies    LeavePolicy[]
  employeeProfiles EmployeeProfile[]

  @@index([organizationId])
  @@map("contract_types")
}
```

**Notes:**
- `EmployeeProfile.contractTypeId` links a staff member to their contract type.
- When a profile is assigned a contract type, `LeaveBalance` rows are seeded from
  the contract type's `LeavePolicy` entries.

---

### 4.45 LeavePolicy

One leave entitlement line for a contract type: how many days of a given
`LeaveType` that contract grants per year.

```prisma
model LeavePolicy {
  id             String    @id @default(uuid())
  contractTypeId String    @map("contract_type_id")
  leaveType      LeaveType @map("leave_type")
  totalDays      Int       @map("total_days")

  contractType ContractType @relation(fields: [contractTypeId], references: [id], onDelete: Cascade)

  @@unique([contractTypeId, leaveType])
  @@map("leave_policies")
}
```

**Notes:**
- `@@unique([contractTypeId, leaveType])` — one policy per leave type per contract.
- Drives `LeaveBalance.totalDays` at profile assignment / year rollover.

---

### 4.46 LeaveRequestAcknowledgement

Records that a specific user (e.g. a manager or affected colleague) has
acknowledged a leave request. Many acknowledgements per request.

```prisma
model LeaveRequestAcknowledgement {
  id             String   @id @default(uuid())
  leaveRequestId String   @map("leave_request_id")
  userId         String   @map("user_id")
  acknowledgedAt DateTime @default(now()) @map("acknowledged_at")

  leaveRequest LeaveRequest @relation(fields: [leaveRequestId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id])

  @@unique([leaveRequestId, userId])
  @@index([userId])
  @@map("leave_request_acknowledgements")
}
```

---

### 4.47 Payslip

A generated payslip for one staff member for one pay period. Kenya statutory
deductions (PAYE, SHA, NSSF tier 1 & 2, housing levy, HELB) are stored as
explicit columns; ad-hoc deductions go in `otherDeductions` JSON. Added in the
Payslip phase; viewing is gated (see `usePayslipGate`).

```prisma
model Payslip {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")
  userId          String   @map("user_id")
  payPeriod       String   @map("pay_period")   -- e.g. "2026-08"
  payDate         DateTime @map("pay_date")
  grossPay        Decimal  @map("gross_pay") @db.Decimal(10, 2)
  paye            Decimal  @db.Decimal(10, 2)
  sha             Decimal  @db.Decimal(10, 2)
  nssfTier1       Decimal  @map("nssf_tier1") @db.Decimal(10, 2)
  nssfTier2       Decimal  @map("nssf_tier2") @db.Decimal(10, 2)
  housingLevy     Decimal  @map("housing_levy") @db.Decimal(10, 2)
  helb            Decimal? @db.Decimal(10, 2)
  advance         Decimal? @db.Decimal(10, 2)
  incentives      Decimal? @db.Decimal(10, 2)
  overtime        Decimal? @db.Decimal(10, 2)
  allowances      Decimal? @db.Decimal(10, 2)
  otherDeductions Json?    @map("other_deductions")
  totalDeductions Decimal  @map("total_deductions") @db.Decimal(10, 2)
  netPay          Decimal  @map("net_pay") @db.Decimal(10, 2)
  isLocked        Boolean  @default(false) @map("is_locked")
  createdById     String   @map("created_by_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation("StaffPayslips", fields: [userId], references: [id])
  createdBy    User         @relation("PayslipsCreated", fields: [createdById], references: [id])

  @@unique([organizationId, userId, payPeriod])
  @@index([organizationId, payPeriod])
  @@index([userId])
  @@map("payslips")
}
```

**Notes:**
- `@@unique([organizationId, userId, payPeriod])` — one payslip per person per period.
- `isLocked` — once locked, the payslip is immutable (finalised for payment).
- `otherDeductions` JSON shape: `[{ label: string, amount: number }]`.

---

### 4.48 Category

Item catalog categories (Milestone One, 2026-09-15). Distinct from the
system-level `MenuCategory` (§4.6) — this is a per-organization grouping for
inventory items and suppliers, not menu routing.

**One level of self-referencing nesting (added for Milestone Four,
2026-09-21).** The client's real Kitchen stock sheet groups items two levels
deep — e.g. "Prep Kitchen Items" (a type-level grouping) containing "Chicken,"
"Beef," "Pork," "Fish" (a protein-base grouping), each holding several
distinct prepped items ("Chicken Biryani," "Beef Biryani," etc. are separate
`InventoryItem` rows, distinguished by which category — Chicken vs. Beef —
they belong to). Every other department's sheet (Barista, Service,
Housekeeping, Pastry) is a flat list with no grouping at all. `parentCategoryId`
is nullable and optional per category — Kitchen sets it where it has a real
parent/child grouping to express; every other department's categories (or lack
of categories) are unaffected and keep working exactly as before this change.

```prisma
model Category {
  id               String    @id @default(uuid())
  organizationId   String    @map("organization_id")
  name             String
  parentCategoryId String?   @map("parent_category_id")   -- NEW, Milestone Four: optional, one level only
  deletedAt        DateTime? @map("deleted_at")   -- retire; never hard-delete
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  @@index([organizationId])
  @@map("categories")
}
```

**Notes:**
- Case-insensitive uniqueness among *live* categories only, enforced by a partial unique index on `lower(name) WHERE deleted_at IS NULL` (raw SQL — not expressible in the Prisma DSL). A retired "Seasonal" must not block creating a new "Seasonal".
- Shared by both `InventoryItem` and `Supplier` (a supplier's category and an item's category are the same lookup table).
- **`parentCategoryId` is one level only** — a category with a parent must not itself be set as another category's parent (enforced at the service layer, not the DB). This matches every real grouping seen in the reference paper sheets; a deeper hierarchy has no known use case yet and would add UI complexity (e.g. recursive category pickers) for nothing.
- An `InventoryItem` still references exactly **one** category (`categoryId`, unchanged) — e.g. "Chicken Biryani" → category "Chicken." The parent link lets the UI and reports roll up to "Prep Kitchen Items" without needing a second field on the item itself.
- **Migration is additive only** — every existing category row gets `parentCategoryId: null`. No behavior change to Milestone One's catalog/category screens, Milestone Two's receiving, or Milestone Three's prep, none of which read or filter by parent. See `docs/features/inventory/MILESTONES.md` for the Milestone One "Manage categories" UI addition (parent picker) deferred to a Milestone Four build session.

---

### 4.49 InventoryItem

The item catalog (Milestone One). Every raw ingredient, stocked item, and
prepped item Wendo tracks — supersedes the pre-redo `SupplierItem`/`ParLevel`
combination named in the staleness note above.

```prisma
model InventoryItem {
  id                  String            @id @default(uuid())
  organizationId      String            @map("organization_id")
  name                String
  type                InventoryItemType                      -- RAW_INGREDIENT, STOCKED, PREPPED
  categoryId          String?           @map("category_id")
  preferredSupplierId String?           @map("preferred_supplier_id")

  buyUnit          String   @map("buy_unit")                 -- free text: bag, crate, jerrican, ctn
  usageUnit        String   @map("usage_unit")                -- free text: kg, L, ml, pcs
  conversionFactor Decimal? @map("conversion_factor") @db.Decimal(12, 4)  -- null = "no conversion"
  packSize         Decimal? @map("pack_size") @db.Decimal(12, 4)          -- null = "—"

  departmentTags DepartmentTag[] @map("department_tags")      -- MUST be [] when type = RAW_INGREDIENT
  currentCost    Decimal         @default(0) @map("current_cost") @db.Decimal(12, 4)
  daysOfCover    Decimal?        @map("days_of_cover") @db.Decimal(6, 2)   -- days the suggested restock level covers; null = the default of 15

  deletedAt DateTime? @map("deleted_at")   -- retire; history preserved
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([categoryId])
  @@index([organizationId, deletedAt])     -- the catalog list's default filter
  @@map("inventory_items")
}
```

**Notes:**
- **`currentCost` is written only by receiving, never edited directly.** **`currentCost` is always per USAGE unit** (KES 480 / kg), never per buy unit: signing a `GoodsReceipt` sets it to that line's `unitPrice` (entered per *buy* unit) divided by the conversion factor (`unitPrice ÷ conversionFactor`, 4dp; factor 1 when the item has none). The RECEIVE ledger row's `unitCost` is the same per-usage-unit figure, so `quantity × unitCost` is always the value of the stock received. This is **latest-price costing**, an owner-confirmed design (not weighted average): buy at 250, cost is 250; buy again at 280, cost is 280 from that moment on. There is deliberately no separate "set buying price" field on this model or its form.
- `buyUnit`/`usageUnit`/`conversionFactor` is the unit-conversion model: purchase in `buyUnit` (e.g. a `ctn (12x2kg)`), stock and consume in `usageUnit` (e.g. `kg`), converted by `conversionFactor`.
- `departmentTags` — which departments (besides the Central Store) also stock this item; a check constraint enforces it stays empty for `RAW_INGREDIENT` (raw ingredients live at the Central Store only).
- Soft-deleted items ("retired") keep their history; a retired item cannot be selected on a new purchase or receipt but still appears in past records.

---

### 4.50 Supplier

Suppliers Wendo buys from (Milestone One + Two; expanded 2026-09-30 — see
`docs/features/inventory/suppliers-plan.md`). Central Store hub-org scoping
(D-15, `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md`) applies: suppliers
live on the hub Organization only.

```prisma
model Supplier {
  id                  String               @id @default(uuid())
  organizationId      String               @map("organization_id")
  code                String                                         -- SUPPLIER-0001; ReferenceCounter prefix SUPPLIER, pad 4; never reused, never edited
  name                String
  tradingName         String?              @map("trading_name")
  status              SupplierStatus       @default(ACTIVE)          -- ACTIVE | ON_HOLD | ARCHIVED
  type                SupplierType         @default(REGULAR)         -- REGULAR | OCCASIONAL | ONE_OFF | MARKET
  categoryId          String?              @map("category_id")
  kraPin              String?              @map("kra_pin")
  vatRegistered       Boolean              @default(false) @map("vat_registered")
  notes               String?
  address             String                                         -- required free text ("—" when unknown); replaces `location`
  mapUrl              String?              @map("map_url")
  defaultPaymentTerms SupplierPaymentTerms @default(INVOICE_TO_FOLLOW) @map("default_payment_terms")
  paymentDays         Int                  @default(30) @map("payment_days")
  creditLimit         Decimal?             @map("credit_limit") @db.Decimal(12, 2)
  createdById         String?              @map("created_by_id")
  updatedById         String?              @map("updated_by_id")

  deletedAt DateTime? @map("deleted_at")                            -- mirrors status = ARCHIVED (legacy `retiredAt`)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  @@unique([organizationId, code])
  @@index([organizationId])
  @@index([organizationId, deletedAt])
  @@index([organizationId, status])
  @@map("suppliers")
}
```

**Notes:**
- **Removed columns** (migration `20260930120000_suppliers_expansion`): `contact_name`, `phone`, `email` moved into one primary `SupplierContact`; `location` became `address`. The API still serves `contactName` / `phone` / `email` / `location` as **deprecated derived keys** (see API_CONTRACT §27).
- `status` ↔ `deletedAt`: setting `ARCHIVED` sets `deletedAt`; any other status clears it. Existing Milestone One partial unique index `suppliers_org_name_live_key` (`organization_id, lower(name)` WHERE `deleted_at IS NULL`) is **kept**, so two live suppliers cannot share an exact name (case-insensitive).
- `defaultPaymentTerms` is only ever a *default* — the actual terms for a given purchase/receipt live on `ExpectedDelivery`/`GoodsReceipt` and can be overridden per document (e.g. a normally on-account supplier marked `PAY_NOW` for a one-off cash run).
- `paymentDays` (added Milestone Two, 2026-09-16) is what makes an invoice overdue — `defaultPaymentTerms` says only *whether* a supplier bills on account, never *when* it's due. Defaults to 30 for existing rows.
- **Migration backfill** (dev DBs only; production had 0 rows): codes assigned per organization in `created_at` order and the `SUPPLIER` counter set to the row count; `location` → `address` (empty → "—"); old contact fields → one primary contact (name falls back to the business name); retired rows → `ARCHIVED`; status `ACTIVE` and type `REGULAR` otherwise; `InventoryItem.preferredSupplierId` back-filled into `SupplierItem.isPreferred`.

---

### 4.51 RestockLevel

Replaces the pre-redo `ParLevel`. One row per (location, item) — the
low-stock threshold that drives the "Low stock only" filter and dashboard
alerts.

```prisma
model RestockLevel {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")
  locationId      String   @map("location_id")
  inventoryItemId String   @map("inventory_item_id")
  level           Decimal  @map("level") @db.Decimal(12, 4)   -- in the item's usage unit
  setById         String   @map("set_by_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([locationId, inventoryItemId])
  @@index([organizationId])
  @@index([inventoryItemId])
  @@map("restock_levels")
}
```

**Notes:**
- Set by whoever owns the stock: the Store Manager for the Central Store, each department head for their own department's items.
- `@@unique([locationId, inventoryItemId])` — a location can only have one restock level per item.
- Every change is also appended to `RestockLevelChange` (§4.51a). The Store Manager may set any branch department's levels (API_CONTRACT §29.2).

### 4.51a RestockLevelChange

Append-only log of restock-level changes (Session 3, B10): who changed which location's level for which item, from what to what. Written in the same transaction as the `RestockLevel` upsert/delete; a save that changes nothing writes nothing.

```prisma
model RestockLevelChange {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")   -- the location's org, like restock_levels
  locationId      String   @map("location_id")       -- "for whom": a branch department or the Central Store
  inventoryItemId String   @map("inventory_item_id")
  oldLevel        Decimal? @map("old_level") @db.Decimal(12, 4)  -- null = no level before
  newLevel        Decimal? @map("new_level") @db.Decimal(12, 4)  -- null = level cleared
  changedById     String   @map("changed_by_id")     -- "who"
  reason          String?
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([locationId, inventoryItemId, createdAt])
  @@index([organizationId])
  @@map("restock_level_changes")
}
```

Read back by `GET /inventory/restock-levels/history`; "Put back" restores a row's `oldLevel` by writing a **new** row through the same save path (the old row stays). API_CONTRACT.md §30.5.

### 4.51b InventoryItemChange

Append-only history of what happened to a catalog item (Session 4b): created, edited, retired, restored, a supplier added, a price set by hand. Written in the same transaction as the change; an edit that changes nothing the history tracks writes nothing. `summary` is a sentence **without the actor** ("changed the pack from 1 bag = 25 kg to 1 bag = 24 kg"); the screen shows `"{changedBy.name} {summary}"`. `before` / `after` hold only the fields that changed. `reason` is optional everywhere and never required. API_CONTRACT.md §30.4.

```prisma
enum InventoryItemChangeKind { CREATED UPDATED RETIRED RESTORED SUPPLIER_ADDED SUPPLIER_PRICE_SET }

model InventoryItemChange {
  id              String                  @id @default(uuid())
  organizationId  String                  @map("organization_id")   -- the hub org (the catalog's)
  inventoryItemId String                  @map("inventory_item_id")
  kind            InventoryItemChangeKind
  summary         String
  before          Json?
  after           Json?
  reason          String?
  changedById     String                  @map("changed_by_id")     -- "who"; for CREATED this is the creator ("added by an attendant")
  createdAt       DateTime                @default(now()) @map("created_at")

  @@index([organizationId, inventoryItemId, createdAt])
  @@index([organizationId, kind, createdAt])
  @@map("inventory_item_changes")
}
```

Items made before this table existed have no `CREATED` row; they count as not added by an attendant.

---

### 4.52 InventoryTransaction

The append-only stock ledger. **Stock on hand is always derived from this
table, never a stored counter** — every movement (receive, prep, waste,
adjustment, dispatch, sale) is a row here with location, item, quantity,
cost, user, and timestamp.

```prisma
model InventoryTransaction {
  id                   String                   @id @default(uuid())
  organizationId       String                   @map("organization_id")
  locationId           String                   @map("location_id")
  inventoryItemId      String                   @map("inventory_item_id")
  type                 InventoryTransactionType
  quantity             Decimal                  @db.Decimal(12, 4)
  unitCost             Decimal                  @map("unit_cost") @db.Decimal(12, 4)
  reason               String?
  goodsReceiptLineId   String?                  @map("goods_receipt_line_id")
  prepRecordId         String?                  @map("prep_record_id")          -- FK → PrepRun (Milestone Three)
  wasteLogId           String?                  @map("waste_log_id")            -- FK → WasteLog (Milestone Six S1, §4.69)
  stockCountLineId     String?                  @map("stock_count_line_id")     -- real FK (Milestone Six S2)
  branchDayLineId      String?                  @map("branch_day_line_id")      -- real FK (Milestone Six S3): a branch day close adjustment or its reversal
  dispatchLineId       String?                  @map("dispatch_line_id")        -- FK → DispatchLine (Milestone Five, §4.67)
  marketPurchaseLineId String?                  @map("market_purchase_line_id") -- unlinked; not yet redone
  reference            String?                  -- ADJ-#### on ADJUSTMENT rows (Milestone Six; first written in S2)
  reversesTransactionId String?                 @unique @map("reverses_transaction_id") -- self-FK; equal-and-opposite reversal (Flow 12b; first written in S3)
  userId               String                   @map("user_id")
  createdAt            DateTime                 @default(now()) @map("created_at")

  @@index([organizationId])
  @@index([locationId])
  @@index([inventoryItemId])
  @@index([type])
  @@index([goodsReceiptLineId])
  @@index([prepRecordId])
  @@index([dispatchLineId])
  @@index([wasteLogId])
  @@index([locationId, inventoryItemId, createdAt])   -- the stock ledger drill
  @@map("inventory_transactions")
}
```

**Notes:**
- **Costing is latest-price, not weighted average** [OWNER decision]. A movement is costed at whatever `InventoryItem.currentCost` was in force *when it happened* — a dispatch that left Tuesday keeps Tuesday's cost forever, even after a Thursday price rise. This is a deliberate trade-off: latest-price costing revalues stock already on hand (holding 40 units bought at 250 and receiving 10 more at 280 values all 50 at 280), which weighted-average costing would prevent, but Wendo's stock turns over in days so the distortion is accepted as small and short-lived, and is explicitly the Accountant's reporting problem, not the store's.
- The line-reference columns were retained as unlinked nullable columns when Milestone One redid this table, and each is restored as a real FK when the milestone that rebuilds that flow lands: `goodsReceiptLineId` (Milestone Two), `prepRecordId` (Three), `dispatchLineId` (Five), `wasteLogId` (Six, Session 1). `stockCountLineId` (Six, Session 2); `branchDayLineId` (Six, Session 3); `marketPurchaseLineId` is still unlinked. Do not restructure this column set.
- **Sign convention:** inbound rows are positive (`RECEIVE`, `PREP_PRODUCE`, `DISPATCH_IN`), outbound rows negative (`PREP_CONSUME`, `DISPATCH_OUT`, `WASTE`); `ADJUSTMENT` carries its own sign. On-hand at a location is a plain `SUM(quantity)`.
- The Milestone Six ledger view's running balance is a SQL window (`SUM(quantity) OVER (ORDER BY created_at, id)`) over the item's whole ledger at that location; its "counterparty" text is derived from whichever FK is set — there is no free-text counterparty column.
- `goodsReceiptLineId` (formerly `purchaseOrderLineId`) was the first of these restored — Milestone Two's `GoodsReceipt` signing is the first writer to this ledger since the redo began.
- `InventoryTransactionType` ships its full enum now (§5) even though `MARKET_RECEIVE` and `SALE` are not yet written by anything.

---

### 4.53 ReferenceCounter

Milestone Two. Gap-free reference-number counters (`GRN-`, `EXP-`, …), one
row per (organization, prefix).

```prisma
model ReferenceCounter {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  prefix         String                              -- "GRN", "EXP"
  lastNumber     Int      @default(0) @map("last_number")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([organizationId, prefix])
  @@index([organizationId])
  @@map("reference_counters")
}
```

**Notes:**
- Incremented inside the same database transaction as the document it numbers, so numbers stay gap-free — a printed, signed document with a missing number would look like a lost record with no way to prove otherwise.
- Same pattern as the older `OrderCounter` (§4.2), generalized across document types instead of reset per day.

---

### 4.54 ExpectedDelivery

Milestone Two, Stage 1 (Buying) — an *estimate*, explicitly **not** a
purchase order (purchase orders were removed entirely from this feature's
redo). Writes no ledger entry; only a signed `GoodsReceipt` ever moves stock.

```prisma
model ExpectedDelivery {
  id             String                 @id @default(uuid())
  organizationId String                 @map("organization_id")
  reference      String                                          -- "EXP-0091", via ReferenceCounter
  supplierId     String?                @map("supplier_id")      -- nullable: a pure shopping list may have none
  paymentTerms   SupplierPaymentTerms?  @map("payment_terms")    -- defaulted from supplier; null when supplierId is null
  status         ExpectedDeliveryStatus @default(AWAITING)
  expectedDate   DateTime?              @map("expected_date")
  estimatedTotal Decimal                @default(0) @map("estimated_total") @db.Decimal(12, 2)
  createdById    String                 @map("created_by_id")
  createdAt      DateTime               @default(now()) @map("created_at")
  updatedAt      DateTime               @updatedAt @map("updated_at")

  @@unique([organizationId, reference])
  @@index([organizationId, status])
  @@index([supplierId])
  @@map("expected_deliveries")
}
```

**Notes:**
- `supplierId`/`paymentTerms` nullable in lockstep (amendment 2026-09-17) — a purchase list may be saved with no supplier at all. Payment terms are meaningless without a supplier to owe them to, and the New Purchase screen greys the terms toggle out until a supplier is picked (this is intentional design, not a bug — see `docs/features/inventory/02-flows.md` Flow 1).
- `estimatedTotal` is **stored, not derived** — an estimate that never needs to reconcile with anything (the eventual receipt supersedes it), so storing it avoids a per-row line aggregation on the Purchasing hub's hottest query.
- A `FULFILLED` row's real history is told by its resulting `GoodsReceipt` — the Purchasing History band excludes `FULFILLED` deliveries by default to avoid showing the same event twice (fixed 2026-09-18; see `docs/features/inventory/milestone-2-plan.md` §5 S9 row).
- A Store Manager may skip this model entirely and go straight to a `GoodsReceipt` — this record is a convenience for tracking what's coming, never a prerequisite for receiving.

---

### 4.55 ExpectedDeliveryLine

```prisma
model ExpectedDeliveryLine {
  id                 String  @id @default(uuid())
  expectedDeliveryId String  @map("expected_delivery_id")
  inventoryItemId    String  @map("inventory_item_id")
  quantity           Decimal @db.Decimal(12, 4)                        -- in the item's BUY unit
  estimatedUnitPrice Decimal @map("estimated_unit_price") @db.Decimal(12, 4)
  lineOrder          Int     @map("line_order")

  @@index([expectedDeliveryId])
  @@index([inventoryItemId])
  @@map("expected_delivery_lines")
}
```

**Notes:**
- Cascade-deletes with its parent `ExpectedDelivery`.
- `estimatedUnitPrice` is a per-*buy*-unit price; it pre-fills from the item's `currentCost` × `conversionFactor` (since `currentCost` is per usage unit) as a reference, but is editable — it's an estimate, not what was actually paid (that's recorded separately on the `GoodsReceiptLine`).

---

### 4.56 GoodsReceipt

Milestone Two, Stage 2 (Receiving) — **every item entering the company lands
here first; there is no other inbound path.** The first (and currently only)
writer to `InventoryTransaction` since the redo began.

```prisma
model GoodsReceipt {
  id                 String               @id @default(uuid())
  organizationId     String               @map("organization_id")
  reference          String                                     -- "GRN-1042", via ReferenceCounter
  supplierId         String               @map("supplier_id")
  expectedDeliveryId String?              @map("expected_delivery_id")   -- nullable: receiving without an estimate is allowed
  paymentTerms       SupplierPaymentTerms @map("payment_terms")   -- defaulted from supplier, editable per receipt
  status             GoodsReceiptStatus   @default(DRAFT)
  supplierDocNumber  String?              @map("supplier_doc_number")    -- "INVOICE / DELIVERY NOTE No."
  supplierDocDate    DateTime?            @map("supplier_doc_date")
  receiptTotal       Decimal              @default(0) @map("receipt_total") @db.Decimal(12, 2)   -- snapshot at signing, immutable
  locationId         String               @map("location_id")            -- the CENTRAL_STORE location
  signedById         String?              @map("signed_by_id")
  signedAt           DateTime?            @map("signed_at")
  createdById        String               @map("created_by_id")
  createdAt          DateTime             @default(now()) @map("created_at")
  updatedAt          DateTime             @updatedAt @map("updated_at")

  @@unique([organizationId, reference])
  @@index([organizationId, status])
  @@index([supplierId])
  @@index([expectedDeliveryId])
  @@map("goods_receipts")
}
```

**Notes:**
- `status` — `DRAFT` holds an unsigned receipt with no ledger rows written yet; `RECEIVED_INVOICE_PENDING` vs `RECEIVED_PAID` is the payment-terms branch that decides whether AP is ever created; `INVOICE_RECORDED` is set once a `SupplierInvoice` is recorded against it.
- Signing is irreversible: it writes `InventoryTransaction` rows raising stock at the Central Store and sets `receiptTotal` as a permanent snapshot, even if item prices later change.
- **The receipt is never auto-converted into a supplier invoice.** This is deliberate, confirmed against standard AP/procurement practice: auto-generating the invoice from the receipt would eliminate the 3-way match (PO/estimate vs. receipt vs. supplier's actual invoice) that the mismatch-detection in Flow 2e / Flow 14 relies on. See `docs/features/inventory/milestone-2-plan.md` §5 S9 row.
- `expectedDeliveryId` nullable — a Store Manager can receive goods with no prior `ExpectedDelivery` record at all (an ad-hoc receipt).

---

### 4.57 GoodsReceiptLine

```prisma
model GoodsReceiptLine {
  id                     String   @id @default(uuid())
  goodsReceiptId         String   @map("goods_receipt_id")
  inventoryItemId        String   @map("inventory_item_id")
  quantityBuyUnit        Decimal  @map("quantity_buy_unit") @db.Decimal(12, 4)     -- as entered ("18.0 kg", "2 pkt")
  quantityUsageUnit      Decimal  @map("quantity_usage_unit") @db.Decimal(12, 4)   -- computed via conversionFactor; what hits the ledger
  unitPrice              Decimal  @map("unit_price") @db.Decimal(12, 4)           -- per BUY unit, as invoiced
  lineTotal              Decimal  @map("line_total") @db.Decimal(12, 2)
  lineOrder              Int      @map("line_order")
  priceAlertPct          Decimal? @map("price_alert_pct") @db.Decimal(6, 2)       -- null = no alert fired
  priceAlertPrevPrice    Decimal? @map("price_alert_prev_price") @db.Decimal(12, 4)
  priceAlertAcceptedById String?  @map("price_alert_accepted_by_id")
  packBuyUnit            String?  @map("pack_buy_unit")                           -- the pack bought in; null = not stated (2026-10-02)
  packSize               Decimal? @map("pack_size") @db.Decimal(12, 4)
  packNotOnFile          Boolean  @default(false) @map("pack_not_on_file")        -- stamped at signing: no supplier catalog line matched, no price written

  @@index([goodsReceiptId])
  @@index([inventoryItemId])
  @@map("goods_receipt_lines")
}
```

**Notes:**
- `priceAlertPct`/`priceAlertPrevPrice` are a **persisted snapshot, never recomputed** — by the time a signed receipt is read back, latest-price costing has already overwritten `InventoryItem.currentCost`, so the price this line was compared against at entry time would otherwise be lost.
- A price-change alert does not block signing — it only requires the receiving user to acknowledge it (`priceAlertAcceptedById`) before "Sign & save" enables. On save, the entered price becomes the item's current cost regardless (latest-price costing).
- `packBuyUnit` / `packSize` / `packNotOnFile` (migration `receipt_line_pack_and_preferred_audit`): the supplier catalog price follows the pack (API_CONTRACT §28.4). No matching `SupplierItem` line = no catalog price written and `packNotOnFile = true`; stock and `currentCost` still post.
- `unitPrice` is per **buy** unit. On sign, `unitPrice ÷ conversionFactor` (per **usage** unit) becomes `InventoryItem.currentCost` for that item — the only path by which the catalog's cost figure changes.

---

### 4.58 SupplierInvoice

Milestone Two, Stage 10 (Supplier payment) — a running tab per supplier.
Recorded as a genuinely separate step from the `GoodsReceipt` (never
auto-generated from it — see §4.56's notes) so it can be checked against
what was actually received.

```prisma
model SupplierInvoice {
  id               String                @id @default(uuid())
  organizationId   String                @map("organization_id")
  supplierId       String                @map("supplier_id")
  invoiceNumber    String                @map("invoice_number")     -- the supplier's own document number
  invoiceDate      DateTime              @map("invoice_date")
  dueDate          DateTime              @map("due_date")           -- computed once at creation, then stored
  amountBilled     Decimal               @map("amount_billed") @db.Decimal(12, 2)   -- as stated on their document
  status           SupplierInvoiceStatus @default(UNPAID)
  disputeStatus    DisputeStatus?        @map("dispute_status")
  disputeOurFigure Decimal?              @map("dispute_our_figure") @db.Decimal(12, 2)
  disputeReason    String?               @map("dispute_reason")
  recordedById     String                @map("recorded_by_id")
  createdAt        DateTime              @default(now()) @map("created_at")
  updatedAt        DateTime              @updatedAt @map("updated_at")

  @@unique([organizationId, supplierId, invoiceNumber])
  @@index([organizationId, status])
  @@index([supplierId, dueDate])
  @@map("supplier_invoices")
}
```

**Notes:**
- `dueDate = invoiceDate + supplier.paymentDays`, computed **once at creation and then stored** — a later change to the supplier's payment terms must not retroactively shift the due date of an invoice already on the books.
- `status` (`UNPAID`/`PARTIALLY_PAID`/`PAID`) is derived at read/write time from `amountBilled + Σ SupplierInvoiceAdjustment.amount − Σ SupplierPaymentAllocation.amount`, never trusted as authoritative on its own — see `receiving-service.ts`'s `deriveInvoiceStatus`.
- `disputeStatus`/`disputeOurFigure`/`disputeReason` are deliberately **not folded into `status`** — a disputed invoice still ages and can still be paid, so dispute and payment status must be independently representable.
- If the supplier's billed amount doesn't match what the linked receipts total, the recording screen flags a mismatch and offers to record at the billed amount while opening a dispute (`disputeStatus = OPEN`) rather than silently accepting either figure.

---

### 4.59 SupplierInvoiceReceipt

Join table — an invoice can bundle many receipts (one delivery note commonly
covers several `GoodsReceipt`s from the same supplier).

```prisma
model SupplierInvoiceReceipt {
  supplierInvoiceId String @map("supplier_invoice_id")
  goodsReceiptId    String @map("goods_receipt_id")

  @@id([supplierInvoiceId, goodsReceiptId])
  @@index([goodsReceiptId])
  @@map("supplier_invoice_receipts")
}
```

---

### 4.60 SupplierInvoiceAdjustment

The Accountant's month-end reconciliation adjustment against a supplier
statement. Mandatory reason; changes the invoice's outstanding figure. Writes
no stock ledger entry — the Accountant cannot move stock.

```prisma
model SupplierInvoiceAdjustment {
  id                String   @id @default(uuid())
  supplierInvoiceId String   @map("supplier_invoice_id")
  amount            Decimal  @db.Decimal(12, 2)   -- can be negative — a correction either way
  reason            String
  recordedById      String   @map("recorded_by_id")
  createdAt         DateTime @default(now()) @map("created_at")

  @@index([supplierInvoiceId])
  @@map("supplier_invoice_adjustments")
}
```

---

### 4.61 SupplierPayment

Flow 15. **Payments are immutable once saved** — a correction is a reversal
(a new row with a negative allocation and a reason), never an edit or
delete of the original.

```prisma
model SupplierPayment {
  id             String                @id @default(uuid())
  organizationId String                @map("organization_id")
  supplierId     String                @map("supplier_id")
  amount         Decimal               @db.Decimal(12, 2)   -- may exceed the sum of allocations -> becomes a credit
  paidAt         DateTime              @map("paid_at")
  method         SupplierPaymentMethod                      -- BANK | CASH | MPESA | CHEQUE (CHEQUE added 2026-10-02; the API does not accept it as input until the cheque flow is built)
  reference      String?                                    -- "EFT-88213"
  reversalOfId   String?               @map("reversal_of_id")
  reversalReason String?               @map("reversal_reason")
  recordedById   String                @map("recorded_by_id")
  createdAt      DateTime              @default(now()) @map("created_at")

  @@index([organizationId, supplierId])
  @@map("supplier_payments")
}
```

**Notes:**
- **Overpayment is allowed, not an error** — if `amount` exceeds the sum of its allocations, the excess is never written to a stored balance; it's derived at read time as a supplier credit.
- `SupplierPaymentAllocation` (§4.62, below) determines how much of `amount` actually pays down each selected invoice — the payment amount and its allocations are independently recorded and can legitimately differ (e.g. a genuine partial payment across a single invoice: `amount` is the real cash paid, the allocation is capped at that same figure so the invoice's remaining balance is never silently written off). Fixed 2026-09-18 after this exact bug was found live — see `docs/features/inventory/milestone-2-plan.md` §5 S9 row.

---

### 4.62 SupplierPaymentAllocation

```prisma
model SupplierPaymentAllocation {
  id                String  @id @default(uuid())
  supplierPaymentId String  @map("supplier_payment_id")
  supplierInvoiceId String  @map("supplier_invoice_id")
  amount            Decimal @db.Decimal(12, 2)   -- negative allowed ONLY on a reversal payment's allocation

  @@unique([supplierPaymentId, supplierInvoiceId])
  @@index([supplierInvoiceId])
  @@map("supplier_payment_allocations")
}
```

**Notes:**
- A reversal payment's allocations mirror the original payment's allocations but negated — this is how a correction "un-pays" an invoice without ever mutating the original payment row.

---

### 4.63 Requisition

Milestone Four (Requisition & Branch Approval), Session A, 2026-09-21. A
requisition is one document per branch-day-slot with exactly five sections,
one per `DepartmentTag`, created together in a single transaction when a
department head opens it. This milestone never writes to
`InventoryTransaction` — the first requisition-domain milestone since Prep
that doesn't touch the ledger (Milestone 5, Dispatch, is where stock
actually moves).

```prisma
model Requisition {
  id             String            @id @default(uuid())
  organizationId String            @map("organization_id")   -- branch org, not the hub
  type           RequisitionType
  note           String?   -- optional free text, e.g. distinguishing two same-day AD_HOC requisitions
  status         RequisitionStatus @default(OPEN)
  openedById     String            @map("opened_by_id")
  openedAt       DateTime          @default(now()) @map("opened_at")
  approvedById   String?           @map("approved_by_id")   -- Session B
  approvedAt     DateTime?         @map("approved_at")   -- Session B

  @@index([organizationId, status])
  @@map("requisitions")
}
```

**Notes:**
- `type` is a fixed enum (`MORNING`/`AFTERNOON`/`EVENING`/`AD_HOC`), not free
  text — chosen for reporting consistency; `note` covers the rare "two
  AD_HOC requisitions same day" disambiguation case.
- No `locationId` — branch-scoped via `organizationId` directly (the branch
  org), same pattern as Milestone One/Two/Three's branch-vs-hub scoping.
  Sections are department-scoped via `RequisitionSection.departmentTag`, not
  `Location`.
- One signature covers the whole requisition (`approvedById`/`approvedAt` on
  this model, not per-section) — Session B's approval flow.
- `status` transitions `OPEN` → `PENDING_APPROVAL` (on the first section
  submitted) → `APPROVED` (Session B's PIN signature).

---

### 4.64 RequisitionSection

```prisma
model RequisitionSection {
  id            String                   @id @default(uuid())
  requisitionId String                   @map("requisition_id")
  departmentTag DepartmentTag            @map("department_tag")
  status        RequisitionSectionStatus @default(NOT_STARTED)
  submittedById String?                  @map("submitted_by_id")
  submittedAt   DateTime?                @map("submitted_at")
  returnedNote  String?                  @map("returned_note")   -- branch manager's reason, cleared on resubmit
  managerNote   String?                  @map("manager_note")    -- dept head's free-text note to the manager

  @@unique([requisitionId, departmentTag])
  @@map("requisition_sections")
}
```

**Notes:**
- Exactly 5 rows are created per `Requisition` at open time (one per
  `DepartmentTag`), never created individually later.
- `status` transitions: `NOT_STARTED` → `DRAFT` (first save) → `SUBMITTED`
  (Session A) → `RETURNED` (Session B's bounce-back, `returnedNote` set) →
  directly back to `SUBMITTED` on **resubmit** (`returnedNote` cleared
  server-side in the same write, not just hidden client-side — no
  intermediate `DRAFT` state on this path). `SUBMITTED` → `DRAFT` happens
  via **recall** (Session A, before approval) — a separate transition from
  resubmit, not a prerequisite for it.
- State-transition writes use the `updateMany` + count-check pattern
  (`receiving-repository.ts`'s `markSigned` precedent): `where` includes the
  expected current status; zero rows affected → the service throws
  `ConflictError`, never a silent partial state.

---

### 4.65 RequisitionLine

```prisma
model RequisitionLine {
  id                   String    @id @default(uuid())
  requisitionSectionId String    @map("requisition_section_id")
  inventoryItemId      String    @map("inventory_item_id")
  parAtRequest         Decimal?  @map("par_at_request") @db.Decimal(12, 4)   -- NULLABLE, see deviation note below
  requestedQty         Decimal?  @map("requested_qty") @db.Decimal(12, 4)    -- null = manager-added, head never asked
  approvedQty          Decimal?  @map("approved_qty") @db.Decimal(12, 4)     -- null until Session B's manager review
  addedFromNote        Boolean   @default(false) @map("added_from_note")    -- Session B: manager converted a note line to a real line
  editedById           String?   @map("edited_by_id")   -- Session B: who last changed approvedQty
  editReason           String?   @map("edit_reason")    -- Session B: required whenever approvedQty != requestedQty
  deletedAt            DateTime? @map("deleted_at")      -- Session B: branch-manager delete, soft (audit trail)

  @@index([requisitionSectionId])
  @@map("requisition_lines")
}
```

**Notes:**
- **`parAtRequest` is nullable — a deliberate deviation from
  `milestone-4-plan.md` §1.2's literal sketch, which typed it
  non-nullable.** `null` means no `RestockLevel` row exists yet for
  `(this branch's department location, item)` — expected to be common until
  Milestone One's restock-level flow is actually used per-branch (a
  Department Head could not reach it before this session's dead-role fix in
  `inventory-routes.ts`/`inventory-service.ts` — see `docs/API_CONTRACT.md`
  §24.4). No fallback, no zero; the frontend renders `null` as a blank/dash.
- `parAtRequest` is **snapshotted at line-creation time**, not read live from
  `RestockLevel` at display time — matches the "signed document is
  immutable" pattern Milestone Two's `GoodsReceipt` and Milestone Three's
  `PrepRun` already established.
- **"Zero-not-delete" is a service rule, not a schema state.** A department
  head setting a line's quantity to `0` is just `requestedQty: 0` — the
  row stays. Session A has **no true server-side line deletion**: the fill
  screen's trash icon is only enabled for a not-yet-saved line removed
  within the same session (never created server-side, so omitting it from
  the upsert `PATCH` is a true no-op); an already-persisted line's trash
  icon is disabled, since omitting it from the payload would silently do
  nothing rather than delete it — a head zeroes an already-saved line via
  the stepper instead. True soft-deletion via `deletedAt` is a Session B
  (branch-manager) capability, paired with a required `editReason`.
- No `onHandAtRequest` field (owner-resolved 2026-09-21, `milestone-4-plan.md`
  §0/§7 Q1) — no branch-department stock/ledger exists anywhere in the
  schema yet. The fill screen drops the on-hand column and the
  par-minus-on-hand auto pre-fill for this milestone; a head enters
  `requestedQty` manually against the visible `parAtRequest` reference.

---

### 4.66 Dispatch

Milestone Five (Dispatch & Branch Receiving), shipped 2026-09-22 (Session A
migration `20260922071002_milestone5_dispatch_dispatch_line`). *Backfilled
2026-09-25 by Milestone Six Session 1 from the shipped schema — Milestone
Five's plan named this entry but it was never written.* One `Dispatch` per
(requisition, department): the Central Store signs it out (`DISPATCH_OUT`
at the Central Store) and the department signs it in (`DISPATCH_IN` at the
department location). Two-org document, `StaffTransfer`'s pattern
(`CENTRAL_STORE_SCOPING_DESIGN.md` §4).

```prisma
model Dispatch {
  id                String         @id @default(uuid())
  organizationId    String         @map("organization_id")      -- hub org — the Central Store owns this document
  toOrganizationId  String         @map("to_organization_id")   -- branch org
  requisitionId     String         @map("requisition_id")
  departmentTag     DepartmentTag  @map("department_tag")       -- one Dispatch per department (Flow 9 step 4)
  sequenceLabel     String         @map("sequence_label")       -- "Dispatch 4 · Nyeri Town · 17 Sep" — daily per-branch label, not a persistent ID
  status            DispatchStatus @default(AWAITING)
  dispatchedById    String?        @map("dispatched_by_id")
  dispatchedAt      DateTime?      @map("dispatched_at")
  confirmedById     String?        @map("confirmed_by_id")      -- the real signer, even when confirmed on behalf (Flow 10b)
  confirmedAt       DateTime?      @map("confirmed_at")
  confirmedOnBehalf Boolean        @default(false) @map("confirmed_on_behalf")

  @@index([organizationId, status])
  @@index([toOrganizationId, departmentTag, status])
  @@index([requisitionId])
  @@map("dispatches")
}

enum DispatchStatus {
  AWAITING          -- not yet signed by the store
  IN_TRANSIT        -- signed, DISPATCH_OUT written, not yet confirmed
  CONFIRMED         -- DISPATCH_IN written, no mismatch
  DISCREPANCY_OPEN  -- DISPATCH_IN written but a line mismatched (Flow 10a)
}
```

**Notes:**
- `status` only moves forward: `AWAITING` → `IN_TRANSIT` (store PIN-signs;
  one negative `DISPATCH_OUT` row per non-zero line at the Central Store) →
  `CONFIRMED` or `DISCREPANCY_OPEN` (department head — or the Branch
  Manager on behalf — PIN-signs; one positive `DISPATCH_IN` row per line
  with `confirmedQty > 0` at the department location). The confirm write
  uses the `updateMany` + count-check pattern; zero rows → `ConflictError`.
- A zero-quantity line (short-dispatched to nothing) writes no ledger row.
- Resolving a discrepancy as `FOUND_REDELIVERED` spawns a fresh follow-up
  `Dispatch` for the gap quantity (no requisition-line link).

---

### 4.67 DispatchLine

```prisma
model DispatchLine {
  id                String   @id @default(uuid())
  dispatchId        String   @map("dispatch_id")
  requisitionLineId String?  @map("requisition_line_id")   -- null for a substitute line (Flow 9b) or a follow-up dispatch
  inventoryItemId   String   @map("inventory_item_id")
  requestedQty      Decimal? @map("requested_qty") @db.Decimal(12, 4)
  dispatchedQty     Decimal  @map("dispatched_qty") @db.Decimal(12, 4)
  confirmedQty      Decimal? @map("confirmed_qty") @db.Decimal(12, 4)   -- null until the department confirms
  costAtDispatch    Decimal  @map("cost_at_dispatch") @db.Decimal(12, 4) -- frozen per line (Flow 9 step 6); both ledger rows carry it
  isSubstitute      Boolean  @default(false) @map("is_substitute")
  substituteNote    String?  @map("substitute_note")          -- required when isSubstitute (Zod refinement)

  @@index([dispatchId])
  @@map("dispatch_lines")
}
```

**Notes:**
- `InventoryTransaction.dispatchLineId` is a real FK to this table
  (restored by Milestone Five — the third of the unlinked ledger columns to
  be restored, after `goodsReceiptLineId` and `prepRecordId`).
- `costAtDispatch` is the item's `currentCost` at signing and never
  changes; it is also the "cost carried into the department" that
  Milestone Six values department waste at (§4.69).

---

### 4.68 Discrepancy

Milestone Five Session B (migration `20260922111827_milestone5_session_b_discrepancy`).
Created automatically on a mismatched confirm (Flow 10a) — never a separate
user action.

```prisma
model Discrepancy {
  id                 String              @id @default(uuid())
  dispatchLineId     String              @map("dispatch_line_id")
  referenceNumber    String              @map("reference_number")   -- DSC-#### via ReferenceCounter, hub-scoped
  gapQty             Decimal             @map("gap_qty") @db.Decimal(12, 4)   -- confirmed − dispatched, signed
  status             DiscrepancyStatus   @default(OPEN)
  outcome            DiscrepancyOutcome?
  resolutionNote     String?             @map("resolution_note")
  resolvedById       String?             @map("resolved_by_id")
  resolvedAt         DateTime?           @map("resolved_at")
  followUpDispatchId String?             @map("follow_up_dispatch_id")   -- set when outcome = FOUND_REDELIVERED
  createdAt          DateTime            @default(now()) @map("created_at")

  @@index([status])
  @@index([dispatchLineId])
  @@map("discrepancies")
}

enum DiscrepancyStatus  { OPEN RESOLVED }
enum DiscrepancyOutcome { FOUND_REDELIVERED TRANSIT_LOSS_WRITEOFF MISCOUNT_CORRECTED }
```

**Notes:**
- Resolution is Store Manager only, PIN-signed, and writes the ledger
  effect of the chosen outcome in the same transaction:
  `TRANSIT_LOSS_WRITEOFF` → a negative `ADJUSTMENT` at the Central Store;
  `MISCOUNT_CORRECTED` → an `ADJUSTMENT` of `gapQty` at the department
  location; `FOUND_REDELIVERED` → a follow-up `Dispatch` (+ its
  `DISPATCH_OUT`). Each `ADJUSTMENT` carries `dispatchLineId`, which is how
  the Milestone Six ledger labels it "Transit discrepancy · DSC-####".
- The Branch Manager reads their own branch's discrepancies read-only.

---

### 4.69 WasteLog

Milestone Six (Counting, Closing & Discrepancies) Session 1, 2026-09-25
(migration `20260925090000_milestone6_session1_waste_log`). One row per
logged waste entry — the design logs one item at a time. Not signed
(Appendix B).

```prisma
model WasteLog {
  id              String      @id @default(uuid())
  organizationId  String      @map("organization_id")   -- the location's org: hub for the Central Store, branch org for a department
  locationId      String      @map("location_id")
  inventoryItemId String      @map("inventory_item_id")
  quantity        Decimal     @db.Decimal(12, 4)        -- positive as entered; the ledger row carries the negative sign
  reason          WasteReason
  note            String?
  unitCost        Decimal     @map("unit_cost") @db.Decimal(12, 4)
  loggedById      String      @map("logged_by_id")
  createdAt       DateTime    @default(now()) @map("created_at")

  @@index([organizationId, createdAt])
  @@index([locationId, createdAt])
  @@map("waste_logs")
}

enum WasteReason { SPOILAGE EXPIRY DAMAGE_IN_STORE PREP_ERROR }
```

**Notes:**
- **Location is resolved server-side from the actor**, never taken from
  the request: Store Manager / Store Attendant → the Central Store;
  department head → their own department location. The create body is a
  strict schema, so a client-sent `locationId` is a 400.
- Written together with exactly one negative `WASTE` `InventoryTransaction`
  (`wasteLogId` → this row) in one `prisma.$transaction`.
- `unitCost`: Central Store — the item's `currentCost` now; department —
  the cost carried into the department (the latest `DISPATCH_IN` row's
  `unitCost` for that item at that location), falling back to `currentCost`
  if the item was never dispatched in.
- Negative resulting stock is allowed and flagged (Flow 21) — it shows
  negative on the stock views; there is no notification.
- `organizationId` is not in the plan's §1.3 sketch; it was added so every
  query stays org-scoped (Non-Negotiable #3).

### 4.70 StockCount

Milestone Six Session 2, 2026-09-29 (migration
`20260929090000_milestone6_session2_counting`). One row per Central Store
count (hub org, D-15). `DAILY`: one per business day, enforced by a **partial
unique index** `(location_id, count_date) WHERE kind = 'DAILY'` in the
migration SQL (not expressible in the Prisma DSL). `SPOT`: unconstrained,
created `VERIFIED` in one step (counter = verifier = the Store Manager).

```prisma
model StockCount {
  id               String           @id @default(uuid())
  organizationId   String           @map("organization_id")  -- hub org
  locationId       String           @map("location_id")      -- Central Store
  kind             StockCountKind                            -- DAILY | SPOT
  countDate        DateTime         @map("count_date") @db.Date  -- Africa/Nairobi business date
  status           StockCountStatus @default(DRAFT)          -- DRAFT | SUBMITTED | RETURNED | VERIFIED
  reference        String                                    -- CNT-YYYY-MMDD | SPT-#### (ReferenceCounter)
  counterId        String           @map("counter_id")       -- attendant (daily) / Store Manager (spot); set to the signer at submit
  counterSignedAt  DateTime?        @map("counter_signed_at")
  verifierId       String?          @map("verifier_id")
  verifiedAt       DateTime?        @map("verified_at")
  returnNote       String?          @map("return_note")
  returnedAt       DateTime?        @map("returned_at")
  returnedById     String?          @map("returned_by_id")
  directorNotified Boolean          @default(false) @map("director_notified")
  createdAt        DateTime         @default(now()) @map("created_at")
  updatedAt        DateTime         @updatedAt @map("updated_at")  -- doubles as the "Saved 07:08" indicator while DRAFT

  @@index([organizationId, kind, status])
  @@index([locationId, countDate])
  @@map("stock_counts")
}
```

### 4.71 StockCountLine

```prisma
model StockCountLine {
  id              String            @id @default(uuid())
  stockCountId    String            @map("stock_count_id")      -- onDelete: Cascade
  inventoryItemId String            @map("inventory_item_id")
  countedQty      Decimal?          @db.Decimal(12, 4)          -- null = not counted; uncounted lines are never adjusted
  firstCountedQty Decimal?          @db.Decimal(12, 4)          -- the figure before a send-back cleared the line for a blind recount
  expectedQty     Decimal?          @db.Decimal(12, 4)          -- ledger on-hand at counterSignedAt; NEVER serialized to STORE_ATTENDANT
  unitCost        Decimal?          @db.Decimal(12, 4)          -- frozen with the snapshot
  decision        CountLineDecision @default(PENDING)           -- PENDING | ACCEPTED | QUERIED
  reason          CountReason?                                  -- SUSPECTED_MISCOUNT | UNLOGGED_SPOILAGE | SUSPECTED_LOSS | WITHIN_NORMAL_RANGE | OTHER
  reasonNote      String?                                       -- required when reason = OTHER (Zod refinement + service check)
  reasonRequired  Boolean           @default(false)             -- judged against the threshold in force at submit; moving a threshold never changes it
  queryNote       String?                                       -- per-line note to the attendant; never states the expected figure

  @@unique([stockCountId, inventoryItemId])
  @@map("stock_count_lines")
}
```

**Notes:**
- `expectedQty` / `unitCost` / `reasonRequired` are written **server-side at
  the attendant's sign** (a re-submit after send-back re-snapshots only the
  queried lines). Movements between counting and verifying therefore create
  no phantom variance. A zero-variance counted line is auto-`ACCEPTED`.
- **Send-back:** `firstCountedQty ← countedQty; countedQty ← null` on queried
  lines only; the attendant recounts them blind.
- **Approve:** one `ADJUSTMENT` `InventoryTransaction` per accepted non-zero
  variance (`quantity = countedQty − expectedQty`, `stockCountLineId`,
  `reference ADJ-####`), written in the same transaction as the status
  change.
- `InventoryTransaction.stockCountLineId` is now a real FK (`ON DELETE SET
  NULL`) with an index; the ledger's counterparty ("Daily count · verified
  by J. Mwangi") is derived from it.

### 4.72 CountingThresholds

One row per organization (`@@unique([organizationId])`), created lazily on
first save; code defaults apply until then (`counting-thresholds.ts`).
Values are whole KES of |variance| × unit cost, `0…1,000,000`, `0` = always.

```prisma
model CountingThresholds {
  id                  String    @id @default(uuid())
  organizationId      String    @unique @map("organization_id")
  reasonRequiredKes   Int       @map("reason_required_kes")   -- hub: Store Manager (default 500); branch: Branch Manager (default 1,000, Session 3)
  overnightAlertKes   Int?      @map("overnight_alert_kes")   -- branch rows only (default 500, Session 3)
  directorAlertKes    Int?      @map("director_alert_kes")    -- hub row only, company-wide (default 5,000); set by the Director
  updatedById         String?   @map("updated_by_id")         -- last change to reasonRequiredKes / overnightAlertKes
  directorUpdatedById String?   @map("director_updated_by_id")-- added in S2: "last changed by" must not be the Director's edit
  directorUpdatedAt   DateTime? @map("director_updated_at")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  @@map("counting_thresholds")
}
```

### 4.73 BranchDay

One per (branch org, business date) — `@@unique([organizationId, businessDate])`,
business date in Africa/Nairobi. Created lazily the first time the Branch
Manager opens Today's day. `reference` is `DAY-####` (`ReferenceCounter`,
prefix `DAY`, per branch org). A reopen returns it to `OPEN` and clears
`closedById` / `closedAt` (the history lives in `BranchDayReopen`).

```prisma
model BranchDay {
  id             String          @id @default(uuid())
  organizationId String          @map("organization_id")   -- branch org
  businessDate   DateTime        @map("business_date") @db.Date
  status         BranchDayStatus @default(OPEN)            -- OPEN | CLOSED
  reference      String                                    -- DAY-####
  closedById     String?         @map("closed_by_id")
  closedAt       DateTime?       @map("closed_at")
  reopenCount    Int             @default(0) @map("reopen_count")
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  @@unique([organizationId, businessDate])
  @@index([organizationId, status])
  @@map("branch_days")
}
```

### 4.74 BranchDayDepartment

One per (day, department) — created with the day for every
`BRANCH_DEPARTMENT` location of the branch. Stored `status` is only
`NOT_STARTED | COUNTED`; **`COUNTING`, `BLOCKED` and `CLOSED` are derived at
read time** (BLOCKED from `Dispatch.status = IN_TRANSIT` to that department, so
confirming a dispatch unblocks it instantly). A department with no items to
count is treated as counted (plan Q-D).

```prisma
model BranchDayDepartment {
  id            String                    @id @default(uuid())
  branchDayId   String                    @map("branch_day_id")   -- ON DELETE CASCADE
  departmentTag DepartmentTag             @map("department_tag")
  locationId    String                    @map("location_id")
  status        BranchDayDepartmentStatus @default(NOT_STARTED)
  countedById   String?                   @map("counted_by_id")
  countedAt     DateTime?                 @map("counted_at")

  @@unique([branchDayId, departmentTag])
  @@map("branch_day_departments")
}
```

### 4.75 BranchDayLine

One per counted item. Created at the first save of that item's count (an
uncounted item has no row — the read model shows the live expected figure).
`expectedQty` / `unitCost` / `reasonRequired` are **snapshotted each time the
line's count is saved**: expected = department on-hand at that moment
excluding this day's own close adjustments and reversals; unit cost = the
latest `DISPATCH_IN` cost at the department, else the catalog cost;
`reasonRequired` is judged against the branch threshold then in force, so
moving a threshold never changes a saved or signed line. `reason` is kept only
on a `reasonRequired` line. `OTHER` needs `reasonNote`.

```prisma
model BranchDayLine {
  id                    String     @id @default(uuid())
  branchDayDepartmentId String     @map("branch_day_department_id")   -- ON DELETE CASCADE
  inventoryItemId       String     @map("inventory_item_id")          -- hub catalog item
  countedQty            Decimal?   @map("counted_qty") @db.Decimal(12, 4)  -- null = cleared / not counted; never adjusted
  expectedQty           Decimal    @map("expected_qty") @db.Decimal(12, 4)
  unitCost              Decimal    @map("unit_cost") @db.Decimal(12, 4)
  reason                GapReason?                                    -- CONSUMPTION | UNLOGGED_WASTE | WALK_IN_COMP | SUSPECTED_LOSS | OTHER
  reasonNote            String?    @map("reason_note")
  reasonRequired        Boolean    @default(false) @map("reason_required")

  @@unique([branchDayDepartmentId, inventoryItemId])
  @@map("branch_day_lines")
}
```

Close writes one `ADJUSTMENT` (`quantity = countedQty − expectedQty`,
`branchDayLineId`, `ADJ-####`) per non-zero gap. A re-close first reverses every
standing adjustment of the day with a linked equal-and-opposite row
(`reversesTransactionId` → the original; a row can be reversed once), then
writes fresh ones. Ledger counterparty reads "End-of-day count" (or
"End-of-day count · reversed").

### 4.76 BranchDayReopen

Immutable, append-only audit — never updated or deleted.

```prisma
model BranchDayReopen {
  id           String   @id @default(uuid())
  branchDayId  String   @map("branch_day_id")   -- ON DELETE CASCADE
  reopenedById String   @map("reopened_by_id")
  reopenedAt   DateTime @default(now()) @map("reopened_at")
  reason       String                            -- required, free text

  @@index([branchDayId])
  @@map("branch_day_reopens")
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
-- PENDING/IN_PROGRESS/READY → AWAITING_CANCELLATION_APPROVAL (waiter cancellation pending)
-- AWAITING_CANCELLATION_APPROVAL → CANCELLED (approved) or previousStatus (rejected)
-- READY → AWAITING_AUTHORIZATION (House Account / discount pending approval)
-- AWAITING_AUTHORIZATION → READY (rejected) or CLOSED (approved)
enum OrderStatus {
  PENDING
  IN_PROGRESS
  READY
  AWAITING_AUTHORIZATION
  AWAITING_CANCELLATION_APPROVAL
  CLOSED
  CANCELLED
}

enum HouseAccountAuthStatus {
  PENDING
  APPROVED
  REJECTED
  TIMED_OUT   -- set if the request expires without action (24h)
}

enum CancellationRequestStatus {
  PENDING
  APPROVED
  REJECTED
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
  SPLIT             -- one payer, two methods (mpesaAmount + cashAmount/cardAmount + splitType)
  GUEST_SPLIT       -- N guests, each with own SplitPaymentLine record
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
  ORDER_CANCELLATION_REJECTED -- waiter cancellation request was rejected
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

### 4.77 DepartmentOpening

Next-morning opening (Flow 12c, Milestone Six Session 4). One row per (`branchDayId` = the day being opened, `departmentTag`), **created only when the Department Head accepts** — "not accepted yet" is the absence of a row. `locationId`, `acceptedById`, `acceptedAt`. `@@unique([branchDayId, departmentTag])`.

### 4.78 DepartmentOpeningLine

`openingId`, `inventoryItemId`, `prefilledQty` (department on-hand the ledger showed), `acceptedQty` (what was counted — authoritative), `overnightVariance` (= accepted − prefilled), `unitCost`. `@@unique([openingId, inventoryItemId])`. `InventoryTransaction.openingLineId` is a real nullable FK to this table: each overnight `ADJUSTMENT` (and its reversal on a re-close) carries it.

### 4.79 SupplierContact

Many per supplier. `organizationId`, `supplierId` (cascade), `name`, `role` (`SupplierContactRole`: `SALES_REP | ACCOUNTS | DELIVERY | OWNER | OTHER`), `phone?`, `whatsapp?`, `email?`, `isPrimary`. **Partial unique index** `supplier_contacts_one_primary_per_supplier` on `(supplier_id) WHERE is_primary` — at most one primary; the service keeps exactly one while any contact exists (first contact is primary; the primary cannot be deleted or un-flagged while others exist).

### 4.80 SupplierPayMethod

How Wendo pays a supplier (Prisma model `SupplierPayMethod`, table `supplier_pay_methods`; **named "PayMethod" because the enum `SupplierPaymentMethod` (BANK/CASH/MPESA/CHEQUE) already classifies recorded `SupplierPayment` rows**). `organizationId`, `supplierId` (cascade), `type` (`SupplierPayMethodType`: `BANK_TRANSFER | MPESA_PAYBILL | MPESA_TILL | MPESA_SEND_MONEY | CASH`), typed nullable columns `bankName`, `bankBranch`, `accountName`, `accountNumber`, `paybillNumber`, `accountReference`, `tillNumber`, `phone`, `registeredName`, `isDefault`, `createdById`. **Partial unique index** `supplier_pay_methods_one_default_per_supplier` on `(supplier_id) WHERE is_default`. Only the columns belonging to `type` are populated. **CHEQUE** (migration `catalog_cheque_and_pack_lines`, 2026-10-02) reuses `registeredName` (payable to) and `bankName`, and may carry a free-text `note` (`note TEXT NULL`, added to every pay method). Visible to Store Manager, Accountant, Director only; never to attendants. Every create / update / delete / default change writes a `SupplierAuditLog` row.

### 4.81 SupplierItem

The supplier catalog: one row per supplier **line** — (supplier, item, buy unit, pack size), so one supplier can sell the same item in several pack sizes. `organizationId`, `supplierId` (cascade), `inventoryItemId`, `supplierItemName?`, `supplierItemCode?`, `buyUnit?`, `packSize?` (`Decimal(12,4)`), `lastPrice?` (`Decimal(12,4)`, **per buy unit**), `lastPriceAt?`, `lastPriceSetById?`, `isPreferred`, `preferredNeedsConfirm` (`Boolean`, default `false` — the "Preferred · confirm" flag that seeding sets). **Line key (raw SQL, no Prisma compound unique):** unique index `supplier_items_line_key` on `(supplier_id, inventory_item_id, COALESCE(buy_unit, ''), COALESCE(pack_size, 0))` — the COALESCE makes NULL unit / pack compare equal, because Postgres treats NULLs as distinct in a plain unique index; so a row with no unit and no pack is the same line as another with none. Because Prisma has no compound key for it, code finds a line with `findFirst` and then `update`/`create`, never `upsert`. Search indexes (raw SQL): `supplier_items_org_code_idx` on `(organization_id, supplier_item_code)` and `supplier_items_org_lower_name_idx` on `(organization_id, lower(supplier_item_name))`. **Partial unique index** `supplier_items_one_preferred_per_item` on `(inventory_item_id) WHERE is_preferred`. `lastPrice` / `lastPriceAt` are written by signing a goods receipt (same transaction as the ledger write), or by hand (Session 4b, API_CONTRACT.md §30.3): then `lastPriceSetById` (nullable FK → `users`, `ON DELETE SET NULL`) names who set it. `lastPriceSetById` is null when the price came from a receipt or is unset; signing a receipt that prices the line clears it. `isPreferred` is kept in step with `InventoryItem.preferredSupplierId` (old column retained; retire in a later cleanup).

### 4.82 SupplierDocument

Uploaded files (images/PDF, ≤ 10 MB, type verified by magic bytes). `organizationId`, `supplierId` (cascade), `objectKey` (`org/<orgId>/suppliers/<supplierId>/<uuid>` in the private R2 bucket — never returned by the API), `fileName`, `mimeType` (detected, not client-declared), `sizeBytes`, `docType` (`SupplierDocumentType`: `INVOICE | DELIVERY_NOTE | RECEIPT | PRICE_LIST | CONTRACT | TAX_DOCUMENT | OTHER`), `docDate?` (date), `note?`, `goodsReceiptId?`, `supplierInvoiceId?` (both must belong to the same supplier), `uploadedById`, `createdAt`.

### 4.83 SupplierAuditLog

Append-only. `organizationId`, `supplierId` (cascade), `action` (`SupplierAuditAction`: `PAY_METHOD_CREATED | PAY_METHOD_UPDATED | PAY_METHOD_DELETED | PAY_METHOD_DEFAULT_CHANGED | STATUS_CHANGED`), `entityId?`, `before?` / `after?` (JSON; **account numbers and wallet phone numbers are stored already masked** — last four characters only), `actorId`, `createdAt`. Index `(organizationId, supplierId, createdAt)`. No read endpoint yet.

### Supplier enums

`SupplierStatus`, `SupplierType`, `SupplierContactRole`, `SupplierPayMethodType` (+`CHEQUE`), `SupplierDocumentType`, `SupplierAuditAction` — values as listed above (added 2026-09-30).

### Why a separate PrepTicket table instead of status flags on Order?

An order can involve two independent workflows simultaneously — the kitchen preparing food while the barista makes drinks. Each workflow has its own claim, its own In-Progress, its own Ready. `PrepTicket` gives each workflow its own clean lifecycle, its own claimant, and its own timestamps, while the `Order` still presents a unified view to the waiter.

### Why one PrepTicket per order-item line (not per station)?

This is the workload-fairness design. An order with `Latte ×2 + Cappuccino` produces two separate BARISTA tickets — one for the Latte batch and one for the Cappuccino. This allows two different baristas to claim different items from the same order, distributing the work fairly. A single "all BARISTA items" ticket would force one person to make everything. See `docs/archive/phases/PHASE_3_ENHANCEMENT_TICKET_SPLITTING.md` for full rationale.

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

## 8. Workforce foundation (slice 0, migration `20261006111155_workforce_foundation`)

Four new tables, plain id columns and no relations to `users`, `organizations` or `companies` (so history outlives other rows and no Access file changed). Full design of the whole module: `docs/features/workforce/slice-0-contract.md` section 2. Models in `backend/prisma/schema/workforce.prisma`.

| Table | Purpose | Notes |
|---|---|---|
| `workforce_audit_entries` | Append-only audit log, hash-chained per company | `seq` gap-free per company, `prev_hash`/`hash`; triggers refuse UPDATE, DELETE, TRUNCATE (no escape hatch); unique `(company_id, seq)` |
| `workforce_audit_chain_heads` | One row per company, tip of the chain, locked `FOR UPDATE` by the writer | trigger: `last_seq` may only move to old + 1; never deleted or truncated |
| `workforce_rule_versions` | One immutable version of one rule group; `organization_id` null = company default | `values` JSON validated by the group's Zod schema; partial unique indexes `(company_id, group, version) WHERE organization_id IS NULL` and `(company_id, organization_id, group, version) WHERE organization_id IS NOT NULL` |
| `workforce_rule_confirmations` | A second person's confirmation of part of a version | unique `(rule_version_id, scope)` |

Enums: `RuleGroup`, `AuditCategory`, `AuditChannel`. Triggers and partial indexes are hand-written SQL in the migration (Prisma does not model them, so `prisma migrate diff` shows nothing).

---

*This data model is the authoritative schema definition for Wendo RMS. Any structural change must be reflected here, in the Prisma schema, and in a corresponding migration file.*
