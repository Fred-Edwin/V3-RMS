# Workforce: connect Leave slips and Conduct notices to the Signed documents door (small back-end session)

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 5** worktree. **Short session: build, verify, report. Do not use the two-part stop; one context is enough.**

---

You are a tech lead on Wendo RMS. The Signed documents door and index exist (Shared parts back end B). Leave and Conduct each export a ready hook, but nothing calls the door, so leave slips (`LVE-nnnn`) and conduct notices (`WRN-nnnn`) never reach the index or the verify page. Your job is to connect them. **Back end only. No front-end files. Never alter legacy tables. Nothing pushed.** Read `docs/sessions/workforce-two-part-method.md` for the known gotchas, the fresh-server rule and the no-cheating rules (they apply; the two-part split does not).

### Where you work
Lane 5 worktree. It holds two untracked folders from other work (`docs/features/inventory/training-issues.md`, `scripts/training/`): leave them alone and never add them to a commit. Then `git checkout -b feat/workforce-docs-door-wiring origin/feat/workforce-frontends-4-6`. Lane 5 API port 4105, database `wendo_rms_lane5` (check `backend/.env` first; run `pnpm exec prisma migrate deploy` and `pnpm exec prisma generate`). Edit with the Edit and Write tools only; a live task list; no subagents; commit with `git add <explicit paths>` ending with `Co-Authored-By: ` plus your attribution line; commit before your final message.

### Read first (only these)
1. `backend/src/modules/workforce/documents/README.md` and `decisions-6b-backend.md` (the door `registerDocument(tx, {...})` and `withdrawDocument(tx, {...})`, the kinds, sources and reconcile).
2. `backend/src/modules/workforce/leave/slip/slip-service.ts` (`registerLeaveSlipDocument`, `verifyLeaveSlip`) and the approve and cancel services that issue and void a slip; `backend/src/modules/workforce/conduct/documents/register-documents.ts` (`registerConductDocuments`, `ConductDocumentProvider`) and the services that issue, sign, reduce and withdraw a notice.
3. `backend/src/modules/workforce/_shared/documents/document-kinds.ts` and `document-sources.ts`, `docs/features/workforce/specs/6c-documents-and-verify-spec.md` (D1 and D3).

### Scope
1. **Leave:** call `registerDocument` **inside the approve transaction** when `LVE-nnnn` is issued, `withdrawDocument` when a slip is cancelled (the cancelled slip keeps its number and is shown as voided, as the verify page expects). The QR hash is the first 10 characters of the stored hash (`hashPrefixOf`), as the PDF already prints. Title and `about` carry **no figures, balances or reasons**.
2. **Conduct:** call it when a notice becomes final and numbered (signed, verbal has no number so it is not indexed, or past the not-signed states as the spec says); version 2 of the same number marks version 1 replaced (a reduction keeps the number and adds the decision page; withdrawn calls `withdrawDocument`). **No reason text, ever, in `title` or `about`.**
3. **Reconcile sources** for both kinds, so `reconcileDocuments` indexes issued numbers that pre-date the wiring (the nightly job, before an index read, and on a verify miss). Both must be safe to run twice.
4. **Verify outcomes:** the public verify route must answer a genuine LVE and a genuine WRN, a cancelled slip as voided, a replaced notice as replaced, and an unknown number as unknown; **role and date only**.
5. Tests: the door call is atomic with the issuer's transaction (a rollback leaves nothing indexed), version 2 replaces version 1, withdraw, the hash prefix equals the QR's, a second reconcile registers nothing new. Add a short README section in `leave/` and `conduct/`.
**Out:** all front end; any change to the document layouts; the documents index endpoints.

### Gates (once each, at the end)
`cd backend && pnpm exec tsc --noEmit`, the tests for `leave`, `conduct`, `documents`, `verify` and `workforce-layering.test.ts` (update the layering list only if you add an export), `pnpm lint` on the changed folders, `pnpm build`, and `pnpm check:imports` not worse than 50 warnings. **One HTTP check on a fresh server on port 4105** (confirm a route that exists only in the new code answers first): issue and cancel a leave slip and issue a conduct notice with proof logins that you create, call the public verify route for each (it needs no sign-in; mind the rate limit of 30 a minute), then tear the data down (the audit log and ledgers are append-only: say what stays). Leave the lane's attendance switch off. No edits to the shared doc files except one line each in `docs/API_CONTRACT.md` (§46, "Leave and Conduct are now indexed"), `docs/features/workforce/README.md` and `docs/PROJECT_STATUS.md` (use the Edit tool; keep it small).

### Final message
(1) decisions table (question, choice, why, what changing it takes), (2) 5-line recap, (3) files touched in other modules, rule slips said plainly, and what is not covered. **Do not draft the next session's prompt.** Stop for the owner's review.
