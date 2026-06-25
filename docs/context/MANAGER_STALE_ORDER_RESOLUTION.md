# Manager Stale-Order Resolution

**Status**: Complete
**Implemented**: 2026-06-25
**Builds on**: Stale-Order Waiter Liability (`STALE_ORDER_WAITER_LIABILITY.md`)

---

## Why

Managers need to clear their branch's stale (unpaid, unclosed prior-day) orders so they
stop hitting waiters' liability. Four resolution paths, depending on what happened:

1. **Record payment → close** — order was fulfilled & paid; manager records cash/M-Pesa/etc.
2. **Force ready → close (two steps)** — order stuck in PENDING/IN_PROGRESS; manager forces it
   READY (reason + audit), then records payment separately.
3. **Send to House Account** — it was a member's order; route to the existing house-account
   authorization flow instead of charging the waiter.
4. **Cancel** — order was never fulfilled (walk-out / mistake / abandoned); manager cancels it
   (reason required, audited as ORDER_CANCELLED). Uses the EXISTING cancel route (already MANAGER).

All four end with the order leaving the stale set → it drops off the waiter's liability
automatically. No schema change.

## Home: redesigned manager Incidents page (tabbed)

`/app/manage/incidents` becomes tabbed:
- **Incidents** — the existing historical log (kept; minor restyle only).
- **Stale Orders** — NEW. Backed by **live order state** (not the ORDER_STALE incident log,
  which is a stale snapshot). Excel/financial-report table; resolve actions per row.

The live source is the existing `getWaiterStaleLiabilities` query (branch-scoped, post-cutoff).

## Key code facts (verified)

- `recordPayment` service already allows MANAGER via `assertOwnership` (order-service.ts:114).
  Only the **route** is WAITER-gated (order-routes.ts) — open it to MANAGER.
- `recordPayment` requires status READY (order-service.ts:815) → force-ready must precede close.
- `recordPayment` already routes HOUSE_ACCOUNT → `houseAccountAuthService.createAuthRequest`
  (order-service.ts:882) → action 3 is "free" once managers can call recordPayment.
- Existing SYSTEM_ADMIN `forceOrderReady` (order-correction-service.ts:161) is too narrow
  (requires IN_PROGRESS + a REJECTED ticket). Manager needs a broader force-ready for any
  non-terminal stuck status. Build a manager-scoped one, audited via IncidentLog.

---

## Task List

### Backend
- [ ] B1. Open `recordPayment` route to MANAGER (order-routes.ts) — keep branch scope.
      Verify service path works for MANAGER (assertOwnership already allows it).
- [ ] B2. Manager stale-orders list endpoint: `GET /orders/branch-stale` (MANAGER) →
      reuse `reportRepository.getWaiterStaleLiabilities([branchId])`. Zod, RBAC, scoping.
- [ ] B3. Manager force-ready: `PATCH /orders/:id/force-ready` (MANAGER) — sets a stuck
      non-terminal order to READY, reason required, writes IncidentLog (ORDER_STALE,
      action: forced_ready_by_manager). New service method + repository update.
- [ ] B4. Zod schemas (force-ready reason min length; branch-stale query).
- [ ] B5. Controllers (thin).
- [ ] B6. Tests: RBAC (manager allowed, waiter/chef blocked), force-ready status guards,
      branch isolation, audit-log written, recordPayment-as-manager happy path.
- [ ] B7. Backend pnpm build + pnpm test green.

### Frontend
- [ ] F1. Types + service methods (branch-stale list, force-ready).
- [ ] F2. Redesign `/app/manage/incidents` into tabs (Incidents | Stale Orders).
- [ ] F3. Stale Orders tab: Excel-style table (the approved style) + per-row resolve menu:
      Record Payment/Close · Force Ready (then Close) · Send to House Account · Cancel.
      Cancel uses the existing cancel route (already MANAGER). Reuse OrderDetailBottomSheet /
      payment UI where possible. List refetches after each action.
- [ ] F4. Frontend pnpm build green.

### Ship
- [ ] S1. Branch, commit, push, PR, CI green, merge to main.
- [ ] S2. Update this doc + MEMORY.md to Complete.

---

## Files

### Backend
| File | Change |
|---|---|
| `src/routes/order-routes.ts` | open `/orders/:id/payment` to MANAGER; new `GET /orders/branch-stale`, `PATCH /orders/:id/force-ready` |
| `src/services/order-service.ts` | `getBranchStaleOrders` (reuses reportRepository.getWaiterStaleLiabilities), `forceReady` (audited) |
| `src/types/order.types.ts` | `BranchStaleOrder`, `BranchStaleOrdersReport` |
| `src/validators/order-schemas.ts` | `ForceReadySchema` |
| `src/controllers/order-controller.ts` | `getBranchStaleOrders`, `forceReady` handlers |
| `tests/manager-stale-orders.test.ts` | 8 tests (RBAC, force-ready guards, manager payment). Full suite: 413 pass |

### Frontend
| File | Change |
|---|---|
| `services/orderService.ts` | `getBranchStaleOrders`, `forceReady` + types |
| `app/app/manage/incidents/page.tsx` | tabbed (Incidents \| Stale Orders); Excel table + per-row resolve actions + ResolveModal |

## Notes for future agents

- Cancel reuses the existing `/orders/:id/cancel` (already MANAGER) — no new endpoint.
- Pay/Close + House Account both route through `recordPayment`, which requires status READY —
  hence Force Ready is a prerequisite (the UI disables them until READY).
- Stale list is live order state (not the ORDER_STALE incident log) and shares the
  waiter-liability query, so resolving an order removes it from both views consistently.
- Manager-only for now. Force-ready here is broader than the SYSTEM_ADMIN order-correction
  force-ready (which requires a ghost-rejected ticket).
