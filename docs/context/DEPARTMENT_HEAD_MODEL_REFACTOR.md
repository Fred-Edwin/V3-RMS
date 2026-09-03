# Department-Head Model Refactor — Handover (Session A)

> **This file is the handover prompt for "Session A" of the department-head
> work.** Read it top to bottom before touching anything.
>
> **Three sessions, this is the middle one:**
> 1. **Design session** (done) — Paper design of the two head-facing screens,
>    approved by the owner. Design only, no code.
> 2. **Session A — THIS SESSION** — refactor "department head" from a *role* to
>    a *marker on the base role* (`isDepartmentHead`). **Shift-scheduling scope
>    only.** Ships as its own PR. No new feature UI.
> 3. **Session B** — build the real head screens from the approved Paper
>    design, on the clean marker model. See
>    `DEPARTMENT_HEAD_SHIFT_SCHEDULING.md`.
>
> ## SCOPE CORRECTION (2026-09-03) — read this before §3
>
> An earlier draft of this doc said Session A also refactors Inventory Phase 2's
> `DEPARTMENT_HEAD` usage (requisitions, dispatch, market-PO, staff-transfer).
> **That is NOT the case.** Investigation on 2026-09-03 established:
>
> - **`main` is at `f84496d`.** The only `DEPARTMENT_HEAD` things on `main` are
>   the enum value + `previous_role` column + `User.department_tag`, all from
>   committed migration `20260821080505` (commit `a15db5a`). There is **no
>   Inventory Phase 2 service/route code on `main`** that references
>   `DEPARTMENT_HEAD`.
> - All the Inventory Phase 2 / MPO code (requisition-service, dispatch-service,
>   market-purchase-order-*, the staff-transfer head rule) lives **only** in
>   uncommitted working-tree changes + the `wip/inventory-mpo-snapshot` branch.
>   Phase 2 is **unfinished and deliberately not merged** — the owner will
>   resume it later.
> - The department-head shift-scheduling **spike** (backend scoping +
>   throwaway frontend) is also uncommitted. It was built ON TOP of the Phase 2
>   pile. Before Session A starts, that whole working tree is **stashed** (msg
>   like `dept-head spike + phase2 wip, 2026-09-03`), leaving `main` clean.
>
> **Therefore Session A:**
> - Starts from a **clean `main`** (`git checkout -b feat/department-head-scheduling main`).
> - Rebuilds the dept-head **shift-scheduling** work on the `isDepartmentHead`
>   marker model. The stash is the *reference* for what the code should do;
>   `main` is the clean base; the marker model is the shape.
> - Touches **no Inventory Phase 2 code** — none is on `main`.
> - The Inventory Phase 2 `DEPARTMENT_HEAD` → `isDepartmentHead` reconciliation
>   is **deferred to whenever the owner resumes Phase 2** (`git stash pop` /
>   branch off `wip/inventory-mpo-snapshot`, rebase onto the new `main`, fix the
>   `role === 'DEPARTMENT_HEAD'` checks then). Not this session.
>
> §3 below still lists the Phase 2 files for reference — treat that as "what
> the future Phase 2 reconciliation will need", NOT Session A's task list.
> Session A's task list is §3's **shift-scheduling** rows + §4 + §5.

---

## 1. Why this refactor

`DEPARTMENT_HEAD` was implemented as a **replacement role**: promoting a waiter
to head does `role: WAITER → DEPARTMENT_HEAD` and stashes `previousRole: WAITER`.

The owner's actual model, confirmed 2026-09-03:

> "A department head also does the base job. If it's service, she also acts as a
> waiter. If it's the chef, she also cooks. The department-head role is just an
> **addition** — for now they can schedule shifts for their department; there
> will be more head capabilities in future."

The replacement-role approach broke this: a promoted waiter **lost the New
Order / Orders / Dashboard / personal Shifts / Payslips / Performance nav** and
was blocked by route guards from `/app/orders` etc., because the app derives
everything from the single `role` field and `DEPARTMENT_HEAD` got its own tiny
menu.

**The fix:** the person keeps their real `role` forever. "Department head"
becomes a **boolean marker** (`isDepartmentHead`) plus the existing
`departmentTag`. Everything the person could do before, they still can. They
*gain* head capabilities on top.

Owner decision (2026-09-03): migrate **all** `DEPARTMENT_HEAD` usage to the
marker model — shift-scheduling **and** Inventory Phase 2 — so there is one
consistent model, not two.

## 2. Read these first — specific sections only

| Doc | What to read |
| --- | --- |
| `CLAUDE.md` | "Non-Negotiables", "Migration Workflow", "Command Quick Reference" (Linux/WSL note), "Current Phase" |
| `docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md` | Decisions **D-17, D-18, D-22** (what a department head does in Inventory) |
| Memory `project_department_head_shift_scheduling.md` | The shift-side design decisions |
| Memory `project_inventory_central_store_model.md` and `project_central_store_hub_org.md` | Inventory org-scoping context (department heads live on branch orgs, not the hub) |

## 3. Current `DEPARTMENT_HEAD` usage — the full map

All of this must move to the marker. Verified 2026-09-03.

### Schema / migrations (committed + deployed to production)

- `backend/prisma/migrations/20260821080505_phase2_schema_requisition_dispatch_department_head/migration.sql`
  — `ALTER TYPE "UserRole" ADD VALUE 'DEPARTMENT_HEAD'` and
  `ADD COLUMN "previous_role"`. **Committed as `a15db5a`, live in production.**
- **Postgres cannot remove an enum value.** `DEPARTMENT_HEAD` stays as a
  dormant `UserRole` value forever. That is fine — nothing will assign it after
  this refactor. Do **not** attempt to drop it.

### Backend — role checks to convert (`actor.role === 'DEPARTMENT_HEAD'` → `actor.isDepartmentHead`)

| File | What it does |
| --- | --- |
| `backend/src/services/requisition-service.ts` (lines ~26, 28, 87, 102) | D-17: a head raises requisitions only for their own department; can only edit their own |
| `backend/src/services/dispatch-service.ts` (line ~34) | A head receives dispatches into their own department |
| `backend/src/services/market-purchase-order-service.ts` (lines ~23, 25) | D-22: a head requests market items for their own department |
| `backend/src/repositories/staff-transfer-repository.ts` (lines ~31, 37) | Special cross-branch transfer rule for a head |
| `backend/src/services/shift-assignment-service.ts` | `isDepartmentScoped(actor)` currently `=== 'DEPARTMENT_HEAD'` — the whole department-scoping mechanism |
| `backend/src/utils/departments.ts` | `SHIFT_ASSIGNABLE_ROLES` includes `DEPARTMENT_HEAD`; `staffMatchesDepartment` / `departmentScopeFilter` special-case `role === DEPARTMENT_HEAD`. **Rework:** a head now has a real role (WAITER/CHEF/…) so they already match their department by role — the `DEPARTMENT_HEAD` branches can largely go away. Re-derive carefully. |

### Backend — route guards to convert (`requireRole('DEPARTMENT_HEAD')` → new `requireDepartmentHead`)

- `backend/src/routes/requisition-routes.ts` (`canRaise`, plus a multi-role list)
- `backend/src/routes/dispatch-routes.ts` (`canReceive`, plus a list)
- `backend/src/routes/market-purchase-order-routes.ts` (`canRequest`, `canView`)
- `backend/src/routes/shift-routes.ts`, `backend/src/routes/shift-assignment-routes.ts`
  — currently add `'DEPARTMENT_HEAD'` to `requireRole(...)`. Replace with the
  new guard (for the department-scheduling endpoints only; the base-role
  entries like `WAITER` stay).
- `backend/src/routes/staff-routes.ts` (`GET /staff`) — `DEPARTMENT_HEAD` in
  the role list can simply be **removed** once heads keep their base role
  (a waiter-head already passes as `WAITER`).

### Backend — head creation / teardown

- `backend/src/repositories/department-repository.ts` —
  `assignHead` / `unassignHead` currently swap `role` and juggle
  `previousRole`. **Rewrite:** `assignHead` sets `isDepartmentHead = true` +
  `departmentTag`; `unassignHead` sets `isDepartmentHead = false` +
  `departmentTag = null`. **Delete all `previousRole` logic** — there is
  nothing to restore. `findHeadByDepartment` / `findEligibleStaff` /
  `countStaffByDepartment` queries that filter `role: 'DEPARTMENT_HEAD'` →
  filter `isDepartmentHead: true`.
- `backend/src/services/staff-service.ts` line ~24 — `DEPARTMENT_HEAD` in
  `branchStaffRoles`: remove (heads keep their base role, already covered).

### Backend — JWT + auth

- `backend/src/utils/jwt.ts` — `AccessTokenPayload` already carries
  `departmentTag`. **Add `isDepartmentHead?: boolean`.**
- `backend/src/services/auth-service.ts` (2 `signAccessToken` call sites) —
  include `isDepartmentHead: user.isDepartmentHead`.
- `backend/src/middleware/authenticate.ts` — copy `isDepartmentHead` onto
  `req.user`.
- `backend/src/types/express.d.ts` — add `isDepartmentHead?: boolean` to the
  `Request.user` type.
- New middleware `backend/src/middleware/rbac.ts` (or alongside) —
  `requireDepartmentHead` = 401/403 unless `req.user?.isDepartmentHead`.

### Backend — tests referencing `DEPARTMENT_HEAD` (6 files)

`shift-assignment-service.test.ts`, `department-service.test.ts`,
`dispatch-service.test.ts`, `market-purchase-order-service.test.ts`,
`staff-transfer-repository.test.ts`, `requisition-service.test.ts`,
plus `utils/departments.test.ts`. Update actor fixtures from
`role: 'DEPARTMENT_HEAD'` to `role: 'WAITER'/'CHEF'/…, isDepartmentHead: true,
departmentTag: '…'`.

### Frontend — `DEPARTMENT_HEAD` usage to remove / convert

| File | Action |
| --- | --- |
| `frontend/app/app/layout.tsx` (`MobileRole` type ~65, `mobileRoleTabs.DEPARTMENT_HEAD` ~271, `sidebarSectionsByRole.DEPARTMENT_HEAD` ~566, `usesDualShell` ~746) | **Delete the dedicated DEPARTMENT_HEAD shell entirely.** Instead: when `isDepartmentHead`, append a "Department Shifts" entry to the user's normal base-role nav (both sidebar and mobile). |
| `frontend/lib/role-home.ts` (`DEPARTMENT_HEAD: '/app/department/shifts'`) | Remove. A head's home is their base role's home. |
| `frontend/middleware.ts` (`allRoles` ~23, `/app/department` guard ~71, and the `DEPARTMENT_HEAD` additions in the inbox/hr/payslips lists ~99/107/135) | `/app/department/*` → check `isDepartmentHead` claim (add a decode helper like the existing `decodeRole`). Remove `DEPARTMENT_HEAD` from `allRoles` and the other lists — a head's base role already grants those. |
| `frontend/store/authStore.ts` | Already decodes `departmentTag` from the JWT. **Add `isDepartmentHead`.** Expose it in the store. |
| `frontend/types/auth.ts` (`AppRole` union ~16) | Remove `'DEPARTMENT_HEAD'` from `AppRole`. Add `isDepartmentHead?: boolean` to `AuthUser`. Keep `DepartmentTag`. |
| `frontend/types/shift.ts` (`ShiftRole` ~5) | Drop `'DEPARTMENT_HEAD'` from the union (a head is on the roster under their real role). |
| `frontend/lib/departments.ts` (~8, 33) | Rework `staffInDepartment` — a head matches by their real role now; drop the `role === 'DEPARTMENT_HEAD'` branch (or keep a defensive check on a `isDepartmentHead` field if the staff DTO carries it). |
| `frontend/app/app/manage/shifts/page.tsx` (~58, 141, 144, 252) | `isDepartmentHead` currently `role === 'DEPARTMENT_HEAD'`. Switch to the store's `isDepartmentHead` flag. `roleOrder` — drop the `DEPARTMENT_HEAD` entry. Staff filter list — drop `'DEPARTMENT_HEAD'`. |
| `frontend/app/app/profile/page.tsx` (~102), `frontend/app/app/manage/staff/page.tsx` (~35, 422) | `roleLabel['DEPARTMENT_HEAD']` and the `<option value="DEPARTMENT_HEAD">` in the staff filter — remove; instead surface "Department Head — Service" as a badge derived from `isDepartmentHead` + `departmentTag`. |
| `frontend/services/departmentService.ts`, `frontend/app/app/department/shifts/page.tsx` | Keep. The `/app/department/shifts` route stays (Session B replaces its contents). Its guard is now the `isDepartmentHead` flag. |

## 4. Schema change

```prisma
model User {
  // ...
  role           UserRole
  departmentTag  DepartmentTag?  @map("department_tag")   // KEEP — now = "which dept do they head"
  isDepartmentHead Boolean       @default(false) @map("is_department_head")  // NEW
  previousRole   UserRole?       @map("previous_role")     // KEEP the column (deployed); stops being written
  // ...
}
```

- New migration: `npx prisma migrate dev --name department_head_marker`
  (run in `backend/` on WSL/Linux, per CLAUDE.md — NOT via `docker compose exec`).
- **Data migration in the same migration file** (hand-add after the generated
  DDL): for every `role = 'DEPARTMENT_HEAD'` row →
  `SET role = previous_role, is_department_head = true, previous_role = NULL`
  (keep `department_tag`). Local DB has exactly 2 such rows (Joy Macharia,
  Rose King'ori — both `previous_role = WAITER`, `department_tag = SERVICE`).
  Production: check `SELECT count(*) FROM users WHERE role = 'DEPARTMENT_HEAD'`
  before deploy; expected small.
- Do **not** drop the `DEPARTMENT_HEAD` enum value (Postgres limitation, and
  harmless dormant).
- `previous_role` column: leave it. Removing a deployed column is a separate
  cleanup; not worth the risk here. Just stop writing it.

## 5. Session plan

**Precondition:** the working tree has been stashed and `main` is clean at
`f84496d`. Confirm with `git status` (clean) and `git stash list` (one entry
`dept-head spike + phase2 wip, 2026-09-03`) before starting.

1. Confirm with owner they're ready; TodoWrite the full task list up front.
2. **Branch:** `git checkout -b feat/department-head-scheduling main`.
3. **Recover the spike's dept-head files from the stash, selectively.** Use
   `git stash show -p stash@{0} -- <path>` to view, and `git checkout
   stash@{0} -- <path>` to pull individual files. Bring back ONLY the
   shift-scheduling dept-head files (see list below); do NOT pull any
   Inventory Phase 2 / MPO files. Then rework them to the marker model as you
   go — this is a rebuild, not a raw restore.
   - Backend: `utils/departments.ts` (+ test), `shift-assignment-service.ts`
     (+ test — dept-head test block only), `shift-assignment-repository.ts`,
     `shift-routes.ts`, `shift-assignment-routes.ts`, `department-service.ts`,
     `department-repository.ts`, `staff-routes.ts` (just the GET /staff line),
     `clock-service.test.ts` (fixture tweak), the `staff-service.ts`
     `branchStaffRoles` line, `staff-schemas.ts` (dept-head bits only, if any).
   - Frontend: `lib/departments.ts`, `services/departmentService.ts`,
     `app/app/department/`, plus the dept-head deltas in `layout.tsx`,
     `middleware.ts`, `store/authStore.ts`, `types/auth.ts`, `types/shift.ts`,
     `lib/role-home.ts`, `profile/page.tsx`, `manage/staff/page.tsx`,
     `manage/shifts/page.tsx`.
   - **Skip entirely** (Phase 2, not on `main`, not this session):
     `market-purchase-order-*`, `requisition-*`, `dispatch-*`,
     `inventory-transaction-*`, the Phase 2 migrations, the `staff-service.ts`
     staged `departmentTag`-on-create bits, all the walkthrough screenshots
     and Inventory docs.
4. **Schema + migration.** Add `isDepartmentHead Boolean @default(false)` to
   `User`. `npx prisma migrate dev --name department_head_marker` (run in
   `backend/` on WSL/Linux — NOT `docker compose exec`). Hand-add the data
   migration in the same file: `UPDATE users SET role = previous_role,
   is_department_head = true, previous_role = NULL WHERE role =
   'DEPARTMENT_HEAD'`. Local DB has 2 such rows (Joy Macharia, Rose King'ori —
   both `previous_role = WAITER`, `department_tag = SERVICE`). Verify
   `npx prisma migrate status` clean and the 2 rows converted.
5. **Backend:** JWT payload + `authenticate` + `express.d.ts` +
   `requireDepartmentHead` middleware.
6. **Backend:** in the recovered shift-scheduling files, every
   `actor.role === 'DEPARTMENT_HEAD'` → `actor.isDepartmentHead`; every
   `requireRole('DEPARTMENT_HEAD')` on a scheduling route → `requireDepartmentHead`.
   Rework `utils/departments.ts` — a head now has a real role
   (WAITER/CHEF/…) so `staffMatchesDepartment` matches them by real role;
   remove the `role === DEPARTMENT_HEAD` branches and drop `DEPARTMENT_HEAD`
   from `SHIFT_ASSIGNABLE_ROLES`.
7. **Backend:** rewrite `assignHead` / `unassignHead` in
   `department-repository.ts` — set/clear `isDepartmentHead` + `departmentTag`;
   **delete all `previousRole` logic**. Make sure "change a head from Kitchen
   to Service" still works (just update `departmentTag`).
8. **Backend:** update the recovered test file(s). `pnpm build` + `pnpm test`
   green.
9. **Frontend:** `authStore` exposes `isDepartmentHead` (decode from JWT next
   to `departmentTag`). **Delete the dedicated `DEPARTMENT_HEAD` nav shell** in
   `layout.tsx` (`MobileRole` entry, `mobileRoleTabs.DEPARTMENT_HEAD`,
   `sidebarSectionsByRole.DEPARTMENT_HEAD`, the `usesDualShell` line). Instead:
   when `isDepartmentHead`, append a single "Department Shifts" entry to the
   user's normal base-role nav (sidebar + mobile). Remove
   `roleHome['DEPARTMENT_HEAD']`. `middleware.ts`: `/app/department/*` checks
   an `isDepartmentHead` JWT claim (add a decode helper); remove
   `DEPARTMENT_HEAD` from `allRoles` and the inbox/hr/payslips lists. Remove
   `'DEPARTMENT_HEAD'` from `AppRole` (`types/auth.ts`) and `ShiftRole`
   (`types/shift.ts`); add `isDepartmentHead?: boolean` to `AuthUser`.
10. **Frontend:** `pnpm build` clean. (Kill dev servers before builds per
    project rule; restart after.)
11. **Owner tests on localhost:**
    - Log in as **Joy Macharia** (now base role WAITER, `isDepartmentHead`).
      She sees the **full waiter nav** — New Order, Orders, Dashboard, personal
      Shifts, Payslips, Performance — **plus** "Department Shifts".
    - `/app/department/shifts` still loads (old spike UI — Session B replaces).
    - `/app/orders` works (no redirect).
    - Log in as a branch MANAGER → the Department Heads UI → assign / remove a
      head → the person's base role is unchanged in the staff list; only a
      "head of X" marker toggles.
12. **Commit** on `feat/department-head-scheduling`. One migration. End the
    commit message with:
    `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
    PR body ends with:
    `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## 6. Watch out for

- **The stash is the reference, not a patch to apply wholesale.** It contains
  Phase 2 files you must NOT bring in. Pull dept-head files one by one and
  rework each to the marker model. When in doubt whether a file is dept-head
  or Phase 2, check §3's tables.
- **The `previousRole` juggling in `department-repository.ts`** is subtle
  (handles re-assigning an existing head to a different department). With the
  marker model it all collapses to "set the flag + tag" — make sure the
  "change a head from Kitchen to Service" path still works (just update
  `departmentTag`).
- **`utils/departments.ts` `SHIFT_ASSIGNABLE_ROLES`** currently includes
  `DEPARTMENT_HEAD` so heads appear on the roster. After the refactor a head is
  e.g. a `WAITER`, already assignable — remove `DEPARTMENT_HEAD` from that list
  and re-check `staffMatchesDepartment` for heads (they match their own
  department via their real role; a Service head who is a WAITER matches
  SERVICE automatically).
- Two `signAccessToken` call sites in `auth-service.ts` (login + refresh) —
  update both.
- **`DEPARTMENT_HEAD` enum value stays.** Postgres can't drop an enum value.
  It becomes dormant — nothing assigns it after this. Do not try to remove it.
- **`previous_role` column stays.** It's a deployed column; removing it is a
  separate cleanup. Just stop writing it.

## 7. Out of scope for Session A

- **Any Inventory Phase 2 code.** None is on `main` (it's stashed + on
  `wip/inventory-mpo-snapshot`). Phase 2's `DEPARTMENT_HEAD` → `isDepartmentHead`
  reconciliation happens when the owner resumes Phase 2 — not now. §3's Phase 2
  tables are reference for that future work only.
- Any new / redesigned head UI — that is Session B, from the approved Paper
  design (`DEPARTMENT_HEAD_SHIFT_SCHEDULING.md`).
- Dropping the `previous_role` column or the `DEPARTMENT_HEAD` enum value.
- The HR shifts page — unchanged, client-mandated.

## 8. After Session A

- Session A's PR merges to `main` → `main` now has the marker model.
- **Session B** builds the two approved Paper screens on that clean base.
- **Later**, when the owner resumes Inventory Phase 2: `git stash pop` (or
  branch off `wip/inventory-mpo-snapshot`), rebase onto the new `main`, and
  reconcile Phase 2's `role === 'DEPARTMENT_HEAD'` checks
  (requisition-service, dispatch-service, market-purchase-order-service,
  staff-transfer-repository, their route guards) to `isDepartmentHead` as part
  of finishing Phase 2.
