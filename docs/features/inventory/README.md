# Inventory & Procurement

The Central Store buys, receives, preps, counts and dispatches stock to branch
departments; branches request, confirm, count and close their day. This is the
first feature of the redo and the template for the others
(`docs/FEATURE_REDO_PLAYBOOK.md`).

## Where things live

| What | Where |
|---|---|
| How screens look, flow order | Paper file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`), one page per area. **Source of truth for UI.** |
| What each sub-module does, who can do what, approved rules, status, endpoints | `README.md` inside each sub-module folder (table below) |
| Rules that cut across sub-modules; open owner decisions | [decisions.md](decisions.md) |
| Central Store hub-org scoping (D-15) | [../../inventory/CENTRAL_STORE_SCOPING_DESIGN.md](../../inventory/CENTRAL_STORE_SCOPING_DESIGN.md) |
| Domain research, the client's paper records | `docs/inventory/central_kitchen_inventory_model.md`, `docs/inventory/reference-photos/`, `docs/Item Catalog/` |
| **What is left to do, in the owner's order** | [roadmap.md](roadmap.md) |
| **Where the code is ahead of Paper (update Paper first, before new design work)** | [paper-updates-needed.md](paper-updates-needed.md) |
| Designed-not-built Director/Accountant reports | [reports-spec.md](reports-spec.md) |
| **Final design pass** (Requisitions, Dispatch, Branch day, Branch waste): screen outline and review batches, the four flows, discrepancy rules | [final-pass-screen-plan.md](final-pass-screen-plan.md), [requisitions-flow.md](requisitions-flow.md), [dispatch-flow.md](dispatch-flow.md), [branch-day-flow.md](branch-day-flow.md), [branch-waste-flow.md](branch-waste-flow.md), [discrepancies.md](discrepancies.md) |
| Client demo script (rehearsed 2026-09-30; a few steps are stale, see its notes) | [demo-run-sheet.md](demo-run-sheet.md) |
| Full approved wording for not-yet-rebuilt areas | None kept: the design notes for Prep and Counting were deleted when each was rebuilt (their content is in Paper and the docs) |
| Why Prep is built the way it is (data model, rules, slices) | [prep-plan.md](prep-plan.md) |

If sources disagree: **Paper approved page > sub-module README > decisions.md > code**.
When code and README disagree, the README's "Built today" section says so; fix
whichever is wrong in the same change.

## Sub-modules

Backend `backend/src/modules/inventory/<sub>/`, frontend `frontend/features/inventory/<sub>/`.

| Sub-module | Covers | Paper page | Design | Code |
|---|---|---|---|---|
| [catalog](../../../backend/src/modules/inventory/catalog/README.md) | Items, categories, item history | Catalog, suppliers and restock levels | approved | rebuilt |
| [restock](../../../backend/src/modules/inventory/restock/README.md) | Restock levels, suggestions, change log | same | approved | rebuilt (logic shares catalog files) |
| [suppliers](../../../backend/src/modules/inventory/suppliers/README.md) | Suppliers, contacts, payment methods, catalog lines, documents | same | approved | rebuilt |
| [audit-log](../../../backend/src/modules/inventory/audit-log/README.md) | Audit log across catalog, suppliers and restock levels | same | approved | built |
| [purchasing](../../../backend/src/modules/inventory/purchasing/README.md) | Need → order → approval → receive → invoice → pay; supplier statement | Purchasing | approved | **live on the real back-end since 6 Oct 2026** (front-end Step 4 built, awaiting the owner's screen-by-screen approval against Paper; the mock and demo bar are gone; back-end Step 3: orders, receiving, payables, supplier account, files). See [the front-end README](../../../frontend/features/inventory/purchasing/README.md) |
| [prep](../../../backend/src/modules/inventory/prep/README.md) | Usual recipes, record a run, runs, fix a slip, review | Prep | approved | **rebuilt** (branch `feat/prep-rebuild`, 7 Oct 2026; live once merged and deployed) |
| [stock](../../../backend/src/modules/inventory/stock/README.md) | Stock position, ledger, stock card | Stock and Counting | approved | **rebuilt** (8 Oct 2026, awaiting merge) |
| [waste](../../../backend/src/modules/inventory/waste/README.md) | Waste logging and reversal (a Department Head's branch waste in `waste/department/`) | Stock and Counting | approved | **rebuilt** (8 Oct 2026, awaiting merge) |
| [counting](../../../backend/src/modules/inventory/counting/README.md) | Counts (many a day, any scope), review and approve, Count setup, settings, the Director's flagged lines, prints | Stock and Counting | approved | **rebuilt** (8 Oct 2026, awaiting merge) |
| [requisitions](../../../backend/src/modules/inventory/requisitions/README.md) | Branch requisition and approval | Requisition and dispatch | approved (8 Oct 2026) | old flow, pending redo |
| [dispatch](../../../backend/src/modules/inventory/dispatch/README.md) | Fulfil, delivery, branch receiving, discrepancies | Requisition and dispatch | not approved | old flow, pending redo |
| [branch-day](../../../backend/src/modules/inventory/branch-day/README.md) | Branch count, close, correct a count, history (no reopen), next-morning opening | Counting and closing | approved (8 Oct 2026) | old flow, pending redo |
| `_shared` | Stock scope helpers and cross-cutting tests | n/a | n/a | n/a |

## Roles

Access is set by one table (see "Access" in [decisions.md](decisions.md)), not by the Paper chapter labels: **every desktop role reads every Central Store screen; write belongs to whoever does that job.** The table below says what each role does here today.

| Role | Where | In this feature |
|---|---|---|
| Store Manager | Central Store (hub org) | Owns purchasing, catalog, suppliers; approves counts and orders; fulfils dispatches; resolves discrepancies. Reads and writes everything rebuilt so far |
| Store Attendant | Central Store (hub org) | Receives, preps, counts (blind), logs waste, picks dispatches, adds a missing item, on phone and desktop. Sees item costs and prices. Never sees expected stock or stock figures, or financial data (what we owe, invoices, payments, supplier balances and payment details, reports) |
| Department Head | One branch department | Requisitions for own department, confirms own deliveries, own waste, own restock levels. The item list carries no costs |
| Branch Manager | Branch | Approves requisitions, counts and closes the branch day. **Reads** the Central Store (catalog, restock levels, suppliers and what we owe, audit log) but not supplier payment details; writes nothing there |
| Accountant | Company | Reads the Central Store; records supplier **invoices**, payments, payment methods and documents. Cannot move stock or edit the catalog |
| Director | Company | Reads the Central Store, including payment details; writes nothing; gets discrepancy alerts |
| System Admin | Company (no organization) | Reads and writes everything in the Central Store; signs with their own PIN |

Delivery drivers are not users; they carry a printed delivery note.

## Standing rules (apply to every sub-module)

- **Attendants see item costs and prices (owner decision, 6 Oct 2026, replacing "attendants never see costs"). They never see stock figures (on-hand, expected stock, restock levels) or financial data (what we owe, invoices, payments, supplier balances, reports)**, enforced server-side. The rule lives in ONE helper, `backend/src/modules/inventory/_shared/blind-rule.ts` (`blindnessOf`, `withoutStockFigures`, `withoutFinancials`); every rebuilt sub-module calls it instead of writing its own check. Counting stays blind to expected stock for the Attendant (a count-integrity rule).
- **Nothing is deleted.** Retire/restore; cancel/void/reverse with a reason as a new linked entry.
- **Stock or money moves only after a confirm summary.** PIN signing is used where a document is signed (receipt, order approval, count approval, dispatch, branch confirmation, day close) and where money moves; not for catalog, restock or payment-method changes.
- **Stock on hand is derived from the append-only `InventoryTransaction` ledger**, never a stored counter. Corrections are new linked entries.
- **Post every stock movement through the door**, `postStockMovement` (`backend/src/modules/inventory/stock/ledger/`). Never call `inventoryTransaction.create` yourself: a guard test fails on it. Rebuilding a sub-module that still writes the ledger directly means moving it onto the door and lowering its count in `ledger-guard.test.ts`.
- **One screen set, read for all desktop roles, write by job, access in one table, and mock-data front-end first for flows the client has not approved.** Full rule: [decisions.md](decisions.md) ("One screen set, mock first").
- Say **Prep** for the kitchen verb and **Restock level** (never "par level"). No "phase 1/2/3" language.
- Item types are **Stocked**, **Raw ingredient** and **Prepped**. Raw ingredients exist only at the Central Store.
- No offline mode. One reusable loading/empty/error kit, not per-screen state designs.
- Central Store data and Store Manager/Attendant users live on the **hub organization**; the hub appears in people contexts, never sales contexts.
- Every repository query includes `organizationId`; every route has `authenticate` + `requireRole`.

## Working in a sub-module

1. Read its README, then the Paper page.
2. Backend files keep the layer-suffixed names (`*-routes`, `*-controller`, `*-service`, `*-repository`, `*-validators`, `*.types`, tests beside code).
3. A sub-module imports another's internals only where its README's *Coupling* section lists it. New cross-sub-module needs go through that sub-module's exports, and get added to *Coupling* while they exist.
4. Change behaviour → update the README in the same commit. A redone sub-module flips its **Design / Code** status in the table above.
