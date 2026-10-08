# Block 1, back end A: schema, migration, core requisition and department logic

Start only after the owner has frozen `requisitions-contract.md` and the contract-in-code session has merged into `feat/final-pass-block-1`. Branch: `feat/req-be-a` from `feat/final-pass-block-1`. Read `docs/sessions/final-pass-session-common.md` and the contract. You are the **backend architect** (Express, Prisma, the stock ledger door, the access table).

## You own
- **The migration, as your first commit** (§2): departments as data with the seed and the `ItemDepartment` back-fill, `User.departmentId` and `Location.departmentId` back-fills, `Site.code`, the requisition columns and enum values, `RequisitionAddition`, `RequisitionEvent`, the `REQ-` reference back-fill. Expand only; no old column or value is dropped. Apply it locally; test it on the local database with realistic data; write a rollback note. Push the migration to the integration branch so back end B and the front ends can build on it.
- `backend/src/modules/inventory/requisitions/`: routes, controller, service, repository, validators, types and tests for **R3, R6 (data builder), R8, R10 to R22** and the writes' side effects on the old tables (§10: dual-write `departmentTag` and `departmentId`, `approvedQty`, `status = APPROVED`).
- `backend/src/modules/inventory/departments/`: **R23 to R26** with the dual-write rule (§2.1) and the catalog item-panel hook for department chips (minimal, in the catalog sub-module, nothing else changed there).
- The state rules in §5 as pure, table-tested functions; the reference numbering through `ReferenceCounter` inside the same transaction; PIN verification through the existing signing helper; idempotency keys.
- The two hand-off no-ops `closeIfComplete` and `attachAdditionToDispatch` (§2.3, §4.2) as named exports Block 2 will fill.
- Deleting the old requisitions files this replaces (old controller, service, repository, validators, types, old tests), keeping nothing the new code does not use.

## You must not touch
`requisitions/` list and badge endpoints (R1, R2, R4, R5, R7, R9), the notification layer, the audit sources and the print route (back end B owns them); any `dispatch/`, `branch-day/` or `waste/` code except the one-line reads the old dispatch needs; `routes/index.ts`; the front end. If the old dispatch breaks because of your change, fix the contract hand-off, do not edit dispatch beyond what §10 allows, and report.

## Handover to the others
After the migration commit: tell the owner, who merges it into the integration branch. At the end: the service functions back end B needs are exported from `requisitions-service.ts` (`notify` calls are made by back end B's hooks; leave clearly named call sites or an event interface and document it in the README).

## Tests required
State rules (table-driven), cycle uniqueness, section lines validation (only items tagged to the department; above zero), send then reopen on edit, recall only before approval, the Director and System Admin approval path and the recorded signer, additions (allowed until the dispatch is signed), cancel (before approval only), money and blind views, access rows, idempotent repeats, the contract fixtures. Opt-in database tests: the migration back-fills, dual-write, reference counter concurrency (two parallel starts get different numbers), tenancy (`siteId` on every query), and that the old dispatch queue still lists an approved requisition.

Bring back the summary in the common file, plus the migration name, the rollback note, and the production queries still needed from the owner.
