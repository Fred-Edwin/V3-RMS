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

## Notes for Next Phase (Phase 6)
- If Phase 6 introduces payroll/attendance analytics, reuse `ShiftAssignment` + `ClockRecord` as the source of truth.
- Preserve branch-level role scoping when expanding director-wide reporting over shift data.
- Consider adding end-to-end tests for browser geolocation and clock widget UX states.
