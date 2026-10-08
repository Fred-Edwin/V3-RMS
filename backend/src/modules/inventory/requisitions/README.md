# requisitions

**Design:** *Requisition and dispatch* page in Paper, approved by the owner (8 Oct 2026) · **Contract:** `docs/features/inventory/requisitions-contract.md` (+ amendment 1), frozen in code at `_shared/requisitions-contract.ts` · **Code (Block 1):** back end A built R3, R8, R10 to R22; back end B built R1, R2, R4, R5, R6, R7, R9, the notification wiring, the urgent escalation job, the Audit log source, the branch-code correction and every Amendment 2 behaviour (see "Back end B").

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
- Access: capabilities from `_shared/central-store-access.ts` (`requisitions.*`) or the department rule (a head holds no row): `requisitions-routes.ts` lets a signed-in head through the gate and the service applies the real rule (own department, own branch). The service trusts the person's **stored** branch and department, never the token's.

## Endpoints built here
Base `/api/v1/inventory/requisitions` (routes in `requisitions-routes.ts`; the old stub and the old import in `routes/index.ts` are gone).

| # | Method and path | Who |
|---|---|---|
| R1 | `GET /` `tab`, `branchId?` (hub roles), `q`, `from`, `to`, `status`, `cycle`, `departmentId`, `urgent`, `page`, `pageSize` | `requisitions.read`; a head: own department only, no money |
| R2 | `GET /badges` | `requisitions.read` or a head |
| R4 | `GET /:id/activity` | `requisitions.read` or own-department head |
| R5 | `GET /:id/documents` | same |
| R6 | `GET /:id/print` | `requisitions.read` (no money anywhere) |
| R7 | `GET /home` | a head |
| R9 | `GET /history/mine` `from`, `to`, `status`, `page`, `pageSize` | a head |
| – | `PATCH /branches/:branchId/code` `{ code }` | `branches.set_code` (System Admin only; no screen) |
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
| R18 | `POST /:id/skip` `{ departmentIds }` (Amendment 2; one transaction, one audit event per section) | `requisitions.nudge` |
| R19 | `POST /:id/approve` | `requisitions.approve`; PIN |
| R20 | `POST /:id/cancel` | `requisitions.cancel`; PIN |
| R21 | `POST /:id/additions` | head (own); PIN |
| R22 | `POST /:id/additions/:additionId/approve` | `requisitions.approve`; PIN |

`:id` is a uuid; `router.param` sends anything else to the next route, so the literal paths (`/badges`, `/home`, `/history/mine`, `/branches/...`) cannot be mistaken for an id.

## Back end B (lists, badges, notifications, escalation, audit)
- **R1 list** (`requisitions-list-service.ts`, queries in `requisitions-list-repository.ts`): reads the light facts of every requisition inside the filters, derives each one's tab, counts the seven tabs, cuts the page, then loads full records for that page only. A hub role gets `branches` (the picker) and may pass `branchId`; a Branch Manager or head is held to their own branch (a `branchId` in the query changes nothing). A head sees their own department only and never money; the Attendant gets rows with no `valueKes`. `EXTRA` also matches old `EVENING`/`AD_HOC` rows. Search covers reference, branch name, department name and item name. Dates are Nairobi days; `to` is inclusive.
- **Tabs** (`requisitions-tabs.ts`, `tabOf`, the one function Block 2 replaces): Collecting = `OPEN`; To approve = `PENDING_APPROVAL`, or approved with an addition waiting; then, for approved, from the OLD dispatch rows: any `DISCREPANCY_OPEN` = Discrepancies; a Sent department with no signed dispatch = To pack; `IN_TRANSIT` = On the way; all confirmed = Closed (shown; `CLOSED` itself stays Block 2's). Cancelled and Closed = Closed. **To confirm is empty until Block 2.** A department added in Block 1 has no legacy key and never holds a requisition in To pack.
- **`waitingForYou` and R2** (decided here, flag if wrong): approvers (Branch Manager, Director, System Admin) wait on **To approve**; the store (Store Manager, Attendant) on **To pack**; a head on **their own unsent list** while the requisition is collecting; the Accountant and anyone else on nothing. R2 returns `requisitions` (that number) plus `toApprove` or `toPack` for the families that have one.
- **R7 Home:** suggested cycle is Morning before 12:00 Nairobi, Afternoon after (Extra is the head's choice); `open` is today's latest non-cancelled requisition for that cycle; `openByCycle` the same per cycle; `earlierToday` the other non-cancelled ones today with the head's section; `suggestedLineCount` is the items whose restock level is above what is on hand. **R9 History** is the head's department's requisitions of any status, newest first, with the moments (`sentAt` = when the head's section was sent). R1 rows keep `sentAt` null.
- **R4 Activity / R5 Documents:** sentences come from `_shared/requisitions-sentences.ts` (shared with the Audit log). Documents are derived, never stored: version 1 at approval, one more per approved addition. A head reads whole-requisition events and their own department's, not others'.
- **Urgent note:** column `requisitions.urgent_note` (migration `20261008150000_requisitions_urgent_note`, which also fixes the production branch codes by name: Nyeri Town NYR, King'ong'o KNG, Wendo Nyahururu NYH, renaming the back-filled `REQ-` references with them). Set with Urgent (R11, R15), dropped when Urgent is cleared; changing only the note keeps the hour running. Setting Urgent again clears `urgentEscalatedAt`.
- **On behalf ("Fill it myself"):** `requisitions.edit_on_behalf` to open and edit, `requisitions.send_on_behalf` to send, held by the Branch Manager of that branch **alone**; only while the section is Not started or Draft (`SECTION_NOT_OPEN` otherwise); the PIN is the Branch Manager's own; the `LINE_CHANGED`/`SENT` event carries the reason "On behalf of the head" and the Branch Manager as actor; the head is told (push, collapsed per department so repeated saves replace each other).
- **Error codes, where each is raised:** `SECTION_NOT_SENT` recall of an unsent section, R16 on an unsent section · `SECTION_ALREADY_SENT` R13 on a Sent section, R17/R18 on a Sent one · `SECTION_NOT_OPEN` R12 or on-behalf R13 on a section that is not open, R17/R18 on a Skipped one · `NOT_APPROVED` R21 and R22 on an unsigned requisition · `ADDITION_NOT_PENDING` R22 on a decided addition · `BRANCH_CODE_MISSING` R11 · `DEPARTMENT_HAS_OPEN_SECTIONS` retire (departments). Table-tested in `requisitions-service.test.ts` and `departments-service.test.ts`.
- **Print (R6):** `askedBy`/`askedAt` are the section's sender and time; `deliverTo` is "{Department}, {Branch}" (Paper step 17); an addition's `approvedAt` is its approval time; `generatedAt` comes from the caller's clock.
- **Branch code:** `PATCH /branches/:branchId/code` (System Admin). Three capital letters, unique among branches (`409 BRANCH_CODE_TAKEN`). References already issued keep the code they were issued with.

### How the live nudge reaches screens (integration, 8 Oct 2026)
`inventory:badges` goes to the site's room **and** to `inventory:all-sites`, which the Director, System Admin, Store Manager, Accountant and Store Attendant join when they connect (the Director has no site, so no branch room). The urgent escalation runs in the **worker** process, which has its own socket server with no browsers, so every nudge is also published on a Redis channel (`sockets/inventory-badges-bridge.ts`) and each process re-emits what it hears from the others to its own clients; a process ignores its own message. Checked live: at the job's 19:43:00 tick the Director's page refetched its badges and file. A failed publish is logged, never thrown; screens also refetch when the tab returns to the front.

### Notifications wired (the notification layer is `inventory/_shared/notify.ts`)
`requisitions-notices.ts` subscribes once at start-up (`server.ts`) and maps each notice to a push, a badge nudge and, for nobody, an Inbox row (there is none). Map rows 1, 2, 3, 4 and 13 plus the writes the contract says "tell" someone.

| Moment (map row) | Who is told | How |
|---|---|---|
| 1 A head sends a section | Branch Manager | push ("A list is waiting", or "Ready to approve" for the last one) + branch badge nudge |
| 1 (on behalf) The Branch Manager sends for a head | that department's head | push + nudge |
| Branch Manager fills a head's list | that department's head | push (one per requisition and department) + nudge |
| 2 Manager changes a quantity | head of that department | push with item, from, to, reason + nudge |
| 3 Urgent set | Branch Manager at once | high-urgency push + nudge |
| 3 Urgent unapproved for 1 hour | every Director | worker job every minute, once per requisition (`urgentEscalatedAt`), high-urgency push, not held for quiet hours |
| 4 Approved | heads whose lists were in (and the Branch Manager if a Director or System Admin signed) | push; the store (hub room) by badge nudge only |
| 13 Cancelled | heads whose lists were not skipped | push with reason; branch and hub badge nudge |
| Nudge | that department's head | push |
| Addition added after approval | Branch Manager | push |
| Addition approved | that department's head | push |

**Left for Blocks 2 to 4:** packed and dispatched (store → heads, branch), delivery arrived / confirm (head), discrepancy opened and settled, day close and the branch-day moments, the Director's count alert (map row 10, still Counting's own, held for quiet hours there), branch waste. **Not wired on purpose:** an Inbox row for any of them (Amendment 1).

## Handover
- **Audit:** every write appends a `RequisitionEvent` (types in `EVENT_TYPES`). Nothing edits or deletes them. `fromValue/toValue/reason/lineId` carry the details; `idempotencyKey` is internal. `APPROVED` keeps in `fromValue` how many lines the signature covered; `URGENT_SET` keeps the note in `toValue`.

**For Block 2** (named no-op exports in `requisitions-handoff.ts`): `closeIfComplete(requisitionId)` and `attachAdditionToDispatch(additionId)`. In Block 1 the old dispatch builds its lines from the requisition when the store signs, so an approved addition's lines are already there and nothing needs attaching. "Dispatch signed" is `requisitionsRepository.hasDispatch` (an old `Dispatch` row for the department); Block 2 replaces it with the packing/signing state.

## Contract drift and questions (reported to the owner)
1. **Idempotency storage:** the frozen schema only keys R11. Signing writes store their key on `RequisitionEvent.idempotencyKey` (added to the migration; unique on requisition, person, key).
2. **Extra error codes** for states the first contract did not name: `SECTION_NOT_SENT`, `SECTION_ALREADY_SENT`, `NOT_APPROVED`, `SECTION_NOT_OPEN`, `ADDITION_NOT_PENDING` (409) and `BRANCH_CODE_MISSING` (400). **Amendment 2 put all six into the contract** (`REQUISITION_ERROR_CODES`) and both mirrors; the wording by audience is the front ends'.
3. **The System Admin cannot start a requisition**: R11 has no branch in its body and the System Admin has none of their own (400 "Branch context missing").
4. **`Site.code`** is corrected by `PATCH /branches/:branchId/code` (System Admin, back end B; no screen in Block 1).
5. **Next step card and tracker are facts only** (Amendment 2): `nextStepOf` returns `{ action, departmentId, facts }` and `trackerOf` returns `{ key, state, at, by, count }`. The titles, bodies and labels are the front ends', from Paper step 22.
6. `changeQuantity`'s `valueKes` is the requisition's total; the line's own value is on `line.valueKes`.
7. Recall and addition are **head-only**; `requisitions.start` ("Fill it myself") covers edit and send, not recall or addition.

## Amendment 2 (owner approved 8 Oct 2026): contract in code, behaviour built by back end B
The wire shapes are in `_shared/requisitions-contract.ts` (list `cycle` / `departmentId` / `urgent` filters; seven row moments on R1 and R9 rows; Home `suggestedLineCount`, `openedAt`, `openByCycle`, `sentAt`; SectionEdit `openedAt`; `urgentNote` on R11 and R15; R18 `{ departmentIds }`; R20 "preset — note"; the R6 print fields; the facts-only Next step and tracker; six error codes). Two access rows, `requisitions.edit_on_behalf` and `requisitions.send_on_behalf`, are held by the Branch Manager **alone** (owner, 8 Oct 2026): not the System Admin, and not the Director, who approves but does not fill a section. **`sentAt`:** on an R9 history row it is when the head's section was sent; on an R1 row it stays null (decided by back end B: the list has no single sender). Everything the amendment lists for back end B is built (see "Back end B" above); no `// back end B` marker is left in code. The cancel reason is validated through `cancelInputSchema`; the note format is the front end's.

## Code map
`requisitions-routes.ts` (the router), `-controller.ts`, `-service.ts`, `-repository.ts`, `-validators.ts`, `requisitions-list-service.ts` + `requisitions-list-repository.ts` (R1, R2, R4, R5, R7, R9), `requisitions-tabs.ts` (the tab derivation Block 2 replaces), `requisitions-notices.ts` (notices to the notification layer), `requisitions-branch-code.ts`, `_shared/requisitions-sentences.ts`, `requisitions-state.ts` (pure rules), `requisitions-view.ts` (wire builders; money and blind rules), `requisitions-print.ts` (R6 data), `requisitions-errors.ts`, `requisitions-events.ts` (notice seam), `requisitions-handoff.ts` (Block 2 no-ops), `requisitions-fixtures.ts` (test records), `_shared/requisitions-contract.ts` + fixtures + test.
Tests: state and tabs (table-driven), service and list service (mocked data layer), sentences, notices, branch code, wire (output parses against the contract), routes (role by endpoint), the escalation job (`src/jobs/requisition-urgent-escalation.test.ts`), the notification layer (`_shared/notify.test.ts`), and two opt-in database files, `requisitions.db.test.ts` and `requisitions-list.db.test.ts` (`RUN_DB_TESTS=1` with the lane's `DATABASE_URL` exported). Both files use the same database and the first reads all of it, so each takes a Postgres advisory lock for its whole run (`inventory/_shared/db-test-lock.ts`) and they can be run together or in any order; the clash this fixed failed two back-fill checks whenever the files overlapped.

## Coupling
`departments/` (sections per active department, `ItemDepartment`), `counting/_shared` (PIN helper, `toPerson`), `_shared/reference-counter` (`REQ`), `_shared/central-store-access`, the old `dispatch/` (reads the same tables; two reads were adjusted).
