# audit-log

**Design:** approved (Paper: *Catalog, suppliers and restock levels*, chapter 8, step 35; Area menu and date range from *Counting redesign (Oct 7)*, steps 58 and 59) · **Code:** built (Session 7), extended in Lane 0 (8 Oct 2026).

One read-only list of what changed in the Catalog, Suppliers, Restock levels, Prep, Purchasing and Payments, Stock counts, Waste and Stock adjustments, with who, when and why.

## Who can do what
- **Store Manager, Accountant, Director**: read it. Nobody can edit or remove an entry.
- Hub organization only.

## Behaviour
- Merges its sources newest first: item history, supplier audit rows, supplier creation, restock level changes (Central Store and every branch department), and `purchasing_audit` (areas `PURCHASING` and `PAYMENTS`, written by the purchase file in the same transaction as each action).
- A Purchasing or Payments entry also carries `purchasing: { action, document, detail, orderId, orderReference, supplierName }` and the actor's `role`.
- Derives `PREP` entries from the Usual recipe versions and from the run's own columns (Recorded, Corrected, Cancelled, Reviewed). Ids are `run:<kind>:<runId>`.
- **Derived areas (Lane 0), one small module each in `sources/` (a `-source.ts` that words the rows and a `-repository.ts` that reads them; no event table):**
  - `STOCK_COUNTS`: a count *signed* by its counter (`signedAt`), a count *approved* by the Manager (`approvedAt`, with how many ledger adjustments it posted and their net KES); a count the Manager signed themselves is one "Signed and applied" entry. Record: the count.
  - `WASTE`: Central Store waste *logged* (`createdAt`) and *reversed* (`reversedAt`, reason in the sentence). Record: that item's stock card on the day.
  - `STOCK_ADJUSTMENTS`: every `ADJUSTMENT` ledger row of the Central Store (at the hub they all come from approved counts, or reverse one). Record: the `ADJ-####` number, which opens the ledger searched for it.
  - These rows carry `record: { kind, id, label, day? }`.
- **`REQUISITIONS` (Block 1, back end B) is the first branch-site source:** every `RequisitionEvent` of the branches in scope, worded by `requisitions/_shared/requisitions-sentences.ts` (the same function as the file's Activity tab), for example "Approved REQ-NYR-0112 · 40 lines · signed with PIN"; a sentence that does not name the requisition gets its reference added. The record is `{ kind: 'REQUISITION', id, label }` (the file), and the actor's `role` carries the role label recorded with the event. Never an account or a PIN. Files: `sources/requisitions-source.ts`, `sources/requisitions-repository.ts`.
- **Scope:** the hub roles read every branch (and every Central Store area), narrowed by the Branch filter. A **Branch Manager reads one branch, their own** (Paper step 60): the Branch filter is forced to it, naming another branch is a 403, the hub-only areas answer nothing and the Who list never reaches the hub's people. Blocks 2 to 4 add their sources the same way (a source reads `branchSitesOf(scope)`).
- **`BRANCH_WASTE` (Block 3, back end) reads branch waste:** the `waste_logs` rows of branch department locations in `branchSitesOf(scope)`, an entry *logged* (`createdAt`) and *reversed* (`reversedAt`, reason in the sentence), for example "Logged waste · Beef stew 2 kg · Expired" (no money). Ids are `branch-waste:logged:<id>` and `branch-waste:reversed:<id>`; the record is that item's stock card on the day. Files: `sources/branch-waste-source.ts`, `sources/branch-waste-repository.ts`. The Central Store's `WASTE` source reads the hub's `siteId` only, so the two never overlap.
- **Branches areas** still without a source (`BRANCH_DAY`) are accepted and listed in the Area menu; they answer nothing until its block adds one (add it to `DERIVED_SOURCES` in the service and remove it from `AUDIT_AREAS_WITHOUT_SOURCE`).
- Filters: `area`, `actorId`, `from`/`to` (ISO timestamps, `to` exclusive), **`branchId`** (Lane 0: restock levels set at that branch only; the hub's own areas answer nothing; a branch that is not an active branch is a 400 `BRANCH_NOT_FOUND`); pages of 50 (25, 50 or 100 allowed).
- The response also lists `branches` (the active branches, for the Branch filter).
- Sentences are plain words; no account number can appear.

## Endpoint
| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/audit-log` | SM, ACC, DIR |

Contract: `docs/API_CONTRACT.md` §30.12. Frontend: `frontend/features/inventory/audit-log/`. Tests: `audit-log-service.test.ts`, `sources/derived-sources.test.ts`, and the opt-in `audit-log.db.test.ts` (`RUN_DB_TESTS=1`, reads only).
