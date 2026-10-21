# Handoff: People final pass, fix batch 1 (Part 1 done, Part 2 to do)

**(a) Where.** Worktree `lane-2`, branch `fix/workforce-1-people-batch-1` (from `origin/feat/workforce-stack-complete`), last commit: see `git log -1`. Front end port 3102, API 4102, `http://lane2.localhost:3102`, database `wendo_rms_lane2`. Nothing is pushed.

**(b) Built (commits, in order).** Group 1 back end (formats, payout set, PIN on pay change, Store Manager reach); Group 2 back end (server password, sign-in address); front end for both; Store Manager Organisation row (57); Group 3 (photo message, busy retry, quiet 4xx, Approve message); Group 4 (Incomplete files / Blocks payroll, overdue probation, 24-hour hire correction, copy, name link, bank list, My file copy). Per-row detail: `docs/features/workforce/checklist-1-people-fix-1.md`.

**(c) Not done (see the checklist for the full list).**
- [ ] 28 production-build check of repeated calls and the double `people.pay_opened`
- [ ] 60 one top bar on Home for a department head (needs the browser)
- [ ] 58 Store Manager copy; 24 Activity outcome and "by whom"; 25 the remaining labels; 40 file badge
- [ ] 15 / Q2 My file form for National ID, bank and account number (API is ready)
- [ ] 48 / Q5 front-end "Ask HR to change this" line after 24 hours
- [ ] 43 7-day expiry of an unused temporary password (column and sign-in check)
- [ ] 20 list of people without a login; 19 contract listed in Documents; 29 bank list in the file's bank dialog
- [ ] 46 on-screen "trying again" note; 54 "Pay in the October run"; 12 backfill for existing rows

**(d) Part 2 commands.** In `backend/`: `pnpm build`, `pnpm test` (re-run only the known failing DB-flow files at the end), `pnpm check:imports` (not worse), ESLint on changed files. In `frontend/`: `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, ESLint on changed files. Then a real-browser walk of only what changed, as HR, Director, Branch Manager, Accountant, Store Manager, a department head and staff at 390 px (one screenshot per changed screen; audit entries have no password, PIN or amount; console clean; attendance switch off). Note anything awkward for the People demo video.

**(e) Read first.** `checklist-1-people-fix-1.md`; `final-pass/1-people-decisions.md` (Answers section); `backend/src/modules/workforce/people/sign-in/`; `people/pay/pay-service.ts`; `frontend/lib/apiClient.ts`.

**(f) Gotchas.** Fresh servers before the walk. The People DB flow test mocks the signing PIN (`vi.mock` of `signer-pin`); the PIN check itself has its own tests. Real PIN needed in the browser: set one for HR and the Director first. The photo needs a real storage key in `backend/.env` to succeed. `STORE_MANAGER` reach is by login role, not department name.

**(g) Rule slips.** One no-op heredoc/python call in Bash (changed nothing). Marked tasks 1 and 2 "completed" before the checklist showed partial rows.

**(h) Departures from the brief.** The owner removed the 150-call cap mid-session. Q5 differs from the recommendation (owner chose the 24-hour correction). Cash is allowed for casual staff only; monthly staff get Bank or M-Pesa. NSSF and SHA formats are lenient (five to fifteen letters or digits, at least five digits) because the real formats are unknown. The 250-word list is a first draft for a Swahili speaker to review.

**Deleted:** the browser password generator (`_shared/lib/temporary-password.ts`), the three-suggestion email hook (`_shared/hooks/use-email-suggestions.ts`) and its helper and test (`_shared/lib/sign-in-email.ts`, `.test.ts`). **Kept:** nothing else was removed; the legacy `createStaff` path and the old `Email` field on the hire state are still used.
