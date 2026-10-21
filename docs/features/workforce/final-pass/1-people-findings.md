# Final pass, section 1: People. Findings

Review by an agent on lane 1, 21 Oct 2026, branch `review/workforce-1-people` (from `feat/workforce-stack-complete`). No code and no Paper were changed. Severity: **A** wrong result, rule broken, a flow that cannot be finished; **B** confusing, stale copy, differs from Paper; **C** polish. Fill the **Decisions** column with one word each: fix, leave or defer.

Evidence folder (screenshots): `/tmp/claude-1000/-home-fred-Projects-V3-RMS-lanes-lane-1/fb0bb378-a699-451d-9a78-ba76a6790e12/scratchpad/shots/`. Proof scripts in the folder above it: `matrix.mjs`, `m2.mjs`, `writes.mjs`, `cash.mjs`.

## Findings

| # | Where | Role | What is wrong or missing | Why it matters | Sev | Recommendation | Evidence | Decisions |
|---|---|---|---|---|---|---|---|---|
| 1 | `PUT /workforce/people/:id/pay-profile` and `POST /workforce/people` (hire) | HR | The API accepts payout method CASH and MPESA (both returned 200 and were saved). | The owner's rule is pay by bank only. Anyone calling the API can break it. | A | Fix: allow BANK only in `PayProfileSchema` and `StatutorySchema`; keep old values readable for backfilled rows. | `cash.mjs` output: `CASH 200`, `MPESA 200`; `people-validators.ts:167` and the hire statutory schema | |
| 2 | Add employee, step 4 "Statutory and bank" and step 3 "Pay" | HR | The wizard offers an M-Pesa choice and says "Paid once a month by bank or M-Pesa". | The screen invites the forbidden option. | A | Fix: remove M-Pesa and Cash; bank fields only. | `frontend/features/workforce/people/hire/components/steps/statutory-step.tsx:28`, `pay-step.tsx:25` | |
| 3 | Job and pay tab ("IDs and bank" panel) and My file | HR, the person | Both show an "M-Pesa number: Not on file" row. | Same rule; it hints that M-Pesa is an option. | B | Fix: remove the row. | `staff-myfile-390.png`; page text of the Job and pay tab | |
| 4 | Change pay dialog (request) and the Director's approve or decline | HR, Director | No PIN is asked. The dialog says "Logged, with your name". The review brief expects a PIN on a pay change. Decision 18 of slice 1a recorded this on purpose ("the API takes none"). | A pay change moves money, yet Rules and other money steps ask for a PIN. | B | Owner decision: add a PIN on both steps (back end and front end) or confirm none. | Dialog text read in the browser; `decisions-1a-frontend.md` row 18 | |
| 5 | File, Overview tab, probation card | HR | A week after probation ended it reads "Day 93 of 93 · 0 days left" with the heading "Decide by 14 Oct". It never says the decision is overdue. | The card that most needs attention reads calm. | B | Fix: "Ended 7 days ago, decision overdue". | `hr-file-joy-overview2.png` | |
| 6 | Overview tab: "On time", "Overtime", "Leave left" boxes; tabs "Time" and "Leave" greyed | HR | Boxes say "arrives with Attendance" and "arrives with Leave". Those features are now built. | Stale copy that says the product is unfinished. | B | Fix when Sections 2 and 7 land (wire the figures, enable the tabs). Cross-cutting. | same screenshot | |
| 7 | Organisation, "Heads on leave" card | HR | Shows a dash and "arrives with Leave". Leave is built. | Stale copy. | B | Fix with Section 7. Cross-cutting. | `hr-organisation.png` | |
| 8 | Employees list, "Needs finishing" (42 of 44) | HR | A missing login or photo counts as a gap, so almost everyone is flagged, including people with pay, bank, contract and IDs complete. | The number and the amber card stop meaning anything in a real company. | B | Fix: count only gaps that stop pay or the rota; show login and photo as a lighter note. | `hr-employees-search-joy.png`; API `gaps` for Dennis Mwangi: `LOGIN, PHOTO_AND_DETAILS, EMERGENCY_CONTACT` | |
| 9 | HR menu | HR | The sidebar still shows the old HR group (HR Overview, Contract Types, Leave Requests, Leave Calendar, Attendance, Shifts, Payroll, Inbox) next to the new Workforce group, and "My payslips". Paper's sidebar has none of the old group. | Two ways to the same things; the old pages are the old design. | B | Defer to Section 10 (menu tidy). Cross-cutting. | `hr-employees-1440-b.png` | |
| 10 | My file, "Your job" panel | The person | Reads "Yes, from their position" about the person's own file. | Third person in a page addressed to "you". | B | Fix wording ("Yes, from your position"). | `staff-myfile-390.png` | |
| 11 | Legacy department endpoints (`/departments...`) | HR | They still write the head flags by hand. The README says the two writers can disagree until the nightly reconcile. Not reproduced in this review. | Inventory could see a different head from Workforce for up to a day. | B | Defer: retire the legacy routes in Section 10. | `people/README.md` line 123 | |
| 12 | Employees list, "Reports to" column | HR | Empty for nearly everyone; the hire wizard does not suggest the department head or Branch Manager. | A column that never fills looks broken. | C | Fix or drop the column; suggest a default at hire. | `hr-employees-1440-b.png` | |
| 13 | Sign-in, first time on a device | Everyone | Asks "Is this your phone?" and prints "this phone" on a desktop browser. | Wrong word on a computer. | B | Fix with Section 9 (security). Cross-cutting. | page text read in the browser | |
| 14 | Employee file dialogs | HR | Escape closes the dialog, but where focus lands was not tested with a real click (the dialog was opened by script). | Keyboard users. | C | Re-check in the fix session. | not verified | |

## Cross-cutting findings (go on the running list in `FINAL_PASS.md`)

| What | Where it lives | Section that fixes it |
|---|---|---|
| "Arrives with Attendance / Leave / Approvals" copy and greyed tabs | People file, Organisation, Homes | 2, 7 (then 10 sweep) |
| Old HR menu group beside the new menu | `nav-table.ts` | 10 |
| "Phone" wording at sign-in on a desktop | security screens | 9 |

## What passed (checked, no finding)

- **Access, by API** (`matrix.mjs`, `m2.mjs`, `writes.mjs`): Branch Manager reads only own site (Highway person: 404; own-site colleague's pay: 404, documents come back only as a "locked" list); Accountant reads pay, cannot hire (403) and has no Organisation (403); Director reads all and approves pay changes, cannot hire or exit (403); HR cannot approve pay (403); Branch Manager editing an active file gets 403 `FILE_LOCKED_FOR_EDIT`; a Store Attendant gets 403 on the list, 404 on someone else's file, 200 on own file; no token gives 401. The Director's decline needs a note (400 without).
- **Table convention:** search by type-ahead ("1 match for Joy"), filter chips with counts, Site and Department filters, numbered pager with rows per page, no infinite scroll.
- **Audit:** 17 hires, 26 contracts, 11 probation decisions, pay opens, a pay change and its decision are all in the audit log; no password, PIN or pay amount appears in the entries checked (0 matches).
- **Console:** no errors on My file.
- **Data rules on screen:** no screen shows the word "organization" or a raw role code; no "he" or "she" seen.

## Coverage list

| Row | Covered |
|---|---|
| Employees list (HR) desktop: numbers, search, filters, pager | yes |
| Add employee, step 1 (HR) | yes (screen only; steps 2 to 5 read from code, not walked) |
| Hire by API: monthly, casual, no contract yet, with login | yes (17 people hired) |
| Employee file Overview and Job and pay (HR) | yes |
| Change pay dialog | yes (opened, not submitted in the UI; submitted by API) |
| Director approval of pay | API only |
| Documents, Conduct, Activity tabs | no |
| Edit job, contract, probation, transfer, send to site, exit, undo, rehire dialogs | probation decision and contract by API only; others no |
| Exit and certificate of service | no |
| Organisation (HR) desktop | yes |
| Department page, assign, replace, acting head, positions tab | no (acting head and 8 gaps seen on the list) |
| Dated-change scheduler | no |
| My file (store attendant) at desktop width | yes |
| Branch Manager, Accountant, Director screens in the browser | no (API only) |
| Department head, System Admin | API only |
| People cards on each Home | no |
| Documents: offer letter, contract, appointment, pay change, probation, transfer, certificate | no |
| Phone width 390 | no (the browser window did not resize below about 916 px) |
| Paper: Chapter 3 frame viewed (artboard `SX0-0`); Chapters 1, 2, 4 title nodes only (`OOM-0`, `QWP-0`, `Y8A-0`) | partly |

## Could not check, and why

- Most dialogs, documents and the Branch Manager, Accountant, Director and head screens in a browser: the review stopped at the 150-call cap.
- Whether "Joy is told when it starts" sends a notification: not tested.
- The named petty-cash holder gap and the P9 and contract wording: not reviewed (the wording is placeholder for the lawyer).
- Two lane logins (`grace.wairimu@`, `samuel.kiptoo@`) do not accept `password123`.
- Lane data is dirty: old test sites (`ZZ Cas ...`), 15 test people (`ZZ ...`) and a department named "X" show up in the People screens ("44 people across 5 sites"). For the demo lane, start clean.
- To make the screens realistic I added 17 people, 26 contract records and 11 probation confirmations, one pay change and its approval to the **lane database only**. Brian Otieno's payout was set to Cash and M-Pesa as a test and put back to Bank.
