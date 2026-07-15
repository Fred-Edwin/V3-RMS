# HR Profile & Contract Overhaul — Context (Living File)

This file is the source of truth for a two-session rework of the HR employee
profile flow, contract/leave-policy linkage, self-service staff details, and
document uploads. It is split into **Session 1 (Backend)** and **Session 2
(UI)** because Session 2 depends entirely on the API shape Session 1 produces.

Do not start Session 2 until Session 1 status below is marked complete and
this file has been updated with the *actual* schema/endpoints as built (not
just the planned ones).

---

## Status

- [x] Session 1 — Backend (schema, contract/leave-policy, auto-profile, self-service API) — **Complete 2026-07-14** (see "Session 1 — As Built" below)
- [x] Session 2 — UI (staff list table, self-service UI, HR contract screens, document upload UI) — **Complete 2026-07-14** (see "Session 2 — As Built" below). Remaining: production Cloudinary env-var check (ops, pre-ship).

---

## Origin / Problem Statement

HR manager feedback (via client, relayed 2026-07-14):

1. Staff should fill in their own details (personal info) so HR doesn't have
   to do data entry for every staff member — HR should only edit/correct.
2. HR needs to select a **contract** per staff member (e.g. "6-month
   contract", "1-year contract" — HR-defined, not a fixed enum), and **leave
   entitlements should depend on the contract type**. HR must be able to set
   these leave details per contract type.
3. HR currently cannot upload documents at all — no upload UI exists yet
   (Cloudinary backend is already wired and working for other modules, so
   this is a frontend + possibly env-var gap, not a missing storage
   integration).
4. Staff list should be an Excel-style table with more detail per row, and
   inactive staff should be hidden from the UI by default.

## Key Product Decision (confirmed with user)

`EmployeeProfile` creation must **not** be a manual HR action. It already is
mostly automatic today (see Current State below) — the remaining work is to
remove the redundant manual "New Profile" modal, stop guessing
`employmentType` at creation time, and let contract type be an explicit
HR-only decision made later on the staff detail page. The staff list
(Excel-style table) becomes HR's "clear view" of who has/hasn't filled in
their own details and who has/hasn't been assigned a contract — no separate
create step.

Flow after this overhaul:
1. Staff `User` account created (System Admin / HR) → `EmployeeProfile`
   auto-created in the same transaction, contract type left unset.
2. Staff logs in → fills in their own personal details (ID, DOB, phone,
   email, address, emergency contact, banking, KRA PIN, HELB) via a
   self-service "Employee Details" section on their profile page.
3. HR sees all staff (with live-filled personal data) on the Excel-style
   staff list. Clicking a row opens the detail page.
4. On the detail page, HR sets HR-only fields: contract type (from an
   HR-managed list), job title, start/end/probation dates, reporting
   manager, notes, contract documents. Assigning a contract type drives
   leave balance seeding via that contract's `LeavePolicy`.

---

## Current State (audited 2026-07-14, before this overhaul)

- `EmployeeProfile` is **already auto-created** in
  `backend/src/services/staff-service.ts:157-171` (`createStaff`) for all
  roles except `DIRECTOR`, `HR_MANAGER`, `SYSTEM_ADMIN` — with hardcoded
  `employmentType: 'FULL_TIME'` and `startDate: new Date()`. Wrapped in
  try/catch; failure is only logged, does not roll back user creation.
- A **separate, redundant** manual creation path exists:
  `POST /hr/profiles` (`hr-service.ts:35-56`, `hr-routes.ts:27-32`,
  `HR_AUTHORITY` = `HR_MANAGER`/`DIRECTOR`/`SYSTEM_ADMIN` only), surfaced in
  the frontend as the "New Profile" modal in
  `frontend/app/app/hr/staff/page.tsx:452-497`. This is what HR currently
  uses to (re)create profiles that failed silently or predate auto-creation.
  **This modal/endpoint usage goes away** under the new flow — profiles
  always exist by the time HR looks at the staff list.
- `backend/src/scripts/seed-employee-profiles.ts` is a one-off backfill
  script for pre-existing users missing a profile. Its `EXCLUDED_ROLES` list
  (`DIRECTOR, HR_MANAGER, SYSTEM_ADMIN, KITCHEN_DISPLAY, BARISTA_DISPLAY`)
  is **inconsistent** with `staff-service.ts`'s inline exclusion list (which
  omits `KITCHEN_DISPLAY`/`BARISTA_DISPLAY`) — fix in Session 1.
- `EmployeeProfile.employmentType` is currently a **required**
  (non-nullable) field of enum `EmploymentType { FULL_TIME PART_TIME
  CASUAL }` — schema at `backend/prisma/schema.prisma:1083-1119` (model) and
  `:1274-1278` (enum).
- `seedLeaveBalances` (`backend/src/repositories/hr-repository.ts:187-215`)
  hands every employee an identical flat set regardless of employment type:
  `ANNUAL: 21, SICK: 10, EMERGENCY: 5, UNPAID: 30`. No contract-type
  awareness exists anywhere in the codebase today.
- No `Contract` model exists. `HrDocumentType.CONTRACT` is only a
  document-classification tag, not a structured contract entity.
- Document upload: `POST /hr/documents/upload`
  (`hr-routes.ts:187-193`) is fully wired to Cloudinary
  (`backend/src/utils/cloudinary.ts`, same helper menu-item images use) but
  restricted to `HR_AND_MANAGER` roles only, and **the frontend Documents
  tab has no upload form** — display-only. No self-upload path exists.
- `frontend/app/app/profile/page.tsx` only edits `User` account fields
  (name, phone) via `staffService.updateStaff`, gated to
  `MANAGER`/`DIRECTOR`/`SYSTEM_ADMIN` only. It has **zero** awareness of
  `EmployeeProfile` fields today.
- Staff list (`frontend/app/app/hr/staff/page.tsx`) uses a plain native
  `<table>`, not `ExcelTable`. Filter defaults to `ALL` (inactive staff
  shown by default).
- `ExcelTable` component exists and is production-proven:
  `frontend/components/ui/ExcelTable.tsx` — see usage example in
  `frontend/app/app/director/other-income/page.tsx`.

---

## Session 1 — Backend Scope

### Schema changes

- [ ] `EmployeeProfile.employmentType` → make nullable (`EmploymentType?`).
      Remove the hardcoded `'FULL_TIME'` default from
      `staff-service.ts:163`; auto-creation now only sets `userId` +
      `startDate: new Date()`, contract type left unset.
- [ ] New `ContractType` model (org-scoped, HR-defined — not a fixed enum,
      per explicit user requirement: *"He did not say full time/part-time,
      he said the contracts are 6 month contract, 1 year contract etc — he
      should be able to set these."*):
      ```prisma
      model ContractType {
        id             String   @id @default(uuid())
        organizationId String?  // null = system-wide, like other HR org scoping
        name           String   // e.g. "6-Month Contract", "1-Year Contract"
        durationMonths Int?
        isActive       Boolean  @default(true)
        createdAt      DateTime @default(now())
        updatedAt      DateTime @updatedAt

        leavePolicies  LeavePolicy[]
        employeeProfiles EmployeeProfile[]
      }
      ```
- [ ] New `LeavePolicy` model (per-contract-type leave entitlement,
      HR-editable):
      ```prisma
      model LeavePolicy {
        id             String    @id @default(uuid())
        contractTypeId String
        leaveType      LeaveType // reuse existing enum: ANNUAL/SICK/EMERGENCY/UNPAID
        totalDays      Int

        contractType   ContractType @relation(fields: [contractTypeId], references: [id])

        @@unique([contractTypeId, leaveType])
      }
      ```
- [ ] `EmployeeProfile` gets `contractTypeId String?` (FK to `ContractType`).
      Decide during implementation whether `employmentType` is kept
      alongside `contractTypeId` (recommended: keep both —
      `employmentType` answers a different question than contract
      duration and existing reports may depend on it) or folded away.
      **Record the final decision here once made.**
- [ ] No schema change needed for `HrDocument` — self-upload just needs a
      route/controller permission change (see below).
- [ ] Generate migration via `npx prisma migrate dev --name <name>` per
      `CLAUDE.md` migration workflow. Commit the migration file.

### Backend logic changes

- [ ] Remove `POST /hr/profiles` as a user-facing action (decide: delete
      entirely, or keep as an internal/admin-only escape hatch for the rare
      failed-auto-creation case — lean toward keeping the endpoint but
      removing all frontend UI for it in Session 2, since `createStaff`
      failures are caught+logged not surfaced).
- [ ] `seedLeaveBalances` becomes contract-driven: read `LeavePolicy` rows
      for the profile's `contractTypeId`. If `contractTypeId` is null,
      seed nothing (balances populate once HR assigns a contract).
- [ ] New endpoint: `PATCH /hr/profiles/:userId/contract` — HR assigns/
      changes a staff member's `contractTypeId`. On change, re-seed/adjust
      `LeaveBalance` rows for the current leave year from the new
      `LeavePolicy`. Decide behavior when downgrading (e.g. staff already
      used more days than new policy allows) — flag for user decision
      during implementation, don't silently clamp.
- [ ] New endpoints for contract type management (`HR_AUTHORITY` only):
      - `GET /hr/contract-types`
      - `POST /hr/contract-types`
      - `PATCH /hr/contract-types/:id`
      - Each contract type's leave policy rows managed inline (nested
        create/update) or via a small sub-resource — decide during
        implementation, document final shape here.
- [ ] New self-service endpoint, e.g. `PATCH /hr/profiles/me` — staff can
      update only their own personal fields: `nationalId`, `dateOfBirth`,
      `personalPhone`, `personalEmail`, `physicalAddress`,
      `emergencyName`, `emergencyRelation`, `emergencyPhone`, `kraPIN`,
      `bankName`, `accountNumber`, `accountName`, `bankBranch`,
      `helbNumber`. Explicitly exclude HR-only fields (`employmentType`,
      `contractTypeId`, `startDate`, `endDate`, `probationEndDate`,
      `jobTitle`, `reportingManagerId`, `notes`) — reject if present in
      payload, don't just ignore silently.
- [ ] `POST /hr/documents/upload`: extend role check to allow self-upload.
      Controller must enforce (a) non-HR uploaders can only attach to
      their **own** `employeeProfileId`, and (b) restrict self-serviceable
      `documentType` values (e.g. `ID_COPY`, `CERTIFICATE` — self OK;
      `CONTRACT`, `WARNING_LETTER`, `INCIDENT_REPORT` — HR-only). Define
      the exact allowed-for-self list here once implemented.
- [ ] Fix `EXCLUDED_ROLES` mismatch: align `staff-service.ts`'s inline
      exclusion list with `seed-employee-profiles.ts`'s `EXCLUDED_ROLES`
      (both should exclude `KITCHEN_DISPLAY`/`BARISTA_DISPLAY`).
- [ ] Decide + document: what happens to existing profiles that have
      placeholder `employmentType: FULL_TIME` from auto-creation — leave
      as-is (HR corrects over time) or null them out in a backfill. Not
      urgent; low stakes either way.
- [ ] Add Zod validators for all new endpoints per `CLAUDE.md` non-negotiable #6.
- [ ] Tests for: contract-driven leave seeding, self-service field
      allowlist enforcement, self-upload ownership + doc-type restriction.

### Explicitly out of scope for Session 1

- Any frontend changes (Session 2).
- Disciplinary "Add Record" form (adjacent known gap, not part of this
  overhaul — separate task if picked up).

---

## Session 2 — UI Scope (blocked until Session 1 is complete)

**Before starting: read the "Session 1 — As Built" section below (added by
Session 1 when it finishes) for the actual final schema/endpoint shapes.
Do not assume the planned shapes above are exactly what was built.**

- [ ] Delete the "New Profile" modal/button from
      `frontend/app/app/hr/staff/page.tsx` — profiles always exist now.
- [ ] Staff list → `ExcelTable` (pattern:
      `frontend/app/app/director/other-income/page.tsx`). Default filter
      to ACTIVE only; hide inactive unless explicitly toggled. Columns:
      name, branch, contract type, start date, leave balance snapshot,
      personal-info-completeness indicator, documents-on-file count.
- [ ] Self-service "Employee Details" section on
      `frontend/app/app/profile/page.tsx` (or new tab) — form for the
      personal fields listed under Session 1's self-service endpoint,
      available to all roles with an `EmployeeProfile`, not just
      MANAGER/DIRECTOR/SYSTEM_ADMIN as today's edit gate restricts.
      Plus a "My Documents" upload widget for self-serviceable doc types.
- [ ] HR staff detail page (`frontend/app/app/hr/staff/[userId]/page.tsx`):
      - New "Contract" section: assign contract type from HR-managed
        list, show resulting leave policy, override affordance for
        individual balance adjustments.
      - New HR settings screen for Contract Types & Leave Policy CRUD
        (`ExcelTable`/`Sheet` candidate).
      - Documents tab: add the actual upload form (Cloudinary already
        wired; confirm env vars set on the DigitalOcean droplet first).
- [ ] Confirm `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/
      `CLOUDINARY_API_SECRET` are set in production `.env` before
      shipping upload UI (ops check, not code).

---

## Session 1 — As Built (2026-07-14)

### Schema (migration: `backend/prisma/migrations/20260714061723_add_contract_types_and_leave_policies/`)

- `EmployeeProfile.employmentType` → `EmploymentType?` (nullable). **Kept**
  alongside `contractTypeId` per the plan's recommendation; still editable via
  the existing HR `PATCH /hr/profiles/:userId`. Existing `FULL_TIME`
  placeholder values were **left as-is** (no backfill; HR corrects over time).
- `EmployeeProfile.contractTypeId String?` + relation `contractType` +
  `@@index([contractTypeId])`. FK is `ON DELETE SET NULL`.
- New `ContractType` (`contract_types`): `id`, `organizationId String?`
  (nullable, relation to Organization; created as `null`/system-wide in
  practice — HR authority is cross-branch), `name`, `durationMonths Int?`,
  `isActive Boolean @default(true)`, timestamps. Relations: `leavePolicies`,
  `employeeProfiles`. Soft-delete via `isActive` only — no hard delete
  endpoint (profiles may reference it).
- New `LeavePolicy` (`leave_policies`): `id`, `contractTypeId`, `leaveType`
  (existing `LeaveType` enum), `totalDays Int`,
  `@@unique([contractTypeId, leaveType])`, `onDelete: Cascade` from
  ContractType.
- No `HrDocument` schema change (as planned).
- Note: the local dev DB had drift, so the migration SQL was generated with
  `prisma migrate diff --from-migrations`, applied manually to the local DB,
  and marked applied with `prisma migrate resolve`. Production applies it via
  the normal CI `migrate deploy`. An unrelated `payslips` drift block that
  `migrate diff` emitted was **removed** from the migration by hand.

### Endpoints (all in `hr-routes.ts`; role arrays are the existing
`HR_AUTHORITY` / `HR_AND_MANAGER` / `ALL_STAFF` constants there)

| Endpoint | Roles | Notes |
|---|---|---|
| `GET /hr/contract-types?includeInactive=true` | HR_AUTHORITY | Returns `{ contractTypes }`, each with `leavePolicies[]` + `_count.employeeProfiles`. Default: active only. |
| `POST /hr/contract-types` | HR_AUTHORITY | Body `{ name, durationMonths?, leavePolicies: [{ leaveType, totalDays }] }` (min 1 policy row, no duplicate leaveTypes). 409 on duplicate active name (case-insensitive). Returns 201 `{ contractType }`. |
| `PATCH /hr/contract-types/:id` | HR_AUTHORITY | Body: any of `name`, `durationMonths`, `isActive`, `leavePolicies`. `leavePolicies`, when present, **replaces the full set** (deleteMany + create, atomic). Policy edits do NOT retroactively touch already-seeded balances. |
| `PATCH /hr/profiles/:userId/contract` | HR_AUTHORITY | Body `{ contractTypeId: uuid \| null }`. Assign: validates contract exists + `isActive`, then atomically sets it and syncs current-year `LeaveBalance` rows from the contract's LeavePolicy (see semantics below). `null` clears the contract and leaves balances untouched. Returns `{ profile }` (full profile include). |
| `PATCH /hr/profiles/me` | ALL_STAFF | Self-service personal details. Body: `nationalId, dateOfBirth, personalPhone, personalEmail, physicalAddress, emergencyName, emergencyRelation, emergencyPhone, kraPIN, bankName, accountNumber, accountName, bankBranch, helbNumber` (all optional/nullable). Zod schema is `.strict()` — HR-only fields in the payload **fail validation** (not silently ignored). Registered before `/:userId`. |
| `POST /hr/documents/upload` | **ALL_STAFF** (was HR_AND_MANAGER) | Non-HR/manager uploaders: own `employeeUserId` only + doc type must be in `SELF_UPLOADABLE_DOCUMENT_TYPES = [ID_COPY, CERTIFICATE, MEDICAL_CERTIFICATE, OTHER]` (`backend/src/utils/hr-constants.ts`). `CONTRACT`, `WARNING_LETTER`, `INCIDENT_REPORT` remain HR/manager-only. MANAGER remains own-branch scoped. `documentType` is now Zod-validated (was an unchecked cast). Permission logic: `hrService.authorizeDocumentUpload`. |

### Balance-sync semantics on contract assignment
(`hrRepository.assignContractAndSyncBalances`)

- Policy leave types: upserted for the current calendar year —
  `totalDays` set to the policy value on both create and update.
- Existing balance rows whose leave type is NOT in the new policy: `totalDays`
  set to `0` (row kept for history).
- `usedDays`/`pendingDays` are **never modified** — downgrading below
  already-used days yields visibly negative availability; HR corrects via the
  existing `PUT /hr/leave/balances/:userId/:leaveType`. No silent clamping.

### Other changes

- `staffService.createStaff`: profile now created **atomically** with the
  user (nested create in `staffRepository.create({ withEmployeeProfile })`),
  setting only `startDate: new Date()` — no `employmentType` guess, no leave
  seeding. The old try/catch-and-log path is gone; profiles always exist.
- Excluded roles unified in `PROFILE_EXCLUDED_ROLES`
  (`backend/src/utils/hr-constants.ts`): `DIRECTOR, HR_MANAGER, SYSTEM_ADMIN,
  KITCHEN_DISPLAY, BARISTA_DISPLAY` — used by both `staff-service.ts` and
  `seed-employee-profiles.ts`.
- `POST /hr/profiles` **kept** as an HR_AUTHORITY escape hatch;
  `employmentType` now optional in its schema; it no longer seeds leave
  balances. Session 2 removes its frontend UI ("New Profile" modal).
- `hrRepository.seedLeaveBalances` (flat 21/10/5/30 defaults) **deleted** —
  replaced by contract-driven `assignContractAndSyncBalances`.
- `seed-employee-profiles.ts` backfill: no longer sets `employmentType` or
  seeds balances.
- `profileWithUser` / `listProfiles` includes now return
  `contractType: { id, name, durationMonths, isActive } | null` — Session 2's
  staff-list contract column reads this.

### Tests added

- `src/services/hr-service.test.ts` — assignContract permissions/validation,
  contract-type CRUD auth + duplicate name, self-service own-profile-only,
  `authorizeDocumentUpload` matrix (HR any / manager branch-scoped / staff
  self-only + doc-type allowlist).
- `src/repositories/hr-repository.test.ts` — balance-sync semantics
  (policy upserts, orphaned-type zeroing, null-clear touches nothing,
  empty-policy contract seeds nothing).
- `src/validators/hr-schemas.test.ts` — strict rejection of each HR-only
  field on the self-service schema; contract-type schema rules.

All 453 backend tests pass; `pnpm build` clean.

---

## Session 2 — As Built (2026-07-14)

### One small backend addition (beyond Session 1)

- `hrRepository.listProfiles` include extended with `leaveBalances: true` and
  `_count: { select: { documents: true } }` — feeds the staff list's
  Leave Left and Docs columns. Frontend `EmployeeProfile` type gained
  `contractTypeId`, `contractType`, `helbNumber`, optional `leaveBalances`,
  optional `_count.documents`; `employmentType` is now `EmploymentType | null`.

### Staff list (`frontend/app/app/hr/staff/page.tsx`) — rewritten

- Now an `ExcelTable` (navy band, numbered). Columns: Employee (name +
  job title/role), Branch, Contract ("Not assigned" amber pill when null),
  Started, Leave Left (sum of `totalDays − used − pending` across current-year
  balances; red when negative), Details Filled (`x/13` completeness pill over
  the 13 self-service personal fields, excluding `helbNumber`), Docs count,
  Status, actions (transfer + open).
- **Default filter is ACTIVE** — inactive staff hidden unless the Inactive
  stat card is clicked. Third stat card: "No contract assigned" (active staff
  without a contract; warn styling).
- "New Profile" modal/button, the missing-profiles alert, and the
  `staffWithoutProfiles` computation are **deleted**. Header action is now a
  link to Contract Types. `createEmployeeProfile` still exists in
  `hrService.ts` but has no remaining UI caller.

### Contract Types screen (`frontend/app/app/hr/contract-types/page.tsx`) — new

- HR_AUTHORITY-only (client-side gate + API enforces). ExcelTable listing:
  name, duration (months / "Open-ended"), per-leave-type entitlement columns,
  assigned-staff count, active status, edit.
- Create/Edit modal: name, optional duration, **all four leave types always
  submitted** (0 allowed) — satisfies the backend's min-1-policy rule without
  add/remove row UI. Edit adds an isActive checkbox (deactivate = soft
  delete) and a not-retroactive warning when staff are on the contract.
- Nav: added "Contract Types" to HR_MANAGER desktop sidebar and mobile
  overflow tabs (`frontend/app/app/layout.tsx`, `ScrollText` icon).
  DIRECTOR/SYSTEM_ADMIN reach it via the Staff Profiles header button/URL.

### HR staff detail (`frontend/app/app/hr/staff/[userId]/page.tsx`)

- Header: contract-type badge (amber "No contract assigned" when null);
  employment-type badge only shown when set.
- Overview: new full-width "Contract & Leave Policy" card. HR sees a
  contract select (active types + the currently-assigned inactive one, marked
  "— inactive"), Assign/Clear button (disabled when unchanged), the selected
  contract's leave entitlement preview, and a note pointing at the LeaveTab
  pencil-edit for one-off balance overrides (that affordance already existed).
  Non-HR viewers (managers) see a read-only contract line.
- Overview: new "Banking & Statutory" InfoCard (KRA PIN, bank details, HELB)
  so HR can verify staff-filled data.
- Documents tab: upload form (doc-type select with all 7 types, file input
  PDF/JPG/PNG ≤10 MB, posts to `/hr/documents/upload`, refreshes list).
- Edit modal: Employment Type gains a "— Not set —" option; empty value is
  omitted from the PATCH (the HR update schema has no null for it).

### Self-service profile (`frontend/app/app/profile/page.tsx`)

- New "Employee Details" section for roles with an EmployeeProfile
  (mirror list of backend `PROFILE_EXCLUDED_ROLES`; section also hides
  gracefully if the profile GET fails). Form covers all 14 self-service
  fields; empty inputs are sent as `null` (backend rejects empty strings);
  saves via new `hrService.updateMyEmployeeProfile` → `PATCH /hr/profiles/me`.
- New "My Documents" section: lists own documents
  (`GET /hr/documents/:userId`, self-access) and uploads restricted to
  `SELF_UPLOADABLE_DOCUMENT_TYPES` (`ID_COPY, CERTIFICATE,
  MEDICAL_CERTIFICATE, OTHER`) — constant mirrored in `frontend/types/hr.ts`.
- Existing name/phone edit and its MANAGER/DIRECTOR/SYSTEM_ADMIN gate are
  unchanged.

### New frontend service functions (`frontend/services/hrService.ts`)

`updateMyEmployeeProfile`, `assignContract`, `listContractTypes`,
`createContractType`, `updateContractType`. New types in
`frontend/types/hr.ts`: `ContractType`, `ContractTypeSummary`, `LeavePolicy`,
`LeavePolicyInput`, `Create/UpdateContractTypeInput`,
`SelfServiceProfileInput`, `SELF_UPLOADABLE_DOCUMENT_TYPES`.
`employmentTypeLabel` now accepts null → "Not set".

### Verification

- Backend: `pnpm build` clean, 453/453 tests pass.
- Frontend: `pnpm build` clean; `/app/hr/contract-types` route emitted.
- **Outstanding (ops, before shipping upload UI to prod):** confirm
  `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
  are set in the droplet's backend `.env`. Local dev creds are placeholders.

---

## Open Decisions Log

Record any decision made during implementation that wasn't pre-decided
above, so Session 2 doesn't have to guess or re-litigate:

- **`employmentType` kept** alongside `contractTypeId` (plan's recommended
  option). Existing placeholder `FULL_TIME` values left as-is, no backfill.
- **Downgrade behavior**: totalDays always set to the new policy value;
  used/pending preserved → negative availability is shown, never clamped.
  HR fixes outliers via the existing per-balance adjustment endpoint.
- **Leave-policy edits are not retroactive**: `PATCH /hr/contract-types/:id`
  with new `leavePolicies` affects future assignments only. To push a policy
  change to an already-assigned employee, re-assign the same contract via
  `PATCH /hr/profiles/:userId/contract` (idempotent, re-syncs balances).
- **`POST /hr/profiles` kept** (HR_AUTHORITY escape hatch); its UI goes away
  in Session 2. Less relevant now that creation is transactional.
- **Leave policies managed inline** on the contract-type endpoints
  (replace-all array), not a sub-resource.
- **Self-uploadable doc types**: `ID_COPY, CERTIFICATE, MEDICAL_CERTIFICATE,
  OTHER`.
- **Unassigning a contract** (`contractTypeId: null`) leaves balances
  untouched.
- **No hard-delete for contract types** — deactivate via `isActive: false`;
  inactive types can't be newly assigned but existing assignments stand.
