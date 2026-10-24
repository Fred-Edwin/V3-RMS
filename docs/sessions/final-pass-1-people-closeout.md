# Workforce final pass, section 1: People, close-out (clean-up, proof, docs)

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 2** worktree. **One continuous session, no part 1 and part 2, no handoff file, no screens redesigned.** The People demo video is recorded in lane 6 at the same time: change no behaviour a screen shows, and stay out of lane 6's files.

---

You are a tech lead on Wendo RMS closing the People section of the Workforce final pass: leave it clean, proven and documented before Schedule starts. Read, once: `docs/sessions/workforce-two-part-method.md` (only "Servers, proofs and long commands" and "Known gotchas"), `docs/features/workforce/final-pass/LESSONS.md` (the owner's working rules from People) and `docs/features/workforce/FINAL_PASS.md`. Use plain words in your report.

### Where you work
Lane 2 worktree. `git status` must be clean; then `git checkout -b chore/workforce-1-people-closeout origin/feat/workforce-stack-complete`. Ports: front end 3102, API 4102, `wendo_rms_lane2`, Redis 6402 (`docker start wendo-redis-lane2`, the container name may differ: check `docker ps -a`). **Never write to the owner's main database** (the Postgres MCP is read-only and points at it). Nothing is pushed; commit with `git add <explicit paths>` ending with the attribution line you were given.

### Job 1: clean-up (structure only, no behaviour change)
1. Remove the dead `/app/profile` rule in `frontend/lib/route-access.ts` (the page is gone) and any other reference you find with a search; a visit lands on the app's own not-found screen.
2. Split these files to at most 350 lines each by moving code into new files in the same folder, with no change in behaviour: `backend/src/modules/workforce/people/employees/employees-service.ts` (415), `employees-repository.ts` (372), `people/pay/pay-service.ts` (358), `backend/src/modules/workforce/_shared/workforce-access.ts` (461), `frontend/lib/route-access.ts` (359), `frontend/features/workforce/_shared/components/phone-parts.tsx` (440) and `change-dialog.tsx` (352), `frontend/features/workforce/_shared/gallery/kit-gallery.tsx` (633). Leave `frontend/components/app/shell/sign-sheet.tsx` and every legacy `frontend/app/app/admin/**` page alone: they are not Workforce.
3. Bring these folders to at most 12 files by grouping files into sub-folders named for what they do, updating imports and each folder's README: `backend/src/modules/workforce/people` (27), `frontend/features/workforce/_shared/components` (43), `frontend/features/workforce/_shared/lib` (23), `frontend/components/app/shell` (28), `frontend/features/workforce/people/file/lib` (14). Leave the other over-limit Workforce folders (conduct, audit, needs-you, time, timesheets exports, notifications, leave) for section 10 and list them in your report.
4. Add an **automatic size test** that fails when a Workforce or shell source file is over 350 lines or a folder holds more than 12 files, with an allow-list of the files and folders still over the limit (everything you leave for section 10 and the legacy admin pages), so it passes today and the list can only shrink (copy the idea of `ledger-guard.test.ts`). Back end and front end each get one.
5. Delete dead code found along the way (unused exports, files nothing imports), after a search that nothing else reads it. List **Deleted** and **Kept, because X still uses it**.

### Job 2: prove the People rules on a real database
The 17 database test files could not be proven because the lane databases were seeded with the demo company (the tests expect their own logins and PINs). Make a **clean lane database for tests**: use `wendo_rms_lane3` (nothing else uses it; migrate it with `pnpm exec prisma migrate deploy`), start its Redis, and run the whole Workforce suite once against it with a PIN set for the test logins by a helper that ends by itself (never overwrite a PIN backup). Do not seed the demo data into it. Run in the background with a log. Then:
- Everything that fails because of setup (a login or PIN the test file expects): fix the **setup helper**, not the test, and say what you changed.
- Everything that fails because of the code: fix the code, never the assertion; if the same failure survives two attempts, stop and report it.
- Report per file: how many tests ran and passed. The seven files that already failed on the base before Workforce are listed in the two-part method file: confirm the failing count has not grown, and say which still fail and why.
Write in the README of the test folder (or `docs/features/workforce/TESTING.md`, new, 20 lines at most) the exact commands to prepare that database and run the suite, so the next section can do it in minutes.

### Job 3: documentation
Bring up to date with the Edit tool only: each touched module README and sub-module README (status, endpoints, coupling), `docs/API_CONTRACT.md` and `docs/DATA_MODEL.md` for People and Organisation (check the sections, the numbering and the Profile and My phones removals), `docs/features/workforce/README.md` status rows, `docs/PROJECT_STATUS.md`, and add People's decision logs in one place: `docs/features/workforce/final-pass/1-people-closed.md` (a one-page summary: what People does, what each role can do, what was decided, what was deleted, what is left and where it goes: the not-walked items W8, W20, W27, W33, W39, W45, W50, the five screens never seen in a browser ("Photo not saved" dialog, Sign out everywhere confirmation, payslip year chips and "Earlier" fold, "This wasn't me", My leave against Paper frame 13.8), and the "Search a request" gap on My leave). **Do not edit** `FINAL_PASS.md`, `ROADMAP.md` or the briefs: the orchestrator does that.

### Rules
Edit and Write tools only; a live task list; no subagents; files at most 350 lines and folders at most 12 files for anything you add or touch; no he, she, her or his; role alone or name plus role, never a bare name. Leave the attendance switch off and servers stopped.

### Final message
(1) decisions table, (2) 5-line recap, (3) per job: what changed, the test counts per area, **Deleted** and **Kept, because X still uses it**, rule slips, anything left and where it goes. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner.
