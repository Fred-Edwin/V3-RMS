# Phase 5 - Context (Living File)

This file captures implementation and verification for Phase 5 (Staff Management), including backend APIs, geofenced clock flows, reminder jobs, and staff/manager UI delivery.

---

## Status
- [x] Phase 5 In Progress
- [x] Phase 5 Complete

---

## Completed Tasks
### Backend - Shift Definitions
- [x] Added shift repository `backend/src/repositories/shift-repository.ts` with list/get/create/update/soft-delete/future-assignment guard helpers.
- [x] Added shift service/controller/routes:
  - `backend/src/services/shift-service.ts`
  - `backend/src/controllers/shift-controller.ts`
  - `backend/src/routes/shift-routes.ts`
- [x] Registered shift routes in `backend/src/routes/index.ts`.

### Backend - Shift Assignments
- [x] Added shift assignment repository `backend/src/repositories/shift-assignment-repository.ts` with branch-scoped reads, user-scoped reads, create, and delete.
- [x] Added assignment service/controller/routes:
  - `backend/src/services/shift-assignment-service.ts`
  - `backend/src/controllers/shift-assignment-controller.ts`
  - `backend/src/routes/shift-assignment-routes.ts`
- [x] Enforced duplicate protection and delete guard (`assignment.date <= today` blocked).
- [x] Enforced assignable staff roles (`WAITER`, `CHEF`, `BARISTA`) for manager assignment creation.

### Backend - Clock Records and Geofencing
- [x] Added clock record repository `backend/src/repositories/clock-record-repository.ts`.
- [x] Added haversine utility + tests:
  - `backend/src/utils/haversine.ts`
  - `backend/src/utils/haversine.test.ts`
- [x] Added clock service/controller/routes:
  - `backend/src/services/clock-service.ts`
  - `backend/src/controllers/clock-controller.ts`
  - `backend/src/routes/clock-routes.ts`
- [x] Implemented geofence enforcement (50m radius) with 403 responses containing approximate distance in metres.
- [x] Implemented manager override flow with required reason and OVERRIDE clock methods.

### Backend - Validation and Jobs
- [x] Added Phase 5 Zod schemas in `backend/src/validators/shift-schemas.ts`.
- [x] Added date helper utility `backend/src/utils/date-only.ts`.
- [x] Added nightly shift reminder job:
  - `backend/src/jobs/shift-reminder.ts`
  - `backend/src/jobs/workers.ts` integration
  - `backend/src/services/fcm-service.ts` shift reminder push support

### Frontend - Services, Types, and Pages
- [x] Added typed shift service + models:
  - `frontend/services/shiftService.ts`
  - `frontend/types/shift.ts`
- [x] Replaced manager shifts page with full workflow UI:
  - `frontend/app/app/manage/shifts/page.tsx`
  - Shift definitions table + create/edit/delete modal flows
  - Weekly schedule with assign/remove actions and week navigation
  - Daily attendance table with GPS/Override indicator and override modal
- [x] Replaced staff shifts page:
  - `frontend/app/app/shifts/page.tsx`
  - Upcoming 7 days + attendance history (past 30 days)
- [x] Added reusable clock widget:
  - `frontend/components/shifts/ClockWidget.tsx`
  - Integrated into dashboard and shifts page
- [x] Updated navigation and clock route:
  - `frontend/app/app/layout.tsx` (Shifts nav entry for staff roles)
  - `frontend/app/app/clock/page.tsx` (redirect to `/app/shifts`)
  - `frontend/app/app/dashboard/page.tsx` (today clock widget for WAITER/CHEF/BARISTA)

### Tests Added
- [x] `backend/src/utils/haversine.test.ts`
- [x] `backend/tests/shift.test.ts`
- [x] `backend/tests/shift-assignment.test.ts`
- [x] `backend/tests/clock.test.ts`

### Documentation Updates
- [x] Added this phase context file: `docs/context/PHASE_5_CONTEXT.md`.
- [x] Updated `docs/API_CONTRACT.md` Phase 5 section (`DELETE /shifts/:id` and director query semantics).
- [ ] `AGENTS.md` phase pointer is still on Phase 3 and should be updated in a follow-up docs-only pass.

---

## Decisions Made
- Shift definitions are soft-deleted (`isActive = false`) instead of hard-deleted.
- Shift deletion is blocked when future assignments exist for that shift.
- Assignment deletion is blocked for today and past dates to preserve attendance integrity.
- Geofence verification is server-side only; client GPS is advisory input.
- Override attendance is explicitly marked using `ClockMethod.OVERRIDE` and always captures an override reason.
- Shift reminder dispatch groups one notification per user for tomorrow's earliest shift assignment.

---

## Verification Evidence
- [x] `pnpm --dir backend test -- tests/shift.test.ts tests/shift-assignment.test.ts tests/clock.test.ts src/utils/haversine.test.ts`
- [x] `pnpm --dir backend build`
- [x] `pnpm --dir frontend typecheck`
- [x] `pnpm --dir frontend build`

---

## Blockers / Issues
- No blocking implementation issues remain for Phase 5.
- Non-failing `ioredis` connection warnings can appear during tests in environments where Redis is not running.

---

## Post-Review Production Hardening (applied after Phase 6)

The following issues were identified during a production readiness review and fixed:

### Fix 1 & 2 — Timezone: `getTodayDateOnly()` and `hasFutureAssignments` used server local time
- **Problem**: `getTodayDateOnly()` in `backend/src/utils/date-only.ts` used `new Date().getFullYear()` etc., which returns the server's local date. On UTC servers, between midnight UTC and 3am UTC (midnight–3am EAT gap), all "today" comparisons were wrong — blocking valid clock-ins and allowing invalid assignment deletions.
- `shift-repository.ts` had its own `getTodayStart()` with the same bug.
- **Fix**: Replaced `getTodayDateOnly()` with `Intl.DateTimeFormat` using `timeZone: 'Africa/Nairobi'`. Removed the duplicate `getTodayStart()` from `shift-repository.ts` and replaced with the shared `getTodayDateOnly()`.
- **Files changed**: `backend/src/utils/date-only.ts`, `backend/src/repositories/shift-repository.ts`

### Fix 3 — Race condition on concurrent clock-in
- **Problem**: Clock-in did read-then-write without catching the unique constraint on `shiftAssignmentId`. Double-tap or network retry could cause two concurrent requests to pass the existence check and the second would fail with an unhandled Prisma `P2002` error (500 Internal Server Error).
- **Fix**: Wrapped `createClockIn` calls in both `clockIn` and `clockOverride` with a `PrismaClientKnownRequestError` catch for code `P2002`, re-throwing as `ConflictError` (409).
- **File changed**: `backend/src/services/clock-service.ts`

### Fix 4 — Override button visible on completed attendance
- **Problem**: The "Override" button in the manager attendance table was always shown, even when a staff member had already clocked in and out (shift complete). Clicking it returned a 409 from the API but the UX was confusing.
- **Fix**: Replaced button with "Complete" text when `clockRecord.clockInAt && clockRecord.clockOutAt`.
- **File changed**: `frontend/app/app/manage/shifts/page.tsx`

### Fix 5 — "Remove" link visible on today/past assignments in weekly grid
- **Problem**: The "Remove" link appeared on all assignments including today and past dates. The backend correctly rejected deletion, but the UI should prevent the attempt.
- **Fix**: Only render the Remove link when `dateKey > todayDateKey`.
- **File changed**: `frontend/app/app/manage/shifts/page.tsx`

### Fix 6 (cosmetic) — `formatClockMethod` referenced stale enum values
- **Problem**: Staff shifts history page checked for `'GEOFENCE'` and `'MANUAL'` but actual enum values are `'GPS'` and `'OVERRIDE'`, causing raw enum strings to display.
- **Fix**: Updated string checks to match the actual `ClockMethod` enum.
- **File changed**: `frontend/app/app/shifts/page.tsx`

### Fix 7 — Shift overlap detection for same user same day
- **Problem**: A staff member could be assigned to two overlapping shifts on the same day (e.g., "Morning 06:00–14:00" and "Mid-Morning 10:00–18:00"). The unique constraint only prevented the *same* shift twice.
- **Fix**: Added time-range overlap check in `createAssignment()` — queries existing assignments for the user on the target date and compares `startTime`/`endTime` ranges. Returns 409 with descriptive message naming both conflicting shifts.
- **File changed**: `backend/src/services/shift-assignment-service.ts`

### Fix 8 — Weekly grid only showed one shift per user per day
- **Problem**: The `assignmentsBySlot` map used `userId|date` as key, so if a user had two non-overlapping shifts on the same day (e.g., "Morning" + "Evening"), only the last one was displayed.
- **Fix**: Changed map value from `ShiftAssignment` to `ShiftAssignment[]`. Updated grid cell rendering to iterate over the array. Also shows "+ Assign" button below existing assignments on future dates.
- **File changed**: `frontend/app/app/manage/shifts/page.tsx`

### Fix 9 — order-service.test.ts missing `emitOrderClosed` mock
- **Problem**: Pre-existing test failure — `socketService.emitOrderClosed` was called in the service but not mocked in the test file, causing a `TypeError: socketService.emitOrderClosed is not a function`.
- **Fix**: Added `emitOrderClosed: vi.fn()` to the socket service mock.
- **File changed**: `backend/src/services/order-service.test.ts`

### Verification
- [x] `pnpm --dir backend build` — passes
- [x] `pnpm --dir backend test` — **all 122 tests pass (24 files, 0 failures)**
- [x] `pnpm --dir frontend typecheck` — passes
- [x] `pnpm --dir frontend build` — passes

### Fix 10 — Clock-out stale-write protection
- **Problem**: `clockOut` still used a read-then-write flow without guarding on `clockOutAt = null`, so concurrent/retried clock-out requests could overwrite each other.
- **Fix**: `clockRecordRepository.updateClockOut()` now updates only open records and the service returns a deterministic `CLOCK_STALE_STATE` conflict when another request wins first.
- **Files changed**: `backend/src/repositories/clock-record-repository.ts`, `backend/src/services/clock-service.ts`

### Fix 11 — Manager override could create a second open shift
- **Problem**: Manager `CLOCK_IN` override checked only the target assignment and could create a second open clock record while the same staff member was already clocked into another shift.
- **Fix**: Override clock-in now enforces the same single-open-record rule as normal staff clock-in and returns `CLOCK_ALREADY_IN` with the open assignment id in structured details.
- **Files changed**: `backend/src/services/clock-service.ts`

### Fix 12 — Structured clock error contract
- **Problem**: Frontend attendance UX had to parse free-text error messages to detect distance and could not reliably distinguish GPS failures from attendance conflicts.
- **Fix**: Clock endpoints now return stable error codes/details for geofence rejections, invalid assignments, already-in/out states, and stale updates. Frontend `ApiError` now preserves `details`.
- **Files changed**: `backend/src/utils/errors.ts`, `backend/src/middleware/error-handler.ts`, `frontend/types/api.ts`, `frontend/lib/apiClient.ts`

### Fix 13 — Staff clock UX redesigned for reliability
- **Problem**: Staff clocking assumed only one shift per day, collapsed most failures into a generic GPS message, and used UTC date strings in some screens.
- **Fix**:
  - clock widget now supports multiple same-day shifts explicitly
  - dashboard and shifts page now use Nairobi business-date utilities
  - geofence, permission-denied, timeout, unavailable-location, already-in/out, and stale-state errors now show distinct guidance
- **Files changed**: `frontend/components/shifts/ClockWidget.tsx`, `frontend/app/app/dashboard/page.tsx`, `frontend/app/app/shifts/page.tsx`, `frontend/lib/date.ts`

### Fix 14 — Manager override UX redesigned
- **Problem**: Override modal asked managers to choose `CLOCK_IN` vs `CLOCK_OUT` manually even when the current row state already determined the only valid action.
- **Fix**: Attendance table now opens the modal with the valid action only, labels the CTA explicitly (`Override Clock In` / `Override Clock Out`), and uses guided reason options plus optional notes.
- **Files changed**: `frontend/app/app/manage/shifts/page.tsx`

### Additional Verification
- [x] `pnpm --dir backend test -- tests/clock.test.ts src/services/clock-service.test.ts`
- [x] `pnpm --dir backend exec tsc -p tsconfig.json`
- [x] `pnpm --dir frontend typecheck`
- [x] `pnpm --dir frontend build`
- [ ] `pnpm --dir backend build` — blocked in this run by a local Windows Prisma query-engine file lock during `prisma generate`, not by TypeScript errors

---

## Staff Account Management Improvements (applied after Phase 6)

Managers previously had no proper way to edit staff accounts (used `window.prompt()`), could not edit emails, reset passwords, or permanently delete accounts.

### Backend Changes

#### New Endpoints
- `PATCH /staff/:id/reset-password` — Manager/SystemAdmin resets a staff member's password, revokes all refresh tokens (forces re-login)
- `DELETE /staff/:id` — Manager/SystemAdmin permanently deletes a staff account if no orders, shift assignments, or clock records are linked (returns 409 with dependency counts otherwise)

#### Updated Endpoints
- `PATCH /staff/:id` — Now accepts `email` in addition to `name` and `phone`, with uniqueness check (409 if taken by another user)

#### Files Changed
- `backend/src/validators/staff-schemas.ts` — Added `email` to `updateStaffSchema`, added `resetPasswordSchema`
- `backend/src/repositories/staff-repository.ts` — Widened `update()` for email, added `updatePassword()`, `countDependencies()`, `hardDelete()`
- `backend/src/services/staff-service.ts` — Email uniqueness check on update, `resetPassword()` (hashes + revokes sessions), `hardDeleteStaff()` (blocks if dependencies exist)
- `backend/src/controllers/staff-controller.ts` — Added `resetPassword` and `hardDelete` handlers
- `backend/src/routes/staff-routes.ts` — Two new routes (MANAGER, SYSTEM_ADMIN)

### Frontend Changes
- `frontend/services/staffService.ts` — Added `email` to `UpdateStaffInput`, added `resetPassword()` and `deleteStaff()` methods
- `frontend/app/app/manage/staff/page.tsx` — Replaced `window.prompt()` with three proper modals:
  1. **Edit Staff Modal** — form with name, email, phone inputs
  2. **Reset Password Modal** — single password field with session invalidation warning
  3. **Delete ConfirmDialog** — destructive confirmation explaining dependency blocking

### Design Decisions
- Hard delete blocks if orders, shifts, or clock records exist — no cascade
- Password reset invalidates all sessions via `deleteAllRefreshTokensByUserId`
- Role editing not supported (create new account instead)

### Tests Added
- `backend/tests/staff.test.ts` — 6 new tests: email update (200), duplicate email (409), reset password (200), reset password unauthorized (403), delete no deps (200), delete with deps (409)

### Verification
- [x] `pnpm --dir backend build` — passes
- [x] `pnpm --dir backend test` — **all 128 tests pass (24 files, 0 failures)**
- [x] `pnpm --dir frontend typecheck` — passes
- [x] `pnpm --dir frontend build` — passes

---

## Weekly Schedule UI Refinement (applied after staff account improvements)

Redesigned the manager weekly schedule grid for a more polished, premium look while preserving all existing functionality.

### Visual Changes
- **Color-coded shift cards** — Each shift definition gets a distinct warm color (amber, orange, green, blue, purple) with a left border accent, matching the order card pattern from the design system
- **Today column** — Highlighted with crema background and the day number in an espresso-filled circle
- **Staff column** — Avatar initials with role-specific color coding + small role badge
- **Past dates** — Subtly dimmed with `bg-stone-50/40`
- **Weekend columns** — Lightly tinted to visually separate work week
- **Remove button** — Hidden by default, appears as a small red circle on hover (cleaner than the old text link)
- **Assign buttons** — Dashed border placeholder that appears on hover for empty cells, compact `+` button when shifts already exist
- **Shift legend** — Color-keyed footer strip showing all shift definitions
- **Sticky staff column** — Stays visible when scrolling horizontally

### Files Changed
- `frontend/app/app/manage/shifts/page.tsx` — Weekly schedule section rewritten

### Verification
- [x] `pnpm --dir frontend typecheck` — passes
- [x] `pnpm --dir frontend build` — passes

---

## Notes for Next Phase (Phase 6)
- If Phase 6 introduces payroll/attendance analytics, reuse `ShiftAssignment` + `ClockRecord` as the source of truth.
- Preserve branch-level role scoping when expanding director-wide reporting over shift data.
- Consider adding end-to-end tests for browser geolocation and clock widget UX states.
