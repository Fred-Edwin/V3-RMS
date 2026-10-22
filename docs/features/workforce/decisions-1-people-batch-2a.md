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

## Added in part 2 (22 Oct 2026)
| # | Decision | Why |
|---|---|---|
| D22 | A staff Home with no Needs you list shows the branch name after the date ("Thursday 22 October. Nyeri Town"); Paper's staff frame puts the site first and says "things are for you". | Staff have no Needs you list yet (D6), so the sentence Paper builds on it does not apply; left as built rather than invent wording. |
| D23 | A mixed Overdue row (several kinds) says "See overdue" and opens the overdue list; one kind keeps its own button ("Assign heads"). | The row borrowed the first item's button, which was wrong for the rest. |
| D24 | The head's team card reads "My team" with "people in my department". | Paper's label; the old wording said "on the team today" for a number that is not today's. |
| D25 | The "Ctrl K" hint stays in the phone drawer's Search box. | Paper may draw it there; flagged for the owner, not changed. |
| D26 | The Director's payslip-openings digest component is kept but nothing draws it. | Removing the card on Home orphaned it; the Audit log redo decides its place. |

## Added at the end of part 2 (22 Oct 2026)
| # | Decision | Why |
|---|---|---|
| D27 | Notifications are a right-hand drawer on desktop and a full page on phones; both draw one list with search, area chips and day groups. `GET /workforce/notifications` takes `area` and `q` and returns `all` and `areas[]`. | Owner request; Paper 13.1 and 13.2. |
| D28 | The connector line in an open feature breaks at each caption: every link draws its own segment, down through the gap to the next link, and the last link of a section stops at its node. | Owner request; the Paper sidebar frames already draw it so (no redraw needed). |
| D29 | "My account" is a group after the features holding every personal link the person has (My file, My leave, My payslips, Activity on my record, My notices, Profile, and My time, My rota, My requests where they apply). Profile also stays under the name with Sign out. Not drawn when Profile is the only personal link (System Admin). Drawn first in Paper as frame 2.8. | Owner request; "Me" was ruled out as a name. Links are not duplicated for the rest: only Profile is repeated, as asked. |
| D30 | "My account" is closed until opened or until a personal page is the current page. | Same as every other group: only the feature you are in is open. |
| D31 | The password "Show" word became an eye button (crossed out while shown), with `aria-label` "Show password" / "Hide password" and `aria-pressed`. Paper's frames show only the plain eye; the crossed state is built in the same style and reported. | Owner request; undrawn states are built in the same style (standing rule). |
| D32 | Pre-existing, not changed: the drawer and the desktop sidebar both render the menu, so list ids like `menu-feature-account` appear twice in the page. | Seen while testing in the browser; the phone drawer and sidebar are never visible together, and nothing links to those ids. |

## Slips (part 2)
- One `printf` in Bash to add a blank line to `docs/API_CONTRACT.md` (a Bash write; the section itself was added with Edit).
- Edited `signin-shell.tsx` while a sign-in was in progress in the browser, which reset the page's state; redid the walk cleanly.

## Slips (part 1)
- One pointless `python3 -c print` in Bash early on (no edit made).
- One broad Paper `find_nodes` text search ("*wrong*", 162 hits) after the handoff said to avoid them.
- The first menu tests were left failing at the end of the previous session by the owner's request; now rewritten.
- Found and fixed while rewriting tests: the display-only roles got a Home link they cannot open; `pay-change-source.ts` imported Prisma directly (now a repository); the workforce door test did not list the two Home routers.
