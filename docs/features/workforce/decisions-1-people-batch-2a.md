# Decisions: final pass 1, People, batch 2A (the shell)

Where the build departs from the brief, the notes or a Paper frame, or fills a gap. Paper wins unless a row says why not.

| # | Decision | Why |
|---|---|---|
| D1 | Needs you rows on Home carry no pay amounts, though Paper's sample shows some. | An existing test forbids KES in row text; the amount is on the page the row opens. |
| D2 | Search lives in the sidebar (the menu frames); Home frame 1.1 draws it in the top bar. | The menu frames are the later, approved ones. |
| D3 | Home "Needs you" is one row per kind with a count, overdue first (as the Paper frame shows). "See all" is one row per item. | Matches the frames. |
| D4 | Overdue means waiting more than 3 days, or a probation date already passed (Nairobi day). | The brief asks for overdue first; this is the rule used. |
| D5 | Department "My team" and "Timesheets", and HR's "Payslips", are defined but `notBuilt`. | My team is a batch 2B page; heads have no timesheets in the route gate; Payslips has no page. Drop the flag when each exists. |
| D6 | Staff Home shows 3 numbers, not 5. | The other two need data no module holds yet. |
| D7 | Kept Inbox for the Branch Manager, Director, Accountant and floor staff; removed it for HR and the System Admin. Removed the legacy Dashboard for waiter, chef and barista; kept it for steward and housekeeping. | Direct messages still live in Inbox; Home replaces Dashboard where the job pages exist. |
| D8 | Old pages shown only while their new page is not live: Staff shifts and Branch payslips (Branch Manager), Team shifts (head) only while the clock is off; the Director's old Payroll only while Payroll has no month. | A branch that is off sees what it saw before. |
| D9 | The device step is remembered in this browser only (`localStorage`, per person) and sends nothing to the server. The copy says "We ask once on each new device, so you know where you are signed in", not that devices are checked. The place chip is the person's branch or "Company". | The server has no device trust; claiming a check would be untrue. A server-side device list is a later job. |
| D10 | The brand panel's first proof point reads "Every branch in one place", not "Real-time visibility". | Not true of the product everywhere (most screens refresh on demand). |
| D11 | The session-ended bar reads "You were signed out. Sign in to carry on." | Paper says "because you were away for a while"; nobody is signed out for being away (owner decision). The bar is only for a session the server ended. |
| D12 | Wrong passwords pause the answer: after the 5th wrong try in 15 minutes, 429 `LOGIN_SLOWED` with `waitSeconds` 2, 4, 8, 16, 30; the right password also waits out the pause. Recorded in `workforce_pin_tries` under purpose `PASSWORD`; the screen counts the seconds down. | "Accounts are never locked" with a wait. The 10-a-minute rate limit stays. A pause can be seen only for an email that exists, which tells nobody anything the sign-in did not already allow a guesser to learn after five tries; accepted. |
| D13 | The two kitchen display roles skip the device and PIN steps. | Shared screens, no personal PIN. |
| D14 | The System Admin's menu is Home and Company only (also with Inventory rows when previewing another role's Central Store). | Paper 2.x and the notes: the admin acts as a user instead. |
| D15 | Department "Casuals" is renamed "Casual pay". | The naming table. |
| D16 | Names I invented where the table had none: Past counts, Delivery history, Stock audit log, Inventory settings, Staff shifts, Branch payslips, Team shifts, My shifts. | Each page needed one name; sentence case, one per page. |
| D17 | System Admin: Users and Branches both open `/app/admin`. | One page holds both tables. |
| D18 | "Today board" stays under Time for HR and the Director; Requests are folded into Timesheets (`match`). | Not in the table; kept so no page loses its link. |
| D19 | Refusal "Open My team" points at `/app/workforce/my-team`. | Batch 2B builds it. |
| D20 | The old `nav-table.test.ts` (808 lines) is replaced by six files under 350 lines (`nav-gate`, `nav-central-store`, `nav-branch`, `nav-shell-bar`, `nav-menu`, `nav-naming`) plus `nav-test-helpers.ts`. | The brief's size rule. |
| D21 | Legacy `/app/dashboard` and `/app/hr/*` pages stay on disk and in the route gate; only their links are gone. | Another feature or a bookmark may still reach them. |

## Slips (part 1)
- One pointless `python3 -c print` in Bash early on (no edit made).
- One broad Paper `find_nodes` text search ("*wrong*", 162 hits) after the handoff said to avoid them.
- The first menu tests were left failing at the end of the previous session by the owner's request; now rewritten.
- Found and fixed while rewriting tests: the display-only roles got a Home link they cannot open; `pay-change-source.ts` imported Prisma directly (now a repository); the workforce door test did not list the two Home routers.
