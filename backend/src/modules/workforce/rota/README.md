# Workforce · Rota (slice 2)

**Status:** back end built 18 Oct 2026 on branch `feat/workforce-2-rota` (cut from `feat/workforce-1b-heads`); not merged or pushed. The screens are built on `feat/workforce-2-rota-frontend` (`frontend/features/workforce/rota/`). Every choice is in [decisions-2-rota-backend.md](../../../../../docs/features/workforce/decisions-2-rota-backend.md).

## What it does

The Rota is who works which shift on which day (Chapter 5). **There is no publish step** (owner decision, 18 Oct 2026): every edit is saved at once, is live to staff, and is one audited write. When a person's shifts change they are told once, after a 5-minute quiet period, not once per click.

- **Shift templates** (name, start and end in Nairobi time, colour from the kit's palette, keyboard letter, unpaid break, per site or company-wide, optionally limited to departments). Retired, never deleted. No overnight shifts.
- **The week grid**: people by day, hours per person, people per day (and per department against the minimum cover), the four warnings, and cost for pay readers only.
- **Edits**: set or clear cells, the brush (`fill`), a standing `pattern`, and "start from last week" with a preview. Past days are read-only. A change to today or tomorrow needs a short reason (kept in the audit entry).
- **Warnings** (they inform, they never block): approved leave (needs an override reason to keep), thin coverage, weekly hours above the contract, a double shift.
- **Printed rota data** and a person's **own upcoming shifts**.
- **Carry-over** of the legacy shifts and not-yet-past assignments into the new tables, one-way and repeatable. The legacy `shifts`, `shift_assignments` and `clock_records` are only read here and stay authoritative for the clock until slice 3.

## Endpoints (all `authenticate`, then `attachWorkforceSubject`, then `requireCapability`; never `requireRole`)

| # | Route | Capability | Notes |
|---|---|---|---|
| T1 | `GET /workforce/rota/templates` (`siteId`, `weekStart`, `includeRetired`) | `rota.read` | Site's own plus company-wide; `thisWeek` counts shifts on that site's rota. |
| T2 | `POST /workforce/rota/templates` | `rota.template_write` | `siteId` null = company-wide (scope `all` only). 409 `TEMPLATE_NAME_TAKEN`, `TEMPLATE_LETTER_TAKEN`; 400 `OVERNIGHT_SHIFT`, `BREAK_TOO_LONG`. |
| T3 | `PATCH /workforce/rota/templates/:id` | `rota.template_write` | A time change moves upcoming shifts; needs `reason` when it moves today or tomorrow. May create a new version (see decision R10). |
| T4 | `POST .../templates/:id/retire` | `rota.template_write` | 409 `TEMPLATE_IN_USE` while upcoming shifts use it. |
| T5 | `POST .../templates/:id/restore` | `rota.template_write` | 409 `TEMPLATE_SUPERSEDED` for an old version. |
| G1 | `GET /workforce/rota/week?weekStart&siteId&departmentId` | `rota.read` (scope `unit`, `dept` or `all`) | The grid; `cost` is null unless the caller reads everyone's pay; `can` says what the caller may do. |
| G2 | `GET /workforce/rota/week/print` | `rota.read` | Same scope as G1, grouped by department, no cost. |
| G3 | `GET /workforce/rota/mine?from&to` | `rota.read` | The caller's own shifts (default today plus 28 days). |
| G4 | `PUT /workforce/rota/cells` | `rota.write` | `{ siteId?, changes: [{ employeeId, date, templateIds[] }], reason?, overrideReason? }`; an empty `templateIds` is a day off. |
| G5 | `POST .../fill`, `POST .../pattern` | `rota.write` | The brush across people and dates; one shift per weekday. |
| G6 | `POST .../copy/preview` | `rota.write` | `{ weekStart }` copies the seven days before it: shifts, people, clashes, kept, `reasonRequired`. Writes nothing. |
| G7 | `POST .../copy` | `rota.write` | Fills empty cells; returns the clashes left out. |

Other errors: 409 `PAST_DAY_READ_ONLY`, `REASON_REQUIRED` (with the dates), `LEAVE_OVERRIDE_REQUIRED` (with the cells), `NOTHING_TO_COPY`; 400 `WEEK_START_INVALID`, `WEEK_OUT_OF_RANGE`, `EMPLOYEE_NOT_ON_ROTA`, `TEMPLATE_NOT_AVAILABLE`. Out-of-scope reads and cross-site writes answer 404; a role without the capability, or a head outside their departments, answers 403.

## Who sees what

| Viewer | Grid | Edits | Templates | Cost |
|---|---|---|---|---|
| HR Manager | all sites | all (builds the Accountant's rota) | all, company-wide too | yes |
| Director | all sites | no | all (company-wide) | yes |
| System Admin | all sites | all | all | no |
| Branch Manager, Store Manager | own site | own site | own site's shifts | no |
| Department head | the departments they head | those departments | no | no |
| Accountant, staff, Store Attendant | none (own shifts only) | no | no (read list only) | no |

## Layout

```
rota/
  rota.constants.ts  rota.types.ts  rota-fields.ts  rota-days.ts  rota-scope.ts  rota-http.ts
  rota-controller.ts  rota-routes.ts
  templates/   repository, service, update-service, rules (window, fit, view), validators, controller
  weeks/       repository, read-service, grid (pure), cost (pure), print-service, my-shifts-service, validators
  cells/       repository, apply (the one write path), cell-plan (pure diff), service, validators
  copy/        copy-plan (pure), copy-service, validators
  warnings/    warnings (pure), leave-lookup (slice 5 plugs in)
  changes/     change-batcher, change-notifier (logs until Notifications exist)
  legacy/      legacy-repository (reads legacy tables), legacy-carry-over
```

Tables: `shift_templates`, `shift_template_departments`, `rota_weeks` (a container per site, department and week, no status), `rota_entries` (one shift on one person's day). Migration `20261018132257_workforce_rota`. Prove it on a copy of the lane database with `backend/scripts/proof/rota-migration-proof.sh` (drops the new tables in the copy, adds legacy fixtures, runs the migration and the carry-over twice, and checks the legacy tables are identical).

**Existing files touched** (all small): `_shared/workforce-access.ts` (+`rota.template_write`) and its test, `_shared/events.ts` (`rota.published` became `rota.shifts_changed`) and its test, `_shared/audit/audit-actions.ts` (seven `rota.*` actions), `workforce/index.ts` (the rota router and `carryOverLegacyRota`), `workforce-layering.test.ts` (door list), `routes/index.ts` (mount the router), and the Prisma back-relations in `access.prisma`, `inventory/departments.prisma` and `workforce/people.prisma`.

**Size check (18 Oct 2026):** the largest source file is `templates-service.ts` (137 lines), then `cells-apply.ts` (134); the largest test is `rota-flow-db.test.ts` (210). The fullest folders: `rota/` 9 files and 7 folders, `weeks/` 7, `templates/` 6, `cells/` 5 (plus tests).

## Coupling

Reads people through the People door (`payAmountOn`), the Rules store (`WEEK_AND_BREAKS`, `LEAVE.minimumCover`), the access table and the audit writer. Reads `employee_moves` for "sent to another site". Later slices: Attendance (slice 3) moves the clock onto `rota_entries`; Leave (slice 5) registers `registerLeaveLookup`.

## Tests

Unit: warnings, the cell diff and copy plan, day rules, the change batcher, the access matrix. Routes: 42 cases (401, 403, envelope, 400, no publish route). Database: `rota-flow-db.test.ts` runs 9 flows against the lane database (templates and permissions, a five-person week, warnings and overrides, cost gating, cross-site, copy with a clash, reasons and past days, change notices, carry-over twice, legacy tables unchanged, audit chain). Over HTTP the role proof ran 44 checks with the real logins.
