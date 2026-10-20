# Handoff: Workforce 6b shared back end, part 1 to part 2

**(a)** Worktree `/home/fred/Projects/V3-RMS-lanes/lane-3`, branch `feat/workforce-6b-shared-backend` (from `feat/workforce-specs-4-6`), last code commit `459f3c5f`, API port 4103, lane DB `wendo_rms_lane3` (migration `20261020135815_workforce_shared_6b` applied).

**(b) Built**
- Audit read (`modules/workforce/audit/`): list, detail, facets, actors, CSV export, viewers, chain check, nightly job `src/jobs/workforce-audit-job.ts`, index backfill.
- Activity on my record (`audit/my-record/`) and `GET /payslips/opens?from&to`.
- Documents door `_shared/documents/` (`registerDocument`, `withdrawDocument`, kinds, sources, shared `payslipContentHash`), `documents/` (index, panel, open, reconcile), `verify/` (public and signed-in, report).
- Audit actions `audit.exported`, `audit.record_answered`, `document.opened/verified/verify_failed/mismatch_reported`; wording `document.mismatch`.

**(c) Not yet done (part 2)**
- [ ] `pnpm build`, full backend suite, three time-zone runs, `pnpm check:imports` vs baseline, ESLint, no `requireRole(` in new code
- [ ] Re-run only the known failing database-flow files; failing count must not exceed 7
- [ ] `src/scripts/shared-6b-proof.ts`: per-role HTTP proof (cross-site 404, forbidden 403, public verify with no sign-in), then one end-to-end flow via the read-only Postgres MCP, then tear down
- [ ] Run `reconcileDocuments()` against the lane DB; confirm every issued number is indexed
- [ ] Test the documents index list/panel/open and report endpoints, a stub-issuer test for `registerDocument` as Leave/Conduct will call it
- [ ] Check a QR of each renderer matches `hashPrefix` (both payslip renderers)
- [ ] Docs: `DATA_MODEL.md`, `API_CONTRACT.md`, Workforce README status row, `docs/PROJECT_STATUS.md`; a verify README
- [ ] Set `verified` in `checklist-6b-shared-backend.json`; final message: decisions table, 5-line recap, door signature, departures, files touched

**(d) Commands** `cd backend; export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-); pnpm build && pnpm test`; `TZ=UTC`, `TZ=Africa/Nairobi`, `TZ=America/Los_Angeles pnpm test`; `pnpm check:imports`.

**(e) Read first** this handoff; `decisions-6b-backend.md`; `documents/README.md`; `specs/6c-documents-and-verify-spec.md`; `docs/sessions/workforce-two-part-method.md`.

**(f) Gotchas** see the method file. Redis keeps rate-limit counts between test runs: use fresh addresses. Never run `prisma format` (it rewrites unrelated schema files).

**(g) Rule slips** three early edits (schema models, digest column) had no `Why:` line; `prisma format` reformatted 15 unrelated schema files, reverted before commit. Documents door was committed once as WIP before type-check.

**(h) Departures** see `decisions-6b-backend.md` B4, B11, B14 (payroll-export QR hash changed), B15 (existing issuers indexed by reconcile, not in their own transactions), B17. Gap for front end: `openHref` is an API route, and for payroll, timesheet and P9 documents it is a POST route.
