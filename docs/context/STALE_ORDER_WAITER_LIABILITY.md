# Stale-Order Waiter Liability

**Status**: Complete
**Implemented**: 2026-06-25
**Type**: Cross-phase feature — visibility + accrual (no schema change, no auto-deduction)

---

## What & Why

Waiters sometimes leave orders unpaid and unclosed, so the restaurant loses the money with
no accountability. The director wanted stale unpaid orders to count toward the responsible
waiter's payroll deductions. Built as **visibility + accrual**, not silent automation:

- Waiters **see** their unresolved stale orders + running total, with a month-end notice.
- The **Accountant** clears an order via the existing `PATCH /orders/:id/account` (sets a
  payment method → order CLOSED → drops off the waiter's list automatically).
- **HR** sees a per-waiter rollup and **manually keys** the amount into the
  `otherDeductions` (N.C.N.S/Deductions) column on the Payroll Entry tab. Nothing
  auto-edits a payslip.

## Definitions (read from existing code — not invented)

- **Stale** = the existing nightly-job rule (`backend/src/jobs/stale-orders.ts`): order with
  `orderDate < today` and `status NOT IN (CLOSED, CANCELLED)`.
- **Liability amount** = `order.total` (full unpaid total).
- **Fairness is structural** — credit orders are paid → CLOSED → excluded; walk-outs are
  CANCELLED → excluded. The repo query adds a defensive `paymentMethod: null` / `paidAt: null`
  guard so only genuinely unpaid orders count.
- **Derive-only** — no new table. An order is a liability while it is stale + unpaid; it
  leaves the set the moment it is closed/accounted. That IS the absolution.

## Endpoints

| Method/Path | Roles | Purpose |
|---|---|---|
| `GET /reports/my-liabilities` | WAITER | Own list + total (branch from JWT, own orders) |
| `GET /reports/waiter-liabilities` | HR_MANAGER, DIRECTOR, MANAGER, ACCOUNTANT, SYSTEM_ADMIN | Per-waiter rollup. Cross-branch roles: all active branches unless `?organizationId=`. ACCOUNTANT must pass `organizationId`. |

## Files

### Backend
| File | Change |
|---|---|
| `src/repositories/report-repository.ts` | `getWaiterStaleLiabilities(organizationIds, waiterId?)` |
| `src/services/report-service.ts` | `getMyWaiterLiabilities`, `getWaiterLiabilitySummary` (rollup + scoping) |
| `src/validators/report-schemas.ts` | `WaiterLiabilitySummaryQuerySchema` |
| `src/controllers/report-controller.ts` | `getMyWaiterLiabilities`, `getWaiterLiabilitySummary` |
| `src/routes/report-routes.ts` | two routes above |
| `src/types/report.types.ts` | `MyWaiterLiabilityReport`, `WaiterLiabilitySummaryReport`, rows |
| `tests/waiter-liability.test.ts` | 10 tests (RBAC, rollup math, scoping, Zod). Full suite: 405 pass |

### Frontend
| File | Change |
|---|---|
| `types/waiterLiability.ts` | shared types |
| `services/waiterLiabilityService.ts` | `getMyLiabilities`, `getWaiterSummary(organizationId?)` |
| `components/dashboard/StaleOrderLiabilityCard.tsx` | waiter card; renders nothing when empty/403 |
| `app/app/dashboard/page.tsx` | card in WAITER dashboard |
| `app/app/payslips/page.tsx` | card on Current Month tab of My Payments |
| `app/app/hr/payroll/page.tsx` | new **Stale-Order Deductions** tab (summary strip + per-waiter table) |

## Notes for future agents

- Liabilities are computed live from order state — there is no ledger table to keep in sync.
- The HR tab is read-only by design; the actual deduction is keyed manually into the existing
  payroll spreadsheet's N.C.N.S column. Do not auto-write payslips from this feature.
- `StaleOrderLiabilityCard` is WAITER-only at the API; it swallows the 403 for other roles
  (the My Payments page is shared by all staff), so it is safe to mount anywhere.
