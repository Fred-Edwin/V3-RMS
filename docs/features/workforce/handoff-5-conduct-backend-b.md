# Handoff B: Workforce segment 5, Conduct back end (Step A built, Step B to do)

Written 20 Oct 2026. Step A (the rest of the build) is done and committed. This file replaces `handoff-5-conduct-backend.md` for what is left; that file still holds the departures list and gotchas. Brief: `docs/sessions/workforce-5-conduct-backend.md` (below its divider). Method: `docs/sessions/workforce-two-part-method.md`.

## (a) Where
- Worktree `/home/fred/Projects/V3-RMS-lanes/lane-2`, branch `feat/workforce-5-conduct-backend`, API port 4102, lane database `wendo_rms_lane2`.
- Last build commit `4697dfed` (this handoff's commit follows it). Tree clean. `pnpm exec tsc --noEmit` clean.

## (b) Built and committed (Step A, all under `backend/src/modules/workforce/conduct/` unless noted)
- `documents/`: `document-service.ts` (`noticeDocument`, `previewDocument`, `receiptIsFinal`), `documents-repository.ts`, `documents-controller.ts`, `register-documents.ts` (+ test).
- Routes `conduct-routes.ts`; controllers in `notices/`, `appeals/`, `documents/`; `_shared/conduct-http.ts`; `needs-you/badge-service.ts`.
- `register-conduct.ts` (registers the Needs-you source); `workforce/index.ts` exports; `routes/index.ts` registers and mounts; `jobs/conduct-sweep-job.ts` + `jobs/workers.ts` (00:10 Nairobi).
- `needs-you/index.ts`: one added export, `contextFor`. `workforce-layering.test.ts`: the public-door list gained six Conduct names (it was already failing on `isSiteOnNewConduct`).
- `conduct-flow-db.test.ts`: 11 tests pass on the lane database (switch off/on guard, issue + idempotency, 404 vs 403, sign, PDF + audit, appeal, reduce to verbal with version 2, two deciders, Director narrowed, sweep, no-delete).
- `README.md` (module), `docs/features/workforce/decisions-5-conduct-backend.md` (16 rows).

## (c) Left: all of Step B
- [ ] `pnpm build` and the full suite once; the three time-zone runs; `pnpm check:imports` not worse than 50 warnings; ESLint on new code; no `requireRole(` in new code.
- [ ] Re-run only the 7 known-failing db test files; the failing count must not grow. Say which ran and how many passed.
- [ ] Migration proof on a copy of the lane database (legacy tables identical, second run changes nothing).
- [ ] `src/scripts/conduct-proof.ts`: per-role HTTP proof (HR, Director, Branch Manager, Accountant, staff, a head named witness, cross-site 404, forbidden writes 403, PDF over HTTP, `GET /badge`).
- [ ] One end-to-end flow checked with the read-only Postgres MCP (it points at the owner's main DB: confirm what exists there before querying; proof data lives in the lane DB, so use `psql` on port 5433 for the lane if the MCP cannot see it, and say so). Tear down proof data; leave the lane's attendance switch OFF.
- [ ] Docs: `DATA_MODEL.md`, `API_CONTRACT.md` (endpoints + the `discipline.decide` row), Workforce README status row, `docs/PROJECT_STATUS.md`. The module README and decisions log are done.
- [ ] Checklist `verified` fields, then the final message (decisions table first, 5-line recap, departures, files touched line by line, front-end gaps).

## (d) Part-2 commands
`cd backend && export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)`; `pnpm exec vitest run <path>`; `pnpm build`; `pnpm test`; `pnpm check:imports`. Run the workforce db flows one file at a time. A full `tsc` takes over 2 minutes: run it in the background.

## (e) Read first
1. `docs/sessions/workforce-5-conduct-backend.md` (below the divider)  2. this file  3. `checklist-5-conduct-backend.json`  4. `handoff-5-conduct-backend.md` sections (f) and (h)  5. `conduct/conduct-flow-db.test.ts` (setup pattern for the proof script).

## (f) Gotchas
Edit/Write tools only with a `Why:` line before each; zsh has no `grep --include`; the lane DB's users: `admin@` is used as HR, `barista.head.town@` is the test person, `bm.town@` and `bm.highway@` the managers (no `hr@wendo.test`); set PINs for the run and restore them; the audit log is append-only (entries stay); never leave a lane attendance switch on; a push never carries the reason.

## (g) Rule slips
None known in Step A. Bash was used only for reads, git, tsc and vitest; all edits went through Edit and Write.

## (h) Departures added in Step A (also in the decisions log)
- `contextFor` exported from the Needs-you door so Conduct's `GET /badge` counts the same rows as the card.
- `deviceLabelOf` is imported from `payslips/unlock/unlock-rules` (inside the Workforce module, no other home exists).
- Draft preview answers 422 `NO_LETTER` for a verbal note; downloads are `private, no-store` with an ETag of the file hash.
- Not-signed with a witness has no db-flow test yet (the HTTP proof in Step B must cover it).
