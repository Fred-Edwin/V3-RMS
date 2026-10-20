# Workforce · Leave (segment 4)

**Status:** back end built and verified 20 Oct 2026 on branch `feat/workforce-4-leave-backend` (cut from `791f6054`, the Workforce specs commit); not merged or pushed. No screens yet. Spec: `docs/features/workforce/specs/4-leave-spec.md`. Choices (21 rows): `docs/features/workforce/decisions-4-leave-backend.md`. API: `docs/API_CONTRACT.md` section 44. Data: `docs/DATA_MODEL.md` 4.89. Proof run: `docs/features/workforce/leave-http-proof-output.txt`.

## What it does

A person asks for leave, the Branch Manager (HR after 72 hours, HR for a manager's own, the Director for HR's) decides with the rota in front of them, and an approved request gets a signed slip `LVE-nnnn`.

- **Balances** are worked out, never stored: the Rules Leave tab (annual leave in full on 1 January, prorated by whole months for a mid-year joiner, owner decision O1), plus the append-only ledger (opening, carry-over once a year, HR adjustments), minus approved requests. Calendar days. A waiting request does not reduce the balance; the days are checked again at approval.
- **Ask:** preview (no side effects), then send. One request per set of days: a per-person advisory lock makes overlapping asks impossible even from two phones. Routing is the server's.
- **Decide:** approve needs the approver's PIN and the version the screen saw; decline needs a reason chip and no PIN. A row lock plus a version check means two deciders get one winner and a `409 ALREADY_DECIDED` for the other.
- **Cancel:** the person, while waiting or before an approved start (no PIN); a manager, before the start, with a reason and PIN. Days return by themselves; the slip is stamped VOID.
- **Adjust a balance:** HR only, a PIN, a reason chip, whole days, never below zero.
- **Casual workers** (daily rate, no active contract) have no balance or requests: reads answer empty and well-formed, writes `409 CASUAL_NO_LEAVE`.
- **Slip:** frozen snapshot and hash at approval, QR payload, A4 PDF (cancelled variant). `verifyLeaveSlip` returns role and date only. `registerLeaveSlipDocument` is exported and tested; the documents door does not exist yet (decision 18).
- **Hooks:** the rota's "on leave" lookup, the Today board's On leave count, the Needs-you Leave source and badge, `onLeaveAt` and `comingUp`.
- **Coexistence:** a branch whose attendance switch is on uses this; the old leave writes answer `409 LEAVE_IN_NEW_SYSTEM` (`carry/legacy-guard.ts`). Switch-on copies open old requests and balances once (`carry/carry-service.ts`); switch-off mirrors waiting and approved new requests back. Old tables are only read, except the mirror's marked inserts.

## Layout

| Folder | Holds |
|---|---|
| `data/` | Repositories: applications, ledger, events, cover, people. Every query carries `organization_id` |
| `engine/` | Pure maths, no database: days, entitlement, balance, routing, cover, phase, steps |
| `balances/` | Balance service, carry-over, rules loader, adjust, balances reads |
| `applications/` | Ask, approve, decline, cancel, 72-hour sweep, cover |
| `reads/` | Overview, lists, detail, requests, rota strip, calendar, away, badge, Needs-you |
| `slip/` | Snapshot, text, PDF, service, verify, documents registration |
| `carry/` | Switch-on copy, switch-off mirror, the legacy guard |

`index.ts` is the only door. Routes mount through `routes/index.ts` with `registerLeave()`; the hourly job is `jobs/leave-escalation-job.ts`.

## Tests

`engine/leave-engine.test.ts`, `applications/ask-check.test.ts`, `slip/slip.test.ts`, `leave-routes.test.ts` (400s for bad input and a missing key, the PDF headers, no `requireRole`), and `leave-flow-db.test.ts` (lane database only: ask and overlap, same key twice, double decision, idempotent approve, wrong PIN, cancel, carry-over once, adjust below zero, casual worker, the legacy carry run twice, the audit chain). The per-role HTTP proof is `src/scripts/leave-proof.ts up|down`.

## Known gaps (not built here)

Timesheet `leaveDays`, the snapshot's paid and unpaid leave days and payroll `UNPAID_ABSENCE` (decision 9); the Home "Coming up" card (segment 6); Inbox rows with names and balances (decision 6); the documents door registration (decision 18). The seeded Rules give Annual leave no days a year (`defaultPolicy` is empty), so until HR sets them every balance starts at 0.
