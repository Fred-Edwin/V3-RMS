# counting

**Design:** approved (Paper: *Stock and Counting*, chapters 1–4, 6–7) · **Code:** built to the old flow (Milestone Six S2), **pending redo**.

Central Store counting: the Attendant counts, the Manager verifies. (The branch count is [branch-day](../branch-day/README.md).)

## Who can do what
- **Store Attendant** (phone): daily count, blind, in shelf order; pause/continue from any phone; review and sign with PIN; recount only queried lines. Never sees expected, opening, differences or costs.
- **Store Manager** (desktop): verify, accept/query each line, "Accept all within range", reasons, send back, approve and sign; spot count (incl. correcting a verified count); count setup; print count record and a blank sheet.
- **Director**: alerted when one difference reaches KES 5,000 (sets that amount).

## Approved behaviour
1. One count a day, any time; sign time fixes expected. Unstarted count shows "Not counted yet" (no push); an unsigned count stays open and is flagged on both hubs.
2. Sections follow the supplier (Samrat, Summer) plus manual Others and Packaging; Manager sets the order once in **Count setup** (also variants like Herbal tea).
3. Count everything; one number per item in its own unit (no pack count); "None here" for zero. Autosave ("Saved 07:19"). Signing blocked until every line has a number or "None here"; review lists "None here" items and changed lines; then PIN.
4. Verify shows counted vs expected with the sheet's maths (Open + in − out − waste, per-branch split). Lines under the reason amount (KES 500) are "within range". Above it a reason is required ("Other" needs a note). Query sends only that line back, blind; the note never states the expected figure.
5. Approve: summary of adjustments, net value, Director alert; PIN. One adjustment per non-zero difference (ADJ-nnnn, reason, ledger link); matched lines write nothing. Both signatures on the record.
6. Spot count shows expected to the Manager and writes adjustments after a summary + PIN; to correct a verified count open a spot count pre-filled and linked to the old adjustment.
7. Settings: reason amount, "not started" reminder time, Director amount (read-only). Thresholds are set by whoever owns them.
8. Mistake handling table: see Paper chapter 7 ("When things go wrong").

## Built today vs approved
Old design: category tabs, partial sign allowed, blank-vs-zero boxes, no pause/resume screen, Accept/Query on every line, approve straight to PIN, no correct-a-verified-count path, settings in the hub top bar.

## Endpoints
13 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/counts` | STORE_MANAGER |
| GET | `/inventory/counts/today` | STORE_ATTENDANT |
| GET | `/inventory/counts/:id` | STORE_MANAGER, STORE_ATTENDANT |
| PUT | `/inventory/counts/:id/lines` | STORE_ATTENDANT |
| POST | `/inventory/counts/:id/submit` | STORE_ATTENDANT |
| PATCH | `/inventory/counts/:id/lines/:lineId` | STORE_MANAGER |
| POST | `/inventory/counts/:id/return` | STORE_MANAGER |
| POST | `/inventory/counts/:id/approve` | STORE_MANAGER |
| GET | `/inventory/counts/:id/print` | STORE_MANAGER |
| POST | `/inventory/spot-counts` | STORE_MANAGER |
| GET | `/inventory/thresholds` | STORE_MANAGER, MANAGER |
| PUT | `/inventory/thresholds` | STORE_MANAGER, MANAGER |
| PUT | `/inventory/thresholds/director` | DIRECTOR |

## Code map
`count-calc.ts`, `count-controller.ts`, `count-repository.ts`, `count-routes.ts`, `count-service.ts`, `count-validators.ts`, `count.types.ts`, `counting-thresholds.ts`, `thresholds-controller.ts`, `thresholds-repository.ts`, `thresholds-service.ts`, `thresholds-validators.ts`, `thresholds.types.ts`. 4 test files beside the code.

## Coupling
Uses `purchasing/receiving-repository`, `_shared/stock-scope`, `counting/thresholds-*`. Imported by `stock/stock-service` and `branch-day`.

## Open questions
See decisions.md (F1 relates to dispatch discrepancies, not counting).
