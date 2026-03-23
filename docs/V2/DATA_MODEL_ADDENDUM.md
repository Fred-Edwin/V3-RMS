# Data Model Addendum
## Wendo Coffee Bistro — RMS V2
**Version:** 2.0
**Status:** Draft
**Date:** 2026-03-22
**Extends:** `docs/DATA_MODEL.md` (V1 — do not modify V1 doc)

---

## Overview

This document describes only the new models and enum changes introduced in V2. The V1 schema defined in `docs/DATA_MODEL.md` and implemented in `backend/prisma/schema.prisma` is unchanged except where explicitly noted here.

All V1 design principles apply:
- UUIDs for all primary keys (`@id @default(uuid())`)
- `createdAt`/`updatedAt` on every model
- `organizationId` in the `where` clause of every branch-scoped query
- Central Kitchen models and system-level models do NOT have `organizationId`
- Soft deletes (`deletedAt DateTime?`) where data must not be permanently lost
- `Decimal(10,2)` for all monetary values

---

## 1. Enum Changes

### 1.1 `UserRole` — Add `STORE_MANAGER`

```prisma
enum UserRole {
  SYSTEM_ADMIN
  DIRECTOR
  MANAGER
  STORE_MANAGER    // NEW — Central Kitchen staff only
  WAITER
  CHEF
  BARISTA
  KITCHEN_DISPLAY
  BARISTA_DISPLAY
}
```

**`STORE_MANAGER` characteristics:**
- Assigned to the hub organisation (`organization.isHub = true`)
- No branch `organizationId` — they operate at the Central Kitchen level
- Has access to: supplier deliveries, raw ingredient stock, requisition review and dispatch, CK stocktake
- Does NOT have access to: branch order management, KDS/BDS, branch reporting, staff scheduling

### 1.2 New Enum `RequisitionStatus`

```prisma
enum RequisitionStatus {
  PENDING      // submitted by branch, awaiting CK review
  APPROVED     // CK has reviewed and approved (optional intermediate state)
  DISPATCHED   // CK has confirmed dispatch, stock deducted
  RECEIVED     // branch has confirmed receipt
  PARTIAL      // branch confirmed receipt with shortfall
}
```

### 1.3 New Enum `StocktakeStation`

```prisma
enum StocktakeStation {
  KITCHEN
  BARISTA
  WAITER
}
```

Note: `PrepStation` (KITCHEN, BARISTA) already exists for PrepTickets. `StocktakeStation` is a separate enum because stocktakes include the WAITER station which PrepTickets do not.

### 1.4 New Enum `DisciplinaryType`

```prisma
enum DisciplinaryType {
  VERBAL
  WRITTEN
  FINAL_WRITTEN
}
```

---

## 2. V2.1 — Inventory Models

### 2.1 `Supplier`

System-level (no `organizationId`). Suppliers deliver to the Central Kitchen only.

```prisma
model Supplier {
  id        String   @id @default(uuid())
  name      String
  phone     String?
  email     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  deliveries SupplierDelivery[]

  @@map("suppliers")
}
```

### 2.2 `RawIngredient`

Tracks raw ingredients held at the Central Kitchen. `currentStockCk` is the live quantity.

```prisma
model RawIngredient {
  id               String   @id @default(uuid())
  name             String   @unique
  unit             String   // e.g. "kg", "litres", "units"
  currentStockCk   Decimal  @default(0) @db.Decimal(10, 3) // 3dp for weights
  reorderThreshold Decimal  @default(0) @db.Decimal(10, 3)
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  deliveries   SupplierDelivery[]
  conversions  IngredientConversion[]

  @@map("raw_ingredients")
}
```

### 2.3 `IngredientConversion`

The recipe table. Maps a menu item to the raw ingredient(s) it consumes and the quantity per portion. One menu item may use multiple ingredients; one ingredient may be used by multiple menu items.

```prisma
model IngredientConversion {
  id                 String   @id @default(uuid())
  menuItemId         String
  ingredientId       String
  quantityPerPortion Decimal  @db.Decimal(10, 4) // e.g. 0.1500 kg per Chicken Burger
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  menuItem   MenuItem      @relation(fields: [menuItemId], references: [id])
  ingredient RawIngredient @relation(fields: [ingredientId], references: [id])

  @@unique([menuItemId, ingredientId])
  @@map("ingredient_conversions")
}
```

### 2.4 `SupplierDelivery`

Audit log of every supplier delivery received at the Central Kitchen. Each delivery increments `RawIngredient.currentStockCk`.

```prisma
model SupplierDelivery {
  id           String   @id @default(uuid())
  ingredientId String
  supplierId   String
  quantity     Decimal  @db.Decimal(10, 3)
  deliveredAt  DateTime @default(now())
  loggedById   String   // STORE_MANAGER or DIRECTOR user id
  notes        String?
  createdAt    DateTime @default(now())

  ingredient RawIngredient @relation(fields: [ingredientId], references: [id])
  supplier   Supplier      @relation(fields: [supplierId], references: [id])
  loggedBy   User          @relation(fields: [loggedById], references: [id])

  @@map("supplier_deliveries")
}
```

### 2.5 `Requisition`

One requisition per branch per request cycle (morning or mid-day). Contains the header record; line items are in `RequisitionItem`.

```prisma
model Requisition {
  id             String            @id @default(uuid())
  organizationId String            // the requesting branch
  submittedById  String
  status         RequisitionStatus @default(PENDING)
  notes          String?
  submittedAt    DateTime          @default(now())
  dispatchedAt   DateTime?
  receivedAt     DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  organization Organization     @relation(fields: [organizationId], references: [id])
  submittedBy  User             @relation(fields: [submittedById], references: [id])
  items        RequisitionItem[]

  @@map("requisitions")
}
```

### 2.6 `RequisitionItem`

Line items for a requisition. Tracks requested, dispatched, and received quantities separately to support discrepancy detection.

```prisma
model RequisitionItem {
  id             String   @id @default(uuid())
  requisitionId  String
  menuItemId     String
  requestedQty   Int      // portions requested by branch
  dispatchedQty  Int?     // portions dispatched by CK (null until dispatched)
  receivedQty    Int?     // portions actually received (null until confirmed)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  requisition Requisition @relation(fields: [requisitionId], references: [id], onDelete: Cascade)
  menuItem    MenuItem    @relation(fields: [menuItemId], references: [id])

  @@map("requisition_items")
}
```

### 2.7 `BranchStock`

Live stock levels at each branch per menu item. Updated automatically when a PrepTicket is marked READY. Incremented when a requisition is received.

```prisma
model BranchStock {
  id              String   @id @default(uuid())
  organizationId  String
  menuItemId      String
  currentQty      Int      @default(0)
  lowStockThreshold Int    @default(5)
  updatedAt       DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  menuItem     MenuItem      @relation(fields: [menuItemId], references: [id])

  @@unique([organizationId, menuItemId])
  @@map("branch_stock")
}
```

### 2.8 `Consumable`

Non-portioned items (serviettes, oil, condiments, etc.) that do not map to menu items. Categorised by station for stocktake purposes.

```prisma
model Consumable {
  id       String           @id @default(uuid())
  name     String           @unique
  unit     String           // e.g. "boxes", "litres", "units"
  station  StocktakeStation // which station manages this item
  isActive Boolean          @default(true)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  branchStocks ConsumableStock[]

  @@map("consumables")
}
```

### 2.9 `ConsumableStock`

Branch-level stock of consumables. Updated via manual stocktake — no automatic depletion.

```prisma
model ConsumableStock {
  id             String   @id @default(uuid())
  organizationId String
  consumableId   String
  currentQty     Decimal  @default(0) @db.Decimal(10, 2)
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  consumable   Consumable   @relation(fields: [consumableId], references: [id])

  @@unique([organizationId, consumableId])
  @@map("consumable_stock")
}
```

### 2.10 `StocktakeSession`

One session per branch per day (or per branch per date+station if sessions are separate). The Branch Manager conducts all three station counts in one session.

```prisma
model StocktakeSession {
  id             String   @id @default(uuid())
  organizationId String
  conductedById  String
  date           DateTime @db.Date
  completedAt    DateTime?
  createdAt      DateTime @default(now())

  organization Organization     @relation(fields: [organizationId], references: [id])
  conductedBy  User             @relation(fields: [conductedById], references: [id])
  entries      StocktakeEntry[]

  @@unique([organizationId, date]) // one session per branch per day
  @@map("stocktake_sessions")
}
```

### 2.11 `StocktakeEntry`

Each line in a stocktake session. Can reference either a menu item (portioned food) or a consumable (non-portioned item). `variance` is computed as `actualQty - expectedQty` (negative = loss).

```prisma
model StocktakeEntry {
  id           String           @id @default(uuid())
  sessionId    String
  station      StocktakeStation
  menuItemId   String?          // either menuItemId or consumableId, not both
  consumableId String?
  expectedQty  Decimal          @db.Decimal(10, 2)
  actualQty    Decimal          @db.Decimal(10, 2)
  variance     Decimal          @db.Decimal(10, 2) // actualQty - expectedQty
  note         String?
  createdAt    DateTime         @default(now())

  session    StocktakeSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  menuItem   MenuItem?        @relation(fields: [menuItemId], references: [id])
  consumable Consumable?      @relation(fields: [consumableId], references: [id])

  @@map("stocktake_entries")
}
```

---

## 3. V2.2 — HR Models

### 3.1 `PerformanceAssessment`

Structured supervisory assessment submitted by a Head Chef, Assistant Chef, Head Waiter, or Assistant Waiter about a staff member they supervise.

```prisma
model PerformanceAssessment {
  id             String   @id @default(uuid())
  organizationId String
  staffId        String   // the staff member being assessed
  assessorId     String   // the supervisor submitting the assessment
  periodStart    DateTime @db.Date
  periodEnd      DateTime @db.Date
  dimensions     Json     // { conduct: 4, punctuality: 3, teamwork: 5, quality: 4 } etc.
  overallScore   Decimal  @db.Decimal(3, 1) // e.g. 4.0
  notes          String?
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  staff        User         @relation("AssessedStaff", fields: [staffId], references: [id])
  assessor     User         @relation("AssessorStaff", fields: [assessorId], references: [id])

  @@map("performance_assessments")
}
```

**Note on `dimensions`:** The exact keys stored in `dimensions` will be defined during V2.2 scoping (open question). Using `Json` keeps the schema flexible until the assessment form structure is finalised.

### 3.2 `DisciplinaryRecord`

Permanent, timestamped disciplinary history per staff member. Records are never deleted.

```prisma
model DisciplinaryRecord {
  id             String          @id @default(uuid())
  organizationId String
  staffId        String
  issuedById     String
  type           DisciplinaryType
  description    String
  notes          String?
  createdAt      DateTime        @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  staff        User         @relation("DisciplinedStaff", fields: [staffId], references: [id])
  issuedBy     User         @relation("DisciplinaryIssuer", fields: [issuedById], references: [id])

  @@map("disciplinary_records")
}
```

---

## 4. V2.3 — Payment Model Changes

### 4.1 Additions to `Organization`

Each branch needs its own Mpesa configuration. Credentials are sensitive — store secrets encrypted or via environment-level secrets management, not plaintext in the DB.

```prisma
// Fields added to existing Organization model:
mpesaTillNumber     String?   // Mpesa till number for this branch
mpesaConsumerKey    String?   // Daraja API consumer key (or Pesapal equivalent)
mpesaConsumerSecret String?   // Daraja API consumer secret — NEVER log or return in responses
mpesaPasskey        String?   // Daraja API passkey — NEVER log or return in responses
```

### 4.2 Additions to `Order`

```prisma
// Fields added to existing Order model:
mpesaRequestId      String?   // Daraja CheckoutRequestID, used to match callback
mpesaCallbackRaw    Json?     // raw callback payload stored for audit
```

---

## 5. V2.4 — Communications Models

### 5.1 `Announcement`

A broadcast message from management to a scoped audience.

```prisma
model Announcement {
  id             String    @id @default(uuid())
  organizationId String?   // null = company-wide; set = branch-specific
  authorId       String
  title          String
  body           String
  targetRoles    Json      // string[] of UserRole values, e.g. ["WAITER","CHEF"]
  requiresAck    Boolean   @default(false)
  createdAt      DateTime  @default(now())

  author       User              @relation(fields: [authorId], references: [id])
  organization Organization?     @relation(fields: [organizationId], references: [id])
  acks         AnnouncementAck[]

  @@map("announcements")
}
```

### 5.2 `AnnouncementAck`

Tracks acknowledgement of announcements that require confirmation.

```prisma
model AnnouncementAck {
  id             String   @id @default(uuid())
  announcementId String
  userId         String
  ackedAt        DateTime @default(now())

  announcement Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id])

  @@unique([announcementId, userId]) // one ack per user per announcement
  @@map("announcement_acks")
}
```

### 5.3 `DirectMessage`

1:1 professional message between two system users.

```prisma
model DirectMessage {
  id         String    @id @default(uuid())
  fromUserId String
  toUserId   String
  body       String
  sentAt     DateTime  @default(now())
  readAt     DateTime?

  from User @relation("MessageSender", fields: [fromUserId], references: [id])
  to   User @relation("MessageRecipient", fields: [toUserId], references: [id])

  @@index([fromUserId, toUserId])
  @@index([toUserId, sentAt])
  @@map("direct_messages")
}
```

---

## 6. Index Strategy — V2 Additions

| Model | Index | Reason |
|---|---|---|
| `BranchStock` | `[organizationId, menuItemId]` UNIQUE | Fast lookup per branch per item during order completion |
| `Requisition` | `[organizationId, status]` | Branch's own pending requisitions |
| `Requisition` | `[status, submittedAt]` | CK inbox view sorted by time |
| `StocktakeEntry` | `[sessionId]` | All entries for a session |
| `DisciplinaryRecord` | `[organizationId, staffId, createdAt]` | Staff history, newest first |
| `PerformanceAssessment` | `[organizationId, staffId]` | All assessments for a staff member |
| `Announcement` | `[organizationId, createdAt]` | Branch feed, newest first |
| `DirectMessage` | `[toUserId, sentAt]` | Inbox for a recipient |

---

## 7. Key Design Decisions

### Why `BranchStock` is a separate table and not a field on `BranchMenuItem`
`BranchMenuItem` is a configuration table — it holds overrides to menu item availability. `BranchStock` is an operational table — it changes dozens of times a day as orders are completed. Keeping them separate avoids high-frequency writes on the configuration table and makes the stock depletion path simpler and more auditable.

### Why `RequisitionItem` stores three quantity fields
`requestedQty`, `dispatchedQty`, and `receivedQty` are separate because discrepancy detection requires comparing all three. If we only stored one field and updated it, we would lose the audit trail of what was requested vs what was sent vs what arrived.

### Why `StocktakeEntry` accepts either `menuItemId` or `consumableId` (not both)
The Branch Manager counts all items in one session regardless of whether they are portioned food items or non-portioned consumables. Rather than two separate session types, a single entry model with nullable foreign keys keeps the stocktake form and reporting unified. A check constraint or application-level validation ensures exactly one of the two is set.

### Why `DisciplinaryRecord` has no soft delete
Disciplinary records are permanent by design. They must be auditable and cannot be removed by any role including `SYSTEM_ADMIN`. Records can be annotated but not deleted.

### Why `Announcement.organizationId` is nullable
A `null` value means the announcement is company-wide (all branches, all roles in `targetRoles`). A non-null value scopes it to a specific branch. This avoids a many-to-many relationship for the common case.
