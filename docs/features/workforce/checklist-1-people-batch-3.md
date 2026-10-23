# Checklist: People batch 3 (the live-walk fixes)

Part 1 sets `built`; part 2 sets `verified` only after the gate or browser check that proves it.

| row | item | built | verified | note |
|---|---|---|---|---|
| 2 | Sidebar spine from every sub-header (Staff, Time, Pay, Setup) | yes | no | Each caption now draws a node and a line down to its first link, same x as the feature header. Browser check as every desktop role. |
| 4 | Bottom name opens Sign out only; Profile in My account | yes | no | `account-group.ts` holds Profile even alone; test updated. |
| 5 | Group of the page stays open; hand choice remembered per device | yes | no | `use-open-groups.ts`; blocked pages and My file keep the last group open. Sub-link order is unchanged. |
| 6 | Audit log: remove "Who looked at this log" | yes | no | Box, `/viewers` route, controller, query and words removed. "Audit log opened" rows stay. API_CONTRACT line 5620 and two READMEs still mention `/viewers` (docs pass, part 2). |
| W1 | Active count agrees (Home, Employees) | yes | no | One rule `ACTIVE_STATUSES` (active, on leave, on notice, suspended). |
| W2 | "No head" agrees (Home, Organisation) | yes | no | One rule: branch department with people and no head or acting head today. Acting head counts as covered. |
| W3 | Duplicate phone warning on first Continue | yes | no | Continue now asks the server again for what is typed. Needs the browser check. |
| W4 | Undo exit wording | yes | no | Login line only when there is a login; says until when. |
| W5 | Year shown when not this year | yes | no | `formatDayMonthSmart` (timeline) and `dayLabel` (notices). |
| W6 | "0 days old" | yes | no | Reads "came in today" / "since today". |
| W7 | HR not told "ask HR" | yes | no | HR is told to ask the System Admin; the System Admin the Director. |
| W9 | Kinds count agrees (Home, Needs you) | yes | no | The Overdue row is not a kind. |
| W10 | One date format | yes | no | Pay-change rows use the same "Fri 16 Oct" form. |
| W11 | Director notices name the person, no amount | yes | no | `name` added to the told() data, wording rewritten. |
| W12 | Probation and no-head rows say "Waiting for HR" while the Director has the buttons | left, reason | n/a | Left as is: the row says who it waits on first (HR does this work), and the Director may act for HR. Not a fault. |
| W14 | Director `/my-team` 404 | yes | no | `app/not-found.tsx` gives the app's own look. The link itself is gone. |
| W15 | Director refusal screen exists | yes | no | Middleware redirects any blocked path to the refusal screen; nothing to change. Open a blocked page in the browser. |
| W16 | Accountant bank-change notice names the person | yes | no | Same as W11. |
| W17 | "Pay changes" cards link to a real filter | yes | no | New filters `pay_change` and `pay_change_month` with chips (pay readers only); the probation card now uses `on_probation`. |
| W18 | Branch Manager not "Job details missing" | yes | no | Product fix: a person who runs a place needs no department. |
| W22 | Hired person's file shows the 24-hour correction | yes | no | `correctUntil` from the server; note on the Branch overview. |
| W23 | Branch Manager Home vs Organisation "no head" | yes | no | Same rule as W2. |
| W24 | Branch Manager own row | yes | no | No longer "Job details missing"; Reports to shows a dash. |
| W25 | Probation report "who can read" | yes | no | Said for the writer (head, manager, HR). |
| W26 | Branch Manager menu has Today board | yes | no | Branch and Store Managers added. |
| W29 | Store Manager Home vs Organisation "no head" | yes | no | The hub has no heads; the card is gone for the Store Manager. |
| W30 | Store Manager Home only shows reachable things | yes | no | Leave and Timesheets cards and Build shifts are left out while the clock is off. |
| W31 | Store Manager Employees vs Organisation counts | yes | no | Organisation hides the same Head Office staff. |
| W32 | Store Manager Overview fills its layout | yes | no | About panel takes the full width when there is nothing to do. |
| W34 | Head's "My team" card and link | yes | no | Goes to `/app/workforce/team`. |
| W35 | Blocked Employees screen for a head | yes | no | Points to the real My team. |
| W36 | Head reaches a probation report; "reports due" | yes | no | "Write report" on a team row; reports due = people on probation with no head report yet. |
| W37 | Head menu has My team and does not change between pages | yes | no | My team added; the clock answer is kept for the tab. |
| W38 | Team today count and notices | yes | no | Card says when nobody is on the rota; the "joined" notice names the person and opens My team. |
| W41 | Sign-in device step says phone | yes | no | A small touch screen counts as a phone. |
| W42 | Staff pages bottom bar and Ctrl K hint | yes | no | No order tabs on Workforce pages; hint hidden on touch. |
| W43 | "HR asks for a detail" opens My file | yes | no | Also the reminder and probation-extended notices. |
| W44 | Seed photo | yes | no | The fresh seed holds Grace Wanjiku's photo; confirm in the browser. |
| W46 | System Admin Home: no People items | yes | no | Housekeeping rows are not made for the admin. |
| W47 | Blocked page "for" line never lists the System Admin on People or Pay pages | yes | no | |
| W48 | System Admin has no My file | yes | no | Route gate refuses it (refusal screen). |
| W49 | System Admin menu | yes | no | Payroll dropped; Users and Branches are two links (`?view=`). |
