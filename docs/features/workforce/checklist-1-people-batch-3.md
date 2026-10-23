# Checklist: People batch 3 (the live-walk fixes)

Part 1 sets `built`; part 2 sets `verified` only after the gate or browser check that proves it. `yes` = seen in a real browser on 23 Oct 2026 as the role concerned (lane 2, demo seed, console clean). `gate` = proved by the tests and builds only, not seen in a browser (the note says why).

| row | item | built | verified | note |
|---|---|---|---|---|
| 2 | Sidebar spine from every sub-header (Staff, Time, Pay, Setup) | yes | yes | Seen as Branch Manager, HR, Store Manager, head. Each caption draws a node and a line down to its first link, same x as the feature header. |
| 4 | Bottom name opens Sign out only; Profile in My account | yes | yes | Seen as Branch Manager. Profile sits in My account for every role seen. |
| 5 | Group of the page stays open; hand choice remembered per device | yes | yes | Workforce stays open on a blocked page (System Admin) and the hand-opened My account stays open after a reload. On a direct load of My file the page's own group (My account) is the open one. |
| 6 | Audit log: remove "Who looked at this log" | yes | yes | Seen as System Admin: no box; "Audit log opened" rows remain. |
| W1 | Active count agrees (Home, Employees) | yes | yes | Branch Manager 26 and 26; HR 49 and 49; Store Manager 3 and 3. |
| W2 | "No head" agrees (Home, Organisation) | yes | yes | HR: 2 on Home, 2 in Needs you, 2 in Organisation. |
| W3 | Duplicate phone warning on first Continue | yes | yes | Seen as Branch Manager: the warning and the "different person" box show on the first Continue. |
| W4 | Undo exit wording | yes | gate | Unit tests; not seen in a browser. |
| W5 | Year shown when not this year | yes | gate | Unit tests; not seen in a browser. |
| W6 | "0 days old" | yes | gate | Unit tests; not seen in a browser. |
| W7 | HR not told "ask HR" | yes | gate | Unit tests; not seen in a browser. |
| W9 | Kinds count agrees (Home, Needs you) | yes | yes | HR: "6 in 4 kinds" with Overdue not counted as a kind. |
| W10 | One date format | yes | gate | Unit tests; not seen in a browser. |
| W11 | Director notices name the person, no amount | yes | gate | Unit tests; Director's bell not opened. |
| W12 | Probation and no-head rows say "Waiting for HR" while the Director has the buttons | left, reason | n/a | Left as is: the row says who it waits on first (HR does this work), and the Director may act for HR. Not a fault. |
| W14 | Director `/my-team` 404 | yes | yes | `/my-team` shows the app's own "This page does not exist" screen. Seen signed in as System Admin (same not-found file for every role). |
| W15 | Director refusal screen exists | yes | yes | A blocked page redirects to "Not available for your role" with a reference. Seen as System Admin (Audit and My file). |
| W16 | Accountant bank-change notice names the person | yes | gate | Unit tests; Accountant not signed in. |
| W17 | "Pay changes" cards link to a real filter | yes | yes | HR: the card opens Employees with "Pay change waiting 1" and one row. |
| W18 | Branch Manager not "Job details missing" | yes | yes | Own row reads Complete. |
| W22 | Hired person's file shows the 24-hour correction | yes | gate | Unit test (`hire-correction.test.ts`); a hired person's file was not opened. |
| W23 | Branch Manager Home vs Organisation "no head" | yes | yes | Home shows 0 "every department has one"; Nyeri Town shows Complete in Organisation. |
| W24 | Branch Manager own row | yes | yes | Reports to shows a dash. |
| W25 | Probation report "who can read" | yes | yes | Head sees "Only HR and your Branch Manager can read this." |
| W26 | Branch Manager menu has Today board | yes | yes | |
| W29 | Store Manager Home vs Organisation "no head" | yes | yes | The card is gone for the Store Manager; Home shows two cards. |
| W30 | Store Manager Home only shows reachable things | yes | yes | No Leave, Timesheets or Build shifts. |
| W31 | Store Manager Employees vs Organisation counts | yes | yes | Home 3, Employees 3. Organisation itself was not opened as Store Manager. |
| W32 | Store Manager Overview fills its layout | yes | yes | Two cards share the full width. |
| W34 | Head's "My team" card and link | yes | yes | Menu link and page `/app/workforce/team`. |
| W35 | Blocked Employees screen for a head | yes | gate | Unit tests; not opened as a head. |
| W36 | Head reaches a probation report; "reports due" | yes | yes | Head sees "1 report due" and "Write report" on Kennedy Mugo; the report dialog opens. |
| W37 | Head menu has My team and does not change between pages | yes | yes | Same menu on Home and My team. |
| W38 | Team today count and notices | yes | yes | "Nobody is on today's rota"; notices read "Kennedy Mugo joined your department". |
| W41 | Sign-in device step says phone | yes | yes | Phone emulation: "first sign-in on this phone", "Chrome on a phone"; desktop says "computer". |
| W42 | Staff pages bottom bar and Ctrl K hint | yes | yes | Phone emulation as Barista: My file has no Order tabs and the menu has no Ctrl K hint. |
| W43 | "HR asks for a detail" opens My file | yes | gate | Unit tests; the notice was not triggered. |
| W44 | Seed photo | yes | yes | Database: Grace Wanjiku and Faith Wambui have a photo. |
| W46 | System Admin Home: no People items | yes | yes | |
| W47 | Blocked page "for" line never lists the System Admin on People or Pay pages | yes | yes | Employees refusal lists HR, Director, Accountant, Branch Managers and Store Managers. |
| W48 | System Admin has no My file | yes | yes | Refusal screen "This page is for the person it belongs to." |
| W49 | System Admin menu | yes | yes | Payroll gone; Users and Branches are two links (Branches opens the branches view; the Users link stays lit for both, known). |
