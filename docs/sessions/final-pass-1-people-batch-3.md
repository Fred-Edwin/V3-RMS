# Workforce final pass, section 1: People, batch 3 (the live-walk fixes)

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 2** worktree. This closes People. The desktop "My ..." screens are **not** in this batch (they need a Paper design first; lane 3 draws them now).

---

You are a tech lead on Wendo RMS fixing what the owner and the walker found in the live walk of People. Read, once: `docs/sessions/workforce-two-part-method.md` (two parts with a planned stop, no call cap, fresh servers, background commands, no cheating, known gotchas) and `docs/sessions/workforce-frontend-common.md`. The findings are in `docs/features/workforce/final-pass/1-people-walk-feedback.md`: the owner's rows 1 to 6 and the walker's sightings W1 to W50. Paper file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`), page "Workforce · Final pass designs", is the reference for any screen detail; never call `get_basic_info`. Section name for files: `1-people-batch-3`. Use plain words in your report.

### Where you work
Lane 2 worktree. `git status` must be clean; then `git checkout -b fix/workforce-1-people-batch-3 origin/feat/workforce-stack-complete`. In `backend/` run `pnpm exec prisma migrate deploy` and `pnpm exec prisma generate`. Ports: front end 3102, API 4102, `http://lane2.localhost:3102`, database `wendo_rms_lane2`, Redis 6402. **The lane has no demo data**: merge `origin/walk/workforce-1-people` into your branch first (it holds the demo seed and the People data) and seed with `cd backend && pnpm demo:seed --reset` (logins `<name>@demo.wendo.test`, password `WendoDemo#2026`, PIN `4321`; see `backend/src/scripts/demo-data/workforce/README.md`). Nothing is pushed; commit before the final message.

### The owner's decisions (rows 1 to 6; build exactly these)
- **Row 2, sidebar spine:** inside Workforce (and every feature group with sections), each sub-header (Staff, Time, Pay, Setup) must show the vertical spine coming out of the header text, positioned exactly as Workforce's own header does it. Match the approved menu frames (2.x). Do this for every role's menu.
- **Row 4, bottom of the sidebar:** the name block at the bottom opens a menu with **Sign out only**. Profile goes back into the "My account" group with the other personal links.
- **Row 5, open or closed:** the group of the current page is open and **never collapses by itself** (also on blocked pages and My file); the owner's hand choice (open or close a group) is remembered per device; sub-link order is fixed.
- **Row 6, audit log:** remove the "Who looked at this log" box (and anything that only feeds it). The "Audit log opened" rows stay in the log.
- **Rows 1 and 3** (desktop versions of the "My ..." screens) are **not yours**: skip them.

### The walker's sightings: fix them all unless noted. Groups, in build order
1. **Dead ends and wrong screens (fix first):** W34, W35, W36 (the head's "My team" link must go to `/app/workforce/team`; from My team a head must be able to open a person's probation report; fix "0 reports due" so a person on probation in the head's department counts; remove the dead `/my-team` links; W14 the Director's `/my-team` 404 becomes the app's own not-found look), W46 to W49 (the System Admin sees no People items on Home, no "Your file did not load" box: the admin has no file, so My file is not offered; the blocked-page "for" line never lists the System Admin; the admin menu drops Payroll and shows Users and Branches as two real links), W30 (the Store Manager's Home shows only cards for things the menu can reach), W17 (the "Pay changes this month" card links to a real filter), W43 (the "HR asks for a detail" notice opens My file), W41 (the sign-in device step says "phone" and the device on a phone), W42 (staff My file and My payslips show the Home bottom bar, not Order tabs; drop the "Ctrl K" hint on a phone), W15 (check the Director's refusal screen exists by opening a page the role cannot use, e.g. a conduct write; fix if it redirects silently).
2. **Numbers that disagree (one rule each, one source):** W1, W2, W9, W23, W29, W31 (Home and Organisation and Employees must give the same counts: define "no head" once (acting head counts as having a head for "Complete"? decide, say what you chose, and use it everywhere), define "active", count "kinds" once), W18 and W24 (a Branch Manager is not "Job details missing" when the seed gave position and department; if the product wrongly flags them, fix the product; if the seed, fix the seed), W44 (seed photo).
3. **Words and small behaviour:** W3, W4, W5 (show the year when not this year), W6, W7 (HR is not told "ask HR"), W10 (one date format everywhere), W11 and W16 (notifications name the person and the action, never an amount), W12 (leave as is: say why in the report), W22 (the file of a person the Branch Manager hired says "You can correct this until <time>; after that ask HR"), W25 (the probation report note says who can read it correctly for each writer), W26 (Today board link in the Branch Manager menu or remove the Home button's mismatch), W32 (a Store Manager's Overview fills its layout), W37 and W38 (the head's menu and the "team today" count agree with My team; notices with no name get a name).
4. **Not walked (W8, W20, W27, W33, W39, W45, W50):** do not fix; they go to the final re-walk.

### Back end
Only where a count or a link needs it, with tests beside the code. API_CONTRACT and the module README in part 2.

### Checklist
`docs/features/workforce/checklist-1-people-batch-3.md`, Markdown table `row | item | built | verified | note`: one row each for owner rows 2, 4, 5, 6 and for every W number in groups 1 to 3 (W12 marked "left, reason").

### Part 1 and Part 2
Part 1 builds (type check and changed-file tests only, one commit per group, tests beside the code), then stops with `docs/features/workforce/handoff-1-people-batch-3.md` and the starter prompt in a code block. Part 2 (fresh context): gates once (`pnpm build`, the back-end suite with the known failing files re-run only at the end, `pnpm check:imports`, ESLint, front-end tests), then a real-browser walk of **only what changed** as the roles concerned, in the one browser page (chrome-devtools: `list_pages`, keep one page, never open another), one screenshot per changed screen, console clean. Set PINs with a helper (never overwrite a PIN backup). Leave the attendance switch off.

### Rules
Edit and Write tools only; a live task list; no subagents; files at most 350 lines and folders at most 12 files for anything you touch; commit with `git add <explicit paths>` ending with the attribution line you were given; no he, she, her or his; role alone or name plus role, never a bare name. Delete only after a search shows nothing else reads it.

### Final message
(1) decisions table (including how "no head" and "active" are now defined), (2) 5-line recap, (3) the checklist state, **Deleted** and **Kept, because X still uses it**, rows not seen in a browser, rule slips, lane state. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner.
