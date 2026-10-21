# Checklist: People final pass, fix batch 1

`built`: yes, partly, no. `verified` stays `no` until Part 2 (gates and the real-browser walk). Edit only the `built`, `verified` and `note` cells.

| row | finding | built | verified | note |
|---|---|---|---|---|
| 1 | API and screen offer the same payout set | yes | no | Monthly: Bank, M-Pesa. Casual: Cash, M-Pesa, Bank. API refuses Cash for monthly (`PAYOUT_NOT_ALLOWED`). A change of method is audited (method label only) and the Accountant is told. A casual has no payout step, so Cash is the casual default; no picker built. |
| 2 | M-Pesa stays | yes | no | Left as is (owner). |
| 3 | "M-Pesa number: Not on file" | yes | no | Left as is (owner). |
| 4 | PIN on pay change | yes | no | Both the request and the Director's decision. Needs a signing PIN set; the screen shows the server's own words if not. |
| 5 | Probation overdue | yes | no | Words only ("Ended 7 days ago, decision overdue"); no colour change. |
| 8 | Incomplete files vs Blocks payroll | yes | no | New `blocks_payroll` filter, count and card. Gaps a role cannot see are already left out. |
| 10 | "from their position" | yes | no | Now "Yes, from the position". |
| 12 | Reports to | partly | no | New hires with nobody named report to the site manager; list shows "No head yet". Existing rows are not backfilled. |
| 15 | Own ID, bank, account number | partly | no | Q2 yes. API and schema accept them (HR verifies, locked after verification). No new My file form for ID or bank yet. |
| 16 | Overlapping pay changes | yes | no | Warning in the Change pay dialog. Not blocked. |
| 17 | Future pay change shown as past | yes | no | "Starts 22 Oct" in history, Pay card ("Next change") and timeline. |
| 19 | Documents tab / Decide dialog | partly | no | Q4: wording only, done. The recorded contract is not yet listed in Documents. |
| 20 | Assign head dead end | partly | no | Honest title, link to Employees, empty button hidden. The list of people without a login is not built. |
| 21 | KRA PIN format | yes | no | Screen and schema. |
| 22 | Payout choices in hire | yes | no | No Cash card on the monthly hire step; casual copy unchanged. |
| 23 | Person on notice | yes | no | Probation card and Next steps hidden once an exit is recorded. |
| 24 | Activity tab | partly | no | Closing line fixed. Outcome and "by whom" not added. |
| 25 | Blunt copy | partly | no | Done: Remove as head, Nobody here has a login yet, No head yet. Not done: Exit tab title, "Assign as head", "Your decision" label, ACCESS vs Login role. |
| 27 | Name is a link | yes | no | Real link on the name. |
| 28 | Repeated calls, double audit | no | no | Needs a production-build check; do not fix before checking. |
| 29 | Bank list | partly | no | Hire step only. The file's bank dialog is still free text. |
| 37 | Approve confirmation | yes | no | "Approved: {name}'s pay is KES x from {date}." |
| 40 | Vague labels | partly | no | Done: Incomplete files, Blocks payroll, Active staff, Casuals, Left, subtitle, no "arrives with". Not done: file badge "Needs finishing", "Finish the file". |
| 43 | Temporary password | partly | no | Server generator, 250+ words (first draft), different words, dots, audited. NOT built: 7-day expiry (needs a column and a sign-in check). |
| 44 | Email fields at hire | yes | no | Personal email optional with purpose and privacy line (placeholder wording); one sign-in address from the server. |
| 46 | 429 on shared connection | partly | no | Reads retry up to 3 times; message says the system is busy. No on-screen "trying again" banner. Limit per user not checked. |
| 48 | Basics-only hire | partly | no | Q5: the hiring manager can correct for 24 hours (back end, tested). Front-end "Ask HR to change this" line and Edit control not built. |
| 49 | BM counts | yes | no | Counts use only what the role can see. |
| 50 | 404 as a state | partly | no | 4xx no longer logged as errors. "Asks for the person more than once" not checked. |
| 52 | Accountant Blocks payroll | yes | no | Same card and chip. |
| 54 | Future pay row for payroll | partly | no | "Next change" row and "starts" mark. "Pay in the October run" not built. |
| 55 | Store Manager reach | yes | no | List and file reads leave out Director, HR, Accountant, System Admin, Branch Manager logins; conduct refuses them. Unit-tested; DB flow test passes. |
| 56 | Store Manager positions | yes | no | Lookups and hire refuse positions at or above the manager. |
| 57 | Organisation row and guard | yes | no | Store Manager added to the row and route guard; tests updated. |
| 58 | Store Manager copy | no | no | Not started. |
| 60 | One top bar on Home | no | no | Needs the browser to see which bar is extra. |
| 64 | Photo save fails | yes | no | 502 `PHOTO_STORAGE_FAILED` with the error reference; ship-prep checklist item added. |
| 65 | NSSF/SHA junk | yes | no | Format, "On file, ends 0037", confirm tick, masked old value in audit, locked after HR verifies. |
| 66 | Still to finish | yes | no | Not asked when both numbers are on file. |
| 69 | My file copy | partly | no | Your photo, JPG or PNG message, "your manager", phone message done. Details form is Batch 2. |
| Q1 | PIN on pay change | yes | no | |
| Q2 | Own ID and bank | partly | no | See row 15. |
| Q3 | Cash and payout | yes | no | See rows 1 and 22. |
| Q4 | Wording only | yes | no | See row 19. |
| Q5 | 24-hour correction | partly | no | Back end done; front end line not built. |
