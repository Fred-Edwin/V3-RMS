# Design lane: Workforce (Paper walkthroughs and owner approval)

Paste this whole file as the first message of a new agent session. This is the **design lane**: it produces walkthrough briefs and Paper designs for the Workforce module and gets them approved by the owner. It writes **no application code** and runs no servers, so it never collides with a code lane.

**Start only after the Paper catch-up pilot session ([pilot-paper-catchup.md](pilot-paper-catchup.md)) has finished.** Only one agent edits the Paper file at a time.

## Step 0: isolate yourself (do this before anything else)
Work in your own git worktree, never in the owner's main checkout (`~/Projects/V3-RMS`), which holds the owner's uncommitted files and other sessions. Use the EnterWorktree tool, or: `git fetch && git worktree add ~/Projects/V3-RMS-lanes/workforce-design -b docs/workforce-design origin/main`, then do every repo read and edit from that folder. (Paper itself is not in the repo; the Paper MCP works the same from any folder.) If `docs/ROADMAP.md` is missing there, stop and tell the owner. Do not touch the owner's untracked files. Leave the worktree in place until the owner has merged your PR.

## Why Workforce, and what the client asked for
Priority module (client request, 3 Oct 2026). In the owner's words: the client wants to **manage workforce scheduling and time tracking**. Today the problems are scheduling staff, and recording when they clock in and when their shifts end. They want to **track how many hours each staff member works**, and those hours must **affect pay**: deductions (for example lateness or missed time) and **overtime pay**.

## Read first
- `CLAUDE.md` (rules 12–14), `docs/ROADMAP.md` (Workforce row, "Rules every module follows", lane plan).
- `docs/FEATURE_REDO_PLAYBOOK.md` §5 steps 1–2 (walkthrough brief, walkthrough in Paper, owner approval), §3 (design direction).
- `docs/DESIGN_SYSTEM.md` and `docs/UI_BUILD_RULES.md` (screens, states, shells, tables).
- How the Inventory designs were built and how its Central Store sidebar and access table work: `docs/features/inventory/README.md`, `docs/features/inventory/decisions.md` ("Access"), and `backend/src/modules/inventory/_shared/central-store-access.ts`. Workforce follows the same pattern: one access table, role by capability.
- What exists today (read the code and old docs; do not redesign from memory):
  - Backend services: `hr-service`, `staff-service`, `staff-transfer-service`, `shift-service`, `shift-assignment-service`, `clock-service`, `payslip-service`, `department-service`.
  - Data models in `backend/prisma/schema.prisma`: `Shift`, `ShiftAssignment`, `ClockRecord`, `Payslip`, `EmployeeProfile`, `ContractType`, `LeavePolicy`, `LeaveBalance`, `LeaveRequest`, `DisciplinaryRecord`, `HrDocument`, `StaffTransfer`.
  - Pages: `frontend/app/app/hr/*`, `shifts`, `department/shifts`, `clock`, `payslips`, `manage/shifts`, `manage/staff`, `manage/payslips`, `performance`.
  - History (not current guidance): `docs/archive/phases/` files `HR_MODULE_CONTEXT.md`, `HR_PROFILE_OVERHAUL.md`, `DEPARTMENT_HEAD_SHIFT_SCHEDULING.md` (+ `_SESSION_B`), `PHASE_9_PAYSLIP_PLAN.md`, `PHASE_9_PAYSLIP_REDESIGN.md`, `PAYSLIP_VIEW_GATE.md`.
- The Paper file "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. Load the Paper guide first (`get_guide`), then `get_basic_info`, `get_font_family_info` before any typography. Use `get_computed_styles` and `get_jsx` for exact values, never screenshots.

## What the code does today (verify before you rely on it)
- A shift is a name plus a start and end time; a `ShiftAssignment` puts one person on a shift for a date; a `ClockRecord` holds clock-in and clock-out times, the method, and a manager override with a note.
- A `Payslip` stores `overtime`, `incentives`, `allowances` and a free-form `otherDeductions` as **amounts typed by hand** on the payroll sheet. A search of the schema found **no lateness, grace-period or overtime-rule fields**, so worked hours do not drive pay today. That link is the new feature. Confirm this by reading `clock-service`, `payslip-service` and `hr-service` before designing.

## Process (per batch)
For each batch below: (1) write a **walkthrough brief** in `docs/features/workforce/<sub-module>/walkthrough.md` (who does what, step by step, every role, every rule, open questions); (2) get the owner's answers to the questions; (3) build the walkthrough in Paper on its own page (chapters in flow order, desktop and phone where the role uses a phone); (4) a draft access table (role by capability); (5) the owner approves; (6) record the approval in the README for the sub-module. Do not start the next batch's Paper work before the current batch is approved, but you may write the next batch's walkthrough brief and questions while waiting.

Paper conventions from the Inventory work still apply: one reusable loading, empty and error "states kit" plus a copy table, not an artboard per screen per state; a visual check per artboard as you build, not at the end; no automated pixel diffs; end Paper edits with `finish_working_on_nodes`; never show raw node ids to the owner. New Workforce sidebar follows the file-tree pattern (a spine from each group label, curved branches, chevrons, links a role cannot open are hidden).

## Batch 1: Schedule & time (first; the client's main ask)
Design: the rota (who works which shift on which day; who builds it: department heads and managers), shift patterns, clock in and clock out (what staff do on their phone or at a branch device, missed clock-out, manager override), and the **timesheet**: per person and per period, scheduled hours versus worked hours, late arrivals, early leaves, missed clock-outs, overtime hours, and a way for a manager to review and correct exceptions with a reason. Also the manager's live "who is in right now" view.

Ask the owner (batched, each with your recommendation) before drawing:
1. Who builds and publishes the rota, and can staff swap shifts?
2. How do staff clock in (own phone, a shared branch tablet, PIN, QR, location check)? Look at what `ClockMethod` allows today.
3. Are breaks paid or unpaid, and are they recorded?
4. Is there a grace period for late arrival, and what rounds the worked time (to the minute, to 5 or 15 minutes)?
5. When is time overtime: past the scheduled shift end, past a daily limit, past a weekly limit? Does a manager have to approve overtime before it counts?
6. Are some staff paid by the day or hour (casuals) and others a monthly salary? Do both get timesheets?
7. How do leave, public holidays and rest days appear on the rota and in the hours?
8. Which roles see whose hours (staff see their own; department head their team; manager the branch; HR and accountant all)?

## Batch 2: Hours to pay
Design: pay rules the owner or HR can set (overtime rate, lateness or missed-time deduction rule, rounding), the step that turns approved timesheet hours into **overtime pay and deductions on the payslip** with every line explained and overridable with a reason, the payroll sheet, payslips (staff view, the existing payslip view gate), and locking a pay period. Statutory deductions already on the payslip (PAYE, SHA, NSSF, housing levy, HELB) stay; confirm with the owner and accountant how they interact.

Do **not** hard-code labour-law numbers (overtime multipliers, rest-day and holiday rates, deduction limits). Kenyan employment law sets rules here, and the client's accountant must confirm them; put them in the questions for the owner and design the screens so rates are settings, not constants.

## Batch 3: People
Design: the staff directory and profiles, contracts and contract types, leave policies, balances and requests (and how approved leave shows on the rota and the timesheet), disciplinary records, HR documents and ID upload, staff transfers between branches. Settle what an employee profile holds versus what the login account holds (login belongs to Access & Organisation; the employee record belongs to Workforce).

## Boundaries (do not design around these; flag them)
- Workforce reads people, branches and roles from Access & Organisation, and sends push notifications through Notifications & Audit. It does not own login.
- Reporting will read Workforce numbers later; do not design dashboards here beyond what a manager needs to run the rota and timesheets.
- The future AI Assistant excludes HR and payroll data by default; nothing to design for it now.

## Deliver
Per batch: the walkthrough brief doc, the Paper page, the draft access table in the sub-module README under `docs/features/workforce/`, and the owner's written approval recorded in that README. Plain-English recap at the end of each batch: what is in Paper (which page, which artboards), which questions are still open, and what the owner must approve.

## Rules
Edit repo files with Edit/Write only, with a `Why:` line before each. Commit only your own files with explicit paths and the `Co-Authored-By` trailer; open a PR for docs; do not merge it. Never edit existing approved pages in the Paper file except the sidebar parts the Paper catch-up session already owns.
