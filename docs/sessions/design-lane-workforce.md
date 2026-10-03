# Design lane: Workforce (audit, critique, proposal, then Paper designs)

Paste this whole file as the first message of a new agent session. This is the **design lane** for the whole Workforce module. You begin as a critic, not a drawer: you study what exists, judge it as an expert and experienced product designer, propose how the module should be structured and how it should work, get the owner's approval, and only then draw screens. You write **no application code**.

**Start only after the Paper catch-up session has finished** (it has: PR #69). Only one agent edits the Paper file at a time.

## Step 0: isolate yourself (do this before anything else)
You need to see the current app running, so use a lane, not just a worktree: `scripts/lane.sh list`, then `scripts/lane.sh up 3 docs/workforce-design` (lane 3, so you never collide with a code lane on lane 1 or 2). Work only in that worktree, on that lane's ports, database and browser profile (`lane3.localhost:3103`). Never in the owner's main folder (`~/Projects/V3-RMS`), which holds the owner's uncommitted files. Never touch production or its data. Do not touch the owner's untracked files or any process you did not start. You run the app to look at it; you do not change application code.

## The goal
A Workforce module that is **premium, clean, precise and architecturally sound, visually excellent, with minimal clicks and taps**: intuitive, **mistake-proof**, reliable, with a premium look and feel and excellent interactivity. The current feature is poor: staff, HR, leave, discipline, transfers, scheduling, clock, payroll and payslips are scattered across the codebase and badly designed, and the production front end looks bad.

Context from the client (3 Oct 2026), an input to your priorities and not a prescribed order: they want to **manage workforce scheduling and time tracking**; the problems today are scheduling staff and recording when they clock in and when their shifts end; they want to **track hours per staff member** and have those hours **affect pay**: deductions (for example lateness or missed time) and **overtime pay**.

## Read first
- `CLAUDE.md` (rules 12–14), `docs/ROADMAP.md` (Workforce row, "Rules every module follows", lane plan), `docs/PARALLEL_WORKFLOW.md` (including "Finish: merge and clean up").
- `docs/FEATURE_REDO_PLAYBOOK.md` §5 steps 1–2 and §3, `docs/DESIGN_SYSTEM.md`, `docs/UI_BUILD_RULES.md`.
- How Inventory was designed and structured, as the pattern to build on: `docs/features/inventory/README.md`, `docs/features/inventory/decisions.md` ("Access"), `backend/src/modules/inventory/_shared/central-store-access.ts` (one access table, role by capability).
- **Load the `emil-design-eng` skill** (UI polish, interaction and animation decisions) before you write the interactivity artboard, and apply it throughout.
- The Paper file "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. Load the Paper guide first (`get_guide`), then `get_basic_info`, and `get_font_family_info` before any typography. Use `get_computed_styles` and `get_jsx` for exact values, never screenshots.

## Phase 1: Understand what exists (read only)
- **Docs:** `docs/archive/phases/` files `HR_MODULE_CONTEXT.md`, `HR_PROFILE_OVERHAUL.md`, `HR_STATUTORY_IDS_AND_ID_UPLOAD.md`, `DEPARTMENT_HEAD_SHIFT_SCHEDULING.md` (+ `_SESSION_B`), `PHASE_9_PAYSLIP_PLAN.md`, `PHASE_9_PAYSLIP_REDESIGN.md`, `PAYSLIP_VIEW_GATE.md` (history, not current guidance), and the Workforce parts of `docs/PRD.md` and `docs/API_CONTRACT.md`.
- **Code, and how scattered it is.** Make a complete map of every route, endpoint, service, repository, model and page that touches: staff, HR (profiles, contracts, statutory IDs, documents), leave, discipline, transfers, departments, scheduling and shifts, clock, payroll and payslips. Start from: `hr-service`, `staff-service`, `staff-transfer-service`, `shift-service`, `shift-assignment-service`, `clock-service`, `payslip-service`, `department-service`; models in `backend/prisma/schema/` (the folder; `workforce.prisma` and neighbours): `Shift`, `ShiftAssignment`, `ClockRecord`, `Payslip`, `EmployeeProfile`, `ContractType`, `LeavePolicy`, `LeaveBalance`, `LeaveRequest`, `DisciplinaryRecord`, `HrDocument`, `StaffTransfer`; pages `frontend/app/app/hr/*`, `shifts`, `department/shifts`, `clock`, `payslips`, `manage/shifts`, `manage/staff`, `manage/payslips`, `performance`. Note where one task lives in several role folders.
- **How hours relate to pay today.** Verify, do not assume: a `Payslip` stores `overtime`, `incentives`, `allowances` and a free-form `otherDeductions` as amounts typed by hand, and a search of the schema found no lateness, grace-period or overtime-rule fields. Confirm by reading the services.
- **The screens, as people see them.** The production front end is the same code as `main`. Look at it on your lane, never on production: `scripts/lane.sh` gives you the database cloned from the template; seed the HR demo data into **your lane's database only** (`backend/src/scripts/seed-hr-demo.ts` and `seed-employee-profiles.ts`; read them first). The local logins are `*@wendo.test` with password `password123` for the roles that exist (for example `admin@`, `director@`, `bm.town@`, `accountant@`); if a Workforce role (HR, department head, waiter, barista) has no login, create one in your lane's database. Walk **every role through every Workforce task on desktop and on a phone-sized screen** with the browser tools, and record click and tap counts and anything confusing, slow or broken. If something cannot be reached, tell the owner and ask for a production screenshot.

## Phase 2: Critique, as an expert and experienced product designer
Write `docs/features/workforce/audit-and-critique.md`:
- **The scatter map** from Phase 1 (a table, not prose).
- **Code structure:** keep it short; the owner already knows it is scattered and that this is why the module is being redone. State the main problems in a few lines.
- **User flows:** per role, for the main tasks (for example clock in, build a rota, swap or correct a shift, approve leave, review hours, run payroll, read a payslip, record a disciplinary action, transfer staff), the **number of clicks or taps**, the dead ends, the places a mistake is easy and costly, and the information the person lacks at the moment of deciding.
- **Screen designs:** what is cluttered, inconsistent, slow, unclear, unfriendly on a phone, or not premium, with screenshots.
- **What to keep:** rules and behaviours that are right and must survive (for example the payslip view gate, statutory deductions).

**STOP 1.** Give the owner a short plain-English summary, with the file path, and wait for the owner's reactions before Phase 3.

## Phase 3: Proposal
Write `docs/features/workforce/proposal.md` and build a Paper page "Workforce · Proposal" for the flow diagrams. Recommend, with reasons, and show alternatives you rejected:
- **Module structure.** Does Workforce need sub-modules, and if so which? Name them for what people do, as Inventory does. Say where each current service goes, and what the boundaries between sub-modules are (what each owns; the public door each exposes). Backend and frontend folder structure: `backend/src/modules/workforce/<sub>/` and `frontend/features/workforce/<sub>/`.
- **User flows**, redesigned task by task, each with a **click and tap budget** (the number you commit to). Aim for the fewest steps that remain safe. Both desktop and phone where the role uses a phone.
- **Screen and interaction direction:** layout patterns, navigation (the new Workforce sidebar follows the file-tree pattern: a spine from each group label, branches, chevrons, links a role cannot open are hidden), information design, and your ideas for what would make it excellent.
- **Mistake-proofing**, designed in, not bolted on. Prevent errors where you can, and make the rest easy to recover from:
  - validate before submit and explain in plain words; sensible defaults; no free typing where a choice works;
  - locked periods and states where an edit would be dangerous (for example a closed pay period), with a clear, audited way to reopen;
  - **undo and delete actions wherever they are needed:** an undo window after reversible actions, a confirmation that names what will be affected for destructive ones, soft delete or archive with a restore in preference to permanent deletion, and a reason recorded for corrections and overrides;
  - everything that changes pay, hours, leave balances or records leaves an audit trail.
- **Reliability:** for example a clock-in must never be lost or doubled (idempotent, works on a poor connection), and money-affecting calculations show their working.
- **Access:** a draft access table, role by capability, as for the Central Store.
- **Open questions** for the owner, each with your recommendation (for example: who builds the rota, how staff clock in, whether breaks are paid, grace periods and rounding, what counts as overtime and whether a manager approves it first, salaried and casual staff, how leave and public holidays enter the hours). Do **not** hard-code labour-law numbers (overtime multipliers, rest-day and holiday rates, deduction limits): Kenyan law sets rules here and the client's accountant must confirm them, so design them as settings.

**STOP 2.** Summarise for the owner and wait for approval of the structure and the flows before drawing screens.

## Phase 4: Screens in Paper
Design the approved flows workflow by workflow, in the order you proposed (the client's priority is an input to that order). Each workflow: build in Paper on its own page, chapters in flow order, desktop and phone where used; the owner approves before the next workflow starts; record the approval in the sub-module's README under `docs/features/workforce/`.

Paper conventions from the Inventory work still apply:
- one reusable loading, empty and error "states kit" plus a copy table, never an artboard per screen per state;
- a visual check per artboard as you build it, not at the end; no automated pixel diffs; use `get_computed_styles` and `get_jsx` for values;
- copy the approved sidebar master ("Sidebar · Store Manager · Stock & counts active" and the nav states in "Parts · sidebars" and "Parts · sidebar nav states") for new screens; never redraw the old embedded sidebars;
- end Paper edits with `finish_working_on_nodes`; never show raw node ids to the owner.

### The interactivity artboard
Paper cannot animate, so make **one artboard for the whole module**, "Workforce · Interaction spec", that tells the builder exactly how things behave. For each screen or component: the trigger, the response, the timing and easing, and every state (loading, success, error, empty, disabled, offline); tap targets and gestures; keyboard behaviour; feedback (toasts, confirmations, undo windows) and how errors recover; optimistic updates (for example a clock-in responds instantly); transitions between screens. Follow the `emil-design-eng` skill. Keep it a specification a developer can build from, not a gallery.

## Boundaries (flag these, do not design around them)
- Workforce reads people, sites or branches and roles from Access & Organisation, and sends push notifications through Notifications & Audit. It does not own login. Settle what an employee record holds versus what the login account holds.
- Reporting will read Workforce numbers later; design only what a manager needs to run the rota, hours and payroll.
- The future AI Assistant excludes HR and payroll data by default; nothing to design for it now.
- The Company/Site rename may be running at the same time on another lane. You audit the code as it is on `main`; names such as `Organization` may change. Refer to concepts, not to the old names, in your documents.

## Deliver
`docs/features/workforce/audit-and-critique.md` (Phase 2), `docs/features/workforce/proposal.md` and the Paper proposal page (Phase 3), then the Paper designs, the interactivity artboard, the draft access table and the owner's recorded approvals (Phase 4). After each phase, a plain-English recap: what you found or made, where it is, which questions are open, and what the owner must approve.

## Rules
Edit repo files with Edit/Write only, with a `Why:` line before each. Commit only your own files with explicit paths and the `Co-Authored-By` trailer; open a PR for the docs. When the owner says "merge", finish with the checklist "Finish: merge and clean up" in `docs/PARALLEL_WORKFLOW.md` (merge, `scripts/lane.sh down 3`, delete your branch, update the owner's `main` only if it is safe, check the deploy, recap). Until the owner says so, do not merge. Never edit existing approved pages in the Paper file except where this brief says; new Workforce work goes on new pages.
