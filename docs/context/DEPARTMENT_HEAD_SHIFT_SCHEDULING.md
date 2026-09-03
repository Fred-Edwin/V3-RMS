# Department-Head Shift Scheduling — Handover

> **Three sessions for this feature:**
> 1. **Design session** — Paper design of the two head-facing screens. Design
>    only, no code. *(This is the session that consumes §6 + §7 of this doc.)*
> 2. **Session A — model refactor** — "department head" changes from a *role* to
>    a *marker on the base role* (`isDepartmentHead` flag), across shifts **and**
>    Inventory Phase 2. Separate PR. See `DEPARTMENT_HEAD_MODEL_REFACTOR.md`.
> 3. **Session B — build** — implement the approved Paper design on the clean
>    marker model. *(Consumes §5 + §8 of this doc.)*
>
> **If you are the DESIGN session:** read §1, §4, §6, §7. Design "department
> head = their normal base-role app PLUS one added 'Department Shifts' entry" —
> a head keeps every screen their real job (waiter/chef/housekeeping) already
> gives them; the head capability is *additive*. Do not design a stripped-down
> shell.
>
> **If you are SESSION B:** Session A and the design must both be done first.
> Read the whole doc. The model is now: a head has a real `role` (WAITER/CHEF/…)
> plus `isDepartmentHead = true` + `departmentTag`. There is no `DEPARTMENT_HEAD`
> role anymore.

---

## 1. What this feature is

Client feedback (via HR): **department heads should schedule shifts for their
own department** — Kitchen, Service, Housekeeping, Barista. Pastry is currently
folded under Kitchen (one head covers both). HR stops hand-entering everyone's
shifts and keeps a **read-only consolidated view**.

**The HR shifts page must not change.** This is client-mandated. HR simply
starts seeing rows that department heads created, in the same page they use now.

## 2. Job per session

**Design session:** Design **one** best-effort version of each of the two
head-related screens in Paper.design — not two or three competing directions.
Strongest single design, then iterate with the owner to approval. No code.

**Session B:** Implement the approved design on the marker model (post Session
A). Owner tests on localhost; then commit.

**Do not change the backend** unless the approved design surfaces a genuine data
gap (not expected — see §5).

## 3. Read these first — specific sections only, not whole docs

| Doc | What to read |
| --- | --- |
| `CLAUDE.md` | "Non-Negotiables", "Frontend Hook Stability Rules", "Current Phase", "Task Tracking" |
| `docs/DESIGN_FIRST_WORKFLOW.md` | The four stages. This session is Stages 2–4 (Design → Contract → Build). |
| `docs/context/INVENTORY-FEATURE/PAPER_DESIGN_PATTERNS.md` | **All of it.** Canvas organization, tab-vs-page decision, drawer/card patterns, Paper-tool gotchas. This is the "how" for working in this Paper file. |
| `docs/paper.design.guidelines.md` | Skim — house style for Paper work. |
| `docs/ENTERPRISE_UI_DESIGN_PRINCIPLES.md` | Skim — the design bar to hit. |
| Memory `project_department_head_shift_scheduling.md` | Owner-confirmed design decisions (also in §4 below). |

## 4. Design decisions already locked — owner-confirmed, do not relitigate

- **Department membership is role-derived**, not a per-staff tag:
  Kitchen → `CHEF`, Barista → `BARISTA`, Service → `WAITER`,
  Housekeeping → `STEWARD` + `HOUSEKEEPING`.
- **KITCHEN + PASTRY are one group** for now (one head, one roster). Splittable
  later with no migration by appointing a separate PASTRY head.
- A head is matched to their department by `user.departmentTag`.
- **Heads also work shifts** — a head appears on their own department's roster
  and can be scheduled (by HR, the Branch Manager, or themselves).
- A head is **branch-pinned** — own branch only, exactly like a Manager. A
  foreign `organizationId` in a write is rejected server-side.
- **"Department head" is an ADDITIVE marker on the person's real role, NOT a
  replacement role.** A promoted waiter stays a `WAITER` and keeps every screen
  a waiter has (New Order, Orders, Dashboard, personal Shifts, Payslips,
  Performance). She *gains* one thing: a "Department Shifts" nav entry + the
  scheduler screen. Same for a chef (still cooks, still sees the KDS), a
  housekeeper, etc. Post Session A the marker is `user.isDepartmentHead = true`
  + `user.departmentTag`. **Do not design a stripped-down head-only shell** —
  that was the mistake in the first spike (see §5).

## 5. Current state of the code

> **Timeline:** a first spike built `DEPARTMENT_HEAD` as a *replacement role*
> (wrong — see §4). **Session A** refactors it to the `isDepartmentHead` marker
> model across shifts + Inventory Phase 2. **Session B (this build)** runs on
> the post-Session-A codebase. The notes below describe the *marker model*
> Session B builds against.

### Backend — shift-scheduling logic (from the spike, refactored by Session A)

- `backend/src/utils/departments.ts` (+ `.test.ts`) — role→department map
  (`DEPARTMENT_ROLES`), `staffMatchesDepartment`, `departmentScopeFilter`.
- `backend/src/services/shift-assignment-service.ts` — every path
  (list / create / batch / copy-week / reconcile / batch-delete / delete) is
  **department-scoped for a head** (`actor.isDepartmentHead` + `departmentTag`
  post Session A): roster reads filtered to the department, every write rejects
  staff outside it (403), a foreign `organizationId` in the payload rejected.
- `backend/src/repositories/shift-assignment-repository.ts` — optional
  `userWhere` Prisma filter; `departmentTag` in the `user` include.
- `backend/src/repositories/department-repository.ts` —
  `findEligibleStaff(orgId, tag)` scoped to the department's roles;
  `countStaffByDepartment` role-derived; `assignHead` / `unassignHead` set the
  `isDepartmentHead` flag (post Session A — no more role swap).
- Route guard: a `requireDepartmentHead` middleware (post Session A) protects
  the department-scheduling endpoints.
- **Do not change backend behaviour in Session B** unless the approved design
  surfaces a real data gap. If it does, flag it before building.

Relevant shift data shape (for design): a `Shift` has `name`, `startTime`,
`endTime`. A `ShiftAssignment` is one row per (user, date, shift).

### Frontend — the two screens Session B builds

| Path | State after Session A | Session B action |
| --- | --- | --- |
| `frontend/app/app/department/shifts/page.tsx` | Route kept; still the spike (re-exports the Manager grid); guard = `isDepartmentHead` flag | **Replace** with the real designed scheduler |
| `frontend/app/app/manage/staff/page.tsx` | "Department Heads" section still present (~238 lines) | **Rework** per the approved Screen 2 design (section vs. own page decided in design) |
| `frontend/services/departmentService.ts` | API client for the 4 department endpoints | Keep; adjust to design |
| `frontend/lib/departments.ts` | Frontend role→department map | Keep |

Plumbing Session A leaves in place: `authStore` exposes `isDepartmentHead` +
`departmentTag` (from JWT); nav = the user's normal base-role nav **plus** a
conditional "Department Shifts" entry when `isDepartmentHead`; `middleware.ts`
`/app/department/*` checks the flag. There is **no `DEPARTMENT_HEAD` in
`AppRole`** anymore.

## 6. The two screens to design

### Screen 1 — Head's Department Scheduler  *(load-bearing — iterate hardest)*

This is the screen that decides whether the feature gets used. The current spike
reuses the Manager's power-tool spreadsheet with three tabs hidden — wrong tool
for this user.

**This screen is reached from a "Department Shifts" entry added to the head's
normal base-role navigation** — it is *not* a landing page or a separate shell.
A Service head who is a waiter still lands on the waiter dashboard and works as
a waiter; "Department Shifts" is one extra item in her sidebar/bottom-nav.

**Design brief:**

- **Audience:** a department head, **frequently on a phone, on the floor** — not
  at a desk. Schedules **5–15 people they know by name**, roughly once a week.
- **Mental model:** day-first ("who's on the kitchen line tomorrow morning?"),
  not "fill in this week-grid".
- **Must feel small and safe:** visually signal "this is *your* Kitchen — you can
  only touch your department, you can't break anything".
- **Must have:** unambiguous save confirmation; a real empty / first-time state
  with guidance; none of the inherited power-tools that don't apply here (no
  branch selector, no attendance tab, no shift-definitions tab, no redundant
  role filter).
- **Design the single strongest version** — mobile-first. Add the desktop
  rendering once the mobile design is close. Do **not** draft competing
  `OPTION A / B / C` artboards; bring one design and iterate it with the owner.
- **Ground in:** the existing Wendo component kit and the Manager/HR shift screen
  on Paper page `1-0` (for what shift data exists).

### Screen 2 — Manager's Department-Heads Management

Currently a card grid bolted onto the ~900-line `/app/manage/staff` page.

**Design brief:**

- **Audience:** Branch Manager, desktop, infrequent task — assign / change /
  remove a head per department.
- **One open decision to make in the design** (pick the best answer, present it
  with reasoning — don't build three versions): does this stay a **section on
  the staff page**, become its **own `/app/manage/departments` page**, or a
  **compact list**? Recommend one.
- **Pastry-under-Kitchen:** Pastry shares Kitchen's head right now. Handle it
  visually so it isn't confusing — e.g. a single "Kitchen & Pastry" card, or
  Pastry nested under Kitchen. Decide in the design.
- Each department should show **who is in it**, not just a headcount.
- The assign picker is already backend-scoped to the department's roles
  (Kitchen → chefs only). Design the picker and the confirm step.
- **Messaging note (post Session A):** assigning a head no longer changes the
  person's role, so there is no "reverts to previous role" concept. Removing a
  head just clears the head marker — she stays a waiter/chef the whole time.
  Copy should read like "Make Joy the Service head" / "Remove Joy as Service
  head", not like a promotion/demotion.

## 7. Paper.design — the file and how to work in it

**One file: `01M0G5QP3YGCG9RSAYQWZYVPM2`** ("Wendo RMS"). It has two pages:

| Page | URL | Role |
| --- | --- | --- |
| `1-0` | https://app.paper.design/file/01M0G5QP3YGCG9RSAYQWZYVPM2/1-0 | **Existing designs for this project. REFERENCE ONLY.** Use it to confirm design tokens, colour palette, type scale, spacing, and existing component patterns (shift grid, cards, drawers, buttons, empty states). Do **not** add to or modify this page. |
| `2-0` | https://app.paper.design/file/01M0G5QP3YGCG9RSAYQWZYVPM2/2-0 | **Currently blank. All new artboards go here.** It carries the same themes/tokens as page `1-0`. |

Working rules:

- Start with `get_guide({ topic: "paper-mcp-instructions" })` — once per session.
- Then `get_basic_info` on the file, then `get_font_family_info` before any
  typography. Prefer font families already in `get_basic_info`.
- Review page `1-0` first to absorb the theme and component vocabulary. When
  unsure whether a token/pattern exists, check page `1-0` rather than inventing.
- All new work on page `2-0`.
- `get_screenshot` after every meaningful change to review.
- `finish_working_on_nodes` when done. No raw node IDs in owner-facing messages.

Canvas conventions for page `2-0` (from `PAPER_DESIGN_PATTERNS.md`):

- One labeled band: a `Label — Department Head Scheduling` artboard (title +
  one-line subtitle) above the screens.
- Sub-row sublabels: `Sublabel — Mobile`, `Sublabel — Desktop`.
- Artboard naming: `Screen Name (Role, Device)` — e.g.
  `Department Scheduler (Dept Head, Mobile)`,
  `Assign Department Head (Branch Manager, Desktop)`. **No spec-code prefix** —
  these screens never had one; don't invent one.
- Journey order left to right.
- Space generously — leave Y-room for the band to grow.

## 8. Session plan

1. Confirm with the owner they're ready to start.
2. Paper setup: `get_guide`, `get_basic_info`, `get_font_family_info`; review
   page `1-0`; confirm page `2-0` is the blank target; read
   `PAPER_DESIGN_PATTERNS.md` in full.
3. Create the feature band on page `2-0`.
4. Design **Screen 1** (mobile first, then desktop) — one strong version.
   Screenshot, present to owner, iterate to approval.
5. Design **Screen 2** — one strong version, with a recommendation on the
   section-vs-page question. Iterate to approval.
6. **Spec check:** read any data the approved screens need; confirm the current
   backend already returns it (expected: yes). Flag any gap before building.
7. **Implement.** Branch off `main`:
   `git checkout -b feat/department-head-shifts`. Replace the scheduler page;
   rework Screen 2. Match the approved design. Kill dev servers before any
   `pnpm build` / typecheck (project rule), restart after. Both must pass:
   backend `pnpm build` + `pnpm test`; frontend `pnpm build`.
8. **Owner tests on localhost.** Walkthrough: log in as a branch MANAGER →
   Screen 2 → assign a Kitchen head → log out → log in as that head → schedule
   a shift on Screen 1 → log in as HR_MANAGER → `/app/hr/shifts`, same branch +
   week → confirm the head's shifts appear and the page is otherwise unchanged.
9. **Commit** the whole feature (backend + frontend) as one logical change on
   the branch, ready for PR. No migration. End the commit message with:
   `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

## 9. Not in scope

- Backend logic changes — unless step 6 finds a real data gap.
- Department heads' Inventory Phase 2 web screens (requisitions, dispatch
  receiving) — separate future build.
- The HR shifts page — unchanged, client-mandated.

## 10. Deliverables

- Approved Paper artboards for both screens on page `2-0`.
- Implemented, locally-verified frontend matching the approved design.
- One commit on `feat/department-head-shifts` covering backend + frontend,
  ready for a PR against `main`. No migration.
