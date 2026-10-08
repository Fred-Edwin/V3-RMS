# Block 2: Dispatch, deliveries and discrepancies, the contract (draft for owner freeze, 8 Oct 2026)

Governs: `dispatch-flow.md`, `discrepancies.md`, Paper chapters 5 to 8 (steps D1 to D21) and the gap-fix screens G2, G3 and G4 on "Inventory · Requisition and dispatch: gap fixes (8 Oct)". **Paper wins.** Model followed: `requisitions-contract.md` (with its Amendments). Built on Block 1 (approved requisitions, the departments table, branch codes, the notification layer in `_shared/notify.ts`). Not frozen until the owner says so; then the contract-in-code session freezes it in Zod, fixtures and mirrors.

## 1. Decisions that shape it

1. **One dispatch per department** of an approved requisition (`DSP-<code>-nnnn`, counter per branch). The Attendant packs department by department, then **one final review and one signature** covers all; stock leaves the Central Store at once and every dispatch is On the way together (owner, 8 Oct).
2. **The branch counts blind** (`discrepancies.md`): empty boxes, flag on a mismatch, second count final, reason and optional photos, summary, PIN. The sent figure is never shown before signing.
3. **A gap is held as unaccounted** until the Store Manager (or System Admin) records **one finding** with a PIN; reversible by a linked entry. No tolerance, no escalation, no "send the rest".
4. **Replace, do not expand.** Production has 0 dispatches and 0 discrepancies (owner's read-only queries, 8 Oct); the old `DispatchStatus` and `DiscrepancyOutcome` values and the old transit-loss logic are replaced in this block's migration. Re-run the two counts the week of release; if either is above 0, stop and ask.
5. **Every stock movement through `postStockMovement`:** `DISPATCH_OUT` at the final sign, `DISPATCH_IN` for the counted quantity at the branch department, and linked entries for a finding, a reversal and a cancellation.
6. **No money for the Attendant or the branch.** Findings show value at cost frozen at dispatch to the roles that hold `requisitions.see_value`.

### Open for the owner (recommendation first)
- **A department that is not ready holds the others** (design-log question). Recommendation: at the final review the Attendant may **leave a department out**; it stays in To pack and ships later with its own short review and signature. Every other department ships now.
- Everything else the design log lists as "default taken" is accepted (owner, 8 Oct): Extra findings mirror the short ones; photos up to 3 per line, 5 MB each; the branch copy of the delivery note omits quantities; the 2-hour and 24-hour timers are fixed constants.

## 2. Data model and migration (replace, one release)

- `DispatchStatus`: `TO_PACK, PACKING, ON_THE_WAY, CONFIRMED, CLOSED, CANCELLED`. "Waiting for the branch" is derived (ON_THE_WAY, over 2 hours since arrival, nobody confirmed). `DISCREPANCY_OPEN` is replaced by an open `Discrepancy`.
- `Dispatch` gains `reference` (`DSP-…`), `packedById`, `signedById`, `carrierId`, `signedAt`, `cancelledAt`, `cancelReason`, `cancelledById`, `finalSignAt` shared by the requisition's dispatches (`sendBatchId`). `departmentTag` is replaced by `departmentId` (Block 1 departments).
- `DispatchLine` gains `requestedQty`, `sentQty` (what the Attendant sent), `packedTick`, `shortReason` (null), `unitCostAtDispatch` (frozen), `countedQty` and `countReason` (set at confirm), `photos` (up to 3 documents).
- `Carrier` (new): `name`, `kind` (PERSON or VEHICLE), `active`, per hub site; retiring keeps history.
- `Discrepancy`: `reference` (`DSC-…`), `gapQty` (signed: negative short, positive extra), `status` `OPEN, RECORDED, REVERSED`, `finding` (`PACKED_SHORT, PACKED_MORE, LOST_OR_DAMAGED, BRANCH_COUNTED_WRONG, CANT_TELL`), `findingNote`, `recordedById`, `recordedAt`, `reversedById`, `reversedAt`, `reverseReason`, `lossValue`. A finding and its reversal are separate append-only rows (`DiscrepancyEvent`).
- `ReferenceCounter` prefixes `DSP` and `DSC` per branch site (the Block 1 counter with the branch code).
- Old outcome enum and `resolution` fields: dropped. The migration is tested on a restored production copy.

## 3. Access (`_shared/central-store-access.ts`, new rows)

| Capability | Who |
|---|---|
| `dispatch.read` | all five desktop roles (Branch Manager: own branch only); Attendant: own packing history only |
| `dispatch.pack` | Store Attendant, Store Manager, System Admin (own PIN) |
| `dispatch.cancel` | Store Manager, System Admin |
| `carriers.read` | Director, Accountant, Branch Manager read-only; `carriers.manage`: Store Manager, System Admin |
| `deliveries.count` | active member or head of the receiving department, for that department only |
| `deliveries.confirm_on_behalf` | Branch Manager (real signer recorded "on behalf of the department") |
| `discrepancies.read` | all five desktop roles (Branch Manager: own branch), department heads for their own departments |
| `discrepancies.record`, `discrepancies.reverse` | Store Manager, System Admin |

No new `requireRole` list on any route.

## 4. API (base `/inventory`; envelope `{ success, data }`; every route has Zod, `authenticate`, the access row, `siteId`)

**Dispatch (`dispatch/`)**
| # | Endpoint | Does |
|---|---|---|
| P1 | `GET /dispatch/queue` | To pack: one card per branch, oldest first, wait time, departments (D1) |
| P2 | `GET /dispatch/pack/:requisitionId/departments/:departmentId` | lines with requested and on hand, grouped by category; no money (D2) |
| P3 | `PUT /dispatch/pack/:requisitionId/departments/:departmentId/lines` | save ticks and sent quantities (last write wins); a shortfall sets the short flag (D2, D3) |
| P4 | `GET /dispatch/pack/:requisitionId/review` | every department ticked, short counts, all lines (D4, D5, D5b) |
| P5 | `POST /dispatch/pack/:requisitionId/sign` | `{ carrierId, pin, idempotencyKey, leaveOut?: departmentId[] }`: the final signature; creates the `DSP-` numbers, writes `DISPATCH_OUT` through the door, pushes the department members. One transaction. Errors `NOT_ALL_PACKED`, `INVALID_PIN`, `CARRIER_INACTIVE`, `NOTHING_TO_SEND` |
| P6 | `GET /dispatch/:id` | the dispatch file: tracker, Next step facts, Items, Documents, Activity (D13) |
| P7 | `GET /dispatch/:id/print?copy=store\|branch` | the delivery note A4 data (D17, D17b); branch copy has no quantities; pages repeat header and headings, signature block on the last page |
| P8 | `POST /dispatch/:id/cancel` | `{ reason, pin }`; only before any department member has signed; stock back by a linked entry, lines back to the queue, note voided but kept (D20) |
| P9 | `GET /dispatch/mine?from=&to=&page=&pageSize=` | the Attendant's Done tab (G3) |
| P10 | `GET/POST/PATCH /carriers` | list, add, rename, retire, restore (D18) |

**Deliveries (`deliveries/`), the branch**
| # | Endpoint | Does |
|---|---|---|
| V1 | `GET /deliveries/mine?tab=&from=&to=&page=&pageSize=` | waiting and past deliveries for the caller's department (D7, G2) |
| V2 | `GET /deliveries/:id/count` | the blind count view: item, unit, no sent figure (D8) |
| V3 | `PUT /deliveries/:id/count` and `POST /deliveries/:id/check` | save counts; check returns the lines that differ by name and typed number only; the second count is final (D9) |
| V4 | `PUT /deliveries/:id/lines/:lineId/reason` and `POST /deliveries/:id/photos` | reason chips (Not in the box, Damaged, Wrong item, Other) and up to 3 photos of 5 MB (D10) |
| V5 | `GET /deliveries/:id/confirm-preview` | the summary; the sent figure is revealed only here (D11) |
| V6 | `POST /deliveries/:id/confirm` | `{ pin, onBehalf?: boolean, idempotencyKey }`; writes `DISPATCH_IN` for the counted quantity, holds the gap as unaccounted, opens one `DSC-` per differing line (D12, D19) |

**Discrepancies (`discrepancies/`)**
| # | Endpoint | Does |
|---|---|---|
| Q1 | `GET /discrepancies?tab=&branchId=&search=&from=&to=&page=&pageSize=` | the list: gap, finding, days open (7c) |
| Q2 | `GET /discrepancies/:id` | the discrepancy file (D14) |
| Q3 | `GET /discrepancies/:id/finding-preview?finding=` | what the finding does, live (D15) |
| Q4 | `POST /discrepancies/:id/findings` | `{ finding, note?, pin }`; posts through the door; `FINDING_ALREADY_RECORDED` |
| Q5 | `POST /discrepancies/:id/reverse` | `{ reason, pin }`; a new linked entry, both stay on file (D16) |

Requisitions integration: the list tabs `to-pack, on-the-way, to-confirm, discrepancies` replace back end B's `tabOf` with one function over the new statuses; `closeIfComplete` and `attachAdditionToDispatch` (Block 1 hand-offs) are filled; a requisition's tracker rolls up its dispatches.

## 5. State rules (pure functions, table-tested)

Dispatch: TO_PACK, PACKING (any line ticked), ON_THE_WAY (final sign), CONFIRMED (every department confirmed), CLOSED (every discrepancy settled or none), CANCELLED (before any department signs). A short line is normal. An addition approved before the department is signed joins that department's dispatch; after the sign it is refused with `ADDITION_LOCKED` (Block 1). Delivery: a recount is offered once; the second count is final.

## 6. Findings (`discrepancies.md` table)

Short: Packed short at the store (stock back to the store, an error, not a loss); Lost or damaged on the way (written off at frozen cost, carrier); Branch counted wrong (department corrected up, receiver); Can't tell (written off, unexplained). Extra: Packed more than recorded; Branch counted wrong (corrected down); Can't tell (taken in, unexplained). Every posting is a new linked ledger entry carrying `DSC-`; nothing edited or deleted; reversal needs a reason and PIN.

## 7. Notifications, badges, sockets, timers (the Block 1 layer)

Dispatch signed: push to the department's members and head, badge to the Branch Manager. Delivery unconfirmed 2 hours after arrival: "Waiting for the branch" to everyone and a push to the Branch Manager. Discrepancy opened: Store Manager (push, badge), Director informed; 24 hours without a finding: reminder to the Store Manager, then daily. Loss written off: Accountant informed with value. Approved requisition: To pack badge for the Attendant and Store Manager (Block 1). The product Inbox is chat only: no Inbox rows. Constants, not settings: 2 hours, 24 hours.

## 8. Audit

Events for pack save milestones are not logged; every sign, cancel, confirm, finding and reversal is (sentence, record link `DSP-`, `DSC-`, never a PIN). The Audit log sources `DISPATCH` and `DISCREPANCIES` follow the Block 1 `REQUISITIONS` source; the Branch Manager reads only their branch.

## 9. Blind and money rules

Attendant: quantities including on hand, no money. Department: blind count, then the summary. Branch copy of the delivery note: no quantities. Money (frozen cost, loss value) only for holders of `requisitions.see_value`. Titles, not names, except where a record states who did something (packed by, signed by, counted by).

## 10. Code placement

Back end `backend/src/modules/inventory/{dispatch, deliveries, discrepancies}/` each with README, routes, controller, service, repository, validators, types, tests and a frozen `_shared/<sub>-contract.ts` with fixtures and a contract test; carriers inside `dispatch/`. Old `dispatch/` files deleted; `ledger-guard.test.ts` allow-list lowered where a writer moves. Front end `frontend/features/inventory/{dispatch, deliveries, discrepancies}/` with `_shared/` and the feature's `index.ts`; thin pages; `components/ui2/` only.

## 11. Nav rows

Attendant keeps one Dispatch row (badge = branches to pack) with To pack, On the way, Done; hub roles use the Requisitions sub-links already built (Queue, Discrepancies, History); Carriers under Settings for the Store Manager and System Admin, read only for Director, Accountant and Branch Manager; heads and members get the deliveries rows from the phone-menus map page.

## 12. Screens covered

Phone: D1 to D12, G2 My deliveries, G3 the Attendant's Dispatch with a Done tab. Desktop: D13 to D21, 7c Discrepancies list, Carriers, the Dispatch tabs of the Requisitions list. Per-screen wording tables and the States kit as in Block 1.

## 13. Sessions (proposal)

1. Contract in code (Zod, fixtures, mirrors, access rows, placeholder routers). 2. Back end C: migration, dispatch and carriers, ledger. 3. Back end D (starts after C's migration merges): deliveries, discrepancies, jobs, notifications, audit sources. 4. Front end phone and 5. front end desktop (each opens every Paper screen first and reports gaps; Amendment 1 for this block). 6. Integration and the owner's production check.

## 14. Test plan

State tables; every error code; blind view builders (no sent figure in any pre-sign response); ledger postings for sign, confirm, finding, reversal and cancel (balanced, linked, idempotent); two-signature race; photo limits; timers (idempotent jobs); `siteId` on every query; contract fixtures; opt-in database tests; the migration on a restored production copy.
