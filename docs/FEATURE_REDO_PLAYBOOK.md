# Feature Build Playbook

**Status:** Active governing process
**Owner:** Edwinfred Kamau
**Started:** 2026-09-07 · **Rewritten:** 2026-10-20 (after Inventory and Workforce; replaces the earlier version)

How Wendo RMS is rebuilt, feature by feature, into a premium enterprise product with a new design system and a modular codebase. **Every feature follows this process. Read it before starting feature work or writing an agent-session brief.** The file keeps its old name because other documents link to it; section numbers §5, §7, §9 and §11 are cited elsewhere and stay stable.

Related documents:
- `CLAUDE.md`: agent briefing, points here.
- `docs/process/templates/`: the reusable briefs (§12). **Start every new session from a template.**
- `docs/PARALLEL_WORKFLOW.md`: lanes, ports, the merge queue (the how-to for `scripts/lane.sh`).
- `docs/CODING_STANDARDS.md`: enforceable code rules. `docs/UI_BUILD_RULES.md`: building screens against Paper. `docs/DESIGN_SYSTEM.md`: tokens and primitives.
- `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`: contract and schema of record.
- `docs/features/<feature>/README.md`: the living spec of a feature. **Inventory and Workforce are the two worked examples.**
- `docs/archive/INDEX.md`: history, not guidance.

---

## 1. Why

The code is healthy (strict TypeScript, a large passing test suite) and does not need a rewrite. But the UI reads as amateurish, months of real use have taught us how staff work, and a layer-grouped back end is hard to navigate. We replace each feature **in place**, one at a time, with production kept running and a rollback path at every step.

## 2. Principles

- **Design first, approved by the owner, before any code.** Most past rework came from building the wrong thing, not from building it badly.
- **Paper is the source of truth for screens and flow order.** Approved artboards live in the file "Wendo RMS · Approved designs". Documents never re-describe screens.
- **Paper is a demonstration; production is the goal (owner, 19 Oct 2026).** The designs let the owner understand and approve how a feature works. They are not a complete list of what production needs. Back-end and front-end agents deliver a **production-ready** feature and add what real use needs that Paper does not show (every loading, empty, error, locked and no-permission state; a wrong PIN; two people acting at once; scale; failed exports; keyboard and screen-reader use; validation, idempotency, audit, migration of existing data). They **log every addition** in the decisions file and the final report. They never invent business behaviour the approved flows do not cover without logging the choice.
- **Spec before build.** A spec file written from the approved screens (§5, step 4) is what both build sessions follow. Front ends built from a spec needed no design corrections.
- **Keep production working.** New code is additive; old code keeps running until its replacement ships, behind a per-site switch where the feature is live (§7).
- **Decide by default, log it.** Sessions choose their recommendation on anything the owner could answer, record it (*question, choice, why, what changing it takes*), and stop only if truly blocked or the choice is expensive to reverse. The final message opens with the decisions table.
- **Docs describe how the system is now, beside the code.** Working documents are temporary and deleted when their work ships (§11).
- **Tests are classified**, not blindly kept or deleted.

## 3. Design direction

Premium enterprise product: Linear / Stripe / Apple as the bar. Dense but legible, ledger-like, crisp (small radii), the fewest taps per job, a real sidebar everywhere, a few restrained creative touches. Codified in `DESIGN_SYSTEM.md` (coffee-inspired: espresso `#693C1B`, caramel, near-white, Geist / Geist Mono, 2px radii). **Amber means in progress or needs you; a selected row is neutral grey with a dark bar, never amber.**

## 4. Design system foundation (complete)

Tokens in `frontend/app/tokens.wds.css` + `frontend/tailwind.wds.preset.ts` (`wds-` prefix). A feature's redo moves its pages from `components/ui/` to `components/ui2/`, never a bulk swap. Never touch `components/ui/` (frozen). Feature kits (for example `frontend/features/workforce/_shared/`) hold the shared screen parts: **reuse them, build a new part only if Paper shows something none covers.**

## 5. The per-feature pipeline

A big feature is cut into **segments**: groups of related chapters that can be specified, built and reviewed together. Each segment runs steps 3 to 7. Steps 1 and 2 happen for the whole feature first.

### Step 1: Plan and flow brief
An agent plays the relevant domain expert. It studies how the flow works today (code, real-use findings, the client's paper records) and sends a **proposal**: how it works today, what is weak, the proposed flows in chapters, roles and who-can-do-what, what stays, changes, is new or removed, and numbered open questions each with a recommendation. No drawing until the owner approves the direction. Template: `docs/design-briefs/` (and the Workforce `proposal.md` as a worked example).

### Step 2: Design in Paper ⟶ OWNER APPROVES
Chapters in story order (a step is a caption plus a screen; each dialog or drawer is its own step over a dimmed parent; one running example with consistent numbers; a "When things go wrong" chapter). Chapters are reviewed in **groups**. When the owner wants changes, a **design pass** redraws them and records the decisions (`design-pass-<n>-<topic>.md`). **The owner approves; only approved chapters are built.**

### Step 3: Segment review (orchestrator)
For each segment the orchestrator reads the approved screens and design notes and writes a one-page review: what the back end and front end must do, what already-built code changes or is removed, Paper housekeeping found, defaults chosen. Template: `templates/segment-review.md`. The owner nods or corrects it.

### Step 4: Spec session
One session with Paper access writes the **spec file** for the segment (no application code): for each screen, **what Paper shows** (exact values mapped to `wds-` tokens and kit components, exact copy), **what production adds**, and **what the server must provide** (field-level data and actions, rules, concurrency, who may act); plus the status machine, documents and exports, permissions table, notifications and audit, accessibility and a gap list. It logs its business choices in a decisions file and lists inconsistencies found in Paper without editing Paper. Template: `templates/spec-session-brief.md`. **Anything the old system does that the new feature must coexist with (rollout, double processing) is settled here.**

### Step 5: Back-end brief and session
The orchestrator writes the brief from the spec; one session builds the back end (no frontend files): migrations, services, endpoints, access-table capabilities, audit and events, tests, **a per-role HTTP proof with real logins**, **one end-to-end flow checked in the database**, migration proof on a copy, and a decisions table. A very large back end is split into two sessions (for example engine first, then publish and exports). Template: `templates/backend-brief.md`.

### Step 6: Front-end brief and session
Runs after the back end it needs (the back end is always one step ahead). The session builds from the spec and the real API: screens assembled from the kit, **one Paper screenshot per screen** (not per component or dialog), every production state, the safety property proven with the feature switch off, a decisions table. Template: `templates/frontend-brief.md`.

### Step 7: Merge, review, approve
The orchestrator merges the segment's branches once (conflicts are usually status docs, the access table, the capabilities list, nav rows and the time-zone test script), runs the type checks and the affected tests, pushes the branches as a backup, and updates the status documents. The owner walks the screens and approves. **Segment done = approved.**

### Step 8: Ship (per feature, when its segments are done)
A tidy-up and ship-preparation session splits any file still over the limits, fixes loose ends and writes the ship checklist (migrations in order, a rehearsal on a restored production copy run by the owner, the pull request plan, the switch-on plan with rollback, known risks). Deploy via CI/CD (push to `main`). **The owner watches a real user use the feature.** Not done until then.

### Step 9: Close out docs
Update sub-module READMEs, `decisions.md`, `DATA_MODEL.md`, `API_CONTRACT.md` (mark shipped), `PROJECT_STATUS.md` and `CLAUDE.md`'s current-work pointer. Delete the working documents (§11).

> Old numbering used by Inventory documents: walkthrough brief (step 1), Paper walkthrough (step 2), component inventory (now inside the spec), high-level plan (steps 3 and 4 here), freeze the contract (now the spec's "server must provide" plus the API contract section), build sessions (steps 5 and 6), integration (now inside the front-end session's end-to-end flow), migrate and deploy (step 8).

## 6. Definition of Done (per segment, then per feature)

- [ ] Owner-approved Paper chapters and design notes
- [ ] Spec file and decisions log written; Paper inconsistencies listed
- [ ] Back end built to the spec; tests passing; per-role HTTP proof; end-to-end flow checked in the database; migration proved on a copy; `check:imports` not worse
- [ ] Front end built from the spec; one visual check per screen; every production state; the feature-off safety property proven; lint, types, tests and build green
- [ ] Code is in `backend/src/modules/<feature>/…` and `frontend/features/<feature>/…`; `app/` pages are thin shells; old code retired or guarded
- [ ] **Each sub-module has a current README**; decisions files complete; `API_CONTRACT.md` and `DATA_MODEL.md` updated
- [ ] Owner walked it and approved
- [ ] (feature level) shipped, switched on at the pilot site, and a real user watched

## 7. Production data, migrations and rollout

- Every feature has live data and live users. The plan **must** include a per-slice migration path and a rollout plan.
- **Additive by default.** Legacy tables and services stay untouched; the only legacy change allowed is a small guard that is written down in the spec.
- **Per-site switch for anything live** (Workforce attendance is the model): off everywhere by default, a pilot site first, switched by one named role, with a guard so nobody is processed by two systems at once, and a rollback that is one click.
- Agents do **not** SSH to the droplet. When production data is needed, the agent lists the exact queries; the owner runs them and pastes results.
- Workflow: edit schema locally → `prisma migrate dev` locally → commit the migration → push → CI/CD runs `prisma migrate deploy`. Prove every migration on a copy of the lane database (legacy tables identical, a second run changes nothing) and, before shipping, on a restored production copy. Never `migrate dev` on production.
- Money and tax: tables ship empty and are typed and confirmed by the right role; the first real result is hand-checked by a person.

## 8. Parallelization and branches

- **Lanes** (`docs/PARALLEL_WORKFLOW.md`): up to three sessions, each with its own worktree, database, ports and browser profile. Open a lane at `http://laneN.localhost:310N`.
- **The back end runs one step ahead of the front end**, in different lanes. Spec sessions for different segments can run at the same time (they write different files).
- **Stacked branches:** each new lane branch is cut from the previous local branch (the top of the stack), not from `main`, so everything built so far is underneath. Briefs and specs live on the stack, so every lane sees them. A session creates its branch as its first action.
- **One merge per segment.** Where two lines of work edit the same shared files, the briefs tell each session to keep edits small and on separate lines and to list them, so the merge is easy.
- **Push every branch to GitHub as a backup** at each hand-off (a branch push never deploys; only a merge to `main` does). Never force-push.
- Two different features are not built in parallel until the process is proven on the first two (Inventory, Workforce): the next feature follows this playbook.

## 9. Folder structure and code rules

A redone feature is **one folder on each side of the wire**, split into **sub-modules** named for what the user does.

```
backend/src/
  modules/<feature>/
    index.ts                    the feature's ONLY public door
    README.md                   feature map
    _shared/                    access table, audit writer, time helpers, events: used by several sub-modules
    <sub>/
      README.md                 spec: purpose, status, roles, endpoints, layout, coupling, decisions
      <sub>-routes.ts  <sub>-controller.ts  <sub>-service.ts  <sub>-repository.ts
      <sub>-validators.ts  <sub>.types.ts  *.test.ts   (tests beside the code)
  shared/                       middleware, config, sockets, jobs, utils, types
  routes/index.ts               wires every module's routes: the one shared touch-point

frontend/
  app/                          ROUTING ONLY: thin page shells
  features/<feature>/
    index.ts                    the feature's public API
    _shared/                    the kit and helpers shared across sub-modules
    <sub>/  components/ hooks/ lib/ services/ store/ types/   + README.md
  components/ui2/               design-system primitives (ui/ is legacy and frozen)
  components/app/shell/         cross-feature shell, the navigation table, generic states
  lib/                          apiClient, socket, cn, tokens
```

Rules (briefs repeat them; most are checked by tests or lint):
1. **Size limits:** source files aim for 250 lines or fewer and never exceed 350 (tests 450 back end, 400 front end). **Folders hold at most 12 files**: group into sub-folders.
2. **No catch-all `utils` or `helpers`.** One main component per file, one job per file, a clear name.
3. **Layers:** router, controller, service, repository, validators and types are separate files. Business logic only in services; database queries only in repositories (a `prisma.$transaction` in a service is allowed). Layering is enforced by a test per feature.
4. **Every route:** `authenticate`, then `requireCapability(...)` from **one access table** (role by capability) for rebuilt features, never a new `requireRole` list; a Zod schema for every input; every query scoped by site (`organization_id`); an audit entry written in the same transaction.
5. **Doors:** other code imports a module only through its `index.ts` (back end) or `features/<x>/index.ts` (front end); `pnpm check:imports` enforces it. No importing another feature's internals.
6. **Front end:** pages in `app/` hold routing only; button visibility comes from the API's permissions, never role names; shared parts come from the kit; one navigation table (`nav-table.ts`) for every sidebar link, with a test that fails if a row shows a link the route gate would block.
7. **Time:** one set of Nairobi time helpers, never server-local dates.
8. **READMEs:** every sub-module README (spec, status, endpoints, coupling) is updated in the same commit as any behaviour change.
9. **Migration to this layout happens as part of each feature's redo,** never as a separate refactor. Restructuring is pure moves with zero behaviour change, proved by build, tests and a registered-route diff.
10. Merge a workflow into another sub-module when the approved design shows one flow.

## 10. Feature order

1. **Inventory & Procurement:** rebuilt and live except the final pass; the first worked example. Status: `docs/features/inventory/README.md`.
2. **Workforce:** designed and approved (17 chapters); built segment by segment (people, rota, attendance, timesheets and rules built; payroll, payslips, leave, conduct and shared parts in progress). The second worked example, and the one that established the spec-first flow. Status: `docs/features/workforce/README.md`.
3. The remaining features follow the 10-module order in [`docs/ROADMAP.md`](ROADMAP.md) (Access & Organisation, Notifications & Audit, Menu & Pricing, Orders with approvals, Fulfilment, Finance & Receivables, Communications, Reporting, Assistant).
4. **Orders and Fulfilment (KDS/BDS) last**: live every day and revenue-critical, so its plan must include a keep-service-running section (per-site switch, additive tables, a guard against double processing, a one-click rollback) before any build starts.

## 11. Documentation strategy

| Kind | Where | Lifetime |
|---|---|---|
| Screen designs and flow order | Paper approved file | Permanent, owner-controlled |
| Sub-module spec | `<sub>/README.md` beside the code | Permanent; updated with behaviour changes |
| Feature map, standing rules, decisions in force | `docs/features/<feature>/README.md`, `decisions.md` | Permanent |
| Contract and schema of record | `API_CONTRACT.md`, `DATA_MODEL.md` | Permanent |
| Process, standards, templates | this file, `docs/process/templates/`, `CODING_STANDARDS.md`, `UI_BUILD_RULES.md`, `DESIGN_SYSTEM.md`, `PARALLEL_WORKFLOW.md` | Permanent |
| Segment specs and decisions logs | `docs/features/<feature>/specs/` | Kept until the feature ships, then the decisions in force move into the READMEs and `decisions.md` |
| Segment reviews, design-pass notes | `docs/features/<feature>/` | Same: kept until the feature ships, then extracted |
| Session briefs, handoffs, run sheets, proof outputs | `docs/sessions/` | **Temporary:** deleted when the segment is merged and approved; first extract any decision still in force. Git is the archive; untracked files are not in git, so commit or back them up first |

Authority when sources disagree: **Paper approved page > spec file (while the feature is being built) > sub-module README > `decisions.md` > code.** When a README's "built today" differs from the approved design, the gap is the redo's to-do list.

## 12. Templates and starting a session

Templates in `docs/process/templates/` (copy, fill the `<…>` parts, commit on the stack):

| Template | Use it to |
|---|---|
| `orchestrator-start.md` | start a planning/orchestrator session for a new feature |
| `segment-review.md` | write the one-page review before a segment's spec |
| `spec-session-brief.md` | brief a spec session |
| `backend-brief.md` | brief a back-end session |
| `frontend-brief.md` | brief a front-end session |

Every build brief carries the same sections, in this order: the standing rule (production-ready, log every addition), where you work (the branch to create or the lane), read-first (only named files), scope in and out, tidy limits, cost rules (no subagents, read only what is named, run only the tests of what you change, full suite once at the end), gates and proof, and the final message format (decisions table first, then a five-line plain-English recap).

## 13. Learnings (keep these in mind when planning)

- **Brief on the right branch.** A brief committed on one lane's branch is invisible to another lane unless the new branch is cut from it.
- **Name Paper nodes in the brief** and ban the Paper "basic info" call (it returns a huge token list): sessions read each frame once.
- **Settle the "old system" question in the spec,** never in the build (who is processed by which system during rollout).
- **Process slips recur** (a missing `Why:` line, `sed` or `cp` used to edit): say it loudly in every brief; they bypass `/rewind` and the owner's review view.
- **Split a very large back end in two** and review the first half (the calculations) before building on it.
- **Merge conflicts are predictable:** the access table, capabilities list, nav rows, status docs and the time-zone test script. Brief each session to keep edits there small.
- **Paper has inconsistencies** (sample figures that do not add up, stale labels). The spec records them and the build follows the owner's decisions, not the sample data.
- **Production needs more than Paper shows:** the spec's "what production adds" list is where it is written down, so the build does not guess.
- **Owner preferences:** do not make the owner wait; finish everything in scope; decide by default; one check per screen, not per component; keep code tidy as it is built, not in a later refactor.
