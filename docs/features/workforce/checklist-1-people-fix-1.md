# Checklist: People final pass, fix batch 1

`built`: yes, partly, no. `verified`: **browser** = seen working in the real browser (production build, lane 2) or against the live API/database; **tests** = covered by passing unit or flow tests only, not looked at in the browser; **no** = neither. Gates run once at the end of Part 2: backend build, full backend suite (7 known DB-flow files fail on the base; two more failed only in the parallel run and pass alone: people-flow and org-heads-flow), `check:imports` 50 warnings and 0 errors (unchanged), ESLint clean on changed files, front-end `tsc`, 1,611 tests, `pnpm build`.

| row | finding | built | verified | note |
|---|---|---|---|---|
| 1 | API and screen offer the same payout set | yes | tests | Monthly: Bank, M-Pesa. Casual: Cash, M-Pesa, Bank. API refuses Cash for monthly. The file's bank dialog now hides Cash for monthly staff too (row 29). |
| 2 | M-Pesa stays | yes | tests | Left as is (owner). |
| 3 | "M-Pesa number: Not on file" | yes | browser | Row seen on the file (HR). Left as is (owner). |
| 4 | PIN on pay change | yes | tests | Request and Director decision. Not walked in the browser: HR and Director had no signing PIN in the lane. |
| 5 | Probation overdue | yes | tests | Words only. No overdue probation in the lane data. |
| 8 | Incomplete files vs Blocks payroll | yes | browser | HR, Store Manager and Accountant lists show both cards and chips with different counts (12/12 for HR, 4/1 for the Store Manager). |
| 10 | "from their position" | yes | browser | "Yes, from the position" on the file and My file. |
| 12 | Reports to | yes | browser | New hires default to the site manager. Backfill script `src/scripts/backfill-reports-to.ts` (audited, safe to run twice): 9 set, 3 left (no manager at the site); second run 0. The list and file then show the manager. |
| 15 | Own ID, bank, account number | yes | browser | My file: "Add or correct my ID and bank details" (bank list). Saved an ID at 390 px; audit entry holds only the field name. |
| 16 | Overlapping pay changes | yes | tests | Warning in the Change pay dialog. |
| 17 | Future pay change shown as past | yes | tests | "Starts 22 Oct". |
| 19 | Documents tab / Decide dialog | yes | tests | Recorded contract now listed in Documents ("Recorded", no signed copy yet). Tab not opened in the browser. |
| 20 | Assign head dead end | yes | browser | New endpoint O6b; the dialog lists "ZZ Org ae9e84 B, Waiter: Give a login first" (link to the file). Empty button hidden. |
| 21 | KRA PIN format | yes | tests | |
| 22 | Payout choices in hire | yes | tests | |
| 23 | Person on notice | yes | tests | |
| 24 | Activity tab | yes | browser | Table has a BY column; hire shows who hired. Probation event reads "Probation confirmed" with who decided, from the audit entry. The lane's seed rows have no audit entry, so the screenshot shows a dash; the outcome and name are unit-tested only. |
| 25 | Blunt copy | yes | tests | Done: Remove as head, Nobody here has a login yet, No head yet, "{first}'s move or exit", Login role (was Access). "Your decision" already uses the caps label; "Assign as head" was already the button. Move dialog title and Login role not opened in the browser. |
| 27 | Name is a link | yes | browser | |
| 28 | Repeated calls, double audit | yes | browser | Confirmed in a production build: each shell call was made 3 times (19 calls on load). Fix: identical reads in flight share one call (`apiClient`). Now 11 calls, each once; the person and pay are fetched once and one `people.pay_opened` entry is written. |
| 29 | Bank list | yes | tests | Hire step and the file's bank dialog (list plus "Other bank"). Dialog not opened in the browser. |
| 37 | Approve confirmation | yes | tests | Needs a pending pay change and a Director PIN; not walked. |
| 40 | Vague labels | yes | browser | Incomplete files, Blocks payroll, Active staff, Casuals, Left, new subtitle, "Incomplete" file badge, "Complete file" button. |
| 43 | Temporary password | yes | browser | 260 short Swahili words (owner widened the list: food, nature, colours, places, friendly words; 3 to 7 letters; no two one letter apart; test enforces it). 7-day expiry: column `users.temporary_password_expires_at` (guarded additive migration `20261021120000`). Checked against the live API on a lane test account: expired gives 401 `TEMPORARY_PASSWORD_EXPIRED`; an unexpired one signs in and clears the date. |
| 44 | Email fields at hire | yes | tests | |
| 46 | 429 on shared connection | yes | tests | Reads retry; the shell shows "The system is busy, trying again." while a read waits. Not provoked live. Limit per user not checked. |
| 48 | Basics-only hire | yes | browser | Branch Manager sees "Ask HR to change this." on a file they did not just hire; Edit shows within 24 hours of their own hire (back end tested). |
| 49 | BM counts | yes | tests | |
| 50 | 404 as a state | partly | browser | Branch Manager opening a file outside the site: "This file is not on your list", the person asked for once. The app logs nothing, but Chrome prints its own "Failed to load resource: 404" line, which the page cannot suppress. |
| 52 | Accountant Blocks payroll | yes | browser | Chip and card on the Accountant's Employees. |
| 54 | Future pay row for payroll | yes | tests | New row "Pay in the October run: KES 28,000 until 21 Oct, then KES 26,000 from 22 Oct" for a mid-month change. No mid-month change in the lane data, so not seen. |
| 55 | Store Manager reach | yes | browser | Store Manager's list: 4 people on the hub, no head-office logins. |
| 56 | Store Manager positions | yes | tests | |
| 57 | Organisation row and guard | yes | tests | |
| 58 | Store Manager copy | yes | tests | "HR or the site manager", "The site manager approves the day", site manager is the default Reports to (Store Manager's list shows it). The Home empty state is Batch 2. |
| 60 | One top bar on Home | yes | browser | Reproduced two bars for a department head; shell now treats `/app/workforce` as framed. After the fix: one bar at 390 px. |
| 64 | Photo save fails | yes | tests | Needs a real storage key to succeed (ship-prep item added). |
| 65 | NSSF/SHA junk | yes | tests | |
| 66 | Still to finish | yes | tests | |
| 69 | My file copy | yes | browser | Copy seen on My file at 390 px. Details form is Batch 2. |
| Q1 | PIN on pay change | yes | tests | See row 4. |
| Q2 | Own ID and bank | yes | browser | See row 15. |
| Q3 | Cash and payout | yes | tests | See rows 1 and 22. |
| Q4 | Wording only | yes | tests | See row 19. |
| Q5 | 24-hour correction | yes | browser | "Ask HR to change this" line seen for the Branch Manager. |
