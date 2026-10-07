# counting / record

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, steps 1 to 7 the Attendant's phone count, 12 to 15 the Manager counts, 40 and 49) · **Code:** built.

## What it does
Taking a count: pick sections, count the shelf, the section-end check, sign with your own PIN. Many counts a day; **one open count per person**, and **a section (an item) in only one open count at a time**. Spot count and "accept / query" are gone.

```
(none) ──C9 start──▶ OPEN ──C13 sign (Attendant)──▶ SUBMITTED ──C29 approve──▶ APPROVED
                       └────────C13 sign (Manager, counts.resolve)────────────────▲   (selfSigned)
```

## Who can do what
| Who | Can |
|---|---|
| Store Attendant | all of C8 to C14 on their **own** count; never sees a stock figure (the blind rule, `_shared/count-view.ts`) |
| Store Manager, System Admin | the same, and **Sign applies everything** (`counts.resolve`): every non-zero line posts and the outside-range ones are flagged to the Director |
| Director, Accountant, Branch Manager | nothing here (403, `counts.record`) |

Everything starts with `requireHubActor`; a count that is not yours is 403 `NOT_YOUR_COUNT` for someone who may read counts and 404 for someone who may not. No `requireRole`.

## Endpoints (base `/api/v1/inventory/stock`)
| # | Method | Path | Notes |
|---|---|---|---|
| C8 | GET | `/counts/start-options?recountLineId=` | sections in this person's order for today (else the Manager's shelf order), last counted and by whom, the **longest since a count** tag, who is **busy**, "Unsectioned n", their open count to resume. Runs `adoptNewItems` first. `recountLineId` adds the recount banner |
| C9 | POST | `/counts` | one transaction: lock the picked sections, `YOU_HAVE_OPEN_COUNT`, `SECTION_BUSY` (names who), number `CNT-yyyy-nnnn`, one line per item in shelf order with its section frozen. 201; a repeated `idempotencyKey` returns the same count with 200. `NOTHING_TO_COUNT`, `RECOUNT_NOT_ALLOWED` |
| C10 | PUT | `/counts/:id/lines` | autosave, last write wins; typing clears Skip, Skip clears the number; a recheck is answered once. Stamps "Saved hh:mm". The counting Manager also gets the live result of the lines she saved |
| C11 | POST | `/counts/:id/check` | the section-end check: lines that exceed the range, **by name and typed number only**, each marked offered (never offered again). Returns none for a caller who sees stock figures |
| C12 | GET | `/counts/:id/sign-preview` | items, zeros, skips; for the Manager also what applies, what is outside the range and which causes are still needed |
| C13 | POST | `/counts/:id/sign` | the caller's **own** PIN. See below. 200; a retried key returns the signed count (`replayed`) |
| C14 | PUT | `/counts/section-order/today` | this person's order for today only; tomorrow the Manager's again |

## The sign (contract §5.3)
In one transaction under a row lock on the count: verify the PIN first (`INVALID_PIN`: wrong, missing and unknown are the same, nothing is written); need one number (`NOTHING_COUNTED`); set `signedAt` and `expectedAsOf`; for every line freeze **expected stock = the ledger on-hand at the sign**, the item's cost, the **result** and the **repeat-shortfall streak**; freeze the **settings in force** on the count; `isOpen = false` on every line.
- **Attendant:** `SUBMITTED`. After the commit, a push to the Store Manager.
- **Manager (holds `counts.resolve`):** every outside-range line needs a cause (`CAUSE_REQUIRED`, with the line ids); `selfSigned`, `APPROVED`; every **non-zero** line posts one `ADJUSTMENT` through `postStockMovement` with `countLineId` (outside range: written off with her cause; within range: accepted); matched and skipped lines post nothing; outside-range lines are flagged to the Director and a line at or above the alert amount raises the alert push (held until 05:00 in quiet hours). **All or none:** a refusal by the ledger door rolls the whole sign back.
- Idempotency: the count's `idempotency_key` holds the start, sign and approve keys in order (`_shared/count-idempotency.ts`); a double tap is answered as a replay.

## Code map
`record-routes/controller/service/repository/validators.ts`, `record.types.ts`, `record-logic.ts` (pure: section order, applying a save, **planning the freeze**: tested by table). Shared with the other counting folders in `../_shared/`: the count view, state, story, PIN, numbers, notifications, settings and section reads.

## Tests
`record-logic.test.ts`, `record-service.test.ts` (every rule and error code with the repository mocked: the door, the pushes and the PIN are observed), `record-routes.test.ts` (the §3.1 grid for six roles on every endpoint, validation, replay status), `record-service.db.test.ts` (opt-in `RUN_DB_TESTS=1`: the real service on the real database, cleans up after itself: the two partial unique indexes under a real race, a double tap on Sign, the sign freeze not moved by a later movement, a wrong PIN writes nothing, the Manager's own sign posting through the door with gap-free ADJ numbers and rolling back whole).

## Coupling
`../_shared/` (count-view, count-state, count-detail-reader, count-record-repository, count-sections, count-numbers, count-pin, count-notify, count-settings, count-idempotency, counting-contract), `../../stock/ledger/ledger-door` (every ledger write), `../../_shared/` (central-store-access, variance-calc, blind-rule). Nothing from the kept `counting/thresholds-*` files.
