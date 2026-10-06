# Workforce slice 0 (foundation): contract

**Status:** APPROVED by the owner on 6 Oct 2026, with every recommendation in section 11 taken as the default. Not frozen. The backend session (Session 2) builds from this and fills the amendment log (section 12); when slice 0 ships it is rewritten "as built" and frozen.
**Branch:** `feat/workforce-foundation` (lane 1, from `main`). **Code in this session:** none.
**Sources:** `proposal.md` (v2) and `README.md` of this folder; the code on `main`. No Paper file was opened (slice 0 has no screens). Where the documents were silent or disagreed, section 11 says what I chose and why.

**How to read this (owner).** Most of the length is code the backend session copies; you do not need to read it. Read these, in about 15 minutes: section 1 (what slice 0 is and is not), the prose of section 2.1 and the mapping table in 2.5 (what happens to today's data), section 3.1, 3.3 (the matrix, who can do what) and 3.4 (what is hidden), the rules tables in 6.2 and 6.3 (who edits and confirms each setting, who is told), section 5.3 and 5.4 (how the audit log is protected and kept), section 10 (what is left broken on purpose), and **section 11 (14 questions, each with my recommendation)**. Sections 4, 7, 8 and 9 are for the builder.

**Placeholders.** Every number in this document that looks like a policy value (grace minutes, allowances, caps, durations) is an **example**. None is a legal or policy value. Statutory tables ship **empty**.

Code blocks start with `// file:` giving the path under `backend/src/modules/workforce/`. **Checks run on this draft** (scratch files, deleted afterwards, nothing in the repo changed): (1) every TypeScript and Zod block was extracted and compiled with `tsc --noEmit` under the backend's strict settings, against its real `zod`, `express`, `@prisma/client` and `utils`: clean; (2) a runtime script confirmed every rule default passes its schema, every rule field has a policy and every site schema equals the fields marked `site`, bad values are refused, every capability is held by someone, the sensitive-field results quoted in section 3 are what the code gives, and the access matrix in 3.3 was generated from the code; (3) every Prisma model and enum was validated with `prisma validate` on a copy of the real schema (the engine functions are signatures only, so their tests are Session 2's work). That process found and fixed three defects in my first draft (a bad import, a week-anchor check that crashed on an impossible date, single-line enums Prisma rejects).

---

## 1. Scope and non-goals

**Slice 0 builds** (backend only, no screens, no endpoint except the three reads named below):

1. **Access table**: one table, role by capability by scope, `GET /workforce/permissions/me`, `requireCapability(...)`, service guards, sensitive-field hiding.
2. **Time engine**: pure functions (Nairobi helpers, lateness, hours worked, weekly and period totals, overtime candidates, period boundaries).
3. **Audit writer**: append-only, hash-chained entries written inside the caller's database transaction.
4. **Rules store**: versioned, effective-dated settings in ten groups, company default plus site override, `getEffectiveRules(siteId, date)`, two read endpoints.
5. **Whole-module data model**, designed once here (section 2). Only the four slice-0 tables are migrated.
6. **Public door** (`index.ts`): types, event names, and the pieces above.

**Slice 0 deliberately does not**:
- add any screen, any frontend file, or any write endpoint (rule edits are service functions; the Rules screens and their endpoints are slice 4);
- touch `User`, the login token, `authenticate.ts`, Access, Inventory, or any legacy service (section 10);
- migrate Employee, Rota, Clock, Leave, Payroll or Conduct tables, or backfill any data;
- fix the lateness bug in `hr-repository.ts` (it is left on purpose; section 10);
- invent statutory rates, overtime multipliers or legal limits;
- deliver notifications (it emits events and declares a notifier interface; wording and delivery come with the slices that own the screens).

---

## 2. Whole-module data model

### 2.1 Conventions (follow `main`)

- The place is `Site` and the id field is **`siteId`**, column `organization_id` (`@map("organization_id")`). `Company` owns sites. Roles are the `UserRole` enum. Dates are `@db.Date` (a UTC-midnight `Date` whose calendar day is the **Nairobi** date; see `utils/date-only.ts`). Moments are `DateTime` (UTC).
- Table names are plural snake case, columns snake case via `@map`, ids are `uuid()`. Money is `Decimal(12,2)`; never `Float`.
- **Slice-0 tables carry plain id columns with no Prisma relations** to `User`, `Site` or `Company`. Prisma needs a back-relation field on the other model for every relation, and that would edit `access.prisma`. Audit history must also outlive any other row. Later slices add real relations, and with them one-line back-relation fields in `access.prisma`: one per site-scoped model on `Site` (about 14 by slice 7) and one on `User` (`Employee Employee?`). They change no column. `prisma format` on a scratch copy produced exactly those and nothing else; that needs the Access lane's agreement (question 4).
- Every repository query on a tenant-scoped model includes `siteId` (or `companyId` for company-level rows), as Non-Negotiable 3 requires.
- The new models below use new names. Where an old table is **evolved in place** (kept, columns added) the table says so.
- `DepartmentTag` (Inventory's fixed list) is **not** changed. `Department` (below) has an optional `inventoryTag` that links to it so Inventory keeps working.

### 2.2 Enums

```prisma
// slice 0
enum RuleGroup {
  LATENESS
  OVERTIME
  ATTENDANCE
  LEAVE
  PROBATION
  CASUAL_WORK
  CONDUCT
  STATUTORY
  HOLIDAYS
  WEEK_AND_BREAKS
}

enum AuditCategory {
  PEOPLE            // file, org, departments, heads, roles
  TIME              // rota, clock events and corrections, overtime, timesheets
  LEAVE
  PAY_SETUP         // pay profiles, contracts
  PAY_RUN_PREPARE   // preparing a run
  PAY_RUN_DECIDE    // approve, publish, reopen
  RULES_OPERATING   // lateness, overtime (non-pay), attendance, leave, probation, casual, conduct, week
  RULES_PAY         // statutory, overtime multipliers, holiday pay, and their confirmations
  PAYSLIP_ACCESS    // a payslip was opened or unlocked (never amounts)
  SENSITIVE_VIEW    // pay, ID or bank details viewed
  DISCIPLINE
  SECURITY          // sign-ins, password and PIN changes, sessions (written by Access, read here)
  DOCUMENTS         // signatures, exports, prints
  LOG_ACCESS        // somebody read the audit log
}

enum AuditChannel {
  APP
  SYSTEM
  ASSISTANT
}

// slices 1 to 7 (declared here, migrated by the slice named)
enum PayType {                 // slice 1
  MONTHLY_SALARY
  DAILY_RATE
}

enum EmploymentStatus {        // slice 1
  ONBOARDING
  ACTIVE
  ON_LEAVE
  SUSPENDED
  NOTICE
  EXITED
}

enum ContractStatus {          // slice 1
  NONE
  ACTIVE
  ENDED
}

enum PayoutMethod {            // slice 1
  BANK
  MPESA
}

enum RotaStatus {              // slice 2
  DRAFT
  PUBLISHED
}

enum ClockEventType {          // slice 3
  IN
  OUT
  AUTO_OUT
  CORRECTION
}

enum ClockEventSource {        // slice 3
  PHONE
  HEAD
  MANAGER
  SYSTEM
}

enum TimesheetLineStatus {     // slice 4
  CLEAN
  APPROVED_AUTO
  NEEDS_REVIEW
  APPROVED
  EXCUSED
  ADJUSTED
}

enum PeriodStatus {            // slice 4
  OPEN
  CLOSED
}

enum OvertimeStatus {          // slice 4
  PENDING
  APPROVED
  DECLINED
  EXPIRED
}

enum ProblemStatus {           // slice 4
  WAITING
  ACCEPTED
  DECLINED
}

enum ApprovalType {            // slice 4
  OVERTIME
  PROBLEM_REPORT
  CLOCK_MISTAKE
  LEAVE
  TIMESHEET_PERIOD
  PAY_RUN
  DISCIPLINE
  EMPLOYEE_CHANGE
}

enum ApprovalStatus {          // slice 4
  WAITING
  APPROVED
  DECLINED
  CANCELLED
}

enum SignedDocumentType {      // slice 4 (first documents), the rest as each slice builds them
  LEAVE_SLIP
  OVERTIME_AUTHORISATION
  TIMESHEET_REPORT
  PAY_RUN_SUMMARY
  PAYSLIP
  CASUAL_VOUCHER
  WARNING_NOTICE
  LETTER
  ROTA
}

enum PayRunStatus {            // slice 6
  DRAFT
  IN_REVIEW
  APPROVED
  PUBLISHED
  PAID
  REOPENED
}

enum PayLineType {             // slice 6
  BASIC
  OVERTIME
  LATENESS_DEDUCTION
  STATUTORY
  ALLOWANCE
  ADVANCE
  ADJUSTMENT
  REVERSAL
}

enum ConductLevel {            // slice 7
  VERBAL_NOTE
  WRITTEN_WARNING
  FINAL_WRITTEN_WARNING
}

enum ConductStatus {           // slice 7
  OPEN
  ISSUED
  ACKNOWLEDGED
  APPEALED
  UPHELD
  REDUCED
  WITHDRAWN
  EXPIRED
}
```

### 2.3 Slice 0 models (migrated now)

```prisma
/// Append-only. UPDATE and DELETE are refused by a database trigger (section 5). No relations on purpose.
model AuditEntry {
  id             String        @id @default(uuid())
  companyId      String        @map("company_id")
  siteId         String?       @map("organization_id")   // the place the change belongs to; null = company-wide
  seq            BigInt                                    // per company, gap-free, starts at 1
  occurredAt     DateTime      @default(now()) @map("occurred_at")
  actorId        String?       @map("actor_id")           // null for SYSTEM
  actorRole      String        @map("actor_role")         // UserRole at the time, as text
  actorName      String        @map("actor_name")         // snapshot, so renames never rewrite history
  channel        AuditChannel  @default(APP)
  action         String                                   // registered code, e.g. "rules.version_created"
  category       AuditCategory
  subjectType    String        @map("subject_type")       // "RuleVersion", "Employee", ...
  subjectId      String        @map("subject_id")
  subjectUserId  String?       @map("subject_user_id")    // the person the change is about ("Activity on my record")
  before         Json?
  after          Json?
  reason         String?
  deviceLabel    String?       @map("device_label")       // "Android, Chrome"; never a raw IP
  placeLabel     String?       @map("place_label")        // approximate, "Nyeri"; best effort
  prevHash       String        @map("prev_hash")          // hash of seq-1; 64 zeros for seq 1
  hash           String                                    // sha256 over the canonical entry plus prevHash

  @@unique([companyId, seq])
  @@index([companyId, occurredAt])
  @@index([companyId, category, occurredAt])
  @@index([siteId, occurredAt])
  @@index([subjectUserId, occurredAt])
  @@index([subjectType, subjectId])
  @@map("workforce_audit_entries")
}

/// One row per company: the tip of the chain. Locked FOR UPDATE by the writer to hand out seq numbers.
model AuditChainHead {
  companyId String   @id @map("company_id")
  lastSeq   BigInt   @default(0) @map("last_seq")
  lastHash  String   @map("last_hash")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("workforce_audit_chain_heads")
}

/// One immutable version of one rule group. siteId null = company default (full group).
/// siteId set = a site override holding ONLY the fields that group allows a site to override.
model RuleVersion {
  id                  String    @id @default(uuid())
  companyId           String    @map("company_id")
  siteId              String?   @map("organization_id")
  group               RuleGroup
  version             Int                                     // 1, 2, 3 ... per (companyId, siteId, group)
  effectiveFrom       DateTime  @map("effective_from") @db.Date // a Nairobi date
  values              Json                                    // validated by the group's Zod schema
  valuesSchemaVersion Int       @default(1) @map("values_schema_version")
  reason              String
  createdById         String    @map("created_by_id")
  createdByRole       String    @map("created_by_role")
  createdAt           DateTime  @default(now()) @map("created_at")

  confirmations RuleConfirmation[]

  @@index([companyId, group, effectiveFrom])
  @@index([siteId, group, effectiveFrom])
  // Raw SQL in the migration (Prisma cannot express them), like Inventory's one-Central-Store index:
  //   unique (company_id, group, version) WHERE organization_id IS NULL
  //   unique (company_id, organization_id, group, version) WHERE organization_id IS NOT NULL
  @@map("workforce_rule_versions")
}

/// Someone confirmed a part of a version (Accountant: pay rates, statutory; Director: holiday list).
model RuleConfirmation {
  id            String      @id @default(uuid())
  ruleVersionId String      @map("rule_version_id")
  scope         String                                         // "overtime.multipliers", "statutory", "holidays.dates"
  confirmedById String      @map("confirmed_by_id")
  confirmerRole String      @map("confirmer_role")
  confirmedAt   DateTime    @default(now()) @map("confirmed_at")
  note          String?

  ruleVersion RuleVersion @relation(fields: [ruleVersionId], references: [id])

  @@unique([ruleVersionId, scope])
  @@map("workforce_rule_confirmations")
}
```

Immutability: `RuleVersion` and `RuleConfirmation` have no update or delete in any repository (a test greps for it). A mistake is fixed by a new version.

### 2.4 Models for slices 1 to 7 (designed here, migrated later)

Column lists are complete enough to build from; a slice may add a column it discovers (logged in the amendment log, never silently).

```prisma
// ---- Slice 1: People ----------------------------------------------------------------------
model Department {                    // replaces User.departmentTag as the source of truth
  id           String         @id @default(uuid())
  siteId       String         @map("organization_id")
  name         String
  inventoryTag DepartmentTag? @map("inventory_tag")   // keeps Inventory working; one department per tag per site
  isActive     Boolean        @default(true) @map("is_active")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  site      Site             @relation(fields: [siteId], references: [id])
  employees Employee[]
  heads     DepartmentHead[]

  @@unique([siteId, name])
  @@index([siteId])
  @@map("departments")
}

model Position {                      // company-wide list HR edits
  id               String   @id @default(uuid())
  companyId        String   @map("company_id")
  name             String
  defaultTracksTime Boolean @default(true) @map("default_tracks_time")
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  employees        Employee[]

  @@unique([companyId, name])
  @@map("positions")
}

model Employee {                      // replaces EmployeeProfile; one row per person, casuals included
  id                 String           @id @default(uuid())
  siteId             String           @map("organization_id")     // home site
  userId             String?          @unique @map("user_id")      // null = casual, no login
  employeeNumber     String           @map("employee_number")
  name               String
  departmentId       String?          @map("department_id")
  positionId         String?          @map("position_id")
  reportsToId        String?          @map("reports_to_id")
  status             EmploymentStatus @default(ONBOARDING)
  payType            PayType          @map("pay_type")
  contractStatus     ContractStatus   @default(NONE) @map("contract_status")
  tracksTime         Boolean          @default(true) @map("tracks_time")
  startDate          DateTime         @map("start_date") @db.Date
  probationEndsOn    DateTime?        @map("probation_ends_on") @db.Date
  exitedOn           DateTime?        @map("exited_on") @db.Date
  photoUrl           String?          @map("photo_url")
  // personal and statutory details (sensitive: hidden by capability, section 3.6)
  nationalId         String?          @map("national_id")
  kraPin             String?          @map("kra_pin")
  shaNumber          String?          @map("sha_number")
  nssfNumber         String?          @map("nssf_number")
  helbNumber         String?          @map("helb_number")
  dateOfBirth        DateTime?        @map("date_of_birth") @db.Date
  personalPhone      String?          @map("personal_phone")
  personalEmail      String?          @map("personal_email")
  physicalAddress    String?          @map("physical_address")
  emergencyName      String?          @map("emergency_name")
  emergencyRelation  String?          @map("emergency_relation")
  emergencyPhone     String?          @map("emergency_phone")
  legacyProfileId    String?          @unique @map("legacy_profile_id") // EmployeeProfile.id during the changeover
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")

  site       Site        @relation(fields: [siteId], references: [id])
  user       User?       @relation(fields: [userId], references: [id])
  department Department? @relation(fields: [departmentId], references: [id])
  position   Position?   @relation(fields: [positionId], references: [id])
  reportsTo  Employee?   @relation("EmployeeReportsTo", fields: [reportsToId], references: [id])
  reports    Employee[]  @relation("EmployeeReportsTo")
  payProfile PayProfile?
  contracts  Contract[]
  heads      DepartmentHead[]

  @@unique([siteId, employeeNumber])
  @@index([siteId, status])
  @@index([departmentId])
  @@map("employees")
}

model Contract {
  id              String         @id @default(uuid())
  employeeId      String         @map("employee_id")
  contractTypeId  String?        @map("contract_type_id")   // legacy ContractType kept (leave policy hangs off it)
  startsOn        DateTime       @map("starts_on") @db.Date
  endsOn          DateTime?      @map("ends_on") @db.Date
  status          ContractStatus @default(ACTIVE)
  signedDocumentId String?       @map("signed_document_id")
  createdAt       DateTime       @default(now()) @map("created_at")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([employeeId, status])
  @@map("contracts")
}

model PayProfile {                    // sensitive; one per employee
  id              String       @id @default(uuid())
  employeeId      String       @unique @map("employee_id")
  amount          Decimal      @db.Decimal(12, 2)            // monthly salary or daily rate, by Employee.payType
  overtimeEligible Boolean     @default(false) @map("overtime_eligible")
  payoutMethod    PayoutMethod @map("payout_method")
  bankName        String?      @map("bank_name")
  bankBranch      String?      @map("bank_branch")
  accountName     String?      @map("account_name")
  accountNumber   String?      @map("account_number")
  mpesaPhone      String?      @map("mpesa_phone")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@map("pay_profiles")
}

model DepartmentHead {                // a responsibility, one active per department per site
  id           String    @id @default(uuid())
  departmentId String    @map("department_id")
  employeeId   String    @map("employee_id")
  startsOn     DateTime  @map("starts_on") @db.Date
  endsOn       DateTime? @map("ends_on") @db.Date
  assignedById String    @map("assigned_by_id")

  department Department @relation(fields: [departmentId], references: [id])
  employee   Employee   @relation(fields: [employeeId], references: [id])

  @@index([departmentId, endsOn])
  @@map("department_heads")
}

// ---- Slice 2: Rota ------------------------------------------------------------------------
model ShiftTemplate {                 // replaces Shift; no overnight; the unpaid break lives here
  id                 String   @id @default(uuid())
  siteId             String   @map("organization_id")
  name               String
  startTime          String   @map("start_time")         // "HH:MM" Nairobi, same as legacy
  endTime            String   @map("end_time")           // must be later than startTime
  unpaidBreakMinutes Int      @default(0) @map("unpaid_break_minutes")
  isActive           Boolean  @default(true) @map("is_active")
  legacyShiftId      String?  @unique @map("legacy_shift_id")
  createdAt          DateTime @default(now()) @map("created_at")

  site Site @relation(fields: [siteId], references: [id])

  @@index([siteId])
  @@map("shift_templates")
}

model RotaWeek {
  id          String     @id @default(uuid())
  siteId      String     @map("organization_id")
  departmentId String?   @map("department_id")
  weekStart   DateTime   @map("week_start") @db.Date
  status      RotaStatus @default(DRAFT)
  publishedAt DateTime?  @map("published_at")
  publishedById String?  @map("published_by_id")

  site Site @relation(fields: [siteId], references: [id])

  @@unique([siteId, departmentId, weekStart])
  @@map("rota_weeks")
}
// ShiftAssignment is EVOLVED IN PLACE (same table "shift_assignments"): adds rotaWeekId, templateId (to
// ShiftTemplate; legacy shiftId kept until slice 3 ships), status, createdVia. Existing unique key kept.

// ---- Slice 3: Attendance ------------------------------------------------------------------
model ClockEvent {                    // append-only (trigger, as AuditEntry); a correction is a new row
  id                String           @id @default(uuid())
  siteId            String           @map("organization_id")
  employeeId        String           @map("employee_id")
  shiftAssignmentId String?          @map("shift_assignment_id")
  type              ClockEventType
  source            ClockEventSource
  occurredAt        DateTime         @map("occurred_at")   // the moment that counts (server-trusted)
  deviceAt          DateTime?        @map("device_at")      // what the phone said; a big gap is flagged
  serverAt          DateTime         @default(now()) @map("server_at")
  clientEventId     String?          @map("client_event_id") // idempotency: a retry cannot create a second event
  correctsEventId   String?          @map("corrects_event_id")
  voidsCorrected    Boolean          @default(false) @map("voids_corrected")
  latitude          Decimal?         @db.Decimal(10, 7)
  longitude         Decimal?         @db.Decimal(10, 7)
  distanceMetres    Int?             @map("distance_metres")
  reason            String?
  recordedById      String?          @map("recorded_by_id")  // head or manager who recorded it for someone

  site Site @relation(fields: [siteId], references: [id])

  @@unique([employeeId, clientEventId])
  @@index([siteId, occurredAt])
  @@index([employeeId, occurredAt])
  @@map("clock_events")
}

model CasualDay {
  id          String   @id @default(uuid())
  siteId      String   @map("organization_id")
  employeeId  String   @map("employee_id")
  departmentId String  @map("department_id")
  date        DateTime @db.Date
  arrivedAt   DateTime? @map("arrived_at")
  leftAt      DateTime? @map("left_at")
  recordedById String  @map("recorded_by_id")
  approvedById String? @map("approved_by_id")
  approvedAt  DateTime? @map("approved_at")

  site Site @relation(fields: [siteId], references: [id])

  @@unique([employeeId, date])
  @@index([siteId, date])
  @@map("casual_days")
}

model ShiftActivitySnapshot {         // evidence for overtime approval only; never a pay input
  id             String   @id @default(uuid())
  siteId         String   @map("organization_id")
  employeeId     String   @map("employee_id")
  shiftDate      DateTime @map("shift_date") @db.Date
  ordersHandled  Int      @default(0) @map("orders_handled")
  orderValue     Decimal  @default(0) @map("order_value") @db.Decimal(12, 2)
  ticketsCleared Int      @default(0) @map("tickets_cleared")
  openWorkAtEnd  Boolean  @default(false) @map("open_work_at_end")

  site Site @relation(fields: [siteId], references: [id])

  @@unique([employeeId, shiftDate])
  @@map("shift_activity_snapshots")
}

// ---- Slice 4: Timesheets, overtime, approvals, signed documents -----------------------------
model TimesheetPeriod {
  id        String       @id @default(uuid())
  siteId    String       @map("organization_id")
  startsOn  DateTime     @map("starts_on") @db.Date
  endsOn    DateTime     @map("ends_on") @db.Date
  status    PeriodStatus @default(OPEN)
  closedAt  DateTime?    @map("closed_at")
  closedById String?     @map("closed_by_id")

  site  Site            @relation(fields: [siteId], references: [id])
  lines TimesheetLine[]

  @@unique([siteId, startsOn])
  @@map("timesheet_periods")
}

model TimesheetLine {                 // one per employee per shift date
  id               String              @id @default(uuid())
  siteId           String              @map("organization_id")
  periodId         String              @map("period_id")
  employeeId       String              @map("employee_id")
  shiftDate        DateTime            @map("shift_date") @db.Date
  shiftAssignmentId String?            @map("shift_assignment_id")
  status           TimesheetLineStatus @default(NEEDS_REVIEW)
  scheduledMinutes Int                 @map("scheduled_minutes")
  workedMinutes    Int                 @map("worked_minutes")
  minutesLate      Int                 @default(0) @map("minutes_late")
  chargeableLateMinutes Int            @default(0) @map("chargeable_late_minutes")
  lateExcused      Boolean             @default(false) @map("late_excused")
  rulesVersionRefs Json                @map("rules_version_refs") // {LATENESS: 3, OVERTIME: 2, ...} used to compute this line
  reviewedById     String?             @map("reviewed_by_id")
  reviewedAt       DateTime?           @map("reviewed_at")

  site   Site            @relation(fields: [siteId], references: [id])
  period TimesheetPeriod @relation(fields: [periodId], references: [id])
  overtime OvertimeRequest[]
  adjustments TimeAdjustment[]

  @@unique([employeeId, shiftDate, shiftAssignmentId])
  @@index([siteId, periodId])
  @@map("timesheet_lines")
}

model OvertimeRequest {
  id               String         @id @default(uuid())
  siteId           String         @map("organization_id")
  timesheetLineId  String         @map("timesheet_line_id")
  employeeId       String         @map("employee_id")
  minutesRequested Int            @map("minutes_requested")
  minutesAutoRecognised Int       @default(0) @map("minutes_auto_recognised")
  minutesApproved  Int?           @map("minutes_approved")
  status           OvertimeStatus @default(PENDING)
  reasonChip       String?        @map("reason_chip")
  decidedById      String?        @map("decided_by_id")
  decidedAt        DateTime?      @map("decided_at")
  declineReason    String?        @map("decline_reason")

  site Site          @relation(fields: [siteId], references: [id])
  line TimesheetLine @relation(fields: [timesheetLineId], references: [id])

  @@index([siteId, status])
  @@map("overtime_requests")
}

model TimeAdjustment {                // an approved change to a line; the clock events stay untouched
  id              String   @id @default(uuid())
  timesheetLineId String   @map("timesheet_line_id")
  field           String                                   // "clock_in", "clock_out", "lateness_excused", ...
  fromValue       String?  @map("from_value")
  toValue         String?  @map("to_value")
  reason          String
  madeById        String   @map("made_by_id")
  madeAt          DateTime @default(now()) @map("made_at")

  line TimesheetLine @relation(fields: [timesheetLineId], references: [id])

  @@index([timesheetLineId])
  @@map("time_adjustments")
}

model ProblemReport {
  id              String        @id @default(uuid())
  siteId          String        @map("organization_id")
  timesheetLineId String        @map("timesheet_line_id")
  employeeId      String        @map("employee_id")
  kind            String                                   // wrong time, missed clock-out, lateness not fair, overtime not counted, other
  requestedValue  String?       @map("requested_value")
  note            String?
  status          ProblemStatus @default(WAITING)
  decidedById     String?       @map("decided_by_id")
  decidedAt       DateTime?     @map("decided_at")
  declineReason   String?       @map("decline_reason")
  createdAt       DateTime      @default(now()) @map("created_at")

  site Site @relation(fields: [siteId], references: [id])

  @@index([siteId, status])
  @@map("problem_reports")
}

model ApprovalRequest {               // one "Waiting for you" row; chain of command per decision D13
  id           String         @id @default(uuid())
  siteId       String         @map("organization_id")
  type         ApprovalType
  subjectType  String         @map("subject_type")
  subjectId    String         @map("subject_id")
  subjectUserId String?       @map("subject_user_id")   // who it is about (a request never goes to its own subject)
  requestedById String        @map("requested_by_id")
  chain        Json                                      // ordered approver capability steps, e.g. ["head","unit","hr"]
  currentStep  Int            @default(0) @map("current_step")
  waitingOnId  String?        @map("waiting_on_id")      // person, when one person; null = any holder of the capability
  dueAt        DateTime?      @map("due_at")
  status       ApprovalStatus @default(WAITING)
  decidedById  String?        @map("decided_by_id")
  decidedAt    DateTime?      @map("decided_at")
  createdAt    DateTime       @default(now()) @map("created_at")

  site Site @relation(fields: [siteId], references: [id])

  @@index([siteId, status, dueAt])
  @@index([waitingOnId, status])
  @@map("approval_requests")
}

model SignedDocument {
  id          String             @id @default(uuid())
  siteId      String?            @map("organization_id")
  type        SignedDocumentType
  number      String                                      // "LVE-0031", "PS-1042"
  subjectType String             @map("subject_type")
  subjectId   String             @map("subject_id")
  signedById  String             @map("signed_by_id")
  signedByRole String            @map("signed_by_role")
  signedAt    DateTime           @map("signed_at")
  contentHash String             @map("content_hash")     // the QR check compares against this
  archivedAt  DateTime?          @map("archived_at")      // set only by the 7-year archive job (slice 7)

  @@unique([type, number])
  @@index([subjectType, subjectId])
  @@map("signed_documents")
}

// ---- Slice 5: Leave -----------------------------------------------------------------------
// LeaveRequest, LeaveBalance, LeavePolicy, ContractType, LeaveRequestAcknowledgement are EVOLVED IN PLACE:
// LeaveRequest gains employeeId (to Employee), approvalRequestId; the working-days count becomes a calendar-day
// count through the Nairobi helpers. Leave types come from the LEAVE rule group (new types need no migration).

// ---- Slice 6: Payroll ---------------------------------------------------------------------
model PayRun {
  id           String       @id @default(uuid())
  siteId       String       @map("organization_id")
  label        String                                    // "October 2026"
  periodStart  DateTime     @map("period_start") @db.Date
  periodEnd    DateTime     @map("period_end") @db.Date
  payDate      DateTime     @map("pay_date") @db.Date
  status       PayRunStatus @default(DRAFT)
  preparedById String       @map("prepared_by_id")
  approvedById String?      @map("approved_by_id")
  publishedById String?     @map("published_by_id")
  publishedAt  DateTime?    @map("published_at")
  rulesVersionRefs Json     @map("rules_version_refs")
  lines        PayLine[]

  site Site @relation(fields: [siteId], references: [id])

  @@unique([siteId, periodStart])
  @@map("pay_runs")
}

model PayLine {
  id            String      @id @default(uuid())
  payRunId      String      @map("pay_run_id")
  employeeId    String      @map("employee_id")
  type          PayLineType
  quantity      Decimal?    @db.Decimal(12, 4)
  rate          Decimal?    @db.Decimal(12, 4)
  amount        Decimal     @db.Decimal(12, 2)
  sourceType    String?     @map("source_type")           // "TimesheetLine", "OvertimeRequest", ...
  sourceId      String?     @map("source_id")
  ruleVersion   Int?        @map("rule_version")
  working       String?                                    // the line's shown working text

  payRun PayRun @relation(fields: [payRunId], references: [id])

  @@index([payRunId, employeeId])
  @@map("pay_lines")
}
// Payslip is EVOLVED IN PLACE: gains payRunId (null for old typed payslips) and keeps the view gate untouched.

// ---- Slice 7: Conduct, audit read side, trusted phones --------------------------------------
model ConductCase {
  id             String        @id @default(uuid())
  siteId         String        @map("organization_id")
  employeeId     String        @map("employee_id")
  level          ConductLevel
  status         ConductStatus @default(OPEN)
  issuedById     String?       @map("issued_by_id")
  issuedAt       DateTime?     @map("issued_at")
  expiresAt      DateTime?     @map("expires_at") @db.Date
  evidence       Json?                                      // attached timesheet lines
  acknowledgedAt DateTime?     @map("acknowledged_at")
  notSignedNote  String?       @map("not_signed_note")      // reason and witness when the person did not sign
  appealDecidedById String?    @map("appeal_decided_by_id")
  legacyRecordId String?       @unique @map("legacy_record_id")
  createdAt      DateTime      @default(now()) @map("created_at")

  site Site @relation(fields: [siteId], references: [id])

  @@index([siteId, status])
  @@index([employeeId])
  @@map("conduct_cases")
}

model TrustedDevice {                 // "My phones": a private marker saved at sign-in
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  markerHash String    @map("marker_hash")
  label      String
  confirmedAt DateTime? @map("confirmed_at")
  lastSeenAt DateTime  @default(now()) @map("last_seen_at")

  @@unique([userId, markerHash])
  @@map("trusted_devices")
}
```

**Gaps found in proposal section 4** (needed by the approved designs, added above): `Contract`, `PayProfile` has bank and M-Pesa details, `TimesheetPeriod`, `ShiftActivitySnapshot`, `ConductCase`, `TrustedDevice`. There is no model for leave types (they are data in the LEAVE rule group) or for statutory tables (the STATUTORY rule group).

### 2.5 Legacy-to-new mapping and backfill notes

| Today (table) | Becomes | Slice | Backfill note |
|---|---|---|---|
| `EmployeeProfile` + `User` (human roles) | `Employee` (+ `Contract`, `PayProfile`) | 1 | One `Employee` per active human `User`; keep `legacyProfileId`; `contractStatus = NONE` where no contract (shown as "No contract yet"); `tracksTime` from D2 by role; `payType` MONTHLY_SALARY unless profile says CASUAL; no pay amounts exist today, so `PayProfile` is created empty and payroll stays blocked per person until HR fills it. |
| `User.departmentTag`, `isDepartmentHead` | `Department`, `DepartmentHead` | 1 | One `Department` per (site, tag in use); one `DepartmentHead` row per head flag; the flag and tag on `User` stay readable by Access and Inventory and are refreshed by `department.head_changed`. |
| `ContractType`, `LeavePolicy`, `LeaveBalance`, `LeaveRequest` | same tables, evolved | 5 | Add `employeeId` and fill from `employeeProfileId` through `legacyProfileId`; balances keep their year; no data is moved. |
| `Shift` | `ShiftTemplate` | 2 | One template per shift, `legacyShiftId` set, `unpaidBreakMinutes = 0` (no break existed). Any legacy shift whose end is not later than its start cannot exist (API forbade it). |
| `ShiftAssignment` | same table, evolved | 2 | Add nullable columns only; every row keeps its id so clock records still join. Past rows get no `RotaWeek`. |
| `ClockRecord` | `ClockEvent` | 3 | Each record with `clockInAt` becomes an IN event (`source` PHONE for GPS, MANAGER for OVERRIDE); with `clockOutAt` an OUT event; `overrideNote` becomes the reason. `ClockRecord` stays and is read-only from the slice-3 deploy; it is dropped in a later cleanup, not by slice 3. Old rows computed lateness on the server clock; they are recomputed by the engine, never copied. |
| `getAttendanceSummary` (15-minute constant) | timesheets and the LATENESS rule | 4 | Reports switch to engine output; history before slice 3 is recomputed from events on read. |
| `DisciplinaryRecord`, `HrDocument` (warning letters) | `ConductCase`, files stay in `HrDocument` | 7 | Map `actionTaken` VERBAL_WARNING to VERBAL_NOTE, WRITTEN_WARNING to WRITTEN_WARNING, FINAL_WARNING to FINAL_WRITTEN_WARNING; SUSPENSION and TERMINATION stay in the legacy table (not conduct levels). |
| `Payslip` (typed numbers, view gate) | same table, evolved | 6 | `payRunId` null for every old row; the gate and the lock stay as they are; old payslips remain readable by their owner. |
| `StaffTransfer` | stays (Access) | 1 | No move; slice 1 decides how Workforce hears about a transfer. |
| (none) audit | `AuditEntry` | 0 | Starts empty; first entry is the first rule edit. |
| (none) rules | `RuleVersion` | 0 | Starts empty; code defaults serve until the first edit (section 6.3). |

**Tables slice 0 itself migrates:** `workforce_audit_entries`, `workforce_audit_chain_heads`, `workforce_rule_versions`, `workforce_rule_confirmations` (four, all new, all empty; the migration also adds the append-only triggers and the two partial unique indexes). It changes no existing table.

---

## 3. Access table

One table, **role by capability by scope**, in `_shared/workforce-access.ts`. Routes, services and the front end all read it; the front end gets it from `GET /workforce/permissions/me`. Same pattern as Inventory's `central-store-access.ts`: desktop roles read every Workforce screen inside their scope; write belongs to whoever does the job; sensitive fields are hidden by capability. Changing a rule after client feedback means editing the grants below and nothing else. **No new `requireRole(...)` list is added anywhere**, in this slice or later.

### 3.1 Roles and how they map to the proposal's columns

| Proposal column (section 9) | Roles in code (`UserRole`) |
|---|---|
| Staff | `WAITER`, `CHEF`, `BARISTA`, `STEWARD`, `HOUSEKEEPING` |
| Dept head | any of the above (or a Store Attendant) with `isDepartmentHead` and a `departmentTag`; **a marker, not a role**. The legacy `DEPARTMENT_HEAD` enum value, which no live user should hold, is treated as Staff plus the marker |
| Store Att. | `STORE_ATTENDANT` |
| Accountant | `ACCOUNTANT` |
| Branch / Store Mgr | `MANAGER` (Branch Manager) and `STORE_MANAGER` (hub), identical grants; "unit" means their own site |
| HR | `HR_MANAGER` |
| Director | `DIRECTOR` |
| Sys Admin | `SYSTEM_ADMIN` |
| (no access) | `KITCHEN_DISPLAY`, `BARISTA_DISPLAY`: device accounts, not employees |

A department head holds **their base role's grants plus the head extras**; where both give the same capability the wider scope wins (own < dept < unit < all). That is why a head also has "own payslip" and "own discipline" without a separate row.

### 3.2 Capabilities and grants (the code)

The capability list comes from proposal section 9. Some capabilities are **additions** the proposal's table did not spell out; question 5 asks the owner to confirm them: `employee.write_basic`, `employee.write_sensitive`, `employee.lifecycle` (hiring and editing are in section 2.3 of the proposal but not in the table), `payrun.read`, `org.*`, and the per-group `rules.edit.*` / `rules.confirm.*` split of the "policy" row.

```ts
// file: _shared/audit/audit.types.ts   (constants only here; the rest of this file is in section 5)
export const AUDIT_CATEGORIES = [
  'PEOPLE',
  'TIME',
  'LEAVE',
  'PAY_SETUP',
  'PAY_RUN_PREPARE',
  'PAY_RUN_DECIDE',
  'RULES_OPERATING',
  'RULES_PAY',
  'PAYSLIP_ACCESS',
  'SENSITIVE_VIEW',
  'DISCIPLINE',
  'SECURITY',
  'DOCUMENTS',
  'LOG_ACCESS',
] as const;
export type AuditCategoryCode = (typeof AUDIT_CATEGORIES)[number];
```

```ts
// file: _shared/workforce-access.ts
import type { NextFunction, Request, Response } from 'express';
import type { DepartmentTag, UserRole } from '@prisma/client';
import { sameDepartmentGroup } from '../../../utils/departments';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../../utils/errors';
import type { AuditCategoryCode } from './audit/audit.types';

export const SCOPES = ['own', 'dept', 'unit', 'all'] as const;
export type Scope = (typeof SCOPES)[number];

export const CAPABILITIES = [
  // my own things
  'me.file', // my employee file, including my own IDs, bank and documents
  'me.payslip', // my payslips, behind the payslip gate
  'me.payprofile', // my own pay profile
  'time.own', // clock in/out/undo, My time, Report a problem (removed when the person does not track time)
  // rota and the day
  'rota.read',
  'rota.write', // edit and publish
  'today.read',
  'today.act', // clock for someone, mark absent, extend a shift
  // time
  'timesheet.read',
  'timesheet.approve',
  'overtime.approve',
  'clock_mistake.resolve',
  'casual.record',
  'casual.approve',
  'casual.read',
  // leave
  'leave.request',
  'leave.acknowledge',
  'leave.read',
  'leave.approve',
  // people
  'employee.read_basic',
  'employee.read_sensitive', // IDs, bank, documents
  'employee.write_basic', // hire basics, job details
  'employee.write_sensitive',
  'employee.lifecycle', // exit, rehire, transfer
  'payprofile.read', // other people's pay profiles
  'payprofile.write',
  'org.read',
  'org.write', // departments and positions
  'org.write_heads', // assign and replace department heads
  // rules
  'rules.read',
  'rules.edit.lateness',
  'rules.edit.overtime',
  'rules.edit.attendance',
  'rules.edit.leave',
  'rules.edit.probation',
  'rules.edit.casual_work',
  'rules.edit.conduct',
  'rules.edit.statutory',
  'rules.edit.holidays',
  'rules.edit.week_breaks',
  'rules.confirm.pay_rates', // overtime multipliers, holiday pay rate
  'rules.confirm.statutory',
  'rules.confirm.holiday_list',
  // pay
  'payrun.read',
  'payrun.prepare',
  'payrun.approve',
  'payrun.publish',
  'payrun.reopen',
  // conduct
  'discipline.read_own',
  'discipline.read',
  'discipline.issue',
  // audit log (what each role may read is one capability per category)
  'audit.read_own', // "Activity on my record"
  'audit.read.people',
  'audit.read.time',
  'audit.read.leave',
  'audit.read.pay_setup',
  'audit.read.pay_run_prepare',
  'audit.read.pay_run_decide',
  'audit.read.rules_operating',
  'audit.read.rules_pay',
  'audit.read.payslip_access',
  'audit.read.sensitive_view',
  'audit.read.discipline',
  'audit.read.security',
  'audit.read.documents',
  'audit.read.log_access',
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type Grants = Partial<Record<Capability, Scope>>;

type AuditReadCapability = `audit.read.${Lowercase<AuditCategoryCode>}`;
/** Compile-time check: every audit category has its read capability (fails the build if one is missing). */
export const AUDIT_CAPABILITIES_COMPLETE: Exclude<AuditReadCapability, Capability> extends never ? true : never = true;

export const auditReadCapability = (category: AuditCategoryCode): Capability =>
  `audit.read.${category.toLowerCase()}` as AuditReadCapability;

const ALL_AUDIT_READS: Grants = Object.fromEntries(
  CAPABILITIES.filter((c) => c.startsWith('audit.read.')).map((c) => [c, 'all' as const]),
);

const OWN_FILE: Grants = {
  'me.file': 'own',
  'me.payslip': 'own',
  'me.payprofile': 'own',
  'leave.request': 'own',
  'discipline.read_own': 'own',
  'audit.read_own': 'own',
};

const STAFF: Grants = { ...OWN_FILE, 'time.own': 'own', 'rota.read': 'own' };

const HEAD_EXTRAS: Grants = {
  'rota.read': 'dept',
  'rota.write': 'dept',
  'today.read': 'dept',
  'today.act': 'dept',
  'timesheet.read': 'dept',
  'timesheet.approve': 'dept', // inside the overtime allowance; the service checks the allowance
  'overtime.approve': 'dept',
  'casual.record': 'dept',
  'casual.read': 'dept',
  'leave.acknowledge': 'dept',
  'leave.read': 'dept',
  'employee.read_basic': 'dept',
  'org.read': 'dept',
};

const UNIT_MANAGER: Grants = {
  ...OWN_FILE,
  'rota.read': 'unit',
  'rota.write': 'unit',
  'today.read': 'unit',
  'today.act': 'unit',
  'timesheet.read': 'unit',
  'timesheet.approve': 'unit',
  'overtime.approve': 'unit',
  'clock_mistake.resolve': 'unit', // Store Manager resolves the Store Attendants' (decision D8)
  'casual.approve': 'unit',
  'casual.read': 'unit',
  'leave.read': 'unit',
  'leave.approve': 'unit', // never their own; a manager's own request goes to HR
  'employee.read_basic': 'unit',
  'employee.write_basic': 'unit',
  'rules.read': 'unit',
  'rules.edit.lateness': 'unit', // own site only: writes a site override
  'rules.edit.overtime': 'unit',
  'rules.edit.leave': 'unit', // minimum cover only (field policy, section 6)
  'discipline.read': 'unit',
  'discipline.issue': 'unit',
  'org.read': 'unit',
  'org.write_heads': 'unit',
  'audit.read.time': 'unit',
  'audit.read.leave': 'unit',
  'audit.read.rules_operating': 'unit', // they are told when their branch's rules change (question 7a, decided)
};

export const ROLE_GRANTS: Partial<Record<UserRole, Grants>> = {
  WAITER: STAFF,
  CHEF: STAFF,
  BARISTA: STAFF,
  STEWARD: STAFF,
  HOUSEKEEPING: STAFF,
  DEPARTMENT_HEAD: STAFF, // legacy value; always treated as a head too
  STORE_ATTENDANT: STAFF,
  ACCOUNTANT: {
    ...STAFF,
    'timesheet.read': 'all',
    'employee.read_basic': 'all',
    'employee.read_sensitive': 'all',
    'payprofile.read': 'all',
    'rules.read': 'all',
    'rules.edit.statutory': 'all',
    'rules.confirm.pay_rates': 'all',
    'rules.confirm.statutory': 'all',
    'payrun.read': 'all',
    'payrun.approve': 'all',
    'audit.read.pay_run_decide': 'all',
    'audit.read.rules_pay': 'all',
  },
  MANAGER: UNIT_MANAGER,
  STORE_MANAGER: UNIT_MANAGER,
  HR_MANAGER: {
    ...OWN_FILE,
    'rota.read': 'all',
    'rota.write': 'all', // also builds the Accountant's rota (decision D18)
    'today.read': 'all',
    'timesheet.read': 'all',
    'timesheet.approve': 'all',
    'overtime.approve': 'all',
    'casual.read': 'all',
    'leave.read': 'all',
    'leave.approve': 'all',
    'employee.read_basic': 'all',
    'employee.read_sensitive': 'all',
    'employee.write_basic': 'all',
    'employee.write_sensitive': 'all',
    'employee.lifecycle': 'all',
    'payprofile.read': 'all',
    'payprofile.write': 'all',
    'org.read': 'all',
    'org.write': 'all',
    'org.write_heads': 'all',
    'rules.read': 'all',
    'rules.edit.leave': 'all',
    'rules.edit.holidays': 'all',
    'payrun.read': 'all',
    'payrun.prepare': 'all',
    'payrun.publish': 'all',
    'discipline.read': 'all',
    'discipline.issue': 'all',
    'audit.read.people': 'all',
    'audit.read.time': 'all',
    'audit.read.leave': 'all',
    'audit.read.pay_setup': 'all',
    'audit.read.pay_run_prepare': 'all',
    'audit.read.discipline': 'all',
  },
  DIRECTOR: {
    ...OWN_FILE,
    'rota.read': 'all',
    'today.read': 'all',
    'timesheet.read': 'all',
    'casual.read': 'all',
    'leave.read': 'all',
    'leave.approve': 'all', // fallback only: the approvals sub-module routes to the Director when the approver is the subject or absent
    'employee.read_basic': 'all',
    'employee.read_sensitive': 'all',
    'payprofile.read': 'all',
    'org.read': 'all',
    'rules.read': 'all',
    'rules.edit.lateness': 'all',
    'rules.edit.overtime': 'all',
    'rules.edit.attendance': 'all',
    'rules.edit.leave': 'all',
    'rules.edit.probation': 'all',
    'rules.edit.casual_work': 'all',
    'rules.edit.conduct': 'all',
    'rules.edit.week_breaks': 'all',
    'rules.confirm.holiday_list': 'all',
    'payrun.read': 'all',
    'payrun.publish': 'all',
    'payrun.reopen': 'all',
    'discipline.read': 'all',
    ...ALL_AUDIT_READS,
  },
  SYSTEM_ADMIN: {
    // no "me.*": the System Admin has no payslip, no file and no clock (decisions D2, D15)
    'rota.read': 'all',
    'rota.write': 'all',
    'today.read': 'all',
    'today.act': 'all',
    'timesheet.read': 'all',
    'timesheet.approve': 'all',
    'overtime.approve': 'all',
    'clock_mistake.resolve': 'all',
    'leave.read': 'all',
    'leave.approve': 'all',
    'employee.read_basic': 'all',
    'employee.write_basic': 'all',
    'employee.lifecycle': 'all',
    'org.read': 'all',
    'org.write': 'all',
    'org.write_heads': 'all',
    'rules.read': 'all',
    'rules.edit.lateness': 'all',
    'rules.edit.overtime': 'all',
    'rules.edit.attendance': 'all',
    'payrun.read': 'all',
    'payrun.prepare': 'all',
    'payrun.approve': 'all',
    'payrun.publish': 'all',
    'payrun.reopen': 'all',
    'audit.read.security': 'all',
    'audit.read.rules_operating': 'all',
    'audit.read.rules_pay': 'all',
  },
};

export interface AccessSubject {
  id: string;
  role: UserRole;
  siteId: string | null;
  departmentTag?: DepartmentTag | null;
  isDepartmentHead?: boolean;
  /** Real value from the employee file (slice 1). When absent the role default (decision D2) applies. */
  tracksTime?: boolean;
}

/** Decision D2: who clocks in when no employee file says otherwise. */
export const defaultTracksTime = (role: UserRole): boolean =>
  ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'DEPARTMENT_HEAD', 'STORE_ATTENDANT', 'ACCOUNTANT'].includes(role);

const widest = (a: Scope, b: Scope): Scope => (SCOPES.indexOf(a) >= SCOPES.indexOf(b) ? a : b);

/** Every capability the person holds, with its scope. Base role plus head extras, minus time.own if they do not clock. */
export const grantsOf = (subject: AccessSubject): Grants => {
  const merged: Grants = { ...(ROLE_GRANTS[subject.role] ?? {}) };
  if (subject.isDepartmentHead === true || subject.role === 'DEPARTMENT_HEAD') {
    for (const [capability, scope] of Object.entries(HEAD_EXTRAS) as [Capability, Scope][]) {
      const current = merged[capability];
      merged[capability] = current ? widest(current, scope) : scope;
    }
  }
  if ((subject.tracksTime ?? defaultTracksTime(subject.role)) === false) delete merged['time.own'];
  return merged;
};

export const scopeOf = (subject: AccessSubject, capability: Capability): Scope | null => grantsOf(subject)[capability] ?? null;
export const workforceCan = (subject: AccessSubject, capability: Capability): boolean => scopeOf(subject, capability) !== null;

/** What a capability is checked against: the person, place and department the action touches. */
export interface AccessTarget {
  userId: string | null;
  siteId: string | null;
  departmentTag?: DepartmentTag | null;
}

const withinScope = (subject: AccessSubject, scope: Scope, target: AccessTarget): boolean => {
  switch (scope) {
    case 'all':
      return true;
    case 'unit':
      return subject.siteId !== null && target.siteId === subject.siteId;
    case 'dept':
      return (
        subject.siteId !== null &&
        target.siteId === subject.siteId &&
        !!subject.departmentTag &&
        !!target.departmentTag &&
        sameDepartmentGroup(subject.departmentTag, target.departmentTag)
      );
    case 'own':
      return target.userId !== null && target.userId === subject.id;
  }
};

export const inScope = (subject: AccessSubject, capability: Capability, target: AccessTarget): boolean => {
  const scope = scopeOf(subject, capability);
  return scope !== null && withinScope(subject, scope, target);
};

/**
 * Service guard. Writes out of scope are refused (403). Reads out of scope answer 404 so a record's existence is not
 * revealed (`onDeny: 'not_found'`).
 */
export const assertInScope = (
  subject: AccessSubject,
  capability: Capability,
  target: AccessTarget,
  onDeny: 'forbidden' | 'not_found' = 'forbidden',
): void => {
  if (inScope(subject, capability, target)) return;
  if (onDeny === 'not_found') throw new NotFoundError('Not found');
  throw new ForbiddenError('You do not have permission to perform this action');
};

/** Nobody approves their own request (leave, overtime, corrections). */
export const assertNotSelf = (subject: AccessSubject, target: AccessTarget): void => {
  if (target.userId !== null && target.userId === subject.id) {
    throw new ForbiddenError('You cannot approve your own request');
  }
};

/** Route guard: the caller needs at least one of these capabilities. Scope is then checked by the service. */
export const requireCapability = (...capabilities: Capability[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const subject: AccessSubject = req.user;
    if (!capabilities.some((c) => workforceCan(subject, c))) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    next();
  };
};

/** Sensitive fields, hidden by omission. `own` is the capability that reveals them on the person's own record. */
export const SENSITIVE_GROUPS = {
  pay: { own: 'me.payprofile', other: 'payprofile.read' },
  bank: { own: 'me.file', other: 'employee.read_sensitive' },
  ids: { own: 'me.file', other: 'employee.read_sensitive' },
  documents: { own: 'me.file', other: 'employee.read_sensitive' },
  discipline: { own: 'discipline.read_own', other: 'discipline.read' },
  payslip_opens: { own: 'audit.read_own', other: 'audit.read.payslip_access' },
} as const satisfies Record<string, { own: Capability; other: Capability }>;
export type SensitiveGroup = keyof typeof SENSITIVE_GROUPS;

/** The groups this person may NOT see on this record. The response carries the list so the screen can show a lock. */
export const lockedGroupsFor = (subject: AccessSubject, target: AccessTarget): SensitiveGroup[] =>
  (Object.keys(SENSITIVE_GROUPS) as SensitiveGroup[]).filter((group) => {
    const { own, other } = SENSITIVE_GROUPS[group];
    const mine = target.userId !== null && target.userId === subject.id;
    return !((mine && inScope(subject, own, target)) || inScope(subject, other, target));
  });

export interface Redacted<T> {
  data: Partial<T>;
  locked: SensitiveGroup[];
}

/** `fieldsByGroup` names which keys of a record belong to each sensitive group; locked keys are removed. */
export const redactSensitive = <T extends object>(
  subject: AccessSubject,
  target: AccessTarget,
  record: T,
  fieldsByGroup: Partial<Record<SensitiveGroup, readonly (keyof T)[]>>,
): Redacted<T> => {
  const locked = lockedGroupsFor(subject, target);
  const copy: Partial<T> = { ...record };
  for (const group of locked) for (const key of fieldsByGroup[group] ?? []) delete copy[key];
  return { data: copy, locked };
};
```

**Audit visibility** is the same table: reading a category of the audit log needs `audit.read.<category>`, with the scope shown. The per-role categories follow proposal section 8 (question 7 lists the three places I had to choose).

### 3.3 The matrix (generated from the code above)

Scope codes: `own`, `dept`, `unit` (own site), `all`, `–` none. "Head" is what a department head gets **on top of** their base role.

| Capability | Staff / Store Att. | Head (extra) | Accountant | Branch / Store Mgr | HR | Director | Sys Admin |
|---|---|---|---|---|---|---|---|
| `me.file` | own | – | own | own | own | own | – |
| `me.payslip` | own | – | own | own | own | own | – |
| `me.payprofile` | own | – | own | own | own | own | – |
| `time.own` | own | – | own | – | – | – | – |
| `rota.read` | own | dept | own | unit | all | all | all |
| `rota.write` | – | dept | – | unit | all | – | all |
| `today.read` | – | dept | – | unit | all | all | all |
| `today.act` | – | dept | – | unit | – | – | all |
| `timesheet.read` | – | dept | all | unit | all | all | all |
| `timesheet.approve` | – | dept | – | unit | all | – | all |
| `overtime.approve` | – | dept | – | unit | all | – | all |
| `clock_mistake.resolve` | – | – | – | unit | – | – | all |
| `casual.record` | – | dept | – | – | – | – | – |
| `casual.approve` | – | – | – | unit | – | – | – |
| `casual.read` | – | dept | – | unit | all | all | – |
| `leave.request` | own | – | own | own | own | own | – |
| `leave.acknowledge` | – | dept | – | – | – | – | – |
| `leave.read` | – | dept | – | unit | all | all | all |
| `leave.approve` | – | – | – | unit | all | all | all |
| `employee.read_basic` | – | dept | all | unit | all | all | all |
| `employee.read_sensitive` | – | – | all | – | all | all | – |
| `employee.write_basic` | – | – | – | unit | all | – | all |
| `employee.write_sensitive` | – | – | – | – | all | – | – |
| `employee.lifecycle` | – | – | – | – | all | – | all |
| `payprofile.read` | – | – | all | – | all | all | – |
| `payprofile.write` | – | – | – | – | all | – | – |
| `org.read` | – | dept | – | unit | all | all | all |
| `org.write` | – | – | – | – | all | – | all |
| `org.write_heads` | – | – | – | unit | all | – | all |
| `rules.read` | – | – | all | unit | all | all | all |
| `rules.edit.lateness` | – | – | – | unit | – | all | all |
| `rules.edit.overtime` | – | – | – | unit | – | all | all |
| `rules.edit.attendance` | – | – | – | – | – | all | all |
| `rules.edit.leave` | – | – | – | unit | all | all | – |
| `rules.edit.probation` | – | – | – | – | – | all | – |
| `rules.edit.casual_work` | – | – | – | – | – | all | – |
| `rules.edit.conduct` | – | – | – | – | – | all | – |
| `rules.edit.statutory` | – | – | all | – | – | – | – |
| `rules.edit.holidays` | – | – | – | – | all | – | – |
| `rules.edit.week_breaks` | – | – | – | – | – | all | – |
| `rules.confirm.pay_rates` | – | – | all | – | – | – | – |
| `rules.confirm.statutory` | – | – | all | – | – | – | – |
| `rules.confirm.holiday_list` | – | – | – | – | – | all | – |
| `payrun.read` | – | – | all | – | all | all | all |
| `payrun.prepare` | – | – | – | – | all | – | all |
| `payrun.approve` | – | – | all | – | – | – | all |
| `payrun.publish` | – | – | – | – | all | all | all |
| `payrun.reopen` | – | – | – | – | – | all | all |
| `discipline.read_own` | own | – | own | own | own | own | – |
| `discipline.read` | – | – | – | unit | all | all | – |
| `discipline.issue` | – | – | – | unit | all | – | – |
| `audit.read_own` | own | – | own | own | own | own | – |
| `audit.read.people` | – | – | – | – | all | all | – |
| `audit.read.time` | – | – | – | unit | all | all | – |
| `audit.read.leave` | – | – | – | unit | all | all | – |
| `audit.read.pay_setup` | – | – | – | – | all | all | – |
| `audit.read.pay_run_prepare` | – | – | – | – | all | all | – |
| `audit.read.pay_run_decide` | – | – | all | – | – | all | – |
| `audit.read.rules_operating` | – | – | – | unit | – | all | all |
| `audit.read.rules_pay` | – | – | all | – | – | all | all |
| `audit.read.payslip_access` | – | – | – | – | – | all | – |
| `audit.read.sensitive_view` | – | – | – | – | – | all | – |
| `audit.read.discipline` | – | – | – | – | all | all | – |
| `audit.read.security` | – | – | – | – | – | all | all |
| `audit.read.documents` | – | – | – | – | – | all | – |
| `audit.read.log_access` | – | – | – | – | – | all | – |

**Checked against proposal section 9.** Every row of the proposal's table maps to a capability above (Clock/My time/Report a problem is `time.own`; Own payslip and own file are `me.*`; the policy row is split into `rules.edit.*`; the Pay run row into `payrun.*`; the audit row into `audit.read.*`, section 8). The eight proposal columns are covered by seven here because Staff and Store Attendant hold identical grants, and so do Branch Manager and Store Manager. Where the proposal says a role "reads" and another "writes", the reader holds the `read` capability only (for example HR on `today.*`, the Director on `rota.*`).

Rules the matrix cannot show (they live in services, listed so they are not forgotten):
- **Not their own.** `timesheet.approve`, `overtime.approve`, `leave.approve`, `clock_mistake.resolve`: `assertNotSelf`. A manager's own leave goes to HR; HR's own goes to the Director (decision D13). The Director's `leave.approve` is a fallback the approvals sub-module routes to; it is not a general approval right.
- **Head's allowance.** A head's `overtime.approve` and `timesheet.approve` only cover time inside the overtime allowance (rules, OVERTIME, `serviceTailMinutes` and the weekly cap); beyond it the request moves to the Branch Manager.
- **Separation of duties in payroll.** The person who prepared a pay run cannot approve it (slice 6 service guard). The System Admin holds all pay-run capabilities per proposal section 9, so this guard is what stops one person doing both.
- **Casuals have no login.** Their data is reached only through `casual.*` and `employee.read_basic` on the head's or manager's scope.
- **Hub.** `unit` for a Store Manager is the hub site; Store Attendants' approvals go to the Store Manager (decision D8, D13).
- **Own discipline** is given to every role with an own file (the proposal lists only staff and attendants; managers and HR have files too).

### 3.4 Sensitive fields hidden by capability

| Group | Fields | Revealed to the person themself by | Revealed to others by |
|---|---|---|---|
| `pay` | pay amount, pay type amounts, overtime eligibility, rates | `me.payprofile` | `payprofile.read` (Accountant, HR, Director) |
| `bank` | bank name, branch, account, M-Pesa number | `me.file` | `employee.read_sensitive` (Accountant, HR, Director) |
| `ids` | national ID, KRA PIN, SHA, NSSF, HELB, date of birth | `me.file` | `employee.read_sensitive` |
| `documents` | contract, ID copies, certificates, medical | `me.file` | `employee.read_sensitive` |
| `discipline` | conduct cases and notices | `discipline.read_own` | `discipline.read` (Branch Manager of the unit, HR, Director) |
| `payslip_opens` | who opened a payslip, when, where | `audit.read_own` | `audit.read.payslip_access` (Director only; decision D14) |

The Branch Manager therefore sees hours, not pay, bank, IDs or documents (the approved Chapter 4 view). Payslip **amounts** are never in an audit entry. Hidden means **omitted from the response**, with `locked: SensitiveGroup[]` returned so a screen can show a lock instead of an empty cell.

### 3.5 Department heads and "tracks time" (a marker on a base role)

- A head is a base role plus `isDepartmentHead` and `departmentTag`, both already in the login token (`req.user`), so **nothing about the token or `User` changes**. `HEAD_EXTRAS` is merged in `grantsOf`.
- **Dept scope** is checked with the existing `sameDepartmentGroup` from `utils/departments.ts` (KITCHEN and PASTRY are one group until a Pastry head exists). Slice 1 replaces the tag test with `Department` ids and `DepartmentHead` rows; `AccessTarget` then gains `departmentId` (logged as an amendment then).
- **Tracks time** is a per-employee setting (slice 1). Until then `defaultTracksTime(role)` applies (decision D2): the capability `time.own` is dropped from `grantsOf` when the person does not track time. Services that act on a person's time call `requireTracksTime(subject)`, which uses a resolver the Employee sub-module registers in slice 1 (`setTracksTimeResolver`); slice 0 ships the default resolver.

```ts
// file: _shared/tracks-time.ts
import { ForbiddenError } from '../../../utils/errors';
import { defaultTracksTime, type AccessSubject } from './workforce-access';

export type TracksTimeResolver = (subject: Pick<AccessSubject, 'id' | 'role'>) => Promise<boolean>;

let resolver: TracksTimeResolver = async (subject) => defaultTracksTime(subject.role);

/** Slice 1 (Employee) registers the real lookup here at start-up. */
export const setTracksTimeResolver = (next: TracksTimeResolver): void => {
  resolver = next;
};

export const tracksTime = (subject: Pick<AccessSubject, 'id' | 'role'>): Promise<boolean> => resolver(subject);

export const requireTracksTime = async (subject: Pick<AccessSubject, 'id' | 'role'>): Promise<void> => {
  if (!(await tracksTime(subject))) throw new ForbiddenError('This person does not clock in');
};
```

### 3.6 `GET /workforce/permissions/me`

- **Request:** no body. `Authorization: Bearer` (route is behind `authenticate`; no `requireCapability`, every signed-in person may read their own row). Optional query `asRole` (demo only, as Inventory does): the System Admin may read another role's row to preview screens; for anyone else it is ignored, so nobody can read a bigger row than their own.
- **Response 200:** the person's capabilities with scope, and the facts the screens need.
- **Errors:** `401` when not signed in. There is no other error path.

```ts
// file: _shared/permissions-routes.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/authenticate';
import { UnauthorizedError } from '../../../utils/errors';
import { CAPABILITIES, ROLE_GRANTS, SCOPES, grantsOf, type AccessSubject, type Capability, type Scope } from './workforce-access';
import { tracksTime } from './tracks-time';

export const PermissionsQuerySchema = z.object({ asRole: z.string().optional() });

export const PermissionsMeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    role: z.string(),
    siteId: z.string().nullable(),
    isDepartmentHead: z.boolean(),
    departmentTag: z.string().nullable(),
    tracksTime: z.boolean(),
    capabilities: z.array(z.object({ capability: z.enum(CAPABILITIES), scope: z.enum(SCOPES) })),
  }),
});
export type PermissionsMe = z.infer<typeof PermissionsMeSchema>;

const router = Router();
router.use(authenticate);

router.get('/workforce/permissions/me', async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const { asRole } = PermissionsQuerySchema.parse(req.query);
  const preview = asRole !== undefined && req.user.role === 'SYSTEM_ADMIN' && asRole in ROLE_GRANTS ? asRole : null;
  const subject: AccessSubject = preview
    ? { id: req.user.id, role: preview as AccessSubject['role'], siteId: req.user.siteId, isDepartmentHead: false }
    : req.user;
  const clocks = await tracksTime(subject);
  const grants = grantsOf({ ...subject, tracksTime: clocks });
  const body: PermissionsMe = {
    success: true,
    data: {
      role: subject.role,
      siteId: subject.siteId,
      isDepartmentHead: subject.isDepartmentHead ?? false,
      departmentTag: subject.departmentTag ?? null,
      tracksTime: clocks,
      capabilities: (Object.entries(grants) as [Capability, Scope][]).map(([capability, scope]) => ({ capability, scope })),
    },
  };
  res.status(200).json(body);
});

export default router;
```

### 3.7 How routes and services use it

```ts
// file: rules/rules-routes.example.ts   (shape only; the real file is in section 6)
import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { assertInScope, assertNotSelf, requireCapability, type AccessSubject } from '../_shared/workforce-access';

export const exampleRouter = Router();
// Route: authenticate, then the capability. Never requireRole(...).
exampleRouter.get('/workforce/example', authenticate, requireCapability('timesheet.read'), (_req, res) => {
  res.status(200).json({ success: true });
});

// Service: scope and self checks on the actual record.
export const approveExample = (actor: AccessSubject, line: { userId: string; siteId: string }): void => {
  assertInScope(actor, 'timesheet.approve', { userId: line.userId, siteId: line.siteId });
  assertNotSelf(actor, { userId: line.userId, siteId: line.siteId });
};
```

---

## 4. Time engine

Pure functions in `_shared/time/` that turn **a rota, clock events and rules into lateness, hours worked and overtime**. No database, no `new Date()` (the current time is always a parameter), no server time zone. The rule values come in as arguments; `getEffectiveRules` (section 6) is what callers use to get them.

### 4.1 Ground rules the whole engine follows

1. **Every stored moment is UTC. Every shift time is a Nairobi clock time** (`"06:00"` means 06:00 in Nairobi). A **Nairobi date** is the calendar day in Nairobi, written `YYYY-MM-DD`.
2. **Nairobi is UTC+3 all year** (Kenya has no daylight saving). The helpers do plain arithmetic on a fixed offset of 180 minutes. They do not call `Intl`, `toLocale*` or any local-time `Date` method, so the result cannot depend on the server's zone. (`utils/date-only.ts` already relies on the same fixed +3 h in `getTodayNairobiRangeUtc`.)
3. **Forbidden inside `_shared/time/`:** `getHours`, `getMinutes`, `getDay`, `getDate`, `getMonth`, `getFullYear`, `setHours`, `toLocale*`, `Intl.`, and the local-time `new Date(y, m, d, ...)` constructor. A test greps the folder for them.
4. **No overnight shifts** (decision D5). A shift's end must be later than its start on the same date; the latest end is `23:59`. Work done **after** the scheduled end, even past midnight (a "stay on"), belongs to the **shift's date**, not the calendar date of the clock event.
5. **Early arrival is not paid time and not overtime.** Hours worked count from the scheduled start. Overtime is only time after the scheduled end (proposal 5.5).
6. **Minutes are whole and floored.** 06:05:40 against a 06:00 start is 5 minutes late (never rounded up against the person).
7. **Each shift is separate.** Two shifts in a day give two `DayHours`; totals add them.

### 4.2 Types and Nairobi helpers

```ts
// file: _shared/time/nairobi-time.ts   (signatures; Session 2 implements and tests)
export type NairobiDate = string & { readonly __brand: 'NairobiDate' }; // 'YYYY-MM-DD'
export type ClockTime = string & { readonly __brand: 'ClockTime' }; // 'HH:MM', 00:00 to 23:59
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Monday

export declare const NAIROBI_OFFSET_MINUTES: 180;

/** Throws ValidationError for anything that is not a real calendar date ('2026-02-30') or a real HH:MM ('24:00', '6:00'). */
export declare function parseNairobiDate(value: string): NairobiDate;
export declare function parseClockTime(value: string): ClockTime;

/** The Nairobi calendar day an instant falls on. 2026-10-05T21:00:00Z is 2026-10-06 in Nairobi. */
export declare function nairobiDateOf(instant: Date): NairobiDate;
export declare function nairobiClockOf(instant: Date): ClockTime;
export declare function nairobiToday(now: Date): NairobiDate;

export declare function minutesOfDay(time: ClockTime): number; // 06:05 -> 365
/** The UTC instant at which that Nairobi date and clock time happens. */
export declare function instantAt(date: NairobiDate, time: ClockTime): Date;

export declare function addDays(date: NairobiDate, days: number): NairobiDate;
export declare function daysBetween(from: NairobiDate, to: NairobiDate): number; // to - from, signed
export declare function eachDay(from: NairobiDate, to: NairobiDate): NairobiDate[]; // inclusive; [] when to < from
export declare function isoWeekday(date: NairobiDate): IsoWeekday;
/** The first day of the week containing `date`, for a week that starts on `weekStartsOn` (rule WEEK_AND_BREAKS). */
export declare function weekStart(date: NairobiDate, weekStartsOn: IsoWeekday): NairobiDate;
export declare function monthKey(date: NairobiDate): string; // '2026-10'

/** Bridges to the @db.Date convention of utils/date-only.ts (a UTC-midnight Date whose calendar day is the Nairobi date). */
export declare function toDateColumn(date: NairobiDate): Date; // = parseDateOnly(date)
export declare function fromDateColumn(value: Date): NairobiDate; // = formatDateOnly(value)
```

### 4.3 Shifts, clock facts and results

```ts
// file: _shared/time/time-types.ts
import type { ClockTime, NairobiDate } from './nairobi-time';

export interface ShiftWindow {
  date: NairobiDate;
  startTime: ClockTime;
  endTime: ClockTime; // must be later than startTime
  unpaidBreakMinutes: number; // from the shift template (rules, WEEK_AND_BREAKS, shows it read-only)
}

export type ClockEventType = 'IN' | 'OUT' | 'AUTO_OUT' | 'CORRECTION';

/** One row of the append-only clock_events table, reduced to what the maths needs. */
export interface ClockEventFact {
  id: string;
  type: ClockEventType;
  occurredAt: Date; // the moment that counts (server-trusted)
  correctsEventId: string | null; // set on CORRECTION
  voidsCorrected: boolean; // CORRECTION that cancels the event it points at (undo)
}

/** An IN matched to its OUT. clockOut is null while the person is still on shift. */
export interface ClockPair {
  clockIn: Date;
  clockOut: Date | null;
  closedBy: 'OUT' | 'AUTO_OUT' | null;
}

export type DayStatus = 'NO_CLOCK' | 'OPEN' | 'CLOSED' | 'AUTO_CLOSED';

export interface LatenessResult {
  minutesLate: number; // raw, floored, never negative: 06:05 against 06:00 is 5
  countsAsLate: boolean; // minutesLate is more than the grace period
  minutesAfterGrace: number; // minutesLate minus grace when it counts as late, else 0
  earlyMinutes: number; // arrived before the start (not paid, not overtime)
}

export interface DayHours {
  shiftDate: NairobiDate;
  status: DayStatus;
  scheduledMinutes: number; // end minus start minus the unpaid break
  firstClockIn: Date | null;
  lastClockOut: Date | null;
  workedMinutes: number; // inside the scheduled window, break taken off, then rounded; never above scheduledMinutes
  breakMinutes: number; // the unpaid break actually taken off
  leftEarlyMinutes: number; // closed before the scheduled end
  afterEndMinutes: number; // time after the scheduled end: the raw overtime candidate
  lateness: LatenessResult | null; // null when there was no clock-in
}
```

### 4.4 Lateness, hours worked, overtime, totals, periods

```ts
// file: _shared/time/lateness.ts
import type { LatenessRules } from '../../rules/rules-schemas';
import type { LatenessResult, ShiftWindow } from './time-types';

/** Throws OvernightShiftError when end is not later than start. */
export declare function assertNoOvernight(shift: ShiftWindow): void;
export declare function shiftInstants(shift: ShiftWindow): { start: Date; end: Date };

/**
 * Rule: minutesLate = floor((clockIn - start) / 1 minute), never below 0. It counts as late only when minutesLate is
 * MORE than lateness.graceMinutes (grace 5: 5 minutes late is recorded as 5 but does not count; 6 counts, with 1 minute
 * after grace). Feeds on: lateness.graceMinutes.
 */
export declare function computeLateness(shift: ShiftWindow, clockInAt: Date, rules: Pick<LatenessRules, 'graceMinutes'>): LatenessResult;
```

```ts
// file: _shared/time/day-hours.ts
import type { AttendanceRules, LatenessRules } from '../../rules/rules-schemas';
import type { ClockEventFact, ClockPair, DayHours, ShiftWindow } from './time-types';

/**
 * Rule: replay the append-only events into IN/OUT pairs. A CORRECTION with voidsCorrected cancels the event it points
 * at (undo). A CORRECTION without it replaces that event's time. The latest correction of an event wins. Events that
 * are not matched (an OUT with no IN) are ignored and returned in `unmatched` for the timesheet to show.
 * Duplicate event ids collapse to one.
 */
export declare function resolveClockPairs(events: readonly ClockEventFact[]): { pairs: ClockPair[]; unmatched: ClockEventFact[] };

/**
 * Rule: time counts inside [scheduled start, scheduled end] only; the unpaid break is taken off once, never more than
 * the time worked; the result is rounded to attendance.roundingMinutes by attendance.roundingMode (0 = none) and never
 * exceeds scheduledMinutes. Several IN/OUT pairs in one shift add up; gaps between them are not worked. An open pair
 * counts up to `now` and the day is marked OPEN (callers must not pay an OPEN day). A pair closed by AUTO_OUT marks the
 * day AUTO_CLOSED. Time after the scheduled end is reported in afterEndMinutes, not in workedMinutes.
 * Feeds on: attendance.roundingMinutes, attendance.roundingMode, lateness.graceMinutes, the shift's unpaidBreakMinutes.
 */
export declare function computeDayHours(
  shift: ShiftWindow,
  pairs: readonly ClockPair[],
  now: Date,
  rules: { attendance: Pick<AttendanceRules, 'roundingMinutes' | 'roundingMode'>; lateness: Pick<LatenessRules, 'graceMinutes'> },
): DayHours;
```

```ts
// file: _shared/time/overtime.ts
import type { LatenessRules, OvertimeRules } from '../../rules/rules-schemas';
import type { IsoWeekday, NairobiDate } from './nairobi-time';
import type { DayHours, ShiftWindow } from './time-types';

export interface OvertimeEvidence {
  /** The system could see open orders or tickets at the scheduled end (shift-end snapshot). No open work: no tail. */
  openWorkAtShiftEnd: boolean;
  /** The manager extended the shift in advance (pre-approval). */
  preApprovedUntil: Date | null;
}

export interface OvertimeCandidate {
  shiftDate: NairobiDate;
  rawMinutes: number; // afterEndMinutes minus any minutes used to make up lateness
  serviceTailMinutes: number; // recognised automatically (only with open work)
  preApprovedMinutes: number; // covered by an advance extension
  autoRecognisedMinutes: number; // max(serviceTail, preApproved); the two cover the same minutes, they do not add
  needsApprovalMinutes: number; // rawMinutes minus autoRecognised: a manager decides these
  basis: 'NONE' | 'SERVICE_TAIL' | 'PRE_APPROVED';
}

/**
 * Minutes after the end that a lateness policy "make up the time the same day" consumes:
 * min(minutesAfterGrace, afterEndMinutes) when lateness.makeUpSameDay is on, else 0. These minutes are not overtime.
 * Feeds on: lateness.makeUpSameDay.
 */
export declare function makeUpMinutes(day: DayHours, rules: Pick<LatenessRules, 'makeUpSameDay'>): number;

/**
 * Rule (proposal 5.5, decision D10): null unless the day is CLOSED or AUTO_CLOSED and rawMinutes > 0.
 * serviceTail = min(raw, overtime.serviceTailMinutes) only when evidence.openWorkAtShiftEnd. preApproved = minutes
 * between the scheduled end and preApprovedUntil, between 0 and raw. Order value is never an input.
 * Feeds on: overtime.serviceTailMinutes.
 */
export declare function overtimeCandidate(
  day: DayHours,
  shift: ShiftWindow,
  evidence: OvertimeEvidence,
  madeUpMinutes: number,
  rules: Pick<OvertimeRules, 'serviceTailMinutes'>,
): OvertimeCandidate | null;

export interface WeeklyOvertime {
  weekStart: NairobiDate;
  candidateMinutes: number; // sum of rawMinutes in the week
  capMinutes: number | null;
  overCapMinutes: number; // max(0, candidate - cap); never auto-recognised, always goes to a manager
}

/** Groups by the week containing shiftDate. Feeds on: overtime.weeklyCapMinutes, week.weekStartsOn. */
export declare function weeklyOvertime(
  candidates: readonly OvertimeCandidate[],
  weekStartsOn: IsoWeekday,
  rules: Pick<OvertimeRules, 'weeklyCapMinutes'>,
): WeeklyOvertime[];
```

```ts
// file: _shared/time/totals.ts
import type { LatenessRules } from '../../rules/rules-schemas';
import type { IsoWeekday, NairobiDate } from './nairobi-time';
import type { DayHours } from './time-types';
import type { Period } from './periods';

export interface WeekTotal {
  weekStart: NairobiDate;
  weekEnd: NairobiDate;
  partial: boolean; // the week is cut by a period boundary
  scheduledMinutes: number;
  workedMinutes: number;
  afterEndMinutes: number;
  lateDays: number;
  absentDays: number; // NO_CLOCK days
}

export interface PeriodTotal {
  period: Period;
  scheduledMinutes: number;
  workedMinutes: number;
  afterEndMinutes: number;
  lateDays: number;
  absentDays: number;
  weeks: WeekTotal[];
}

/**
 * Rule: weeks start on the rule's weekStartsOn (Monday by default). Only CLOSED and AUTO_CLOSED days add worked and
 * afterEnd minutes (OPEN days are skipped); NO_CLOCK days add scheduled minutes and one absent day (a manager decides
 * whether it is excused; the engine never deducts for it). A late day is one whose lateness.countsAsLate is true.
 * Feeds on: week.weekStartsOn.
 */
export declare function weeklyTotals(days: readonly DayHours[], weekStartsOn: IsoWeekday): WeekTotal[];

/** Weeks are cut at the period's start and end. Feeds on: week.weekStartsOn, week.timesheetPeriod. */
export declare function periodTotals(days: readonly DayHours[], period: Period, weekStartsOn: IsoWeekday): PeriodTotal;

export interface LateDay {
  shiftDate: NairobiDate;
  countsAsLate: boolean;
  minutesAfterGrace: number;
  excused: boolean;
  madeUpMinutes: number;
}
export interface DeductibleLateness {
  shiftDate: NairobiDate;
  chargeableMinutes: number; // minutes payroll may turn into money (slice 6); the engine does no money
}

/**
 * Rule (proposal 5.6, decision D11). A day is chargeable only when it counts as late, is not excused, and still has
 * minutes after grace once made-up minutes are taken off. Then by policy:
 *   RECORD_ONLY: nothing is chargeable.
 *   FROM_FIRST_MINUTE: every chargeable day is charged its minutes after grace.
 *   AFTER_N_LATES: within each Nairobi calendar month, the first `afterLatesPerMonth` chargeable days are free; later ones are charged.
 * Missing a whole shift is never deducted here (only a manager's "unexcused" mark does that, in slice 4).
 * Feeds on: lateness.policy, lateness.afterLatesPerMonth.
 */
export declare function deductibleLateness(days: readonly LateDay[], rules: Pick<LatenessRules, 'policy' | 'afterLatesPerMonth'>): DeductibleLateness[];
```

```ts
// file: _shared/time/periods.ts
import type { WeekAndBreaksRules } from '../../rules/rules-schemas';
import type { NairobiDate } from './nairobi-time';

export type PeriodRule = WeekAndBreaksRules['timesheetPeriod'];

export interface Period {
  start: NairobiDate;
  end: NairobiDate; // inclusive
  label: string; // '21 Sep to 18 Oct 2026' or 'October 2026'
}

/**
 * Rule: FIXED_WEEKS cuts the calendar into blocks of `weeks` weeks counted from `anchorDate` (the anchor is itself a
 * week start; the rule schema enforces that it falls on weekStartsOn), forwards and backwards. CALENDAR_MONTH is the
 * first to the last day of the month. Example only: Mon 21 Sep 2026, 4 weeks gives 21 Sep to 18 Oct, then 19 Oct to 15 Nov.
 * Feeds on: week.timesheetPeriod.
 */
export declare function periodContaining(date: NairobiDate, rule: PeriodRule): Period;
export declare function periodsBetween(from: NairobiDate, to: NairobiDate, rule: PeriodRule): Period[];
export declare function isInPeriod(date: NairobiDate, period: Period): boolean;
```

### 4.5 Which rule setting feeds which function

| Function | Reads (group.field, defined in section 6) |
|---|---|
| `computeLateness` | `lateness.graceMinutes` |
| `computeDayHours` | `attendance.roundingMinutes`, `attendance.roundingMode`, `lateness.graceMinutes` |
| `makeUpMinutes` | `lateness.makeUpSameDay` |
| `overtimeCandidate` | `overtime.serviceTailMinutes` |
| `weeklyOvertime` | `overtime.weeklyCapMinutes`, `week_and_breaks.weekStartsOn` |
| `deductibleLateness` | `lateness.policy`, `lateness.afterLatesPerMonth` |
| `weeklyTotals`, `periodTotals` | `week_and_breaks.weekStartsOn` |
| `periodContaining`, `periodsBetween` | `week_and_breaks.timesheetPeriod` |

Settings that are **not** the engine's job (later slices read them): `overtime.approvalWindowHours`, `overtime.branchBudgetMinutesPerPeriod`, the multipliers, `lateness.excuseWindowHours`, `lateness.deductionCapPercentOfPay`, all `attendance.*` clock behaviour (slice 3), pay maths (slice 6).

### 4.6 Test matrix (Session 2 writes these first)

Every file below runs **three times**: `TZ=UTC`, `TZ=Africa/Nairobi`, `TZ=America/Los_Angeles` (a zone with daylight saving). Node reads `TZ` at start, so each run is a separate process; a `pnpm test:workforce-tz` script runs the folder three times. Expected values are written into the tests, never computed from the machine's clock. Fixed instants only.

| Area | Cases |
|---|---|
| Nairobi date and clock | `2026-10-05T20:59:59Z` is 5 Oct and `21:00:00Z` is 6 Oct 00:00; the same 06:00 Nairobi shift is `2026-10-06T03:00:00Z`; round trip `instantAt` then `nairobiClockOf`; the LA daylight-saving changes (`2026-03-08`, `2026-11-01`) change nothing; year end (`2026-12-31T21:00Z`), leap day 2028-02-29; invalid inputs rejected (`2026-02-30`, `24:00`, `6:00`, `2026-1-5`) |
| Week and Monday start | Sunday belongs to the week that began the previous Monday; Monday is its own week start; `weekStartsOn` 7 (Sunday) also works; week across a month and a year boundary; `isoWeekday` of 3 known dates |
| **06:00 shift, 06:05 clock-in** | Clock-in `2026-10-06T03:05:00Z` gives `minutesLate = 5`, on all three server zones (the production bug gave -175 on UTC). Grace 5: `countsAsLate` false. Grace 4: counts, `minutesAfterGrace` 1. Grace 0: counts, 5 |
| Lateness edges | 06:00:59 is 0 late (floor); 05:45 gives `earlyMinutes` 15 and 0 late; clock-in after the shift end is computed, not crashed; a 14:00 afternoon shift; a 22:00 to 23:59 shift |
| No overnight | `assertNoOvernight` throws for 18:00 to 02:00, for equal start and end, and for end `00:00`; accepts 22:00 to 23:59; a stay-on clock-out at `00:40` Nairobi next day on a 22:00 to 23:59 shift is attributed to the shift's date with `afterEndMinutes` 41 |
| Clock replay | IN then OUT; OUT undo (void) leaves the shift open with no gap; a corrected IN time replaces the old; a later correction beats an earlier one; an orphan OUT lands in `unmatched`; a duplicate event id counts once; two segments in one shift |
| Hours worked | Normal day with a 30-minute break; early arrival not counted; stay-on goes to `afterEndMinutes` not `workedMinutes`; left early; a break longer than the time worked takes only what was worked; rounding NEAREST, DOWN, UP at 5 and 15, never above scheduled; OPEN uses `now`; AUTO_CLOSED flagged; NO_CLOCK has zero worked and lateness null |
| Weekly and period totals | A week of five days; absent days; OPEN days skipped; a week cut by a period boundary is `partial`; two shifts in a day; 4-week anchor Mon 21 Sep 2026 gives 21 Sep to 18 Oct then 19 Oct to 15 Nov; dates before the anchor; `CALENDAR_MONTH` for February in a leap year; `periodsBetween` across 3 periods |
| Overtime candidates | Open work and 20 minutes after the end with tail 15: 15 auto, 5 need approval; no open work: 0 auto, 20 need approval; pre-approved until 30 minutes: covers 20, basis PRE_APPROVED; tail and pre-approval overlap (max, not sum); make-up consumes minutes first; OPEN day gives null; weekly cap flags `overCapMinutes`; cap null flags nothing |
| Lateness policy | RECORD_ONLY charges 0; FROM_FIRST_MINUTE charges minutes after grace; AFTER_N_LATES with N=3: the 4th late in a calendar month is charged and the count restarts next month; excused days are free; a made-up day is free and does not count toward N |
| Static | The folder contains none of the forbidden calls (4.1 rule 3); every function takes `now` as a parameter (no `new Date()` with no argument) |

### 4.7 How it fits `utils/date-only.ts` and the jobs

- `utils/date-only.ts` **stays as it is** and keeps its meaning: `NAIROBI_TZ`, `parseDateOnly`, `formatDateOnly`, `getTodayDateOnly`, `getTodayNairobiRangeUtc`, `formatNairobiTime`, `formatNairobiDate`. The engine's `toDateColumn` and `fromDateColumn` call `parseDateOnly` and `formatDateOnly`, so the `@db.Date` convention is the one the rest of the app uses. A test asserts `toDateColumn(nairobiToday(now))` equals `getTodayDateOnly()` at a frozen instant in all three zones, so the two cannot drift.
- `formatNairobiTime` and `formatNairobiDate` remain the display helpers for user-facing text. The engine returns values; screens and documents format them.
- The jobs (`shift-reminder.ts`, `daily-report.ts`, `stale-clock-out.ts`, and others) use `Africa/Nairobi` correctly through the cron `tz` option or their own `Intl` formatter. **Slice 0 leaves them alone.** Slice 3 moves `shift-reminder` and `stale-clock-out` onto the engine helpers when it replaces the clock service.
- The leave working-days count (`hr-service.ts` `calculateWorkingDays`, uses `getDay()` on server time) is slice 5; it becomes a Nairobi calendar-day count through `eachDay` (leave counts every calendar day, owner decision 5 Oct 2026).

---

## 5. Audit writer

**Purpose:** every change to hours, leave, pay, rules, roles, departments and heads leaves a dated entry (who, what, before, after, why) **in the same database transaction as the change**, so a change cannot happen without a trace and a failed change leaves none. Entries are append-only and tamper-evident. Slice 0 builds the writer, the table, the chain and the visibility rule; the screens and the read endpoints are slice 7.

### 5.1 Entry shape

The table is `AuditEntry` (section 2.3). In code:

```ts
// file: _shared/audit/audit.types.ts   (appended to the constants block in section 3.2; one file)
export const AUDIT_RETENTION_YEARS = 7;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Best-effort facts about where a request came from. Never a raw IP address. Never blocks a write. */
export interface AuditContext {
  deviceLabel: string | null; // 'Android, Chrome'
  placeLabel: string | null; // 'Nyeri'
}

export interface AuditActor {
  id: string | null; // null only for channel SYSTEM (a job)
  role: string; // UserRole at that moment, or 'SYSTEM'
  name: string; // snapshot
}

export interface AuditEntryInput {
  companyId: string;
  siteId: string | null; // null = company-wide
  actor: AuditActor;
  channel?: 'APP' | 'SYSTEM' | 'ASSISTANT'; // default APP; ASSISTANT marks "via assistant" (roadmap)
  action: string; // must be registered in AUDIT_ACTIONS
  category: AuditCategoryCode; // must be one the action allows
  subjectType: string;
  subjectId: string;
  subjectUserId?: string | null; // the person it is about; drives "Activity on my record"
  before?: JsonValue | null;
  after?: JsonValue | null; // never amounts for payslip opens; never a PIN or password
  reason?: string | null;
  context?: AuditContext;
}

export interface AuditEntryRecord {
  id: string;
  companyId: string;
  siteId: string | null;
  seq: bigint;
  occurredAt: Date;
  action: string;
  category: AuditCategoryCode;
  subjectType: string;
  subjectId: string;
  actorId: string | null;
  actorRole: string;
  actorName: string;
  channel: 'APP' | 'SYSTEM' | 'ASSISTANT';
  subjectUserId: string | null;
  before: JsonValue | null;
  after: JsonValue | null;
  reason: string | null;
  deviceLabel: string | null;
  placeLabel: string | null;
  prevHash: string;
  hash: string;
}
```

```ts
// file: _shared/audit/audit-actions.ts
import type { AuditCategoryCode } from './audit.types';

/**
 * Every action code and the categories it may be filed under. The writer refuses a code that is not here, or a
 * category the code does not allow, so an entry cannot be filed where the wrong roles can read it. Each slice adds
 * its own codes in the same commit as the behaviour. Slice 0 registers these three.
 */
export const AUDIT_ACTIONS = {
  'rules.version_created': ['RULES_OPERATING', 'RULES_PAY'], // PAY when the change touches statutory, multipliers or holiday pay
  'rules.version_confirmed': ['RULES_PAY'],
  'audit.log_viewed': ['LOG_ACCESS'], // written by the slice-7 read side; declared now so the visibility rule is complete
} as const satisfies Record<string, readonly AuditCategoryCode[]>;

export type AuditActionCode = keyof typeof AUDIT_ACTIONS;
```

### 5.2 The writer, inside the caller's transaction

```ts
// file: _shared/audit/audit-writer.ts
import type { Prisma } from '@prisma/client';
import type { WorkforceEvent } from '../events';
import type { AuditEntryInput, AuditEntryRecord } from './audit.types';

/**
 * Primitive. Appends one entry to the company's chain using the caller's transaction client. It must be the LAST write
 * of the transaction, because it takes a row lock on the company's chain head until the transaction ends.
 * Throws ValidationError for an unregistered action or a category the action does not allow.
 * It cannot be called without a transaction client: there is no overload that opens its own.
 */
export declare function writeAuditEntry(tx: Prisma.TransactionClient, input: AuditEntryInput): Promise<AuditEntryRecord>;

export interface AuditedChange<T> {
  result: T;
  entries: AuditEntryInput[]; // usually one; one entry per bulk action, never one per row
  events?: WorkforceEvent[]; // emitted only after the transaction has committed
}

/**
 * The normal way to change something. Opens the transaction, runs the change, writes every entry, commits, then
 * emits the events. If `change` throws, nothing is written (no change, no entry, no event). If writing an entry
 * fails, the change rolls back with it.
 */
export declare function runAudited<T>(change: (tx: Prisma.TransactionClient) => Promise<AuditedChange<T>>): Promise<T>;
```

Layering (Non-Negotiables 4 and 5): `runAudited` is the service-layer helper and may call `prisma.$transaction` (allowed in a service). **All SQL lives in `audit-repository.ts`**: `lockChainHead(tx, companyId)` and `insertEntry(tx, row)`. Nothing else in the module imports Prisma.

Order of work inside `writeAuditEntry`:
1. `INSERT ... ON CONFLICT DO NOTHING` the company's head row (first ever entry only).
2. `SELECT last_seq, last_hash ... FOR UPDATE` on that row (the lock).
3. `seq = last_seq + 1`; `prevHash = last_hash`; `hash = sha256(canonical(entry fields, seq, prevHash))`.
4. `INSERT` the entry; `UPDATE` the head to the new `seq` and `hash`.

Canonical form for hashing: UTF-8 JSON, keys sorted, `occurredAt` as ISO with milliseconds, `seq` as a decimal string, absent values as `null`. `GENESIS_HASH` is 64 zeros.

**Bulk actions:** "Approve all clean days (87)" writes **one** entry (`subjectType` names the batch; the ids are in `after`, capped at 500 with a count above that). Days the system approves by itself are not human decisions and write no entry. Clock events are not audited here: `clock_events` is its own append-only table with the same trigger.

### 5.3 Append-only and tamper-evident: recommendation

Two layers, both in the slice-0 migration:

1. **Refuse change (database trigger).** `BEFORE UPDATE OR DELETE` on `workforce_audit_entries` raises `restrict_violation`; `BEFORE TRUNCATE` does too. Same pattern as the stock ledger's `inventory_transactions_append_only`, **without** its seed-script escape hatch: nothing seeds audit rows, and a hatch is a hole. `workforce_audit_chain_heads` may be updated only to `last_seq = old + 1`, and never deleted. Prisma does not model triggers, so there is no schema drift.
2. **Detect change (hash chain).** Each entry stores the hash of the one before it. Editing a row, removing a row, or inserting one breaks the chain at that `seq`. `verifyAuditChain(entries)` is a pure function slice 0 ships and tests; the nightly job that runs it over new entries and records a checkpoint is slice 7.

```ts
// file: _shared/audit/audit-hash.ts
import type { AuditEntryRecord } from './audit.types';

export declare const GENESIS_HASH: string; // 64 zeros
export declare function canonicalEntryJson(entry: Omit<AuditEntryRecord, 'id' | 'hash'>): string;
export declare function hashEntry(entry: Omit<AuditEntryRecord, 'id' | 'hash'>): string;

export type ChainVerdict =
  | { ok: true; checked: number; lastSeq: bigint; lastHash: string }
  | { ok: false; atSeq: bigint; problem: 'HASH_MISMATCH' | 'PREV_HASH_MISMATCH' | 'GAP' | 'DUPLICATE_SEQ' };

/** Entries must be in seq order for one company. `start` is the previous entry's seq and hash when checking a slice of the chain. */
export declare function verifyAuditChain(
  entries: readonly AuditEntryRecord[],
  start?: { seq: bigint; hash: string },
): ChainVerdict;
```

**Cost note (my estimates, not measured).** Per audited write: one extra row lock and about three small queries, a few milliseconds. The lock **serialises audited writes within one company** while a transaction is open; with the writer called last and one entry per bulk action, a transaction holds it for milliseconds, which is far below Wendo's rate of human changes (tens a minute at 10 branches). Storage is about 1 to 2 KB per entry; at a guessed 500 entries a day that is roughly 2 GB over the 7-year retention. Hashing is microseconds. Verification is a linear scan of new entries only.

**What it does not stop:** someone with database superuser rights could rewrite the table and recompute the whole chain. Mitigation for slice 7 (recommended): write the day's last `seq` and `hash` to the application log (shipped off the server) and have the Director's monthly digest show it; a rewritten chain then disagrees with the copy kept elsewhere.

**Rejected:** per-row HMAC (cannot see a deleted row), a separate append-only store (more to run for no gain at this size), trigger only (no way to notice a bypass).

### 5.4 Retention

- Entries are kept **7 years**, then archived (owner decision, 5 Oct 2026). The constant `AUDIT_RETENTION_YEARS = 7` lives in `audit.types.ts`.
- **Slice 0 deletes nothing**, and no code path may. The archive mechanism is slice 7: a privileged job that writes an archive manifest (company, seq range, final hash, file reference) as its own audit entry, then removes the archived rows. It will need a documented exception to the trigger (a database-role or session-setting switch that only that job can use, with a test that application code never sets it); the design is settled in slice 7, not here.
- `SignedDocument.archivedAt` (section 2.4) follows the same 7 years for the QR check ("archived" afterwards).

### 5.5 The read side that slice 7 will build (declared now so visibility is one rule)

Reading is **role-limited by category**: a person may read a row only if they hold `audit.read.<category>` (and the scope allows), or `audit.read_own` for rows where they are the `subjectUserId`. Slice 0 ships the pure function and its tests; slice 7 ships the endpoints and the screens.

```ts
// file: _shared/audit/audit-read.ts
import type { Scope } from '../workforce-access';
import type { AccessSubject } from '../workforce-access';
import type { AuditCategoryCode, AuditEntryRecord } from './audit.types';

export interface AuditReadScope {
  categories: AuditCategoryCode[]; // what this person may read company-log style; empty = none
  scope: Scope; // 'all' or 'unit' (unit: only rows whose siteId is the person's own)
  siteId: string | null; // set when scope is 'unit'
  ownRecord: boolean; // may read "Activity on my record"
}

/**
 * Pure. From the access table only. A department head and ordinary staff get an empty category list and
 * ownRecord true. The Director gets every category, including LOG_ACCESS. Nobody else sees LOG_ACCESS
 * ("who looked at the log" is not read by the people being watched).
 * "Activity on my record" never includes LOG_ACCESS rows.
 */
export declare function auditReadScopeOf(subject: AccessSubject): AuditReadScope;

export interface AuditQuery {
  from?: Date;
  to?: Date;
  category?: AuditCategoryCode;
  actorId?: string;
  subjectUserId?: string;
  limit: number;
  before?: bigint; // keyset paging by seq, newest first
}

export interface AuditPage {
  entries: AuditEntryRecord[];
  nextBefore: bigint | null;
}

/** Slice 7 implements. Every call that returns rows to a non-"own" reader also writes an `audit.log_viewed` entry. */
export interface AuditReader {
  list(subject: AccessSubject, query: AuditQuery): Promise<AuditPage>;
  activityOnMyRecord(subject: AccessSubject, query: AuditQuery): Promise<AuditPage>;
}
```

### 5.6 How it relates to Inventory's audit-log and the future shared sink

- **Inventory's `audit-log`** is a read-only merge of Inventory's own history tables (item changes, supplier audit rows, restock changes). **Workforce does not import or change it.** What we copy is the pattern (plain-words sentence builder in a `describe` file, role-gated list, no edit or delete), not the code. Slice 7 will write the Workforce sentence builder.
- **Shared audit sink** (roadmap: Notifications and Audit platform). Until it exists, `workforce_audit_entries` is the local table "with the same shape" the proposal (3.4) promised. `AuditEntryInput` carries nothing Workforce-specific except `category`. When the sink lands, `writeAuditEntry` becomes a thin adapter that still runs in the caller's transaction, and existing rows import with their `seq` and `hash` kept as one source chain. Events from Access (sign-ins, failed sign-ins, password and PIN changes, sessions) are not written by slice 0; they need the Access lane's agreement and are tracked for slice 7.

---

## 6. Rules store

Settings are **data, not constants**: versioned, effective-dated, company default plus site override. Slice 0 contracts the schemas, the service functions and **two read endpoints**. The Rules screens and the write endpoints are slice 4 (they call the service functions below).

### 6.1 The ten groups (Zod)

Every number below is an **example default** (marked in 6.3), not a legal or policy value. Money is a decimal **string**, never a float. A multiplier is a decimal string. Dates are Nairobi dates `YYYY-MM-DD`. `null` means "not set".

```ts
// file: rules/rules-schemas.ts
import { z } from 'zod';
import { isoWeekday, parseNairobiDate } from '../_shared/time/nairobi-time';

const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use digits with up to 2 decimals');
const factor = z.string().regex(/^\d{1,2}(\.\d{1,4})?$/, 'Use digits with up to 4 decimals');
const minutes = (max: number) => z.number().int().min(0).max(max);
const nairobiDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  try {
    parseNairobiDate(v);
    return true;
  } catch {
    return false;
  }
}, 'Not a real date');

// 1. LATENESS (decision D11). Edited by the Director (any site) and a Branch Manager (own site, via a site override).
export const LatenessBase = z.object({
  graceMinutes: minutes(60),
  policy: z.enum(['RECORD_ONLY', 'AFTER_N_LATES', 'FROM_FIRST_MINUTE']),
  afterLatesPerMonth: z.number().int().min(1).max(31).nullable(), // required when policy is AFTER_N_LATES
  makeUpSameDay: z.boolean(),
  excuseWindowHours: minutes(720),
  deductionCapPercentOfPay: z.number().min(0).max(100).nullable(), // the legal limit is for the Accountant and the lawyer
});
const afterNNeedsCount = (v: { policy: string; afterLatesPerMonth: number | null }) => v.policy !== 'AFTER_N_LATES' || v.afterLatesPerMonth !== null;
export const LatenessRulesSchema = LatenessBase.refine(afterNNeedsCount, { message: 'Say after how many lates', path: ['afterLatesPerMonth'] });
export const LatenessSiteSchema = LatenessBase.pick({ graceMinutes: true, policy: true, afterLatesPerMonth: true, makeUpSameDay: true, excuseWindowHours: true }).refine(
  afterNNeedsCount,
  { message: 'Say after how many lates', path: ['afterLatesPerMonth'] },
);

// 2. OVERTIME (decision D10). Multipliers are confirmed by the Accountant.
export const OvertimeBase = z.object({
  serviceTailMinutes: minutes(120),
  weeklyCapMinutes: z.number().int().min(0).nullable(),
  branchBudgetMinutesPerPeriod: z.number().int().min(0).nullable(),
  approvalWindowHours: z.number().int().min(1).max(720),
  multipliers: z.object({ standard: factor.nullable() }), // more tiers are added here later, additively
});
export const OvertimeRulesSchema = OvertimeBase;
export const OvertimeSiteSchema = OvertimeBase.pick({ serviceTailMinutes: true, weeklyCapMinutes: true, branchBudgetMinutesPerPeriod: true, approvalWindowHours: true });

// 3. ATTENDANCE. Director only.
export const AttendanceRulesSchema = z.object({
  clockInOpensMinutesBefore: minutes(240),
  autoCloseAfterMinutes: z.number().int().min(1).max(240), // no answer to the shift-end prompt: closes at the scheduled end
  locationRadiusMetres: z.number().int().min(10).max(5000).nullable(), // null: keep using env CLOCK_GEOFENCE_RADIUS_METRES until slice 3
  undoWindowSeconds: minutes(600),
  clockSkewFlagMinutes: z.number().int().min(1).max(120), // device and server time further apart than this is flagged, never trusted
  shiftEndHeadsUpMinutes: minutes(60),
  shiftEndPromptRepeatMinutes: z.number().int().min(1).max(30),
  roundingMinutes: z.union([z.literal(0), z.literal(1), z.literal(5), z.literal(10), z.literal(15), z.literal(30)]), // 0 = no rounding
  roundingMode: z.enum(['NEAREST', 'DOWN', 'UP']),
});

// 4. LEAVE. HR sets the types and the default policy; a Branch Manager (own site) or the Director sets minimum cover.
const leaveType = z.object({
  code: z.string().regex(/^[A-Z][A-Z_]{1,23}$/),
  label: z.string().min(1).max(60),
  daysPerYear: z.number().min(0).max(366).nullable(),
  paid: z.boolean(),
  requiresReason: z.boolean(),
});
export const LeaveBase = z.object({
  leaveTypes: z.array(leaveType).min(1),
  defaultPolicy: z.record(z.string(), z.number().min(0).max(366)), // leave type code to days, used until a contract is assigned
  minimumCover: z.record(z.string(), z.number().int().min(0)), // department id to the fewest people on at once; only ever a warning
});
const leaveConsistent = (v: z.infer<typeof LeaveBase>) =>
  new Set(v.leaveTypes.map((t) => t.code)).size === v.leaveTypes.length && Object.keys(v.defaultPolicy).every((code) => v.leaveTypes.some((t) => t.code === code));
export const LeaveRulesSchema = LeaveBase.refine(leaveConsistent, { message: 'Leave types must be unique and the default policy must use them' });
export const LeaveSiteSchema = LeaveBase.pick({ minimumCover: true });

// 5. PROBATION. Director only.
export const ProbationRulesSchema = z.object({
  defaultMonths: z.number().int().min(0).max(12),
  maxExtensions: z.number().int().min(0).max(3),
  maxExtensionMonths: z.number().int().min(0).max(12),
});

// 6. CASUAL_WORK. Director only (question 8).
export const CasualWorkRulesSchema = z.object({
  defaultDailyRate: money.nullable(),
  rates: z.array(z.object({ positionId: z.string().min(1), dailyRate: money })),
  pettyCashHolder: z.discriminatedUnion('mode', [z.object({ mode: z.literal('BRANCH_MANAGER') }), z.object({ mode: z.literal('NAMED'), userId: z.string().min(1) })]),
  latenessReducesPayout: z.literal(true), // fixed by decision (proposal 2.6); shown, not editable
});

// 7. CONDUCT. The ladder's order is fixed in code; names, durations and letters are set here by the Director; HR reads.
const conductLevel = z.object({
  level: z.enum(['VERBAL_NOTE', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING']),
  label: z.string().min(1).max(60),
  validForMonths: z.number().int().min(1).max(60),
  requiresLetter: z.boolean(),
  issuableBy: z.array(z.enum(['UNIT_MANAGER', 'HR', 'DIRECTOR'])).min(1), // policy value; routes still need discipline.issue
});
export const ConductRulesSchema = z
  .object({
    levels: z.array(conductLevel).length(3),
    acknowledgeWithinDays: z.number().int().min(1).max(30),
    appealWithinDays: z.number().int().min(1).max(60),
  })
  .refine((v) => v.levels.map((l) => l.level).join() === 'VERBAL_NOTE,WRITTEN_WARNING,FINAL_WRITTEN_WARNING', { message: 'The ladder order is fixed', path: ['levels'] });

// 8. STATUTORY. Accountant only. Ships EMPTY: no rates are invented.
const band = z.object({ fromAmount: money, toAmount: money.nullable(), ratePercent: z.string().regex(/^\d{1,3}(\.\d{1,4})?$/).nullable(), flatAmount: money.nullable() });
export const StatutoryRulesSchema = z.object({
  tables: z.array(
    z.object({
      code: z.enum(['PAYE', 'NSSF', 'SHA', 'HOUSING_LEVY', 'RELIEF', 'OTHER']),
      name: z.string().min(1).max(80),
      bands: z.array(band),
      note: z.string().max(500).nullable(),
    }),
  ),
});

// 9. HOLIDAYS. Off by default (decision D5). HR edits; the Director confirms the list, the Accountant the pay rate.
export const HolidaysRulesSchema = z.object({
  enabled: z.boolean(),
  payMultiplier: factor.nullable(),
  holidays: z.array(z.object({ date: nairobiDate, name: z.string().min(1).max(80) })),
});

// 10. WEEK_AND_BREAKS. Director edits. The unpaid break is NOT here: it comes from each shift template (read-only on the screen).
const isoDay = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]);
export const WeekAndBreaksRulesSchema = z
  .object({
    weekStartsOn: isoDay,
    timesheetPeriod: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('FIXED_WEEKS'), weeks: z.number().int().min(1).max(8), anchorDate: nairobiDate }),
      z.object({ kind: z.literal('CALENDAR_MONTH') }),
    ]),
  })
  .refine(
    (v) => {
      if (v.timesheetPeriod.kind !== 'FIXED_WEEKS') return true;
      try {
        // An impossible date is reported by the field's own check; this one must not throw on it.
        return isoWeekday(parseNairobiDate(v.timesheetPeriod.anchorDate)) === v.weekStartsOn;
      } catch {
        return true;
      }
    },
    { message: 'The first period must start on the first day of the week', path: ['timesheetPeriod'] },
  );

export const RULE_SCHEMAS = {
  LATENESS: LatenessRulesSchema,
  OVERTIME: OvertimeRulesSchema,
  ATTENDANCE: AttendanceRulesSchema,
  LEAVE: LeaveRulesSchema,
  PROBATION: ProbationRulesSchema,
  CASUAL_WORK: CasualWorkRulesSchema,
  CONDUCT: ConductRulesSchema,
  STATUTORY: StatutoryRulesSchema,
  HOLIDAYS: HolidaysRulesSchema,
  WEEK_AND_BREAKS: WeekAndBreaksRulesSchema,
} as const;

/** What a site override of each group may contain: only the fields that group lets a site change. */
export const RULE_SITE_SCHEMAS = {
  LATENESS: LatenessSiteSchema,
  OVERTIME: OvertimeSiteSchema,
  LEAVE: LeaveSiteSchema,
} as const;

export type RuleGroupCode = keyof typeof RULE_SCHEMAS;
export type RuleValues = { [G in RuleGroupCode]: z.infer<(typeof RULE_SCHEMAS)[G]> };
export type LatenessRules = RuleValues['LATENESS'];
export type OvertimeRules = RuleValues['OVERTIME'];
export type AttendanceRules = RuleValues['ATTENDANCE'];
export type WeekAndBreaksRules = RuleValues['WEEK_AND_BREAKS'];
```

### 6.2 Who may edit which field, who must confirm, who is told

Edit rights are **per field**, as capabilities (never role lists). A field a site may override is marked `site`. A confirmation is a separate act by a second capability; a version is "confirmed" when every confirmation its changed fields require exists.

```ts
// file: rules/rules-field-policy.ts
import type { Capability } from '../_shared/workforce-access';
import type { RuleGroupCode, RuleValues } from './rules-schemas';

export interface FieldPolicy {
  edit: Capability;
  site: boolean; // may a site override carry this field
  confirm?: { scope: string; capability: Capability }; // scope is stored on RuleConfirmation
}

type Policy = { [G in RuleGroupCode]: Record<keyof RuleValues[G] & string, FieldPolicy> };

const groupEdit = (capability: Capability, keys: readonly string[], site = false): Record<string, FieldPolicy> =>
  Object.fromEntries(keys.map((k) => [k, { edit: capability, site }]));

export const RULE_FIELD_POLICY: Policy = {
  LATENESS: {
    graceMinutes: { edit: 'rules.edit.lateness', site: true },
    policy: { edit: 'rules.edit.lateness', site: true },
    afterLatesPerMonth: { edit: 'rules.edit.lateness', site: true },
    makeUpSameDay: { edit: 'rules.edit.lateness', site: true },
    excuseWindowHours: { edit: 'rules.edit.lateness', site: true },
    deductionCapPercentOfPay: { edit: 'rules.edit.lateness', site: false }, // company-wide, Director only in practice (unit holders cannot write company rows)
  },
  OVERTIME: {
    serviceTailMinutes: { edit: 'rules.edit.overtime', site: true },
    weeklyCapMinutes: { edit: 'rules.edit.overtime', site: true },
    branchBudgetMinutesPerPeriod: { edit: 'rules.edit.overtime', site: true },
    approvalWindowHours: { edit: 'rules.edit.overtime', site: true },
    multipliers: { edit: 'rules.edit.overtime', site: false, confirm: { scope: 'overtime.multipliers', capability: 'rules.confirm.pay_rates' } },
  },
  ATTENDANCE: groupEdit('rules.edit.attendance', [
    'clockInOpensMinutesBefore',
    'autoCloseAfterMinutes',
    'locationRadiusMetres',
    'undoWindowSeconds',
    'clockSkewFlagMinutes',
    'shiftEndHeadsUpMinutes',
    'shiftEndPromptRepeatMinutes',
    'roundingMinutes',
    'roundingMode',
  ]) as Policy['ATTENDANCE'],
  LEAVE: {
    leaveTypes: { edit: 'rules.edit.leave', site: false },
    defaultPolicy: { edit: 'rules.edit.leave', site: false },
    minimumCover: { edit: 'rules.edit.leave', site: true },
  },
  PROBATION: groupEdit('rules.edit.probation', ['defaultMonths', 'maxExtensions', 'maxExtensionMonths']) as Policy['PROBATION'],
  CASUAL_WORK: groupEdit('rules.edit.casual_work', ['defaultDailyRate', 'rates', 'pettyCashHolder', 'latenessReducesPayout']) as Policy['CASUAL_WORK'],
  CONDUCT: groupEdit('rules.edit.conduct', ['levels', 'acknowledgeWithinDays', 'appealWithinDays']) as Policy['CONDUCT'],
  STATUTORY: {
    tables: { edit: 'rules.edit.statutory', site: false, confirm: { scope: 'statutory', capability: 'rules.confirm.statutory' } },
  },
  HOLIDAYS: {
    enabled: { edit: 'rules.edit.holidays', site: false, confirm: { scope: 'holidays.dates', capability: 'rules.confirm.holiday_list' } },
    holidays: { edit: 'rules.edit.holidays', site: false, confirm: { scope: 'holidays.dates', capability: 'rules.confirm.holiday_list' } },
    payMultiplier: { edit: 'rules.edit.holidays', site: false, confirm: { scope: 'holidays.pay_rate', capability: 'rules.confirm.pay_rates' } },
  },
  WEEK_AND_BREAKS: groupEdit('rules.edit.week_breaks', ['weekStartsOn', 'timesheetPeriod']) as Policy['WEEK_AND_BREAKS'],
};

/** Who is told when a version is created (decision D11). The service resolves these to people; delivery is a later slice. */
export type RuleNoticeAudience = 'DIRECTOR' | 'BRANCH_MANAGER_OF_SITE' | 'ALL_BRANCH_MANAGERS' | 'ACCOUNTANT_TO_CONFIRM' | 'DIRECTOR_TO_CONFIRM';
```

Rules the service applies to the table above:

- **A site override** is created by `siteId` set. It may hold **only** the group's `site: true` fields (`RULE_SITE_SCHEMAS`); anything else is refused with `400 RULE_SITE_FIELD_NOT_OVERRIDABLE`. Only LATENESS, OVERTIME and LEAVE (minimum cover) have site schemas; other groups are company-wide (README open point "a site differing from a company rule" is therefore answered narrowly; question 11).
- **Scope of the editor.** A holder with scope `all` (Director, HR, Accountant, System Admin) may write a company default or any site override. A holder with scope `unit` (Branch Manager) may write only an override for **their own site** (`actor.siteId === siteId`) and never a company default.
- **Every changed field** must be one the editor's capabilities allow (`policy.edit`), else `403`. Unchanged fields are not checked, so HR can change leave types without owning the minimum-cover edit right.
- **Confirmations.** A changed field with `confirm` creates a **pending confirmation** the named capability must clear (`confirmVersion`). Unchanged confirm-fields keep their earlier confirmation: the new version copies it (note "carried forward from version N"). Confirmation never blocks the **non-pay** use of a version (lateness, attendance, hours): only payroll refuses an unconfirmed pay rate or empty/unconfirmed statutory table (slice 6, using `isPayConfirmed`).
- **Who is told** (service returns recipients; the `rules.version_created` event carries them; delivery and wording are slice 4):

| Edit by | Told |
|---|---|
| Director, company default | `ALL_BRANCH_MANAGERS` |
| Director, a site's override | `BRANCH_MANAGER_OF_SITE` |
| Branch Manager, own override | `DIRECTOR` |
| Anyone, a pay-rate field (multipliers, holiday pay rate) | plus `ACCOUNTANT_TO_CONFIRM` |
| Accountant, statutory | `DIRECTOR` (the Accountant edits and confirms, so no one else needs to confirm) |
| HR, holiday dates | plus `DIRECTOR_TO_CONFIRM` |

### 6.3 What editing creates, and the defaults

- **Editing never changes a row.** It inserts a **new `RuleVersion`** (next number for that company, site and group) with the **full new values** (or the site-overridable fields), an `effectiveFrom` date, and a mandatory `reason`. History is never edited. The audit entry (`rules.version_created`) carries before and after for the **changed fields only**, the version number, the effective date and the reason.
- **Effective date.** `effectiveFrom` must be **today (Nairobi) or later**, and **not earlier than the latest `effectiveFrom` already stored** for that company/site/group (`409 RULE_FUTURE_VERSION_EXISTS` names it). To correct a version that has not started, write a new version with the **same** date; on a tie the higher version number wins. Past deductions are never recomputed from a later version (timesheet lines store the version numbers they used, section 2.4).
- **No change, no version.** If no field differs from what is effective on that date: `409 RULE_NO_CHANGE`.
- **Code defaults serve until the first edit.** There are **no seeded rows**. When a group has no version, `getEffectiveRules` returns `RULE_DEFAULTS` as **version 0**, `isDefault: true`. The defaults are examples chosen to make the engine runnable, shown in the table; none is policy. The first edit by the Director creates version 1. This avoids storing invented numbers as if they were confirmed (question 3).

```ts
// file: rules/rules-defaults.ts
import type { RuleValues } from './rules-schemas';

/** EXAMPLES ONLY, so the engine can run before anyone sets a rule. None of these is a legal or policy value. */
export const RULE_DEFAULTS: RuleValues = {
  LATENESS: { graceMinutes: 5, policy: 'RECORD_ONLY', afterLatesPerMonth: null, makeUpSameDay: false, excuseWindowHours: 48, deductionCapPercentOfPay: null },
  OVERTIME: { serviceTailMinutes: 15, weeklyCapMinutes: null, branchBudgetMinutesPerPeriod: null, approvalWindowHours: 48, multipliers: { standard: null } },
  ATTENDANCE: {
    clockInOpensMinutesBefore: 30,
    autoCloseAfterMinutes: 15,
    locationRadiusMetres: null,
    undoWindowSeconds: 120,
    clockSkewFlagMinutes: 10,
    shiftEndHeadsUpMinutes: 10,
    shiftEndPromptRepeatMinutes: 2,
    roundingMinutes: 0,
    roundingMode: 'NEAREST',
  },
  LEAVE: {
    leaveTypes: [
      { code: 'ANNUAL', label: 'Annual leave', daysPerYear: null, paid: true, requiresReason: false },
      { code: 'SICK', label: 'Sick leave', daysPerYear: null, paid: true, requiresReason: false },
      { code: 'EMERGENCY', label: 'Emergency leave', daysPerYear: null, paid: true, requiresReason: true },
      { code: 'UNPAID', label: 'Unpaid leave', daysPerYear: null, paid: false, requiresReason: true },
    ],
    defaultPolicy: {},
    minimumCover: {},
  },
  PROBATION: { defaultMonths: 3, maxExtensions: 1, maxExtensionMonths: 3 },
  CASUAL_WORK: { defaultDailyRate: null, rates: [], pettyCashHolder: { mode: 'BRANCH_MANAGER' }, latenessReducesPayout: true },
  CONDUCT: {
    levels: [
      { level: 'VERBAL_NOTE', label: 'Verbal note', validForMonths: 3, requiresLetter: false, issuableBy: ['UNIT_MANAGER', 'HR'] },
      { level: 'WRITTEN_WARNING', label: 'Written warning', validForMonths: 6, requiresLetter: true, issuableBy: ['UNIT_MANAGER', 'HR'] },
      { level: 'FINAL_WRITTEN_WARNING', label: 'Final written warning', validForMonths: 12, requiresLetter: true, issuableBy: ['HR'] },
    ],
    acknowledgeWithinDays: 3,
    appealWithinDays: 7,
  },
  STATUTORY: { tables: [] }, // ships empty; the Accountant types and confirms before the first pay run
  HOLIDAYS: { enabled: false, payMultiplier: null, holidays: [] }, // off by default (decision D5)
  WEEK_AND_BREAKS: { weekStartsOn: 1, timesheetPeriod: { kind: 'FIXED_WEEKS', weeks: 4, anchorDate: '2026-09-21' } }, // Monday; the anchor is the owner's sample period (question 2)
};
```

### 6.4 Looking rules up

```ts
// file: rules/rules.types.ts
import type { NairobiDate } from '../_shared/time/nairobi-time';
import type { RuleGroupCode, RuleValues } from './rules-schemas';

export interface EffectiveRuleGroup<G extends RuleGroupCode = RuleGroupCode> {
  group: G;
  values: RuleValues[G]; // company values with the site override's fields laid over them
  isDefault: boolean; // no version exists for the company: RULE_DEFAULTS, version 0
  companyVersion: number; // 0 for defaults
  siteVersion: number | null; // the override that supplied any fields
  effectiveFrom: NairobiDate | null; // of the company version; null for defaults
  requiredConfirmations: string[]; // scopes this version needs (e.g. 'overtime.multipliers')
  missingConfirmations: string[]; // the ones nobody has confirmed yet
}

export type EffectiveRules = { [G in RuleGroupCode]: EffectiveRuleGroup<G> };

/** Who is told about a new version (6.2). The service resolves audiences to people; delivery is a later slice. */
export interface RuleChangeNotice {
  recipients: { userId: string; audience: string }[];
}

/** What payroll asks before using a pay field: required confirmations all present AND, for STATUTORY, at least one table. */
export interface PayReadiness {
  ready: boolean;
  reasons: string[]; // plain words, e.g. 'Statutory tables are empty'
}
```

```ts
// file: rules/rules-service.ts   (signatures; Session 2 implements)
import type { AccessSubject } from '../_shared/workforce-access';
import type { NairobiDate } from '../_shared/time/nairobi-time';
import type { EffectiveRuleGroup, EffectiveRules, PayReadiness, RuleChangeNotice } from './rules.types';
import type { RuleGroupCode } from './rules-schemas';

/**
 * Resolution (the one rule): for a site and a date, per group, take the company version with the greatest
 * effectiveFrom not later than the date (ties: higher version); if none, RULE_DEFAULTS. Then lay over it the fields of
 * the SITE's version chosen the same way, for the fields that group lets a site override. The merged values are
 * validated against the group's schema before they are returned. A site with no override gets the company values;
 * a company change to a field the site has not overridden reaches the site at once. SYSTEM use only: no actor, nothing
 * is hidden. HTTP callers go through rulesService, which hides what the caller may not read.
 */
export declare function getEffectiveRules(siteId: string, date: NairobiDate): Promise<EffectiveRules>;
export declare function getEffectiveRuleGroup<G extends RuleGroupCode>(siteId: string, date: NairobiDate, group: G): Promise<EffectiveRuleGroup<G>>;
export declare function isPayConfirmed(group: EffectiveRuleGroup): PayReadiness;

export interface CreateRuleVersionInput {
  group: RuleGroupCode;
  siteId: string | null; // null = company default
  effectiveFrom: NairobiDate;
  values: unknown; // full group for a company default; the overridable fields for a site
  reason: string; // required, 1 to 500 characters
  signature?: { method: 'PIN'; signedAt: Date }; // verified by the (slice 4) endpoint, recorded in the audit entry
}

export interface RuleVersionView {
  id: string;
  group: RuleGroupCode;
  siteId: string | null;
  version: number;
  effectiveFrom: NairobiDate;
  createdAt: string;
  createdBy: { id: string; name: string; role: string };
  reason: string;
  values: unknown;
  changedFields: string[]; // against the previous version of the same scope
  requiredConfirmations: string[];
  confirmations: { scope: string; by: { id: string; name: string }; at: string; note: string | null }[];
}

export interface RulesService {
  /** Read: needs rules.read. Unit holders read their own site only. STATUTORY comes back locked unless the caller holds payrun.read. */
  getEffective(actor: AccessSubject, siteId: string, date: NairobiDate): Promise<{ groups: (EffectiveRuleGroup | LockedRuleGroup)[] }>;
  listVersions(actor: AccessSubject, group: RuleGroupCode, siteId: string | null): Promise<RuleVersionView[] | LockedRuleGroup>;
  /** Write: per-field capabilities, scope, effective-date rules and audit as in 6.2 and 6.3. Runs through runAudited. */
  createVersion(actor: AccessSubject, input: CreateRuleVersionInput): Promise<{ version: RuleVersionView; notice: RuleChangeNotice }>;
  /** Needs the capability the scope names (6.2). Idempotent per (version, scope). Writes rules.version_confirmed. */
  confirmVersion(actor: AccessSubject, versionId: string, scope: string, note?: string): Promise<RuleVersionView>;
}

export interface LockedRuleGroup {
  group: RuleGroupCode;
  locked: true;
}
```

`getEffectiveRules` is exported from the public door (section 7) for the engine's callers in later slices. It is **never** exposed over HTTP; the HTTP path is `rulesService.getEffective`, which removes what the caller may not read.

### 6.5 Read endpoints (the only endpoints slice 0 adds besides permissions)

| Method | Path | Guard | Notes |
|---|---|---|---|
| `GET` | `/workforce/rules/effective?siteId=<uuid>&date=YYYY-MM-DD` | `authenticate`, `requireCapability('rules.read')` | `date` defaults to today in Nairobi. A `unit` holder may pass only their own `siteId` (else `403`). `STATUTORY` is `{ locked: true }` without `payrun.read` |
| `GET` | `/workforce/rules/:group/versions?siteId=<uuid>` | same | Newest first. `siteId` omitted = company default versions (readable by all `rules.read` holders; a `unit` holder sees the company's and their own site's) |

```ts
// file: rules/rules-validators.ts
import { z } from 'zod';
import { RULE_SCHEMAS } from './rules-schemas';

const groups = Object.keys(RULE_SCHEMAS) as [keyof typeof RULE_SCHEMAS, ...(keyof typeof RULE_SCHEMAS)[]];

export const EffectiveQuerySchema = z.object({
  siteId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const VersionsParamsSchema = z.object({ group: z.enum(groups) });
export const VersionsQuerySchema = z.object({ siteId: z.string().uuid().optional() });
```

Errors: `400` validation (Zod, global handler), `401` not signed in, `403` no `rules.read` or another site, `404` unknown group. The write endpoints (and their errors `RULE_BACKDATED`, `RULE_FUTURE_VERSION_EXISTS`, `RULE_NO_CHANGE`, `RULE_FIELD_NOT_EDITABLE`, `RULE_SITE_FIELD_NOT_OVERRIDABLE`, `RULE_CONFIRM_NOT_REQUIRED`) are slice 4; the service already throws these as typed `AppError`s so slice 4 only maps them.

---

## 7. Public door

`backend/src/modules/workforce/index.ts` is the **only** file other modules may import (`.dependency-cruiser.cjs` already enforces this for anything under `src/modules/`). Slice 0 exports what it builds, declares the types for what later slices build, and ships **stubs** for the four calls that need data from later slices. A stub throws `NotBuiltYetError` (HTTP 501, code `NOT_BUILT_YET`, message names the function and the slice) so a premature caller fails loudly, never returns a wrong answer. Nothing calls the stubs yet; Kitchen and Barista displays keep using today's legacy `onShift` filter until slice 3.

### 7.1 Events (proposal 3.3, plus slice 0's own two)

```ts
// file: _shared/events.ts
import type { DepartmentTag } from '@prisma/client';
import type { NairobiDate } from './time/nairobi-time';
import type { RuleChangeNotice } from '../rules/rules.types';
import type { RuleGroupCode } from '../rules/rules-schemas';

export interface WorkforceEventPayloads {
  'rota.published': { siteId: string; departmentId: string | null; weekStart: NairobiDate; publishedById: string; changedAfterPublish: boolean };
  'clock.in': { siteId: string; employeeId: string; userId: string | null; shiftAssignmentId: string | null; occurredAt: string; source: 'PHONE' | 'HEAD' | 'MANAGER' | 'SYSTEM' };
  'clock.out': { siteId: string; employeeId: string; userId: string | null; shiftAssignmentId: string | null; occurredAt: string; closedBy: 'OUT' | 'AUTO_OUT' };
  'overtime.requested': { siteId: string; employeeId: string; overtimeRequestId: string; minutesRequested: number };
  'timesheet.approved': { siteId: string; periodId: string; employeeId: string | null; approvedById: string; scope: 'LINE' | 'PERIOD' };
  'payroll.published': { siteId: string; payRunId: string; publishedById: string };
  'department.head_changed': { siteId: string; departmentId: string; departmentTag: DepartmentTag | null; previousHeadUserId: string | null; newHeadUserId: string | null; effectiveOn: NairobiDate };
  // slice 0
  'rules.version_created': { companyId: string; siteId: string | null; group: RuleGroupCode; version: number; effectiveFrom: NairobiDate; createdById: string; notice: RuleChangeNotice };
  'rules.version_confirmed': { versionId: string; group: RuleGroupCode; scope: string; confirmedById: string };
}

export type WorkforceEventName = keyof WorkforceEventPayloads;
export type WorkforceEvent = { [N in WorkforceEventName]: { name: N; payload: WorkforceEventPayloads[N]; occurredAt: string } }[WorkforceEventName];

export interface WorkforceEventBus {
  emit<N extends WorkforceEventName>(name: N, payload: WorkforceEventPayloads[N]): void;
  on<N extends WorkforceEventName>(name: N, handler: (event: Extract<WorkforceEvent, { name: N }>) => void): () => void;
}

/** In-process, typed, synchronous handlers. Events are emitted by runAudited only AFTER the transaction commits. */
export declare const workforceEvents: WorkforceEventBus;

/** Delivery of "X is told" is a later slice (Notifications). Until then this logs and does nothing else. */
export interface WorkforceNotifier {
  notify(recipientUserId: string, kind: string, data: Record<string, string | number | null>): Promise<void>;
}
export declare function setWorkforceNotifier(next: WorkforceNotifier): void;
```

Slice 0 **emits** only `rules.version_created` and `rules.version_confirmed`; the other seven are declared so later slices and consumers agree on names and payloads from day one. `department.head_changed` is what Access reads to refresh the `isDepartmentHead` and `departmentTag` claims (boundary 3.4; needs the Access lane's agreement, slice 1).

### 7.2 The door

```ts
// file: index.ts
import type { DepartmentTag, UserRole } from '@prisma/client';
import type { NairobiDate } from './_shared/time/nairobi-time';

// Access table
export {
  CAPABILITIES,
  SCOPES,
  ROLE_GRANTS,
  grantsOf,
  scopeOf,
  workforceCan,
  inScope,
  assertInScope,
  assertNotSelf,
  requireCapability,
  lockedGroupsFor,
  redactSensitive,
  defaultTracksTime,
  type AccessSubject,
  type AccessTarget,
  type Capability,
  type Grants,
  type Scope,
  type SensitiveGroup,
  type Redacted,
} from './_shared/workforce-access';
export { tracksTime, requireTracksTime, setTracksTimeResolver } from './_shared/tracks-time';

// Time engine (pure)
export * from './_shared/time/nairobi-time';
export * from './_shared/time/time-types';
export { computeLateness, assertNoOvernight, shiftInstants } from './_shared/time/lateness';
export { resolveClockPairs, computeDayHours } from './_shared/time/day-hours';
export { makeUpMinutes, overtimeCandidate, weeklyOvertime, type OvertimeCandidate, type OvertimeEvidence, type WeeklyOvertime } from './_shared/time/overtime';
export { weeklyTotals, periodTotals, deductibleLateness, type WeekTotal, type PeriodTotal, type LateDay, type DeductibleLateness } from './_shared/time/totals';
export { periodContaining, periodsBetween, isInPeriod, type Period, type PeriodRule } from './_shared/time/periods';

// Audit
export { writeAuditEntry, runAudited, type AuditedChange } from './_shared/audit/audit-writer';
export { verifyAuditChain, GENESIS_HASH, type ChainVerdict } from './_shared/audit/audit-hash';
export { auditReadScopeOf, type AuditReadScope, type AuditReader, type AuditQuery, type AuditPage } from './_shared/audit/audit-read';
export { AUDIT_ACTIONS, type AuditActionCode } from './_shared/audit/audit-actions';
export { AUDIT_CATEGORIES, type AuditCategoryCode, type AuditEntryInput, type AuditEntryRecord, type AuditContext } from './_shared/audit/audit.types';

// Rules
export { getEffectiveRules, getEffectiveRuleGroup, isPayConfirmed } from './rules/rules-service';
export { RULE_DEFAULTS } from './rules/rules-defaults';
export { RULE_SCHEMAS, type RuleGroupCode, type RuleValues, type LatenessRules, type OvertimeRules, type AttendanceRules, type WeekAndBreaksRules } from './rules/rules-schemas';
export type { EffectiveRules, EffectiveRuleGroup, PayReadiness } from './rules/rules.types';

// Events
export { workforceEvents, setWorkforceNotifier, type WorkforceEvent, type WorkforceEventName, type WorkforceEventPayloads, type WorkforceNotifier } from './_shared/events';

// Calls that need later slices: declared now, stubbed (they throw NotBuiltYetError)
export interface OnShiftPerson { userId: string; name: string; role: UserRole; departmentTag: DepartmentTag | null; clockedInAt: string }
export interface EmployeeSummary { employeeId: string; userId: string | null; name: string; siteId: string; departmentId: string | null; positionName: string | null; tracksTime: boolean; status: string }
export interface ApprovedHours { workedMinutes: number; overtimeApprovedMinutes: number }

/** Slice 3. Who is clocked in now at this place (kitchen and barista displays; behaviour unchanged from today). */
export declare function getOnShiftNow(unit: { siteId: string; departmentTag?: DepartmentTag }, role?: UserRole): Promise<OnShiftPerson[]>;
/** Slice 1. */
export declare function getEmployee(userId: string): Promise<EmployeeSummary | null>;
/** Slice 5. */
export declare function isOnLeave(userId: string, date: NairobiDate): Promise<boolean>;
/** Slice 4. Reporting reads approved hours only, never raw clock events. */
export declare function getApprovedHours(userId: string, period: { start: NairobiDate; end: NairobiDate }): Promise<ApprovedHours>;
```

`NotBuiltYetError` lives in `_shared/errors.ts` with `OvernightShiftError` (a `ValidationError` with code `OVERNIGHT_SHIFT`). Nothing is exported that a caller could mistake for working behaviour.

---

## 8. File layout

All under `backend/src/modules/workforce/`. **No frontend files in slice 0.** Files keep layer-suffixed names; tests sit beside the code.

```
workforce/
  README.md                       feature map; points to docs/features/workforce/ and this contract
  index.ts                        the public door (7.2)
  _shared/
    README.md                     access table, time engine, audit writer: spec, status, coupling
    workforce-access.ts           capabilities, grants, scope, guards, sensitive fields      (+ .test.ts)
    permissions-routes.ts         GET /workforce/permissions/me                              (+ .test.ts)
    tracks-time.ts                resolver and guard                                        (+ .test.ts)
    events.ts                     event names, payloads, bus, notifier                      (+ .test.ts)
    errors.ts                     NotBuiltYetError, OvernightShiftError
    time/
      nairobi-time.ts             helpers (4.2)
      time-types.ts               ShiftWindow, ClockEventFact, DayHours ... (4.3)
      lateness.ts                 computeLateness, assertNoOvernight, shiftInstants
      day-hours.ts                resolveClockPairs, computeDayHours
      overtime.ts                 makeUpMinutes, overtimeCandidate, weeklyOvertime
      totals.ts                   weeklyTotals, periodTotals, deductibleLateness
      periods.ts                  periodContaining, periodsBetween, isInPeriod
      *.test.ts                   one per file, plus time-static.test.ts and date-only-bridge.test.ts
    audit/
      audit.types.ts              categories, entry types, retention constant
      audit-actions.ts            registry
      audit-hash.ts               canonical form, hash, verifyAuditChain                     (+ .test.ts)
      audit-repository.ts         the only SQL for audit: lockChainHead, insertEntry, no update or delete
      audit-writer.ts             writeAuditEntry, runAudited
      audit-read.ts               auditReadScopeOf, AuditReader interface
      *.test.ts
  rules/
    README.md                     (8.1)
    rules-schemas.ts  rules-defaults.ts  rules-field-policy.ts  rules.types.ts
    rules-validators.ts           query and params schemas
    rules-repository.ts           all Prisma for rules; every query carries companyId or siteId; no update or delete
    rules-service.ts              resolution, createVersion, confirmVersion, rulesService
    rules-controller.ts           parse, delegate, respond
    rules-routes.ts               the two GET routes, authenticate then requireCapability('rules.read')
    *.test.ts
```

**Outside the module (the only edits, all additive):** `backend/prisma/schema/workforce.prisma` (the four models appended under a header comment; split into a `schema/workforce/` folder from slice 1, question 14), one new migration folder, `backend/src/routes/index.ts` (register the two routers), `backend/package.json` (script `test:workforce-tz`). Docs: the sub-module READMEs below, `docs/DATA_MODEL.md` (the four tables), `docs/API_CONTRACT.md` (three endpoints), `docs/features/workforce/README.md` (status row).

### 8.1 What each README will say

- **`workforce/README.md`:** the eleven sub-modules and the slice that builds each; dependency direction (proposal 3.2); the public door; "slice 0 built: `_shared`, `rules`"; pointer to this contract.
- **`_shared/README.md`:** *Access:* the roles, the capability table link, how heads and "tracks time" work, never add `requireRole`. *Time engine:* the seven ground rules (4.1), the forbidden calls, how to run the three-zone tests. *Audit:* entry shape, append-only plus chain, writer-last rule, retention, read-side interface. *Coupling:* reads `User` claims from `req.user` only; imports `utils/departments`, `utils/errors`, `utils/date-only` (listed here because it is a legacy import).
- **`rules/README.md`:** the ten groups and who edits and confirms each; resolution rule; versioning rule and the effective-date rules; defaults are examples; endpoints (two reads now, writes in slice 4); coupling (`getEffectiveRules` is what the time engine's callers use; reads `sites` and `users` only through `rules-repository`).

---

## 9. Tests

Named by file. "x3" means the file runs in all three server zones (`TZ=UTC`, `TZ=Africa/Nairobi`, `TZ=America/Los_Angeles`). Write the time-engine tests first.

**`_shared/time/nairobi-time.test.ts` (x3)**: rolls the date at 21:00Z; a 06:00 Nairobi shift is 03:00Z; `instantAt` then `nairobiClockOf` round trip; daylight-saving days in Los Angeles change nothing; year end; leap day; `addDays` across month and year; `daysBetween` signed; `eachDay` inclusive and empty; `isoWeekday` of three known dates; `weekStart` with Monday and Sunday starts; Sunday belongs to the previous Monday's week; `monthKey`; rejects `2026-02-30`, `24:00`, `6:00`, `2026-1-5`.

**`_shared/time/date-only-bridge.test.ts` (x3)**: `toDateColumn` equals `parseDateOnly`; `fromDateColumn` equals `formatDateOnly`; `toDateColumn(nairobiToday(now))` equals `getTodayDateOnly()` at a frozen instant (one before and one after 21:00Z).

**`_shared/time/lateness.test.ts` (x3)**: 06:05 against 06:00 is 5 minutes late; grace 5 does not count; grace 4 counts with 1 after grace; grace 0 counts 5; 06:00:59 is 0 (floor); 05:45 is 15 early and 0 late; clock-in after the end is computed; afternoon shift 14:00; 22:00 shift; `assertNoOvernight` throws for 18:00 to 02:00, equal times, end 00:00; accepts 22:00 to 23:59.

**`_shared/time/day-hours.test.ts` (x3)**: IN then OUT; undo of an OUT leaves the shift open with no gap; corrected IN replaces the old time; later correction beats earlier; orphan OUT is `unmatched`; duplicate id counts once; two segments add up; normal day with a 30-minute break; early arrival not counted; stay-on goes to `afterEndMinutes`; stay-on past midnight is attributed to the shift date; left early; break larger than time worked; rounding NEAREST, DOWN, UP at 5 and 15 and never above scheduled; OPEN uses `now`; AUTO_CLOSED flagged; NO_CLOCK has lateness null.

**`_shared/time/overtime.test.ts` (x3)**: tail with open work (15 auto, 5 need approval); no open work (0 auto); pre-approval covers 20 with basis PRE_APPROVED; tail and pre-approval overlap by max not sum; make-up consumes minutes first; OPEN day gives null; `makeUpMinutes` off gives 0; weekly cap flags `overCapMinutes`; cap null flags nothing; order value is not an input (signature test).

**`_shared/time/totals.test.ts` (x3)**: a five-day week; absent days; OPEN days skipped; two shifts in a day; week cut by a period boundary is `partial`; Monday week start; `deductibleLateness` RECORD_ONLY, FROM_FIRST_MINUTE, AFTER_N_LATES (4th late charged, count restarts next month), excused free, made-up free and not counted toward N.

**`_shared/time/periods.test.ts` (x3)**: 4 weeks from Mon 21 Sep 2026 is 21 Sep to 18 Oct, then 19 Oct to 15 Nov; dates before the anchor; `CALENDAR_MONTH` for leap February; `periodsBetween` across three periods; `isInPeriod` edges; labels.

**`_shared/time/time-static.test.ts`**: no forbidden call in `_shared/time/` (4.1 rule 3); no argument-less `new Date()`.

**`_shared/workforce-access.test.ts`**: for each of the 15 roles, every capability is either allowed with the exact scope or refused (exact expected sets written in the test); device roles hold nothing; a head gets base plus extras with the wider scope winning; a Kitchen head covers a Pastry target; `time.own` dropped when `tracksTime` is false and absent for managers; legacy `DEPARTMENT_HEAD` behaves as staff plus head; `inScope` for own, dept, unit, all; a unit holder with no site is refused; `assertInScope` 403 for writes and 404 for reads; `assertNotSelf`; `requireCapability` gives 401 without a user, 403 without the capability, passes with any one of several; `lockedGroupsFor` for the Branch Manager (pay, bank, ids, documents, payslip opens locked; discipline open), HR, Accountant (discipline locked), own record, a head viewing a team member (pay locked), and Director (payslip opens open, nobody else); `redactSensitive` removes the keys and returns `locked`; `AUDIT_CAPABILITIES_COMPLETE`; every capability in the matrix is in `CAPABILITIES` and every category has its read capability.

**`_shared/permissions-routes.test.ts`**: 401 without a token; own row with scopes; a head sees dept scopes; `tracksTime` false drops `time.own`; System Admin `asRole` preview works, is ignored for anyone else, and ignores unknown roles; response parses against `PermissionsMeSchema`.

**`_shared/tracks-time.test.ts`**: default per role (Accountant and Store Attendant track, Branch Manager does not); a registered resolver overrides; `requireTracksTime` refuses.

**`_shared/audit/audit-hash.test.ts`**: canonical form ignores key order; fixed known-answer hash; `verifyAuditChain` accepts a good chain; a changed field fails `HASH_MISMATCH` at that seq; a removed middle entry fails `GAP`; a duplicated seq fails; a wrong `prevHash` fails; checking a slice with `start`.

**`_shared/audit/audit-actions.test.ts`**: unregistered action refused; category not allowed for the action refused; every registered category is a real `AUDIT_CATEGORIES` value; `AUDIT_CATEGORIES` equals the Prisma `AuditCategory` enum values.

**`_shared/audit/audit-writer.test.ts`** (repository mocked): a successful change writes exactly one entry; a change that throws writes none and emits no event; a failing entry write rolls the change back; seq increases by one and `prevHash` links; the first entry uses `GENESIS_HASH`; events are emitted only after commit; a bulk action writes one entry; actor name is a snapshot; no function that updates or deletes an audit row exists, and a static test finds no `auditEntry.update|updateMany|delete|deleteMany|upsert` anywhere in the module; the writer cannot be called without a transaction client.

**`_shared/audit/audit-db.test.ts`** (integration; runs only when `DATABASE_URL` points at a lane database, skipped otherwise, and run for the proof): UPDATE, DELETE and TRUNCATE on `workforce_audit_entries` are refused; the chain head can only move to `last_seq + 1`; two concurrent writers produce a gap-free chain.

**`_shared/audit/audit-read.test.ts`**: staff and heads read only their own record; Branch Manager reads TIME, LEAVE and RULES_OPERATING for their unit; HR; Accountant; Director reads everything including LOG_ACCESS and PAYSLIP_ACCESS; System Admin reads SECURITY and rule changes and not payslip opens; no one except the Director can read LOG_ACCESS or PAYSLIP_ACCESS; "my record" never includes LOG_ACCESS.

**`_shared/events.test.ts`**: handlers receive typed payloads; `on` returns an unsubscribe; events for a rolled-back change are never delivered.

**`rules/rules-schemas.test.ts`**: every default validates; STATUTORY default is empty; HOLIDAYS default is off; group keys equal the Prisma `RuleGroup` enum; AFTER_N_LATES without a count fails; duplicate leave codes fail; a default policy for an unknown leave code fails; the conduct ladder order is enforced; a week anchor on the wrong weekday fails; money and multiplier formats; `RULE_FIELD_POLICY` covers every field of every group (no missing, no extra); each site schema holds exactly the `site: true` fields.

**`rules/rules-service.test.ts`** (repository mocked): defaults serve as version 0 when nothing exists; company version chosen by date; later date not yet effective; tie goes to the higher version; a site override supplies only its fields; a company change to a field the site did not override reaches the site; merged values validated; **createVersion**: Director company default ok; Branch Manager own-site override ok; Branch Manager company default refused; Branch Manager other site refused; Branch Manager changing a non-site field refused; HR changing lateness refused; Accountant statutory ok; a multiplier edit by the Director is pending the Accountant's confirmation; Director cannot confirm pay rates; Accountant confirms, twice is idempotent; confirming an unneeded scope is `409`; unchanged confirmed fields carry forward; backdated refused; earlier than the latest stored version refused; same date new version wins; no change refused; reason required; PIN signature recorded in the audit entry; category is RULES_PAY for statutory, multipliers and holiday pay and RULES_OPERATING otherwise; before and after hold changed fields only; a failure writes no entry; events after commit; notice recipients match 6.2; **reads**: STATUTORY locked without `payrun.read`; a unit holder cannot read another site; `isPayConfirmed` for empty statutory, a missing confirmation, and ready.

**`rules/rules-routes.test.ts`**: 401; 403 without `rules.read`; 200 shape for both endpoints; 400 for a bad uuid, a bad date or an unknown group; 403 for a unit holder asking another site; the Branch Manager gets STATUTORY locked.

**`rules/rules-repository.test.ts`** (static): every query carries `companyId` or `siteId`; no update or delete of `RuleVersion` or `RuleConfirmation`.

**`workforce-layering.test.ts`**: no `@prisma/client` runtime import outside `*-repository.ts` (the `$transaction` in `audit-writer.ts` is the one named exception); no `any`; no `requireRole(` in the module; `index.ts` exports match the list in 7.2; each stub throws `NotBuiltYetError` naming its slice.

---

## 10. Impact on legacy code

**Slice 0 adds; it removes nothing and rewrites nothing.**

| Touched | How |
|---|---|
| `backend/src/modules/workforce/**` | new |
| `backend/prisma/schema/workforce.prisma` | four models appended; no existing model changes |
| `backend/prisma/schema/migrations/<timestamp>_workforce_foundation` | new: four tables, two partial unique indexes, the append-only triggers |
| `backend/src/routes/index.ts` | register the permissions router and the rules router (the one shared touch-point) |
| `backend/package.json` | add `test:workforce-tz` |
| Docs | READMEs, `DATA_MODEL.md`, `API_CONTRACT.md`, Workforce README status |

**Confirmed unchanged:** the `User` model and table; the login token and `jwt.ts`; `middleware/authenticate.ts`; every Access file and model (the four slice-0 tables use plain id columns precisely so no back-relation is needed there); every Inventory file; every legacy service, controller, repository and job.

**Left broken on purpose** (it still works the way it does today; the slice that replaces it fixes it). Line numbers are `main` at `e16a93a`.

| File and place | What is wrong | Fixed by |
|---|---|---|
| `repositories/hr-repository.ts:904` `LATE_THRESHOLD_MINUTES = 15` | lateness threshold hard-coded; becomes the LATENESS rule | slice 4 (reports move to timesheets and rules) |
| `hr-repository.ts:966` in `getAttendanceSummary` and `:1010` in `getStaffAttendanceDetail` | `new Date(clockIn).setHours(...)` uses the **server's** zone: on a UTC server a 06:05 clock-in against a 06:00 shift is computed as 175 minutes early | slice 4 (replaced by the time engine); slice 3 stops new clock data feeding it |
| `hr-repository.ts:775` in `getHrDashboardStats` | "today" from server time (`setHours(0,0,0,0)`) | slice 1 (HR Home) |
| `hr-repository.ts:855` in `getStaffOnLeaveToday` | same | slice 5 |
| `services/hr-service.ts:250` `calculateWorkingDays` | counts weekdays with `getDay()` on server time; leave must count every calendar day | slice 5 |
| `services/clock-service.ts` | geofence from env, 60-second undo, last-override-only note, stale clock-out job | slice 3 |
| `jobs/shift-reminder.ts`, `jobs/daily-report.ts` | each carries its own correct Nairobi formatter (duplicated, not wrong) | slice 3 (`shift-reminder`); `daily-report` is Reporting's |
| `services/payslip-service.ts` | typed pay figures, drafts visible to staff | slice 6 |

**Production safety.** The migration only adds four empty tables and triggers, so it can be applied to the live database without touching existing rows. Session 2 proves that on a copy of the seeded lane database (row counts before and after, `prisma migrate diff` clean) before anything is merged. Rollback is dropping the four tables.

---

## 11. Open questions for the owner

Each has my recommendation; the contract is drafted as the recommendation. **Owner decision, 6 Oct 2026: for every question the recommendation is the default; the owner will correct any that need it.** Session 2 builds as drafted and applies a later correction through the amendment log.

1. **How is lateness charged?** The documents say "deduct from the first minute after grace". I drafted: the **minutes after grace** are chargeable (6 minutes late with a 5-minute grace charges 1 minute), and "make up the time the same day" uses minutes worked after the shift end (those minutes are then not overtime). The alternative charges the whole lateness once it passes grace. *Recommend: minutes after grace.* It is the gentler reading and matches the wording.
2. **Where do timesheet periods come from?** The approved sample (21 Sep to 18 Oct, four weeks) needs a setting, but none of the ten groups names one. I added `timesheetPeriod` (fixed weeks from an anchor date, or calendar month) to **Week and breaks**, defaulting to your sample. *Recommend: keep it there, and tell me if periods are meant to follow the calendar month instead.*
3. **Seed rule values, or serve defaults from code?** *Recommend: from code, as version 0, until the Director makes the first edit.* Nothing invented is stored as if it were confirmed, and statutory and holiday pay stay empty.
4. **Foreign keys on the four slice-0 tables.** To avoid editing Access files, they hold plain id columns (no database-enforced link to users or sites). Later slices need one-line back-relation fields on `Site`, `User` and `Company` in `access.prisma` (no column changes). *Recommend: accept plain ids for audit and rules, and get the Access lane's agreement for slice 1.*
5. **Capabilities I added beyond proposal section 9** because the designs need them: employee write (basic, sensitive, lifecycle: HR and, for basics, the Branch Manager of the unit and the System Admin), `payrun.read`, `org.read/write/write_heads`, and splitting the "policy" row into one edit right per rule group plus three confirm rights. *Recommend: approve as drafted (the generated matrix in 3.3 shows exactly who holds what).*
6. **System Admin and rules.** Section 9 says "all" for lateness and overtime policy; section 8 says the Admin reads "rule changes". I gave the Admin edit rights on lateness, overtime and attendance only, not probation, conduct, casual rates, leave, holidays, week, statutory. *Recommend: as drafted.*
7. **Audit visibility choices where section 8 is silent.** (a) The Branch Manager reads TIME, LEAVE and, because they are told when the Director changes their branch's rules, RULES_OPERATING rows for their own branch. (b) HR reads PAY_SETUP and DISCIPLINE rows (HR owns both). (c) SENSITIVE_VIEW ("someone viewed pay, ID or bank details") and LOG_ACCESS are Director-only. *Recommend all three.* All three are drafted in.
8. **Who edits Probation, Conduct, Casual work and Week and breaks?** The README says the Director edits Conduct, Probation and the week start; proposal section 11 said HR for week and breaks; Casual work has no stated editor. *Recommend: the Director edits all four (the README is later than the proposal); HR reads.*
9. **Tamper-evidence design.** A hash chain per company with a short row lock, writer last, one entry per bulk action, plus an off-server daily anchor in slice 7. *Recommend: yes.* It costs a few milliseconds per audited change and is the only way to notice a rewritten table.
10. **How far can a branch differ from the company?** Only lateness (grace, policy, after-N, make-up, excuse window), overtime (tail, weekly cap, branch budget, approval window) and leave minimum cover. The deduction cap and the overtime multiplier stay company-wide. *Recommend: as drafted.*
11. **Who is told of a company-default edit?** I drafted all Branch Managers. *Recommend: yes.* It is rare and affects every branch.
12. **"Tracks time" before the employee file exists (slice 1).** The role defaults of decision D2 apply (Accountant and Store Attendant clock in; Branch Manager, Store Manager, Director, HR, Admin do not). *Recommend: yes.*
13. **Who edits a pay profile?** Section 9 says HR writes and the Director and Accountant read; the hire flow (proposal 2.3, step 3) lists "HR, Director, Accountant (read or confirm)". I followed section 9. *Recommend: HR writes; Director and Accountant read.*
14. **Where the new models live.** The handoff names `workforce.prisma`; I appended there for slice 0. *Recommend: split into a `schema/workforce/` folder (as Inventory does) when slice 1 retires the legacy models.*

---

## 12. Amendment log

The backend session fills this in. Every change from this contract is recorded here with the date, the section, the change and the reason, and mentioned in the recap.

| Date | Section | Change | Reason |
|---|---|---|---|
| | | | |

