# Handoff: Shared parts, front end B (part 1 done, part 2 to do)

## (a) Where
Worktree `/home/fred/Projects/V3-RMS-lanes/lane-4`, branch `feat/workforce-6b-shared-frontend` (from `origin/feat/workforce-frontends-4-6`), last code commit `1b8d94eb` (the handoff commit follows it). Ports: front end `pnpm exec next dev -p 3104`, API 4104, browser `http://lane4.localhost:3104`, database `wendo_rms_lane4` (already migrated and generated this session).

## (b) Built (all type-checked, 5 test files green)
- `frontend/features/workforce/audit/log/`: Audit log screen, filters, table, entry drawer (Before/After, Proof, Check the chain), Export, viewers panel, tabs, `AuditLogPage`.
- `audit/my-record/`: Activity on my record (chips, range, pager, one entry, That was me / This wasn't me).
- `audit/digest/`: payslip-openings card (registered on Home as `workforce.payslip-openings`).
- `frontend/features/workforce/documents/index/`: Signed documents index, panel, PDF drawer. `documents/verify/`: public verify page, all outcomes, signed-in upgrade, report.
- Routes: `app/app/workforce/audit-log`, `.../my-record`, public `app/verify/[kind]/[number]`.
- Nav rows `wf-audit-log` (built), `wf-my-record`, `wf-staff-my-record`; route gate; back-end fix `sites` in the documents index.

## (c) Not yet done
- [ ] Fresh servers, switch on for one lane site, logins (`admin@ director@ bm.town@ accountant@ store.manager@`, `password123`; no `hr@`: create one in a helper that ends itself)
- [ ] Per screen: build beside Paper frame (nodes in spec 6a table: 14.1 `1O17-0`, 14.2 `1OBD-0`; 17.1 `1PSD-0`, 17.2 `1Q3D-0`), fix differences, keyboard run, states
- [ ] Prove `/verify/...` in a private window (no sign-in); one run of Check the chain, then wait a minute
- [ ] Seed or find documents to open (lane has none issued; try `reconcileDocuments` after creating a payslip)
- [ ] Gates once: tsc, `pnpm lint`, `pnpm test`, `pnpm build`; backend tsc and the documents tests
- [ ] READMEs for `audit/` and `documents/` sub-modules, parity manifest, `docs/PROJECT_STATUS.md`, Workforce README row, API contract note for `sites`
- [ ] Tick `Verified` in `checklist-6b-shared-frontend.md`; switch the lane's attendance switch off

## (d) Commands
`cd frontend && pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`; `cd backend && pnpm exec tsc --noEmit && pnpm build`.

## (e) Read first
`docs/features/workforce/decisions-6b-shared-frontend.md`; `docs/sessions/workforce-6b-shared-frontend.md`; `specs/6a-...` A1, A8; `specs/6c-...` D2, D3; `features/workforce/_shared/README.md`.

## (f) Gotchas
Chain check once a minute, verify 30 a minute. Audit list `pageSize` 25/50/100 only. Documents `openHref` is POST for payroll, timesheet, P9 (done in `openRequest`, unproven against real files). Timesheet open sends no `site` (F13). Leave/Conduct documents may not be indexed yet (separate door-wiring session). zsh: no `grep --include`. Kill servers by pid.

## (g) Rule slips
None known. Used `pnpm exec` which ran an install step (added nothing to git).

## (h) Departures from the spec
Chips are toggles, not radios (F4); no "new entries" pill (F11); no arrow-key grid (F12); Signed documents is a tab, no own row (F1); audit/record rows wait for the new-clock switch (F2).
