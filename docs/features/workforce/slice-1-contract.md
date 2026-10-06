# Workforce slice 1 (People): contract

**Status:** DRAFT for the owner's approval, 6 Oct 2026. Nothing is built. Code in this session: none.
**Branch:** `feat/workforce-people` (lane 2), from `main` at `f8480ac` (slice 0 is merged there as PR #86).
**Sources:** `slice-0-contract.md` (as built and frozen), `README.md` and `proposal.md` of this folder, the code on `main`, and the approved Paper chapters 2, 3 and 4 of "Workforce · A. The people" (read live, 6 Oct 2026). Where Paper disagrees with itself I say so and say what I chose (sections 8 and 11).

**How to read this (owner).** Most of the length is code the backend session copies; you do not need to read it. Read these, in about 20 minutes: section 1 (what slice 1 is and is not), section 2.1 and 2.5 (what changes in the database, and what happens to today's people), section 3.1 to 3.3 (who can do and see what), section 5.1 (the flows in plain steps), section 8 (screens, and what is left for later slices), section 10 (what is replaced and what is left broken on purpose), and **section 11 (the questions, each with my recommendation)**. Sections 4, 6.2, 7 and 9 are for the builders.

**Placeholders.** Every number, list or name that looks like a policy value (the 7-day undo window, exit reasons, employee-number format, starter positions, standard hours, probation verdicts) is an **example** the owner can change. None is a legal or policy value. Statutory values are not touched in this slice.

**Checks run on this draft** (all in scratch files and scratch databases outside the repo, deleted afterwards; nothing in the repo changed except this file):
1. **Schema.** The Prisma block in 2.3 was extracted from this document and validated with `prisma validate` on a scratch copy of the real schema. `prisma migrate diff` against today's schema produced exactly **13 new tables, 7 new enums and one in-place change** (`hr_documents`); no statement touches `users` or `organizations` except foreign keys pointing at them. A database migrated with it shows "No difference detected" against the schema.
2. **Migration and backfill.** The generated DDL, the raw SQL in 2.4 and the backfill in 2.5 (extracted from this document, not retyped) were run on **scratch copies of the seeded lane database**: the plain seed, and the seed plus fixtures (an HR user, three profiles including one casual, a custom job title, a contract, an inactive user, a display account, a document). They were run twice through `psql` and once as **one combined migration file through `prisma migrate deploy`** (the way production applies it); all three gave the same counts. The proof assertions of 2.6 all passed. Results are in 2.6. That process found and fixed two defects in my first draft of the backfill (a NULL in "tracks time" for a user with no profile, and a wrong column name), and one omission in my schema (the `ProbationNote` table that Paper's probation screens need).
3. **Code.** Every TypeScript block was extracted from this document and compiled with `tsc --noEmit` under the backend's strict settings against the real `zod` 4, `express` 5, a `@prisma/client` generated from the new schema into a scratch folder, and the real slice 0 files (the access amendment was applied to a scratch copy of the real `workforce-access.ts`). It compiled clean. The pure functions and schemas were then run against the examples in this document: the Paper dates (5 Oct plus 3 months is 5 Jan; 31 Oct plus 7 days is 7 Nov), Joy Chebet's 67% and a new hire's 50%, the head-claim rules, the validators' refusals, and that the SQL's "tracks time" role list equals `defaultTracksTime()` for all 15 roles.
4. **Access.** The results quoted in 3.1 were produced by running the real slice 0 access code (`lockedGroupsFor`, `grantsOf`), not written from memory; the amended head-scope rules were run the same way.

---

## 1. Scope and non-goals

**Slice 1 builds** (backend first, then screens in a separate session):

1. **The employee file**: one proper record for everyone who works for Wendo, casuals included (no login needed), replacing today's `User` + `EmployeeProfile` split for personal and job data.
2. **Contract** (a record with a type and dates), **pay profile** (sensitive) and **pay history** with the Director's approval of a change.
3. **Departments, positions and department heads** as real records (a head is a responsibility, not a flag), including an **acting head** while the head is away, and **positions offered by departments**.
4. **The HR screens' data**: people list and summary, add employee (drafts, duplicate check, hire, login), the file and its tabs, edit job, change pay, probation decision and notes, transfer, send to another site, exit with undo, rehire, the Organisation page and the Positions page.
5. **The employee's own side**: first-sign-in "finish your file" (own details, photo, NSSF and SHA) and the emergency-contact request.
6. **Wiring**: the real "tracks time" lookup (replacing the role default), `department.head_changed` emitted and the `isDepartmentHead` / `departmentTag` claims kept in step, and a small **daily scheduler** for dated changes.
7. **Backfill** of today's active human users into the new records, provable on a copy of the database.

**Slice 1 deliberately does not**:
- touch `User` columns, the login token, `authenticate.ts`, Access files (apart from three agreed one-line back-relations and one guard line in `hardDeleteStaff`) or Inventory (section 6);
- build the rota, shift templates, clock, timesheets, overtime, **approvals ("Waiting for you")**, leave, payroll, conduct or the audit-log screens. Where an approved People screen shows something from those slices, slice 1 returns it empty and the screen shows the "Designed later" frame (section 8): the Time, Leave and Conduct tabs, the on-time, overtime and leave-left cells, the Activity tab, "Ask HR to change something", on-shift status and heads-on-leave;
- generate or sign PDFs (contract, offer letter, head appointment letter, certificate of service): those arrive with Signed documents (slice 4). The `Contract` record is created now; `signedDocumentId` stays empty until then;
- deliver notifications (it emits events and calls the slice 0 notifier stub; wording comes from the approved "Shared · Notifications" table when delivery is built);
- send the first-sign-in email (Paper says a link is emailed; no email service exists in the code. The HR screen shows the temporary password once, as today);
- change any rule value or statutory table, or invent one.

---

## 2. Data

### 2.1 Conventions and what changes from slice 0

Follow slice 0 (`slice-0-contract.md` 2.1): the place is `Site`, field `siteId`, column `organization_id`; uuid ids; `@db.Date` dates holding the **Nairobi** calendar day (`toDateColumn` / `fromDateColumn`); `Decimal(12,2)` money; snake-case columns by `@map`; plural table names. New models live in a new folder **`backend/prisma/schema/workforce/people.prisma`** (slice 0 question 14: the folder split starts here; slice 0's file stays where it is). Every repository query on a tenant-scoped model carries `siteId` or `companyId`.

Slice 1 migrates the models slice 0 designed in 2.4 and **changes them in these ways** (Session 2 copies this table into the amendment log of `slice-0-contract.md` in the same commit as the schema):

| Slice 0 said | Slice 1 does | Reason |
|---|---|---|
| `Employee` has no `companyId` | adds `companyId` and makes employee numbers unique per company, not per site | one number series for the company; cheap company-wide queries |
| `PayProfile.amount` required | optional | a Branch Manager hires the basics; HR sets pay later. "Payroll waits" until it is set |
| `PayProfile` has no hours | adds `standardWeekHours` and `standardDayHours` (nullable) | the approved Pay step shows "Standard week 48 h" and "Standard day 8 h" per person |
| `PayoutMethod` is `BANK, MPESA` | adds `CASH` | the approved Statutory and bank step offers Cash |
| `Position` has name and "tracks time" only | adds `loginRole`, `casualsAllowed`, and a join table `DepartmentPosition` | the approved Positions page and the Add department dialog show "login role", "casuals allowed" and "offered by" |
| `Department` has `name`, `inventoryTag` | adds `description`; a partial unique index on (site, tag) | the Organisation page shows a one-line description; one department per tag per site (slice 0 comment) |
| `DepartmentHead` has start and end | adds `isActing`, `endedById`, `endReason`; `assignedById` optional | acting head while the head is away; the backfill has no assigner |
| `Contract` has no creator | adds `createdById` (optional) and a relation to the legacy `ContractType` | leave policy still hangs off `ContractType` until slice 5 |
| (not designed) | adds `PayChange`, `EmploymentSpell`, `EmployeeMove`, `FileRequest`, `EmployeeDraft`, `ProbationNote` | pay history with approval; exit, undo and rehire on one file; transfer and "send to another site"; "ask Joy for her emergency contact"; the Add employee draft; the probation notes in Chapter 4 |
| `Employee` has `probationEndsOn` | adds `probationExtensions`, `probationDecidedOn`, `probationConfirmedOn`, `tracksTimeOverride`, `statutoryVerifiedAt/ById`, `hiredById` | probation decision "completes once the contract exists"; per-person override of the position's "clocks in"; HR verifies NSSF and SHA |
| `HrDocument` needs an `EmployeeProfile` | adds `employeeId`; `employeeProfileId` becomes optional (delete stays restricted) | the Director, HR and every casual have no legacy profile but need documents |
| `Employee.user` may be deleted with the user | deleting a `User` who has an `Employee` is refused (restrict) | nothing about a person is ever deleted |

### 2.2 Enums

```prisma
// file: backend/prisma/schema/workforce/people.prisma   (enums; all multi-line, Prisma rejects single-line enums)
enum PayType { ... }            // MONTHLY_SALARY, DAILY_RATE
enum EmploymentStatus { ... }   // ONBOARDING, ACTIVE, ON_LEAVE, SUSPENDED, NOTICE, EXITED
enum ContractStatus { ... }     // NONE, ACTIVE, ENDED
enum PayoutMethod { ... }       // BANK, MPESA, CASH
enum PayChangeStatus { ... }    // PENDING, APPROVED, DECLINED, CANCELLED
enum MoveKind { ... }           // TRANSFER, LOAN
enum MoveStatus { ... }         // SCHEDULED, ACTIVE, DONE, CANCELLED
```

The full text is in 2.3. `ON_LEAVE` and `SUSPENDED` are set by slices 5 and 7; slice 1 only reads them. Lists that are policy-like stay as **code constants, not enums**, so changing them needs no migration (`people.constants.ts`, section 5.5): exit reasons, pay change reasons, file request kinds, probation verdicts.

### 2.3 Models (exact)

```prisma
// file: backend/prisma/schema/workforce/people.prisma
// ---- Workforce slice 1: People ------------------------------------------------------------
// Declared in slice-0-contract.md section 2.2 and 2.4, changed here (see slice-1-contract.md section 2 and the amendment log).

enum PayType {
  MONTHLY_SALARY
  DAILY_RATE
}

enum EmploymentStatus {
  ONBOARDING
  ACTIVE
  ON_LEAVE
  SUSPENDED
  NOTICE
  EXITED
}

enum ContractStatus {
  NONE
  ACTIVE
  ENDED
}

enum PayoutMethod {
  BANK
  MPESA
  CASH
}

enum PayChangeStatus {
  PENDING
  APPROVED
  DECLINED
  CANCELLED
}

enum MoveKind {
  TRANSFER
  LOAN
}

enum MoveStatus {
  SCHEDULED
  ACTIVE
  DONE
  CANCELLED
}

model Department {
  id           String         @id @default(uuid())
  siteId       String         @map("organization_id")
  name         String
  description  String?
  inventoryTag DepartmentTag? @map("inventory_tag")
  isActive     Boolean        @default(true) @map("is_active")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  site      Site                 @relation(fields: [siteId], references: [id])
  employees Employee[]
  heads     DepartmentHead[]
  positions DepartmentPosition[]

  @@unique([siteId, name])
  @@index([siteId])
  // Raw SQL in the migration: unique (organization_id, inventory_tag) WHERE inventory_tag IS NOT NULL
  @@map("departments")
}

model Position {
  id                String    @id @default(uuid())
  companyId         String    @map("company_id")
  name              String
  defaultTracksTime Boolean   @default(true) @map("default_tracks_time")
  loginRole         UserRole? @map("login_role")
  casualsAllowed    Boolean   @default(true) @map("casuals_allowed")
  isActive          Boolean   @default(true) @map("is_active")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  employees   Employee[]
  departments DepartmentPosition[]

  @@unique([companyId, name])
  @@map("positions")
}

model DepartmentPosition {
  departmentId String @map("department_id")
  positionId   String @map("position_id")

  department Department @relation(fields: [departmentId], references: [id])
  position   Position   @relation(fields: [positionId], references: [id])

  @@id([departmentId, positionId])
  @@index([positionId])
  @@map("department_positions")
}

model Employee {
  id                    String           @id @default(uuid())
  companyId             String           @map("company_id")
  siteId                String           @map("organization_id")
  userId                String?          @unique @map("user_id")
  employeeNumber        String           @map("employee_number")
  name                  String
  departmentId          String?          @map("department_id")
  positionId            String?          @map("position_id")
  reportsToId           String?          @map("reports_to_id")
  status                EmploymentStatus @default(ONBOARDING)
  payType               PayType          @map("pay_type")
  contractStatus        ContractStatus   @default(NONE) @map("contract_status")
  tracksTime            Boolean          @default(true) @map("tracks_time")
  tracksTimeOverride    Boolean          @default(false) @map("tracks_time_override")
  startDate             DateTime         @map("start_date") @db.Date
  probationEndsOn       DateTime?        @map("probation_ends_on") @db.Date
  probationExtensions   Int              @default(0) @map("probation_extensions")
  probationDecidedOn    DateTime?        @map("probation_decided_on") @db.Date
  probationConfirmedOn  DateTime?        @map("probation_confirmed_on") @db.Date
  exitedOn              DateTime?        @map("exited_on") @db.Date
  photoUrl              String?          @map("photo_url")
  nationalId            String?          @map("national_id")
  kraPin                String?          @map("kra_pin")
  shaNumber             String?          @map("sha_number")
  nssfNumber            String?          @map("nssf_number")
  helbNumber            String?          @map("helb_number")
  dateOfBirth           DateTime?        @map("date_of_birth") @db.Date
  personalPhone         String?          @map("personal_phone")
  personalEmail         String?          @map("personal_email")
  physicalAddress       String?          @map("physical_address")
  emergencyName         String?          @map("emergency_name")
  emergencyRelation     String?          @map("emergency_relation")
  emergencyPhone        String?          @map("emergency_phone")
  statutoryVerifiedAt   DateTime?        @map("statutory_verified_at")
  statutoryVerifiedById String?          @map("statutory_verified_by_id")
  hiredById             String?          @map("hired_by_id")
  legacyProfileId       String?          @unique @map("legacy_profile_id")
  createdAt             DateTime         @default(now()) @map("created_at")
  updatedAt             DateTime         @updatedAt @map("updated_at")

  site           Site              @relation(fields: [siteId], references: [id])
  user           User?             @relation(fields: [userId], references: [id], onDelete: Restrict)
  department     Department?       @relation(fields: [departmentId], references: [id])
  position       Position?         @relation(fields: [positionId], references: [id])
  reportsTo      Employee?         @relation("EmployeeReportsTo", fields: [reportsToId], references: [id])
  reports        Employee[]        @relation("EmployeeReportsTo")
  payProfile     PayProfile?
  payChanges     PayChange[]
  contracts      Contract[]
  heads          DepartmentHead[]
  spells         EmploymentSpell[]
  moves          EmployeeMove[]
  fileRequests   FileRequest[]
  documents      HrDocument[]
  probationNotes ProbationNote[]

  @@unique([companyId, employeeNumber])
  @@index([siteId, status])
  @@index([departmentId])
  @@index([positionId])
  @@index([companyId, nationalId])
  @@map("employees")
}

model Contract {
  id               String         @id @default(uuid())
  employeeId       String         @map("employee_id")
  contractTypeId   String?        @map("contract_type_id")
  startsOn         DateTime       @map("starts_on") @db.Date
  endsOn           DateTime?      @map("ends_on") @db.Date
  status           ContractStatus @default(ACTIVE)
  signedDocumentId String?        @map("signed_document_id")
  createdById      String?        @map("created_by_id")
  createdAt        DateTime       @default(now()) @map("created_at")

  employee     Employee      @relation(fields: [employeeId], references: [id])
  contractType ContractType? @relation(fields: [contractTypeId], references: [id])

  @@index([employeeId, status])
  @@map("contracts")
}

model PayProfile {
  id                String        @id @default(uuid())
  employeeId        String        @unique @map("employee_id")
  amount            Decimal?      @db.Decimal(12, 2)
  overtimeEligible  Boolean       @default(false) @map("overtime_eligible")
  standardWeekHours Decimal?      @map("standard_week_hours") @db.Decimal(5, 2)
  standardDayHours  Decimal?      @map("standard_day_hours") @db.Decimal(4, 2)
  payoutMethod      PayoutMethod? @map("payout_method")
  bankName          String?       @map("bank_name")
  bankBranch        String?       @map("bank_branch")
  accountName       String?       @map("account_name")
  accountNumber     String?       @map("account_number")
  mpesaPhone        String?       @map("mpesa_phone")
  updatedById       String?       @map("updated_by_id")
  updatedAt         DateTime      @updatedAt @map("updated_at")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@map("pay_profiles")
}

model PayChange {
  id            String          @id @default(uuid())
  employeeId    String          @map("employee_id")
  amount        Decimal         @db.Decimal(12, 2)
  effectiveFrom DateTime        @map("effective_from") @db.Date
  reason        String
  status        PayChangeStatus @default(PENDING)
  requestedById String?         @map("requested_by_id")
  requestedAt   DateTime        @default(now()) @map("requested_at")
  decidedById   String?         @map("decided_by_id")
  decidedAt     DateTime?       @map("decided_at")
  decisionNote  String?         @map("decision_note")
  appliedAt     DateTime?       @map("applied_at")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([employeeId, effectiveFrom])
  @@index([status, requestedAt])
  // Raw SQL in the migration: unique (employee_id) WHERE status = 'PENDING'
  @@map("pay_changes")
}

model EmploymentSpell {
  id              String    @id @default(uuid())
  employeeId      String    @map("employee_id")
  startsOn        DateTime  @map("starts_on") @db.Date
  endedOn         DateTime? @map("ended_on") @db.Date
  exitReason      String?   @map("exit_reason")
  exitNote        String?   @map("exit_note")
  uniformReturned Boolean   @default(false) @map("uniform_returned")
  exitSnapshot    Json?     @map("exit_snapshot")
  endedById       String?   @map("ended_by_id")
  endedAt         DateTime? @map("ended_at")
  finalizedAt     DateTime? @map("finalized_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([employeeId, startsOn])
  // Raw SQL in the migration: unique (employee_id) WHERE ended_on IS NULL
  @@map("employment_spells")
}

model EmployeeMove {
  id               String     @id @default(uuid())
  employeeId       String     @map("employee_id")
  kind             MoveKind
  status           MoveStatus @default(SCHEDULED)
  fromSiteId       String     @map("from_site_id")
  toSiteId         String     @map("to_site_id")
  fromDepartmentId String?    @map("from_department_id")
  toDepartmentId   String?    @map("to_department_id")
  toPositionId     String?    @map("to_position_id")
  toReportsToId    String?    @map("to_reports_to_id")
  startsOn         DateTime   @map("starts_on") @db.Date
  endsOn           DateTime?  @map("ends_on") @db.Date
  summary          Json?
  createdById      String     @map("created_by_id")
  createdAt        DateTime   @default(now()) @map("created_at")
  appliedAt        DateTime?  @map("applied_at")
  cancelledAt      DateTime?  @map("cancelled_at")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([employeeId, startsOn])
  @@index([status, startsOn])
  // Raw SQL in the migration: unique (employee_id) WHERE kind = 'TRANSFER' AND status = 'SCHEDULED'
  @@map("employee_moves")
}

model DepartmentHead {
  id           String    @id @default(uuid())
  departmentId String    @map("department_id")
  employeeId   String    @map("employee_id")
  isActing     Boolean   @default(false) @map("is_acting")
  startsOn     DateTime  @map("starts_on") @db.Date
  endsOn       DateTime? @map("ends_on") @db.Date
  assignedById String?   @map("assigned_by_id")
  endedById    String?   @map("ended_by_id")
  endReason    String?   @map("end_reason")

  department Department @relation(fields: [departmentId], references: [id])
  employee   Employee   @relation(fields: [employeeId], references: [id])

  @@index([departmentId, endsOn])
  @@index([employeeId, endsOn])
  // Raw SQL in the migration: unique (department_id) WHERE ends_on IS NULL AND NOT is_acting;
  //                           unique (employee_id) WHERE ends_on IS NULL
  @@map("department_heads")
}

model FileRequest {
  id         String    @id @default(uuid())
  employeeId String    @map("employee_id")
  kind       String
  askedById  String    @map("asked_by_id")
  askedAt    DateTime  @default(now()) @map("asked_at")
  remindedAt DateTime? @map("reminded_at")
  resolvedAt DateTime? @map("resolved_at")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([employeeId, resolvedAt])
  @@map("file_requests")
}

model ProbationNote {
  id         String   @id @default(uuid())
  employeeId String   @map("employee_id")
  authorId   String   @map("author_id")
  authorKind String   @map("author_kind")
  verdict    String
  note       String?
  createdAt  DateTime @default(now()) @map("created_at")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([employeeId, createdAt])
  @@map("probation_notes")
}

model EmployeeDraft {
  id          String   @id @default(uuid())
  companyId   String   @map("company_id")
  createdById String   @map("created_by_id")
  kind        String
  step        Int      @default(1)
  payload     Json
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([companyId, createdById])
  @@map("employee_drafts")
}
```

**Changed in place elsewhere** (excerpts; the rest of each model is untouched):

```prisma
// file: backend/prisma/schema/access.prisma   (three lines, no column changes)
//   model Site { ... departments Department[]  employees Employee[] ... }
//   model User { ... employee Employee? ... }
// file: backend/prisma/schema/workforce.prisma
//   model ContractType { ... contracts Contract[] ... }
//   model HrDocument {
//     employeeProfileId String?  @map("employee_profile_id")        // was required
//     employeeId        String?  @map("employee_id")                // new
//     employeeProfile   EmployeeProfile? @relation(fields: [employeeProfileId], references: [id], onDelete: Restrict)
//     employee          Employee?        @relation(fields: [employeeId], references: [id])
//     @@index([employeeId])
//   }
```

### 2.4 Raw SQL in the migration (after the generated DDL, before the backfill)

```sql
-- Raw SQL Prisma cannot express (appended to the generated migration, before the backfill).

CREATE UNIQUE INDEX "departments_site_tag_key"
  ON "public"."departments" ("organization_id", "inventory_tag")
  WHERE "inventory_tag" IS NOT NULL;

CREATE UNIQUE INDEX "department_heads_one_head_per_department"
  ON "public"."department_heads" ("department_id")
  WHERE "ends_on" IS NULL AND NOT "is_acting";

CREATE UNIQUE INDEX "department_heads_one_open_row_per_employee"
  ON "public"."department_heads" ("employee_id")
  WHERE "ends_on" IS NULL;

CREATE UNIQUE INDEX "pay_changes_one_pending_per_employee"
  ON "public"."pay_changes" ("employee_id")
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "employee_moves_one_scheduled_transfer"
  ON "public"."employee_moves" ("employee_id")
  WHERE "kind" = 'TRANSFER' AND "status" = 'SCHEDULED';

CREATE UNIQUE INDEX "employment_spells_one_open_spell"
  ON "public"."employment_spells" ("employee_id")
  WHERE "ended_on" IS NULL;

ALTER TABLE "public"."contracts"
  ADD CONSTRAINT "contracts_dates_chk" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");
ALTER TABLE "public"."department_heads"
  ADD CONSTRAINT "department_heads_dates_chk" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");
ALTER TABLE "public"."employee_moves"
  ADD CONSTRAINT "employee_moves_dates_chk" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on"),
  ADD CONSTRAINT "employee_moves_loan_sites_chk" CHECK ("kind" <> 'LOAN' OR "from_site_id" <> "to_site_id");
ALTER TABLE "public"."pay_profiles"
  ADD CONSTRAINT "pay_profiles_amount_chk" CHECK ("amount" IS NULL OR "amount" >= 0);
ALTER TABLE "public"."pay_changes"
  ADD CONSTRAINT "pay_changes_amount_chk" CHECK ("amount" >= 0);
```

The generated DDL is the output of `prisma migrate diff` from today's schema to this one. Migration folder: `backend/prisma/schema/migrations/<timestamp>_workforce_people/` holds the DDL, then 2.4, then the backfill (2.5), in one file, so it applies atomically on deploy. **One-line back-relations outside the module (agreed in 6.1):** `Site` gets `departments Department[]` and `employees Employee[]`; `User` gets `employee Employee?`. In `workforce.prisma`: `ContractType` gets `contracts Contract[]`; `HrDocument` changes as in 2.1. No column anywhere else changes (checked by `migrate diff`).

### 2.5 Backfill (exact logic)

**What it does, in plain words.** For every **active human user** it creates one `Employee` (with a number like `W-0001`), an empty `PayProfile` (bank details come across if they exist; there are no pay amounts today), one `EmploymentSpell`, and a `Contract` only where the old profile already named a contract type. It creates the departments (five per active branch, `Stores` and `Head office` at the hub), a starter list of positions HR can rename, and department heads from today's head flags. It never writes to `users` or `employee_profiles`.

Rules (each is in the SQL below):
- **Who is brought across:** `users.is_active`, not deleted, role not `SYSTEM_ADMIN` (no personal file: decision D15 and the access table), not `KITCHEN_DISPLAY` or `BARISTA_DISPLAY` (devices). The Director, HR Manager and Accountant **do** get a file (they have `me.file`). Inactive or deleted users are **not** migrated (question 4). Users with no site (HR, today) are placed at the **hub site**; if there is no hub they are skipped and reported.
- **Departments, not "tags in use":** membership today is derived from role (`utils/departments.ts`), so only a few people carry a tag. The backfill therefore makes the five standard departments at every active branch and places people by role (Chef to Kitchen, Waiter to Service, Barista to Barista, Steward and Housekeeping to Housekeeping), or by the head's own tag; Store Manager and Store Attendant to `Stores` at the hub; Director, HR and Accountant to `Head office` at the hub; Branch Managers to no department. (The brief said "tags in use"; that would have left most people without a department. Question 3.)
- **Tracks time** (decision D2) by role, or a legacy `CASUAL` profile. A test proves the SQL list equals `defaultTracksTime()` for all 15 roles.
- **Pay type:** `DAILY_RATE` if the profile says `CASUAL`, else `MONTHLY_SALARY`. **Contract status:** `ACTIVE` only where the profile had a contract type, else `NONE` ("No contract yet").
- **Dates:** legacy timestamps are converted to the Nairobi calendar day (`pg_temp.nairobi_date`). A user with no profile starts on the day the account was created.
- **Heads:** one `DepartmentHead` per head flag with a tag, in the department with that tag at the person's site; the start date is the account's last change (the real date was never recorded; the proof prints it as estimated). Duplicates or a head with no tag are skipped and reported.
- **Idempotent:** every insert is guarded, every update only fills a NULL. The same text is the migration's backfill and the re-runnable script (`people-backfill.ts` exports it; a test compares it with the migration).

```sql
-- Workforce slice 1: backfill People from User + EmployeeProfile.
-- Idempotent: every INSERT is guarded, every UPDATE only fills a NULL. Safe to run twice.
-- Writes only to the new tables and hr_documents.employee_id. Never writes to users or employee_profiles.

DROP TABLE IF EXISTS pg_temp._people_humans;
DROP TABLE IF EXISTS pg_temp._people_starters;
DROP TABLE IF EXISTS pg_temp._people_starter_depts;

-- A UTC-midnight timestamp (or any instant) -> its Nairobi calendar date.
CREATE OR REPLACE FUNCTION pg_temp.nairobi_date(ts timestamp) RETURNS date
  LANGUAGE sql IMMUTABLE AS $$ SELECT (ts AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Nairobi')::date $$;

-- Decision D2: who clocks in by default. Must equal defaultTracksTime() in workforce-access.ts (a test compares them).
CREATE OR REPLACE FUNCTION pg_temp.tracks_by_role(role_name text) RETURNS boolean
  LANGUAGE sql IMMUTABLE AS $$
    SELECT role_name IN ('WAITER','CHEF','BARISTA','STEWARD','HOUSEKEEPING','DEPARTMENT_HEAD','STORE_ATTENDANT','ACCOUNTANT')
  $$;

CREATE OR REPLACE FUNCTION pg_temp.dept_by_tag(site_id text, tag "DepartmentTag") RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT d.id FROM departments d WHERE d.organization_id = site_id AND d.inventory_tag = tag $$;

CREATE OR REPLACE FUNCTION pg_temp.dept_by_name(site_id text, dept_name text) RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT d.id FROM departments d WHERE d.organization_id = site_id AND d.name = dept_name $$;

-- 1. Departments: five per active branch, two at the hub. (Membership today is derived from role, so "tags in use"
--    would miss most people.) Existing rows are left alone.
INSERT INTO departments (id, organization_id, name, inventory_tag, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, o.id, v.name, v.tag::"DepartmentTag", true, now(), now()
FROM organizations o
JOIN (VALUES
  ('BRANCH', 'Kitchen', 'KITCHEN'),
  ('BRANCH', 'Pastry', 'PASTRY'),
  ('BRANCH', 'Barista', 'BARISTA'),
  ('BRANCH', 'Service', 'SERVICE'),
  ('BRANCH', 'Housekeeping', 'HOUSEKEEPING'),
  ('CENTRAL_STORE', 'Stores', NULL),
  ('CENTRAL_STORE', 'Head office', NULL)
) AS v(site_type, name, tag) ON v.site_type = o.type::text
WHERE o."isActive"
ON CONFLICT (organization_id, name) DO NOTHING;

-- 2. Starter positions (names are examples HR can rename or retire).
CREATE TEMP TABLE _people_starters (name text, role_name text, tracks boolean, casuals boolean);
INSERT INTO _people_starters VALUES
  ('Waiter', 'WAITER', true, true),
  ('Chef', 'CHEF', true, true),
  ('Barista', 'BARISTA', true, true),
  ('Steward', 'STEWARD', true, true),
  ('Housekeeper', 'HOUSEKEEPING', true, true),
  ('Store Attendant', 'STORE_ATTENDANT', true, false),
  ('Store Manager', 'STORE_MANAGER', false, false),
  ('Branch Manager', 'MANAGER', false, false),
  ('Accountant', 'ACCOUNTANT', true, false),
  ('HR Manager', 'HR_MANAGER', false, false),
  ('Director', 'DIRECTOR', false, false);

CREATE TEMP TABLE _people_starter_depts (position_name text, tag text, dept_name text);
INSERT INTO _people_starter_depts VALUES
  ('Waiter', 'SERVICE', NULL),
  ('Chef', 'KITCHEN', NULL),
  ('Chef', 'PASTRY', NULL),
  ('Barista', 'BARISTA', NULL),
  ('Steward', 'HOUSEKEEPING', NULL),
  ('Housekeeper', 'HOUSEKEEPING', NULL),
  ('Store Attendant', NULL, 'Stores'),
  ('Store Manager', NULL, 'Stores'),
  ('Accountant', NULL, 'Head office'),
  ('HR Manager', NULL, 'Head office'),
  ('Director', NULL, 'Head office');

INSERT INTO positions (id, company_id, name, default_tracks_time, login_role, casuals_allowed, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, c.id, s.name, s.tracks, s.role_name::"UserRole", s.casuals, true, now(), now()
FROM companies c CROSS JOIN _people_starters s
WHERE c.is_active
ON CONFLICT (company_id, name) DO NOTHING;

-- 3. The people to bring across: active human users with no Employee yet.
--    Not migrated: the System Admin (no personal file, decision D15), display accounts, inactive or deleted users.
CREATE TEMP TABLE _people_humans AS
SELECT u.id AS user_id, u.name, u.role::text AS role_name, u.phone, u.department_tag, u.is_department_head,
       u.created_at AS user_created_at,
       COALESCE(o.company_id, (SELECT c.id FROM companies c WHERE c.is_active ORDER BY c.created_at LIMIT 1)) AS company_id,
       COALESCE(o.id, (SELECT h.id FROM organizations h WHERE h.type = 'CENTRAL_STORE' AND h."isHub" ORDER BY h.created_at LIMIT 1)) AS site_id
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
WHERE u.is_active
  AND u.deleted_at IS NULL
  AND u.role NOT IN ('SYSTEM_ADMIN', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY')
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.user_id = u.id);

-- 3a. Custom positions: a job title in use that no starter already carries (compared ignoring case and spaces).
INSERT INTO positions (id, company_id, name, default_tracks_time, login_role, casuals_allowed, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, g.company_id, g.title, g.tracks, g.login_role, false, true, now(), now()
FROM (
  SELECT h.company_id,
         min(btrim(p.job_title)) AS title,
         bool_or(pg_temp.tracks_by_role(h.role_name) OR COALESCE(p.employment_type = 'CASUAL', false)) AS tracks,
         CASE WHEN count(DISTINCT h.role_name) = 1 THEN (array_agg(h.role_name))[1]::"UserRole" END AS login_role
  FROM _people_humans h
  JOIN employee_profiles p ON p.user_id = h.user_id
  WHERE p.job_title IS NOT NULL AND btrim(p.job_title) <> ''
  GROUP BY h.company_id, lower(btrim(p.job_title))
) g
WHERE g.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions x WHERE x.company_id = g.company_id AND lower(x.name) = lower(g.title))
ON CONFLICT (company_id, name) DO NOTHING;

-- 3b. Employees. Numbers continue after the highest "W-####" already issued for the company.
WITH base AS (
  SELECT h.*, p.id AS profile_id, p.national_id, p.date_of_birth, p.personal_phone, p.personal_email, p.physical_address,
         p.emergency_name, p.emergency_relation, p.emergency_phone, p.employment_type::text AS employment_type,
         p.contract_type_id, p.start_date AS profile_start, p.probation_end_date, p.job_title,
         p.kra_pin, p.shif_nhif_number, p.nssf_number, p.helb_number
  FROM _people_humans h
  LEFT JOIN employee_profiles p ON p.user_id = h.user_id
  WHERE h.company_id IS NOT NULL AND h.site_id IS NOT NULL
), dated AS (
  SELECT b.*, COALESCE(pg_temp.nairobi_date(b.profile_start), pg_temp.nairobi_date(b.user_created_at)) AS start_on
  FROM base b
), numbered AS (
  SELECT d.*, row_number() OVER (PARTITION BY d.company_id ORDER BY d.start_on, d.user_created_at, d.user_id) AS rn
  FROM dated d
)
INSERT INTO employees (
  id, company_id, organization_id, user_id, employee_number, name, department_id, position_id, status, pay_type,
  contract_status, tracks_time, start_date, probation_ends_on, national_id, kra_pin, sha_number, nssf_number,
  helb_number, date_of_birth, personal_phone, personal_email, physical_address, emergency_name, emergency_relation,
  emergency_phone, legacy_profile_id, created_at, updated_at)
SELECT
  gen_random_uuid()::text, n.company_id, n.site_id, n.user_id,
  'W-' || lpad((n.rn + COALESCE((SELECT max(substring(e.employee_number FROM 3)::int)
                                 FROM employees e
                                 WHERE e.company_id = n.company_id AND e.employee_number ~ '^W-[0-9]+$'), 0))::text, 4, '0'),
  n.name,
  CASE
    WHEN n.is_department_head AND n.department_tag IS NOT NULL THEN pg_temp.dept_by_tag(n.site_id, n.department_tag)
    WHEN n.role_name = 'WAITER' THEN pg_temp.dept_by_tag(n.site_id, 'SERVICE')
    WHEN n.role_name = 'CHEF' THEN pg_temp.dept_by_tag(n.site_id, 'KITCHEN')
    WHEN n.role_name = 'BARISTA' THEN pg_temp.dept_by_tag(n.site_id, 'BARISTA')
    WHEN n.role_name IN ('STEWARD', 'HOUSEKEEPING') THEN pg_temp.dept_by_tag(n.site_id, 'HOUSEKEEPING')
    WHEN n.role_name IN ('STORE_MANAGER', 'STORE_ATTENDANT') THEN pg_temp.dept_by_name(n.site_id, 'Stores')
    WHEN n.role_name IN ('DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT') THEN pg_temp.dept_by_name(n.site_id, 'Head office')
    ELSE NULL
  END,
  COALESCE(
    (SELECT x.id FROM positions x WHERE x.company_id = n.company_id AND n.job_title IS NOT NULL
        AND lower(x.name) = lower(btrim(n.job_title))),
    (SELECT x.id FROM positions x JOIN _people_starters s ON s.name = x.name
        WHERE x.company_id = n.company_id AND s.role_name = n.role_name)
  ),
  'ACTIVE'::"EmploymentStatus",
  (CASE WHEN n.employment_type = 'CASUAL' THEN 'DAILY_RATE' ELSE 'MONTHLY_SALARY' END)::"PayType",
  (CASE WHEN n.contract_type_id IS NOT NULL THEN 'ACTIVE' ELSE 'NONE' END)::"ContractStatus",
  (pg_temp.tracks_by_role(n.role_name) OR COALESCE(n.employment_type = 'CASUAL', false)),
  n.start_on,
  pg_temp.nairobi_date(n.probation_end_date),
  n.national_id, n.kra_pin, n.shif_nhif_number, n.nssf_number, n.helb_number,
  pg_temp.nairobi_date(n.date_of_birth),
  COALESCE(n.personal_phone, n.phone), n.personal_email, n.physical_address,
  n.emergency_name, n.emergency_relation, n.emergency_phone,
  n.profile_id, now(), now()
FROM numbered n;

-- 3c. Reporting lines, once everyone exists.
UPDATE employees e
SET reports_to_id = m.id
FROM employee_profiles p
JOIN employees m ON m.user_id = p.reporting_manager_id
WHERE e.legacy_profile_id = p.id AND e.reports_to_id IS NULL AND p.reporting_manager_id IS NOT NULL;

-- 4. An (empty) pay profile for everyone; bank details come across, pay amounts do not exist today.
INSERT INTO pay_profiles (id, employee_id, overtime_eligible, payout_method, bank_name, bank_branch, account_name, account_number, updated_at)
SELECT gen_random_uuid()::text, e.id, false,
       (CASE WHEN p.account_number IS NOT NULL AND btrim(p.account_number) <> '' THEN 'BANK' END)::"PayoutMethod",
       p.bank_name, p.bank_branch, p.account_name, p.account_number, now()
FROM employees e
LEFT JOIN employee_profiles p ON p.id = e.legacy_profile_id
WHERE NOT EXISTS (SELECT 1 FROM pay_profiles x WHERE x.employee_id = e.id);

-- 5. One employment spell each.
INSERT INTO employment_spells (id, employee_id, starts_on, created_at)
SELECT gen_random_uuid()::text, e.id, e.start_date, now()
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM employment_spells s WHERE s.employee_id = e.id);

-- 6. A contract where the legacy profile already named a contract type (leave policy hangs off that type).
INSERT INTO contracts (id, employee_id, contract_type_id, starts_on, ends_on, status, created_at)
SELECT gen_random_uuid()::text, e.id, p.contract_type_id, e.start_date,
       (CASE WHEN p.end_date IS NOT NULL AND pg_temp.nairobi_date(p.end_date) >= e.start_date THEN pg_temp.nairobi_date(p.end_date) END),
       'ACTIVE'::"ContractStatus", now()
FROM employees e
JOIN employee_profiles p ON p.id = e.legacy_profile_id
WHERE p.contract_type_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.employee_id = e.id);

-- 7. Department heads from the flags. The real start date is unknown; the account's last change is used (flagged in the proof).
INSERT INTO department_heads (id, department_id, employee_id, is_acting, starts_on)
SELECT DISTINCT ON (d.id) gen_random_uuid()::text, d.id, e.id, false, pg_temp.nairobi_date(u.updated_at)
FROM users u
JOIN employees e ON e.user_id = u.id
JOIN departments d ON d.organization_id = e.organization_id AND d.inventory_tag = u.department_tag
WHERE u.is_department_head AND u.department_tag IS NOT NULL AND u.is_active
  AND NOT EXISTS (SELECT 1 FROM department_heads h WHERE h.ends_on IS NULL AND (h.department_id = d.id OR h.employee_id = e.id))
ORDER BY d.id, u.updated_at DESC;

-- 8. Every held position is offered by the holder's department.
INSERT INTO department_positions (department_id, position_id)
SELECT d.id, p.id
FROM _people_starter_depts s
JOIN positions p ON p.name = s.position_name
JOIN organizations o ON o.company_id = p.company_id
JOIN departments d ON d.organization_id = o.id
 AND ((s.tag IS NOT NULL AND d.inventory_tag = s.tag::"DepartmentTag") OR (s.tag IS NULL AND d.name = s.dept_name))
ON CONFLICT DO NOTHING;

INSERT INTO department_positions (department_id, position_id)
SELECT DISTINCT e.department_id, e.position_id
FROM employees e
WHERE e.department_id IS NOT NULL AND e.position_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 9. Documents already on file keep their link to the legacy profile and gain the new one.
UPDATE hr_documents d
SET employee_id = e.id
FROM employees e
WHERE e.legacy_profile_id = d.employee_profile_id AND d.employee_id IS NULL;

DROP TABLE _people_humans;
DROP TABLE _people_starters;
DROP TABLE _people_starter_depts;
```

### 2.6 How to prove the backfill on a copy of the seeded database

Session 2 writes this as a script (`backend/scripts/proof/people-backfill-proof.sh`, with the fixtures in `people-backfill-fixtures.sql`, whose first statement aborts unless `current_database()` ends in `_proof`). It never touches a real lane database:

1. `createdb wendo_rms_proof_people`, then `pg_dump wendo_rms_lane2 | psql wendo_rms_proof_people`.
2. Apply the migration's **DDL and 2.4 only** (everything before the backfill), so the proof can show the backfill's own effect.
3. Optionally load the fixtures (the seeded database has **no HR user and no employee profiles**, so fixtures are the only way to exercise profiles, a casual, a custom title, a contract, bank details, an inactive user and a document).
4. **Before** counts and checksums: users, employee_profiles, hr_documents, profiles with bank details, `md5` of every `users` row and every `employee_profiles` row.
5. Run the backfill. **After** counts. Run it a second time: every count and the `md5` of `employees` must be identical.
6. Assertions (each prints `OK` or the offending rows): every eligible user has exactly one employee; every employee has exactly one pay profile and one open spell; for every legacy profile the national ID, KRA PIN, NSSF, SHA, HELB, emergency contact and bank fields equal the employee's and pay profile's; every document that had a profile has an `employee_id`; `users` and `employee_profiles` checksums equal the "before" values; the list of **not migrated** accounts (System Admin, devices, inactive, deleted, no hub) and of skipped heads is printed.
7. `prisma migrate diff --from-url <proof copy> --to-schema-datamodel prisma/schema --exit-code` must exit 0 (no drift).

**Results of this check on the scratch copies (6 Oct 2026):**

| Count | Plain seed (before to after) | Seed plus fixtures |
|---|---|---|
| users | 10 to 10 | 16 to 16 |
| employee_profiles | 0 to 0 | 3 to 3 |
| employees | 0 to **9** | 0 to **13** |
| departments | 0 to 12 (2 branches x 5, hub x 2) | 12 |
| positions (starters, plus custom titles) | 0 to 11 | 12 (one custom title) |
| department_positions | 0 to 17 | 18 |
| pay_profiles / employment_spells | 0 to 9 / 0 to 9 | 13 / 13 |
| contracts | 0 to 0 | 1 |
| department_heads | 0 to 3 | 4 |
| hr_documents with employee_id | 0 | 1 of 1 |
| second run changes | 0 | 0 |
| `users` / `employee_profiles` checksums | unchanged | unchanged |

The nine people in the plain seed are the two Branch Managers, three heads, the Accountant, the Director, the Store Manager and the Store Attendant (the System Admin is left out by rule). The fixtures' inactive user and display account are correctly left out; the casual profile becomes `DAILY_RATE` and tracks time; its custom title "kitchen HAND" becomes a position; the waiter's contract type becomes a `Contract` and `contractStatus ACTIVE`; a profile's `Nyeri` bank becomes `payout_method BANK`.

---

## 3. Access

One table, in `_shared/workforce-access.ts`, exactly as slice 0 froze it. **No `requireRole` anywhere in slice 1.** Every route is `authenticate` then `requireCapability(...)`; scope and the "not their own" rules are checked in the service on the actual record.

### 3.1 Who may do what

| Action | Capability | Who holds it (scope) |
|---|---|---|
| See the list, summary, a file's basics | `employee.read_basic` | HR, Director, Accountant, System Admin (all); Branch Manager and Store Manager (own site); a department head (the departments they head) |
| See ID numbers, DOB, address, statutory numbers; bank; documents | `employee.read_sensitive` | HR, Director, Accountant (all) |
| See pay amount, hours, pay history | `payprofile.read` | HR, Director, Accountant (all) |
| Own file, own pay profile | `me.file`, `me.payprofile` | every role with a file |
| Hire (create a file, edit it while onboarding), file requests | `employee.write_basic` | HR, System Admin (all); Branch Manager and Store Manager (own site, **basics only**) |
| Edit IDs, statutory numbers, address; create a contract; upload documents; verify NSSF and SHA | `employee.write_sensitive` | HR |
| Change pay profile, **request** a pay change | `payprofile.write` | HR |
| **Approve or decline** a pay change | `payprofile.approve` (**new**) | Director |
| Probation decision, transfer, send to another site, exit, undo, rehire, create a login | `employee.lifecycle` | HR, System Admin |
| Probation note | `probation.note` (**new**) | the head of the person's department; Branch Manager and Store Manager (own site); HR |
| See Organisation, department, positions | `org.read` | HR, Director, System Admin (all); Branch Manager, Store Manager (own site); a head (own department) |
| Add, edit, retire a department or a position | `org.write` | HR, System Admin |
| Assign, replace, end a head; name an acting head | `org.write_heads` | HR, System Admin (all); Branch Manager (own site) |

**Two capabilities are added** (logged as amendments to slice 0 section 3.2 and 3.3, in `workforce-access.ts`, with the matrix test updated): `payprofile.approve` (Director, all) and `probation.note` (head extra: dept; Branch Manager and Store Manager: unit; HR: all). The Director cannot request pay changes and HR cannot approve them, so nobody approves their own.

**Results from the real access code** (a person looking at someone else's file inside their scope; "locked" lists the sensitive groups hidden):

| Viewer | pay, bank, ids, documents locked | Can hire | Can exit, transfer, rehire |
|---|---|---|---|
| HR Manager | none locked | yes | yes |
| Director | none locked | no | no |
| Accountant | none locked | no | no |
| Branch Manager (own site) | all four locked | basics | no |
| Store Manager (hub) | all four locked | basics | no |
| Department head | all four locked | no | no |
| System Admin | all four locked | basics | yes |
| The person themself | none locked | no | no |

**Rules the matrix cannot show** (they live in services):
- **Branch Manager and the existing file.** Paper's Branch Manager view says "Ask HR to change something". So a Branch Manager (or Store Manager) may create a file and edit it **only while it is `ONBOARDING` at their own site**; afterwards edits go to HR (question 2). Pay, statutory, bank and login are always HR.
- **Fields the capability does not allow are refused, not ignored** (`403 FIELD_NOT_ALLOWED`), so a screen cannot silently lose data.
- **Out of scope:** reads answer `404`, writes `403` (slice 0 `assertInScope`). A file in another company is always `404`.
- **Casuals have no login.** They are reached through `employee.read_basic` on the head's or manager's scope; "own" never matches a casual.
- **Nobody approves their own pay change** (`SELF_APPROVAL`), though only the Director holds the capability.
- **Heads are only for branches.** The hub has no heads ("The Central Store has no departments" today; the Organisation page shows it as Complete).
- **Privileged roles.** A hire can give a login role only from the floor list (`HIRE_LOGIN_ROLES`: Waiter, Chef, Barista, Steward, Housekeeping, Store Attendant). Manager, Store Manager, Accountant, HR Manager and Director accounts are still created by the Director or System Admin through Access and are then **adopted** into a file (`POST /workforce/people` with `existingUserId`), so HR can never mint a more powerful account than today (question 5).

### 3.2 Sensitive fields (what is hidden, and how)

| Group | Fields (employee file) | Revealed to the person by | To others by |
|---|---|---|---|
| `ids` | `nationalId`, `kraPin`, `shaNumber`, `nssfNumber`, `helbNumber`, `dateOfBirth`, `physicalAddress` | `me.file` | `employee.read_sensitive` |
| `bank` | `payoutMethod`, `bankName`, `bankBranch`, `accountName`, `accountNumber`, `mpesaPhone` | `me.file` | `employee.read_sensitive` |
| `pay` | `amount`, `overtimeEligible`, `standardWeekHours`, `standardDayHours`, pay history, pending change, casual daily rates | `me.payprofile` | `payprofile.read` |
| `documents` | the document list and every document | `me.file` | `employee.read_sensitive` |

Visible to anyone who can read the file: name, photo, number, site, department, position, reports to, status, "Monthly" or "Casual", contract status (not the contract), clocks in, start date, probation dates, personal phone and email, and the emergency contact.

**Hidden means omitted from the response**, with `locked: SensitiveGroup[]` returned so the screen can show "Locked for your role". **Even to people who may see them, ID numbers and the bank account number are returned masked** (`•••• 5678`); the clear value comes only from `POST /workforce/people/:id/reveal`, which writes an audit entry ("Showed the bank account number"). Opening the Pay card (`GET .../pay`) and a document is also audited. The person's own view is clear and unaudited. Amounts never appear in an audit entry or an event (field names and "changed" only).

**What is audited for reading** (question 11): only reveals, pay opens and document opens, not an ordinary file open. Paper's Activity example shows a Branch Manager "opened the file"; logging every open would put a write lock on the whole company's audit chain for every page view. The Activity tab itself is slice 7.

### 3.3 Scope of each list

| Viewer | `GET /workforce/people` returns | `GET /workforce/org` returns |
|---|---|---|
| HR, Director, Accountant, System Admin | every site of the company | every site |
| Branch Manager, Store Manager | their own site (people on loan to the site are not listed; they stay on their home site) | their own site |
| Department head | people in the departments they head (casuals included) | their own department |
| Everyone else | `403` (the menu hides the link) | `403` |

### 3.4 Changes to the access code (`_shared/workforce-access.ts`, logged as amendments)

A department head today is "a marker on a role with a tag". That cannot express a head of a department that has no inventory tag (a Bakery HR adds, decision D6), and Kitchen and Pastry are treated as one group. Slice 1 makes the **`DepartmentHead` rows the source of truth** for Workforce:

```ts
// file: _shared/workforce-access.ts   (these definitions are replaced; everything else in the file is as built)
// Also: 'payprofile.approve' and 'probation.note' are appended to CAPABILITIES, and granted as:
//   DIRECTOR { 'payprofile.approve': 'all' };  HEAD_EXTRAS { 'probation.note': 'dept' };
//   UNIT_MANAGER { 'probation.note': 'unit' };  HR_MANAGER { 'probation.note': 'all' }.
export interface AccessSubject {
  id: string;
  role: UserRole;
  siteId: string | null;
  departmentTag?: DepartmentTag | null;
  isDepartmentHead?: boolean;
  /** Real value from the employee file (slice 1). When absent the role default (decision D2) applies. */
  tracksTime?: boolean;
  /** Slice 1: set by attachWorkforceSubject from the DepartmentHead rows. When defined it is the only source of department scope. */
  headOfDepartmentIds?: readonly string[];
}

export interface AccessTarget {
  userId: string | null;
  siteId: string | null;
  departmentTag?: DepartmentTag | null;
  /** Slice 1: the employee's department id. */
  departmentId?: string | null;
}

const isHead = (subject: AccessSubject): boolean =>
  subject.isDepartmentHead === true || subject.role === 'DEPARTMENT_HEAD' || (subject.headOfDepartmentIds?.length ?? 0) > 0;

export const grantsOf = (subject: AccessSubject): Grants => {
  const merged: Grants = { ...(ROLE_GRANTS[subject.role] ?? {}) };
  if (isHead(subject)) {
    for (const [capability, scope] of Object.entries(HEAD_EXTRAS) as [Capability, Scope][]) {
      const current = merged[capability];
      merged[capability] = current ? widest(current, scope) : scope;
    }
  }
  if ((subject.tracksTime ?? defaultTracksTime(subject.role)) === false) delete merged['time.own'];
  return merged;
};

const withinScope = (subject: AccessSubject, scope: Scope, target: AccessTarget): boolean => {
  switch (scope) {
    case 'all':
      return true;
    case 'unit':
      return subject.siteId !== null && target.siteId === subject.siteId;
    case 'dept': {
      if (subject.siteId === null || target.siteId !== subject.siteId) return false;
      if (subject.headOfDepartmentIds !== undefined) {
        return !!target.departmentId && subject.headOfDepartmentIds.includes(target.departmentId);
      }
      return !!subject.departmentTag && !!target.departmentTag && sameDepartmentGroup(subject.departmentTag, target.departmentTag);
    }
    case 'own':
      return target.userId !== null && target.userId === subject.id;
  }
};

export const requireCapability = (...capabilities: Capability[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const subject: AccessSubject = req.workforceSubject ?? req.user;
    if (!capabilities.some((c) => workforceCan(subject, c))) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    next();
  };
};
```

- `attachWorkforceSubject` (section 5.6) loads, once per request, the person's active head rows and their real "tracks time", and sets `req.workforceSubject`. `requireCapability` reads that when present, otherwise `req.user` (so slice 0's rules routes keep working unchanged).
- When `headOfDepartmentIds` is set it is the **only** source of department scope (a Pastry head no longer needs a Kitchen head to cover them); the tag-group rule remains for claim-only subjects.
- `GET /workforce/permissions/me` uses the same subject and gains `headOfDepartmentIds` (slice 0 3.6, amendment). Its `tracksTime` becomes the real value.

---

## 4. API

Base `/api/v1`, mounted by `routes/index.ts` through the Workforce door (`workforcePeopleRouter`, `workforceOrgRouter`). Conventions follow `docs/API_CONTRACT.md`: the `{ success, data }` envelope, list pagination `{ total, page, perPage, totalPages }`, dates `YYYY-MM-DD` (Nairobi), money as a **string** with up to two decimals, errors `{ success: false, error: { code, message, details } }`. Every route is `authenticate` then `requireCapability`; every body, query and param has a Zod schema in `people-validators.ts` (section 5.5) parsed before the service; ids are uuids. Static paths are registered before `/:id`.

Error vocabulary beyond the standard codes: `400 VALIDATION_ERROR`; `403 AUTHORIZATION_ERROR` (and `FIELD_NOT_ALLOWED`, `SELF_APPROVAL`, `ROLE_NOT_ALLOWED`); `404 NOT_FOUND`; `409` with a specific `code`: `DUPLICATE_NATIONAL_ID`, `DUPLICATE_PHONE`, `EMAIL_IN_USE`, `POSITION_NOT_OFFERED`, `CASUALS_NOT_ALLOWED`, `PROBATION_LIMIT`, `NO_PROBATION`, `ALREADY_EXITED`, `NOT_EXITED`, `UNDO_WINDOW_CLOSED`, `UNDO_WINDOW_OPEN`, `TRANSFER_SCHEDULED`, `PAY_CHANGE_PENDING`, `PAY_CHANGE_NOT_PENDING`, `POSITION_HELD`, `DEPARTMENT_HAS_PEOPLE`, `HEAD_NOT_ELIGIBLE`, `ALREADY_HEAD`, `ACTING_HEAD_EXISTS`, `HUB_HAS_NO_HEADS`, `ACKNOWLEDGE_IMPACT`, `LOGIN_EXISTS`.

Response types are in `people.types.ts` (section 5.5).

### 4.1 People: reads

| # | Method and path | Guard | Request (Zod) | Response | Errors |
|---|---|---|---|---|---|
| R1 | `GET /workforce/people` | `employee.read_basic` | query `ListQuerySchema` | `ListResponse<EmployeeListRow>` | 400, 401, 403 |
| R2 | `GET /workforce/people/summary` | `employee.read_basic` | query `SummaryQuerySchema` | `PeopleSummary` | 400, 401, 403 |
| R3 | `GET /workforce/people/lookups` | `employee.read_basic` or `org.read` | none | `Lookups` | 401, 403 |
| R4 | `GET /workforce/people/duplicate-check` | `employee.write_basic` | query `DuplicateQuerySchema` | `{ nationalId: boolean, phone: boolean, email: boolean }` (booleans only, never a name) | 400, 401, 403 |
| R5 | `GET /workforce/people/unlinked-accounts` | `employee.lifecycle` | query `PageQuerySchema` | `ListResponse<UnlinkedAccount>`: active human logins with no file | 401, 403 |
| R6 | `GET /workforce/people/me` | `me.file` | none | `EmployeeFileView` (own, clear values, nothing masked) | 401, 403, 404 (no file yet) |
| R7 | `GET /workforce/people/:id` | `employee.read_basic` or `me.file` | params `IdParamsSchema` | `EmployeeFileView` (masked, `locked` set) | 400, 401, 404 |
| R8 | `GET /workforce/people/:id/pay` | `payprofile.read` or `me.payprofile` | params | `PayView`. **Writes `people.pay_opened`** unless it is the person's own | 400, 401, 403, 404 |
| R9 | `GET /workforce/people/:id/documents` | `employee.read_sensitive` or `me.file` | params | `DocumentRow[]` (never the file URL) or `{ locked: ['documents'] }` | 400, 401, 404 |
| R10 | `GET /workforce/people/:id/documents/:docId` | as R9 | params | `{ url }`. **Writes `people.document_opened`** | 400, 401, 404 |
| R11 | `GET /workforce/people/pay-changes` | `payprofile.approve` or `payprofile.write` | query `PayChangesQuerySchema` (`status`, default `PENDING`) | `PayChangeRow[]` (amounts: yes, these callers hold `payprofile.read`) | 400, 401, 403 |

### 4.2 People: writes

| # | Method and path | Guard | Request (Zod) | Response | Errors |
|---|---|---|---|---|---|
| W1 | `GET /workforce/people/drafts` | `employee.write_basic` | none | the caller's own drafts | 401, 403 |
| W2 | `POST /workforce/people/drafts` | `employee.write_basic` | `DraftBodySchema` | draft | 400, 401, 403 |
| W3 | `PATCH /workforce/people/drafts/:id` | `employee.write_basic` | params, `DraftBodySchema` (step and payload) | draft | 400, 401, 404 |
| W4 | `DELETE /workforce/people/drafts/:id` | `employee.write_basic` | params | `{ deleted: true }` (drafts are not people; nothing about a hired person is ever deleted) | 400, 401, 404 |
| W5 | `POST /workforce/people` | `employee.write_basic` | `HireBodySchema` | `201 HireResult` (`employee`, `login: { created, reason? }`, `nextStep`) | 400, 401, 403, 409 (`DUPLICATE_*`, `EMAIL_IN_USE`, `POSITION_NOT_OFFERED`, `CASUALS_NOT_ALLOWED`, `ROLE_NOT_ALLOWED`) |
| W6 | `PATCH /workforce/people/:id` | `employee.write_basic` (job fields), `employee.write_sensitive` (ids, address) | params, `UpdateEmployeeSchema` | `EmployeeFileView` | 400, 401, 403, 404 |
| W7 | `PATCH /workforce/people/me` | `me.file` | `PatchMeSchema` | `EmployeeFileView` | 400, 401, 403 |
| W8 | `POST /workforce/people/:id/photo` and `.../me/photo` | `employee.write_basic` or `me.file` | multipart `file` (image, same limits as the menu image upload) | `{ photoUrl }` | 400, 401, 403, 404 |
| W9 | `PUT /workforce/people/:id/pay-profile` | `payprofile.write` | params, `PayProfileSchema` | `PayView` | 400, 401, 403, 404 |
| W10 | `POST /workforce/people/:id/pay-changes` | `payprofile.write` | params, `PayChangeSchema` | `201 PayChangeRow` (status `PENDING`) | 400, 401, 403, 404, 409 `PAY_CHANGE_PENDING` |
| W11 | `POST /workforce/people/pay-changes/:changeId/decision` | `payprofile.approve` | params, `PayChangeDecisionSchema` | `PayChangeRow` | 400, 401, 403 (`SELF_APPROVAL`), 404, 409 `PAY_CHANGE_NOT_PENDING` |
| W12 | `POST /workforce/people/:id/contract` | `employee.write_sensitive` | params, `ContractSchema` | `201 ContractRow` | 400, 401, 403, 404, 409 |
| W13 | `POST /workforce/people/:id/probation-decision` | `employee.lifecycle` | params, `ProbationDecisionSchema` | `ProbationView` (`END` returns `{ next: 'EXIT', suggestedLastDay }` and changes nothing else) | 400, 401, 403, 404, 409 `PROBATION_LIMIT`, `NO_PROBATION` |
| W14 | `POST /workforce/people/:id/probation-notes` | `probation.note` | params, `ProbationNoteSchema` | `ProbationView` | 400, 401, 403, 404, 409 `NO_PROBATION` |
| W15 | `POST /workforce/people/:id/transfer/preview` | `employee.lifecycle` | params, `TransferSchema` | `MovePreview` (nothing is written) | 400, 401, 403, 404 |
| W16 | `POST /workforce/people/:id/transfer` | `employee.lifecycle` | params, `TransferSchema` | `201 MoveRow` | 400, 401, 403, 404, 409 `TRANSFER_SCHEDULED`, `ALREADY_EXITED` |
| W17 | `POST /workforce/people/:id/loan` | `employee.lifecycle` | params, `LoanSchema` | `201 MoveRow` | 400, 401, 403, 404 |
| W18 | `POST /workforce/people/:id/moves/:moveId/cancel` and `.../end` | `employee.lifecycle` | params | `MoveRow` | 400, 401, 403, 404, 409 |
| W19 | `POST /workforce/people/:id/exit/preview` | `employee.lifecycle` | params, `ExitSchema` | `MovePreview` | 400, 401, 403, 404 |
| W20 | `POST /workforce/people/:id/exit` | `employee.lifecycle` | params, `ExitSchema` | `ExitView` | 400, 401, 403, 404, 409 `ALREADY_EXITED` |
| W21 | `PATCH /workforce/people/:id/exit/checklist` | `employee.lifecycle` | params, `ExitChecklistSchema` | `ExitView` | 400, 401, 403, 404, 409 `NOT_EXITED` |
| W22 | `POST /workforce/people/:id/exit/undo` | `employee.lifecycle` | params | `EmployeeFileView` plus `notRestored[]` | 400, 401, 403, 404, 409 `NOT_EXITED`, `UNDO_WINDOW_CLOSED` |
| W23 | `POST /workforce/people/:id/rehire` | `employee.lifecycle` | params, `RehireSchema` | `EmployeeFileView` | 400, 401, 403, 404, 409 `NOT_EXITED`, `UNDO_WINDOW_OPEN` |
| W24 | `POST /workforce/people/:id/login` | `employee.lifecycle` | params, `CreateLoginSchema` | `{ userId }` | 400, 401, 403, 404, 409 `LOGIN_EXISTS`, `EMAIL_IN_USE` |
| W25 | `POST /workforce/people/:id/file-requests` and `.../:requestId/remind` | `employee.write_basic` | params, `FileRequestSchema` | `FileRequestRow` | 400, 401, 403, 404 |
| W26 | `POST /workforce/people/:id/verify-statutory` | `employee.write_sensitive` | params | `EmployeeFileView` | 400, 401, 403, 404 |
| W27 | `POST /workforce/people/:id/documents` | `employee.write_sensitive`, or `me.file` for the self-uploadable types | multipart `file`, `documentType` | `201 DocumentRow` | 400, 401, 403, 404 |
| W28 | `POST /workforce/people/:id/reveal` | the group's capability (table in 3.2) or `me.file` | params, `RevealSchema` | `{ field, value }`. **Writes `people.sensitive_revealed`** unless it is the person's own | 400, 401, 403, 404 |

### 4.3 Organisation

| # | Method and path | Guard | Request (Zod) | Response | Errors |
|---|---|---|---|---|---|
| O1 | `GET /workforce/org` | `org.read` | none | `OrgOverview` (sites, departments, heads, gaps, four counts) | 401, 403 |
| O2 | `GET /workforce/org/departments/:id` | `org.read` | params | `DepartmentView` (head, people page, casual pool; pool rates only if `payprofile.read`) | 400, 401, 404 |
| O3 | `POST /workforce/org/departments` | `org.write` | `DepartmentCreateSchema` | `201 DepartmentView` | 400, 401, 403, 409 (name taken at that site) |
| O4 | `PATCH /workforce/org/departments/:id` | `org.write` | params, `DepartmentUpdateSchema` | `DepartmentView` | 400, 401, 403, 404, 409 |
| O5 | `POST /workforce/org/departments/:id/retire` and `.../restore` | `org.write` | params | `DepartmentView` | 400, 401, 403, 404, 409 `DEPARTMENT_HAS_PEOPLE` |
| O6 | `GET /workforce/org/departments/:id/head-candidates` | `org.write_heads` | params | candidates in that department with a login, longest tenure first, one marked `recommended` | 400, 401, 403, 404 |
| O7 | `POST /workforce/org/departments/:id/head/preview` | `org.write_heads` | params, `AssignHeadSchema` | `HeadPreview` (what changes; nothing written) | 400, 401, 403, 404, 409 |
| O8 | `POST /workforce/org/departments/:id/head` | `org.write_heads` | params, `AssignHeadSchema` | `DepartmentView` | 400, 401, 403, 404, 409 (`HEAD_NOT_ELIGIBLE`, `ALREADY_HEAD`, `ACTING_HEAD_EXISTS`, `HUB_HAS_NO_HEADS`) |
| O9 | `POST /workforce/org/departments/:id/head/end` | `org.write_heads` | params, `EndHeadSchema` | `DepartmentView` | 400, 401, 403, 404, 409 |
| O10 | `GET /workforce/org/positions` | `org.read` | query `PositionsQuerySchema` | `PositionView[]` | 400, 401, 403 |
| O11 | `GET /workforce/org/positions/:id` | `org.read` | params | `PositionView` with holders | 400, 401, 404 |
| O12 | `POST /workforce/org/positions` | `org.write` | `PositionCreateSchema` | `201 PositionView` | 400, 401, 403, 409 |
| O13 | `GET /workforce/org/positions/:id/impact` | `org.write` | query `defaultTracksTime` | `{ people: [...], impacts: ImpactLine[] }` | 400, 401, 403, 404 |
| O14 | `PATCH /workforce/org/positions/:id` | `org.write` | params, `PositionUpdateSchema` | `PositionView` | 400, 401, 403, 404, 409 `ACKNOWLEDGE_IMPACT` |
| O15 | `POST /workforce/org/positions/:id/retire` and `.../restore` | `org.write` | params | `PositionView` | 400, 401, 403, 404, 409 `POSITION_HELD` (lists the holders) |

Unchanged: `GET /workforce/permissions/me` (gains `headOfDepartmentIds`, section 3.4).

---

## 5. Services

All writes go through `runAudited` (slice 0 5.2): the change, its audit entry and its events succeed or fail together; events are delivered after commit. Services never import Prisma (repositories only; `runAudited` owns the transaction). Dates are Nairobi dates; "today" is always `nairobiToday(now)` with `now` passed in.

### 5.1 The flows

**Hire** (`POST /people`, from a draft or direct). In one transaction:
1. Authorise `employee.write_basic` and the target site in scope. Pay, statutory, bank and login parts need their own capabilities (else `403 FIELD_NOT_ALLOWED`).
2. Validate: department active and at that site; position active and **offered by** the department (`POSITION_NOT_OFFERED`); a casual needs `position.casualsAllowed`; reports-to is an active employee of the company; the login role (if any) is in `HIRE_LOGIN_ROLES`.
3. Duplicates: the same national ID is refused (`DUPLICATE_NATIONAL_ID`); the same phone needs `confirmDuplicatePhone` (`DUPLICATE_PHONE`). With `existingUserId` (adopting an account) the account must be an active human with no file; its role is kept.
4. Number: take an advisory lock for the company, then max plus one (`W-0001`).
5. Create `Employee`, empty `PayProfile`, one `EmploymentSpell`. Status is `ONBOARDING`, or `ACTIVE` if the start date is today or earlier (the scheduler flips the rest at 00:05 on the start date). "Tracks time" comes from the position unless the request differs (then `tracksTimeOverride` is true). Probation end is the start date plus the effective PROBATION rule's `defaultMonths` for that site (none for a casual). The employment choice ("Monthly, with contract", "no contract yet", "Casual") sets `payType` and the `nextStep`; it stores nothing else.
6. If pay is supplied (HR only) create the profile amount and a `PayChange` already `APPROVED` with reason `HIRING` (question 1). Create the file requests for what only the person can give (NSSF and SHA, photo and details) when a login is created.
7. One audit entry `people.hired` (no amounts, no IDs: names of the fields filled), event `employee.hired`, the department head is told. The draft is deleted.
8. **After commit**, if a login was requested (HR only): create it through the gateway as a second audited step (`people.login_created`). If that fails the hire stands, the response says `login.created: false` with the reason, and HR retries with `POST /people/:id/login`. (The old two-screen split is gone; the account is never half of a person.)

**Edit** (`PATCH /people/:id`): job fields (position, reports-to, "clocks in") by `employee.write_basic`, subject to the onboarding rule in 3.1; ids and address by `employee.write_sensitive`. Department and site cannot be edited here (use Transfer). Entry `people.updated` with before and after of the **changed** fields; for ID fields only the names, never values. Changing "clocks in" sets `tracksTimeOverride`; if the value equals the position's default the override clears. Emits `employee.tracks_time_changed`.

**Pay.** `PUT .../pay-profile` changes payout method, bank, M-Pesa, overtime eligibility and hours (not the amount). Changing an existing bank account needs a `reason` and tells the Accountant. `POST .../pay-changes` creates one `PENDING` change (new amount, start date not in the past, reason); the Director is told. `decision` approves or declines (decline needs a note). An approved change takes effect on its start date: immediately if that is today or earlier, otherwise the scheduler applies it (the profile's `amount` is the amount in force today; the history is `PayChange`). Entries: `people.payprofile_updated`, `people.pay_change_requested`, `people.pay_change_decided`, `people.pay_change_applied` (channel `SYSTEM`). `payAmountOn(employeeId, date)` is exported through the door for payroll.

**Contract** (`POST .../contract`): creates a `Contract` (`ACTIVE`, optional end date, optional legacy contract type), sets `contractStatus ACTIVE`, and **bridges to legacy leave**: while slice 5 is unbuilt it calls the existing contract-assignment code through the gateway (if the person has a legacy profile) so leave balances still seed. If a probation confirmation was decided and waiting, it now completes. Entry `people.contract_created`. No PDF yet.

**Probation.** Rules come from the effective PROBATION group for the person's site. `CONFIRM` records `probationDecidedOn`; it completes (`probationConfirmedOn`) at once if a contract is active, otherwise as soon as one is created ("You can decide now, but confirmation completes once it is signed"). `EXTEND` is allowed while `probationExtensions < maxExtensions` and months are at most `maxExtensionMonths` (`PROBATION_LIMIT` otherwise); the person is told with the reason. `END` returns the suggested last day and the screen opens the exit step. A head, Branch Manager or HR may add a **probation note** (`GOOD` or `CONCERNS`, optional text; entry `people.probation_noted`); the decision dialog shows them.

**Transfer** (`POST .../transfer`): HR picks site, department, optional position and reports-to, and a start date. `.../transfer/preview` first returns `MovePreview`: the new head, who they will report to, and the `impacts` collected from later slices (shifts removed on the rota, approvals moving). If the start date is today or earlier it applies at once; otherwise it is `SCHEDULED` and the scheduler applies it. Applying: update `Employee` (site, department, position, reports-to), end any head role (`endReason TRANSFER`, claims synced, `department.head_changed`), and move the **login** to the new site through the gateway (which uses today's transfer code, so the old `StaffTransfer` history keeps filling). Pay, leave balance and probation dates do not change; the probation decision moves to the new head. One scheduled transfer per person (`TRANSFER_SCHEDULED`). Entries `people.transferred` (and `people.transfer_applied` by the scheduler). Event `employee.transferred`; both Branch Managers and both heads are told.

**Send to another site** (`POST .../loan`): a dated loan with no approval. The home site, department, pay and approvals do not change. `until` is a date or `null` ("until I bring her back"); it ends by itself on the date (scheduler) or by `.../end`. The door exports `getActiveLoans(siteId, date)` for the rota and Today board (slices 2 and 3). Both Branch Managers are told. Entries `people.loan_created`, `people.loan_ended`, `people.move_cancelled`.

**Exit** (`POST .../exit`, with `.../exit/preview` first). Records the spell's end date (the last day), the reason and the "uniform returned" tick, and sets `exitedOn`. Status becomes `NOTICE` while the last day is today or later; at 00:05 the day after (scheduler) or immediately if the last day is in the past, the exit is **finalised**: status `EXITED`; active contracts `ENDED`; any head role ended (`endReason EXIT`, claims synced, event); scheduled moves cancelled; the **login is deactivated** and its refresh tokens revoked (gateway). What was changed is saved in `exitSnapshot` so it can be undone. Entries `people.exit_recorded`, `people.exit_finalized` (`SYSTEM`); the Director is told. The "final pay" and "leave settled" lines of the dialog are provided by later slices through `registerImpactProvider` (shown as pending until then).

**Undo exit** (`.../exit/undo`): allowed while today is on or before the last day plus 7 (`EXIT_UNDO_DAYS`; question 12), also while still in `NOTICE`. Restores the login, the contracts and, if the department still has no head, the head role; anything that could not be restored comes back in `notRestored[]`. Entry `people.exit_undone`.

**Rehire** (`.../rehire`): only when `EXITED` and the undo window has passed (`UNDO_WINDOW_OPEN` otherwise). Reopens the **same file**: new `EmploymentSpell`, new start date, new probation from the rule, `contractStatus NONE`, status as for a hire, login reactivated, optional new department, position and reports-to **at the same site** (a different site is a transfer afterwards). Old pay, history and leave stay; the gap shows on the timeline. There is never a second file. Entry `people.rehired`.

**Login** (`POST .../login`): HR creates the account for a file without one (a casual who becomes monthly staff, or a retry after a failed hire): through the gateway; links `userId`; links the legacy profile the old code creates; entry `people.login_created`; the temporary password is returned once and never stored or logged.

**File requests** (`POST .../file-requests`): "ask Joy for her emergency contact": a row and a notification; `remind` stamps `remindedAt` and notifies again. The request resolves by itself when the person fills the field (`PATCH /people/me`). Not audited (no change to the person), notified only.

**Verify statutory** stamps `statutoryVerifiedAt` and the verifier; any later change by the person to NSSF, SHA, HELB or KRA clears it.

**Adopt** (`POST /people` with `existingUserId`): files an account that exists without one (the Director, HR, Accountant, or anyone created through the old Add staff screen before the switch). Entry `people.adopted`.

**Departments, heads, positions.**
- Create or edit a department: unique name per site; the five standard ones carry their `inventoryTag`; a department created here has none. Retire only with no active people (`DEPARTMENT_HAS_PEOPLE`); entries `org.department_*`.
- **Assign or replace a head** (`mode REPLACE`) or **name an acting head** (`mode ACTING` with `returnsOn`; the row ends the day before it): eligibility is an `ACTIVE` employee **of that department, with a login, not a casual**, and not already heading another department (`ALREADY_HEAD`; move them first). One substantive head and at most one acting head per department (`ACTING_HEAD_EXISTS` unless `replaceActing`). Heads exist only at branches. Changes take effect today. The head row, the claims (5.4), the audit entry `org.head_changed`, and `department.head_changed` are one transaction plus the event. `.../head/preview` returns the "what changes" lines (approvals that will move, from later slices; who is told). `.../head/end` ends a head (reason required).
- **Positions.** Create (name unique per company, clocks in, login role, casuals allowed, offered by departments); edit; retire only when nobody holds it (`POSITION_HELD` lists holders); restore. **Changing "clocks in"** first calls `.../impact`: it lists the people whose setting would change (those without an override) and the impacts from later slices; the `PATCH` is refused (`ACKNOWLEDGE_IMPACT`) unless `acknowledgedPeople` equals that count. It then updates those people in the same transaction, one entry `org.position_updated` with the count, and emits `employee.tracks_time_changed` for each.

**Tracks-time resolver.** `registerPeople()` (called once where `routes/index.ts` builds the router, and tested at boot) calls `setTracksTimeResolver` with: the person's `Employee.tracksTime` by user id, else `defaultTracksTime(role)`. Casuals have no user id and are reached by employee id in later slices.

### 5.2 Audit action codes (registered in `_shared/audit/audit-actions.ts`, each in the commit that builds the behaviour)

```ts
// file: _shared/audit/audit-actions.ts   (added to AUDIT_ACTIONS: each code, and the only categories it may be filed under)
import type { AuditCategoryCode } from './audit.types';

export const PEOPLE_AUDIT_ACTIONS = {
  // the file
  'people.hired': ['PEOPLE'],
  'people.adopted': ['PEOPLE'], // an existing account filed as an employee
  'people.updated': ['PEOPLE'], // changed fields only; ID fields by name, never value
  'people.self_updated': ['PEOPLE'], // the person edited their own details
  'people.login_created': ['PEOPLE'],
  'people.statutory_verified': ['PEOPLE'],
  'people.document_uploaded': ['PEOPLE'],
  // pay and contract (never an amount in before or after)
  'people.payprofile_updated': ['PAY_SETUP'],
  'people.pay_change_requested': ['PAY_SETUP'],
  'people.pay_change_decided': ['PAY_SETUP'],
  'people.pay_change_applied': ['PAY_SETUP'], // by the scheduler, channel SYSTEM
  'people.contract_created': ['PAY_SETUP'],
  // life of the file
  'people.probation_decided': ['PEOPLE'],
  'people.probation_noted': ['PEOPLE'],
  'people.transferred': ['PEOPLE'],
  'people.transfer_applied': ['PEOPLE'], // by the scheduler, channel SYSTEM
  'people.loan_created': ['PEOPLE'],
  'people.loan_ended': ['PEOPLE'],
  'people.move_cancelled': ['PEOPLE'],
  'people.exit_recorded': ['PEOPLE'],
  'people.exit_finalized': ['PEOPLE'], // by the scheduler, channel SYSTEM
  'people.exit_undone': ['PEOPLE'],
  'people.rehired': ['PEOPLE'],
  // someone looked at something sensitive (written when it is not the person's own)
  'people.sensitive_revealed': ['SENSITIVE_VIEW'],
  'people.pay_opened': ['SENSITIVE_VIEW'],
  'people.document_opened': ['SENSITIVE_VIEW'],
  // the organisation
  'org.department_created': ['PEOPLE'],
  'org.department_updated': ['PEOPLE'],
  'org.department_retired': ['PEOPLE'],
  'org.department_restored': ['PEOPLE'],
  'org.head_changed': ['PEOPLE'], // assign, replace, acting, end: `after.mode` says which
  'org.position_created': ['PEOPLE'],
  'org.position_updated': ['PEOPLE'], // includes the count of people whose "clocks in" changed
  'org.position_retired': ['PEOPLE'],
  'org.position_restored': ['PEOPLE'],
} as const satisfies Record<string, readonly AuditCategoryCode[]>;
```

Never in an entry: amounts, ID numbers, bank numbers, passwords, PINs. `subjectUserId` is set to the person's login id when they have one (so "Activity on my record" works); `subjectType` is `Employee`, `Department`, `Position`, `PayChange`.

### 5.3 Events

```ts
// file: _shared/events.ts   (these keys are added to WorkforceEventPayloads; none carries an amount or an ID number)
import type { NairobiDate } from './time/nairobi-time';

export interface PeopleEventPayloads {
  'employee.hired': { siteId: string; employeeId: string; userId: string | null; departmentId: string | null; startDate: NairobiDate };
  'employee.transferred': {
    employeeId: string;
    userId: string | null;
    fromSiteId: string;
    toSiteId: string;
    fromDepartmentId: string | null;
    toDepartmentId: string | null;
    effectiveOn: NairobiDate;
  };
  'employee.loaned': { employeeId: string; userId: string | null; homeSiteId: string; hostSiteId: string; from: NairobiDate; until: NairobiDate | null };
  'employee.exit_recorded': { employeeId: string; userId: string | null; siteId: string; lastDay: NairobiDate; reason: string };
  'employee.exit_finalized': { employeeId: string; userId: string | null; siteId: string; lastDay: NairobiDate };
  'employee.exit_undone': { employeeId: string; userId: string | null; siteId: string };
  'employee.rehired': { employeeId: string; userId: string | null; siteId: string; startsOn: NairobiDate };
  'employee.tracks_time_changed': { employeeId: string; userId: string | null; siteId: string; tracksTime: boolean; effectiveOn: NairobiDate };
  'pay.change_requested': { employeeId: string; payChangeId: string; requestedById: string };
  'pay.change_decided': { employeeId: string; payChangeId: string; decision: 'APPROVED' | 'DECLINED'; decidedById: string };
}
```

`department.head_changed` was declared in slice 0 and is **emitted for the first time here**. Its payload means: `previousHeadUserId` is the person whose active head row ended, `newHeadUserId` the person whose row started (acting heads count), either may be null. Consumers of the new events: slice 2 (clear shifts on transfer and exit), slice 4 (reroute approvals), slice 5 (leave), slice 6 (final pay).

Who is told (through `getWorkforceNotifier()`; wording from the approved shared table, never written here): hire: the department head; pay change requested: the Director; pay change decided: the requester; bank account changed: the Accountant; probation extended: the person, with the reason; transfer: both Branch Managers, the old and new head, the person; send to another site: both Branch Managers; exit and undo exit: the Director; head changed: the Branch Manager, the new head, the previous head; file request and reminder: the person.

### 5.4 Claims: how `department.head_changed` keeps `isDepartmentHead` and `departmentTag` right

`User.isDepartmentHead` and `User.departmentTag` stay (Inventory, the old scheduling code and the login token read them). Slice 1 changes **who writes them**: only the gateway, from the head rows, never by hand:

```ts
// file: people/head-claims.ts
import type { DepartmentTag, Prisma } from '@prisma/client';
import type { NairobiDate } from '../_shared/time/nairobi-time';

export interface HeadRow {
  startsOn: NairobiDate;
  endsOn: NairobiDate | null;
  isActing: boolean;
  departmentInventoryTag: DepartmentTag | null;
}
export interface HeadClaims {
  isDepartmentHead: boolean;
  departmentTag: DepartmentTag | null;
}

/** A row is active on `today` when it has started and has not ended (an end date is the last day, inclusive). */
export const isActiveOn = (row: Pick<HeadRow, 'startsOn' | 'endsOn'>, today: NairobiDate): boolean =>
  row.startsOn <= today && (row.endsOn === null || row.endsOn >= today);

/**
 * The two claims other modules read. True only for a head of a department that has an inventory tag, so Inventory never
 * meets a head with no tag. A substantive head and an acting head both count.
 */
export const claimsFromHeadRows = (rows: readonly HeadRow[], today: NairobiDate): HeadClaims => {
  const tagged = rows.find((row) => isActiveOn(row, today) && row.departmentInventoryTag !== null);
  return tagged ? { isDepartmentHead: true, departmentTag: tagged.departmentInventoryTag } : { isDepartmentHead: false, departmentTag: null };
};

/** Recomputes one person's claims from their head rows and writes them through the gateway, inside the caller's transaction. */
export declare function syncHeadClaims(tx: Prisma.TransactionClient, userId: string, today: NairobiDate): Promise<void>;
```

- The claim is true **only for a head of a department that has an inventory tag** (the five standard ones). A head of a department HR adds (no tag) has full Workforce authority through the head rows, but the claim stays false so no Inventory code ever meets a head with no department tag (`stock-scope` and `branch-day` read the tag).
- The write happens **in the same transaction as the head change**, not in a post-commit event handler, so the two cannot drift if a handler fails. The event is still emitted so anyone else (and Access, later) can subscribe.
- A new token carries the new claim at the next refresh (`JWT_ACCESS_EXPIRES_IN`, 15 minutes today). The Workforce screens do not wait for it: they use the head rows (3.4).
- `reconcileHeadClaims` (scheduler, section 5.6) recomputes every head's claim daily, so a day an acting head's last day passes, or any drift, corrects itself.

### 5.5 Code the builders copy

```ts
// file: people/people.constants.ts
import type { UserRole } from '@prisma/client';

/** All of these are EXAMPLES the owner can change (contract section 11). None is a legal or policy value. */
export const EMPLOYEE_NUMBER_PREFIX = 'W-';
export const EXIT_UNDO_DAYS = 7;
export const DRAFT_KEEP_DAYS = 30;

export const EXIT_REASONS = ['RESIGNED', 'END_OF_CONTRACT', 'DISMISSED', 'REDUNDANCY', 'RETIRED', 'OTHER'] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

export const PAY_CHANGE_REASONS = ['HIRING', 'PROBATION_CONFIRMED', 'PROMOTION', 'ANNUAL_REVIEW', 'CORRECTION', 'OTHER'] as const;
export type PayChangeReason = (typeof PAY_CHANGE_REASONS)[number];

export const FILE_REQUEST_KINDS = ['EMERGENCY_CONTACT', 'NSSF_SHA', 'PHOTO_AND_DETAILS', 'ID_NUMBER', 'BANK_DETAILS'] as const;
export type FileRequestKind = (typeof FILE_REQUEST_KINDS)[number];

export const PROBATION_VERDICTS = ['GOOD', 'CONCERNS'] as const;
export type ProbationVerdict = (typeof PROBATION_VERDICTS)[number];

/** Login roles a hire may give. The privileged roles are created in Access and then adopted into a file. */
export const HIRE_LOGIN_ROLES = ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT'] as const satisfies readonly UserRole[];
export type HireLoginRole = (typeof HIRE_LOGIN_ROLES)[number];

/** What a position may name as its login role (a prefill; hiring still uses HIRE_LOGIN_ROLES). Never the System Admin or a device. */
export const POSITION_LOGIN_ROLES = [...HIRE_LOGIN_ROLES, 'MANAGER', 'STORE_MANAGER', 'ACCOUNTANT', 'HR_MANAGER', 'DIRECTOR'] as const satisfies readonly UserRole[];

/** Fields the reveal endpoint can return in clear, by sensitive group. */
export const REVEALABLE_FIELDS = {
  ids: ['nationalId', 'kraPin', 'shaNumber', 'nssfNumber', 'helbNumber', 'dateOfBirth', 'physicalAddress'],
  bank: ['bankName', 'bankBranch', 'accountName', 'accountNumber', 'mpesaPhone'],
} as const;
export const REVEALABLE_FIELD_LIST = [...REVEALABLE_FIELDS.ids, ...REVEALABLE_FIELDS.bank] as const;
export type RevealableField = (typeof REVEALABLE_FIELD_LIST)[number];

/** The only documents a person may upload to their own file (the rest are HR-issued). */
export const SELF_UPLOADABLE_DOCUMENT_TYPES = ['ID_COPY', 'NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'CERTIFICATE', 'MEDICAL_CERTIFICATE', 'OTHER'] as const;
```

```ts
// file: people/people-dates.ts
import { addDays, parseNairobiDate, type NairobiDate } from '../_shared/time/nairobi-time';
import { EXIT_UNDO_DAYS } from './people.constants';

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** Same day of the month, clamped to the last day of a shorter month (31 Jan plus one month is 28 Feb). */
export function addMonths(date: NairobiDate, months: number): NairobiDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return parseNairobiDate(`${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`);
}

/** The probation end for a start date and the rule's months; null when the rule gives none. */
export const probationEnd = (start: NairobiDate, months: number): NairobiDate | null => (months > 0 ? addMonths(start, months) : null);

/** The last day an exit can be undone: the last day plus EXIT_UNDO_DAYS (31 Oct gives 7 Nov). */
export const undoUntil = (lastDay: NairobiDate): NairobiDate => addDays(lastDay, EXIT_UNDO_DAYS);
export const canUndoExit = (lastDay: NairobiDate, today: NairobiDate): boolean => today <= undoUntil(lastDay);

/** An acting head covers until the day before they return. */
export const actingEndsOn = (returnsOn: NairobiDate): NairobiDate => addDays(returnsOn, -1);
```

```ts
// file: people/people-completeness.ts
import type { SensitiveGroup } from '../_shared/workforce-access';

export const FILE_PARTS = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'LOGIN', 'NSSF_SHA', 'PHOTO_AND_DETAILS', 'EMERGENCY_CONTACT', 'CONTRACT'] as const;
export type FilePart = (typeof FILE_PARTS)[number];

/** What the server knows about a file, as plain facts. Built by the repository; no value ever leaves in this shape. */
export interface FileFacts {
  casual: boolean;
  hasNationalId: boolean;
  hasPhone: boolean;
  hasPosition: boolean;
  hasDepartment: boolean;
  payAmountSet: boolean;
  payoutComplete: boolean; // BANK needs bank and account number; MPESA needs a phone; CASH is complete
  hasLogin: boolean;
  hasNssf: boolean;
  hasSha: boolean;
  hasPhoto: boolean;
  hasPersonalDetails: boolean; // personal phone and address
  hasEmergencyContact: boolean;
  contractActive: boolean;
}

export interface PartState {
  part: FilePart;
  applicable: boolean;
  done: boolean;
}

export const fileParts = (f: FileFacts): PartState[] => [
  { part: 'IDENTITY', applicable: true, done: f.hasNationalId && f.hasPhone },
  { part: 'JOB', applicable: true, done: f.hasPosition && f.hasDepartment },
  { part: 'PAY', applicable: true, done: f.payAmountSet },
  { part: 'BANK', applicable: !f.casual, done: f.payoutComplete },
  { part: 'LOGIN', applicable: !f.casual, done: f.hasLogin },
  { part: 'NSSF_SHA', applicable: !f.casual, done: f.hasNssf && f.hasSha },
  { part: 'PHOTO_AND_DETAILS', applicable: !f.casual, done: f.hasPhoto && f.hasPersonalDetails },
  { part: 'EMERGENCY_CONTACT', applicable: true, done: f.hasEmergencyContact },
  { part: 'CONTRACT', applicable: !f.casual, done: f.contractActive },
];

/** The ring on the Overview (Paper Chapter 4, step 1): six parts. */
export const RING_PARTS = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'CONTRACT', 'EMERGENCY_CONTACT'] as const satisfies readonly FilePart[];

/** The onboarding checklist (Paper Chapter 2, step 7): six rows, each made of one or two parts. */
export const CHECKLIST_ROWS = {
  WHO_AND_JOB: ['IDENTITY', 'JOB'],
  PAY_AND_BANK: ['PAY', 'BANK'],
  LOGIN: ['LOGIN'],
  NSSF_SHA: ['NSSF_SHA'],
  PHOTO_AND_DETAILS: ['PHOTO_AND_DETAILS'],
  CONTRACT: ['CONTRACT'],
} as const satisfies Record<string, readonly FilePart[]>;
export type ChecklistRow = keyof typeof CHECKLIST_ROWS;

const percent = (done: number, total: number): number => (total === 0 ? 100 : Math.round((done / total) * 100));

export const ringPercent = (states: readonly PartState[]): number => {
  const used = states.filter((s) => s.applicable && (RING_PARTS as readonly FilePart[]).includes(s.part));
  return percent(used.filter((s) => s.done).length, used.length);
};

export const checklistRows = (states: readonly PartState[]): { row: ChecklistRow; applicable: boolean; done: boolean }[] =>
  (Object.entries(CHECKLIST_ROWS) as [ChecklistRow, readonly FilePart[]][]).map(([row, parts]) => {
    const mine = states.filter((s) => s.applicable && parts.includes(s.part));
    return { row, applicable: mine.length > 0, done: mine.length > 0 && mine.every((s) => s.done) };
  });

export const checklistPercent = (rows: readonly { applicable: boolean; done: boolean }[]): number => {
  const used = rows.filter((r) => r.applicable);
  return percent(used.filter((r) => r.done).length, used.length);
};

/** Which sensitive group a part belongs to; a viewer who is locked out of the group never sees the part's gap. */
export const PART_GROUP: Partial<Record<FilePart, SensitiveGroup>> = {
  IDENTITY: 'ids',
  NSSF_SHA: 'ids',
  PAY: 'pay',
  BANK: 'bank',
};

/** Parts that make a file "Needs finishing" (question 10). Contract and emergency contact have their own filter and request. */
export const NEEDS_FINISHING_PARTS = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'LOGIN', 'NSSF_SHA', 'PHOTO_AND_DETAILS'] as const satisfies readonly FilePart[];

export const gapsOf = (states: readonly PartState[], locked: readonly SensitiveGroup[]): FilePart[] =>
  states
    .filter((s) => s.applicable && !s.done)
    .filter((s) => {
      const group = PART_GROUP[s.part];
      return group === undefined || !locked.includes(group);
    })
    .map((s) => s.part);
```

```ts
// file: people/people-validators.ts
import { HrDocumentType } from '@prisma/client';
import { z } from 'zod';
import {
  EXIT_REASONS,
  FILE_REQUEST_KINDS,
  HIRE_LOGIN_ROLES,
  PAY_CHANGE_REASONS,
  POSITION_LOGIN_ROLES,
  PROBATION_VERDICTS,
  REVEALABLE_FIELD_LIST,
} from './people.constants';

const id = z.uuid();
const nairobiDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use digits with up to 2 decimals');
const hours = z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, 'Use hours such as 48 or 7.5');
const text = (max: number) => z.string().trim().min(1).max(max);
const phone = z.string().trim().regex(/^[0-9 +()-]{7,20}$/, 'Not a phone number');
const email = z.email().max(254).transform((value) => value.toLowerCase());
const paging = { page: z.coerce.number().int().min(1).default(1), perPage: z.coerce.number().int().min(1).max(100).default(20) };
const notEmpty = (value: object): boolean => Object.keys(value).length > 0;

// ---- params and queries -------------------------------------------------------------------
export const IdParamsSchema = z.object({ id });
export const MoveParamsSchema = z.object({ id, moveId: id });
export const DocumentParamsSchema = z.object({ id, docId: id });
export const ChangeParamsSchema = z.object({ changeId: id });
export const RequestParamsSchema = z.object({ id, requestId: id });

export const EMPLOYEE_FILTERS = ['all', 'needs_finishing', 'no_contract', 'casual_pool', 'on_probation', 'exited'] as const;
export const ListQuerySchema = z.object({
  siteId: id.optional(),
  departmentId: id.optional(),
  filter: z.enum(EMPLOYEE_FILTERS).default('all'),
  q: z.string().trim().max(80).optional(),
  ...paging,
});
export const SummaryQuerySchema = z.object({ siteId: id.optional() });
export const PageQuerySchema = z.object(paging);
export const DuplicateQuerySchema = z
  .object({ nationalId: text(20).optional(), phone: phone.optional(), email: email.optional() })
  .refine((v) => v.nationalId !== undefined || v.phone !== undefined || v.email !== undefined, 'Give at least one to check');
export const PayChangesQuerySchema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'CANCELLED']).default('PENDING') });
export const PositionsQuerySchema = z.object({ includeRetired: z.enum(['true', 'false']).default('false').transform((v) => v === 'true') });
export const PositionImpactQuerySchema = z.object({ defaultTracksTime: z.enum(['true', 'false']).transform((v) => v === 'true') });

// ---- hire (the five steps; a casual has three) ---------------------------------------------
export const WhoSchema = z.object({
  name: text(120),
  phone,
  nationalId: text(20),
  email: email.optional(),
  photoUrl: z.url().optional(),
});
export const JobSchema = z.object({
  siteId: id,
  departmentId: id,
  positionId: id,
  reportsToId: id.nullable().optional(),
  employment: z.enum(['MONTHLY_WITH_CONTRACT', 'MONTHLY_NO_CONTRACT_YET', 'CASUAL']),
  tracksTime: z.boolean().optional(),
  startDate: nairobiDate,
});
export const PaySchema = z.object({
  amount: money, // monthly salary, or the daily rate for a casual
  overtimeEligible: z.boolean().default(false),
  standardWeekHours: hours.optional(),
  standardDayHours: hours.optional(),
});
export const StatutorySchema = z
  .object({
    kraPin: text(20).optional(),
    nssfNumber: text(30).optional(),
    shaNumber: text(30).optional(),
    helbNumber: text(30).optional(),
    payoutMethod: z.enum(['BANK', 'MPESA', 'CASH']),
    bankName: text(80).optional(),
    bankBranch: text(80).optional(),
    accountName: text(120).optional(),
    accountNumber: text(40).optional(),
    mpesaPhone: phone.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.payoutMethod === 'BANK' && (!v.bankName || !v.accountNumber)) {
      ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: 'A bank payout needs the bank and the account number' });
    }
    if (v.payoutMethod === 'MPESA' && !v.mpesaPhone) {
      ctx.addIssue({ code: 'custom', path: ['mpesaPhone'], message: 'An M-Pesa payout needs the phone number' });
    }
  });
export const LoginSchema = z.object({
  email,
  loginRole: z.enum(HIRE_LOGIN_ROLES),
  temporaryPassword: z.string().min(10).max(72), // shown once to HR; never stored or logged
});
export const CreateLoginSchema = LoginSchema;

export const HireBodySchema = z
  .object({
    draftId: id.optional(),
    existingUserId: id.optional(),
    who: WhoSchema,
    job: JobSchema,
    pay: PaySchema.optional(),
    statutory: StatutorySchema.optional(),
    login: LoginSchema.optional(),
    confirmDuplicatePhone: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const casual = v.job.employment === 'CASUAL';
    if (casual && v.login) ctx.addIssue({ code: 'custom', path: ['login'], message: 'A casual has no login' });
    if (casual && v.statutory) ctx.addIssue({ code: 'custom', path: ['statutory'], message: 'A casual has no statutory or bank step' });
    if (casual && v.existingUserId) ctx.addIssue({ code: 'custom', path: ['existingUserId'], message: 'A casual has no account' });
    if (v.existingUserId && v.login) ctx.addIssue({ code: 'custom', path: ['login'], message: 'The account already exists' });
  });

export const DraftBodySchema = z.object({
  kind: z.enum(['MONTHLY', 'CASUAL']),
  step: z.number().int().min(1).max(5),
  payload: z.record(z.string(), z.unknown()),
});

// ---- the file ------------------------------------------------------------------------------
export const UpdateEmployeeSchema = z
  .strictObject({
    name: text(120),
    positionId: id,
    reportsToId: id.nullable(),
    tracksTime: z.boolean(),
    personalPhone: phone.nullable(),
    personalEmail: email.nullable(),
    emergencyName: text(120).nullable(),
    emergencyRelation: text(60).nullable(),
    emergencyPhone: phone.nullable(),
    nationalId: text(20).nullable(),
    kraPin: text(20).nullable(),
    shaNumber: text(30).nullable(),
    nssfNumber: text(30).nullable(),
    helbNumber: text(30).nullable(),
    dateOfBirth: nairobiDate.nullable(),
    physicalAddress: text(200).nullable(),
  })
  .partial()
  .refine(notEmpty, 'Nothing to change');

export const PatchMeSchema = z
  .strictObject({
    personalPhone: phone.nullable(),
    personalEmail: email.nullable(),
    physicalAddress: text(200).nullable(),
    emergencyName: text(120).nullable(),
    emergencyRelation: text(60).nullable(),
    emergencyPhone: phone.nullable(),
    nssfNumber: text(30).nullable(),
    shaNumber: text(30).nullable(),
    helbNumber: text(30).nullable(),
    kraPin: text(20).nullable(),
    dateOfBirth: nairobiDate.nullable(),
  })
  .partial()
  .refine(notEmpty, 'Nothing to change');

export const RevealSchema = z.strictObject({ field: z.enum(REVEALABLE_FIELD_LIST) });
export const DocumentUploadSchema = z.strictObject({ documentType: z.enum(HrDocumentType) });
export const FileRequestSchema = z.strictObject({ kind: z.enum(FILE_REQUEST_KINDS) });

// ---- pay and contract ----------------------------------------------------------------------
export const PayProfileSchema = z
  .strictObject({
    payoutMethod: z.enum(['BANK', 'MPESA', 'CASH']),
    bankName: text(80).nullable(),
    bankBranch: text(80).nullable(),
    accountName: text(120).nullable(),
    accountNumber: text(40).nullable(),
    mpesaPhone: phone.nullable(),
    overtimeEligible: z.boolean(),
    standardWeekHours: hours.nullable(),
    standardDayHours: hours.nullable(),
    reason: text(200), // required by the service when an existing bank account changes
  })
  .partial()
  .refine(notEmpty, 'Nothing to change');
export const PayChangeSchema = z.strictObject({
  amount: money,
  effectiveFrom: nairobiDate, // not in the past (the service checks against today)
  reason: z.enum(PAY_CHANGE_REASONS),
  note: text(300).optional(),
});
export const PayChangeDecisionSchema = z
  .strictObject({ decision: z.enum(['APPROVE', 'DECLINE']), note: text(300).optional() })
  .refine((v) => v.decision === 'APPROVE' || v.note !== undefined, { message: 'Say why it is declined', path: ['note'] });
export const ContractSchema = z
  .strictObject({ contractTypeId: id.optional(), startsOn: nairobiDate, endsOn: nairobiDate.optional() })
  .refine((v) => v.endsOn === undefined || v.endsOn >= v.startsOn, { message: 'The end cannot be before the start', path: ['endsOn'] });

// ---- probation, moves, exit ----------------------------------------------------------------
export const ProbationDecisionSchema = z.discriminatedUnion('decision', [
  z.strictObject({ decision: z.literal('CONFIRM') }),
  z.strictObject({ decision: z.literal('EXTEND'), months: z.number().int().min(1).max(12), reason: text(300) }),
  z.strictObject({ decision: z.literal('END') }),
]);
export const ProbationNoteSchema = z.strictObject({ verdict: z.enum(PROBATION_VERDICTS), note: text(500).optional() });
export const TransferSchema = z.strictObject({
  toSiteId: id,
  toDepartmentId: id,
  toPositionId: id.optional(),
  toReportsToId: id.nullable().optional(),
  startsOn: nairobiDate,
});
export const LoanSchema = z
  .strictObject({ toSiteId: id, from: nairobiDate, until: nairobiDate.nullable() })
  .refine((v) => v.until === null || v.until >= v.from, { message: 'Until cannot be before from', path: ['until'] });
export const ExitSchema = z.strictObject({
  lastDay: nairobiDate,
  reason: z.enum(EXIT_REASONS),
  note: text(500).optional(),
  uniformReturned: z.boolean().default(false),
});
export const ExitChecklistSchema = z.strictObject({ uniformReturned: z.boolean() });
export const RehireSchema = z.strictObject({
  startsOn: nairobiDate,
  departmentId: id.optional(),
  positionId: id.optional(),
  reportsToId: id.nullable().optional(),
});

// ---- organisation --------------------------------------------------------------------------
const PositionBase = z.object({
  name: text(60),
  defaultTracksTime: z.boolean(),
  loginRole: z.enum(POSITION_LOGIN_ROLES).nullable(),
  casualsAllowed: z.boolean(),
  departmentIds: z.array(id).max(50),
});
export const PositionCreateSchema = PositionBase;
export const PositionUpdateSchema = PositionBase.partial()
  .extend({ acknowledgedPeople: z.number().int().min(0).optional() })
  .refine(notEmpty, 'Nothing to change');
const NewPositionSchema = PositionBase.omit({ departmentIds: true });

export const DepartmentCreateSchema = z.object({
  siteId: id,
  name: text(60),
  description: text(200).optional(),
  headEmployeeId: id.optional(),
  positionIds: z.array(id).max(50).default([]),
  newPositions: z.array(NewPositionSchema).max(20).default([]),
});
export const DepartmentUpdateSchema = z
  .strictObject({ name: text(60), description: text(200).nullable(), positionIds: z.array(id).max(50) })
  .partial()
  .refine(notEmpty, 'Nothing to change');

export const AssignHeadSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('REPLACE'), employeeId: id }),
  z.strictObject({ mode: z.literal('ACTING'), employeeId: id, returnsOn: nairobiDate, replaceActing: z.boolean().default(false) }),
]);
export const EndHeadSchema = z.strictObject({ reason: text(200) });
```

```ts
// file: people/people.types.ts
import type { SensitiveGroup } from '../_shared/workforce-access';
import type { ChecklistRow, FilePart } from './people-completeness';
import type { ImpactLine } from './people-hooks';
import type { ExitReason, FileRequestKind, PayChangeReason, ProbationVerdict } from './people.constants';

/** A Nairobi calendar date, YYYY-MM-DD. */
export type DateString = string;
/** Money as a string with up to two decimals. Never a float. */
export type MoneyString = string;

export type EmploymentStatusCode = 'ONBOARDING' | 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'NOTICE' | 'EXITED';
export type ContractStatusCode = 'NONE' | 'ACTIVE' | 'ENDED';
export type Employment = 'MONTHLY' | 'CASUAL';

export interface Pagination {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
export interface ListResponse<T> {
  success: true;
  data: T[];
  pagination: Pagination;
}

export interface EmployeeListRow {
  id: string;
  employeeNumber: string;
  name: string;
  photoUrl: string | null;
  positionName: string | null;
  siteId: string;
  siteName: string;
  departmentId: string | null;
  departmentName: string | null;
  employment: Employment;
  contractStatus: ContractStatusCode;
  status: EmploymentStatusCode;
  probationEndsOn: DateString | null;
  /** Only parts the viewer may see: a Branch Manager never sees bank or pay gaps. */
  gaps: FilePart[];
  reportsToName: string | null;
  isHead: boolean;
}

export interface PeopleSummary {
  onFile: number;
  active: number;
  exited: number;
  needsFinishing: number;
  noContract: number;
  joinedThisMonth: number;
  stillInProbation: number;
  casualPool: number;
}

export interface ProbationNoteView {
  authorName: string;
  authorKind: 'HEAD' | 'BRANCH_MANAGER' | 'HR';
  verdict: ProbationVerdict;
  note: string | null;
  createdOn: DateString;
}
export interface ProbationView {
  endsOn: DateString;
  dayNumber: number;
  totalDays: number;
  daysLeft: number;
  extensions: number;
  extensionsAllowed: number;
  decidedOn: DateString | null;
  confirmedOn: DateString | null;
  confirmationWaitingForContract: boolean;
  notes: ProbationNoteView[];
}

export interface ExitView {
  lastDay: DateString;
  reason: ExitReason;
  note: string | null;
  uniformReturned: boolean;
  exitedByName: string | null;
  recordedOn: DateString | null;
  finalized: boolean;
  undoUntil: DateString;
  canUndo: boolean;
  canRehire: boolean;
}

export interface TimelineEvent {
  on: DateString;
  kind: 'HIRED' | 'DOCUMENT' | 'PAY_CHANGE' | 'TRANSFER' | 'LOAN' | 'PROBATION' | 'CONTRACT' | 'EXIT' | 'REHIRE';
  detail: Record<string, string | number | null>;
}
export interface NextStep {
  code: 'PROBATION_DECISION' | 'CREATE_CONTRACT' | 'FILE_REQUEST' | 'FINISH_FILE';
  dueOn: DateString | null;
  fileRequestId?: string;
}

/** What the caller may do with this file; the screen shows or hides buttons from it. */
export interface EmployeeActions {
  editJob: boolean;
  changePay: boolean;
  transfer: boolean;
  sendToSite: boolean;
  exit: boolean;
  undoExit: boolean;
  rehire: boolean;
  decideProbation: boolean;
  writeNote: boolean;
  createContract: boolean;
  uploadDocument: boolean;
  remind: boolean;
  createLogin: boolean;
}

export interface EmployeeFileView {
  id: string;
  employeeNumber: string;
  name: string;
  photoUrl: string | null;
  status: EmploymentStatusCode;
  employment: Employment;
  contractStatus: ContractStatusCode;
  tracksTime: boolean;
  tracksTimeFromPosition: boolean;
  site: { id: string; name: string };
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  reportsTo: { id: string; name: string; isHead: boolean } | null;
  startDate: DateString;
  hasLogin: boolean;
  loginRole: string | null;
  isHead: boolean;
  personalPhone: string | null;
  personalEmail: string | null;
  emergencyContact: { name: string; relation: string | null; phone: string } | null;
  /** Present only for groups the viewer may see. ID and bank values are masked ("•••• 5678") unless it is the person's own file. */
  sensitive: Partial<Record<string, string | null>>;
  locked: SensitiveGroup[];
  /** Null unless the viewer may see pay, bank and IDs (the person themself, HR, Director, Accountant). */
  completeness: {
    ringPercent: number;
    checklistPercent: number;
    parts: { part: FilePart; applicable: boolean; done: boolean }[];
    checklist: { row: ChecklistRow; applicable: boolean; done: boolean }[];
  } | null;
  probation: ProbationView | null;
  exit: ExitView | null;
  nextSteps: NextStep[];
  timeline: TimelineEvent[];
  actions: EmployeeActions;
  loan: { hostSiteName: string; from: DateString; until: DateString | null } | null;
  scheduledMove: { kind: 'TRANSFER' | 'LOAN'; startsOn: DateString; toSiteName: string } | null;
}

export interface PayChangeRow {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: MoneyString;
  effectiveFrom: DateString;
  reason: PayChangeReason;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
  requestedByName: string | null;
  requestedOn: DateString;
  decidedByName: string | null;
  decidedOn: DateString | null;
  decisionNote: string | null;
}
export interface PayView {
  payType: 'MONTHLY_SALARY' | 'DAILY_RATE';
  amount: MoneyString | null;
  overtimeEligible: boolean;
  standardWeekHours: string | null;
  standardDayHours: string | null;
  /** Monthly: amount / (week hours x 52 / 12); daily: amount / day hours. Decimal arithmetic, half-up to 2 places. Null until the hours are set. */
  hourlyEquivalent: MoneyString | null;
  payoutMethod: 'BANK' | 'MPESA' | 'CASH' | null;
  bank: { name: string | null; branch: string | null; accountName: string | null; accountNumberMasked: string | null; mpesaPhoneMasked: string | null } | null;
  history: PayChangeRow[];
  pending: PayChangeRow | null;
  locked: SensitiveGroup[];
}

export interface ContractRow {
  id: string;
  contractTypeName: string | null;
  startsOn: DateString;
  endsOn: DateString | null;
  status: ContractStatusCode;
  /** Empty until Signed documents (slice 4). */
  signedDocumentId: string | null;
}
export interface DocumentRow {
  id: string;
  documentType: string;
  fileName: string;
  uploadedByName: string | null;
  uploadedOn: DateString;
}
export interface FileRequestRow {
  id: string;
  kind: FileRequestKind;
  askedOn: DateString;
  remindedOn: DateString | null;
  resolvedOn: DateString | null;
}
export interface UnlinkedAccount {
  userId: string;
  name: string;
  email: string;
  role: string;
  siteName: string | null;
  createdOn: DateString;
}

export interface HireResult {
  employee: EmployeeFileView;
  login: { created: boolean; reason?: string };
  nextStep: 'CREATE_CONTRACT' | 'FINISH_FILE' | 'ADD_TO_ROTA';
}

export interface MoveRow {
  id: string;
  kind: 'TRANSFER' | 'LOAN';
  status: 'SCHEDULED' | 'ACTIVE' | 'DONE' | 'CANCELLED';
  employeeId: string;
  fromSite: { id: string; name: string };
  toSite: { id: string; name: string };
  toDepartment: { id: string; name: string } | null;
  startsOn: DateString;
  endsOn: DateString | null;
}
/** Used by transfer and exit previews. Nothing is written. `impacts` come from later slices; absent lines mean "not built yet". */
export interface MovePreview {
  effectiveOn: DateString;
  newHead: { employeeId: string; name: string } | null;
  newReportsTo: { employeeId: string; name: string } | null;
  notified: { userId: string; name: string }[];
  impacts: ImpactLine[];
}

export interface Lookups {
  sites: { id: string; name: string; type: 'BRANCH' | 'CENTRAL_STORE'; isHub: boolean }[];
  departments: { id: string; siteId: string; name: string; inventoryTag: string | null; isActive: boolean }[];
  positions: { id: string; name: string; defaultTracksTime: boolean; loginRole: string | null; casualsAllowed: boolean; departmentIds: string[]; isActive: boolean }[];
  assignableLoginRoles: string[];
  exitReasons: ExitReason[];
  payChangeReasons: PayChangeReason[];
  probationVerdicts: ProbationVerdict[];
  contractTypes: { id: string; name: string; durationMonths: number | null }[];
  probationRule: { defaultMonths: number; maxExtensions: number; maxExtensionMonths: number };
  exitUndoDays: number;
}

export interface OrgDepartmentRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  peopleCount: number;
  casualCount: number;
  head: { employeeId: string; name: string; since: DateString } | null;
  actingHead: { employeeId: string; name: string; until: DateString } | null;
  approvalsGoTo: { employeeId: string; name: string; reason: 'HEAD' | 'ACTING_HEAD' | 'BRANCH_MANAGER' } | null;
  /** True for departments at a branch; the hub has no heads. */
  needsHead: boolean;
}
export interface OrgSiteView {
  id: string;
  name: string;
  type: 'BRANCH' | 'CENTRAL_STORE';
  managerName: string | null;
  peopleCount: number;
  departments: OrgDepartmentRow[];
  gaps: number;
}
export interface OrgOverview {
  sites: OrgSiteView[];
  /** headsOnLeave is null until leave (slice 5) exists. */
  counts: { departments: number; withoutHead: number; headsOnLeave: number | null; casualPools: number };
  positionsCount: number;
}
export interface DepartmentView extends OrgDepartmentRow {
  siteId: string;
  siteName: string;
  people: { rows: EmployeeListRow[]; total: number };
  casualPool: { employeeId: string; name: string; dailyRate: MoneyString | null }[];
  locked: SensitiveGroup[];
  positions: { id: string; name: string }[];
}
export interface HeadPreview {
  candidate: { employeeId: string; name: string };
  replaces: { employeeId: string; name: string } | null;
  actingUntil: DateString | null;
  notified: { userId: string; name: string }[];
  impacts: ImpactLine[];
}
export interface PositionView {
  id: string;
  name: string;
  defaultTracksTime: boolean;
  loginRole: string | null;
  casualsAllowed: boolean;
  isActive: boolean;
  departments: { id: string; name: string; siteName: string }[];
  holderCount: number;
  holders?: { employeeId: string; name: string; siteName: string; departmentName: string | null; isHead: boolean }[];
}
```

### 5.6 Wiring: subject, gateway, impact hooks, scheduler

```ts
// file: people/people-subject.ts
import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { nairobiToday, type NairobiDate } from '../_shared/time/nairobi-time';
import type { AccessSubject } from '../_shared/workforce-access';

declare global {
  namespace Express {
    interface Request {
      workforceSubject?: AccessSubject;
    }
  }
}

export interface SubjectFacts {
  employeeId: string | null;
  /** Null when the person has no file yet: the role default (decision D2) applies. */
  tracksTime: boolean | null;
  /** Active DepartmentHead rows today, substantive or acting. */
  headOfDepartmentIds: string[];
}

/** One query, in employees-repository.ts. */
export declare function loadSubjectFacts(userId: string, today: NairobiDate): Promise<SubjectFacts>;

export const buildSubject = (user: NonNullable<Request['user']>, facts: SubjectFacts): AccessSubject => ({
  ...user,
  ...(facts.tracksTime === null ? {} : { tracksTime: facts.tracksTime }),
  headOfDepartmentIds: facts.headOfDepartmentIds,
});

/** After `authenticate`. Sets req.workforceSubject for requireCapability, assertInScope and the services. */
export const attachWorkforceSubject = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const facts = await loadSubjectFacts(req.user.id, nairobiToday(new Date()));
  req.workforceSubject = buildSubject(req.user, facts);
  next();
};
```

```ts
// file: people/people-account-gateway.ts
import type { DepartmentTag, Prisma } from '@prisma/client';
import type { HireLoginRole } from './people.constants';

export interface NewLogin {
  name: string;
  email: string;
  phone: string | null;
  role: HireLoginRole;
  siteId: string;
  temporaryPassword: string;
}
export interface LoginCreated {
  userId: string;
  legacyProfileId: string | null;
}

/**
 * The ONLY file in Workforce that imports legacy Access code (staff-service, staff-repository, auth-repository,
 * staff-transfer-repository). Section 6.3 lists what the Access owner must agree to.
 */
export interface AccountGateway {
  /** Creates the account through the legacy staff service. Never logs or stores the password. */
  createLogin(input: NewLogin, actorId: string): Promise<LoginCreated>;
  /** Deactivate (and revoke every refresh token) or reactivate. */
  setActive(userId: string, active: boolean, actorId: string): Promise<void>;
  /** Moves the login to another site through the legacy transfer code (writes StaffTransfer and User.siteId). */
  moveToSite(userId: string, toSiteId: string, authorizedById: string, notes: string): Promise<void>;
  /** The only writer of User.isDepartmentHead and User.departmentTag (5.4). Runs inside the caller's transaction. */
  setHeadClaims(tx: Prisma.TransactionClient, userId: string, claims: { isDepartmentHead: boolean; departmentTag: DepartmentTag | null }): Promise<void>;
}

export declare const accountGateway: AccountGateway;
```

```ts
// file: people/people-hooks.ts
import type { NairobiDate } from '../_shared/time/nairobi-time';

export type ImpactKind = 'TRANSFER' | 'EXIT' | 'HEAD_CHANGE' | 'TRACKS_TIME_OFF' | 'LOAN';

export interface ImpactQuery {
  kind: ImpactKind;
  employeeIds: string[];
  siteId: string;
  departmentId: string | null;
  effectiveOn: NairobiDate;
}

/** A machine-readable line. The screen maps `code` to wording from the approved copy table; this is never prose. */
export interface ImpactLine {
  code: string; // for example 'ROTA_SHIFTS_REMOVED', 'APPROVALS_MOVE', 'FINAL_PAY_PENDING'
  count: number | null; // null when the owning slice is not built yet
  detail: Record<string, string | number | null>;
}

export type ImpactProvider = (query: ImpactQuery) => Promise<ImpactLine[]>;

const providers = new Map<string, ImpactProvider>();

/** Later slices register at start-up so previews can say what a change will do to their data. */
export function registerImpactProvider(name: string, provider: ImpactProvider): void {
  providers.set(name, provider);
}

export async function collectImpacts(query: ImpactQuery): Promise<ImpactLine[]> {
  const lines = await Promise.all([...providers.values()].map((provider) => provider(query)));
  return lines.flat();
}
```

```ts
// file: people/people-scheduler.ts
import type { NairobiDate } from '../_shared/time/nairobi-time';

export const PEOPLE_SCHEDULER_TASKS = [
  'activateStarted',
  'finalizeExits',
  'applyMoves',
  'applyPayChanges',
  'reconcileHeadClaims',
  'expireDrafts',
] as const;
export type PeopleTask = (typeof PEOPLE_SCHEDULER_TASKS)[number];

export interface TaskReport {
  task: PeopleTask;
  changed: number;
}

/** Runs every task in order for the given Nairobi day. Each task is idempotent; the report says how many rows each changed. */
export declare function runPeopleScheduler(today: NairobiDate): Promise<TaskReport[]>;
```

**Scheduler.** One BullMQ repeatable job `people.scheduler` on the existing `reports` queue (the pattern of `stale-clock-out`), at 00:05 Nairobi, plus one registration line in `jobs/workers.ts`. It runs six idempotent tasks in order; each is safe to run twice and reports how many rows it changed: `activateStarted` (ONBOARDING to ACTIVE on the start date), `finalizeExits`, `applyMoves` (due transfers, loans starting and ending), `applyPayChanges`, `reconcileHeadClaims`, `expireDrafts` (older than `DRAFT_KEEP_DAYS`). Every task entry it writes has channel `SYSTEM`.

---

## 6. Access-lane coupling

### 6.1 Exactly what outside Workforce changes

| File | Change | Columns changed |
|---|---|---|
| `backend/prisma/schema/access.prisma`, model `Site` | two lines: `departments Department[]` and `employees Employee[]` | none |
| same, model `User` | one line: `employee Employee?` | none |
| `backend/prisma/schema/workforce.prisma` | `ContractType` gets `contracts Contract[]`; `HrDocument` gains `employeeId` and the optional profile (2.1) | `hr_documents` only (legacy HR table, replaced by this slice) |
| `backend/src/services/staff-service.ts`, `hardDeleteStaff` | one guard line: refuse (409, "Deactivate instead") an account that has an employee file | none |
| `backend/src/routes/index.ts` | mount two routers from the Workforce door; call `registerPeople()` | n/a |
| `backend/src/jobs/workers.ts` | one registration line for the scheduler | n/a |

`prisma migrate diff` shows these and nothing else. (Scratch check: `Site` and `User` columns are identical before and after.)

### 6.2 What stays untouched (confirmed)

The **`User` model and table**: no column, no default, no index. **`utils/jwt.ts` and the login token**: same shape, same claims. **`middleware/authenticate.ts`** and `middleware/rbac.ts`: not edited. **Inventory**: no file, and it still reads `isDepartmentHead` and `departmentTag` from the token and `User` exactly as today. The only writes into Access-owned data are the four listed in 6.3, all through one file (`people-account-gateway.ts`); the only edit to an Access file besides the back-relations is the one guard line in `hardDeleteStaff` (6.1).

### 6.3 What must be agreed with the Access owner

1. **The three back-relation lines** in `access.prisma` (6.1).
2. **Account creation by HR.** `staffService.createStaff` today allows only Manager (floor roles), Director (managers only), Store Manager (attendants) and System Admin; **HR is refused**, yet the approved hire has HR creating the login. Ask: let HR create floor-role accounts. Fallback if Access prefers not to: the gateway calls it as a system actor after Workforce has checked the capability. Either way the gateway is the only caller.
3. **The only writers of the two head columns** become the gateway (5.4). The old `departmentService.assignHead / unassignHead` and `staffTransferRepository`'s head-clearing are retired in the same release as the new Organisation screen (section 10); until then there are two writers, so the two ship together.
4. **Deactivate and reactivate** an account on exit, undo and rehire. Today `deactivateStaff` does not delete refresh tokens (only the password reset does) and an access token stays valid until it expires. Ask: delete refresh tokens on deactivate (the gateway does it itself for now). A deactivated person's open token works for up to 15 minutes; confirm that is acceptable.
5. **Moving a login to another site** uses today's `staffTransferRepository.create` (it writes `StaffTransfer`, updates `User.siteId`, and clears the old head marker). Confirm Access is happy that Workforce calls it, and that the old `/staff-transfers` screen and routes are replaced by the new Transfer dialog.
6. **Token refresh timing** for claims (5.4): accept up to 15 minutes, or ask Access whether a forced refresh is wanted.
7. **The one-line guard in `hardDeleteStaff`** (6.1): an account with an employee file is never hard-deleted.

---

## 7. File layout

Backend, under `backend/src/modules/workforce/people/` (files keep layer-suffixed names; tests sit beside the code; the `_shared/` and `rules/` folders already exist):

```
people/
  README.md                      what the sub-module is, endpoints, status, coupling (7.1)
  people.constants.ts            lists, constants (5.5)
  people.types.ts                response types (5.5)
  people-validators.ts           every Zod schema (5.5)
  people-dates.ts                addMonths, probation, undo window (5.5)
  people-completeness.ts         the file's parts and percentages (5.5)
  people-subject.ts              attachWorkforceSubject, subject facts (5.6)
  people-account-gateway.ts      the ONLY file that imports legacy Access code (5.6)
  people-hooks.ts                impact providers (5.6)
  head-claims.ts                 claimsFromHeadRows, syncHeadClaims (5.4)
  tracks-time-resolver.ts        the resolver registered at start-up
  people-scheduler.ts            the six daily tasks (5.6)
  people-backfill.ts             exports the backfill SQL and a runner (2.5)
  people-routes.ts               all /workforce/people routes
  employees-controller.ts  employees-service.ts  employees-repository.ts
  hire-service.ts  drafts-repository.ts
  pay-service.ts   pay-repository.ts
  lifecycle-service.ts  lifecycle-repository.ts      probation, contract, transfer, loan, exit, undo, rehire
  org-routes.ts  org-controller.ts  org-service.ts  org-repository.ts
  *.test.ts
```

Frontend, under `frontend/features/workforce/people/` (session 3; `frontend/features/workforce/index.ts` is the feature's public API; shared bits in `frontend/features/workforce/_shared/`): `components/` (`employees-directory`, `add-employee` with one component per step, `employee-file` with its tabs and dialogs, `organisation`, `positions`, `phone-finish-file`), `hooks/`, `services/` (one function per endpoint in section 4), `store/` (wizard state only), `types/` (mirrors `people.types.ts`), `lib/` (formatters, masks). Pages in `frontend/app/` stay routing-only.

**Outside the module:** `prisma/schema/workforce/people.prisma`, the migration folder, `routes/index.ts` (mount), `jobs/workers.ts` (one line), `package.json` (a script `proof:people-backfill`), `access.prisma` and `workforce.prisma` (6.1). Docs: the READMEs below, `docs/DATA_MODEL.md` (the thirteen tables), `docs/API_CONTRACT.md` (section 4), `docs/features/workforce/README.md` (status row), `slice-0-contract.md` section 12 (the 2.1 table and the two capabilities).

### 7.1 What each README will say

- **`people/README.md`:** what People is (employees and organisation in one sub-module); the flows in one paragraph each; the access summary and the sensitive-fields rule (never expose a value without `redactSensitive`); the endpoint table; the scheduler tasks; the claims rule (5.4); coupling (the gateway is the only legacy-Access import; impact providers; events); the backfill and how to re-run it; status per flow.
- **`workforce/README.md`:** slice 1 built; the folder map gains `people/`.
- **`frontend/features/workforce/people/README.md`:** screens and their endpoints (section 8), the states kit usage, what is a placeholder, the backend gaps logged.

---

## 8. Screens (from Paper, read live 6 Oct 2026)

Every screen has four states: **loading** (the states kit skeleton), **empty**, **error** (retry), **no permission** (a "Not for your role" screen if the URL is opened; the menu link is hidden). "Gap" marks where the frontend session needs something that does not exist, logged in the README and batched into a later backend session (`feedback_backend_gaps_defer`).

| # | Screen (Paper chapter and step) | Fed by | States beyond the four | Gaps |
|---|---|---|---|---|
| 1 | **Employees directory** (Ch2 s1): KPI strip, filters All / Needs finishing / No contract yet / Casual pool / Exited, site and department filters, table | R1, R2, R3 | filter with no result | Search box also says "a request or a document": only people in slice 1 |
| 2 | **Add employee**, five steps (Ch2 s2 to s6) and the **casual** path of three (Ch2 s8): Who, Job, Pay, Statutory and bank, Login; the right panel "what this choice does" | W1 to W5, R3, R4 | draft saved; duplicate found; field refused (Branch Manager sees Pay and later steps as "HR only"); login failed after hire (retry W24) | the first-sign-in **email** is not built (the screen shows the temporary password once) |
| 3 | **New file after hire** (Ch2 s7): onboarding checklist, "Remind her" | R7, W25 | checklist done | Paper's ring says 60% for three of six rows; the server returns the true number (50%); flag to the owner |
| 4 | **Employee file, Overview** (Ch4 s1): completeness ring, probation card, Next steps, life timeline | R7 | exited banner, onboarding | the **on time, overtime and leave left** cells (slices 3, 4, 5) and the head's report line show "Designed later"; timeline events are the ones slice 1 owns (hired, documents, pay changes, moves, probation, exit, rehire) |
| 5 | **Job and pay tab** (Ch4 s2): Job card, Pay card (HR and Accountant only), Pay history | R7, R8 | pay locked (Branch Manager); pay change waiting for the Director | opening the Pay card writes an audit entry |
| 6 | **Edit the job** dialog (Ch4 s11) | W6, R3 | refused for a non-onboarding file (Branch Manager) | "Ask HR to change something" has **no backend** (approvals, slice 4) |
| 7 | **Change pay** dialog (Ch4 s12): now, new, starts on, reason, "who decides" | W10, R3 | a change already waiting | the Director's side is a list (R11) and a decision (W11) until "Waiting for you" exists (slice 4) |
| 8 | **Documents tab** (Ch4 s3) and **Upload a document** (Ch4 s14) | R9, R10, W27 | locked; contract missing | **Create the contract** (Ch4 s13) records the contract only: the numbered, PIN-signed document and the offer letter arrive in slice 4 |
| 9 | **Activity tab** (Ch4 s4) | none | | whole tab is "Designed later" (audit-log read side, slice 7) |
| 10 | **Time, Leave, Conduct tabs** | none | | "Designed later" frames naming slices 3, 5, 7 |
| 11 | **Transfer** (Ch4 s5) and **Send to another site** (Ch4 s8) | W15 to W18 | scheduled transfer shown; loan ending | the "what changes" lines for shifts and approvals fill in as slices 2 and 4 register impact providers; until then they are absent |
| 12 | **Branch Manager's view** (Ch4 s6): pay and bank locked, "Write a note" | R7, W14 | locked rows | "Ask HR to change something" (see 6) |
| 13 | **Probation decision** (Ch4 s7): confirm, extend once, end; head and Branch Manager notes | R7, W13, W14 | contract missing: decision recorded, completes later | |
| 14 | **Exit** (Ch4 s9), **an exited file** (Ch4 s10): undo for 7 days, then Rehire | W19 to W23, R7 | undo window open; closed | "final pay prepared" and "leave settled" lines come from slices 6 and 5 |
| 15 | **The employee's phone** (Ch4 s15 and Ch2 s9): finish your file, emergency contact, "Still to finish" | R6, W7, W8 | | first-sign-in password and PIN is the existing Access flow |
| 16 | **Organisation, Sites and departments** (Ch3 s1) | O1 | a site with gaps; hub "Complete" | **heads on leave** and "back 9 Oct" need leave (slice 5): shown as none; "approvals go to" is the head, else the Branch Manager |
| 17 | **One department** (Ch3 s2): people, head card, casual pool | O2 | no head; pool empty | "on shift", "late", "waiting on the head" (slices 3, 4): "Designed later" |
| 18 | **Assign a head** (Ch3 s3), **a head on leave** (Ch3 s4), **Add a department** (Ch3 s5) | O3, O6 to O9, R3 | no eligible person; hub refused | the leave state of the head (slice 5) |
| 19 | **Positions** tab (Ch3 s6), **Add position**, **Stop tracking time** (impact, "I understand"), **Retire** | O10 to O15 | held by people; nobody holds it | impacts from the rota (slice 2) |
| 20 | **Head appointment letter** (Ch3 s10) and the other letters (Ch4 s16 to s19) | none | | slice 4 (signed documents) |

Paper inconsistencies noted for the owner: (a) the new-hire ring (60%) and the file ring (67%) use different item lists; the server returns two numbers (ring and checklist, 5.5) that match the 67% and give 50% for the new hire; (b) Paper's Activity shows plain file opens as audit lines, which slice 1 does not write (3.2); (c) Paper shows a fourth site, "Head office"; today there is only the hub, so `Head office` is a department at the hub (question 3).

---

## 9. Tests

Named by file; "x3" runs in the three server zones (`TZ=UTC`, `Africa/Nairobi`, `America/Los_Angeles`). Per-role access is tested for every endpoint family with the real roles, not mocked grants.

**`people.constants.test.ts`**: lists are non-empty and unique; `HIRE_LOGIN_ROLES` never contains a privileged or device role; every code in `AUDIT_ACTIONS` added here is registered with the categories in 5.2.
**`people-dates.test.ts` (x3)**: `addMonths` (31 Jan plus one month is 28 Feb and 29 Feb in a leap year; 5 Oct 2026 plus 3 is 5 Jan 2027; 14 Jul plus 3 is 14 Oct); `undoUntil` (31 Oct plus 7 is 7 Nov); `canUndoExit` on day 7 yes and day 8 no; `actingEndsOn`.
**`people-completeness.test.ts`**: Joy's file gives 4 of 6 and 67%; a new monthly hire with three rows done gives 50% on the checklist; a casual has no bank, login, statutory, photo or contract items; locked parts are omitted.
**`people-validators.test.ts`**: every schema accepts its example and refuses bad dates, bad money (`28000.555`), a float amount, an unknown reason, a casual with a login, `BANK` without an account number, `MPESA` without a phone, an acting head without a return date.
**`people-backfill.test.ts`**: the exported SQL equals the migration's backfill text; the SQL's tracks-time list equals `defaultTracksTime()` for all 15 roles; no statement writes `users` or `employee_profiles`; the SQL is idempotent text (every insert guarded). **`people-backfill-db.test.ts`** (integration; runs only when `DATABASE_URL` names a `_proof` database): the counts and assertions of 2.6 on the seed and on the fixtures, twice.
**`employees-access.test.ts`**: for each of HR, Director, Accountant, Branch Manager (own site and another), Store Manager, department head (own and another department), staff, System Admin, display accounts: R1 to R10 and W5 to W9 return exactly the scope, the `locked` list in 3.1, masked values, and `403 FIELD_NOT_ALLOWED` or `404` where specified; a Branch Manager cannot edit a non-onboarding file; a head sees only their department's people; another company is always 404.
**`employees-service.test.ts`** (repository mocked): edit writes one entry with changed fields only and never ID values; "clocks in" override sets and clears; self-update clears `statutoryVerifiedAt`; reveal and pay-open write `SENSITIVE_VIEW` entries and the person's own views write none; photo and document rules.
**`hire-service.test.ts`**: monthly hire by HR (every step), by a Branch Manager (basics, no pay or login), casual (no login, daily rate, pool), adopt an account, duplicate ID refused, duplicate phone needs confirmation, position not offered, casuals not allowed, login role not allowed, number sequence under a lock, probation end from the rule, status `ONBOARDING` versus `ACTIVE`, a failed login leaves the file and returns the reason, the draft is removed, one entry and the right events after commit.
**`pay-service.test.ts`**: profile update; bank change needs a reason and notifies the Accountant; one pending change; approve, decline (note required); `SELF_APPROVAL`; an approved future change is applied by the scheduler and today's applies at once; history is never overwritten; no amount in any entry or event.
**`lifecycle-service.test.ts`**: contract creation bridges to legacy leave and completes a waiting probation confirmation; probation confirm, extend (limits from the rule), end; notes by head, Branch Manager and HR; transfer preview, immediate, scheduled, second scheduled refused, head role ended on transfer, login moved through the gateway; loan with a date and open-ended, cancel, end; exit in the future (`NOTICE`), backdated (finalises now), finalisation ends contracts, heads and moves and deactivates the login; undo on day 7 and refused on day 8; `notRestored` when the department got a new head; rehire refused inside the window and allowed after, same file, new spell and probation, login reactivated; every change is one `runAudited` call.
**`org-service.test.ts`**: department create (unique name, tag unique per site), retire blocked with people; head assign, replace, acting (ends the day before the return date), second acting refused, ineligible (wrong department, casual, no login, already a head), hub refused; claims written in the same transaction; event payload exactly as 5.3; position create, edit, retire blocked when held, "clocks in" impact and acknowledgement, override people untouched, one entry with the count.
**`head-claims.test.ts`**: `claimsFromHeadRows` for a tagged head, an untagged head (false), an ended row, a future row, an acting head; `reconcileHeadClaims` finds and fixes drift and is idempotent.
**`people-scheduler.test.ts`**: each of the six tasks is idempotent; `activateStarted`, `finalizeExits`, `applyMoves` (including a loan ending), `applyPayChanges`, `expireDrafts`; every entry has channel `SYSTEM`.
**`tracks-time-resolver.test.ts`**: reads the file by user id; falls back to the role default when there is no file; `/permissions/me` reports the real value and the head ids.
**`people-subject.test.ts`**: `attachWorkforceSubject` sets head ids and tracks time; a Pastry head does not get Kitchen scope; a claim-only subject keeps the tag rule.
**`people-account-gateway.test.ts`**: errors are mapped (email in use, hub rule); refresh tokens are revoked on deactivate; no password is logged or stored; only this file imports legacy Access code.
**`employees-routes.test.ts`, `org-routes.test.ts`**: for every route: 401 without a token, 403 without the capability, 400 for a bad uuid or body, 404 out of scope, the success envelope, static paths before `/:id`, and the response parses against its type.
**`people-repository.test.ts`** (static): every query carries `siteId` or `companyId`; no delete of an employee, spell, pay change, contract or move anywhere (drafts and file requests excepted); no raw SQL outside `*-repository.ts` and the backfill.
**`_shared/workforce-access.test.ts`** (amended): `payprofile.approve` and `probation.note` grants per role; `headOfDepartmentIds` scope, including no Kitchen cover for a Pastry head; claim-only subjects unchanged; the matrix completeness check includes the two new capabilities.
**`workforce-layering.test.ts`** (extended): no `requireRole(` and no `any` in `people/`; Prisma only in repositories (the audit writer's `$transaction` stays the named exception); the gateway is the only file in the module importing legacy `services/` or `repositories/`; the door's exports match the list in 9.1.

The gates (Session 2): `cd backend && pnpm build && pnpm test`; `pnpm test:workforce-tz`; `pnpm check:imports` with no new warning for `modules/workforce`; the layering checks above; the proof of 2.6; `prisma migrate diff` clean.

### 9.1 The door (`index.ts`) gains

`getEmployee` (**real**, replaces the slice 0 stub), `getActiveLoans`, `payAmountOn`, `registerImpactProvider`, `registerPeople`, `workforcePeopleRouter`, `workforceOrgRouter`, and the new types. Nothing else leaves the module.

---

## 10. Impact on legacy code

| Legacy | What happens | When |
|---|---|---|
| `routes/hr-routes.ts` profile endpoints (`/hr/profiles*`) and `services/hr-service.ts`, `repositories/hr-repository.ts` profile and document parts | **Replaced** by `/workforce/people*`. Removed in the same release as the new screens | Session 3 merges with Session 2 (one PR) |
| `routes/department-routes.ts`, `services/department-service.ts`, `repositories/department-repository.ts` | **Replaced** by the Organisation endpoints; the head columns then have one writer (6.3) | same release |
| `routes/staff-transfer-routes.ts`, `services/staff-transfer-service.ts` | **Replaced** by Transfer; the repository's `create` stays, called by the gateway | same release |
| `services/staff-service.ts` `createStaff` | **Keeps working** and is now called only through the gateway; the "Add staff" action for human roles leaves the Access staff screen (display accounts stay) | Session 3 |
| Frontend `app/app/hr/*`, `app/app/manage/departments`, `app/app/manage/staff` (human roles), `app/app/department` | **Replaced** by `features/workforce/people` pages | Session 3 |
| `services/staff-service.ts` `hardDeleteStaff` | **Keeps working, with one line added (listed in 6.1):** an account that has an employee file is refused with the same `409` "Deactivate instead" it already gives for orders and shifts. The foreign key (2.1) is the backstop. Nothing about a person is ever deleted | Session 2 (one line and a test) |
| `ContractType`, `LeavePolicy`, `LeaveBalance`, `LeaveRequest`, the legacy contract-assignment code | **Keep working** (the Contract bridge in 5.1) | slice 5 |
| `Shift`, `ShiftAssignment`, `ClockRecord`, `services/shift-*`, `clock-service`, kitchen and barista `onShift` | **Keep working, untouched**; they still key on `User`. A head of a department with no tag has no claim, so the old rota screens will not recognise them | slices 2 and 3 |
| `DisciplinaryRecord`, `Payslip`, payslip screens | **Keep working** | slices 7 and 6 |
| `User.departmentTag`, `isDepartmentHead` | **Kept, readable, now written by the gateway only** | n/a |
| `utils/departments.ts` | **Kept** (role-derived roster until slice 2) | slice 2 |
| `HrDocument` (legacy upload and delete routes) | the table is shared; the **new** document endpoints write `employeeId`; the legacy routes go with the HR profile endpoints | same release |

**Left broken on purpose.** (1) Between the Session 2 build and the Session 3 build the new endpoints exist but the old screens still use the old ones, so **the two are merged and deployed together**; if they must ship apart, new hires made through the old Add staff screen are not filed until someone uses `unlinked-accounts` and **adopt** (R5, W5). (2) A head of a custom department cannot use the old scheduling screens (fixed in slice 2). (3) The first-sign-in email, the signed contract and letters, and the Activity, Time, Leave and Conduct tabs wait for their slices (section 8). (4) The lateness bug and the other items slice 0 listed are still left as slice 0 said.

**Production safety.** The migration adds 13 tables and one nullable column, relaxes one NOT NULL, and backfills inside one transaction; it never writes `users` or `employee_profiles`. It can be applied to the live database; Session 2 proves it on a copy first (2.6). Rollback before Session 3 is dropping the 13 tables, restoring `hr_documents.employee_profile_id NOT NULL` (only if every row still has it), and dropping `employee_id`.

---

## 11. Open questions for the owner

Each has my recommendation; the contract is drafted as the recommendation. As for slice 0, **your recommendation-as-default applies unless you correct it**, and a correction goes in the amendment log.

1. **Does the pay set at hire need the Director's approval?** Paper's Activity row says "Hired at basic pay KES 28,000... Approved by the Director". I drafted: **no**; pay set at hire is in force at once and only *later changes* go to the Director. *Recommend: as drafted* (otherwise nobody can be paid until the Director acts on every hire).
2. **Can a Branch Manager edit an existing file's job?** Paper's Branch Manager view says "Ask HR to change something". I drafted: a Branch Manager can create a file and edit it **only while it is onboarding**; after that HR. That also means a Branch Manager can no longer create logins (HR does). *Recommend: as drafted.*
3. **Departments from role, not from tags in use.** Today only heads carry a tag, so I create the five standard departments at every branch and place people by role, plus `Stores` and `Head office` at the hub (Paper shows a fourth site "Head office"; there is none today). *Recommend: as drafted; no new site.*
4. **Inactive or deleted users are not migrated** (the brief said active users). Their history stays on the old tables until slices 5 and 6. The proof prints how many there are. *Recommend: leave them out, and decide once the production count is known; I will not invent exit dates.*
5. **Which login roles can HR give at hire?** Floor roles and Store Attendant only. Manager, Store Manager, Accountant, HR and Director accounts are still created by the Director or System Admin, then adopted into a file. *Recommend: as drafted, so HR cannot create a more powerful account than today.*
6. **Account creation by HR needs the Access owner** (6.3, item 2). *Recommend: Access lets HR create floor-role accounts; fallback is the system-actor call in the gateway.*
7. **Head claims for custom departments.** The `isDepartmentHead` and `departmentTag` claims are written only for heads of the five tagged departments, so Inventory never meets a head with no tag. A head of a new department (a Bakery) works through the Workforce head rows, but the old rota screens will not know them until slice 2. *Recommend: as drafted.*
8. **Employee number format.** I drafted `W-0001`, one series for the company (an example). *Recommend: keep, or tell me the format you want (for example by site).*
9. **Standard hours per person.** Paper shows "Standard week 48 h" and "Standard day 8 h" on each pay profile. I store them per person, empty until HR sets them (no default invented). *Recommend: per person now; a company default in Rules when slice 4 builds the Week and breaks screen.*
10. **What counts as "Needs finishing"?** I drafted: any of identity, job, pay, bank, login, NSSF and SHA, photo and details missing (contract and emergency contact have their own filter and request). Paper's caption lists "bank, contract or photo". *Recommend: as drafted.*
11. **What is audited for reading.** Pay opens, document opens and explicit "Show" reveals, not every file open (3.2). *Recommend: as drafted; the Activity tab waits for slice 7.*
12. **The 7-day undo window and the lists.** The window is a constant (`EXIT_UNDO_DAYS = 7`, from your decision); the exit reasons (Resigned, End of contract, Dismissed, Redundancy, Retired, Other), pay change reasons and probation verdicts (Good, Concerns) are starter lists in code. *Recommend: keep as constants now; move any of them into Rules only if you want to edit them yourselves.*
13. **Probation notes are new.** Chapter 4 steps 6 and 7 show the head's and Branch Manager's notes, which slice 0 did not design. I added a small `ProbationNote` table and the `probation.note` capability. *Recommend: yes.*
14. **Pay-change approval before "Waiting for you" exists.** The Director gets a list and a decision endpoint now (new capability `payprofile.approve`); slice 4 folds it into the approvals list. *Recommend: yes.*
15. **The contract is a record until slice 4.** `contractStatus` becomes active when HR records the contract, and a waiting probation confirmation completes then; the numbered, PIN-signed document comes with Signed documents. *Recommend: as drafted.*
16. **A daily scheduler.** Scheduled exits (the login stopping at midnight), transfers, pay changes and acting heads need one small job, in the existing BullMQ pattern. *Recommend: yes.*
17. **Ship the backend and the screens together.** Sessions 2 and 3 are one PR (10). *Recommend: yes.*

---

## 12. Amendment log

The backend session fills this in. Every change from this contract is recorded here with the date, the section, the change and the reason, and mentioned in the recap. (The 2.1 table and the two new capabilities are changes **to slice 0** and are copied into `slice-0-contract.md` section 12 at build time.)

| Date | Section | Change | Reason |
|---|---|---|---|
