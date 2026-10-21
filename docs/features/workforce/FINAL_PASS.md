# Workforce final pass: one section at a time

Written 21 Oct 2026. All 17 designed chapters are built and merged on `feat/workforce-stack-complete`. This is the plan for the last stage before shipping: go through the **whole feature once, section by section, in the order the parts build on each other**, understand how each part works, find and fix what is wrong, and send the client a short demo video of each finished section. The ROADMAP lists what was built; this file is how it gets polished.

## The loop (every section runs the same four steps)
| # | Step | Who | Output |
|---|---|---|---|
| 1 | **Review** | An agent, in a lane, no code changes | `final-pass/<n>-<name>-findings.md` (every finding with a severity and a recommendation: fix, leave or defer) and `final-pass/<n>-<name>-how-it-works.md` (plain words, so the owner understands the part) |
| 2 | **Owner check and decisions** | The owner, about 20 minutes | A decisions block at the top of the findings file: fix, leave or defer, one word per finding |
| 3 | **Fix** | An agent, two-part method | The decided list fixed and committed; part 2 re-walks only what changed, as a rehearsal for the video |
| 4 | **Demo** | An agent records, the owner watches | A short video. **Watching it is the sign-off.** Anything wrong goes back to step 3 for that item |

The coverage list is not a separate step: the orchestrator builds it from the specs and gives it to the review agent as its checklist (screens, roles, states, hover and keyboard, phone and desktop, and the open items below).

## Rules that stop back-and-forth
1. **A section is closed before the next one's fixes start.** The next section's review may run while the previous video is recorded (a demo changes no code); fixes never overlap.
2. **Cross-cutting findings** (menu, kit component, wording rule, a shared helper) go on the running list at the bottom of this file. They are fixed in the section that owns them; every later review checks the list first, so nothing is found twice.
3. **A findings file is final once the owner has decided.** A new idea found later goes into the next section's list, never back into a closed one.
4. **One review standard**, the same for every section: the checklist in `docs/sessions/final-pass-review-template.md`.
5. Sessions follow `docs/sessions/workforce-two-part-method.md` (including the planned stop between part 1 and part 2, the fresh-server rule and the no-cheating rules) and `docs/sessions/workforce-frontend-common.md` for fixes that touch screens.
6. **Delete as you go (owner, 21 Oct 2026).** A fix batch deletes the old code, pages, copy and menu rows it replaces, after a search that nothing else (another feature, Inventory, the legacy HR pages still in use) reads them. Its final message lists "Deleted" and "Kept, because X still uses it". Section 10 keeps only the splitting of long files, the automatic size test and ship preparation.
7. **No tool-call cap.** Sessions still stop between part 1 and part 2 for a fresh context.

## The order, and why
| # | Section | Contents | Why here |
|---|---|---|---|
| 1 | People | Hire, employee file, pay profile, exit, Organisation, heads, My file | Everything else points at a person |
| 2 | Schedule | Rota, then Attendance (clock, Today board, fixing time, the switch) | The rota is the promise, the clock is the fact |
| 3 | Timesheets | The month, overtime, requests, exports | Built from the rota and attendance |
| 4 | Rules | The ten tabs, PIN changes, history; the parked dialogs check | Timesheets and payroll read these |
| 5 | Payroll | The month page to Paid, bank file, corrections, exports | Built from approved timesheets and the Rules tables |
| 6 | Payslips and casual pay | Phone payslips, P9, daily casual pay and sheets | What payroll publishes to staff |
| 7 | Leave | The whole flow, **plus leave days into timesheets and payroll** (unbuilt item 1; sections 3 and 5 are re-checked) | Needs people, the rota and Rules |
| 8 | Conduct | Notices, signing, appeals | Needs people, timesheets and Rules |
| 9 | Shared parts | Needs you, phones and security, Audit log, Signed documents, the QR page | Cuts across everything above |
| 10 | Whole feature | Role Homes and menus together, the tidy-up, ship preparation, end-to-end demo | Last |

## Lane map (owner preference, 21 Oct 2026: use lanes 1 to 4)
| Lane | Use |
|---|---|
| 1 | Review of the current section |
| 2 | Fixes for the section the review just finished |
| 3 | A second review or fix running in parallel (for example the next section's review while a video records) |
| 4 | Spare, or the next section's review |
| 5 | Small jobs (docs, wiring) |
| 6 | The demo lane: its own database and seed, reset freely, never used for review or fixes |

## Status
| # | Review | Decisions | Fix | Demo |
|---|---|---|---|---|
| 0 | Demo lane set-up: not started | | | |
| 1 People | done: live walk of all 8 roles (21 Oct), 78 findings | pre-filled in `final-pass/1-people-decisions.md`; owner to answer 5 questions and override | Batch 1 (lane 2, brief written); **design pass round 1 drawn and owner-approved 21 Oct (lane 3, Paper page "Workforce · Final pass designs", notes in `final-pass/design-notes-1-round-1.md`, branch `design/workforce-1-people-round-1`)**; then design round 2, Access change, Batch 2, Act-as | not started |
| 2 Schedule | not started | | | |
| 3 Timesheets | not started | | | |
| 4 Rules | not started | | | |
| 5 Payroll | not started | | | |
| 6 Payslips and casual pay | not started | | | |
| 7 Leave | not started | | | |
| 8 Conduct | not started | | | |
| 9 Shared parts | not started | | | |
| 10 Whole feature | not started | | | |

## Open items that the review agents must check (from the roadmap)
- Rules dialogs (leave type, minimum cover, Holidays, Casual work, saving a Statutory table): section 4.
- Leave days into timesheets and payroll; Contracts (CTR) in the Signed documents index; Annual leave seeded at 0 days: sections 7 and 9 (see "Known not built" in `ROADMAP.md`).
- Offline and slow-network states; a real signed PDF through the documents index (the POST route); the Director's payslip-openings card with real payslips; the Conduct witness Confirm path and the HR and Director decision paths: sections 8 and 9.
- Small gaps logged earlier: Timesheets "Excuse" button; in-app Document view for the timesheet PDF; Payroll "Call HR" line source; the named petty-cash holder in Rules; a screen for a department head's overtime note; Rules' approved-month guard reading the real month approval; the P9 layout needs the Accountant's one-time confirmation.
- Files over 350 lines and folders over 12 files (the tidy-up): section 10, plus an automatic size and folder-limit test.

## Running list of cross-cutting findings
Added by the People review, 21 Oct 2026 (details in `final-pass/1-people-findings.md`):
- **Wording rule:** short, professional, clear; chips and card labels up to 3 words; buttons start with a verb; no "arrives with ...", no "slice" on screen. Every role pass lists copy fixes. Fixed section by section, final sweep in 10.
- **Person label:** every picker and list shows Name, position and site. Everywhere (one shared component).
- **Edit convention:** an "Edit" button on every card the role may change; the page header holds only whole-person actions. Everywhere.
- **Stale "arrives with Attendance / Leave / Approvals" copy and greyed Time and Leave tabs:** sections 2 and 7, then the sweep in 10.
- **Menu:** old HR group beside the new one; proposal to organise by feature with sub-links, a jump box and personal items in the account block (section 10).
- **No Inbox in Workforce:** notifications live on Home with a bell; communication is a separate feature refactored later (sections 9 and 10).
- **System Admin (owner, 21 Oct, revised later the same day):** does **not** get the Director's People, Time or Pay screens; the admin menu is Home and Company only (Security alerts, Audit log, Users, Branches, Menu items), because the admin can act as any user without a password, with every change stamped with both names and a Directors' "Support sessions" view (finding 78; five-screen sketch in frames 6.1 to 6.5). One back-end and one front-end session (sections 9 and 10).
- **No account locking (owner, 21 Oct):** accounts are never locked for wrong password tries; the System Admin Home shows "Password resets" instead of "Locked out".
- **Menu and Homes, design round 1 approved (owner, 21 Oct):** top link "Home", each feature opens with "Overview"; Workforce labels Staff, Time, Pay, Setup; "jump box" is called Search; heads and staff get short own menus; phone Homes are the design standard for every phone screen. See `final-pass/design-notes-1-round-1.md`.
- **IDs and bank hidden by default on My file** with a Show button (owner, 21 Oct).
- **Sign-in family redesign (owner, 21 Oct, approved):** the device step ("Confirm this device"), the login ("Welcome back", the owner later chose to redesign it too), Set your PIN and the error states are drawn for desktop and phone, with a brand panel (proof points, "Built and supported by Fred", support line +254 113 176 613, 6 a.m. to 10 p.m.) on every screen. Built in section 9. Login email placeholder is `firstname.secondname@wendo.co.ke`; "Real-time visibility" wording must be checked against the product before it ships.
- **Navigation naming (owner, 21 Oct):** Home is always called "Home"; no "Dashboard" as a landing page; one word for one thing; a test fails on duplicate or off-convention labels (section 10; convention in `final-pass/1-people-findings.md`).
- **Role Homes:** every role gets a proper Workforce Home and lands on it after sign-in; better KPI cards, a paged "Needs your attention" list, and a built Director Home (section 10; the Director's access change, read and write everything, is one back-end session).
- **"Phone" wording at sign-in on a desktop:** section 9.
- **Payout methods:** Cash and M-Pesa stay (owner, 21 Oct); screen and API must offer the same set (sections 1 and 5).
- **Sign-in identity (owner, 21 Oct):** `firstname.secondname@wendo.co.ke`; optional personal email at hire; temporary password `word.word.1234` from about 250 Swahili food words, server-generated, unused expires after 7 days, never forced to change (PIN stays compulsory). Fixed in section 1; the sign-in and security screens follow in section 9.

## Demo videos
Planned in `docs/sessions/final-pass-demo-lane-setup.md` (the clean demo lane and the recording method). One video per section, recorded after the fix, from a lane with realistic fictional data. Nothing shown contains real staff, pay or client data. The owner decides when to send each video.
