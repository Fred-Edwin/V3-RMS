# Workforce final pass, section 1: People, batch 4 (the desktop "My ..." screens)

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 4** worktree. Batch 3 runs in lane 2 at the same time and owns the sidebar, the menu files and the route guard: stay out of them (see "Stay out of").

---

You are a tech lead on Wendo RMS building the approved **desktop "My ..." screens** from design round 3. Read, once: `docs/sessions/workforce-two-part-method.md` (two parts with a planned stop, no call cap, fresh servers, background commands, no cheating, known gotchas) and `docs/sessions/workforce-frontend-common.md`. Then read `docs/features/workforce/final-pass/design-notes-1-round-3.md` in full and, for the phone side, `design-notes-1-round-2.md` group 2 (My file on the phone). Paper file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`), page "Workforce · Final pass designs", frames 13.3 to 13.14: Paper wins over the notes. Never call `get_basic_info`; one screenshot per screen. Section name for files: `1-people-batch-4`. Use plain words in your report.

### Where you work
Lane 4 worktree. `git status` must be clean; then `git checkout -b feat/workforce-1-people-batch-4 origin/feat/workforce-stack-complete`. In `backend/` run `pnpm exec prisma migrate deploy` and `pnpm exec prisma generate`. Ports: front end 3104, API 4104, `http://lane4.localhost:3104`, database `wendo_rms_lane4`, Redis 6404. Seed realistic data: `cd backend && pnpm demo:seed --reset` (logins `<name>@demo.wendo.test`, password `WendoDemo#2026`, PIN `4321`; see `backend/src/scripts/demo-data/workforce/README.md`). Nothing is pushed; commit before the final message.

### Scope (frames in brackets)
1. **My file, desktop** [13.3 to 13.7, 13.14]: the wide two-column page on the existing My file data (identity header, Still to finish, Your job, IDs and bank, Your contact); the photo and bank flows as centred dialogs on desktop (they already exist as full pages on a phone: keep both, switch by width). The phone page [13.14] gains the new card below.
2. **The Sign-in and alerts card** [13.3, 13.14] (new): sign-in email, Password (Change, using the existing change-password path), Notifications (the existing device-notification setting: "Off on this computer", Turn on), and **Sign out everywhere**: a confirmation (wording in the states-kit style, plain) that signs out every device. Use the existing session-revocation back end if there is one (the Activity "This wasn't me" already signs out every device: reuse that); add a small endpoint only if none exists, with tests and an audit entry.
3. **Remove My phones and Profile** (owner, 23 Oct): delete their pages, routes, components, tests and the my-phones remove dialog, after a search that nothing else reads them. **The phone-confirmation record and the first-sign-in "Is this your phone?" step stay.** Their nav rows and route-guard entries are removed by Batch 3 in lane 2: do not edit nav or guard files.
4. **My leave, My payslips, One payslip, My notices, Activity on my record** [13.8 to 13.12], desktop, in the new shell: lay each out as drawn. **One payslip is a right drawer (560 px) on desktop**, closing on the X or Esc; the phone keeps the full page. Activity: chips, numbered pager with rows per page, the detail panel with "That was me" and "This wasn't me". Hidden-amount behaviour (dots until shown, the server-enforced payslip code) must not change.
5. **Delete as you go**, after a grep that nothing else reads it: the old narrow single-column My file layout on desktop, Profile and My phones code, old payslip page markup that the drawer replaces on desktop. List "Deleted" and "Kept, because X still uses it".

### Stay out of (Batch 3 owns them, lane 2)
`frontend/components/app/shell/`, `nav-table` and its split files, `frontend/lib/route-access.ts`, the sign-in pages, the Home components, Organisation, the head's My team and probation pages. If you must change a shared file, make the smallest change, commit it on its own and name it in the handoff.

### Back end
Only what the card needs (session revocation if missing), with tests. Update API_CONTRACT and the touched module README in part 2.

### Checklist
`docs/features/workforce/checklist-1-people-batch-4.md`, Markdown table `row | item | built | verified | note`: 1 My file desktop · 2 Photo dialogs · 3 ID and bank dialog · 4 Your contact · 5 Sign-in and alerts card · 6 Sign out everywhere · 7 Phone page [13.14] · 8 My leave · 9 My payslips · 10 One payslip drawer (and phone page unchanged) · 11 My notices · 12 Activity · 13 Remove My phones and Profile · 14 Deletions.

### Part 1 and Part 2
Part 1 builds (type check and changed-file tests only, one commit per group, tests beside the code), then stops with `docs/features/workforce/handoff-1-people-batch-4.md` and the starter prompt in a code block. Part 2 (fresh context): gates once (`pnpm build`, the back-end suite with the known failing files re-run only at the end, `pnpm check:imports`, ESLint, front-end tests), then a real-browser walk in **one browser page** (chrome-devtools: `list_pages`, keep one page, never open another) as HR, a Director and a staff member (390 px for the phone page), one screenshot of the build beside the Paper frame per screen, hover and keyboard, console clean. Set PINs with a helper (never overwrite a PIN backup). Leave the attendance switch off.

### Rules
Edit and Write tools only; a live task list; no subagents; files at most 350 lines and folders at most 12 files for anything you touch; commit with `git add <explicit paths>` ending with the attribution line you were given; no he, she, her or his; role alone or name plus role, never a bare name.

### Final message
(1) decisions table, (2) 5-line recap, (3) the checklist state, **Deleted** and **Kept, because X still uses it**, rows not seen in a browser, rule slips, lane state. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner.
