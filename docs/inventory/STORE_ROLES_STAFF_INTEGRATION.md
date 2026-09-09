# Store Roles — Staff-System Integration (Outstanding)

Flagged 2026-07-29, during Inventory Phase 1 Session 9's manual walkthrough.
Not part of the Inventory feature itself — this is the gap between
STORE_MANAGER/STORE_ATTENDANT (added for Inventory) and the rest of the
staff system (admin account creation, Payroll, Leave, Inbox/Comms,
staff-directory visibility), which was built against the pre-Inventory role
roster and never updated.

**Decision (2026-07-29):** Store Manager/Attendant get identical access
shape to existing branch staff (e.g. WAITER/CHEF) for Payments, Leave, and
Inbox — no special-casing for the Central Store's different
`Location`-vs-`Branch` relationship. Confirmed with the project owner.

**The pattern:** every hand-maintained "all staff/human roles" array in the
codebase predates STORE_MANAGER/STORE_ATTENDANT. This is one coherent gap
across 5 files, not 5 unrelated bugs — do it as one session, one PR.

## Status

All 6 items shipped 2026-07-29, one session/one PR, per the plan below.

| # | Task | Status |
|---|---|---|
| 1 | Admin account creation | Complete |
| 2 | Payments/Payroll self-service | Complete |
| 3 | Leave management | Complete |
| 4 | Profile page | Already works — no change needed |
| 5 | Inbox/Comms | Complete |
| 6 | Staff directory / messaging-contact visibility | Complete |

**Three additional hand-maintained role lists were found during the live
Playwright verification pass, beyond the 5 files this plan originally
scoped** — the backend route allowlists were correct (200, not 403) but
staff still couldn't actually reach the screens or see each other, because:

- `frontend/middleware.ts` — a per-route allowlist (`isAllowedPath`)
  separate from both the backend routes and `layout.tsx`'s nav config.
  Its `/app/inbox`, `/app/hr/my-leave`, and `/app/payslips` branches all
  predated STORE_MANAGER/STORE_ATTENDANT and silently redirected both roles
  back to `roleHome` before the page ever rendered — nav links were visible
  but clicking them bounced you straight back to the Inventory dashboard.
- `frontend/app/app/inbox/components/ContactPickerSheet.tsx` — its
  `SECTION_DEFS` role-to-section map drives the *only* render loop for the
  new-conversation contact list. A contact whose role isn't in any section's
  `roles` array is silently dropped from the list (not shown as "no match" —
  just invisible), even though the backend API correctly returned them.
  Added a "Central Store" section.
- `frontend/app/app/inbox/components/IssueNoticeModal.tsx` — same pattern,
  smaller blast radius: `ALLOWED_ROLES` gates the individual-staff picker
  for issuing a Formal Notice. Added both roles so Store staff can be
  targeted individually, consistent with every other human role.

None of these are visible from a 403/200 RBAC test — they only surface by
actually loading the screen in a browser, which is why the live Playwright
pass in the verification plan mattered as much as the backend test suite.

## 1. Admin account creation

Right now the only way a STORE_MANAGER/STORE_ATTENDANT account gets created
is `backend/src/scripts/seed-dev.ts` (two hardcoded global dev accounts) or
direct DB access — no production-usable admin UI flow.

- `frontend/app/app/admin/page.tsx:27` — `AdminUserRole = Extract<AppRole,
  'DIRECTOR' | 'MANAGER' | 'ACCOUNTANT' | 'HR_MANAGER'>`. Add
  `'STORE_MANAGER' | 'STORE_ATTENDANT'` to this union.
- `frontend/app/app/admin/page.tsx:827-833` — the role `<Select>` options
  are hardcoded to the same 4 roles. Add both.
- `frontend/app/app/admin/page.tsx:298` — branch-assignment logic
  (`userForm.role === 'MANAGER' ? organizationId : undefined`). Store roles
  are branch-scoped the same way MANAGER is (assigned to `hubOrg.id` per
  `seed-dev.ts:146-167`), so both need to be added to this check too, not
  just the type/dropdown.
- Backend (`staffService.createStaff`) does not appear to block these roles
  — this task is frontend-only wiring, not new backend work.

## 2. Payments / Payroll self-service

- `backend/src/routes/payslip-routes.ts:8-19` — `ALL_HUMAN_ROLES` array
  gates `GET /payslips/my` (self-service payslip list) among other routes.
  STORE_MANAGER/STORE_ATTENDANT are absent — add both.
- `frontend/app/app/layout.tsx` — add a `'Payslips'` / `'My Payments'` nav
  entry → `/app/payslips` to both the STORE_MANAGER block (currently
  246-261, 495-527) and STORE_ATTENDANT block (currently 228-239), matching
  the existing WAITER/CHEF/BARISTA pattern.
- No new screens or services needed — `/app/payslips/page.tsx` and
  `payslip-service.ts` already handle any role present in the backend
  allowlist generically.

## 3. Leave management

- `backend/src/routes/hr-routes.ts:20-23` — `ALL_STAFF` array gates every
  self-service leave endpoint (`GET /hr/leave/balances/my`,
  `GET /hr/leave/requests/my`, `POST /hr/leave/request`,
  `POST /hr/leave/requests/:id/cancel`) plus employee-profile/HR-document
  self-service endpoints on the same router. STORE_MANAGER/STORE_ATTENDANT
  absent — add both.
- `frontend/app/app/layout.tsx` — add a `'My Leave'` nav entry →
  `/app/hr/my-leave` to both Store role blocks, matching
  WAITER/CHEF/BARISTA/STEWARD/HOUSEKEEPING.

## 4. Profile page — already works

`frontend/app/app/profile/page.tsx`'s `hasEmployeeProfile()` (lines 27-30)
excludes only `['DIRECTOR','HR_MANAGER','SYSTEM_ADMIN','KITCHEN_DISPLAY',
'BARISTA_DISPLAY']` — STORE_MANAGER/STORE_ATTENDANT were never added to
that exclusion list, so Employee Details / My Documents already render for
both roles today. Backend's `PROFILE_EXCLUDED_ROLES`
(`backend/src/utils/hr-constants.ts:11-17`) is likewise silent on these two
roles (not excluded → included). `roleLabels` already has both
(`STORE_MANAGER: 'Store Manager'`, `STORE_ATTENDANT: 'Store Attendant'`),
added during Inventory Session 6 to unblock a compile error. **No action
needed here.**

## 5. Inbox / internal comms

The system is called **Comms** in code (not "Inbox" — that's just the nav
label): `backend/src/routes/comms-routes.ts`, `comms-controller`,
`comms-service`, frontend `frontend/app/app/inbox/`,
`frontend/hooks/useCommsSocket.ts`, `frontend/store/commsStore.ts`. Three
sub-features: Direct Conversations, Broadcasts, Formal Notices (the
`NoticeDetailSheet` component is for `FormalNotice`).

- `backend/src/routes/comms-routes.ts:8-19` — `ALL_HUMAN_ROLES` gates
  conversations, broadcasts (read), and notices (read/acknowledge). Store
  roles absent — add both.
- `frontend/app/app/layout.tsx` — add `'Inbox'` nav entry → `/app/inbox` to
  both Store role blocks (every other role already has this).

## 6. Staff directory / messaging-contact visibility

Not explicitly asked for originally, but part of the same pattern and
needed for #5 to actually work end-to-end. `backend/src/services/
staff-service.ts` has three more hand-maintained role lists with no
STORE_MANAGER/STORE_ATTENDANT references:

- `branchStaffRoles` (lines 12-21) — drives `listStaff` branch-scoping.
  Without this, Store staff won't show up in a Manager's own branch staff
  list, and a Manager viewing their branch won't see Store staff either.
- `managerCreatableRoles` (lines 23-31) — a branch MANAGER cannot create
  STORE_MANAGER/STORE_ATTENDANT accounts even for branch-level self-service
  creation (separate from the Admin-panel path in #1).
- `getMessagingContacts`'s `allowedRoles` (line 75) — the cross-branch
  contact list DIRECTOR/HR_MANAGER/ACCOUNTANT/SYSTEM_ADMIN see. Even after
  #5 ships, Store staff would be invisible as messaging contacts to those
  roles without this. The branch-scoped counterpart
  (`staffRepository.findMessagingContacts`, line 81) likely inherits
  `branchStaffRoles` and needs the same check.

## Suggested approach

One session, one PR — touch all 5 files together rather than as separate
ad-hoc fixes, since they're the same class of gap discovered together.
Verification: RBAC 403→200 test per newly-opened route (mirroring the
existing Session 5 RBAC-audit pattern from Inventory Phase 1), plus a live
Playwright pass confirming both roles see Payslips/Leave/Inbox in nav and
can load each screen without error.
