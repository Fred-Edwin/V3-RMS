# Block 1: Requisitions and the foundations, the contract (draft for owner freeze, 8 Oct 2026)

Written by the coordinator. **Status: draft.** It becomes frozen when the owner approves it; after that a change needs an owner-approved amendment (`FEATURE_REDO_PLAYBOOK.md` step 5). Paper (page "Inventory · Requisition and dispatch", steps 1 to 22 including 7b and 18b; "gap fixes (8 Oct)" G1 and G4; "Final design pass: map") wins over this text; the flow is `requisitions-flow.md`. Plan and order: `final-pass-build-plan.md`. Model: `stock-count-waste-contract.md`.

**What Block 1 delivers:** the whole Requisitions flow for heads (phone), the Branch Manager, the Director and every other desktop role; departments as data; the branch code and numbering; the notification layer and the badge counts; the heads' and members' move onto the new shell. **What it does not deliver:** packing, dispatch, deliveries and discrepancies (Block 2). The old dispatch code keeps working on top of the new requisitions until Block 2 (see §10).

## 1. Decisions that shape it

- A head's send, the Branch Manager's approve, an addition's head send and approve, and a cancel are **PIN-signed**. Starting, editing, recalling, nudging, changing a quantity and setting Urgent are not.
- **No "Return a section."** The manager edits the Approved quantity in the row; the head is told.
- **Cycles:** Morning, Afternoon, Extra. One open requisition per branch per cycle.
- **The Director may approve any requisition and any addition**, for any branch, with their own PIN; the record shows who approved. The System Admin may do every action, with their own PIN.
- **Money shows only to the Branch Manager** (and the hub desktop roles that read it); heads, members and the Attendant never see money. The printed requisition has no money.
- **Additions after approval** are allowed until that department's dispatch is signed. After that a new need is a new requisition (Extra).
- **Urgent:** can be set at start or any time before approval; tells the Branch Manager at once and the Director after 1 hour (fixed). It never bypasses the signature.
- Titles, not names, in screen copy. Names appear only where a record states who did something.

## 2. Data model and migration (expand now, contract in Block 4)

One migration, written and applied locally by back end A as its **first commit**, then merged so the other sessions start from it. Never `migrate dev` on production; generate locally, commit beside the schema, test on a restored production copy. Files: `prisma/schema/inventory/requisitions-dispatch.prisma` (edit), a new `departments.prisma`, and a column on `Site` in the schema file that holds it. Old columns, enums and old values stay until the **contract** migration in Block 4, so the old dispatch and branch-day code keep running.

### 2.1 Departments as data (the foundation for every later block)

```
enum DepartmentStatus { ACTIVE RETIRED }
Department  id, siteId (the branch), name String, key DepartmentTag?  (the legacy enum value for the original five; null for an added one),
            status DepartmentStatus @default(ACTIVE), position Int, retiredAt DateTime?, createdAt, updatedAt
            @@unique([siteId, name])  @@index([siteId, status])
            // seeded in the migration: five rows per branch (Kitchen, Barista, Pastry, Service, Housekeeping), key = the enum value
ItemDepartment  itemId, departmentId  @@id([itemId, departmentId])
            // which departments an item is tagged to. Back-filled from InventoryItem.departmentTags[] (company items map to each branch's department with the same key). The enum array stays and is DUAL-WRITTEN until the contract migration.
```

Dual-write rule for the expand phase: **every write that sets `InventoryItem.departmentTags`, `User.departmentTag` or `Location.departmentTag` also sets the id-based link** (`ItemDepartment`, new `User.departmentId`, new `Location.departmentId`, back-filled in the migration). Reads in the new code use ids only; the old code keeps reading the enums. The catalog's item panel department chips are driven by Department rows (a small change in the catalog sub-module, owned by back end A and front end desktop; it must not alter anything else there). Renaming or retiring a department never touches the enum key. An **added** department has `key = null`: it can be tagged to items and given staff through the id links, and old code simply does not see it (the old dispatch and day screens are replaced in Blocks 2 and 4).

### 2.2 Branch code and numbering

`Site.code String?` (three letters, unique among branch sites; the migration sets NYR for Nyeri Town and KRT for Karatina; the owner corrects them in Settings before the first new requisition if wrong). References use the existing `ReferenceCounter` on the **branch** site: `REQ-{code}-{nnnn}` with prefix `REQ`, gap-free, taken in the same transaction as the requisition. The migration back-fills a `REQ-` reference for every existing requisition, per branch in `openedAt` order. (`DSP-`, `DSC-` and `DAY-` follow the same shape in Blocks 2 and 4; `DSC` today counts on the hub.)

### 2.3 Requisition (additive columns and enum values)

```
enum RequisitionType     + EXTRA                         // OPEN values MORNING, AFTERNOON, EVENING, AD_HOC stay; AD_HOC and EVENING rows are mapped to EXTRA by the migration (owner confirms from the production counts); new code writes only MORNING, AFTERNOON, EXTRA
enum RequisitionStatus   + CANCELLED, CLOSED             // OPEN = Collecting, PENDING_APPROVAL = Ready to approve (every active section sent or skipped), APPROVED stays
enum RequisitionSectionStatus + SKIPPED                  // "Send without this section"; RETURNED stays in the enum, never written by new code
Requisition  + reference String @@unique([siteId, reference]), urgent Boolean @default(false), urgentAt DateTime?, urgentEscalatedAt DateTime?,
             cancelledAt?, cancelledById?, cancelReason String?, closedAt?, approvedAsId String? (the signer if not the Branch Manager: Director or System Admin),
             idempotencyKey String? @@unique([siteId, openedById, idempotencyKey])
RequisitionSection + departmentId (FK Department, dual-written with departmentTag), skippedById?, skippedAt?   // "sent" is the existing SUBMITTED status with submittedAt and submittedById (amendment 1: no sentAt); the wire shows SUBMITTED as "Sent"
RequisitionLine + suggestedQty Decimal?   // what the screen pre-filled (restock level minus on hand), for "changed from 27"
                + onHandAtRequest Decimal? // beside parAtRequest, both shown under the item name
                + unitCostAtApproval Decimal(12,4)? // frozen when approved; the Branch Manager's value
                + additionId String? (FK RequisitionAddition)
RequisitionAddition  id, requisitionId, departmentId, addedById, addedAt, sentPinSignedAt, status PENDING | APPROVED | CANCELLED, approvedById?, approvedAt?
RequisitionEvent     id, requisitionId, sectionId?, type String, actorId, actorRoleLabel, at, fromValue String?, toValue String?, reason String?, lineId?
                     // append-only activity: the file's Activity tab and the Audit log's REQUISITIONS source read it. Never edited or deleted.
Department head and member sets: the Department's head is the user with isDepartmentHead whose departmentId matches; members are active users with that departmentId.
```

A cancelled requisition keeps its lines and sections. A requisition becomes `CLOSED` when every department's dispatch is confirmed and every discrepancy is settled or open-but-confirmed (rule lives in Block 2; Block 1 sets nothing to CLOSED except through the Block 2 hook, which Block 1 leaves as a no-op function `closeIfComplete(requisitionId)` that Block 2 fills in).

## 3. Access (`_shared/central-store-access.ts`, new rows)

Read for every desktop role; write by job. The client has not approved role names, so every row is a one-row edit. Heads and members hold none of these from the table: their rights come from the department rule in the service (`isDepartmentHead` and `departmentId` on the user), exactly as for restock levels. A member can read their department's deliveries (Block 2) and has no Requisitions row; only a head sends.

| Capability | Meaning | Held by |
|---|---|---|
| `requisitions.read` | open every requisition list and file; money follows `requisitions.see_value` | Store Manager, System Admin, Accountant, Director, Branch Manager, Store Attendant (no money, no branch figures) |
| `requisitions.see_value` | value per line, department and total | Branch Manager, Store Manager, System Admin, Accountant, Director |
| `requisitions.start` | start a requisition for the cycle; edit any section's lines ("Fill it myself") | Branch Manager, System Admin |
| `requisitions.change_quantity` | change an Approved quantity, with an optional reason | Branch Manager, System Admin |
| `requisitions.approve` | approve and sign a requisition or an addition (own PIN) | Branch Manager, Director, System Admin |
| `requisitions.cancel` | cancel before approval, with a reason and a PIN | Branch Manager, System Admin |
| `requisitions.nudge` | nudge a department; send without a section | Branch Manager, System Admin |
| `requisitions.set_urgent` | set or clear Urgent before approval (a head may for their own section by the department rule) | Branch Manager, System Admin |
| `departments.read` | Departments settings, read only | Store Manager, System Admin, Accountant, Director, Branch Manager |
| `departments.write` | add, rename, retire, restore | Branch Manager (own branch), System Admin |

Where a Branch Manager acts, the service requires their own branch; the Director and hub roles read any branch through `central_store.read_any_org`; **writes** by the Director are limited to `requisitions.approve`. The head's own rights (service rules): start the requisition for the cycle if none is open, edit and send **their own department's** section, recall it until approved, set Urgent on their section, add to an approved requisition while their department's dispatch is not signed. A head never sees money.

## 4. API

Base paths: `/inventory/requisitions` and `/inventory/departments`. Every route: `authenticate` plus the capability or the department rule above. Wire rules as `_shared/wire.ts` (decimals are strings, ids strings, ISO times, Nairobi dates). A field marked cap is **absent** (not null) for callers without the capability. Writes that sign take `{ pin }` and an `Idempotency-Key` header; a repeated key returns the first result.

### 4.1 Reads

| # | Method and path | Who | Returns |
|---|---|---|---|
| R1 | `GET /` query `tab` (`collecting` `to-approve` `to-pack` `on-the-way` `to-confirm` `discrepancies` `closed`), `branchId?`, `q?`, `from?`, `to?`, `status?`, `page`, `pageSize` | `requisitions.read`; a head gets own department rows only (no money) | rows (reference, cycle label "Afternoon · Wed 7 Oct", branch, status, sections state, lines, value cap, openedAt, urgent flag, `urgentOverHour` flag), `tabCounts`, `waitingForYou` (the dark badge), `pageInfo`. A hub role also gets `branches` for the picker. Tabs `to-pack` to `discrepancies` are derived from the existing dispatch status until Block 2 replaces the source |
| R2 | `GET /badges` | any signed-in role with a Requisitions row | the sidebar badge counts for the caller's role (To approve for the Branch Manager, To pack for the store, Deliveries for heads in Block 2) |
| R3 | `GET /:id` | `requisitions.read` or own-department head | the file: header (reference, cycle, branch, status, tracker with dates and who, Next step card state and its one action key), per department section (status, lines with requested, approved, suggested, onHand, level, changed flags, value cap), additions block, `dispatches` (empty until Block 2), flags |
| R4 | `GET /:id/activity` | same | `RequisitionEvent` rows with plain-word sentences, record links |
| R5 | `GET /:id/documents` | same | the printed requisition versions |
| R6 | `GET /:id/print` | `requisitions.read` | data for the A4 (cover plus one page per department, **no money**) |
| R7 | `GET /home` | a head | the head's Requisitions home: suggested cycle by time of day, the open requisition for the cycle (or none), earlier today |
| R8 | `GET /:id/sections/:departmentId` | head of that department, `requisitions.start`, `requisitions.read` (no cost for the head) | the section for editing (lines grouped by category, two levels for Kitchen) |
| R9 | `GET /history/mine` query `from`, `to`, `status`, page | a head | gap-fix G1: the head's department's past requisitions, no costs |
| R10 | `GET /:id/approve-summary` | `requisitions.approve` | the drawer summary: per department line counts and value, what changed, one signature line |

### 4.2 Writes

| # | Method and path | Who | Body and rules |
|---|---|---|---|
| R11 | `POST /` | head (own branch), `requisitions.start` | `{ cycle, urgent?, idempotencyKey }`. Creates one section per **active** department; the starter's section is pre-filled with restock level minus on hand; others stay Not started. 409 if one is open for the cycle |
| R12 | `PUT /:id/sections/:departmentId/lines` | head (own), `requisitions.start` | the whole draft: `{ lines: [{ itemId, requestedQty }], noteForManager? }`. Only items tagged to the department; quantities above zero. Allowed while the section is Not started or Draft or Sent but not approved (a sent section reopens as Draft) |
| R13 | `POST /:id/sections/:departmentId/send` | head (own), `requisitions.start` | `{ pin }`. PIN and summary are one sheet. Sets Sent, tells the Branch Manager, moves the requisition to Ready to approve when every active section is Sent or Skipped |
| R14 | `POST /:id/sections/:departmentId/recall` | head (own) | only until the requisition is approved; back to Draft |
| R15 | `PUT /:id/urgent` | `requisitions.set_urgent`, head (own section) | `{ urgent }`; before approval only |
| R16 | `PATCH /:id/lines/:lineId` | `requisitions.change_quantity` | `{ approvedQty, reason? }` (reason chips). Tells the head what changed. Only before approval, or after approval by the Branch Manager until that department is packed, with a required reason |
| R17 | `POST /:id/sections/:departmentId/nudge` | `requisitions.nudge` | tells the head |
| R18 | `POST /:id/sections/:departmentId/skip` | `requisitions.nudge` | "Send without this section" |
| R19 | `POST /:id/approve` | `requisitions.approve` | `{ pin }`. Freezes `unitCostAtApproval`, sets APPROVED, tells every head, adds the requisition to the store's queue (the old dispatch queue keeps reading it, §10). The signer is recorded (Branch Manager, Director or System Admin) |
| R20 | `POST /:id/cancel` | `requisitions.cancel` | `{ reason, pin }`, before approval only; the file stays, marked Cancelled |
| R21 | `POST /:id/additions` | head (own), allowed while the department's dispatch is not signed | `{ lines, pin }`; creates a PENDING addition shown as "Added after approval" |
| R22 | `POST /:id/additions/:additionId/approve` | `requisitions.approve` | `{ pin }`; the lines join the department's unsigned dispatch (the hand-off to Block 2 is a function `attachAdditionToDispatch`, a no-op until Block 2 fills it) |

### 4.3 Departments

| # | Method and path | Who | Notes |
|---|---|---|---|
| R23 | `GET /inventory/departments?branchId` | `departments.read` | rows: name, head, items tagged, status; the branch picker for hub roles |
| R24 | `POST /inventory/departments` | `departments.write` | `{ branchId, name }` |
| R25 | `PATCH /inventory/departments/:id` | `departments.write` | rename |
| R26 | `POST /inventory/departments/:id/retire` and `/restore` | `departments.write` | past requisitions keep their sections; a retired department gets no section in new requisitions |

## 5. The state of a requisition (service rules, table-tested)

- **Collecting** (OPEN): heads fill and send; the manager can nudge. **Ready to approve** (PENDING_APPROVAL): every active section Sent or Skipped. **Approved**: signed. **Addition waiting**: an addition is PENDING (shown in To approve). **Packing, On the way, To confirm**: derived from dispatches (Block 2). **Closed**, **Cancelled**.
- A department with no tagged items counts as done (a Skipped-by-rule section). A section with no lines cannot be sent.
- The urgent flag raises `urgentAt`; after 1 hour unapproved a job sets `urgentEscalatedAt` and tells the Director (idempotent, one escalation).
- One signature covers the whole requisition. Editing any approved quantity after approval is the Branch Manager's, with a reason, until that department is packed; every change is an event.
- Money: `value = approvedQty × unitCost` using `unitCostAtApproval` once approved, the current item cost before; shown only with `requisitions.see_value`.

## 6. Blind and money rules

Heads and members: item names, units, quantities, on hand and restock level for **their own** department, never costs. The Attendant: read, no money, no branch values. One helper builds the view from the capabilities (extend `_shared/blind-rule.ts`; do not write a second check).

## 7. Notifications, badges, sockets, timers (the one notification layer)

A small layer in `_shared/` (`notify.ts`) used by every block: it sends an FCM push (existing push service: `authRepository.findFcmTokensByRole`, `findDirectorFcmTokens`, plus a new small finder for a department's head and members; **amendment 1: it writes no Inbox row, because the product's Inbox is chat only; wherever the map says "Inbox row" the build gives a push, a badge and a line on the page, and the Inbox row waits for a later notification-centre decision**) to the named people, and emits a socket nudge `inventory:badges` to the site room so open screens refetch R2. **Quiet hours:** only the Director's count alert is held 22:00 to 05:00 Africa/Nairobi today; the layer takes a `holdInQuietHours` flag. Moments in Block 1 (map rows): 1 head sends (Branch Manager: badge and tab count), 2 manager changes quantities (head: push and the phone screen), 3 urgent over an hour (Director: banner and push), 4 approved (store: badge; heads: told), 13 cancelled (head, and the store if it was approved: push and the Cancelled line on the file, per the default). The socket event `inventory:badges` is new (the old requisition payloads are the only existing events). Jobs (existing worker): the urgent escalation, checked every minute.

## 8. Audit

Each write appends a `RequisitionEvent`. The Audit log sub-module reads `RequisitionEvent` as a new source with area `REQUISITIONS` (lane 0 adds the Area menu, the range picker and the Branch filter; back end B adds the source and the sentences, for example "Approved REQ-NYR-0112 · 40 lines · signed with PIN", with the record link). Events: started, line changed, sent, recalled, quantity changed (from, to, reason), skipped, nudged, urgent set or cleared, approved (signer), cancelled (reason), addition added, addition approved. Printing is not an event. Nothing is edited or deleted.

**Amendment 1, scope change:** the Audit log is hub-only today and merges five fixed sources. Back end B extends it to read **branch-site** sources: requisition events live on the branch site, so the service gains a scope parameter (hub roles read every branch through `central_store.read_any_org`; the Branch Manager's own-branch audit link, Paper step 60, reads only their branch) while the hub-only guard for the Central Store areas stays. This is the shared groundwork Blocks 2 to 4 reuse; keep it small and tested.

## 16. Amendment 1 (owner decisions on the contract-in-code review, 8 Oct 2026)

1. **Departments and Site.code do not exist yet:** the migration creates `Site.code`, `Department`, `ItemDepartment`, `User.departmentId` and `Location.departmentId`.
2. **Store Manager exclusions:** the access table gives the Store Manager everything except an exclusion list; the new start, change-quantity, approve, cancel, nudge, set-urgent and departments-write rows were added to that list so §3 holds.
3. **Role names:** the Branch Manager's role value is `MANAGER`; the Director holds only `requisitions.approve` among the writes.
4. **No Inbox rows** (see §7). Push, badge and on-page lines only. The Director's count alert Inbox row (map row 10) and the "Inbox row" wording elsewhere are deferred; `counting` keeps its current behaviour.
5. **`sentAt` dropped** (see §2.3).
6. **Wire shapes the contract-in-code session proposed are accepted:** database status names plus a `statusText`; R8 returns the department's addable items so the screen searches them locally (no add-item search endpoint); R16's reason is free text (maximum length) because the chips are a screen convention; `can` flags, `nextStep`, `tracker`, `rowAction`, the mutation result common part and the error envelope are the shapes in `requisitions-contract.ts`; heads see only their own section and additions in R3; the print has no money keys.
7. **The one open check:** that session did not open Paper steps 1 to 20 at full size. The two front-end sessions do that first (their prompts say so) and report every gap; I batch the gaps into **Amendment 2** before back end B starts. Back end A's migration and write rules are not affected by it.
8. The front-end `requisitions/index.ts` barrel does not export the new mirror yet (old type names clash); that switch belongs to the PR that deletes the old screens.

## 9. Ledger

Requisitions never write the stock ledger. No change to `ledger-guard.test.ts` in Block 1.

## 10. Coupling with the old dispatch (expand only)

The old dispatch queue and fulfil code read `Requisition`, `RequisitionSection` and `RequisitionLine` by `departmentTag`, `status = APPROVED` and `approvedQty`. Block 1 keeps all of that true: it dual-writes `departmentTag` and `departmentId` on sections, writes `approvedQty` on lines, sets `status = APPROVED` on approval, and does not rename or drop any column. A department **added** in Block 1 (no enum key) appears in new requisitions but not in the old dispatch queue until Block 2 replaces it; the plan therefore asks the owner **not to add a department in production before Block 2 ships** (rename and retire are safe). Additions approved in Block 1 are attached to the department's unsigned old dispatch by the old code's existing line model (lines added with `isSubstitute = false`); if that proves unsafe, back end A stops and asks.

## 11. Code placement

### 11.1 Back end (`backend/src/modules/inventory/`)

```
requisitions/        README.md, requisitions-routes.ts, -controller.ts, -service.ts, -repository.ts, -validators.ts, requisitions.types.ts, tests beside
requisitions/_shared/requisitions-contract.ts (+ .fixtures.json + .test.ts)   the frozen wire types
requisitions/requisitions-print.ts   the A4 data builder
departments/         README.md, departments-routes.ts, -controller.ts, -service.ts, -repository.ts, -validators.ts, departments.types.ts, tests, _shared/departments-contract.ts
_shared/notify.ts    the notification layer (+ test); _shared/central-store-access.ts (rows in §3); _shared/blind-rule.ts (extended)
```

Existing `requisitions/*` files are **replaced in place** (the old controller, service, repository, validators, types, and the two old tests are deleted in the same PR; keep none of the old return/ per-section approval endpoints). `routes/index.ts` wiring is done by the orchestrator, not the sessions.

### 11.2 Front end (`frontend/features/inventory/`)

```
requisitions/   components/ (phone: home, section, add-item, send-sheet, sent, my-requisitions; desktop: list, file, change-quantity, approve-drawer, cancel-dialog, additions, print), hooks/, lib/ (words and wording tables, states copy), services/, store/ if needed, types/, README.md
requisitions/_shared/types/requisitions-contract.ts  (mirror of the back end, identical fixtures and test)
departments/    components/ (departments table, add and rename dialogs), hooks/, services/, types/, README.md
_shared/        extend with the date range picker if not already shared
```

Pages (thin shells): `app/app/branch/(shell)/requisitions/...` for the desktop roles and the heads (phone column), and `app/app/inventory/(shell)/requisitions/...` for the hub roles; `app/app/branch/requisitions-print/[id]`. Old `app/app/requisitions/*`, `features/inventory/requisitions/*` old components and the legacy head route are deleted in the same PR. Nav: `nav-table.ts` rows change only (§12). Primitives: `components/ui2/` only.

## 12. Nav rows (one Requisitions row per role)

Branch Manager: Branch group lists **Requisitions** (sub-links Queue, Discrepancies, History as drawn) and Day; the Deliveries row is removed (folded into the tabs). Hub roles (Store Manager, System Admin, Accountant, Director): one Requisitions row in the Central Store group, replacing Dispatch for those roles; the Attendant keeps a Dispatch row (Block 2 rebuilds its page). Department heads: Requisitions, History (and in Block 2 Deliveries, Day, Waste); members: History only plus later rows; floor-staff heads move off the legacy bottom tabs onto the shell with a drawer (their old rows kept as links). The Director's Operations › Branch Settings › Departments row is added (Paper G4). `nav-table.test.ts` must pass.

## 13. Screens covered, mapped to Paper

Phone: steps 1 to 6, 10, 14 (without dispatch data until Block 2), 15, 18; G1 (My requisitions). Desktop: 7, 7b, 8, 9, 11, 12, 13 (the dispatch part empty until Block 2), 16, 17 (print), 18b, 19, 20, 21 (states kit, reused from `shell-states.tsx`), 22 (wording tables); G4. The hub History and Discrepancies list screens (7c, 7d) are built with Block 1's list (R1); their discrepancy content fills in Block 2.

## 14. Test plan

Back end: unit tests for the state rules, cycle uniqueness, line validation, money and blind views, PIN and idempotency, additions rules; contract test against fixtures; access-table test for the new rows; opt-in database tests for the migration (back-fill of departments, `ItemDepartment`, references), the dual-write, and concurrency on the reference counter. Front end: contract mirror test, `nav-table.test.ts`, component tests for the send sheet, approve drawer, change-quantity row and the list (loading, empty, error, retry), keyboard and focus tests for drawers and dialogs. Both: backend `pnpm build` and `pnpm test`, frontend `pnpm build`.

## 15. Open items and defaults

- EVENING and AD_HOC rows map to EXTRA (confirm from production counts).
- The branch codes NYR and KRT are placeholders until the owner confirms.
- No department is added in production before Block 2 ships (see §10).
- The item-to-department link for an added department is built here; Catalog is touched only for the department chips.
- Notification wording is the wording table on Paper step 22; the layer uses titles, not names.
