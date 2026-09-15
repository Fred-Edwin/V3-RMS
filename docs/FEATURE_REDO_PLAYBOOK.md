# Feature Redo Playbook

**Status:** Active governing process
**Owner:** Edwinfred Kamau
**Started:** 2026-09-07

This document defines how Wendo RMS is being rebuilt, feature by feature, into a
premium enterprise product with a new design system and a modular codebase.

**Every feature follows this process. No feature skips a step. Read this before
starting any feature work, and before writing any agent-session prompt.**

Related docs:
- `CLAUDE.md` — agent briefing, points here
- `docs/DESIGN_SYSTEM.md` — the design system (rewritten in Phase 0, then living)
- `docs/API_CONTRACT.md` — hosts the frozen per-feature API contracts
- `docs/DATA_MODEL.md` — schema of record
- `docs/CODING_STANDARDS.md` — enforceable code rules
- `docs/archive/INDEX.md` — historical docs (not current guidance)

---

## 1. Why we are doing this

The codebase is healthy and maintainable (near-zero `any`, 777 passing tests,
strict TypeScript, consistent conventions). It does **not** need a rewrite. But:

1. The UI is a "warm" design system that reads as amateurish and vibe-coded —
   over-rounded, weak visual hierarchy, flows not optimised for minimal taps.
   We want an intentionally designed, premium enterprise product: think Linear,
   Stripe, Apple, Google — crisp, dense, ledger-like, with restrained taste and
   a few deliberate creative touches.
2. Months of real usage have taught us how staff actually use each feature. We
   want to fold that back into the flows.
3. The backend is organised by layer (`controllers/`, `services/`, …). For a
   42-feature app, grouping by feature (`modules/<feature>/`) is the better
   structure. We migrate to it **one feature at a time, as part of each redo** —
   never as a separate big-bang refactor.

We keep the working code running the whole time. Each feature is replaced in
place, per build session, behind a migration plan, with a rollback path at every
step.

---

## 2. Principles

- **Design first, approved by the owner, before any code.** Most past rework
  came from building the wrong thing, not building it badly.
- **The owner approves the user flows.** Flows are where "is this how I want the
  feature to work?" gets answered.
- **Keep production working.** No feature is deleted up front. Old code is
  removed in the same PR that ships its replacement, after tests + migration.
- **The API contract is a frozen, typed artifact.** It is the seam that lets
  backend and frontend sessions run in parallel.
- **New code lands in the new structure and the new design system.** Redone
  feature X ⇒ `backend/src/modules/x/` + `frontend/features/x/`, built on the
  new design tokens. One folder per side of the wire.
  During the transition the codebase is half-old, half-new. That is expected.
- **Paper is the design source of truth.** Its MCP exposes exact dimensions and
  computed styles; the frontend agent builds against the live Paper file and
  visual-diffs against it.
- **Tests are classified, not blindly kept or deleted.** Every plan says which
  existing tests stay, which get rewritten, which new ones are needed.

---

## 3. The design direction (input to Phase 0)

Owner's brief, verbatim intent:

- **Premium enterprise product design.** Excellence. Linear / Stripe / Apple /
  Google as the bar.
- **Top-tier visual hierarchy and information density.** Structure components the
  way the Linear team would — dense but legible, everything deliberate.
- **Crisp, not round.** The current design's roundness reads as amateurish. Sharp
  or minimal radii. Clean lines. Ledger-like.
- **Flows optimised for minimal tasks per action.** Fewer taps, fewer screens per
  job. No "bottom nav with a pile of links and a More button" — proper navigation
  (e.g. a real sidebar, including on mobile).
- **Restrained creative touches.** A few deliberate, tasteful details that signal
  a designer sat and thought about this — e.g. a subtle, professional gradient on
  the sidebar rather than a flat fill. The product designer agent is expected to
  propose these and surprise the owner. Not loud; not decorative for its own sake.
- **Color:** to be explored in Phase 0. Go with what an expert enterprise product
  designer would choose. No hard palette mandate from the owner.
- **No hard device constraints specified.** Just make it genuinely premium.

---

## 4. Phase 0 — Design System Foundation (once, before Feature 1)

Phase 0 produces the design system every feature is then built on. It is not
optional and it comes first.

### 4.1 Token exploration
- An agent playing **expert enterprise product designer** explores 2–3 directions
  for the foundational tokens:
  - Color — neutral ramp, accent(s), semantic (success / warning / error / info)
  - Typography — font family, type scale, weights, line-heights
  - Spacing scale
  - Radii (small — we are moving away from round)
  - Elevation / shadows / borders
  - Density defaults
- Presented as comparable options with rationale and sample compositions.
- **Owner picks.** This is a taste decision and it is the owner's.

### 4.2 Codify
- Chosen tokens become CSS variables + Tailwind theme config.
- `docs/DESIGN_SYSTEM.md` is **rewritten** from scratch around them.
- Old "warm" design-system doc content is already archived.

### 4.3 Base component set (shadcn/ui) — new folder, old one untouched
- **Do not touch `frontend/components/ui/`.** 114 files across every
  not-yet-redone page import from it. It keeps serving them unchanged until
  each of *their* features is redone.
- Build the new set in **`frontend/components/ui2/`** (working name — rename at
  the end of the whole redo once nothing imports the old one anymore).
- Add shadcn/ui primitives via its own CLI (`npx shadcn@latest add <component>`,
  pointed at `components/ui2/`), which copies component source into the repo.
- Restyle each primitive onto the new tokens.
- Core set: button, input, select, combobox, dialog, sheet, drawer, table,
  data-table, card, badge, tabs, toast, dropdown-menu, tooltip, form, checkbox,
  radio, switch, skeleton, popover, command, avatar, separator, scroll-area.
- Plus app-specific composites identified during design (e.g. sidebar nav,
  KDS/BDS card, ledger table).
- **Migration rule:** a feature's redo is what moves its pages from `ui/` to
  `ui2/` — never a bulk swap. Once every feature is redone and nothing imports
  `ui/`, delete it and rename `ui2/` → `ui/` as a final cleanup step.

### 4.4 Structure groundwork
- Create `backend/src/modules/` and `backend/src/shared/` (empty, with a README
  each). Feature modules land here as features are redone.
- Do **not** move existing code yet — that happens per feature.

**Phase 0 exit:** owner has approved tokens; `DESIGN_SYSTEM.md` rewritten; base
`components/ui2/` built on tokens, `components/ui/` untouched; `modules/` +
`shared/` scaffolded.

**Phase 0 status — COMPLETE (2026-09-09).**
- Tokens explored (3 directions), owner picked and refined the coffee-inspired
  direction: espresso `#693C1B` primary + caramel secondary, clean near-white
  surfaces, Geist / Geist Mono, 2px radii, six gradient tokens, dot+label
  status. Paper file `01M1ZZJ6S3FZGF5C7PPBGTKY89` is the frozen reference.
- Codified: `frontend/app/tokens.wds.css` (OKLCH) + `frontend/tailwind.wds.preset.ts`
  (wired via `presets:` in `tailwind.config.ts`). All keys `wds-`-prefixed;
  the prefix drops when `components/ui/` is retired.
- `DESIGN_SYSTEM.md` rewritten from scratch around the tokens.
- `components/ui2/` seeded with 8 primitives on the new tokens: button, input,
  badge, card, separator, skeleton, label, status-dot. The rest of the core set
  is added per feature as screens need it.
- `backend/src/modules/` + `backend/src/shared/` scaffolded (README each).
- Next: **Feature 1 — Inventory** (Step 1, owner writes the description).

---

## 5. The per-feature pipeline

Each feature runs these steps in order. Steps 1–3 and 6 have **owner approval
gates**.

### Step 1 — Feature description (owner)
- The owner writes, from scratch, a description of how the feature should work —
  informed by what real usage has taught us.
- Output: `docs/features/<feature>/01-description.md`
- For features that already exist, the old spec (archived or in `docs/inventory/`)
  and the domain-model docs are inputs, not constraints.

### Step 2 — Flows & screens (expert agent)  ⟶ OWNER APPROVES
- An agent **plays the relevant domain expert** (named explicitly per feature —
  e.g. for inventory: someone who has run restaurant/commissary stock operations,
  not a generic PM).
- From the description, it produces:
  - **User flows** — every task as numbered steps with decision branches, what
    the system does at each step, which role does it, error/edge paths.
  - **Screen inventory** — every screen needed, and for each: every state
    (empty, loading, error, populated, permission-denied, offline if relevant).
- Output: `docs/features/<feature>/02-flows.md`, `02-screens.md`
- **Owner reviews and approves the flows.** This is the "is this how I want it?"
  gate. Iterate until approved.

### Step 3 — Design in Paper (design sessions)  ⟶ OWNER APPROVES
- Design every approved screen + state in Paper, following `DESIGN_SYSTEM.md`.
- Design the explicit breakpoints the app needs (state which per screen — e.g.
  staff mobile + manager desktop). Paper artboards are fixed-width; anything not
  drawn is left to the frontend agent's responsive judgement.
- The product designer agent proposes the restrained creative touches here.
- Iterate with the owner until approved.
- On approval, record the pointer: `docs/features/<feature>/03-design.md` with
  the Paper file id, the approved artboard/node IDs, and the approval date.
  (No screenshot export — the frozen Paper file is the reference. This file just
  pins *which* artboards are the approved ones.)

### Step 4 — Extract components into the codebase
- First, produce a **component inventory**: for each build unit (a milestone, a
  slice, or the whole feature for a small one), list every primitive and composite
  its screens need, each with a pointer to the exact Paper node to build it against,
  and a note on which existing primitives/composites from an earlier build unit are
  being reused rather than rebuilt. Output:
  `docs/features/<feature>/04-components.md`.
- For each **new** primitive/composite in that inventory:
  1. Add the matching shadcn/ui primitive via its CLI (do **not** hand-write it).
  2. Read the Paper node's exact styles via MCP (`get_computed_styles`,
     `get_node_info`, `get_jsx`) — never source a value from a screenshot; a
     screenshot verifies the result, it doesn't supply the numbers.
  3. Restyle the primitive to match Paper, mapping every raw value to a design
     token — never a bare magic number when a token already covers it.
  4. Visual-diff it against Paper (`get_screenshot` vs. a screenshot of the running
     component) before marking it done in the inventory doc.
- Result: the component set in code matches the component set in Paper.
- Components live in `components/ui2/` (primitives — add here, never in the old
  `components/ui/`) and `features/<feature>/components/` (composites, built on
  `ui2/`) — except shell composites used by every feature (sidebar, topbar,
  mobile status bar), which go in `components/app/shell/`, not under a feature.
- **Loading/error/empty states and persistent-shell layouts follow specific
  rules, not ad-hoc per-feature decisions** — screen-mirroring loading
  skeletons are feature-scoped, generic Empty/Error/Permission-denied cards
  are shared, a group of screens sharing one sidebar needs a route-group
  `layout.tsx` (not each screen mounting its own shell), and shell nav links
  are always `next/link`. Full rules with rationale:
  `docs/features/inventory/04-components.md` §"Placement rules — read
  before building a new milestone's screens" — read it before building any
  new feature's loading/error states or shared shell.
- This feature's pages switch their imports from `components/ui` to
  `components/ui2` as they're rebuilt. Other features' pages are untouched.
- **Reuse across build units within a feature is the point.** Once a primitive or
  composite is built and visually verified for one milestone/slice, a later one that
  needs the same thing *references* it — it does not get rebuilt or re-diffed at the
  primitive level. Only genuinely new composites introduced by the later build unit
  go through steps 1–4 above. A full assembled screen still gets a quick
  screen-level visual diff even when built entirely from reused composites, since the
  *arrangement* of composites on that screen is new even if the pieces aren't.

### Step 5 — High-level plan (planning agent)  ⟶ OWNER APPROVES
- One agent reads: the description, the approved flows, the approved screens, the
  Paper design (via MCP), the current schema, and the current production data
  (see §7). It produces:
  - **Data model changes** — new/changed tables, enums, indexes, constraints.
  - **Migration plan** — per slice, how existing production rows move. Explicit.
  - **API contract** — every endpoint: method, path, request shape, response
    shape, error cases, auth + role. Expressed as shared Zod schemas / TS types,
    not prose.
  - **Session breakdown** — the build split into scoped agent sessions, with
    dependencies and what can run in parallel (see §8).
  - **Test classification** — existing tests to keep / rewrite / delete; new
    tests required from the new flows.
  - **Structure** — confirms new code goes in `backend/src/modules/<feature>/`
    and `frontend/features/<feature>/`, and the retirement plan for the old
    feature's files on both sides.
- Output: `docs/features/<feature>/05-plan.md` (+ contract types committed to code)
- **Owner reviews and approves the plan.** For large features, approve the
  high-level plan here; each session's detailed plan is produced just-in-time
  before that session.

### Step 6 — Freeze the API contract
- The contract (shared Zod/TS types) is committed and marked frozen in
  `docs/API_CONTRACT.md`.
- **Amendment process:** if a build session discovers the contract is wrong, all
  affected sessions stop, the owner approves the amendment, sessions resume.
  Expect this to happen at least once per feature. It is not a failure.

### Step 7 — Build sessions
- Each session references: the plan, the frozen contract, the approved designs
  (Paper via MCP), `CODING_STANDARDS.md`, `DESIGN_SYSTEM.md`.
- **Backend sessions** build endpoints to the contract, with tests.
- **Frontend sessions** build against a mock of the contract, arranging
  components to match the Paper layout, and visual-diff each screen against Paper
  (`get_screenshot` vs. a screenshot of the running app).
- Backend and frontend sessions for the same feature can run in parallel once the
  contract is frozen (see §8).
- New code lands in `backend/src/modules/<feature>/` and
  `frontend/features/<feature>/`, on the new design system.
- **The PR for each slice removes the old code it replaces** — after its tests
  pass and its migration is written.

### Step 8 — Integration
- A dedicated session wires the frontend to the real backend, runs every approved
  flow end to end, and fixes the seams.

### Step 9 — Migrate, deploy, observe
- Run the migration against a restored production copy first.
- Deploy via the normal CI/CD pipeline (push to `main`).
- **The owner watches a real user use the feature.** Not done until this happens.

### Step 10 — Update docs
- `DATA_MODEL.md` — new schema.
- `API_CONTRACT.md` — unfreeze / mark shipped.
- `CLAUDE.md` — domain knowledge, current-feature pointer.
- `docs/features/<feature>/` — mark complete; move superseded input docs to
  `docs/archive/`.

---

## 6. Definition of Done (per feature)

- [ ] Owner-approved feature description
- [ ] Owner-approved user flows
- [ ] Owner-approved Paper designs, with approved artboard IDs recorded
- [ ] Component set in code matches Paper, built on shadcn/ui + design tokens
- [ ] Owner-approved high-level plan (data model, migration, contract, sessions)
- [ ] API contract frozen as shared types
- [ ] Backend built to contract, tests classified and passing
- [ ] Frontend built to design, visual diff passes per screen
- [ ] Integration session done — every flow works end to end
- [ ] Migration run on a production copy, then deployed via CI/CD
- [ ] Owner has watched a real user use it
- [ ] New code in `backend/src/modules/<feature>/` + `frontend/features/<feature>/`;
      `app/` pages are thin shells; old feature code removed
- [ ] Docs updated (DATA_MODEL, API_CONTRACT, CLAUDE, feature folder)

---

## 7. Production data & migrations

- Every existing feature has live production data. The plan (Step 5) **must**
  include a per-slice migration path.
- Agents do **not** SSH to the droplet. When the planning agent needs production
  data, it lists the exact queries (row counts, sample rows, enum usage,
  distributions). The owner runs them and pastes results back.
- Migrations follow the workflow in `CLAUDE.md` / `LOCAL_DEV_GUIDE.md`: edit
  schema locally → `prisma migrate dev` locally → commit the migration file →
  push → `prisma migrate deploy` on the server (via CI/CD).
- Test every migration against a restored production backup before deploy.
- Precedent to avoid: the reverted March 2026 V2.1 inventory build left orphaned
  schema in production that needed a cleanup migration. Plan migrations properly.

---

## 8. Parallelization

- **Serial:** feature description → flows → design → high-level plan → freeze
  contract. And: integration → deploy → observe.
- **Parallel (after the contract is frozen):** backend build sessions and
  frontend build sessions for the same feature.
  - Backend builds real endpoints to the contract.
  - Frontend builds against hand-written mocks matching the contract types.
  - Neither blocks on the other until the integration session.
- **Within backend or within frontend**, sessions are sequenced by dependency
  (schema/migration session first, then services, then endpoints, etc.).
- Two different *features* are not built in parallel until the process has been
  proven on at least 2–3 features.

---

## 9. Folder structure (target)

New code goes here. Existing code migrates per feature.

```
backend/src/
  modules/
    <feature>/
      <feature>-routes.ts
      <feature>-controller.ts
      <feature>-service.ts
      <feature>-repository.ts
      <feature>-validators.ts
      <feature>.types.ts
      <feature>-service.test.ts
  shared/
    middleware/        auth, rbac, error handler
    config/            prisma client, redis, queues, firebase, sentry
    sockets/           socket handlers + emit service
    jobs/              BullMQ jobs
    utils/             pure helpers
    types/             cross-feature types
  routes/
    index.ts           wires every module's routes — the one shared touch-point

frontend/
  app/                 Next.js App Router — ROUTING ONLY. Thin page shells that
                       import from features/<feature>/. URLs are derived from
                       this tree, so pages cannot live anywhere else.
  features/
    <feature>/         NEW — everything for one feature, co-located
      components/      feature composites, matching Paper (built on ui2/)
      hooks/
      services/        API-call module, typed to the frozen contract
      store/           Zustand store(s) for this feature
      types/           types mirroring the feature's contract
      index.ts         the module's public entry — other code imports from here
  components/
    ui/                OLD design system — untouched, serves not-yet-redone pages
    ui2/               NEW — shadcn/ui primitives on the design tokens
    app/shell/         cross-feature shell (sidebar, topbar, mobile headers)
  hooks/               LEGACY — cross-feature hooks only; feature hooks move out
  services/            LEGACY — not-yet-redone features; migrate per redo
  store/               LEGACY — same
  types/               LEGACY — same; plus genuinely cross-feature types
  lib/                 apiClient, socket, cn, tokens — shared infrastructure
```

> **Frontend feature modules — decided 2026-09-15 (amendment).** The original
> version of this section grouped the frontend by layer (`hooks/`, `services/`,
> `store/`, `types/`) while grouping the backend by feature. That asymmetry was
> never a decision — it was the existing Next.js layout carried forward
> unexamined. It is now corrected: **the frontend is modularized by feature too**,
> so a redone feature is one folder on each side of the wire.
>
> **The one thing that does not move is `app/`.** Next.js derives URLs from that
> directory tree, so pages must physically live there. They become thin shells —
> a page file resolves params, renders a component from `features/<feature>/`,
> and holds no feature logic of its own. This is the standard Next.js answer to
> this problem, not a compromise.
>
> Migration is **per feature, as part of its redo** — never as a separate
> refactor, exactly like the backend. Inventory is the first.

Rules:
- No `prisma` import outside `repositories/` (a `$transaction` in a service is
  allowed; plain reads/writes are not). Add a lint rule to enforce this.
- No cross-module imports between feature modules except through a module's
  public entry. Shared code goes in `shared/` (backend) or `lib/` +
  `components/ui2/` + `components/app/` (frontend).
- **Frontend feature modules mirror this rule:** `features/a/` never reaches
  into `features/b/`'s internals. It imports `features/b`'s `index.ts`, or the
  shared code both depend on.
- `components/ui2/` is design-system only. No feature logic there. Never add to
  `components/ui/` — it's frozen, retired feature by feature (see §4.3), and
  deleted once nothing imports it.
- A page in `app/` holds routing concerns only — params, metadata, layout
  choice, and rendering a feature component. Business logic, data fetching, and
  state belong in the feature module.
- **Introducing a new top-level source folder is not just a convention change
  — update every config that lists source folders in the same commit:**
  `tailwind.config.ts`'s `content` glob, `tsconfig.json`'s `include`,
  `.eslintrc`, and any lint/codegen script with a hardcoded directory list.
  The `features/` folder itself (this amendment) was added without updating
  Tailwind's `content` glob — every class used only inside `features/`
  (never duplicated in `app/`/`components/`) was silently never generated,
  with no build error, until the Inventory Milestone One build hit it and
  fixed it retroactively. Don't repeat that per future folder.

---

## 10. Feature order

1. **Inventory** — redesign Phase 1 (Central Store, live in production) +
   build Phase 2 (Central Store → Branch Departments) + Phase 3. Biggest pending
   gap, moderate risk, good first proof of the full process.
2. TBD — pick calmer features next (HR, staff, comms, discounts, reports).
3. **Orders and KDS/BDS last** — live, complex, revenue-critical. Only after the
   process is proven on 2–3 features.

Rationale: prove the pipeline on features where a mistake is recoverable before
touching the flows that take customer money.

---

## 11. Per-feature doc folder

Each feature gets `docs/features/<feature>/`:

```
01-description.md     owner's description of how it should work
02-flows.md           approved user flows
02-screens.md         approved screen + state inventory
03-design.md          Paper file id + approved artboard IDs + approval date
05-plan.md            high-level plan (data model, migration, contract, sessions)
06-sessions/          just-in-time detailed plan per build session
```

The frozen API contract lives as committed code (shared Zod/TS types) plus a
section in `docs/API_CONTRACT.md`.
