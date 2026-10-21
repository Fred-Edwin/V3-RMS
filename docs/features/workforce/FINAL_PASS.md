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
5. Sessions follow `docs/sessions/workforce-two-part-method.md` (including the **150 tool-call cap with a planned stop**, the fresh-server rule and the no-cheating rules) and `docs/sessions/workforce-frontend-common.md` for fixes that touch screens.

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
| 1 People | written; live role walkthrough in progress (HR, Director, Branch Manager done, 5 roles to go), 50 findings so far | | | |
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
- **Role Homes:** better KPI cards, a paged "Needs your attention" list, and a built Director Home (section 10; the Director's access change, read and write everything, is one back-end session).
- **"Phone" wording at sign-in on a desktop:** section 9.
- **Payout methods:** Cash and M-Pesa stay (owner, 21 Oct); screen and API must offer the same set (sections 1 and 5).
- **Sign-in identity (owner, 21 Oct):** `firstname.secondname@wendo.co.ke`; optional personal email at hire; temporary password `word.word.1234` from about 250 Swahili food words, server-generated, unused expires after 7 days, never forced to change (PIN stays compulsory). Fixed in section 1; the sign-in and security screens follow in section 9.

## Demo videos
Planned in `docs/sessions/final-pass-demo-lane-setup.md` (the clean demo lane and the recording method). One video per section, recorded after the fix, from a lane with realistic fictional data. Nothing shown contains real staff, pay or client data. The owner decides when to send each video.
