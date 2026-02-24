# Phase 5 — Staff Management: Implementation Plan

## Feature Understanding

Phase 5 introduces three tightly coupled sub-features:

1. **Shift Definitions** — Manager creates named time bands (e.g. "Morning 06:00–14:00"). These are branch-scoped templates reused across all scheduling weeks.

2. **Shift Scheduling** — Manager assigns staff to a shift on a specific date. The result is a `ShiftAssignment` row (`userId + shiftId + date`). Duplicate assignments (same user + shift + date) are rejected. Future assignments can be deleted; past/today assignments cannot. The manager views a weekly calendar of all assignments and a daily attendance view showing actual clock-in/out times.

3. **Clock In/Out with Geofencing** — Staff clock in/out via a GPS request in the browser. The server receives coordinates, fetches the branch's `latitude`/`longitude` from the `Organization` record, runs a Haversine distance check, and rejects with `403` + distance-in-metres if the staff member is more than 50 m away. A successful clock-in/out writes a `ClockRecord` linked to the `ShiftAssignment`. Managers can override clock-in/out for staff when GPS is unavailable — this creates a `ClockRecord` with `method = OVERRIDE` and an `overrideNote`. Staff cannot be double-clocked-in (409 if a `ClockRecord` already exists without a `clockOutAt`).

4. **BullMQ Shift Reminder** — Nightly at 21:00 a job queries all `ShiftAssignment` rows for tomorrow across all branches, and queues one FCM push notification per staff member.

5. **Staff Views** — Staff see their upcoming 7-day schedule and past 30-day attendance history on `/app/shifts`. The dashboard shows today's shift card with live clock-in state. Clock In/Out buttons are inline on the shift card.

**Key invariants:**
- All repository queries are `organizationId`-scoped.
- `ClockMethod` enum values: `GPS`, `OVERRIDE`.
- `DELETE /shift-assignments/:id` is blocked if `assignment.date <= today`.
- `DELETE /shifts/:id` is blocked if future assignments reference the shift.
- Geofence radius: 50 metres.
- `Branch.latitude` / `Branch.longitude` are stored as `Decimal(10,7)` on the `Organization` model — `branchRepository.findById` already returns them.

---

## Numbered Task List

### Backend — Repository

1. Create `backend/src/repositories/shift-repository.ts` with:
   - `findAllByOrganization(organizationId)` — all shifts for branch, ordered by `startTime`
   - `findById(id, organizationId)` — single shift scoped to org
   - `create(organizationId, data: { name, startTime, endTime })` → `Shift`
   - `update(id, organizationId, data: { name?, startTime?, endTime? })` → `Shift | null`
   - `hasFutureAssignments(id)` — returns `boolean`; true if any `ShiftAssignment` exists with `date > today` for this shiftId
   - `softDelete(id, organizationId)` — sets `isActive = false`

2. Create `backend/src/repositories/shift-assignment-repository.ts` with:
   - `findByOrganizationAndDateRange(organizationId, startDate, endDate, filters?: { userId?, shiftId? })` — returns assignments with joined `shift`, `user`, and `clockRecord`
   - `findByUserAndDateRange(userId, organizationId, startDate, endDate)` — staff's own assignments (same joins)
   - `findById(id, organizationId)` — single assignment with joins
   - `create(organizationId, data: { userId, shiftId, date })` → `ShiftAssignment`
   - `delete(id, organizationId)` — hard delete (caller guards date constraint)

3. Create `backend/src/repositories/clock-record-repository.ts` with:
   - `findByAssignmentId(shiftAssignmentId)` → `ClockRecord | null`
   - `findOpenByUserId(userId, organizationId)` → `ClockRecord | null` (clockInAt set, clockOutAt null)
   - `createClockIn(organizationId, data: { shiftAssignmentId, userId, method, overrideNote? })` → `ClockRecord`
   - `updateClockOut(id, data: { clockOutAt, clockOutMethod, overrideNote? })` → `ClockRecord`

---

### Backend — Utility

4. Create `backend/src/utils/haversine.ts`:
   - Export `haversineDistance(lat1, lon1, lat2, lon2): number` — returns distance in metres
   - Use the standard Haversine formula with Earth radius 6371000 m
   - Export unit test alongside: `backend/src/utils/haversine.test.ts`
     - Known pair: Nyeri town centre ↔ 1 km north → ~1000 m (±5 m)
     - Same point → 0

---

### Backend — Validators

5. Create `backend/src/validators/shift-schemas.ts` with Zod schemas:
   - `CreateShiftSchema`: `{ name: string (min 1, max 100), startTime: string (HH:MM regex), endTime: string (HH:MM regex) }`
   - `UpdateShiftSchema`: all fields optional
   - `CreateShiftAssignmentSchema`: `{ userId: uuid, shiftId: uuid, date: YYYY-MM-DD string }`
   - `ShiftAssignmentQuerySchema`: `{ startDate: YYYY-MM-DD (required), endDate: YYYY-MM-DD (required), userId?: uuid, shiftId?: uuid }`
   - `ClockInOutSchema`: `{ latitude: number (min -90, max 90), longitude: number (min -180, max 180), shiftAssignmentId: uuid }`
   - `ClockOverrideSchema`: `{ userId: uuid, shiftAssignmentId: uuid, action: enum('CLOCK_IN','CLOCK_OUT'), reason: string (min 1, max 500) }`
   - Export all inferred types

---

### Backend — Services

6. Create `backend/src/services/shift-service.ts`:
   - `listShifts(actor)` → calls `shiftRepository.findAllByOrganization(actor.organizationId)`
   - `createShift(actor, input)` → creates shift; throws `ValidationError` if `startTime >= endTime`
   - `updateShift(actor, id, input)` → updates; throws `NotFoundError` if not found
   - `deleteShift(actor, id)` → calls `hasFutureAssignments`; throws `ConflictError` if true; else soft-deletes

7. Create `backend/src/services/shift-assignment-service.ts`:
   - `listAssignments(actor, query)`:
     - If `actor.role === 'MANAGER' || 'DIRECTOR'`: call `findByOrganizationAndDateRange` (optionally filtered by `userId` / `shiftId`)
     - Otherwise: call `findByUserAndDateRange` (ignores `userId` filter — always own data)
   - `createAssignment(actor, input)`:
     - Verifies `userId` belongs to `actor.organizationId` using `staffRepository`
     - Calls `shiftRepository.findById` to verify shift belongs to same org
     - Calls `shiftAssignmentRepository.create`; on Prisma unique constraint violation → `ConflictError('Staff member already assigned to this shift on this date')`
   - `deleteAssignment(actor, id)`:
     - Fetches assignment; throws `NotFoundError` if missing
     - Throws `ValidationError('Cannot delete past or current shift assignments')` if `assignment.date <= today`
     - Calls `shiftAssignmentRepository.delete`

8. Create `backend/src/services/clock-service.ts`:
   - `clockIn(actor, input: { latitude, longitude, shiftAssignmentId })`:
     1. Fetch `ShiftAssignment` — must belong to `actor.userId` and have `date === today`; else `NotFoundError`
     2. Check `clockRecordRepository.findOpenByUserId` — if exists → `ConflictError('Already clocked in')`
     3. Fetch branch via `branchRepository.findById(actor.organizationId)`
     4. `distance = haversineDistance(input.lat, input.lng, branch.latitude, branch.longitude)`
     5. If `distance > 50` → `ForbiddenError('You must be at the branch to clock in. You are approximately X metres away.')`
     6. Call `clockRecordRepository.createClockIn` with `method = 'GPS'`
   - `clockOut(actor, input: { latitude, longitude, shiftAssignmentId })`:
     1. Fetch `ShiftAssignment` — same ownership check
     2. Fetch open clock record; if none → `ConflictError('Not currently clocked in')`
     3. Geofence check (same as clockIn)
     4. Call `clockRecordRepository.updateClockOut` with `method = 'GPS'`
   - `clockOverride(actor, input: { userId, shiftAssignmentId, action, reason })`:
     - `actor` must be MANAGER
     - Fetch `ShiftAssignment` — must belong to `input.userId` within `actor.organizationId`
     - If `action === 'CLOCK_IN'`: check not already clocked in → create with `method = 'OVERRIDE'`, `overrideNote = reason`
     - If `action === 'CLOCK_OUT'`: fetch open record → update `clockOutAt = now()`, `clockOutMethod = 'OVERRIDE'`, `overrideNote = reason`
     - Return record with affected staff member name in response message

---

### Backend — Controllers

9. Create `backend/src/controllers/shift-controller.ts` — thin handlers:
   - `listShifts`, `createShift`, `updateShift`, `deleteShift`

10. Create `backend/src/controllers/shift-assignment-controller.ts` — thin handlers:
    - `listAssignments`, `createAssignment`, `deleteAssignment`

11. Create `backend/src/controllers/clock-controller.ts` — thin handlers:
    - `clockIn`, `clockOut`, `clockOverride`

---

### Backend — Routes

12. Create `backend/src/routes/shift-routes.ts`:
    - `GET /shifts` — `authenticate, branchScope, requireRole('MANAGER','DIRECTOR')`
    - `POST /shifts` — `authenticate, branchScope, requireRole('MANAGER')`
    - `PATCH /shifts/:id` — `authenticate, branchScope, requireRole('MANAGER')`
    - `DELETE /shifts/:id` — `authenticate, branchScope, requireRole('MANAGER')`

13. Create `backend/src/routes/shift-assignment-routes.ts`:
    - `GET /shift-assignments` — `authenticate, branchScope, requireRole('MANAGER','WAITER','CHEF','BARISTA','DIRECTOR')`
    - `POST /shift-assignments` — `authenticate, branchScope, requireRole('MANAGER')`
    - `DELETE /shift-assignments/:id` — `authenticate, branchScope, requireRole('MANAGER')`

14. Create `backend/src/routes/clock-routes.ts`:
    - `POST /clock/in` — `authenticate, branchScope, requireRole('WAITER','CHEF','BARISTA')`
    - `POST /clock/out` — `authenticate, branchScope, requireRole('WAITER','CHEF','BARISTA')`
    - `POST /clock/override` — `authenticate, branchScope, requireRole('MANAGER')`

15. Register all three new route files in `backend/src/routes/index.ts`

---

### Backend — BullMQ Shift Reminder Job

16. Create `backend/src/jobs/shift-reminder.ts`:
    - Export `scheduleShiftReminders(queue: Queue)` — queries all `ShiftAssignment` rows where `date = tomorrow` across all organizations using Prisma (no org scope — this is a system-level job)
    - For each assignment: enqueue a job `{ name: 'shift-reminder', data: { userId, shiftName, startTime, date } }` to the `notifications` queue

17. Update `backend/src/jobs/workers.ts`:
    - Add a `shiftReminderScheduler` — uses `QueueScheduler` or `Queue` with `repeat: { cron: '0 21 * * *' }` (9pm nightly) to invoke `scheduleShiftReminders`
    - The `notificationWorker` already exists — add handling for `job.name === 'shift-reminder'` to call `fcmService.sendToUser(userId, { title, body })`

---

### Backend — Tests

18. Create `backend/src/utils/haversine.test.ts` (unit):
    - Known pair → correct distance (±5 m tolerance)
    - Same point → 0

19. Create `backend/tests/shift.test.ts` (integration):
    - `POST /shifts` — manager creates → 201
    - `POST /shifts` — WAITER role → 403
    - `GET /shifts` — returns shifts for branch only
    - `PATCH /shifts/:id` — updates fields
    - `DELETE /shifts/:id` — no future assignments → 200; has future assignments → 409

20. Create `backend/tests/shift-assignment.test.ts` (integration):
    - `POST /shift-assignments` — manager assigns staff → 201
    - `POST /shift-assignments` — duplicate → 409
    - `GET /shift-assignments` — WAITER sees only own assignments; MANAGER sees all for branch
    - `DELETE /shift-assignments/:id` — future date → 200; today/past date → 400

21. Create `backend/tests/clock.test.ts` (integration):
    - `POST /clock/in` — within 50 m → 201 with `clockInMethod: 'GPS'`
    - `POST /clock/in` — outside 50 m → 403 with distance in message
    - `POST /clock/in` — already clocked in → 409
    - `POST /clock/out` — not clocked in → 409
    - `POST /clock/out` — within 50 m → 200 with `clockOutAt` set
    - `POST /clock/override` — manager CLOCK_IN for staff → 201 with `clockInMethod: 'OVERRIDE'`

---

### Frontend — Services

22. Create `frontend/services/shiftService.ts`:
    - Types: `Shift`, `ShiftAssignment` (with nested `shift`, `user`, `clockRecord`), `ClockRecord`
    - `listShifts(token)` → `GET /shifts`
    - `createShift(data, token)` → `POST /shifts`
    - `updateShift(id, data, token)` → `PATCH /shifts/:id`
    - `deleteShift(id, token)` → `DELETE /shifts/:id`
    - `listAssignments(params, token)` → `GET /shift-assignments?startDate=&endDate=&...`
    - `createAssignment(data, token)` → `POST /shift-assignments`
    - `deleteAssignment(id, token)` → `DELETE /shift-assignments/:id`
    - `clockIn(data: { latitude, longitude, shiftAssignmentId }, token)` → `POST /clock/in`
    - `clockOut(data: { latitude, longitude, shiftAssignmentId }, token)` → `POST /clock/out`
    - `clockOverride(data, token)` → `POST /clock/override`

---

### Frontend — Manager: Shift Management Page (`/app/manage/shifts`)

23. Replace the stub `frontend/app/app/manage/shifts/page.tsx` with a full management page containing three sections (use tabs or stacked sections):

    **Section A — Shift Definitions**
    - `Table`: Name, Start Time, End Time, Actions (Edit / Delete)
    - "Add Shift" Button → Modal: Name `Input`, Start Time `Input` (HH:MM), End Time `Input` (HH:MM)
    - Edit: pre-filled Modal → `PATCH`
    - Delete: `ConfirmDialog` → `DELETE`; show `ConflictError` as Toast if future assignments exist
    - Loading: `SkeletonTable`; Empty: `EmptyState`

    **Section B — Weekly Schedule**
    - Week navigation: Previous / Next `IconButton` + current week label (e.g. "24 Feb – 2 Mar")
    - Grid: rows = staff members, columns = days of week (Mon–Sun)
    - Each cell: shift name + role `Badge` (if assigned), else `+` add button
    - Assign: click `+` → modal with date (pre-filled), Shift `Select`, Staff `Select` → `POST /shift-assignments`
    - Remove assignment: click cell → `ConfirmDialog` → `DELETE /shift-assignments/:id`
    - Load assignments for current week using `GET /shift-assignments?startDate=&endDate=`

    **Section C — Today's Attendance**
    - Load `GET /shift-assignments?startDate=today&endDate=today`
    - `Table`: Staff name, Role, Shift, Clock-in time, Clock-out time, Method (GPS `Icon` / OVERRIDE `Icon`)
    - OVERRIDE: show `overrideNote` in a `Popover` on the icon
    - Not yet clocked in: dash with muted text
    - "Override" `Button` per row → `ClockOverrideModal`: pre-filled userId + assignmentId, Action dropdown (CLOCK_IN / CLOCK_OUT), Reason `Input`

---

### Frontend — Staff: Shifts Page (`/app/shifts`)

24. Replace the stub `frontend/app/app/shifts/page.tsx` with:

    **Upcoming Shifts (next 7 days)**
    - Load `GET /shift-assignments?startDate=today&endDate=today+7`
    - One `Card` per day: date label, shift name, start–end time
    - Today's card: highlighted border; show clock-in state inline (clocked-in time if available)
    - Empty state: `EmptyState` — "No upcoming shifts scheduled"

    **Attendance History (past 30 days)**
    - Load `GET /shift-assignments?startDate=today-30&endDate=yesterday`
    - List rows: date, shift name, clock-in time, clock-out time, method badge (GPS / OVERRIDE)
    - Empty state: "No attendance history yet"

---

### Frontend — Clock In/Out Widget

25. Create `frontend/components/shifts/ClockWidget.tsx`:
    - Props: `assignment: ShiftAssignment | null`
    - If `assignment === null`: `EmptyState` — "No shift today"
    - If `clockRecord` has `clockInAt` and no `clockOutAt`: show clocked-in time + "Clock Out" `Button` (Primary)
    - If fully clocked out: show both times, no button
    - Otherwise: show shift name + "Clock In" `Button` (Primary)
    - Button click:
      1. Call `navigator.geolocation.getCurrentPosition`
      2. On success: call `shiftService.clockIn` / `clockOut`
      3. On GPS error: show Toast — "Location unavailable — ask your manager to clock you in"
      4. On geofence error (403): parse distance from message and show Toast — "You're Xm from the branch. Move closer to clock in."
    - Loading state during GPS acquisition and API call

26. Integrate `ClockWidget` into the staff dashboard page (`frontend/app/app/dashboard/page.tsx`):
    - Fetch today's assignment (`GET /shift-assignments?startDate=today&endDate=today`) on mount
    - Pass to `<ClockWidget assignment={todayAssignment ?? null} />`

---

## Critical Files

- `backend/src/repositories/shift-repository.ts` — create
- `backend/src/repositories/shift-assignment-repository.ts` — create
- `backend/src/repositories/clock-record-repository.ts` — create
- `backend/src/utils/haversine.ts` — create
- `backend/src/utils/haversine.test.ts` — create
- `backend/src/validators/shift-schemas.ts` — create
- `backend/src/services/shift-service.ts` — create
- `backend/src/services/shift-assignment-service.ts` — create
- `backend/src/services/clock-service.ts` — create
- `backend/src/controllers/shift-controller.ts` — create
- `backend/src/controllers/shift-assignment-controller.ts` — create
- `backend/src/controllers/clock-controller.ts` — create
- `backend/src/routes/shift-routes.ts` — create
- `backend/src/routes/shift-assignment-routes.ts` — create
- `backend/src/routes/clock-routes.ts` — create
- `backend/src/routes/index.ts` — register new routes
- `backend/src/jobs/shift-reminder.ts` — create
- `backend/src/jobs/workers.ts` — extend notificationWorker
- `backend/tests/shift.test.ts` — create
- `backend/tests/shift-assignment.test.ts` — create
- `backend/tests/clock.test.ts` — create
- `frontend/services/shiftService.ts` — create
- `frontend/app/app/manage/shifts/page.tsx` — replace stub
- `frontend/app/app/shifts/page.tsx` — replace stub
- `frontend/components/shifts/ClockWidget.tsx` — create
- `frontend/app/app/dashboard/page.tsx` — extend with ClockWidget

## Reuse

- `authenticate`, `branchScope`, `requireRole` middlewares — existing, reuse as-is
- `ConflictError`, `NotFoundError`, `ValidationError`, `ForbiddenError` from `backend/src/utils/errors.ts`
- `branchRepository.findById` — already returns `latitude`/`longitude`
- `staffRepository` — use existing to verify `userId` belongs to branch in assignment creation
- `fcmService.sendToUser` — existing in `backend/src/services/fcm-service.ts`
- `isoDateSchema` from `backend/src/validators/order-schemas.ts` — reuse for date param validation
- `Modal`, `ConfirmDialog`, `Table`, `SkeletonTable`, `EmptyState`, `Toast`, `Button`, `Input`, `Select`, `Badge`, `Popover`, `PageLayout`, `PageHeader`, `IconButton` from `frontend/components/ui/`
- `apiClient` from `frontend/lib/apiClient.ts`
- Pattern for tests: mock service at module level with `vi.mock`, generate tokens with `signAccessToken` — same as `backend/tests/delivery-zone.test.ts`

## Verification

1. `pnpm --dir backend test -- tests/shift.test.ts tests/shift-assignment.test.ts tests/clock.test.ts src/utils/haversine.test.ts`
2. `pnpm --dir backend build`
3. `pnpm --dir frontend typecheck`
4. Log in as MANAGER → Manage → Shifts → create "Morning 06:00–14:00" → appears in table
5. Manager assigns WAITER to Morning shift for tomorrow → appears in weekly grid
6. Delete future assignment → disappears; attempt to delete today's assignment → error Toast
7. Log in as WAITER → `/app/shifts` → upcoming shift card appears for tomorrow
8. WAITER taps "Clock In" on dashboard → GPS prompt → clocks in (within 50 m) → time appears; second tap = Clock Out
9. GPS denied → Toast "Location unavailable..."
10. Manager opens Attendance view → clocked-in rows show method GPS; override modal creates OVERRIDE record
