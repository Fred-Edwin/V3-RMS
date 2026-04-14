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
- HR Dashboard (stat cards + pending requests + on-leave-today + probation alerts)
- Staff self-service My Leave page

Features explicitly deferred:
- Maternity / paternity leave types
- Payroll integration

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
| `frontend/app/app/hr/page.tsx` | HR Dashboard (stat cards, pending leave approval, on-leave-today, probation alerts) |
| `frontend/app/app/hr/staff/page.tsx` | Staff Profiles list + create profile modal |
| `frontend/app/app/hr/staff/[userId]/page.tsx` | Employee profile detail — 4 tabs: Overview, Leave, Disciplinary, Documents |
| `frontend/app/app/hr/staff/[userId]/LeaveTab.tsx` | Leave balance pills + leave history |
| `frontend/app/app/hr/my-leave/page.tsx` | Staff self-service leave page (mobile-first) |
| `frontend/app/app/hr/leave/page.tsx` | Manager leave requests — status tabs, type filter, inline approve/reject |
| `frontend/app/app/hr/leave/calendar/page.tsx` | Monthly calendar grid with colour-coded leave bars |

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

## Known Issues / Refinements Needed (for next session)

These are items identified during build but not yet tested or confirmed fixed:

1. **My Leave page not linked from staff mobile nav** — `/app/hr/my-leave` exists but is not in `mobileRoleTabs` for WAITER/CHEF/BARISTA. Needs a nav entry (e.g. in overflow tabs).
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
