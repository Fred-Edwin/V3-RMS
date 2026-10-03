# Feature Redo Playbook

**Status:** Active governing process
**Owner:** Edwinfred Kamau
**Started:** 2026-09-07 · **Rewritten:** 2026-10-03 (after Inventory restructure)

How Wendo RMS is rebuilt, feature by feature, into a premium enterprise product
with a new design system and a modular codebase. **Every feature follows this
process. Read it before starting feature work or writing an agent-session prompt.**

Related docs:
- `CLAUDE.md` — agent briefing, points here
- `docs/CODING_STANDARDS.md` — enforceable code rules, backend/frontend layout
- `docs/UI_BUILD_RULES.md` — standing rules for building screens against Paper
- `docs/DESIGN_SYSTEM.md` — tokens and primitives
- `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md` — contract and schema of record
- `docs/features/<feature>/README.md` — the living spec of a redone feature (Inventory is the template)
- `docs/archive/INDEX.md` — history, not guidance

---

## 1. Why

The code is healthy (strict TypeScript, near-zero `any`, a large passing test suite)
and does not need a rewrite. But the UI reads as amateurish, months of real use have
taught us how staff work, and a layer-grouped backend is hard to navigate for a large
app. We replace each feature **in place**, one at a time, behind a migration plan,
with production kept running and a rollback path at every step.

## 2. Principles

- **Design first, approved by the owner, before any code.** Most past rework came
  from building the wrong thing, not from building it badly.
- **Paper is the source of truth for screens and flow order.** The owner approves
  flows as story-ordered walkthrough pages; approved artboards live in the file
  "Wendo RMS · Approved designs". Docs never re-describe screens.
- **Keep production working.** Old code is removed in the PR that ships its replacement.
- **The API contract is a frozen, typed artifact.** It lets backend and frontend run in parallel.
- **New code lands in the new structure** (§9): one folder per side of the wire,
  built on the new tokens. The codebase is half-old, half-new until the last feature moves.
- **Docs describe how the system is now, beside the code.** Working documents
  (plans, prompts, handoffs) are temporary and are deleted when their work merges (§11).
- **Tests are classified**, not blindly kept or deleted: each plan says which stay,
  which are rewritten, which are new.

## 3. Design direction

Premium enterprise product: Linear / Stripe / Apple as the bar. Dense but legible,
ledger-like, crisp (small radii), flows with the fewest taps per job, a real sidebar
everywhere (no "More" bottom-nav), and a few restrained, deliberate creative touches.
The chosen direction (coffee-inspired: espresso `#693C1B`, caramel, near-white, Geist /
Geist Mono, 2px radii) is codified in `DESIGN_SYSTEM.md`.

## 4. Phase 0 — Design system foundation (COMPLETE 2026-09-09)

Tokens explored (3 directions), owner picked and refined one, codified as
`frontend/app/tokens.wds.css` + `frontend/tailwind.wds.preset.ts` (all keys `wds-`
prefixed; the prefix drops when `components/ui/` is retired). `DESIGN_SYSTEM.md`
rewritten around them. `components/ui2/` seeded with 8 primitives; the rest of the
core set is added per feature via the shadcn CLI as screens need it.

Migration rule: **a feature's redo moves its pages from `components/ui/` to
`components/ui2/`, never a bulk swap.** Never touch `components/ui/` (frozen; serves
not-yet-redone pages). When nothing imports it, delete it and rename `ui2/` → `ui/`.

## 5. The per-feature pipeline

Features with several workflows are built as **workflow-based milestones** (a group
of related screens), not phases. Steps 1–2 and 4 have owner approval gates.

### Step 1 — Walkthrough brief
Use the reusable prompt in `docs/design-briefs/` (generic template + worked examples). An agent plays the relevant domain expert. It studies how the flow works today (code,
real-use findings, the client's paper records), then sends a **flow brief** and waits:
how it works today, what is weak from the user's point of view, the proposed flow in
chapters (today / proposed / why), screens kept/improved/new/removed, and numbered open
questions each with a recommendation. No drawing until the owner approves the direction.

### Step 2 — Walkthrough in Paper ⟶ OWNER APPROVES
One Paper page per flow in the working file: Cover, Screens index, then chapters in
story order (a step = caption + screen; each drawer or dialog is its own step over a
dimmed parent; one running example with consistent numbers; a final "When things go
wrong" chapter). Plus a decisions note: who can do what, what happens in each state,
how mistakes are fixed, what changed vs the old design, open questions.
On approval the owner copies the artboards into the matching page of the approved file.

### Step 3 — Component inventory (per build unit)
List every primitive and composite the milestone's screens need, with the Paper node
for each, and which existing pieces are reused rather than rebuilt. Primitives come
from the shadcn CLI; composites are hand-assembled to match Paper via `get_jsx` /
`get_computed_styles`. Rules for sourcing, states and verification: `UI_BUILD_RULES.md`.
This inventory lives in the milestone plan and is deleted with it.

### Step 4 — High-level plan ⟶ OWNER APPROVES
One planning agent reads the approved Paper pages, the decisions note and the current
schema and production data (§7), and produces: data model changes, a per-slice migration
plan, the **API contract** (every endpoint: method, path, request/response, errors, role,
as shared Zod/TS types), the session breakdown with dependencies (§8), test
classification, and the code placement (`backend/src/modules/<feature>/<sub>/` and
`frontend/features/<feature>/<sub>/`, plus the retirement plan for old files).
Output: a temporary `milestone-<n>-plan.md`.

### Step 5 — Freeze the API contract
Commit the contract types and mark it frozen in `API_CONTRACT.md`. **Amendment:** if a
session finds the contract wrong, affected sessions stop, the owner approves the
amendment, sessions resume. Expect one per feature; it is not a failure.

### Step 6 — Build sessions
Each session references the plan, frozen contract, Paper designs, `CODING_STANDARDS.md`,
`UI_BUILD_RULES.md`. Backend builds endpoints to the contract with tests; frontend builds
against mocks of the contract and checks every screen against Paper. The PR for each
slice removes the old code it replaces.

### Step 7 — Integration
A dedicated session wires frontend to real backend and walks every approved flow in a
real browser with real data, confirming ledger/DB effects. Log bugs first, rank by
severity, fix in one pass, re-walk only affected steps.

### Step 8 — Migrate, deploy, observe
Run the migration on a restored production copy first; deploy via CI/CD (push to `main`).
**The owner watches a real user use the feature.** Not done until then.

### Step 9 — Close out docs
Update the sub-module READMEs (status, approved behaviour, endpoints), `decisions.md`,
`DATA_MODEL.md`, `API_CONTRACT.md` (mark shipped), and `CLAUDE.md`'s current-work
pointer. Delete the milestone plan, session prompts and handoffs (§11).

## 6. Definition of Done (per feature or milestone)

- [ ] Owner-approved walkthrough page and decisions note; artboards copied to the approved file
- [ ] Component set in code matches Paper (built on shadcn + tokens)
- [ ] Owner-approved plan; API contract frozen
- [ ] Backend built to contract; tests classified and passing
- [ ] Frontend built to design; per-screen visual and functional checks pass (`UI_BUILD_RULES.md`)
- [ ] Integration session done; every flow works end to end
- [ ] Migration run on a production copy, then deployed via CI/CD
- [ ] Owner has watched a real user use it
- [ ] Code is in `backend/src/modules/<feature>/…` and `frontend/features/<feature>/…`; `app/` pages are thin shells; old code removed
- [ ] **Each sub-module has a current README**; working documents deleted; docs updated

## 7. Production data and migrations

- Every existing feature has live data. The plan **must** include a per-slice migration path.
- Agents do **not** SSH to the droplet. When production data is needed, the agent lists
  the exact queries (counts, samples, enum usage); the owner runs them and pastes results.
- Workflow: edit schema locally → `prisma migrate dev` locally → commit the migration →
  push → CI/CD runs `prisma migrate deploy`. Test every migration against a restored
  production backup first. Never `migrate dev` on production.
- Precedent to avoid: the reverted March 2026 V2.1 inventory build left orphaned schema
  in production that needed a cleanup migration.

## 8. Parallelization

- **Serial:** walkthrough → plan → freeze contract; and integration → deploy → observe.
- **Parallel (after the contract is frozen):** backend and frontend sessions for the same
  feature; frontend builds against hand-written mocks until integration.
- Within a side, sessions are sequenced by dependency (schema, services, endpoints).
- Two different features are not built in parallel until the process is proven on 2–3.

## 9. Folder structure

A redone feature is **one folder on each side of the wire**. A feature with several
workflows is split into **sub-modules** named for what the user does, not for the
milestone that built them. A small feature with one workflow is a single sub-module-less
folder using the same file names.

```
backend/src/
  modules/
    <feature>/
      README.md                  feature map (optional if docs/features/<feature>/README.md covers it)
      _shared/                   helpers used by several sub-modules
      <sub>/
        README.md                spec: purpose, status, roles, approved behaviour,
                                 built vs approved, endpoints, coupling, open questions
        <sub>-routes.ts          Express router — authenticate + requireRole on every route
        <sub>-controller.ts      HTTP in/out only
        <sub>-service.ts         business rules; a prisma.$transaction is allowed here
        <sub>-repository.ts      all Prisma access; every query scoped by organizationId
        <sub>-validators.ts      Zod schemas for every endpoint input
        <sub>.types.ts
        *.test.ts                tests sit beside the code
  shared/                        middleware, config, sockets, jobs, utils, types
  routes/index.ts                wires every module's routes — the one shared touch-point

frontend/
  app/                           ROUTING ONLY — thin page shells (Next.js derives URLs from this tree)
  features/<feature>/
    index.ts                     the feature's public API
    _shared/                     components/hooks/lib shared across its sub-modules
    <sub>/
      components/  hooks/  lib/  services/  store/  types/
  components/
    ui2/                         shadcn primitives on tokens (design system only)
    ui/                          OLD design system — frozen, retired per feature
    app/shell/                   cross-feature shell and generic states
  hooks/ services/ store/ types/ LEGACY + genuinely cross-feature only
  lib/                           apiClient, socket, cn, tokens
```

Rules:
- Files keep layer-suffixed names so they are greppable; the folder carries the area.
- No `prisma` import outside repositories (a `$transaction` in a service is allowed).
- Sub-modules do not reach into each other's internals except where their README's
  **Coupling** section lists it; new needs go through the owning sub-module's exports.
  Frontend: another feature imports `features/<feature>/index.ts` only. These rules are
  documented, not yet lint-enforced; adding the lint rules is open work.
- Merge a workflow with another sub-module when the approved design shows one flow
  (Inventory: receiving + purchasing + supplier AP became `purchasing`).
- Files that mix two areas are moved whole to their dominant sub-module and flagged in
  that README as "split at next change"; restructuring is **pure moves with zero
  behaviour change**, verified by build, tests and a registered-route diff.
- A new top-level source folder requires updating every config that lists source folders
  in the same commit (`UI_BUILD_RULES.md` §8).
- Migration to this layout happens as part of each feature's redo, never as a separate refactor.

## 10. Feature order

1. **Inventory & Procurement** — in progress. Central Store sub-modules rebuilt
   (catalog, restock, suppliers); purchasing, stock, waste, counting and prep have
   approved designs awaiting (re)build; requisitions, dispatch and branch-day await
   approval. Status table: `docs/features/inventory/README.md`.
2. The remaining features are regrouped into 10 modules (Access & Organisation,
   Notifications & Audit, Workforce, Menu & Pricing, Orders with approvals,
   Fulfilment, Finance & Receivables, Communications, Reporting, Assistant) in the
   order set in [`docs/ROADMAP.md`](ROADMAP.md). That file is the authority for
   module boundaries, cross-module rules and sequence.
3. **Orders and Fulfilment (KDS/BDS) last** — live, complex, revenue-critical.

## 11. Documentation strategy

| Kind | Where | Lifetime |
|---|---|---|
| Screen designs and flow order | Paper approved file | Permanent, owner-controlled |
| Sub-module spec: purpose, roles, approved rules, status, endpoints, coupling | `<sub>/README.md` beside the code | Permanent; updated in the same commit as behaviour changes |
| Feature map, standing rules, decisions in force, open owner decisions | `docs/features/<feature>/README.md`, `decisions.md` | Permanent |
| Contract and schema of record | `API_CONTRACT.md`, `DATA_MODEL.md` | Permanent |
| Process and standards, reusable agent prompts | this file, `docs/design-briefs/`, `CODING_STANDARDS.md`, `UI_BUILD_RULES.md`, `DESIGN_SYSTEM.md` | Permanent |
| Milestone plans, session prompts, handoffs, walkthrough decision notes, run sheets | `docs/features/<feature>/` or `<sub>/DESIGN-NOTES.md` | **Temporary**: before deleting, extract any decision still in force into the README or `decisions.md`; then delete (git is the archive). Untracked files are not in git: commit or back them up first |

Authority when sources disagree: **Paper approved page > sub-module README > `decisions.md` > code.**
When the README says "built today" differs from the approved design, the gap is the
redo's to-do list.
