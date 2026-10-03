# Wendo RMS roadmap: modules, rules and order

Agreed with the owner on 3 Oct 2026. This is the whole-product plan. Inventory's own step list is [features/inventory/roadmap.md](features/inventory/roadmap.md). The per-feature process (design, approval, build) is [FEATURE_REDO_PLAYBOOK.md](FEATURE_REDO_PLAYBOOK.md).

## The target: 10 modules

Today there are 34 controllers and 33 route files, grouped by layer and, on the frontend, by role (`/manage`, `/director`, `/accountant`, `/admin`, `/hr`). The target is 10 modules. Each owns everything about its feature, on both sides of the wire.

| # | Module | Holds | Replaces (today) |
|---|---|---|---|
| 1 | **Access & Organisation** (platform) | Login and tokens, users and roles, Company, Branches/Sites, locations, departments, settings. Every module's access table follows the Central Store pattern. | auth, branch, location, department, staff roles, director/manage settings |
| 2 | **Notifications & Audit** (platform) | Push delivery (FCM), the incident/audit trail, idempotency keys | fcm, incident, idempotency |
| 3 | **Workforce** | Sub-modules: staff, HR (profiles, contracts, leave, discipline, documents), transfers, scheduling, attendance (clock), payroll and payslips | hr, staff, staff-transfer, shift, shift-assignment, clock, payslip |
| 4 | **Menu & Pricing** | Menu items, categories, branch menus, delivery zones, discount definitions | menu, delivery-zone, discount |
| 5 | **Orders** | Create and edit, cart, split payment, corrections, modification requests, **and all approval flows as a sub-module** (cancellation, modification, staff discount, customer discount, house-account charge) | order, order-correction, modification-request, split-line, five *-auth services |
| 6 | **Fulfilment (Kitchen & Bar)** | Prep tickets, kitchen and barista screens, print stations and jobs. Named "Fulfilment" so it is never confused with Inventory's Prep. | prep-ticket, print |
| 7 | **Finance & Receivables** | Three sub-modules: **Accounts** (house, corporate, customer credit, statements, settlements, outstanding balances), **Other income**, **Reconciliation** | house-account, corporate-account, customer-credit, other-income, accountant pages |
| 8 | **Communications** | Direct messages, broadcasts, formal notices, inbox | comms |
| 9 | **Reporting** | Director and Manager dashboards, analytics, branch drill-down, **and the Inventory Dashboard and Reports**. Read-only; the only module allowed to read across the others. | report, director and manage report pages |
| 10 | **Assistant (AI)** | See "The Assistant" below | new |
| – | **Inventory** | Already built this way (11 sub-modules) | – |

(Inventory is the 11th folder but is not counted among the 10 to build. It is in progress.)

## Rules every module follows

1. A module owns its tables. Only its own repositories touch them. The only cross-module database links are to Access tables (company, branch, user, location).
2. One public door: `index.ts` exposes a small set of functions, types and events. Importing another module's internals is forbidden.
3. The rule is enforced in CI (a lint rule or `dependency-cruiser`). A forbidden import fails the build.
4. Dependencies point downward and never loop: Access and Notifications, then Workforce / Menu / Communications, then Finance, then Orders, then Fulfilment, with Reporting reading from all. Fulfilment learns about orders through an event ("order submitted"), not a call from Orders.
5. Every module has an access table (role by capability), a README with status, endpoints and coupling, and a design pass approved by the owner in Paper before building.
6. Frontend pages are grouped by feature. The role decides what a person sees inside a feature. Old URLs get redirects.
7. Migrate in place behind the same endpoints. For Orders and Fulfilment, write tests that pin today's behaviour first (the ticket-splitting and duplicate-line rules in CLAUDE.md), then move code.

## Order

| Step | Work | Notes |
|---|---|---|
| 0 | **Inventory** (steps 1–9 in [features/inventory/roadmap.md](features/inventory/roadmap.md)) | In progress. Its Dashboard and Reports step moves to Reporting (step 7 below). |
| 1 | **Company and Branch foundation** (see next section), run right after Inventory step 1 (the Paper catch-up, design-only, so it conflicts with no code) and before the owner's pending local edits are merged, pushed or deployed | Slot confirmed by the owner, 3 Oct 2026 |
| 2 | **Access & Organisation + Notifications & Audit**: move the auth core with no behaviour change; rebuild the branch, user and settings screens | Then Assistant layer 1 can start |
| 3 | **Workforce** | Staff and HR first, then scheduling and attendance, then payroll |
| 4 | **Menu & Pricing** | Small; Orders depends on it |
| 5 | **Communications** | Assistant layer 3 delivers through it |
| 6 | **Finance & Receivables** | Accounts, Other income, Reconciliation |
| 7 | **Reporting** (including the Inventory Dashboard and Reports) | Assistant layer 2 needs it |
| 8 | **Orders** (with approvals) | Revenue-critical; pin behaviour with tests first |
| 9 | **Fulfilment** | Last, revenue-critical |
| 10 | **Assistant**, delivered in layers (below) | Layers interleave with the steps above |

## How the work runs: parallel lanes

Decided 3 Oct 2026. Up to **three lanes** at once (what the owner can review). A lane is one agent session on its own branch in its own git worktree, with its own ports, database, Redis and browser, so lanes cannot overwrite or disturb each other. The mechanics (`scripts/lane.sh`, port scheme, merge queue, lane brief template) are written in `docs/PARALLEL_WORKFLOW.md` by the tooling session below.

- **Light setup** because the owner's machine has about 15 GB of RAM (about 6 GB already in use): one shared Postgres server with one database per lane (cloned from a seeded template), one small Redis per lane, and the API, worker and frontend run directly with `pnpm` (no Docker image per lane).
- **A design lane runs ahead** of the build lanes so builds never wait on Paper. Only one agent edits the Paper file at a time.
- **The Company/Branch rename runs alone** (it touches about 197 files), in the window right after the Paper catch-up.
- **Lanes merge one at a time**: rebase on `main`, re-run the gates, owner approves, merge.

Pilot (now): two lanes at once, neither touching app code, so they cannot collide:

| Lane | Session | Brief |
|---|---|---|
| Tooling | Lane tooling: scripts, per-lane environment, workflow doc, module-import CI check, per-module Prisma schema files | [sessions/pilot-lane-tooling.md](sessions/pilot-lane-tooling.md) |
| Design | Paper catch-up and Purchasing design check | [sessions/pilot-paper-catchup.md](sessions/pilot-paper-catchup.md) |

After the pilot: Company/Branch rename (alone), then fan out to three lanes (Inventory Purchasing build, Access move, and the design lane running ahead).

## Company and Branch foundation

Today the database table `Organization` is really a branch (it holds a branch's address, coordinates and M-Pesa paybill, plus an `isHub` flag for the Central Store). Nothing represents Wendo Coffee Bistro as one company. `organizationId` appears about 3,050 times in 197 backend files and in 186 places in the schema.

Three steps, in one dedicated session, never mixed with feature work:

1. **Add a Company table** above the sites. Every site belongs to the one company. A site has a type: Branch or Central Store. Additive; breaks nothing.
2. **Rename in code only:** `Organization` becomes `Branch` (or `Site`), `organizationId` becomes `branchId`. Prisma `@map` and `@@map` keep the real table and column names, so no data moves. TypeScript strict flags every missed spot.
3. **Check what the compiler cannot see:** raw SQL strings, token claims, API payload field names, the frontend's use of them. Keep the old names in the API until each module is rebuilt.

### What it does and does not give you
It gives a second company a place to live. It does **not** by itself make the system safe to host a second company. Found in the code on 3 Oct 2026, to be fixed in a separate "multi-company readiness" pass once Access is rebuilt:

- Menu items and categories have no owner field, so they are global: a second company would share and edit the first company's menu.
- The branch list (`branch-repository`) returns every site with no company filter, so Director-level views would show another company's branches.
- The Central Store rule is "one hub" enforced globally. It must become "one per company".
- Roles that span branches (Director, System Admin) need a company boundary.
- There is no flow to create or onboard a company.

User emails are globally unique, which is fine. Branch-level data is already isolated by branch id.

## The Assistant (AI), delivered in layers

A module that sits on top of the others. It can only call other modules' public doors with the same permission checks as the person using it, so it cannot bypass anything. It starts with managers and the desktop roles.

| Layer | What | Needs | Rule |
|---|---|---|---|
| 1 | **Guide**: answers "how do I…?" from our docs and the user's own role and access table | Access (step 2) | Read-only. Touches no business data. |
| 2 | **Ask your data**: "what did Town sell last week?", "what is below restock level?" via Reporting's public functions as typed tools | Reporting (step 7) | Read-only. Never writes SQL. Branch scope comes from the session, never from the model. |
| 3 | **Proactive insights**: daily digest of stock variances, waste spikes, late deliveries, invoices coming due, sent to the inbox | Communications (step 5), Reporting | Scheduled jobs (BullMQ is in the stack). |
| 4 | **Drafting**: a purchase order from restock levels, a broadcast, a shift plan | Purchasing rebuilt, Orders | A person reviews and confirms; goes through the normal API and checks. |
| 5 | **Actions on a person's behalf**, after confirmation; audit marks them "via assistant" | Orders (step 8) | **Never** money movement, approvals or anything PIN-signed. Those stay human. |

Other ideas to consider later: photo-to-entry for supplier invoices and delivery notes (paper records matter for this client), and Swahili/English for attendants on phones.

Guardrails from the start: HR and payroll data excluded by default; text read from supplier documents or messages is untrusted; a usage cost cap; a fixed set of test questions guards quality; every tool call is written to the audit trail. The chat panel needs its own Paper design pass before layer 1 is built.
