# Final pass, section 1: People. Decisions

**Update, 21 Oct 2026 (end of design round 1):** Design 1, 2 and 3 rows are drawn and approved (`design-notes-1-round-1.md`). Two decisions changed: the System Admin does not get People, Time or Pay screens (rows 42 and 75 now mean the Director only; the admin acts as users instead), and accounts are never locked for wrong tries. The design round 2 rows (32, 33, 36, 47, 53, 61 to 63, 67, 68, 70) are still to draw.

Written 21 Oct 2026 by the orchestrator from `1-people-findings.md` (78 findings) and the owner's decisions during the live walk. **The Decision column is pre-filled with the recommendation. Change only the rows you disagree with** (write the new word in the Your call column), then answer the five questions. This file, once you have answered, is final for section 1 (FINAL_PASS rule 3).

Words: **Fix** = fix it. **Leave** = do nothing. **Defer** = a later section owns it. **Batch 1** = code and copy, no new design. **Design** = drawn in Paper first (design pass, groups 1 to 3 or the second round). **Batch 2** = built after the designs are approved. **Access** and **Act-as** = their own small projects (see the bottom).

## Five questions for the owner
| Q | Finding | Question | Recommendation |
|---|---|---|---|
| Q1 | 4 | Should a pay change ask for a PIN, both when HR sends it and when the Director decides? | **Yes.** It moves money; Rules and payroll already ask for a PIN. |
| Q2 | 15 | May a person enter their own National ID, bank and account number in My file, with HR verifying (as for NSSF and SHA)? | **Yes.** Payroll needs them and HR is retyping today. |
| Q3 | 1, 2, 22 | Cash and M-Pesa stay. Offer Cash only on the casual (daily) path, keep Bank as the default for monthly staff, make screen and API accept the same set, and log a change of method (the Accountant is told)? | **Yes.** |
| Q4 | 19 | The Decide probation dialog says "the contract must be signed first" but nothing enforces it. Block the decision until the contract is signed, or just fix the wording? | **Fix the wording only** (signing a contract with a PIN is built later; do not block HR). |
| Q5 | 48 | May the Branch Manager who made a hire correct it for 24 hours, or must they ask HR? | **Ask HR** with a clear "Ask HR to change this" line (simpler, safer). |

## Answers (owner, 21 Oct 2026)
- **Q1: Yes.** A pay change asks for a PIN, both when HR sends it and when the Director decides.
- **Q2: Yes.** A person may enter their own National ID, bank and account number in My file; HR verifies.
- **Q3: Yes.** Cash only on the casual path, Bank the default for monthly staff, same set on screen and API, a change of method is audited and the Accountant is told.
- **Q4: Fix the wording only.** No blocking.
- **Q5: The Branch Manager who made a hire may correct it for 24 hours.** (Differs from the recommendation, which was "Ask HR".) After 24 hours the screen says "Ask HR to change this".

## The 78 findings
Sev = severity A, B or C. Where = which piece of work does it.

| # | Short title | Sev | Decision | Where | Your call |
|---|---|---|---|---|---|
| 1 | API accepts Cash and M-Pesa | A | Leave (owner: they stay); make API and screen the same set (Q3) | Batch 1 | |
| 2 | Wizard offers M-Pesa | A | Leave (owner) | none | |
| 3 | "M-Pesa number: Not on file" row | B | Leave (follows 1 and 2) | none | |
| 4 | No PIN on pay change | B | Fix if Q1 is yes | Batch 1 | |
| 5 | Probation card calm when overdue | B | Fix | Batch 1 | |
| 6 | "Arrives with Attendance/Leave" boxes | B | Defer; hide the words now | Sections 2, 7 | |
| 7 | "Heads on leave" shows "arrives with Leave" | B | Defer | Section 7 | |
| 8 | "Needs finishing" counts login/photo | B | Fix: count only what blocks pay or the rota | Batch 1 | |
| 9 | Old HR menu group beside new one | B | Fix with the menu | Design 2, Batch 2 | |
| 10 | "from their position" on My file | B | Fix | Batch 1 | |
| 11 | Legacy department endpoints | B | Defer | Section 10 | |
| 12 | "Reports to" empty | C | Fix: fall back to the Branch Manager | Batch 1 | |
| 13 | "this phone" on a desktop | B | Fix with the sign-in step | Design 3, Batch 2 | |
| 14 | Dialog focus check | C | Closed by the HR walk (Escape and focus work) | none | |
| 15 | Person cannot enter own ID or bank | B | Fix if Q2 is yes | Batch 1 | |
| 16 | Overlapping pay changes, no warning | B | Fix | Batch 1 | |
| 17 | Future pay change shown as past | B | Fix | Batch 1 | |
| 18 | Overdue probation not on Home | B | Fix with the Homes | Design 1, Batch 2 | |
| 19 | Documents tab contradicts Overview | B | Fix wording and list the recorded contract (Q4) | Batch 1 | |
| 20 | "Assign head" dead end | B | Fix | Batch 1 | |
| 21 | KRA PIN "123" accepted | B | Fix (screen and server) | Batch 1 | |
| 22 | Payout choices in hire steps 3 and 4 | A | Leave (owner); Q3 | Batch 1 (Q3 only) | |
| 23 | Person on notice still asked for work | B | Fix | Batch 1 | |
| 24 | Activity tab says too little | C | Fix | Batch 1 | |
| 25 | Blunt copy ("End head" etc.) | B | Fix with the list in the finding | Batch 1 | |
| 26 | HR lands on the old HR Overview | B | Fix with the Homes | Design 1, Batch 2 | |
| 27 | List row is not a link | C | Fix | Batch 1 | |
| 28 | Repeated calls, double audit entry | C | Fix (check a production build) | Batch 1 | |
| 29 | Bank is free text | C | Fix: a bank list | Batch 1 | |
| 30 | Home top cards say little | B | Fix | Design 1, Batch 2 | |
| 31 | "Needs your attention" cut at 6 | B | Fix | Design 1, Batch 2 | |
| 32 | Pickers show bare names | B | Fix: one person label | Design round 2, Batch 2 | |
| 33 | No Edit on IDs/bank and Pay cards | A | Fix: Edit on every card | Design round 2, Batch 2 | |
| 34 | Time and Leave tabs greyed | B | Defer | Sections 2, 7 | |
| 35 | Director has no "Needs you" | B | Fix with the Homes | Design 1, Batch 2 | |
| 36 | Director's pay dialog lacks figures | B | Fix | Design round 2, Batch 2 | |
| 37 | No toast after Approve | C | Fix | Batch 1 | |
| 38 | Director Home nearly empty | B | Fix | Design 1, Batch 2 | |
| 39 | Inbox inside Workforce | B | Fix: no Inbox, bell and "Latest" | Design 1 and 2, Batch 2 | |
| 40 | Vague labels | B | Fix (labels that do not depend on cards) | Batch 1 | |
| 41 | Long mixed menu | B | Fix | Design 2, Batch 2 | |
| 42 | Director read and write everything | Decision | Do it (owner) | Access project | |
| 43 | Weak temporary password | A | Fix | Batch 1 | |
| 44 | Email fields at hire | B | Fix per owner decision | Batch 1 | |
| 45 | Branch Manager Home and menu | B | Fix with the Homes | Design 1 and 2, Batch 2 | |
| 46 | 429 on shared connection | B | Fix | Batch 1 | |
| 47 | Branch Manager's file layout | C | Fix | Design round 2, Batch 2 | |
| 48 | Basics-only hire mixed signals | B | Fix copy and default; "Ask HR" line (Q5) | Batch 1 | |
| 49 | BM sees counts they cannot fix | B | Fix with 8 | Batch 1 | |
| 50 | 404 logged as console errors | C | Fix | Batch 1 | |
| 51 | Accountant Home | B | Fix with the Homes | Design 1, Batch 2 | |
| 52 | Accountant needs "Blocks payroll" | B | Fix with 8 | Batch 1 | |
| 53 | Two kinds of refusal | B | Fix: one refusal screen | Design round 2, Batch 2 | |
| 54 | Future pay row unmarked for payroll | B | Fix with 17 | Batch 1 | |
| 55 | Store Manager reaches the Director's file | A | Fix: scope and server refusal | Batch 1 | |
| 56 | Store Manager offered too many positions | B | Fix | Batch 1 | |
| 57 | Store Manager Organisation row vs access table | B | Fix (table is the authority) | Batch 1 | |
| 58 | Store Manager Home and copy | C | Copy in Batch 1, Home in Batch 2 | Batch 1 and 2 | |
| 59 | Warning form error shown early | B | Defer | Section 8 | |
| 60 | Head: no Home link, two top bars | B | Fix: one top bar now, link with the menu | Batch 1 (top bar), Batch 2 | |
| 61 | My file link missing, "Head of Kitchen" row | B | Fix | Design 2, Batch 2 | |
| 62 | Silent redirects for a head | B | Fix with 53 | Design round 2, Batch 2 | |
| 63 | Head's probation report (owner agreed) | A | Fix: "For you to do" card, My team list, My file link | Design round 2, Batch 2 | |
| 64 | Photo save fails | A | Fix: clear message and ship-checklist item | Batch 1 | |
| 65 | NSSF/SHA accept junk | A | Fix | Batch 1 | |
| 66 | "Still to finish" asks for what is done | B | Fix | Batch 1 | |
| 67 | IDs and bank in full on phone | B | Fix: hidden, Show button (owner) | Design round 2, Batch 2 | |
| 68 | Tap targets under 44 px | B | Fix | Design round 2, Batch 2 | |
| 69 | My file sheet copy | B | Fix | Batch 1 | |
| 70 | "Who looked at your file" missing | B | Fix | Design round 2, Batch 2 | |
| 71 | PIN at first sign-in | C | Defer | Section 9 | |
| 72 | "Is this your phone?" step ugly | B | Fix: redesign | Design 3, Batch 2 | |
| 73 | Home for every role | B | Fix | Design 1, Batch 2 | |
| 74 | Navigation naming | B | Fix | Design 2, Batch 2 | |
| 75 | System Admin has no People screen | B | Resolved by 42 (full access) | Access project | |
| 76 | System Admin "Needs you" rows | C | Fix with the Homes | Design 1, Batch 2 | |
| 77 | "Add Account" vs hire | B | Defer | Section 9 | |
| 78 | Act as another user | A | Build (owner) | Act-as project | |

## Counts
| Where | Findings |
|---|---|
| Batch 1 (code and copy now) | 1 (Q3), 4 (Q1), 5, 8, 10, 12, 15 (Q2), 16, 17, 19, 20, 21, 22 (Q3), 23, 24, 25, 27, 28, 29, 37, 40, 43, 44, 46, 48, 49, 50, 52, 54, 55, 56, 57, 58 (copy), 60 (top bar), 64, 65, 66, 69 |
| Design pass, then Batch 2 | 9, 13, 18, 26, 30, 31, 32, 33, 35, 36, 38, 39, 41, 45, 47, 51, 53, 58, 60, 61, 62, 63, 67, 68, 70, 72, 73, 74, 76 |
| Access project | 42, 75 |
| Act-as project | 78 |
| Later sections | 6, 7, 11, 34, 59, 71, 77 |
| Nothing to do | 2, 3, 14 |

## The two small projects (not part of Batch 1 or 2)
1. **Access change** (findings 42, 75): the Director and the System Admin read and write everything, in the one access table, with the rules kept (nobody approves their own request; a Director's own pay or file is not self-editable; every action audited by name; a Director-made pay change applies at once and tells HR and the Accountant). One back-end session and a front-end check. It reverses earlier decisions D2 and D15 by the owner's choice of 21 Oct. Run it after Batch 1, before Batch 2, so Batch 2's Homes and menus show the final rights.
2. **Act as another user** (finding 78): its own design (the banner, the Support sessions page), then back end, then front end. It changes security, so it gets its own brief and its own review. Start after Batch 2.
