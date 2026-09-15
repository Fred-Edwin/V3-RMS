# Backend build session — Inventory Milestone One (Catalog, Suppliers & Restock Levels)

Paste everything below the line to the agent running the backend build for
Inventory Milestone One. It covers **plan Sessions 2 and 3** (schema/migration,
then the module build) — they are one session because 3 cannot start until 2
lands, and splitting them would cost a cold re-read of the same context.

---

You are running the **backend build** for **Inventory Milestone One — Catalog,
Suppliers & Restock Levels**, Step 7 of the Feature Redo Playbook.

The plan is approved, the API contract is **frozen**, and the frontend session is
building against the same contract in parallel right now. Your job is to ship the
backend that satisfies it — schema, migration, module, tests — and to retire the
legacy inventory code it replaces.

## Read these first, in this order

**Read the named sections, not the whole documents.** `05-plan.md` is ~870 lines;
these pointers are the difference between a focused session and a lost one.

1. **`docs/features/inventory/05-plan.md`** — your specification:
   - **§0** — milestone scope, and what is explicitly *out* of scope
   - **§1.3** — the keep/replace decision **per table**, already made and approved
   - **§1.4** — which legacy code you delete, and what you keep
   - **§2** — production findings (they changed the migration; see §4)
   - **§3** — the target data model, with rationale per field
   - **§4** — the migration, step by step, with preconditions
   - **§5.2–5.4** — roles per endpoint, the endpoint list, and the cross-cutting
     validation rules
   - **§6.1–6.2** — which existing tests to delete, and what new tests to write
2. **`backend/src/modules/inventory/inventory-validators.ts`** + **`inventory.types.ts`**
   — the frozen contract. This is the specification for every request and
   response shape. Read it in full; it is short and it is authoritative.
3. **`docs/API_CONTRACT.md` §21** — the contract's index, the amendment process,
   and **§21.4, six behaviours that are contract rather than implementation
   detail.** Read §21.4 carefully — each one is something a reasonable engineer
   would "fix" into something conventional and wrong.
4. **`docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` §4** — the D-15 hub-org
   rule. Non-negotiable.
5. **`docs/CODING_STANDARDS.md` §4–6** — layer boundaries, validation, Prisma
   rules.
6. **`backend/src/modules/README.md`** — the module layout you are the first
   feature to use.

## What you are building

`backend/src/modules/inventory/` — the first feature in the new module structure:

```
modules/inventory/
  inventory-routes.ts        authenticate + requireRole on every route
  inventory-controller.ts    HTTP in/out only
  inventory-service.ts       business rules; $transaction allowed, plain Prisma not
  inventory-repository.ts    all Prisma access; organizationId in every query
  inventory-validators.ts    ALREADY EXISTS — frozen, do not edit
  inventory.types.ts         ALREADY EXISTS — frozen, do not edit
  inventory-service.test.ts  plus sibling tests
```

Wire it into `src/routes/index.ts` — the one shared touch-point.

## Order of work

### Part 1 — schema & migration (plan §3, §4)

1. Edit `backend/prisma/schema.prisma` to the models in **§3.1**.
2. `npx prisma migrate dev --name inventory_milestone_one_catalog`
3. **Hand-edit the generated SQL** — Prisma cannot generate three things you
   need. Follow §4's step order exactly, and add by hand:
   - the two partial unique indexes on `lower(name) WHERE deleted_at IS NULL`
   - the `CHECK` constraint enforcing the raw-ingredient rule
4. Write `backend/src/scripts/seed-inventory-catalog.ts` from
   **`docs/inventory/reference-photos/`** — real supplier names, real products,
   real pack sizes and units. Not invented placeholder data, and **not** the
   current production rows (those are demo data; see §2).
5. Verify the migration against a **restored production copy**, not just a clean
   local database. That is the only way to catch a row or constraint the counts
   in §2 didn't surface.

### Part 2 — the module (plan §5, §6)

6. Build repository → service → controller → routes, in that order, to the frozen
   contract.
7. Write the tests in **§6.2**.
8. **Delete the legacy code listed in §1.4, in this same PR** — 10 route files
   and their controller/service/repository/validator layers, plus their tests and
   the five obsolete demo-seed scripts. **Keep** `location-*` and `department-*`;
   they serve tables this milestone doesn't touch.

## The five things most likely to go wrong

Each of these has already cost someone time, or would have.

1. **`TRUNCATE inventory_transactions` is a required migration step.** The table
   holds **37 demo rows** — the original plan assumed zero and was corrected
   after the production query came back (§2). Without the truncate, the migration
   fails on a foreign-key constraint partway through a destructive migration.
   That is the worst possible place to fail.

2. **The raw-ingredient rule needs all three enforcement layers** (§3.2, §5.4):
   Zod refinement (field-level message the form renders), service guard
   (`ValidationError`, including on a *type change into* `RAW_INGREDIENT`), and
   the database `CHECK`. The description demands data-level enforcement — the DB
   constraint is what makes it a data rule instead of a convention. Two out of
   three is not done.

3. **A duplicate item name is a warning that still saves.** Not a 409. Flow 18:
   *"warned; allowed only with a distinguishing qualifier."* The response uses
   the `ItemMutationResponse` envelope with a `warnings` array. This is the
   single most likely thing to get "corrected" into a conflict error.

4. **D-15 has never been exercised against real rows.** The hub org and Central
   Store location exist and were verified for the first time on 2026-09-15 — but
   no inventory row has ever lived on them. Your D-15 tests are not ceremonial:
   a non-hub `STORE_MANAGER` must be rejected, writes must land on the hub org,
   and a second Central Store must be impossible.

5. **Repository/service boundary.** No `prisma` import outside
   `inventory-repository.ts` — a `$transaction` in the service is the only
   exception. Every repository query includes `organizationId`. This is
   Non-Negotiable #3 and #5, and this module is the reference implementation
   every later feature will copy.

## Non-negotiables

- TypeScript strict. No `any`.
- `authenticate` + `requireRole` on every route.
- `organizationId` in every repository query; `updateMany` (not `update`) when
  scoping by both `id` and `organizationId`.
- Business logic in services only; Prisma in repositories only.
- A Zod schema for every input — they already exist, frozen; use them.
- Route params validated as Zod UUIDs before reaching the service.
- Use `pnpm` for everything.

## Definition of done

- [ ] Schema matches plan §3.1; migration written, hand-edited per §4, committed
- [ ] Migration verified against a **restored production copy**
- [ ] Seed script written from the reference photos
- [ ] Every endpoint in §5.3 built, to the frozen contract
- [ ] Every rule in §5.4 enforced, at every layer §3.2 specifies
- [ ] Tests per §6.2 written and passing, including the D-15 tests
- [ ] Legacy code from §1.4 deleted **in this PR**; `location`/`department` kept
- [ ] `pnpm build` and `pnpm test` both green
- [ ] Use TodoWrite throughout and keep it live — the owner watches it

## Stop conditions

- **Do not touch frontend code.** A parallel session owns it.
- **Do not deploy.** Sessions 5–6 handle integration and deploy.
- **Do not edit the frozen contract to unblock yourself.** If it is wrong —
  a missing field, an impossible shape, a rule that contradicts the plan —
  **stop, say so, and wait for the owner to approve an amendment.** The frontend
  session is building against the same file; a unilateral edit silently breaks
  them. An amendment is expected at least once per feature and is not a failure.
- **If a production precondition turns out to be false** (§4), stop and report
  rather than working around it.
- If the plan and the contract disagree, **the contract wins** for shapes, and
  **the plan wins** for behaviour — and flag the discrepancy either way.
