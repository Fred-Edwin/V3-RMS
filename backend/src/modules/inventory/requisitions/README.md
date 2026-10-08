# requisitions

**Design:** *Requisition and dispatch* page in Paper, approved by the owner (8 Oct 2026) · **Contract:** `docs/features/inventory/requisitions-contract.md` (+ amendment 1), frozen in code at `_shared/requisitions-contract.ts` · **Code (Block 1, back end A):** R3, R6 (data builder), R8, R10 to R22 built; R1, R2, R4, R5, R7, R9 and the print route are **back end B's** (see "Handover").

A branch asks the Central Store for stock. Heads (phone) fill and send their department's section; the Branch Manager approves once; the Director and the System Admin may approve any requisition with their own PIN. Requisitions never write the stock ledger.

## Rules (all in the service; the state table is `requisitions-state.ts`, table-tested)
- Cycles: Morning, Afternoon, Extra. **One open requisition (Collecting or Ready to approve) per branch per cycle**; a Postgres advisory lock on (branch, cycle) serialises two parallel starts.
- Section: Not started → Draft → **Sent** (the database name is `SUBMITTED`) or **Skipped**. Editing a Sent section reopens it as a Draft (and the requisition leaves Ready to approve). A Sent section can be recalled **until the requisition is signed**. A section with no lines cannot be sent. A department with no tagged items starts Skipped by rule.
- Requisition: Collecting (`OPEN`) becomes Ready to approve (`PENDING_APPROVAL`) when every section that counts is Sent or Skipped and at least one is Sent. Then Approved, or Cancelled (before approval only). `CLOSED` is set only by Block 2 through `closeIfComplete`.
- **PIN-signed:** send, approve, cancel, add (R21), approve an addition. The PIN is the caller's own, checked by the existing signing helper (`counting/_shared/count-pin.ts`, `INVALID_PIN`). Every signing write takes an `Idempotency-Key` header; the key is stored on the `RequisitionEvent` it produced (unique per requisition and person), and a repeat returns the current result with `replayed: true` without asking for the PIN again. R11 carries its key in the body (`Requisition.idempotencyKey`).
- **Approval** freezes `unitCostAtApproval` on every line of every Sent section, sets `approvedQty = requestedQty` where the manager set none (the old dispatch reads `approvedQty`), marks never-sent sections Skipped, sets `APPROVED`. `approvedById` is the signer; `approvedAsId` is also set when the signer is not the Branch Manager (Director or System Admin).
- **Additions** (R21/R22): a head, after approval, while the department's dispatch is not signed (an old `Dispatch` row for the department). The addition is `PENDING`; its lines sit on the department's section marked by `additionId`, with no Approved quantity, and the old dispatch hides them until the addition is approved. Approving freezes their cost and sets the Approved quantity.
- **Quantity change** (R16): the Branch Manager (or System Admin) at that branch. Optional reason before approval, required after; locked once the department has been dispatched (`DEPARTMENT_PACKED`).
- **Money:** `value = approvedQty (requested before the manager sets one) × unit cost`, the frozen cost once approved. Only `requisitions.see_value` holders get any `valueKes` key; a head sees their own department only, never money; the Attendant reads with no money and no stock figures. The print data has no money key (a test pins it). Decided once, in `requisitions-view.ts`.
- **Dual-write** for the old dispatch: sections carry `departmentTag` and `departmentId`; a department added in Block 1 has a null tag and is invisible to the old dispatch (`dispatch-repository.ts`, two reads).
- Access: capabilities from `_shared/central-store-access.ts` (`requisitions.*`) or the department rule (a head holds no row): `requisitions-rebuild-routes.ts` lets a signed-in head through the gate and the service applies the real rule (own department, own branch). The service trusts the person's **stored** branch and department, never the token's.

## Endpoints built here
Base `/api/v1/inventory/requisitions` (routes in `requisitions-rebuild-routes.ts`).

| # | Method and path | Who |
|---|---|---|
| R3 | `GET /:id` | `requisitions.read` or a head of a department in it |
| R8 | `GET /:id/sections/:departmentId` | head (own department), `requisitions.start`, `requisitions.read` |
| R10 | `GET /:id/approve-summary` | `requisitions.approve` |
| R11 | `POST /` | head, `requisitions.start` |
| R12 | `PUT /:id/sections/:departmentId/lines` | head (own), `requisitions.start` |
| R13 | `POST /:id/sections/:departmentId/send` | head (own), `requisitions.start`; PIN |
| R14 | `POST /:id/sections/:departmentId/recall` | head (own) |
| R15 | `PUT /:id/urgent` | `requisitions.set_urgent`; a head whose department is in it |
| R16 | `PATCH /:id/lines/:lineId` | `requisitions.change_quantity` |
| R17 | `POST /:id/sections/:departmentId/nudge` | `requisitions.nudge` |
| R18 | `POST /:id/sections/:departmentId/skip` (Amendment 2: becomes `POST /:id/skip` with `{ departmentIds }`, back end B) | `requisitions.nudge` |
| R19 | `POST /:id/approve` | `requisitions.approve`; PIN |
| R20 | `POST /:id/cancel` | `requisitions.cancel`; PIN |
| R21 | `POST /:id/additions` | head (own); PIN |
| R22 | `POST /:id/additions/:additionId/approve` | `requisitions.approve`; PIN |

`:id` is a uuid; `router.param` sends anything else to the next route, so back end B's literal paths (`/badges`, `/home`, `/history/mine`) cannot be mistaken for an id.

## Handover
**For back end B** (exported from `requisitions-service.ts` / `requisitions-print.ts`; add its routes to `requisitions-rebuild-routes.ts`):
- `requisitionsService.getFile / getPrintData`, `buildPrint(record)`, the views in `requisitions-view.ts` (`fileWire`, `sectionSummaryWire`, `Viewer`), and the repository's `findFile(id, scope)` / `listHeads`.
- **Notifications:** every write publishes ONE typed notice after commit through `requisitions-events.ts` (`requisitionNotices.publish`). Back end B calls `requisitionNotices.subscribe(listener)` once at start-up and maps `SECTION_SENT` (map row 1), `QUANTITY_CHANGED` (2), `URGENT_SET` (3 starts here; the 1-hour escalation job is B's), `APPROVED` (4), `CANCELLED` (13), plus `NUDGED`, `ADDITION_ADDED`, `ADDITION_APPROVED`. A throwing subscriber never fails a write. Nothing is delivered until B subscribes.
- **Audit:** every write appends a `RequisitionEvent` (types in `EVENT_TYPES`). Nothing edits or deletes them. `fromValue/toValue/reason/lineId` carry the details; `idempotencyKey` is internal.

**For Block 2** (named no-op exports in `requisitions-handoff.ts`): `closeIfComplete(requisitionId)` and `attachAdditionToDispatch(additionId)`. In Block 1 the old dispatch builds its lines from the requisition when the store signs, so an approved addition's lines are already there and nothing needs attaching. "Dispatch signed" is `requisitionsRepository.hasDispatch` (an old `Dispatch` row for the department); Block 2 replaces it with the packing/signing state.

## Contract drift and questions (reported to the owner)
1. **Idempotency storage:** the frozen schema only keys R11. Signing writes store their key on `RequisitionEvent.idempotencyKey` (added to the migration; unique on requisition, person, key).
2. **Extra error codes** for states the first contract did not name: `SECTION_NOT_SENT`, `SECTION_ALREADY_SENT`, `NOT_APPROVED`, `SECTION_NOT_OPEN`, `ADDITION_NOT_PENDING` (409) and `BRANCH_CODE_MISSING` (400). **Amendment 2 put all six into the contract** (`REQUISITION_ERROR_CODES`) and both mirrors; the wording by audience is the front ends'.
3. **The System Admin cannot start a requisition**: R11 has no branch in its body and the System Admin has none of their own (400 "Branch context missing").
4. **No endpoint sets `Site.code`** (the contract says the owner corrects NYR/KRT "in Settings"). Until one exists the owner corrects it in the database.
5. **Next step card and tracker are facts only** (Amendment 2): `nextStepOf` returns `{ action, departmentId, facts }` and `trackerOf` returns `{ key, state, at, by, count }`. The titles, bodies and labels are the front ends', from Paper step 22.
6. `changeQuantity`'s `valueKes` is the requisition's total; the line's own value is on `line.valueKes`.
7. Recall and addition are **head-only**; `requisitions.start` ("Fill it myself") covers edit and send, not recall or addition.

## Amendment 2 (owner approved 8 Oct 2026): contract in code, behaviour is back end B's
The wire shapes are in `_shared/requisitions-contract.ts` (list `cycle` / `departmentId` / `urgent` filters; seven row moments on R1 and R9 rows; Home `suggestedLineCount`, `openedAt`, `openByCycle`, `sentAt`; SectionEdit `openedAt`; `urgentNote` on R11 and R15; R18 `{ departmentIds }`; R20 "preset — note"; the R6 print fields; the facts-only Next step and tracker; six error codes). Two access rows, `requisitions.edit_on_behalf` and `requisitions.send_on_behalf`, are held by the Branch Manager and the System Admin only (the Director approves but does not fill a section).
**Back end B owes** (each place is marked `// back end B` in code where a placeholder stands): the R1 filters and row moments; Home `suggestedLineCount` / `openedAt` / `openByCycle` / `sentAt`; storing and returning `urgentNote` (needs a column); on-behalf open, edit and send (service rules, the head is told, audit event); the R18 list route (`POST /:id/skip`, one transaction, one audit event per section; the current route skips one department and returns it as a one-item list); validating the cancel reason through `cancelInputSchema` is already live, the note format is the front end's; the R6 print fields (`askedBy`, `askedAt`, `deliverTo`, addition `approvedAt`, real `generatedAt`); the retire check in `departments/`; the branch-code endpoint; `inventory:badges`; audit scope; the routes shim swap in `routes/index.ts`; branch codes fixed by name in production.

## Code map
`requisitions-rebuild-routes.ts` (the router; `requisitions-routes.ts` is an empty shim until the orchestrator removes its import from `routes/index.ts`), `-controller.ts`, `-service.ts`, `-repository.ts`, `-validators.ts`, `requisitions-state.ts` (pure rules), `requisitions-view.ts` (wire builders; money and blind rules), `requisitions-print.ts` (R6 data), `requisitions-errors.ts`, `requisitions-events.ts` (notice seam), `requisitions-handoff.ts` (Block 2 no-ops), `requisitions-fixtures.ts` (test records), `_shared/requisitions-contract.ts` + fixtures + test.
Tests: state (table-driven), service (mocked data layer), wire (output parses against the contract), routes (role by endpoint), `requisitions.db.test.ts` (opt-in: `RUN_DB_TESTS=1` with the lane's `DATABASE_URL`).

## Coupling
`departments/` (sections per active department, `ItemDepartment`), `counting/_shared` (PIN helper, `toPerson`), `_shared/reference-counter` (`REQ`), `_shared/central-store-access`, the old `dispatch/` (reads the same tables; two reads were adjusted).
