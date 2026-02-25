# Phase 6 — Reporting & Dashboards: Implementation Plan

## Context

Phase 5 is complete. All operational data now exists in the database — closed orders with payment methods and totals, prep tickets with `claimedAt`/`readyAt` timestamps, shift assignments, and clock records with actual hours. Phase 6 aggregates this data into five API endpoints, a nightly pre-computation job, and four frontend pages. After this phase the system is feature-complete for V1.

## Feature Understanding

- **`/reports/daily-summary`** (MGR, DIR) — Aggregates closed orders for a given date: total revenue, order count by type, revenue by payment method, top 5 items by quantity, avg prep time per station. Defaults to today. Directors pass `organizationId`; managers are auto-scoped.
- **`/reports/staff-performance`** (MGR, DIR) — Per-staff metrics over a date range. Waiters: orders handled, avg order value, scheduled vs actual hours. Chefs/Baristas: tickets completed, avg prep time, scheduled vs actual hours.
- **`/reports/branch-overview`** (DIR only) — Cross-branch aggregation: total revenue, total orders, per-branch breakdown with avg prep times.
- **`/reports/my-performance`** (WAITER, CHEF, BARISTA) — Scoped to the authenticated user only; never exposes other users' data.
- **`/reports/export`** (MGR, DIR) — Downloads daily_summary, staff_performance, or branch_overview as PDF or CSV.
- **BullMQ Nightly Job** (11pm Nairobi) — Pre-computes and caches daily summary per active branch. Cache key: `report:daily:{organizationId}:{date}`. Today served from cache; past dates computed on demand.
- **Manager Dashboard** — Live ops panel (active orders WebSocket feed, staff on shift, KPI stat cards) + daily summary panel with date picker.
- **Manager Reports** — Staff performance table with date range + export dropdown.
- **Director Dashboard** — Overview stat cards, per-branch table, cross-branch staff performance table with export.
- **Staff Performance** — Role-aware: Waiters see orders/revenue; Chefs/Baristas see ticket/prep-time metrics.

---

## Numbered Task List

### Backend — Repository

1. Create `backend/src/repositories/report-repository.ts` with Prisma aggregation queries:
   - `getDailySummary(organizationId, date)`:
     - `totalRevenue`: sum of `total` on `CLOSED` orders for the date
     - `orderCount`: count of `CLOSED` orders
     - `ordersByType`: group-by `type` count
     - `revenueByPaymentMethod`: group-by `paymentMethod` sum
     - `topItems`: join `OrderItem` → `MenuItem`, group by `menuItemId`, sum `quantity` and `subtotal`, order desc, take 5
     - `averagePrepTimeMinutes`: per station (KITCHEN, BARISTA), compute mean of `(readyAt - claimedAt)` in minutes for `READY` tickets on that date
   - `getStaffPerformance(organizationId, startDate, endDate, role?)`:
     - Waiters: count orders by `createdById`, compute avg `total`
     - Chefs/Baristas: count `READY` prep tickets by `claimedById`, compute avg prep time
     - Scheduled hours: sum shift durations from `ShiftAssignment` for each user in range
     - Actual hours: sum `(clockOutAt - clockInAt)` from `ClockRecord` for each user in range
   - `getBranchOverview(startDate, endDate)`:
     - Across all active organizations: revenue, order count, avg prep time per station per branch
   - `getMyPerformance(userId, organizationId, startDate, endDate, role)`:
     - WAITER: orders count, avg order value, total revenue, busiest day (most orders)
     - CHEF/BARISTA: tickets completed, avg prep time, fastest prep time, busiest day

### Backend — Utilities

2. Create `backend/src/utils/report-utils.ts` (pure functions, no Prisma imports):
   - `computeAveragePrepMinutes(tickets: {claimedAt: Date | null, readyAt: Date | null}[])` — mean diff in minutes, excludes nulls
   - `computeActualHours(records: {clockInAt: Date | null, clockOutAt: Date | null}[])` — sum decimal hours, excludes null `clockOutAt`
   - `computeScheduledHours(assignments: {shift: {startTime: string, endTime: string}}[])` — sum shift durations in decimal hours

### Backend — Validators

3. Create `backend/src/validators/report-schemas.ts`:
   - `DailySummaryQuerySchema`: `{ date?: isoDateSchema, organizationId?: uuid }`
   - `StaffPerformanceQuerySchema`: `{ startDate (required), endDate (required), organizationId?: uuid, role?: enum(WAITER,CHEF,BARISTA) }`
   - `BranchOverviewQuerySchema`: `{ startDate (required), endDate (required) }`
   - `MyPerformanceQuerySchema`: `{ startDate (required), endDate (required) }`
   - `ExportQuerySchema`: `{ reportType: enum(daily_summary|staff_performance|branch_overview), format: enum(pdf|csv), startDate, endDate, organizationId?: uuid }`
   - Export all inferred types; reuse `isoDateSchema` from `order-schemas.ts`

### Backend — Service

4. Create `backend/src/services/report-service.ts`:
   - `getDailySummary(actor, query)`: resolve org, check Redis cache (`report:daily:{org}:{date}`), on miss call repo + set cache with 24h TTL
   - `getStaffPerformance(actor, query)`: resolve org, call repo, apply role filter
   - `getBranchOverview(actor, query)`: throw `ForbiddenError` unless DIRECTOR; call repo
   - `getMyPerformance(actor, query)`: always scoped to `actor.id`; shape by `actor.role`
   - `exportReport(actor, query)`: fetch data via above methods, call formatter, return `{ buffer, filename, contentType }`

5. Create `backend/src/utils/report-formatters.ts`:
   - `toCsv(data, reportType)` → `Buffer` — plain string builder, no external library
   - `toPdf(data, reportType)` → `Buffer` — use `pdfkit`

### Backend — Controller & Routes

6. Create `backend/src/controllers/report-controller.ts` (thin):
   - `getDailySummary`, `getStaffPerformance`, `getBranchOverview`, `getMyPerformance` → standard JSON envelope
   - `exportReport` → sets `Content-Disposition: attachment; filename=...` + `Content-Type`, writes buffer

7. Create `backend/src/routes/report-routes.ts`:
   - `GET /reports/daily-summary` — `authenticate, branchScope, requireRole('MANAGER','DIRECTOR')`
   - `GET /reports/staff-performance` — `authenticate, branchScope, requireRole('MANAGER','DIRECTOR')`
   - `GET /reports/branch-overview` — `authenticate, requireRole('DIRECTOR')` (no branchScope — cross-branch)
   - `GET /reports/my-performance` — `authenticate, branchScope, requireRole('WAITER','CHEF','BARISTA')`
   - `GET /reports/export` — `authenticate, branchScope, requireRole('MANAGER','DIRECTOR')`

8. Register report routes in `backend/src/routes/index.ts`

### Backend — BullMQ Nightly Pre-computation

9. Create `backend/src/jobs/daily-report.ts`:
   - `precomputeDailyReports(queue)` — queries all active `Organization` records (system-level, no org scope), for each calls `reportRepository.getDailySummary` and caches result in Redis with `report:daily:{org}:{date}` key, 48h TTL
   - `ensureDailyReportSchedule(queue)` — registers repeating job on `reportQueue` at `0 23 * * *` Nairobi time, jobId `daily-report.schedule`

10. Update `backend/src/jobs/workers.ts`:
    - Import `precomputeDailyReports` and `ensureDailyReportSchedule` from `./daily-report`
    - Add `job.name === 'daily-report.schedule'` handler inside existing `reportWorker` (currently placeholder)
    - Call `ensureDailyReportSchedule(reportQueue)` inside `startWorkers`

### Backend — Tests

11. Create `backend/src/utils/report-utils.test.ts` (unit):
    - `computeAveragePrepMinutes` — known pairs return correct mean
    - `computeActualHours` — decimal hours from diff; null clockOutAt excluded
    - `computeScheduledHours` — sum of shift durations
    - Revenue exclusion: cancelled orders not counted

12. Create `backend/tests/report.test.ts` (integration):
    - `GET /reports/daily-summary` — MANAGER gets correct totals
    - `GET /reports/daily-summary` — DIRECTOR can pass `organizationId`; MANAGER's `organizationId` param ignored (auto-scoped)
    - `GET /reports/my-performance` — WAITER sees own stats only
    - `GET /reports/staff-performance` — correct order counts and prep times
    - `GET /reports/branch-overview` — MANAGER gets 403; DIRECTOR gets 200
    - `GET /reports/export?format=csv` — `Content-Disposition: attachment`, CSV content type
    - `GET /reports/export?format=pdf` — PDF content type

### Frontend — Services

13. Create `frontend/services/reportService.ts`:
    - Types: `DailySummary`, `StaffPerformancePeriod`, `BranchOverview`, `MyPerformance`
    - `getDailySummary`, `getStaffPerformance`, `getBranchOverview`, `getMyPerformance` — standard fetch wrappers
    - `exportReport(params, token)` — fetches blob, triggers browser download via `URL.createObjectURL`

### Frontend — Staff Performance Page (`/app/performance`)

14. Replace stub `frontend/app/app/performance/page.tsx`:
    - Date range selector: two `Input[type=date]` (start/end), default to current month
    - Load `role` from `useAuthStore`, fetch `reportService.getMyPerformance` on mount + range change
    - **WAITER**: four `StatCard` — total orders, avg order value, total revenue, busiest day
    - **CHEF / BARISTA**: four `StatCard` — tickets completed, avg prep time, fastest prep time, busiest day
    - Loading: `SkeletonTable`; error Toast

### Frontend — Manager Dashboard (`/app/manage/dashboard`)

15. Replace stub `frontend/app/app/manage/dashboard/page.tsx`:

    **Live Ops Panel**:
    - Three `StatCard`: orders today, revenue today, avg prep time today
    - Active orders feed — reuse `useActiveOrders` hook (already built in Phase 3.5) for real-time WebSocket updates; render compact order rows
    - Staff on shift today — call `shiftService.listAssignments({ startDate: today, endDate: today })` (Phase 5); render name, role, clock status

    **Daily Summary Panel**:
    - `Input[type=date]` defaulting to today
    - Fetch `reportService.getDailySummary` on mount + date change
    - Display: total revenue, order count breakdown by type, top 5 items list, payment method breakdown

### Frontend — Manager Reports Page (`/app/manage/reports`)

16. Replace stub `frontend/app/app/manage/reports/page.tsx`:
    - Date range `Input` pair + optional role `Select`
    - "Run Report" Button → `reportService.getStaffPerformance`
    - `Table`: Name, Role, Orders/Tickets, Avg Value/Prep Time, Scheduled Hours, Actual Hours
    - Export `Button` dropdown: "Download CSV" / "Download PDF" → `reportService.exportReport`
    - `SkeletonTable` while loading; `EmptyState` if no results

### Frontend — Director Dashboard (`/app/director`)

17. Replace stub `frontend/app/app/director/page.tsx`:

    **Overview Panel**:
    - Fetch today's branch-overview on mount
    - `StatCard` row: total revenue today (all branches), total orders today
    - Simple per-branch revenue + order count table

    **Branch Performance Report**:
    - Date range inputs + "Run" button → `reportService.getBranchOverview`
    - `Table`: Branch, Revenue, Orders, Avg Prep (KITCHEN), Avg Prep (BARISTA)
    - Export dropdown (PDF / CSV)

    **Staff Performance Report**:
    - Date range + optional Branch `Select` + Role `Select`
    - "Run" button → `reportService.getStaffPerformance` with `organizationId` if branch selected
    - `Table` + Export dropdown

---

## Critical Files

- `backend/src/repositories/report-repository.ts` — create
- `backend/src/utils/report-utils.ts` — create
- `backend/src/utils/report-utils.test.ts` — create
- `backend/src/validators/report-schemas.ts` — create
- `backend/src/services/report-service.ts` — create
- `backend/src/utils/report-formatters.ts` — create
- `backend/src/controllers/report-controller.ts` — create
- `backend/src/routes/report-routes.ts` — create
- `backend/src/routes/index.ts` — register routes
- `backend/src/jobs/daily-report.ts` — create
- `backend/src/jobs/workers.ts` — extend `reportWorker` + `startWorkers`
- `backend/tests/report.test.ts` — create
- `frontend/services/reportService.ts` — create
- `frontend/app/app/performance/page.tsx` — replace stub
- `frontend/app/app/manage/dashboard/page.tsx` — replace stub
- `frontend/app/app/manage/reports/page.tsx` — replace stub
- `frontend/app/app/director/page.tsx` — replace stub

## Reuse

- `redisClient` from `backend/src/config/redis.ts` — cache get/set in report service
- `reportQueue` from `backend/src/config/queues.ts` — already declared, use for nightly job
- `reportWorker` from `backend/src/jobs/workers.ts` — already declared as placeholder, extend
- `isoDateSchema` from `backend/src/validators/order-schemas.ts` — reuse in report schemas
- `ForbiddenError`, `ValidationError` from `backend/src/utils/errors.ts`
- `useActiveOrders` hook (`frontend/hooks/useActiveOrders.ts`) — live orders feed in manager dashboard
- `shiftService.listAssignments` (`frontend/services/shiftService.ts`) — staff on shift panel
- `StatCard`, `Table`, `SkeletonTable`, `EmptyState`, `PageHeader`, `PageLayout`, `Button`, `Select`, `Input` from `frontend/components/ui/`
- `apiClient` from `frontend/lib/apiClient.ts`
- Test pattern: `vi.mock` + `signAccessToken` — same as all prior phases

## New Dependency

- `pdfkit` — PDF generation: `pnpm --dir backend add pdfkit && pnpm --dir backend add -D @types/pdfkit`

## Verification

1. `pnpm --dir backend add pdfkit && pnpm --dir backend add -D @types/pdfkit`
2. `pnpm --dir backend test -- tests/report.test.ts src/utils/report-utils.test.ts`
3. `pnpm --dir backend build`
4. `pnpm --dir frontend typecheck`
5. MANAGER → `/app/manage/dashboard` — live orders update on new order; daily summary cards show today's data
6. MANAGER → `/app/manage/reports` — date range → Run → table populates → Download CSV → file downloads
7. WAITER → `/app/performance` — stat cards show own data only
8. CHEF → `/app/performance` — shows ticket/prep-time metrics
9. DIRECTOR → `/app/director` — branch overview table loads; staff performance table loads; both export to PDF and CSV
10. MANAGER attempts `GET /reports/branch-overview` → 403
