# Handoff: Workforce segment 5, Conduct back end (stop point inside part 1)

Written 20 Oct 2026. The owner paused mid part 1 and asked that the next session finish the rest of the build AND do part 2 (verify). Brief: `docs/sessions/workforce-5-conduct-backend.md` (below its divider). Method: `docs/sessions/workforce-two-part-method.md`.

## (a) Where
- Worktree `/home/fred/Projects/V3-RMS-lanes/lane-2`, branch `feat/workforce-5-conduct-backend` (cut from `feat/workforce-specs-4-6`). API port 4102, lane database `wendo_rms_lane2` (migration applied, `prisma generate` done).
- Last commit `596f7259`. Tree clean. `pnpm exec tsc --noEmit` clean. `pnpm check:imports` baseline: 50 warnings, 0 errors.

## (b) Built and committed (all under `backend/src/modules/workforce/conduct/` unless noted)
- Schema `prisma/schema/workforce/conduct.prisma` + migration `20261020135759_workforce_conduct` (additive; bogus drop block removed; `conduct_notice_seq`).
- `_shared/`: model/constants, status machine (`nextStatus`), ladder (`suggestLevel`), dates (validUntil, appeal deadline, record-from, overdue), roles, context (`conductEntry`, `tellAbout`), scope (404 vs 403), notices repository (compare-and-set `transition`), people repository, load, format, snapshots, codes.
- `letters/`: placeholder wording constants (LAWYER MUST REPLACE), `buildLetter`, facts selection + repository.
- `notices/`: validators (all Zod schemas incl. list/document queries), issue (`issueNotice`), sign, not-signed, witness, detail (staff + desk views), list (desk), me (staff list + `chooseColumns`), draft (people search, draft, witness options), file-tab, steps (stepper), daily sweep (`sweepConduct`: ends notices, overdue-appeal Director tell, silent witness).
- `appeals/`: appeal, decision (keep/reduce/withdraw, replacement notice, `previewDecision`), rules, named dates.
- `needs-you/conduct-source.ts` (source object, NOT yet registered), `rollout/` (guard + legacy read).
- Shared edits: `workforce-access.ts` (+`discipline.decide`: HR all, Director all narrowed in service) and its test row; `audit-actions.ts` + `audit-titles.ts` (12 `conduct.*`); `wording/wording-conduct.ts` + one line in `notification-wording.ts`; `notification-types.ts` (+optional `pushText`) and `notification-service.ts` (push uses it); `_shared/pin/signer-pin.ts` (`verifySignerPin` gets an optional 4th `purpose` arg); `workforce/index.ts` (+1 export line); `services/hr-service.ts` (import + 2 guard lines in create and acknowledge). Events `conduct.appeal_sent|decided` were already declared.
- Unit tests written and passing: rules, letters, issue-rules, decision-rules, named-dates, steps, me-service.

## (c) Not yet done (part 1 remainder, then part 2)
- [ ] Document service: render on demand from the snapshot with `buildConductDoc` + `renderConductPdf` (built), store in `conduct_notice_documents` only when the receipt is final (signed, verbal, or past ISSUED/GIVEN_NOT_SIGNED), withdrawn copy with watermark, `?version=1|2|latest`, audit `conduct.document_read` for non-subjects, draft preview (`POST /draft/preview`, stamp DRAFT, no QR). Named registration function `registerConductDocuments` (+ stub test) for the documents door of back end B.
- [ ] Routes + controllers per spec section 8 under `/workforce/conduct` (authenticate, attachWorkforceSubject, requireCapability, Zod): `GET /me`, `GET /` (list), `GET /people`, `GET /draft`, `POST /draft/preview`, `POST /`, `GET /:id`, `POST /:id/sign|appeal|not-signed|witness|decision`, `POST /:id/decision/preview`, `GET /:id/witness-options`, `GET /:id/witness` (card), `GET /:id/document`, `GET /badge` (own badge count; staff lack `needs_you.read`), `GET /workforce/people/:id/conduct`. Devise `deviceLabelOf` from unlock-rules for the label arg.
- [ ] `register-conduct.ts`: `registerNeedsYouSource(conductNeedsYouSource)`, call from where `registerNeedsYou` is called (`routes/index.ts`), mount the router, export from `workforce/index.ts`, wire `sweepConduct` as a 00:10 Nairobi job (see how `sweepTimesheets` is scheduled in the worker).
- [ ] Tests: db-flow tests on the lane database (issue→sign→appeal→decide, idempotency, two-at-once), access matrix/404-vs-403, a no-delete test on the repository, legacy guard both ways, sweep. README for the module. `decisions-5-conduct-backend.md` (question, choice, why, what changing it takes).
- [ ] PART 2 (fresh context after the above): `pnpm build && pnpm test`, three time-zone runs, `pnpm check:imports` not worse than 50 warnings, ESLint, no `requireRole(`; re-run only the 7 known-failing db files, count must not grow; migration proof on a copy of the lane DB; `src/scripts/conduct-proof.ts` per-role HTTP proof; one end-to-end flow checked with the read-only Postgres MCP; tear down proof data, leave lane attendance switch OFF; docs: module README, `DATA_MODEL.md`, `API_CONTRACT.md`, Workforce README status row, `docs/PROJECT_STATUS.md`.

## (d) Part-2 commands
`cd backend && export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)`; `pnpm exec vitest run <path>`; `pnpm build`; `pnpm test`; `pnpm check:imports`.

## (e) Read first
`docs/sessions/workforce-5-conduct-backend.md`, this file, `checklist-5-conduct-backend.json`, spec sections 8-12 of `specs/5-conduct-spec.md`, `conduct/notices/issue-service.ts` (pattern for every service).

## (f) Gotchas
Edit/Write tools only, a `Why:` line before each; zsh: no `grep --include`; users in the lane DB may lack `hr@wendo.test`; the Postgres MCP points at the owner's main DB (read only); never leave a lane site's attendance switch on; audit entry must be the LAST write in a transaction (`runAudited` does it).

## (g) Rule slips so far
None known. (Edits were all via Edit/Write; Bash used only for read commands, git, prisma and vitest.)

## (h) Departures from the spec so far (to go in the decisions log)
- No-login rule keys on having a login, not on being a casual (owner, 20 Oct); notice to someone on probation counts toward the ladder.
- Needs-you rows are per notice (kinds `conduct-sign|record|appeal`), not one summed row; staff have no `needs_you.read`, so staff get their count from `GET /badge`.
- Push text is generic via new optional `pushText`; Inbox rows name level and number only.
- Documents stored only when the receipt is final (otherwise v1 would freeze "not yet signed").
- `NO_FACTS` answers 422; witness answer needs `notifications.own` capability (any signed-in person).
- `discipline.decide` is also granted to the Director; the service narrows to HR-issued notices.
- Appeal needs no PIN (spec C15); receipt signing uses the shared `CONDUCT_SIGN` pause purpose.
