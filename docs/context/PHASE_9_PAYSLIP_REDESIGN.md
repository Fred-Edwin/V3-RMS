# Phase 9 — Payslip Feature Redesign
## Updated Feature Requirements

**Status:** Complete — deployed to production.  
**Date:** 2026-05-11  
**Supersedes:** `docs/context/PHASE_9_PAYSLIP_PLAN.md` (original implementation, now replaced)

---

## Overview

The original Phase 9 implementation (modal-based per-staff entry) has been replaced following client review. The redesigned system has two distinct sides:

1. **HR side** — A spreadsheet-style bulk payroll entry sheet that auto-saves as HR types
2. **Staff side** — A "My Payments" page replacing the old payslips page, showing live draft figures, deduction reasons, payment history, and bank/KRA details

---

## Data Model Changes

### Fields removed from `Payslip`
- `basicSalary` — client works from gross directly
- `houseAllowance` — removed
- `transportAllowance` — removed
- `nssf` (single field) — replaced by two tier fields

### Fields added to `Payslip`
- `nssfTier1 Decimal @db.Decimal(10,2)` — NSSF Tier 1 deduction
- `nssfTier2 Decimal @db.Decimal(10,2)` — NSSF Tier 2 deduction
- `advance Decimal? @db.Decimal(10,2)` — salary advance recovery (optional)
- `incentives Decimal? @db.Decimal(10,2)` — performance incentives (optional)
- `overtime Decimal? @db.Decimal(10,2)` — overtime pay (optional)

### Fields changed
- `grossPay` — promoted from server-computed to **direct admin input**. Admin enters gross; server does not compute it.
- `isLocked` — renamed semantically to `isPublished` in the UI. The DB field remains `isLocked boolean` but the user-facing label everywhere is "Published / Draft".
- `otherDeductions` JSON entries `{ label, amount }` — `label` is now **required** (it is the deduction note/reason shown to staff). The Zod schema must enforce this.

### Computed fields (server-side only, not accepted from client)
```
totalDeductions = paye + nssfTier1 + nssfTier2 + sha + housingLevy
                  + (helb ?? 0) + (advance ?? 0) + sum(otherDeductions)

netPay = grossPay − totalDeductions
```

Note: `overtime` and `incentives` are earnings additions — they are NOT included in totalDeductions. They are displayed in the earnings section on the payslip print view.

### Unique constraint
`@@unique([organizationId, userId, payPeriod])` — unchanged. Bulk upsert uses this key.

---

## Payslip Statuses

Two statuses only. No "lock" concept visible to users.

| DB state | HR label | Staff label |
|---|---|---|
| `isLocked = false` | Draft | Draft · HR is editing |
| `isLocked = true` | Published | Finalised |

When HR publishes a period, `isLocked` is set to `true` for all payslips in that period for that branch. The sheet becomes read-only. Staff badge changes from "Draft · HR is editing" to "Finalised" and the Print button enables.

HR or Director can **Revert to Draft** (sets `isLocked = false`) if a correction is needed after publishing. This re-enables editing and returns staff view to Draft state.

---

## Roles & Access

| Role | Access |
|---|---|
| DIRECTOR | Full access — entry sheet (read/write), records tab, publish, revert |
| HR_MANAGER | Full access — entry sheet (read/write), records tab, publish, revert |
| MANAGER | Payslip Records tab only — read-only, print only. No entry sheet access. |
| WAITER / CHEF / BARISTA | Own payslips only via My Payments page |
| ACCOUNTANT | My Payments page only — own payslips, read-only. No access to HR entry sheet or records tab. |
| KITCHEN_DISPLAY / BARISTA_DISPLAY | No access |
| SYSTEM_ADMIN | Full API access; no dedicated UI |

---

## HR / Director Side — `/app/hr/payroll`

> **Note:** The route was implemented as `/app/hr/payroll` (not `/app/hr/payslips` as originally planned). The sidebar nav item is labelled "Payroll".

### Page structure
One page, two tabs:

**Tab 1: Payroll Entry**
The spreadsheet entry sheet.

**Tab 2: Payslip Records**
A searchable, filterable list of all saved payslips.

### Payroll Entry tab

#### Controls row (above sheet)
- Pay period picker (month input)
- Branch selector (Director sees all branches; HR Manager sees all branches)
- Auto-save status indicator (replaces Save button — see Auto-save below)
- **Publish Payroll** button — top right. Disabled if period is already published.
- **Revert to Draft** button — appears only when period is published. Requires confirmation dialog.

#### The sheet
- One row per active staff member at the selected branch (or all branches)
- Columns in this exact order, matching client's Excel sheet:

| Column | Type | Notes |
|---|---|---|
| # (row number) | Read-only | Shows row state indicator |
| NAME | Read-only | Sticky. Staff name + role tag |
| GROSS Salary | Input | Admin enters directly |
| PAYE | Input | |
| SHA (NHIF) | Input | |
| NSSF (Tier 1) | Input | |
| NSSF (Tier 2) | Input | |
| Housing Levy | Input | |
| N.C.N.S / Deductions | Input (stacked) | Amount on top, required note below |
| Advance | Input | Optional |
| Incentives | Input | Optional |
| O.T | Input | Overtime, optional |
| Total Deductions | Computed | Red fill, read-only, live |
| Net Salary | Computed | Green fill, read-only, live |

- **Live computation** — Total Deductions and Net Salary update in the row as admin types, without a server call. This is purely client-side arithmetic.
- **Name column is sticky** — stays visible during horizontal scroll
- **Totals row** at the bottom — running sum of all columns, updates live
- **Status bar** at very bottom (Excel-style green bar) — shows staff count, row states, and total Gross / Deductions / Net

#### Read-only reference columns (far right of sheet, after Net Salary)
Two additional read-only columns are appended after Net Salary. They are not payroll input — they are pulled from `EmployeeProfile` so HR can see at a glance whose details are missing before printing payslips.

| Column | Source | Notes |
|---|---|---|
| KRA PIN | `EmployeeProfile.kraPIN` | Read-only. Shows `— Not set` with amber highlight if missing. |
| Bank Account | `EmployeeProfile.bankName + accountNumber (masked)` | Read-only. Shows `— Not set` with amber highlight if missing. |

- These columns are always visible — missing data is highlighted amber so HR knows which staff need to update their details before payslips are printed
- HR cannot edit these cells on the sheet — staff update their own details via My Payments → Bank & KRA Details tab
- HR can also edit via the employee profile page (existing HR module)
- "Not set" rows do not block payroll publishing — the payslip prints with `—` in those fields

#### Row state indicators (in row number cell)
- ✓ (green) — saved, staff can see this row's figures
- ● (amber, pulsing) — edited since last auto-save, not yet persisted
- 🔒 grey — period is published, row is read-only

#### Auto-save behaviour
- **Trigger:** 1.5 seconds after the user stops typing in a row
- **Scope:** Saves only the row that was edited (not the whole sheet)
- **On success:** Row indicator flips from ● to ✓ silently. No toast, no interruption.
- **On failure:** Row indicator turns red ✗. A non-intrusive error appears: "Auto-save failed for [Name] — check connection." Row stays dirty.
- **No Save button** — auto-save is the only save mechanism
- **Staff visibility** — staff see updated figures on their next page load/refresh. No WebSocket push required.

#### Publish behaviour
- HR/Director clicks **Publish Payroll**
- Confirmation dialog: "Publish payroll for April 2026 — Kingz? This will finalise figures for X staff. Staff will be able to print their payslips."
- On confirm: all payslips for that period + branch are marked `isLocked = true`
- Sheet becomes fully read-only (all inputs disabled)
- Row indicators all show 🔒
- Publish button is replaced by **Revert to Draft** button
- Staff side: badge changes from "Draft · HR is editing" → "Finalised", Print button enables

#### Revert to Draft behaviour
- HR/Director clicks **Revert to Draft**
- Confirmation dialog: "Revert April 2026 — Kingz to draft? Staff will see figures as draft again and will not be able to print until you re-publish."
- On confirm: all payslips for that period + branch are marked `isLocked = false`
- Sheet becomes editable again
- Staff side: badge reverts to "Draft · HR is editing", Print button disables

#### Sheet tabs (bottom of sheet)
- One tab per recent pay period (last 6 months + current)
- Clicking a tab loads that period's data into the same sheet
- Active tab highlighted in green

#### Published period sheet
- All inputs disabled
- Row indicators show 🔒
- A banner inside the sheet: "April 2026 is published. Staff can see and print their payslips. Click Revert to Draft to make corrections."

### Payslip Records tab
- Filter bar: pay period, branch, staff member, status (Draft / Published / All)
- Table columns: Staff Member | Branch | Period | Gross | Deductions | Net Pay | Status | Actions
- Actions per row: Print button (always), Edit link (goes back to entry sheet for that period, opens at that row)
- Pagination: 20 per page

---

## New API Endpoints

### `POST /payslips/bulk-upsert`
Accepts an array of payslip rows for a single pay period and branch.
- Each row is upserted on `(organizationId, userId, payPeriod)` unique key
- Server computes `totalDeductions` and `netPay` — client values for these fields are ignored
- Only unlocked (draft) payslips can be upserted; locked rows are skipped and returned in a `skipped` array
- Returns `{ saved: PayslipWithRelations[], skipped: string[] }`
- Roles: DIRECTOR, HR_MANAGER, SYSTEM_ADMIN

### `POST /payslips/publish`
Publishes all payslips for a given period + branch (sets `isLocked = true`).
- Body: `{ payPeriod: string, organizationId: string }`
- Roles: DIRECTOR, HR_MANAGER

### `POST /payslips/revert`
Reverts a published period back to draft (sets `isLocked = false`).
- Body: `{ payPeriod: string, organizationId: string }`
- Roles: DIRECTOR, HR_MANAGER

### Existing endpoints to remove
- `POST /payslips` (single create) — replaced by bulk-upsert
- `PATCH /payslips/:id` (single update) — replaced by bulk-upsert
- `POST /payslips/:id/lock` — replaced by publish/revert

---

## Staff Side — `/app/payslips` (renamed to My Payments)

### Who sees this page
All human staff roles: WAITER, CHEF, BARISTA, MANAGER, HR_MANAGER, DIRECTOR, ACCOUNTANT.
Each sees only their own payslips. No cross-staff visibility on this page.

### Page title
"My Payments" — replaces "My Payslips"

### Three tabs

#### Tab 1: Current Month
- Shows the most recent pay period's payslip for the logged-in staff member
- **If draft:** Amber banner — "Estimated — not yet finalised. HR is still preparing this payroll. If anything looks wrong, speak to HR or your manager now."
- **If published:** Green banner — "Finalised. Your payroll for [period] has been published."
- Hero card: Gross Pay | Total Deductions | Net Pay (prominent)
- Breakdown: Earnings section (Gross, OT, Incentives) | Deductions section (PAYE, SHA, NSSF T1, NSSF T2, Housing Levy, HELB, Advance, Other deductions with note)
- Other deductions show the note/reason inline — staff can see exactly why a deduction was made
- Net pay summary: Gross − Deductions = Net Pay
- **Print button** — disabled while Draft, enabled when Published

#### Tab 2: Payment History
- Table of all past payslips: Period | Gross | Deductions | Net Pay | Status | Print
- Print disabled for Draft periods
- Most recent first

#### Tab 3: Bank & KRA Details
- Staff can view and edit their own:
  - KRA PIN
  - Bank name
  - Account number (displayed masked — last 4 digits only)
  - Account name
  - Bank branch
  - HELB deduction amount (if applicable)
- These fields are stored on `EmployeeProfile` (future task — flagged)
- For now: fields are editable inline with a save button
- These details print on the payslip when HR/Manager prints it
- If not set, fields show "— Not set" with a prompt to update

### Data refresh
- No WebSocket push required
- Staff see updated figures on page load / manual refresh
- A "Refresh" button at the top of the Current Month tab for convenience

---

## Payslip Print Layout (Kenya Standard)

Triggered by `window.print()` with print-specific CSS class. No PDF library needed.

### Structure (A4 portrait)

```
┌─────────────────────────────────────────────────┐
│  [Logo]  WENDO COFFEE BISTRO                    │
│          [Branch Name]                          │
│          Employer KRA PIN: [EMPLOYER KRA PIN]   │
├─────────────────────────────────────────────────┤
│  PAYSLIP                                        │
│  Employee: [Name]          Staff #: [ID]        │
│  Job Title: [Title]        KRA PIN: [PIN]       │
│  Pay Period: April 2026    Pay Date: 30 Apr 2026│
├─────────────────────────────────────────────────┤
│  EARNINGS                                       │
│  Gross Salary         KES XX,XXX                │
│  Overtime             KES X,XXX    (if any)     │
│  Incentives           KES X,XXX    (if any)     │
├─────────────────────────────────────────────────┤
│  DEDUCTIONS                                     │
│  PAYE                 KES X,XXX                 │
│  SHA (NHIF)           KES XXX                   │
│  NSSF Tier 1          KES XXX                   │
│  NSSF Tier 2          KES XXX                   │
│  Housing Levy         KES XXX                   │
│  HELB                 KES XXX      (if any)     │
│  Advance              KES X,XXX    (if any)     │
│  [Note]               KES X,XXX    (if any)     │
├─────────────────────────────────────────────────┤
│  Total Earnings       KES XX,XXX                │
│  Total Deductions     KES X,XXX                 │
│  ┌─────────────────────────────────────────┐   │
│  │  NET PAY            KES XX,XXX          │   │
│  └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│  PAYMENT DETAILS                                │
│  Bank: [Bank Name]    Branch: [Bank Branch]     │
│  A/C: ••••••••4821    Name: [Account Name]      │
├─────────────────────────────────────────────────┤
│  Prepared by: _____________   Date: ________    │
│  Employee signature: ________                   │
└─────────────────────────────────────────────────┘
```

- Employer KRA PIN: use placeholder `[EMPLOYER KRA PIN]` until stored on Organization model
- Employee KRA PIN and bank details from `EmployeeProfile` if set, else show `—`
- NET PAY is large and prominent (boxed)
- Signature lines at bottom for HR and employee

---

## Pages to Remove / Modify

| Page | Action |
|---|---|
| `/app/payslips` | Keep route, replace content with My Payments (3-tab layout) |
| `/app/hr/payslips` | Keep route, replace content with tabbed HR sheet |
| `/app/manage/payslips` | Keep route, content becomes Payslip Records tab only (read-only, no entry sheet) |
| `/app/accountant/payslips` | **Delete** — Accountant uses `/app/payslips` (My Payments) like all other staff |

---

## Components to Remove

- `PayslipFormModal.tsx` — replaced by the inline sheet entry
- `PayslipCardList.tsx` — replaced by the My Payments page layout

## Components to Keep / Update

- `PayslipDetailModal.tsx` — repurpose as print view only (update field names)
- `PayslipTable.tsx` — repurpose as Records tab table
- `PayslipStatusBadge.tsx` — update labels: "Draft" / "Published"
- `payslip-utils.ts` — update field references

---

## Deviations from Original Plan (Implemented)

### Bank & KRA Details — implemented (was flagged as future task)
Staff can view and edit their own bank and KRA details from the My Payments → Bank & KRA Details tab. Fields stored on `EmployeeProfile`:
- `kraPIN`, `bankName`, `accountNumber`, `accountName`, `bankBranch`, `helbNumber`

**New backend route:** `PATCH /hr/profiles/my/payment-details`
- Registered **before** `/:userId` to prevent Express matching `"my"` as a userId param
- Auth: all human staff roles (`authenticate` + `requireRole`)
- Controller: `hrController.updateMyPaymentDetails`
- Validator: `updatePaymentDetailsSchema` in `hr-schemas.ts`

**New frontend service method:** `payslipService.updateMyPaymentDetails`

**Migration:** `20260510091000_add_employee_profile_bank_kra_fields`

### Staff sorting — role hierarchy
Both the HR entry sheet and the Payslip Records tab sort staff by role hierarchy then alphabetically:
```
DIRECTOR=0, HR_MANAGER=1, MANAGER=2, ACCOUNTANT=3, CHEF=4, BARISTA=5, WAITER=6
```

### Stale closure fix — auto-save
`autoSaveRow` in `hr/payroll/page.tsx` uses a `rowsRef` (updated via `useEffect`) to always read the latest row state, bypassing the stale closure capture in the debounced callback.

### Production migration fix
The `20260510025111_redesign_payslip_fields` migration initially failed in production because `nssf_tier1`, `nssf_tier2`, and `sha` were added as `NOT NULL` with no default on a non-empty table. Fixed by adding `DEFAULT 0` to those columns in the migration SQL. The failed migration was resolved via `prisma migrate resolve --rolled-back` on the production server before re-running the deploy.

### Mobile UI — My Payments page
The staff My Payments page was redesigned for mobile:
- Compact header: title + one-line subtitle, no `PageHeader` component
- Hero card: Net Pay as centrepiece (large), gross/deductions as a compact supporting row below
- Unified breakdown card: earnings section + deductions section + net pay footer — one card replacing the previous three separate cards
- Payment History: table format with gross/deductions hidden on mobile (`hidden sm:table-cell`), net pay + status + print icon visible on all screens
- Bank & KRA Details read view: `truncate` on value, no fixed `min-w` on label

## Out of Scope (still pending)

- Employer KRA PIN on Organization model (placeholder `[EMPLOYER KRA PIN]` used in print view)
- WebSocket real-time push to staff (refresh-on-load is sufficient)
- Payslip email delivery
- Automated statutory deduction calculation
