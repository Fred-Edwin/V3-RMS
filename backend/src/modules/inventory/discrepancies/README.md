# discrepancies

**Design:** Paper *Inventory · Requisition and dispatch*, 7c (the list), D14 (the file), D15 (record a finding), D16 (reverse), D21, Block 2 gaps; owner approved. Contract `docs/features/inventory/dispatch-contract.md` with Amendment 1; flow in `discrepancies.md`. **Code:** built (Block 2, back end D): Q1 to Q5, the 24-hour reminder and the notices.

A discrepancy opens when a department signs a count that differs from what was sent (one `DSC-<branch code>-nnnn` per differing line, from Deliveries V6). The gap is **held as unaccounted** until the Store Manager (or System Admin) records **one finding** with a PIN. A wrong finding is reversed by new linked entries; nothing is edited or deleted.

## Rules (what the code does)
- **Read** (`loadReader`): the four hub desktop roles read everything (and get the branch picker); the Branch Manager their own branch; a department head their own department (no money). Anyone else gets 403. **Write** (`loadWriter`): `discrepancies.record` or `.reverse`, and the hub (D-15). Routes use `requireCapability`, never a role list.
- **Statuses**: OPEN (held), RECORDED, and REVERSED for the instant of a reversal: it goes straight back to OPEN (Amendment 1 row 7), so a response never shows REVERSED and the list counts a reversed one as Open. The events keep the history (`OPENED`, `FINDING_RECORDED`, `FINDING_REVERSED`) and the file's `reversal` shows the latest.
- **Q1** `tab=open|settled` with `counts: { open, settled }` under the same scope and filters, `branchId`, `departmentId`, `q` (the number or the item), a date range on when it opened; Open is oldest first, Settled newest first. **Q2** the file, with the sent figure (a discrepancy exists only after the department signed), who packed, signed, carried and counted, the photos, `allowedFindings` (empty unless held; full again after a reversal) and the Next step facts.
- **Findings** (`discrepancies-state.ts`, table-tested). Short: Packed short at the store (store stock +gap, an error not a loss), Lost or damaged (written off at the cost frozen at dispatch, the carrier), Branch counted wrong (department +gap), Can't tell (written off, unexplained). Extra: Packed more than recorded (store −gap), Branch counted wrong (department −gap), Can't tell (taken in, unexplained). A pair that does not fit is `FINDING_NOT_ALLOWED` (422).
- **Q3 preview** says what the finding would do, live: the effect rows, the party it is recorded against, and the written-off value (money-gated).
- **Q4 record**: one transaction under a row lock. The claim only succeeds while the gap is held (`FINDING_ALREADY_RECORDED` otherwise), the stock postings are `ADJUSTMENT` rows through `postStockMovement` linked to the **dispatch line** (the `DSC-` number is found through that link; each row keeps its own `ADJ-` number, see the dispatch README), `lossValue` is stored at the frozen cost for a LOSS finding, and the events are written. A finding that only classifies the gap (Lost or damaged, Can't tell) posts no stock row: the units already left the store and are not in the department's stock. After the commit `closeIfComplete` closes the dispatch (and the requisition) when no gap is held.
- **Q5 reverse**: needs a recorded finding (`FINDING_NOT_REVERSIBLE` otherwise), a reason and a PIN. It posts the exact opposite of every active posting, each row linked with `reversesTransactionId`, so the gap nets out and is held again; a CLOSED dispatch (and a CLOSED requisition) opens again. Both entries stay in the events and the Audit log.
- **Idempotency**: a repeated key by the same person on Q4 or Q5 returns the first result (`replayed: true`, 200 for Q4). A PIN is never stored in an event.
- **Money**: `lossValueKes` (on a LOSS finding) and `valueKes` (the held gap) are present only for holders of `requisitions.see_value` (Store Manager, Accountant, Director, Branch Manager, System Admin); **absent, never null**, for a department head.

## Endpoints (base `/inventory/discrepancies`)
| # | Endpoint | Capability |
|---|---|---|
| Q1 | `GET /?tab=&branchId=&departmentId=&q=&from=&to=&page=&pageSize=` | `discrepancies.read` (service narrows) |
| Q2 | `GET /:id` | `discrepancies.read` (service narrows) |
| Q3 | `GET /:id/finding-preview?finding=` | `discrepancies.record` |
| Q4 | `POST /:id/findings` | `discrepancies.record` |
| Q5 | `POST /:id/reverse` | `discrepancies.reverse` |

## Notices, sockets, the reminder
All through `_shared/notify.ts` (`discrepancies-notify.ts`); no Inbox row.
- Finding recorded: Director pushed (map row 17); the **Accountant** also, with the value, when stock is written off (row 18). Finding reversed: Director pushed. `discrepancy:changed` and `dispatch:changed` go to the branch, the hub and everyone who reads every site; the department's result chip on My deliveries (row 14) refreshes from them, no push.
- **24 hours without a finding, then daily** (row 19): the job `inventory-discrepancy-reminder.schedule` (every 5 minutes, report worker) pushes the Store Manager. The clock is the time it opened, restarted by a reversal. The claim is a conditional update of `reminder_sent_at`, so overlapping runs and retries send nothing twice in a day. Constant: `REMINDER_AFTER_HOURS`.

## Audit log
The sources `DISPATCH` (sign, cancel, count, close) and `DISCREPANCIES` (opened, finding recorded, finding reversed) in `audit-log/sources/`, each with its own repository; a Branch Manager reads only their branch; never a PIN; a reversal and a cancel carry their reason.

## Code map
`discrepancies-routes.ts`, `discrepancies-controller.ts`, `discrepancies-validators.ts`, `discrepancies-service.ts`, `discrepancies-repository.ts`, `discrepancies-state.ts` (pure finding rules), `discrepancies-view.ts` (wire shapes, money), `discrepancies-errors.ts`, `discrepancies-notify.ts`; contract in `_shared/discrepancies-contract.ts` (+ fixtures and test). Tests: `discrepancies-state.test.ts`, `discrepancies-routes.test.ts`, `deliveries/deliveries-notify.test.ts` (the notices), `src/jobs/inventory-delivery-jobs.test.ts`, and the opt-in `deliveries/deliveries.db.test.ts` (findings, reversal, balance, money, audit, reminder).

## Coupling
`deliveries` (opens them), `dispatch` (the events, `closeIfComplete`), `stock/ledger` (the door), `requisitions` (reopen on a reversal), `audit-log`, `_shared/notify`, `counting/_shared/count-pin`.
