# Pre-SaaS Codebase Audit Report

**Date:** 2026-05-04
**Scope:** Full backend cross-cutting audit — security, data isolation, validation, type safety, transactions, error handling, test coverage, performance
**Purpose:** Establish baseline quality confidence before onboarding new tenants

---

## Overall Verdict

The codebase is production-quality in its architecture. Patterns are correct, conventions are consistent, and the critical order/payment flows are solid. However there are **real bugs** — not theoretical risks — that will cause data corruption under multi-tenant load. These must be fixed before onboarding new clients.

---

## Audit Scorecard

| Area | Grade | Summary |
|---|---|---|
| Route Security | **A** | All routes properly gated. Health endpoint intentionally public — acceptable. |
| TypeScript Strictness | **A** | `strict: true`, zero `any` types, all double-casts are legitimate Prisma/test patterns. |
| Error Handling | **A** | Consistent error hierarchy, global handler covers Zod + Prisma + AppError, no silent failures. |
| Input Validation | **B** | ~78% coverage. Read-only endpoints missing query validation, route IDs inconsistently validated. |
| Database Transactions | **C** | Core order flow is atomic. Leave requests, house account auth, and non-credit payments have real atomicity gaps. |
| Data Isolation | **C** | Most core flows correctly scoped. HR, comms, discount, and credit auth repositories have missing `organizationId` on mutation functions — genuine cross-tenant data leak risk. |
| Test Coverage | **C** | 41% service coverage (11/27). Critical payment paths (house account, corporate account, customer credit) have zero tests. |
| Performance | **C** | Order queries well-optimised. Reports have a severe N+1 loop and unbounded queries that will degrade badly at scale. |

---

## Priority 1 — Fix Before Any New Client ✅ COMPLETE (2026-05-04)

### 1.1 Missing `organizationId` on Repository Mutations

These functions accept only an `id` — meaning a crafted API call could read or modify another tenant's data.

| Repository | Functions | Risk |
|---|---|---|
| `hr-repository` | `findLeaveRequestById`, `approveLeaveRequest`, `rejectLeaveRequest`, `cancelLeaveRequest`, `acknowledgeDisciplinaryRecord`, `findDisciplinaryRecordById` | Cross-tenant HR record mutation |
| `discount-repository` | `update`, `deactivate` | Cross-tenant discount modification |
| `customer-credit-repository` | `incrementBalance` | Cross-tenant balance write |
| `house-account-auth-request-repository` | `findById`, `findPendingByOrderId`, `resolveIfPending`, `updateBullmqJobId` | Cross-tenant auth resolution |
| `staff-discount-auth-request-repository` | `findById`, `findPendingByOrderId`, `resolveIfPending` | Cross-tenant auth resolution |
| `customer-discount-auth-repository` | `findById`, `findPendingByOrderId`, `resolveIfPending` | Cross-tenant auth resolution |
| `other-income-repository` | `deleteEntry` | Cross-tenant data deletion |
| `comms-repository` | `countUnreadInConversation`, `findMessagesByConversation`, `markMessageRead`, `softDeleteMessage`, `markBroadcastRead`, `acknowledgeBroadcast`, `findBroadcastRecipientStatuses`, `acknowledgeNotice`, `findUnacknowledgedAfter24h`, `findUnacknowledgedAfter48h`, `markReminder24Sent`, `markEscalation48Sent`, `findNoticeRecipientStatuses` | Cross-tenant message/notice access |
| `print-repository` | `updatePrintJobStatus`, `updateHeartbeat` | Cross-tenant print job modification |

**Fix:** Add `organizationId` to the `where` clause on each. The `organizationId` is available from `req.user` on every authenticated request and already flows through services into repositories.

**Status: ✅ Fixed** — All 9 repositories patched. Service callers updated to pass `organizationId`. Build clean, all tests pass.

### 1.2 Broken Transaction Atomicity

Split writes that leave data in inconsistent state if the second write fails.

| Service / Repository | Function | What breaks without a transaction |
|---|---|---|
| `hr-service` | `approveLeaveRequest` | Request marked APPROVED but leave balance not deducted |
| `hr-service` | `rejectLeaveRequest` | Request marked REJECTED but `pendingDays` not restored |
| `hr-service` | `cancelLeaveRequest` | Request marked CANCELLED but balance not restored |
| `order-repository` | `recordPayment` (non-credit path) | Payment recorded but order not marked CLOSED → appears unpaid |
| `house-account-auth-service` | `_applyDecision` | Auth request marked APPROVED but order payment write fails |
| `house-account-auth-service` | `createAuthRequest` | Auth request created but order status not set to AWAITING_AUTHORIZATION |
| `shift-assignment-service` | `batchCreateAssignments` | Batch partially succeeds — some assignments created, others not, no rollback |

**Status: ✅ Fixed** — All 6 atomicity gaps resolved. Leave requests (approve/reject/cancel), house account auth (create + resolve), and batch shift assignments now use `prisma.$transaction`. P2002 (non-credit payment) confirmed already atomic — false positive. Build clean, all tests pass.

---

## Priority 2 — Fix Before Scale ✅ COMPLETE (2026-05-04)

### 2.1 N+1 Query Loop in Reports

`report-repository.getDailySummaryInRange` loops day-by-day, making **9 parallel DB calls per day**. A 30-day report = ~270 database queries. With multiple tenants pulling monthly reports simultaneously this becomes a server-level bottleneck.

**Fix:** Batch-load all date ranges in 1–2 queries using date-range `where` clauses, then aggregate in memory by date.

**Status: ✅ Fixed** — `getDailySummaryInRange` now issues 7 parallel queries for the full date range and aggregates by date key in memory. Added `otherIncomeRepository.findByDateRange` helper. 30-day report goes from ~270 DB calls to 7.

### 2.2 Unbounded `findMany` Queries

These load entire tables into memory with no `take` limit:

| Function | Table(s) loaded | Risk |
|---|---|---|
| `getOutstandingBalances` | All house + corporate + customer credit accounts | Memory spike |
| `getStaleOrders` | All unclosed orders ever | Memory spike + timeout |
| `getDirectorTrends` | All orders + items + other income for date range | Memory spike |
| `getItemsPerformance` | All order items then sorted in memory | Memory spike |

**Fix:** Add `take` limits (500–1000) and document behaviour. For exports that need all data, use cursor-based streaming.

**Status: ✅ Fixed** — `getOutstandingBalances` capped at 500 per account type; `getStaleOrders` capped at 1000; `getDirectorTrends` orders capped at 50000, order items at 200000; `getItemsPerformance` order items capped at 200000.

---

## Priority 3 — Fix Before Confident Public Launch

### 3.1 Zero Tests on Payment Account Services ✅ COMPLETE (2026-05-04)

| Service | Risk |
|---|---|
| `house-account-service` | Balance ledger, overdraft protection |
| `house-account-auth-service` | Authorization flow, balance validation |
| `corporate-account-service` | B2B payment processing |
| `customer-credit-service` | Credit balance tracking and redemption |
| `modification-request-service` | Late-stage order changes |

**Status: ✅ Fixed** — All 5 service test files written. 56 new tests covering auth flows, settlement validation, role-based access, and error paths. Total test count: 308 passing across 36 test files.

### 3.2 Inconsistent Route Parameter Validation

~22% of endpoints use a custom `requireRouteId()` helper or raw string extraction instead of Zod for route `params`. Invalid UUIDs reach the service layer and produce Prisma errors instead of clean 400 responses.

**Fix:** Standardise on `routeIdParamSchema.parse(req.params)` everywhere.

**Status: ✅ Fixed** — All 10 non-compliant controllers updated. Added typed UUID param schemas to `branch-schemas`, `staff-schemas`, `comms-schemas`, `discount-schemas`, `hr-schemas`, `staff-transfer-schemas`, and `house-account-auth-schemas`. Removed all `requireRouteId()` helpers and raw type assertions. Integration test fixtures updated to use valid UUIDs. Build clean, 216 tests pass.

---

## Priority 4 — Code Quality ✅ COMPLETE (2026-05-05)

| Issue | Status |
|---|---|
| Prisma error mapping duplicated per service | ✅ `backend/src/utils/prisma-errors.ts` — shared `mapPrismaError()` with P2002/P2025/P2003/P2000 handling |
| `P2025` (record not found during update) falls through to 500 | ✅ Global error handler now returns 404 for P2025 |
| No error reporting service | ✅ Sentry integrated via `backend/src/config/sentry.ts` — opt-in via `SENTRY_DSN` env var, captures all 500s |
| Comms route params not Zod-validated | ✅ Fixed in P3.2 — all comms route params use typed UUID schemas |

---

## What This Means for SaaS Readiness

| Question | Answer |
|---|---|
| Will it break for a second restaurant today? | **Possibly** — missing `organizationId` on some mutation paths is a real cross-tenant risk |
| Will it corrupt data? | **Yes, under specific failure conditions** — atomicity gaps in leave requests and payment recording |
| Will it survive 10 tenants pulling reports simultaneously? | **No** — the N+1 report loop and unbounded queries will cause timeouts |
| Is the architecture sound enough to fix these? | **Yes** — patterns are correct everywhere else; these are localised fixes |

---

## Fix Schedule

| Week | Work |
|---|---|
| Week 1 | P1.1 — Add `organizationId` to all missing repository mutations |
| Week 1 | P1.2 — Wrap split writes in transactions |
| Week 2 | P3.1 — Write tests for payment account services |
| Week 2 | P3.2 — Standardise route param validation to Zod |
| Week 3 | P2.1 & P2.2 — Fix report N+1 and unbounded queries |
| Week 4 | P4 — Code quality improvements |

---

## Audit Status

| Fix Area | Status |
|---|---|
| P1.1 — organizationId isolation | ⬜ In Progress |
| P1.2 — Transaction atomicity | ⬜ Pending |
| P2 — Performance | ⬜ Pending |
| P3 — Test coverage & validation | ✅ Complete |
| P4 — Code quality | ✅ Complete |
