# Handoff: Workforce 4 Leave, back end (part 1 done, part 2 to do)

## (a) Where
- Worktree `/home/fred/Projects/V3-RMS-lanes/lane-1`, branch `feat/workforce-4-leave-backend` (cut from commit `791f6054` = `feat/workforce-specs-4-6`, which lane 2 holds, so lane 1 branched from the commit).
- Last code commit `babc2c32`. API port 4101, lane DB `wendo_rms_lane1` (both migrations applied, Prisma client generated).

## (b) Built (module `backend/src/modules/workforce/leave/`)
- `data/` repositories (applications, ledger, events, cover, people); `engine/` pure maths (days, entitlement, balance, routing, cover, phase, steps).
- `balances/` balance service, carry-over, rules loader, adjust (PIN), balances reads. `applications/` ask, approve, decline, cancel, escalation sweep, cover.
- `reads/` overview, list, detail, requests, rota strip, calendar, away, badge, Needs-you source. `slip/` snapshot, text, PDF, service, verify + documents registration.
- `carry/` legacy carry + switch-off mirror (called from `attendance/switch/switch-service.ts`) and `legacy-guard.ts`.
- Routes `leave-routes.ts` (mounted in `routes/index.ts` with `registerLeave()`), job `jobs/leave-escalation-job.ts` (hourly, in `workers.ts`).
- Decisions: `docs/features/workforce/decisions-4-leave-backend.md` (21 rows). Checklist: `checklist-4-leave-backend.json`.

## (c) Not yet done (all part 2)
- [ ] `pnpm build`, full `pnpm test`, three time-zone runs (`pnpm test:workforce-tz`), `pnpm check:imports` (now 50 warnings, none from leave files; baseline count not taken), ESLint on new code, `grep requireRole(` in new code.
- [ ] Database-flow tests on the lane DB (write `leave/leave-flow-db.test.ts`): ask/overlap, double decide (409), idempotent approve, carry-over once, adjust below zero, casual empty answer, carry twice and legacy tables unchanged, audit chain.
- [ ] Re-run only the 7 known failing DB-flow files and confirm the failing count did not grow.
- [ ] Migration proof on a copy of the lane DB (second run changes nothing).
- [ ] `src/scripts/leave-proof.ts`: per-role HTTP proof with real logins, cross-site 404, forbidden writes 403; one end-to-end flow checked with the read-only Postgres MCP; tear down; lane attendance switch left OFF.
- [ ] Look at the slip PDF by eye (cancelled variant too).
- [ ] Docs: leave README, `DATA_MODEL.md`, `API_CONTRACT.md` (capability + endpoints), Workforce README status row, `docs/PROJECT_STATUS.md`.
- [ ] Set `verified` in the checklist; final message = decisions table, 5-line recap, departures, existing files touched line by line.

## (d) Part-2 commands
`cd backend && export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)`; `pnpm build`; `pnpm test`; `pnpm test:workforce-tz`; `pnpm check:imports`; `pnpm exec eslint src/modules/workforce/leave`.

## (e) Read first
`docs/features/workforce/decisions-4-leave-backend.md`, `docs/sessions/workforce-two-part-method.md`, `leave/applications/approve-service.ts`, `leave/balances/balance-service.ts`, `leave/carry/carry-service.ts`.

## (f) Gotchas
`prisma migrate dev --create-only` adds a bogus payroll_payslip_seq drop (already removed here); DB tests need a `_lane` DATABASE_URL; zsh: no `grep --include`; the Postgres MCP points at the owner's main DB (read only); never leave a lane site's attendance switch on; tsc takes ~2 minutes, run it in the background.

## (g) Rule slips so far
A few Edit/Write calls had no own `Why:` line (parallel edits shared one line). No Bash edits. A `sleep` was attempted and blocked.

## (h) Departures from the spec
Generic notification text (one text for push and Inbox); timesheet `leaveDays`, snapshot paid/unpaid days and payroll `UNPAID_ABSENCE` not built (decision 9); board shows only the On-leave count. Existing files touched: `_shared/workforce-access.ts` (+test), `_shared/audit/audit-actions.ts`, `audit-titles.ts`, `notifications/wording/notification-wording.ts`, `workforce/index.ts`, `workforce-layering.test.ts`, `attendance/switch/switch-service.ts`, `attendance/board/board-service.ts`, `routes/index.ts`, `jobs/workers.ts`, `services/hr-service.ts` (guard lines).
