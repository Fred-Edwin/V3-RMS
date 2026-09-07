# Session B — Build the Department-Head Screens (from approved Paper design)

> **This file is the handover prompt for Session B.** Read it top to bottom.
> The Paper design is done and approved. Session A (model refactor) is done and
> committed. Your job: build the three screens on the clean marker model.

---

## 0. The 30-second orientation

- **What shipped in Session A** (branch `feat/department-head-scheduling`,
  commit `2498afe`): "department head" is no longer a `UserRole`. A head keeps
  their real base role (WAITER/CHEF/…) and carries `user.isDepartmentHead`
  (bool) + `user.departmentTag` ("which dept they head"). All backend scoping,
  guards, JWT plumbing, and frontend auth/nav plumbing are in place. Backend
  build + 776 tests green; frontend build green. Not merged yet — owner is
  testing the branch.
- **What you build:** replace three throwaway placeholders with the
  Paper-designed screens.
- **What you must NOT do:** reintroduce a `DEPARTMENT_HEAD` role, a dedicated
  nav shell, or `previousRole` writes. Don't touch the HR shifts page. Don't
  touch Inventory Phase 2 / MPO.

## 1. Read first

| Doc | Why |
| --- | --- |
| `docs/context/DEPARTMENT_HEAD_MODEL_REFACTOR.md` — the "SCOPE CORRECTION (2026-09-03, REVISED)" block | What actually landed in Session A |
| `docs/context/DEPARTMENT_HEAD_SHIFT_SCHEDULING.md` — §1, §4, §6 | Feature intent + locked design decisions + screen briefs |
| Memory `project_department_head_shift_scheduling.md` | Shift-side design decisions |
| `docs/context/INVENTORY-FEATURE/PAPER_DESIGN_PATTERNS.md` | How this project uses Paper; how to read the artboards |
| `CLAUDE.md` — Non-Negotiables, Frontend Hook Stability Rules, migration workflow (WSL/Linux — `npx prisma` in `backend/`, NOT `docker compose exec`) | Standing rules |

The Paper file is `01M0G5QP3YGCG9RSAYQWZYVPM2` ("Wendo RMS"). The approved
artboards for this feature are on **page `2-0`**. Page `1-0` is existing design
/ component reference only.

## 1a. How to build to the Paper design faithfully (do this, not eyeball)

The prose in §2 is a summary, **not the source of truth — the artboards are**.
Match layout, spacing, and styling to the artboards, not to the description.

1. `get_guide({ topic: "paper-mcp-instructions" })` once, then
   `get_basic_info`, then open page `2-0` and `get_screenshot` each artboard so
   you know what you're building.
2. For every screen, before writing JSX:
   - `get_jsx` on the artboard to see its structure and hierarchy.
   - `get_computed_styles` on the specific nodes (cards, chips, the day strip,
     the save bar, drawer sections) to read **exact** padding, gap, radius,
     border, colour, font-size, line-height, letter-spacing. Use those values
     — mapped to the project's tokens / Tailwind scale where they line up,
     literal values where they don't.
   - `get_fill_image` / `get_font_family_info` where relevant.
3. **Reuse existing components** wherever the artboard matches one (buttons,
   inputs, the Sheet/drawer, the shift week-grid, cards, empty states — all on
   page `1-0` and in `frontend/components/`). The artboards were composed from
   the system; your job is to reassemble the same pieces, not redraw them.
4. After building each screen, take a browser screenshot at the artboard's
   width and **compare side by side with the Paper screenshot**. Fix drift in
   spacing, radius, weight, colour before moving on.
5. Where Paper can't specify it — behaviour between the mobile and desktop
   breakpoints, long lists (a chef with 15 chips), motion (sheet slide-in,
   save-bar reveal, chip removal), focus/hover/disabled states — follow the
   project's existing conventions and note the choice for the owner to review.
   Don't invent a new visual language for these.
6. If an artboard and this doc disagree, the **artboard wins** — flag the
   discrepancy to the owner, don't silently pick one.

## 2. The approved design — what to build

### Screen 1 — Head's Department Scheduler  *(load-bearing)*

**Route:** `/app/department/shifts`. Reached from the "Department Shifts" nav
entry that `layout.tsx` already appends to a head's normal base-role nav. It is
NOT a landing page or a separate shell.

**Approved Paper artboards:**

- **`Department Scheduler (Dept Head, Mobile)`** — day-first, not week-grid:
  - Header + a **scope note** stating the constraint plainly, e.g. "You
    schedule chefs only. You can't change other departments or shift times."
  - **Horizontal day strip** (scrollable, one week; today highlighted; tap a
    day to load it).
  - **Three shift cards** for the selected day — Morning / Afternoon / Evening
    (the branch's actual `Shift` definitions; there may be more or fewer — key
    off `GET /shifts`, don't hard-code three). Each card lists the people
    assigned to that shift on that day as **removable name-chips** (× on each
    chip) plus an **"Add someone"** affordance that opens the picker sheet.
  - **Sticky per-day Save bar** at the bottom — the head edits a day, then
    Saves that day. Give an unambiguous saved confirmation (not silent
    autosave — heads won't trust it).
- **`Add Someone — Picker Sheet (Dept Head, Mobile)`** — a bottom sheet:
  department-scoped list (only the head's department's staff, via
  `staffInDepartment` / the eligible-staff data), tap to select, people
  **already scheduled for that shift+day are shown disabled**. Confirm adds the
  chips back on the card.
- **`Department Scheduler — First Time (Dept Head, Mobile)`** — empty state
  when the head has never scheduled: short explainer + the reassurance line
  **"HR sees what you save here"** (heads worry their work is invisible /
  duplicative). A clear primary action into scheduling the first day.
- **`Department Scheduler (Dept Head, Desktop)`** — *reference only, no bespoke
  design*. On desktop, this route renders the **existing HR/Manager shift
  weekly-grid components**, department-scoped, with **no branch picker, no role
  selector, no tabs** — just the week grid for the head's department. The
  Manager shift page already runs in this trimmed mode driven by the
  `isDepartmentHead` store flag (`frontend/app/app/manage/shifts/page.tsx`:
  title swap, `activeTab` filtered to `schedule`, roster filtered by
  `staffInDepartment`). You may keep sharing that component for desktop, or
  extract — your call, but do not rebuild the grid.

**Implementation decision for you:** the current placeholder is
`frontend/app/app/department/shifts/page.tsx` →
`export { default } from '../../manage/shifts/page'`. Decide whether the head
route (a) keeps re-exporting the Manager page and the Manager page renders the
day-first mobile UI + grid desktop UI internally when `isDepartmentHead`, or
(b) becomes its own component that shares lower-level pieces (the grid, the
shift-assignment service calls, date helpers). Prefer (b) if the day-first
mobile UI diverges enough that stuffing it into the 1200-line Manager page
hurts readability — which it likely does. Keep the Manager page's own
`isDepartmentHead` trimmed-mode behavior only if the head route still points at
it; otherwise remove that dead branch from the Manager page.

### Screen 2 — Department Heads Management  *(Branch Manager, Desktop)*

**Design decision (made in design): its OWN page** at `/app/manage/departments`,
**new sidebar item** under the Manager's "Manage" group — not a panel on the
staff page.

**Approved Paper artboards:**

- **`Departments (Branch Manager, Desktop)`** — one card per department:
  - **Kitchen & Pastry are ONE merged card** (title "Kitchen & Pastry"), with a
    small note: "One head covers both for now — a separate Pastry head can be
    appointed later." So the card list is: **Kitchen & Pastry, Barista,
    Service, Housekeeping** (4 cards, not 5).
  - Each card: either a **head block** (name, base role, "head since"
    intentionally **dropped** — do not show a tenure line) with a **Change**
    button, OR an amber **"No head assigned"** state with an **Assign** button.
  - A tinted **roster line** per card: "9 chefs · Ann K., Ben O., … · View
    all" — the department's members (see §3 API change: `members`).
- **`Assign Department Head — Drawer`** — right-side drawer:
  - Scoped **search** over eligible staff (the department's own roles only —
    backend already scopes `GET …/:tag/eligible-staff`).
  - **Radio list** of candidates.
  - An **amber consequence panel**. Copy is **additive, not promotion**:
    "Ann K. will be the Kitchen head. She keeps her chef role and can schedule
    Kitchen & Pastry shifts. You can remove this anytime." **No "reverts to
    previous role" language** — that concept is gone with the marker model.
- **`Change Department Head — Drawer`** — like Assign, plus:
  - A **Current head** strip at the top.
  - A **danger-tinted Remove** action ("Remove Ann as Kitchen head — she keeps
    her chef role, Kitchen just won't have a head").
  - "…or pick a replacement" leading into the same radio list. Selecting a
    replacement in one action = remove current + assign new; the consequence
    panel names both ("Ann stops being Kitchen head; Ben becomes Kitchen
    head").

### Screen 3 — Profile Role line  *(minor)*

`frontend/app/app/profile/page.tsx` already shows
`"<role> · Department Head (<dept>)"` on the Role line. Restyle to match design
if the design specifies it; otherwise leave as-is. Low priority.

## 3. Backend change you DO need — `members` on `listDepartments`

The spec check found the Screen 2 roster line ("9 chefs · names · View all")
needs member data the API doesn't return. **This is the only backend change in
Session B. No migration.**

- `backend/src/repositories/department-repository.ts` — in the query behind
  `listDepartments`, for each department also fetch its members: active users
  at that branch whose **base role** is in that department's role group
  (`DEPARTMENT_ROLES` in `backend/src/utils/departments.ts` — Kitchen & Pastry
  share `CHEF`). Return `members: { id, name, role }[]` (name for the preview,
  cap the payload if you like but return the full count too — the card shows
  "9 chefs" then the first N names).
- `backend/src/services/department-service.ts` — thread `members` through.
- `backend/src/controllers/department-controller.ts` — include it in the
  response shape.
- **`frontend/services/departmentService.ts`** — add
  `members: { id: string; name: string; role: AppRole }[]` to
  `DepartmentSummaryDto`. (The `staffCount` field may already cover the count —
  reconcile: prefer one source of truth. If `members.length` == the count,
  drop `staffCount`.)
- Add/adjust a repo or service test for the new field. Backend `pnpm build` +
  `pnpm test` must stay green.

**Spec-check items already resolved (do NOT re-litigate):**
- "Head since" date → **dropped** (no tenure line anywhere).
- "Revert target" / `previousRole` on the head DTO → **not needed** — the
  marker model has nothing to revert. The head DTO stays `{ id, name, email,
  role, isActive, departmentTag }`.

## 4. What you replace (all throwaway placeholders)

| File | Current state | Action |
| --- | --- | --- |
| `frontend/app/app/department/shifts/page.tsx` | `export { default } from '../../manage/shifts/page'` | Build the real head scheduler (mobile day-first + desktop grid). |
| `frontend/app/app/manage/shifts/page.tsx` | Runs a `isDepartmentHead` trimmed mode (title/tabs/roster) | Keep only if the head route still re-exports it; otherwise strip that branch. |
| `frontend/app/app/manage/staff/page.tsx` — "Department Heads" panel (~gated `role === 'MANAGER' && organizationId`, handlers `loadDepartments` / `handleAssignHead` / `handleUnassignHead`, the assign modal + confirm dialog) | Rough card + modal | **Move** the reusable service calls + handlers to the new `/app/manage/departments` page; **delete** the panel JSX and its now-unused state from the staff page. |
| `frontend/app/app/profile/page.tsx` — Role line | Shows `"<role> · Department Head (<dept>)"` | Restyle per design or leave. |

New files you'll create:
- `frontend/app/app/manage/departments/page.tsx` — Screen 2.
- Likely `frontend/components/department/` — the day-first scheduler, picker
  sheet, department card, assign/change drawers. Follow existing component
  organisation conventions (see `CLAUDE.md` Project Structure).
- Nav: add "Departments" to the Manager sidebar group in
  `frontend/app/app/layout.tsx` (Manager's "Manage" section, near "Shifts").
  Gate on `role === 'MANAGER'`. Add the middleware allow-rule for
  `/app/manage/departments` in `frontend/middleware.ts` (Manager only).

## 5. Plumbing already done — build on it, don't rebuild

- `useAuthStore` exposes `isDepartmentHead` + `departmentTag` (decoded from
  JWT).
- `frontend/middleware.ts` gates `/app/department/*` on the `isDepartmentHead`
  JWT claim.
- `frontend/app/app/layout.tsx` appends a single "Department Shifts" nav item
  to a head's normal base-role nav (sidebar + mobile overflow). Restyle the
  entry if design calls for it; keep the mechanism.
- `frontend/lib/departments.ts` — `staffInDepartment(staff, tag)`,
  `rolesInDepartmentGroup(tag)`, `sameDepartmentGroup(a,b)`,
  `departmentLabel(tag)`. Kitchen+Pastry grouping is handled here.
- `frontend/services/departmentService.ts` — `listDepartments`,
  `listEligibleStaff`, `assignHead`, `unassignHead`, `departmentLabels`.
- Backend shift-scheduling endpoints already admit a head
  (`allowDepartmentHead`), scope the head's roster read/copy/write to their
  department, reject cross-department writes, and exclude the head from the
  self-service "my shifts" branch. Use them as-is.

## 6. Session plan

1. Confirm with owner: **branch off `feat/department-head-scheduling`** (Session
   A's branch, not yet merged), or off `main` if Session A's PR has merged by
   the time you start. Ask.
2. `TodoWrite` the full task list up front.
3. **Read the Paper artboards first (§1a).** `get_screenshot` +
   `get_jsx` + `get_computed_styles` on every artboard on page `2-0` before
   writing any UI. Note the exact values you'll build to. Show the owner the
   artboard screenshots and confirm you're looking at the right, final
   versions.
4. **Backend:** add `members` to `listDepartments` (repo → service →
   controller), update the frontend DTO, add a test. `pnpm build` + `pnpm test`
   green. (Kill dev servers first per project rule.)
5. **Screen 2** — build `/app/manage/departments`: page + card component +
   Assign drawer + Change drawer. Wire `departmentService` + the handlers moved
   from the staff page. Add the nav item + middleware rule. Delete the staff-page
   panel. **Screenshot at the artboard width, diff against Paper, fix drift.**
6. **Screen 1 mobile** — the day-first scheduler + picker sheet + first-time
   state, in `frontend/app/app/department/shifts/page.tsx` (+ components).
   **Screenshot at mobile width, diff against Paper, fix drift.**
7. **Screen 1 desktop** — same route renders the shift weekly-grid,
   department-scoped, no branch/role/tab chrome. Reuse the existing grid
   components.
8. **Profile** — restyle the Role line if design specifies; else skip.
9. Frontend `pnpm build` clean. Typecheck clean. (Servers killed for the build,
   restarted after.)
10. **Owner tests on localhost** (see §7).
11. **Commit** on the branch. If §3 added a migration — it must not, flag if it
    somehow does. End the commit message with:
    `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
    If opening/expanding a PR, body ends with:
    `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## 7. Owner's localhost test (the acceptance walk)

1. Log in as a branch **MANAGER** → new **Departments** nav item →
   `/app/manage/departments`. See 4 cards (Kitchen & Pastry merged).
2. On **Kitchen & Pastry**, **Assign** → drawer, search, pick an active chef →
   consequence panel reads additively (no "revert") → confirm. Card now shows
   that chef as head; their base role still "Chef" in the staff list.
3. Roster line on each card shows real member names + count.
4. **Change** on that card → Current-head strip, Remove is danger-tinted,
   replacement flow names both changes.
5. Log out. Log in as that chef. Their **normal chef nav is intact** (KDS,
   dashboard, etc.) **plus** a "Department Shifts" entry.
6. Open **Department Shifts** on a phone-width viewport → day strip + 3 shift
   cards + Add-someone sheet (department-scoped, already-scheduled disabled) +
   sticky Save. Schedule someone into Morning, Save, see the confirmation.
7. First-time state: with a fresh department (no assignments), the empty state
   with "HR sees what you save here" shows.
8. Desktop viewport → same route shows the week grid, department-scoped, no
   branch/role/tab chrome.
9. Log in as **HR_MANAGER** → `/app/hr/shifts`, same branch + week → the chef's
   scheduled rows appear in HR's consolidated view; **the HR page is otherwise
   unchanged**.

## 8. Constraints (repeat — these are hard rules)

- No `DEPARTMENT_HEAD` role, no dedicated nav shell, no `previousRole` writes.
- HR shifts page unchanged.
- No Inventory Phase 2 / MPO changes — that reconciliation is the owner's, when
  Phase 2 resumes.
- Kill dev servers before `pnpm build` / typecheck; restart after.
- Every new API response validated; every new route has `authenticate` +
  role/marker gating (`CLAUDE.md` Non-Negotiables).
- Frontend hook stability rules (`CLAUDE.md`) — stable callbacks, no refetch
  loops in the day-strip / roster effects.

## 9. Deliverables

- `/app/manage/departments` page + Assign/Change drawers, Manager nav entry.
- `/app/department/shifts` day-first mobile scheduler + picker sheet +
  first-time state; desktop = department-scoped week grid.
- `members` on `listDepartments` (backend + DTO + test).
- Staff-page "Department Heads" panel removed.
- Backend `pnpm build` + `pnpm test` green; frontend `pnpm build` green.
- Locally verified against §7; committed on the branch, ready for the PR.
