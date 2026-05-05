# Phase 9 — Payslip Visibility Module — Plan

**Status:** Planned (Not yet started)  
**Date:** 2026-05-04  
**Author:** System Architect

---

## Overview

Phase 9 adds a **Payslip Visibility Module** to the Wendo RMS. This is *not* a payroll processing system — Wendo uses an external payroll provider. The system allows staff to view their own payslips (gross pay, statutory deductions, net pay) and print them. Admin staff (Director, HR Manager) enter payslip data manually per pay period.

---

## What This Is NOT

- Not payroll processing or automated salary calculation
- Not connected to any bank or payment system
- Not a replacement for the external payroll provider
- No automatic deduction calculation (admin enters the numbers)

---

## Feature Specification

### Roles

| Role | Access |
|---|---|
| SYSTEM_ADMIN | All payslips, all staff, all periods |
| DIRECTOR | All payslips across all branches |
| HR_MANAGER | All payslips across all branches |
| MANAGER | Own branch staff payslips only |
| WAITER / CHEF / BARISTA | Own payslips only |
| ACCOUNTANT | Read-only access to all payslips (for finance reconciliation) |
| KITCHEN_DISPLAY / BARISTA_DISPLAY | No access |

### Pay Periods

Pay periods are monthly (e.g., "April 2026"). A payslip record belongs to a specific staff member and a specific pay period.

### Payslip Data Fields

Each payslip record stores:

**Identity**
- Staff member (userId)
- Branch (organizationId)
- Pay period (year + month, stored as `payPeriod: YYYY-MM`)
- Pay date (date salary was actually paid)

**Earnings**
- Basic salary (KES)
- House allowance (KES) — optional
- Transport allowance (KES) — optional
- Other allowances (KES, free-text label) — optional, multiple entries

**Statutory Deductions (Kenya)**
- PAYE (Pay As You Earn) — income tax
- NSSF (National Social Security Fund) — pension contribution
- SHIF (Social Health Insurance Fund) — replaced NHIF in 2026
- AHL (Affordable Housing Levy) — 1.5% of gross
- HELB (Higher Education Loans Board) — optional, for staff with student loans

**Other Deductions**
- Other deductions (KES, free-text label) — optional, multiple entries (e.g., salary advance recovery, fines)

**Computed Totals** (stored, not computed on-the-fly to prevent display drift)
- Gross pay
- Total deductions
- Net pay

**Metadata**
- Created by (userId of admin who entered the record)
- Created at
- Updated at

### Payslip Actions

| Action | Who |
|---|---|
| Create payslip for a staff member | Director, HR Manager |
| Edit a payslip (before locking) | Director, HR Manager |
| Lock a payslip (prevent further edits) | Director, HR Manager |
| View own payslip | Any staff member |
| View all payslips for branch | Manager |
| View all payslips | Director, HR Manager, Accountant |
| Print payslip | Any staff member (own); Manager/Director/HR Manager (any) |

---

## Data Model

### New Model: `Payslip`

```prisma
model Payslip {
  id               String   @id @default(cuid())
  organizationId   String
  userId           String
  payPeriod        String   // "YYYY-MM" e.g. "2026-04"
  payDate          DateTime

  // Earnings
  basicSalary      Decimal  @db.Decimal(10, 2)
  houseAllowance   Decimal? @db.Decimal(10, 2)
  transportAllowance Decimal? @db.Decimal(10, 2)
  otherAllowances  Json?    // [{ label: string, amount: number }]

  // Statutory deductions
  paye             Decimal  @db.Decimal(10, 2)
  nssf             Decimal  @db.Decimal(10, 2)
  shif             Decimal  @db.Decimal(10, 2)
  housingLevy      Decimal  @db.Decimal(10, 2)
  helb             Decimal? @db.Decimal(10, 2)

  // Other deductions
  otherDeductions  Json?    // [{ label: string, amount: number }]

  // Computed totals (stored)
  grossPay         Decimal  @db.Decimal(10, 2)
  totalDeductions  Decimal  @db.Decimal(10, 2)
  netPay           Decimal  @db.Decimal(10, 2)

  // State
  isLocked         Boolean  @default(false)
  createdById      String

  // Relations
  organization     Organization @relation(fields: [organizationId], references: [id])
  user             User         @relation("StaffPayslips", fields: [userId], references: [id])
  createdBy        User         @relation("PayslipsCreated", fields: [createdById], references: [id])

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([organizationId, userId, payPeriod])
  @@index([organizationId, payPeriod])
  @@index([userId])
  @@map("payslips")
}
```

---

## API Routes

All routes under `/api/v1/payslips`.

| Method | Path | Roles | Description |
|---|---|---|---|
| `POST` | `/payslips` | DIRECTOR, HR_MANAGER | Create payslip for a staff member |
| `GET` | `/payslips` | DIRECTOR, HR_MANAGER, ACCOUNTANT | List all payslips (paginated, filterable by branch/period) |
| `GET` | `/payslips/my` | All staff | List own payslips |
| `GET` | `/payslips/:id` | Owner + management | Get single payslip |
| `PATCH` | `/payslips/:id` | DIRECTOR, HR_MANAGER | Update payslip (if not locked) |
| `POST` | `/payslips/:id/lock` | DIRECTOR, HR_MANAGER | Lock payslip to prevent edits |
| `GET` | `/payslips/branch/:branchId` | MANAGER (own), DIRECTOR, HR_MANAGER | All payslips for a branch per period |

---

## Frontend Pages

### Staff View — `/app/payslips`
- Lists own payslips by pay period (most recent first)
- Each row: pay period, gross pay, net pay, status (locked/draft)
- Click to open full payslip detail modal
- Print button (opens print-optimized layout / browser print dialog)

### Admin View — `/app/admin/payslips` (Director / HR Manager)
- Staff picker + pay period filter
- "Add Payslip" button → opens form with all fields
- List of all payslips with status indicators
- Lock button per payslip

### Manager View — `/app/manage/payslips`
- Filtered to own branch staff
- Read-only (cannot create or lock, only view)

---

## Print Layout

The payslip print view is a standard A4 / 80mm thermal layout with:

- Company header (Wendo Coffee Bistro, branch name)
- Staff name, position, pay period, pay date
- Earnings table (item → amount)
- Deductions table (item → amount)
- Gross Pay, Total Deductions, Net Pay summary
- Printed on: [date] by [user]

Implementation: browser `window.print()` with a print-specific CSS class. No PDF generation library required.

---

## Build Tasks

### Backend
- [ ] Add `Payslip` model to `schema.prisma`
- [ ] Generate and apply migration
- [ ] Create `payslip-schemas.ts` (Zod validators)
- [ ] Create `payslip-repository.ts`
- [ ] Create `payslip-service.ts`
- [ ] Create `payslip-controller.ts`
- [ ] Register routes in `routes/index.ts`
- [ ] Write tests (repository + service)

### Frontend
- [ ] Add `Payslip` type to `frontend/types/`
- [ ] Add `payslipService.ts` API calls
- [ ] Staff payslip list page `/app/payslips`
- [ ] Payslip detail modal with print layout
- [ ] Admin create/edit payslip form
- [ ] Admin payslip list page with lock action
- [ ] Manager read-only payslip view

---

## Out of Scope for Phase 9

- Automated PAYE / NSSF / SHIF calculation (manual entry only)
- Integration with payroll provider
- PDF download (browser print is sufficient)
- Payslip email delivery
- Historical payslip bulk import

---

*This plan is authoritative for Phase 9. Update the status field when development begins.*
