> **SEALED — Phase 8 Complete (2026-05-04)**
> This addendum file has been consolidated into the authoritative reference docs:
> - Architecture decisions → docs/TDD.md §§22-25
> - API endpoints → docs/API_CONTRACT.md §§13-17
> - Data model → docs/DATA_MODEL.md
> - Build order → docs/BUILD_ORDER.md §14
> 
> This file is preserved for historical context. Do not update it.

---
# HR Module — Context (Living File)

This file documents the full implementation of the HR module built as a post-Phase 8 feature.
It is the source of truth for what was built, what decisions were made, and what is known to need debugging or refinement.

---

## Status

- [x] Schema & Migrations — Complete
- [x] Backend (routes, validators, repository, service, controller) — Complete
- [x] FCM integration — Complete
- [x] Comms module integration — Complete
- [x] Frontend types & service — Complete
- [x] Frontend pages — Complete
- [x] Nav wiring (HR_MANAGER role) — Complete
- [x] System Admin: HR Manager account creation — Complete
- [x] Inbox awareness (nudge card, arrival toast, nav badge) — Complete
- [x] Attendance Analytics — Complete (see section below)
- [ ] End-to-end testing & debugging — **In Progress (next session)**

---

## Scope

Features implemented:
- Employee Profiles (HR record per staff member)
- Leave Balances (seeded on profile creation: Annual 21, Sick 10, Emergency 5, Unpaid 30 days)
- Leave Requests (submit → pending → approved/rejected/cancelled)
- Working-days calculation (excludes weekends)
- Leave Calendar (monthly grid view for managers/HR)
- Disciplinary Records (with FCM notice to staff)
- HR Documents (Cloudinary upload, linked to leave request or disciplinary record)
- HR Dashboard (stat cards + pending requests + on-leave-today + probation alerts + attendance snapshot widget)
- Staff self-service My Leave page
- **Attendance Analytics** — cross-staff attendance report: days worked vs. days scheduled, drill-down per staff, CSV export

Features explicitly deferred:
- Maternity / paternity leave types
- Payroll integration
- Staff Performance Scoring

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Leave year | Calendar year (Jan 1 – Dec 31) | Confirmed by user |
| Branch manager's own leave | Routes to Director or HR_MANAGER | Prevents self-approval |
| Manager approving another manager's leave | Blocked — must go to HR_MANAGER/DIRECTOR | RBAC fairness |
| Sick leave medical certificate threshold | 3 consecutive days | Per spec |
| HR_MANAGER organizationId | `null` (system/cross-branch) | Like DIRECTOR |
| Leave balance seeding | Auto-seeded on profile creation via `seedLeaveBalances()` | UX: no manual setup step |
| Shift conflict on leave approval | Warning only, not a blocker | Confirmed by spec |
| Leave request notifications | FCM push directly to manager/HR/Director — no broadcast | Staff don't have broadcast permission |

---

## Database — New Models & Enums

### New Enums (in `backend/prisma/schema.prisma`)
- `EmploymentType`: `FULL_TIME`, `PART_TIME`, `CASUAL`
- `LeaveType`: `ANNUAL`, `SICK`, `EMERGENCY`, `UNPAID`
- `LeaveStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`
- `DisciplinaryCategory`: `ATTENDANCE`, `CONDUCT`, `PERFORMANCE`, `POLICY_VIOLATION`, `OTHER`
- `DisciplinaryAction`: `VERBAL_WARNING`, `WRITTEN_WARNING`, `FINAL_WARNING`, `SUSPENSION`, `TERMINATION`
- `HrDocumentType`: `CONTRACT`, `ID_DOCUMENT`, `CERTIFICATE`, `LEAVE_CERTIFICATE`, `DISCIPLINARY_LETTER`, `OTHER`

### New Models
- `EmployeeProfile` — one per user, links to `User`; has `jobTitle`, `employmentType`, `startDate`, `probationEndDate`, `hrNotes`, `emergencyContactName/Phone`
- `LeaveBalance` — one per `(employeeProfileId, leaveType, leaveYear)`; tracks `totalDays`, `usedDays`, `pendingDays`
- `LeaveRequest` — tracks `leaveType`, `startDate`, `endDate`, `totalDays` (working days), `status`, `reason`, `reviewComment`, links to `LeaveBalance`
- `DisciplinaryRecord` — tracks `category`, `action`, `description`, `issuedAt`, `acknowledgedAt`, `isActive`
- `HrDocument` — Cloudinary file; optionally linked to `LeaveRequest` or `DisciplinaryRecord`

### Migrations (manual SQL, deployed via `migrate deploy`)
- `backend/prisma/migrations/20260413100000_add_hr_manager_role/migration.sql` — `ALTER TYPE "UserRole" ADD VALUE 'HR_MANAGER'`
- `backend/prisma/migrations/20260413110000_add_hr_module_tables/migration.sql` — full DDL for all 5 HR tables + enums

---

## Backend Files

### New Files
| File | Purpose |
|---|---|
| `backend/src/validators/hr-schemas.ts` | Zod schemas for all HR endpoints |
| `backend/src/repositories/hr-repository.ts` | All Prisma queries for HR |
| `backend/src/services/hr-service.ts` | All business logic (leave lifecycle, disciplinary, notifications) |
| `backend/src/controllers/hr-controller.ts` | Thin handlers — validate + delegate |
| `backend/src/routes/hr-routes.ts` | Route definitions with multer for document upload |

### Modified Files
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Added `HR_MANAGER` to `UserRole`; added 5 HR models + 7 enums; added back-relations to `User` and `Organization` |
| `backend/src/routes/index.ts` | Registered `hrRoutes` |
| `backend/src/routes/comms-routes.ts` | Added `HR_MANAGER` to `ALL_HUMAN_ROLES`, broadcast senders, and formal notice senders |
| `backend/src/routes/staff-routes.ts` | Added `HR_MANAGER` to all staff route `requireRole` arrays |
| `backend/src/services/fcm-service.ts` | Added `sendLeaveRequestPush`, `sendLeaveDecisionPush`, `sendDisciplinaryNoticePush` |

### Key Import Paths (critical — backend uses relative imports, NOT `@/`)
- Prisma client: `../config/database`
- Logger: `{ logger } from '../utils/logger'` (named export)
- Auth middleware: `../middleware/authenticate`
- No `asyncHandler` wrapper — this codebase uses raw async handlers directly

### Route Registration Order (important — avoids Express param conflicts)
```
GET  /hr/leave/balances/my          ← before /:userId
GET  /hr/leave/requests/my          ← before /:id
POST /hr/documents/upload           ← before /:userId
```

---

## Frontend Files

### New Files
| File | Purpose |
|---|---|
| `frontend/types/hr.ts` | All HR TypeScript types |
| `frontend/services/hrService.ts` | API calls using `apiClient.get/post/patch` (object syntax — NOT callable directly) |
| `frontend/components/hr/LeaveTypeBadge.tsx` | `LeaveTypeBadge`, `LeaveStatusBadge`, `DisciplinaryActionBadge`, `formatDateRange`, `roleLabel`, `employmentTypeLabel` |
| `frontend/app/app/hr/page.tsx` | HR Dashboard (stat cards, pending leave approval, on-leave-today, probation alerts, attendance snapshot widget) |
| `frontend/app/app/hr/staff/page.tsx` | Staff Profiles list + create profile modal |
| `frontend/app/app/hr/staff/[userId]/page.tsx` | Employee profile detail — 4 tabs: Overview, Leave, Disciplinary, Documents |
| `frontend/app/app/hr/staff/[userId]/LeaveTab.tsx` | Leave balance pills + leave history |
| `frontend/app/app/hr/my-leave/page.tsx` | Staff self-service leave page (mobile-first) |
| `frontend/app/app/hr/leave/page.tsx` | Manager leave requests — status tabs, type filter, inline approve/reject |
| `frontend/app/app/hr/leave/calendar/page.tsx` | Monthly calendar grid with colour-coded leave bars |
| `frontend/app/app/hr/attendance/page.tsx` | Attendance analytics — filter bar, summary chips, staff table, drill-down drawer, CSV export |

### Modified Files
| File | Change |
|---|---|
| `frontend/types/auth.ts` | Added `HR_MANAGER` to `AppRole` union |
| `frontend/lib/role-home.ts` | Added `HR_MANAGER: '/app/hr'` |
| `frontend/app/app/layout.tsx` | Added `HR_MANAGER` to `MobileRole`, `mobileRoleTabs`, `sidebarSectionsByRole`, `usesDualShell` |
| `frontend/app/app/profile/page.tsx` | Added `HR_MANAGER: 'HR Manager'` to `roleLabels` |
| `frontend/app/app/admin/page.tsx` | Added `HR_MANAGER` to role dropdown, data load, stat card, `roleBadge` helper |
| `frontend/app/app/hr/page.tsx` | Added `InboxNudge` below `PageHeader` — HR Manager sees unread inbox nudge on their overview dashboard |

### Critical: `apiClient` Usage Pattern
`apiClient` is an **object**, not a callable function. The correct pattern:
```ts
apiClient.get<T>(path, token)
apiClient.post<T>(path, body, token)
apiClient.patch<T>(path, body, token)
apiClient.delete<T>(path, token)
```
The initial `hrService.ts` was written with the wrong `apiClient<T>(path, { method, body, token })` pattern and was fully rewritten to the correct form.

---

## Known Deployment Step Required

The backend container must be rebuilt with the new migrations applied before the HR module works in production/local Docker:

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose exec api npx prisma migrate deploy
docker compose up -d --build api worker
```

**Root cause of `GET /staff?role=HR_MANAGER → 400`:** The `listStaffQuerySchema` uses `z.nativeEnum(UserRole)`. The running container's compiled Prisma client predates the `HR_MANAGER` enum addition, so Zod rejects the value. After rebuild, the generated Prisma client includes `HR_MANAGER` and the validation passes.

---

## Seed Script — `seed-employee-profiles.ts`

Script: `backend/src/scripts/seed-employee-profiles.ts`

- Creates `EmployeeProfile` records for all eligible active staff
- **Excluded roles:** `DIRECTOR`, `HR_MANAGER`, `SYSTEM_ADMIN`, `KITCHEN_DISPLAY`, `BARISTA_DISPLAY` — these roles do not need HR profiles
- **Excluded:** inactive users (`isActive: false`)
- Prints a "Skipped" list before processing so excluded accounts are visible
- Run on server post-deployment: `docker compose exec api node dist/scripts/seed-employee-profiles.js`

---

## HR Dashboard — Stat Card Clarifications

| Card | Value | Sub-label |
|---|---|---|
| Total Headcount | `activeStaff` (all active users with HR profiles) | `N on leave today` |
| At Work Today | `activeStaff - onLeaveToday` | `N away` or `Full team in` |
| Pending Leave | `pendingLeave` (PENDING status requests) | `awaiting review` |
| Active Warnings | `activeWarnings` (unexpired disciplinary records) | `unexpired records` |

"Total Headcount" = HR-profiled staff count, not currently-clocked-in staff.

---

## Edit Employee Profile — Available Fields

The edit modal in `frontend/app/app/hr/staff/[userId]/page.tsx` supports:
- Employment Type, Job Title, Start Date, End Date, Probation End Date
- Date of Birth, National ID, Personal Phone, Personal Email, Physical Address
- Emergency contact (Name, Relation, Phone)
- Reporting Manager (select from active MANAGER/HR_MANAGER/DIRECTOR accounts)
- Notes

---

## ACCOUNTANT Leave Support (added 2026-05-05)

The ACCOUNTANT role can now access `/app/hr/my-leave` to view balances and submit leave requests.

### Changes made

| File | Change |
|---|---|
| `frontend/middleware.ts` | Added `ACCOUNTANT` and `HR_MANAGER` to `allRoles` so their JWTs decode correctly. Added explicit `/app/hr/my-leave` route guard. |
| `frontend/app/app/layout.tsx` | Added "My Leave" to ACCOUNTANT desktop sidebar (under "Leave" section) and mobile overflow tabs. |
| `backend/prisma/schema.prisma` | `LeaveRequest.organizationId` changed from `String` (required) to `String?` (nullable). `organization` relation made optional. |
| `backend/prisma/migrations/20260505000000_make_leave_request_org_nullable/migration.sql` | `ALTER TABLE "leave_requests" ALTER COLUMN "organization_id" DROP NOT NULL` |
| `backend/src/services/hr-service.ts` | `submitLeaveRequest`: removed hard throw on null `organizationId`; spreads it only when non-null. `notifyManagementOfLeaveRequest`: signature updated to `organizationId: string \| null`; MANAGER clause is conditional — for ACCOUNTANT only HR_MANAGER and DIRECTOR are notified. |

### Key architectural decision

ACCOUNTANT is a cross-branch role with `organizationId = null` on their user record (same as DIRECTOR). `LeaveRequest.organizationId` is now nullable to support this. Existing rows are unaffected — they all have a value. New rows created by ACCOUNTANT will have `organization_id = NULL` in the DB.

### Backend route access

No backend route changes were needed — `ALL_STAFF` in `hr-routes.ts` already included `ACCOUNTANT` for all self-service endpoints (`/hr/leave/balances/my`, `/hr/leave/requests/my`, `POST /hr/leave/request`, `POST /hr/leave/requests/:id/cancel`).

### Employee profile requirement

The ACCOUNTANT must have an `EmployeeProfile` created via HR Manager UI before they can view balances or submit leave. The `seed-employee-profiles.ts` script already includes ACCOUNTANT (it was never in `EXCLUDED_ROLES`).

---

## Known Issues / Refinements Needed (for next session)

These are items identified during build but not yet tested or confirmed fixed:

1. **My Leave page not linked from staff mobile nav** — ✅ Fixed (2026-05-05): ACCOUNTANT, WAITER, CHEF, BARISTA all have "My Leave" in overflow tabs.
2. **Leave balance update endpoint** — uses `PATCH` but the route may need `PUT`; verify against `hr-routes.ts`.
3. **`getLeaveCalendar` API contract** — service sends `{ year, month }` as 1-indexed (Jan = 1). Backend validator needs to match this; verify `leaveCalendarQuerySchema`.
4. **`LeaveCalendarEntry` type mismatch** — the frontend type has `employeeProfile.user.name` but the backend response shape needs to be confirmed. Check `hr-controller.ts` `getLeaveCalendar` handler response structure.
5. **Disciplinary record create form** — the UI in `staff/[userId]/page.tsx` shows the disciplinary tab but there is no "Add Record" form/modal yet. Only display is implemented.
6. **Document upload UI** — the Documents tab displays files but there is no upload button/form in the frontend yet.
7. **HR Manager account in seed** — no seed script creates an HR_MANAGER user. Must be created via System Admin UI or directly in DB.
8. **`LeaveTab.tsx` filter** — currently calls `listLeaveRequests({ page:1, limit:50 })` and then filters client-side by `employeeProfile.user.id === userId`. Should ideally pass `userId` as a query param to the backend instead.

---

## Comms Integration Summary

| Capability | HR_MANAGER |
|---|---|
| Receive DMs | ✅ (in `ALL_HUMAN_ROLES`) |
| Receive broadcasts | ✅ |
| Send broadcasts | ✅ (alongside MANAGER, DIRECTOR) |
| Issue formal notices | ✅ (alongside DIRECTOR only) |
| Leave request FCM push | ✅ (notified when staff submits) |
| Leave decision FCM push | ✅ (staff notified on approve/reject) |
| Disciplinary notice FCM push | ✅ (staff notified on record creation) |
| Inbox nudge on HR overview page | ✅ (`InboxNudge` rendered below `PageHeader` in `/app/hr`) |
| Arrival toast | ✅ (mounted in app shell via `useMessageToast`) |
| Nav badge on Inbox tab | ✅ (sidebar + mobile bottom nav show unread count) |

---

## Attendance Analytics

Added as a post-initial-build feature. No schema changes or migrations required — queries join existing `ShiftAssignment` and `ClockRecord` tables.

### Design

- **Route:** `/app/hr/attendance` — top-level HR section alongside Staff Profiles and Leave
- **Access:** `HR_MANAGER`, `DIRECTOR`, `SYSTEM_ADMIN`, `MANAGER` (MANAGER scoped to own branch in service layer)
- **Three zones:**
  1. **Filter bar** — preset pills (This Week / This Month / Last Month) + custom date range + Branch dropdown (multi-branch roles) + Staff dropdown + Export CSV
  2. **Summary bar** — 4 stat chips: Days Scheduled, Days Present, Absences, Attendance Rate. Rate color: green ≥ 85%, amber ≥ 70%, red < 70%
  3. **Staff table** — one row per staff member; `⚠` warning icon on Rate column when < 85%; click row → drill-down drawer
- **Drill-down drawer** — slides in from right; shows per-person summary strip (Scheduled / Present / Absent / Late / Rate) + day-by-day table (Date, Shift, Clock In, Clock Out, Status badge)
- **Status logic:** LATE = clock-in > 15 min after shift start; ABSENT = assigned shift with no clock record; rows only include scheduled days (no-shift days are not shown as absences)
- **CSV export** — downloads `attendance_STARTDATE_ENDDATE.csv` with Name, Role, Branch, Scheduled, Present, Absent, Late, Attendance%
- **HR Overview widget** (`/app/hr`) — "This Week's Attendance" card shows org-wide rate as large number + breakdown: ✅ N days present / ❌ N absences / 🟡 N late arrivals / "View full →" link

### Late threshold
`LATE_THRESHOLD_MINUTES = 15` — defined as a constant in `backend/src/repositories/hr-repository.ts`

### Backend files changed
| File | Change |
|---|---|
| `backend/src/repositories/hr-repository.ts` | Added `getAttendanceSummary()` and `getStaffAttendanceDetail()` |
| `backend/src/services/hr-service.ts` | Added `getAttendanceSummary()` and `getStaffAttendanceDetail()` with MANAGER branch scoping |
| `backend/src/controllers/hr-controller.ts` | Added `getAttendanceSummary` and `getStaffAttendanceDetail` handlers |
| `backend/src/routes/hr-routes.ts` | Added `GET /hr/attendance` and `GET /hr/attendance/:userId` (both `HR_AND_MANAGER`) — registered before other parameterized routes |
| `backend/src/validators/hr-schemas.ts` | Added `attendanceSummaryQuerySchema` and `attendanceDetailQuerySchema` |

### Frontend files changed
| File | Change |
|---|---|
| `frontend/types/hr.ts` | Added `AttendanceStaffRow`, `AttendanceDayRow`, `AttendanceSummaryFilters` |
| `frontend/services/hrService.ts` | Added `getAttendanceSummary()` and `getStaffAttendanceDetail()` |
| `frontend/app/app/hr/attendance/page.tsx` | New page — full attendance analytics UI |
| `frontend/app/app/hr/page.tsx` | Added attendance snapshot widget + `getAttendanceSummary` call on load |
| `frontend/app/app/layout.tsx` | Added `{ label: 'Attendance', href: '/app/hr/attendance', icon: BarChart2 }` to HR_MANAGER sidebar section and overflow tabs |

### Key query logic (repository)
```
getAttendanceSummary: groups ShiftAssignment by userId, LEFT JOINs clockRecord
  scheduled = COUNT(assignments)
  present   = COUNT(assignments WHERE clockRecord.clockInAt IS NOT NULL)
  absent    = scheduled - present
  late      = COUNT(present WHERE clockInAt > shiftStart + 15min)
  rate      = ROUND((present / scheduled) * 100)

getStaffAttendanceDetail: returns one row per assignment for a given userId
  includes: date, shiftId, shiftName, shiftStart, shiftEnd,
            clockInAt, clockOutAt, status (PRESENT|LATE|ABSENT), minutesLate
```
