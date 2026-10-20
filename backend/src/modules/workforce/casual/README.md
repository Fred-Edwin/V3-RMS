# Workforce · Casual pay (Segment 3, back end)

**Status:** built 20 Oct 2026 on `feat/workforce-3-payslips-backend` (not pushed, awaiting the owner's review). Spec: `docs/features/workforce/specs/3-payslips-spec.md` (S7 to S10) and `decisions-3-spec.md` PD19 to PD29. Decisions: `docs/features/workforce/decisions-3-payslips-backend.md`.

## What it does

A department head records who worked a day and sends the sheet; the Branch Manager (or the Director) approves with a PIN; the cash holder pays; each worker signs for cash on the head's phone.

- One sheet is one department, one site, one day (PD21). The pay is the day rate in force on the work date: `rate x minutes / 480`, whole shillings, half up (PD22).
- The head records today and the 3 days before, never the future; a shift is 1 minute to 16 hours; one national ID number is one worker across the company; overlaps are refused on any site (PD23).
- Offline-safe: the sheet is found or made by site, department and day; the same `idempotencyKey` gives the same answer; a stale `version` is 409 (PD28, PD29).
- Send waits until every shift has ended. Take back while waiting. The approver can send back with a reason or approve; approval numbers the sheet `CPS-n`, freezes it with a hash and tells the head and the cash holder. Void before any signature; a day already signed is fixed by a correction line on a later sheet (PD26).
- Payroll's Casual pay tab reads the approved sheets of a month (PD27), outside gross, net and the bank file.
- No pay figure is in any notification, log or audit entry.

## Folders

| Folder | What lives there |
|---|---|
| `recording/` | The pay and shift rules (pure), validators, the head's service (add a casual, save lines, send, take back), correction lines. |
| `approval/` | Who may decide (pure), approve, send back, void, the CPS counter, receipts, the frozen snapshot. |
| `sheet/` | Reads (day, one sheet, my casuals, recent, waiting for me, the month summary), the view mapper and the A4 sheet. |

## Endpoints

Base `/api/v1/workforce/casuals`. Full table: `docs/API_CONTRACT.md` §41.

## Tests

Pure: `casual-pay`, `shift-rules` (in the time-zone script). `casual-routes.test.ts` (the role matrix, 186 cases). `casual-flow-db.test.ts` (15 database flows; run it alone against a `_lane` database). Proof over HTTP: `src/scripts/payslips-casual-proof.ts`.
