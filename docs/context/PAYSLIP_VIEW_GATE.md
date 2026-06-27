# Payslip View Gate

**Status**: In Progress
**Started**: 2026-06-25

---

## Why

Staff payslip data (salary, deductions, net pay) is the most sensitive personal financial
data in the system. Opening `/app/payslips` ("My Payments") currently renders it immediately.
This adds an **authentication step before the financial data is shown**, protecting against
someone viewing salary on an already-logged-in / unattended device.

This is a UX view-gate layered on top of the existing JWT/RBAC that already protects the
payslip API server-side. It is NOT the only line of defense.

## Behavior (confirmed)

- Opening the page shows a **lock screen**, not salary data.
- User **re-enters their account password** → server verifies → data reveals.
- Re-locks on: **every fresh visit (mount)**, **~3 min idle**, and **navigate-away / tab blur**.
- Server-verified (not client-only) so it genuinely proves identity.

## Scope

- ONLY the staff payslip page `/app/payslips` (My Payments).
- NOT the HR payroll admin page (`/app/hr/payroll`) — different flow, admin context.

---

## Design

### Backend — `POST /auth/verify-password`
- Authenticated (any human role), rate-limited (reuse login-style limiter).
- Body `{ password: string }`. Verifies against current user's hash via `comparePassword`
  (same as `changePassword` does). Stateless — issues no token, changes no session.
- Returns `{ success: true, data: { verified: true } }` on match; 401 on mismatch.
- Files: auth-service `verifyPassword`, auth-controller handler, auth-routes route,
  Zod schema, auth-repository already has `findUserByIdWithPassword`.

### Frontend — lock gate on `/app/payslips`
- New `usePayslipGate` / `<PayslipLockScreen>`: page renders the lock screen until verified.
- On verify success → reveal content for the session-of-view; re-lock on mount, idle timer
  (~3 min, reset on activity), and `visibilitychange`/unmount.
- Calls `authService.verifyPassword(password, token)`.

---

## Task List

- [x] B1. `verifyPassword` in auth-service (reuse findUserByIdWithPassword + comparePassword).
- [x] B2. Zod schema + auth-controller handler + `POST /auth/verify-password` route (rate-limited).
- [x] B3. Backend test (correct pw → 200 verified; wrong → 401; unauth → 401).
- [x] B4. Backend build + test green (the lone failure is a pre-existing bcrypt timeout in `password.test.ts`, unrelated to this change).
- [x] F1. authService.verifyPassword client method.
- [x] F2. Lock-screen UI + gate logic on /app/payslips (re-lock on mount/idle/blur).
- [x] F3. Frontend build green.
- [ ] S1. Branch, commit, push, PR, merge.
- [ ] S2. Update doc + MEMORY.md.
