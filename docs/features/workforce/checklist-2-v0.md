# Schedule V0 quick fixes: checklist

`built` = in the code and tested. `verified` = seen in a real browser (lane 2, demo data, one page) or proved by a test. Branch `fix/workforce-2-v0-quick-fixes`, nothing pushed.

| row | item | built | verified | note |
|---|---|---|---|---|
| 1 | W20 Rota becomes Shifts | yes | yes | menu, titles, breadcrumb, print, notices, refusal text, My shifts; route addresses keep their old path on purpose |
| 2 | W12 Start from last week explained | yes | test | dialog opens "This copies the week of ... Nothing is overwritten"; "Left out, you decide" |
| 3 | W21 "Left out" explained | yes | test | note under the numbers says why a shift is left out |
| 4 | W22 Arrives with Leave removed, TODAY heading on a past day | yes | yes | tile hidden until the figure exists; heading shows the date |
| 5 | W27 past-day board wording | yes | yes | "Worked a shift", "Never clocked in"; no "now" or "today" |
| 6 | W29 thin count and dates in words | yes | test | footer sums only the thin department; "Wed 28 Oct" |
| 7 | W31 print says Leave | yes | test | back end sends leave days; print page not opened in the browser |
| 8 | W37 head pages titled for the department | yes | yes | "Barista team today", "Department / Team today" |
| 9 | W40 refusal roles per page | yes | yes | Accountant no longer listed on Shifts |
| 10 | W47 refusal points heads to Team today | yes | yes | |
| 11 | W53 Attendance switch title | yes | yes | |
| 12 | W14 timings in cells | yes | yes | name in tooltip, picker, legend |
| 13 | W15 reason optional | yes | test | back end never refuses for a missing reason; dialog Save always on; leave override still needs one |
| 14 | W23 person label | yes | yes | "Chef · Head", footer "Role · Branch"; the Today rows keep department by design |
| 15 | W24 Home Latest | yes | test | "Payroll paid" hidden for roles without payroll; leave notice names the person |
| 16 | W25 Edit time dialog | yes | test | in before out, amber underlined Edit and Remove, overtime sentence gone; not opened in the browser |
| 17 | W28 Not started | yes | yes | week, side list, numbers; legend lists all active shifts |
| 18 | W30 shift colours | yes | yes | demo seed fixed (Afternoon green, Mid-day amber); mapping was already right |
| 19 | W32 leave note in the picker | yes | no | built, picker not opened on a leave day |
| 20 | W33 Show retired count | yes | test | shows only retired shifts |
| 21 | W34 bell on Today board | yes | yes | |
| 22 | W35 duplicate key | yes | yes | console clean |
| 23 | W38 one "on shift" | yes | yes | clocked in now; rostered = has a shift; not started = rostered, not in |
| 24 | W39 phone Shifts view | yes | yes | one menu, today marked, timings; "Needs N · Has M" when a minimum is set |
| 25 | W42 leave balance | yes | no | "Not set" with a reason; Home of staff not opened |
| 26 | W43 phone menu | yes | no | closes on page change and footer shows role and branch; footer seen on desktop only |
| 27 | W44 My shifts | yes | yes | |
| 28 | W51 first branch, remembered | yes | yes | Town first; last choice kept on the device |
| 29 | W56 Central Store hidden | yes | yes | Shifts, templates, Today chooser, switch |
| 30 | W62 System Admin Home | yes | yes | |
| 31 | W36 head clocks someone in | yes | test | already in the access table (head, own department); never themselves; test added |
| 32 | W57 Director opens the switch | yes | yes | gate, menu, two paired tests |
| 33 | W59 rule in the docs | yes | n/a | UI_BUILD_RULES section 3 |
| 34 | W61 switch screen polish | yes | yes | PIN dialog opened (not confirmed, so the switch stayed on) |
| 35 | W63 one refusal pattern | yes | yes | Accountant on both addresses; in-page messages replaced |
| 36 | W64 never "Still loading" forever | yes | test | bars become "We could not load this" with a reference after 14 s; My time for non-clockers |
| 37 | W48 and W49 purpose lines and copy file | yes | yes | `page-copy.ts`, test, UI_BUILD_RULES section 9 |
