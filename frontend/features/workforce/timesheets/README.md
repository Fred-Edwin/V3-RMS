# Workforce · Timesheets, overtime and requests (slice 4a, reworked by Segment 1A, front end)

Chapter 12 steps 02 to 12 (timesheets by month: the months page, the date range, export, a person's drawer and full month, the overtime decision, Approve the month, Month approved) and Chapter 9 "My time and Report a problem" (every staff member's phone) of the approved Paper designs, on the real API in `backend/src/modules/workforce/timesheets/` (its README has the endpoints, the sweep and who sees what). **Status: Segment 1A screens built, awaiting the owner's review** (19 Oct 2026, branch `feat/workforce-1a-timesheets-frontend`, lane 2, nothing pushed). Every choice made without the owner: [decisions-1a-timesheets-frontend.md](../../../../docs/features/workforce/decisions-1a-timesheets-frontend.md) (the earlier slice's: [decisions-4a-timesheets-frontend.md](../../../../docs/features/workforce/decisions-4a-timesheets-frontend.md)).

**Nothing shows for a branch whose new clock is off.** The menu rows carry `needsAttendance`; the page answers "This branch still uses the old clock"; the Home cards ask only branches that are on. A timesheet is **one calendar month** (1st to last day, Nairobi time): Open, To approve (from the day after it ends), Approved (the site's manager signs with a PIN). **Nothing closes by itself; there is no Close early, no Reopen, no CSV.**

## Sub-modules

| Folder | What the person does there | README |
|---|---|---|
| `months/` | The Timesheets page: months list, the four numbers, range, the people table, Approve and Export buttons | [months](months/README.md) |
| `person/` | A person's drawer and full month: the days that need the manager, the calendar, every day | [person](person/README.md) |
| `overtime/` | The overtime decision: all, part or none, reason, PIN, version | [overtime](overtime/README.md) |
| `approve/` | Approve the month with a PIN | [approve](approve/README.md) |
| `exports/` | The PDF or Excel file | [exports](exports/README.md) |
| `requests/` | The manager's inbox for Report a problem and "clocked out by mistake" | [requests](requests/README.md) |
| `mine/` | The phone: My time, My rota, Report a problem, My requests | [mine](mine/README.md) |
| `_shared/` | Types, one service function per endpoint, the data hooks, the words (`month-words.ts`, `timesheet-words.ts`), the branch chooser | |

Public face: `index.ts`. Route shells: `app/app/workforce/timesheets/page.tsx`, `timesheets/month/[monthKey]/[employeeId]/page.tsx`, `requests/page.tsx`, `my-time/` (page, rota, requests, report).

## Endpoints used

MO1 to MO7 (the months, a month, its people, a person's drawer, a person's days, approve, exports), O3 and O2 (an overtime item, decide it), O1 (the waiting list, for Home), R1 to R6 (requests), M1 M2 (My time, My rota). The old `/periods` routes are gone from the server and from here.

## Rules the screens follow

- Buttons follow the server's answers (the month's `capabilities`, and the capability table: `timesheet.read`, `timesheet.export`, `time.fix`, `time_request.answer`, `time.own`), never a role name. A button the person may not use is hidden. A refusal shows in the server's own words.
- An approved month is read-only everywhere, HR included ("This month is approved. Tell HR."). There is no reopen.
- Overtime shows evidence as counts and the limits as the rules stand. **Approving only authorises the time; nothing on these screens or in the files is pay.**
- Every time is Nairobi time. Wire names say `organization` where the server code says `site` (`_shared/types/`). No pronouns. Display names are shown without their bracket suffix (`plainName`).

## Parity manifest (spec screens; "by eye" = the built screen in the browser; no pixel-diff tool was used)

| Paper step | Screen | State |
|---|---|---|
| 02 `314L-0` | Timesheets month page | by eye (the page at a narrow browser width, on real data): months list, four numbers, range, chips, people table. Not seen at 1440 |
| 03 `31J4-0` | Date range | by values: the approved picker limited to the month, week Picker beside it |
| 04 `31WA-0` | Export menu | by values, as a dialog (decision F1); not seen in a browser |
| 08 `330S-0` | A person's drawer | by eye: header, four numbers, days that need a look, last 7 days, footer line |
| 09 `34CW-0` | A person's full month | by eye: numbers, calendar, chips, dense day rows |
| 10 `33DF-0` | Overtime decision | by values; not seen in a browser |
| 11 `33PK-0` | Approve the month | by values; not seen in a browser |
| 12 `340Z-0` | Month approved | by values (green fourth cell, Approved ✓, document number); not seen in a browser |
| Ch 9 | Report a problem, My requests, My time | wording changed only; by values |

## Built beyond Paper

| Item | Why |
|---|---|
| The Requests page and menu row | Paper draws the person's side only |
| **Head office timesheets** row for the Director | The Director has no Timesheets link; D8 |
| Blocked Approve with "Show them", the date reason for the open month, the part stepper, 409 "changed underneath", wrong or missing PIN, offline and failed export, Not found, Nobody worked | Production states Paper does not draw |
| Narrow-width rules (columns hide, cards) | D23 |
| Hover, pressed, focus, disabled, loading, empty and error states | The kit's rules and the States kit |

## Tests

Pure logic: the words (KPI cells, status words, weeks, ranges, the other-branches note), the default month and range from the address, the Approve blocking rule and refusal words, the overtime evidence, part stepper and answer, the buttons a day gets and the day rows; the menu rule by role and by clock on or off, and the route gate (a head no longer reads timesheets). The back end's own proof run (`src/scripts/timesheets-proof.ts`, 122 checks) covers every role over HTTP, both exports, the lock and the audit.
