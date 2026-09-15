# Step 5 orchestrator session — Milestone One (Catalog, Suppliers, Restock Levels)

Paste this to the agent starting the Step 5 planning session for Inventory
Milestone One.

---

You are running **Step 5 — High-level plan** of the Feature Redo Playbook for
the Inventory feature, scoped to **Milestone One: Catalog, Suppliers &
Restock Levels** (the screens on Paper's "Milestone One" page,
`01M1ZZJ6S3FZGF5C7PPBGTKY89`).

Your job this session is to **produce a plan for owner approval — not to
write backend or frontend feature code.** Stop once the plan doc and
contract types exist; do not start Step 7 build sessions.

## What's already done (read, don't redo)

Steps 1–4 of the playbook are complete and approved for this milestone:

- `docs/features/inventory/01-description.md` — owner's description
- `docs/features/inventory/02-flows.md`, `02-screens.md` — approved flows/screens
- `docs/features/inventory/03-design.md` — approved Paper design pointer
- `docs/features/inventory/04-components.md` — **the component inventory**.
  Every primitive (7) and composite (9) this milestone's screens need is
  already built in code, verified against Paper (pixel-diff + structural +
  accessibility audit + token-drift sweep, all logged in this doc's Status
  section) and committed. **Plan against these actual components — read
  this doc before assuming what exists.** Two things worth knowing before
  you plan:
  - Several composites (Item Form, Supplier Form, Category Manager List,
    Restock Level Grid) deliberately don't own their surrounding screen
    chrome (Save/Cancel buttons, search boxes) — that's Step 7's job to
    add when assembling real screens, not a gap in the component set.
  - `04-components.md`'s "Known issues" section has one still-open,
    unresolved finding: `--wds-text-faint`/`--wds-text-muted` fail WCAG AA
    contrast at their real usage sizes. This needs an owner decision before
    Step 7 frontend sessions touch any screen using those tokens for real
    body/helper copy — flag it in your plan as a blocking dependency for
    frontend sessions, don't just silently note it.
- `docs/features/inventory/HANDOFF-milestone-1-component-build.md` — build
  history, for context on what verification already happened.

Also read, in this order, before planning anything:
1. `docs/FEATURE_REDO_PLAYBOOK.md` §5 Step 5 (your own job description) and
   §7 (production data rules — but see the override below, this feature is
   a special case)
2. `docs/DATA_MODEL.md`
3. `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` — the D-15 hub-org
   scoping rule, non-negotiable
4. `docs/API_CONTRACT.md` — existing conventions/format to match
5. `docs/CODING_STANDARDS.md`, `docs/TDD.md`

## Special case: no real production data, use reference photos instead

This feature was shipped once before (Phase 1, live since 2026-07-31) but
**the client never used it for real work.** Any data currently in
production under the inventory tables is data the owner seeded themselves
to showcase the feature — not real client data. Treat production as
"empty of real-world data" for schema-preservation purposes, but:

- **Do not assume production is literally empty.** Unlike local (confirmed
  empty), production may have the owner's demo rows still sitting in it.
  List the exact read-only queries you need (row counts per table, sample
  rows, enum-value distributions) and ask the owner to run them and paste
  results back, per playbook §7's normal process — just note in your ask
  that you already know these are demo rows, not real client data, so
  you're checking for volume/shape, not authenticity.
- **For realistic catalog data** (item names, categories, units, pack
  sizes, supplier names, price levels), do not invent placeholder data or
  rely on the owner's demo seed. Instead, **read
  `docs/inventory/reference-photos/` directly** — 24 photos of the client's
  actual supplier tax invoices (e.g. Samrat Supermarket → Wendo Coffee
  Bistro). These are real product line items with real names, pack
  quantities, unit prices, and supplier details. Use them to inform the
  data model's realistic shape and to build seed/test fixtures that
  reflect what this business actually buys — this is the closest thing to
  real production data available for this feature.

## Special case: an existing Phase 1 schema is already live — evaluate, don't assume

A prior inventory build already shipped a schema to production (migration
`20260728101631_inventory_phase1_schema` and everything after it, following
an even earlier schema that was dropped —
`20260728101630_drop_legacy_inventory_v2`). Confirmed by direct inspection
this session:

- Tables already exist: `InventoryItem`, `Supplier`, `SupplierItem`,
  `ParLevel`, `PurchaseOrder`, `PurchaseOrderLine`, `StockCount`,
  `WasteLog`, `InventoryTransaction`, `SupplierInvoice`,
  `SupplierPayment`, and Phase 2 additions (`Requisition`, `Dispatch`,
  etc.).
- Confirmed empty of real rows in every table, locally. Production likely
  has the owner's own demo-seed rows only (see above) — verify the actual
  row counts via the query-ask above before deciding anything is safe to
  drop.
- **This schema does not match Milestone One's approved design in at least
  two structural ways** — confirm these yourself against the current
  schema, don't take this list as exhaustive:
  - No `Category` model exists anywhere — but Category Manager List, Item
    Form's category picker, and the Item Catalog Table's Category column
    all assume one.
  - `InventoryItemType` enum is `RAW / PREPPED / PASS_THROUGH` — Paper's
    design and the built components use `Raw ingredient / Prepped item /
    Stocked item`. Confirm whether `PASS_THROUGH` and "Stocked" are the
    same concept or genuinely different before mapping one to the other.
  - Hub-org scoping (`Organization.isHub`) exists structurally but has
    never held real data anywhere — it's untested by real use, not just
    unused.

**Your job:** for each affected table, explicitly decide and state in the
plan — keep-and-extend, or drop-and-replace (there's already one precedent
for doing this in this codebase). Given no real data is at stake, a clean
replacement is likely the right call for tables that don't match the
approved design, but this is your call to make and justify, not something
to wave through silently or assume needs preserving. Also check: is any of
Phase 1's *backend code* (routes/services/repositories under the old
flat-layer structure) still wired into live routes? If so, its retirement
must be part of this same plan — old code is removed in the same PR that
ships its replacement, per the playbook, not a separate cleanup later.

## What your plan must produce

Output: `docs/features/inventory/05-plan.md`, plus contract types committed
to code (location per `docs/CODING_STANDARDS.md` / playbook §9).

1. **Data model changes** — new/changed tables, enums, indexes,
   constraints for Catalog, Suppliers, Restock Levels, informed by the
   schema evaluation above.
2. **Migration plan** — concrete: which tables keep, which get replaced,
   how (a real migration, since this is drop/recreate against a live
   deployed schema, not a from-scratch `prisma migrate dev` against
   nothing). Follow the migration workflow in `CLAUDE.md`.
3. **API contract** — every endpoint: method, path, request/response
   shapes, error cases, auth + role, as shared Zod schemas/TS types, not
   prose. Match Non-Negotiables: `organizationId` in every repository
   query, `authenticate` + `requireRole` on every route, Zod validation on
   every input.
4. **Session breakdown** — the Step 7 build split into scoped sessions,
   dependencies between them, what backend/frontend sessions can run in
   parallel once the contract is frozen.
5. **Test classification** — which existing Phase 1 tests (if any still
   run against code you're retiring) get kept, rewritten, or deleted; what
   new tests the new flows need.

## Non-negotiables (restating, don't violate these in the plan)

- Central Store hub-org scoping (D-15) — Central Store data lives only on
  the hub Organization.
- Business logic in services only; DB queries in repositories only.
- New code goes in `backend/src/modules/inventory/`.
- Every endpoint: Zod schema + `authenticate` + `requireRole`.
- TypeScript strict, no `any`.

## Process

- Use TodoWrite and keep it live throughout — this is a multi-step session.
- **Stop after producing the plan.** Do not begin Step 7 (build sessions).
  The owner reviews and approves `05-plan.md` first.
- Once approved (a later step, not this session unless the owner says
  otherwise), freezing the contract (Step 6) is just committing the
  already-designed types and marking them frozen in
  `docs/API_CONTRACT.md` — it does not need its own separate session.
- If you hit a genuine ambiguity the approved flows/screens/design don't
  resolve, ask the owner rather than guessing — especially anything
  touching the schema-replacement decision above, since that's effectively
  irreversible once Step 7 starts building against it.
