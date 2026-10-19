# Workforce · Timesheets, overtime and requests (slice 4a, front end)

Chapter 8 "Timesheets and overtime" (the manager's desktop) and Chapter 9 "My time and Report a problem" (every staff member's phone) of the approved Paper designs, on the real API in `backend/src/modules/workforce/timesheets/` (its README has the endpoints, the sweep and who sees what). **Status: built, awaiting the owner's review** (19 Oct 2026, branch `feat/workforce-4a-timesheets-frontend`, nothing pushed). Every choice made without the owner: [decisions-4a-timesheets-frontend.md](../../../../docs/features/workforce/decisions-4a-timesheets-frontend.md).

**Nothing shows for a branch whose new clock is off.** The menu rows carry `needsAttendance`; the pages answer "this branch still uses the old clock"; the Home cards ask only branches that are on. A timesheet period is **one calendar month** (1st to last day, Nairobi time) and closes by itself at 18:00 on the 2nd day after it ends.

## Sub-modules

| Folder | What the person does there | README |
|---|---|---|
| `periods/` | The Timesheets page: the month at a glance, the four numbers, search and filters, the people table, the week picker, Export, Close early, HR's Reopen | [periods](periods/README.md) |
| `week/` | One person's month, a week at a time, in a drawer: the days, what the system approved, the exceptions to decide, Edit time (reused from Attendance) | [week](week/README.md) |
| `overtime/` | The overtime decision with its evidence and limits | [overtime](overtime/README.md) |
| `report/` | The closed timesheet as a landscape report (TSH-n) you can print, the manager's PIN signature | [report](report/README.md) |
| `requests/` | The manager's inbox for Report a problem and "clocked out by mistake", the answer with before and after | [requests](requests/README.md) |
| `mine/` | The phone: My time, My rota, Report a problem, My requests | [mine](mine/README.md) |
| `_shared/` | Types, one service function per endpoint, the data hooks, the words, the branch chooser | |

Public face: `index.ts` (screens, plus the few reads Home uses). Route shells: `app/app/workforce/timesheets/page.tsx` and `report/page.tsx` (bare, the page you print), `requests/page.tsx`, `my-time/page.tsx`, `my-time/rota`, `my-time/requests`, `my-time/report`. Home cards fed from here: `features/workforce/home/cards/timesheet-data.ts`.

## Endpoints used

T1 T2 T4 T6 (the periods, a period with `from`/`to`, a person's period, decide a day), O1 O2 (overtime), P1 to P4 (report, sign, close, reopen), R1 to R6 (requests), M1 M2 (My time, My rota). T5 (one day's detail) is not used: the person read already carries what the screens show, and the day's clock events come from Attendance's F1.

## Rules the screens follow

- Buttons follow the server's capability table (`timesheet.read`, `timesheet.approve`, `overtime.approve`, `time.fix`, `timesheet.close`, `timesheet.reopen`, `time.own`), never a role name. A button the person may not use is hidden, not greyed. A refusal shows in the server's own words (a closed month says `PERIOD_CLOSED` in plain English).
- Nobody changes their own time or decides their own request; the server refuses and the words show.
- A closed month is read-only everywhere, HR included; HR reopens it with a reason.
- Overtime shows evidence as counts and the limits as the rules stand. **Approving only authorises the time; nothing on these screens is pay.** The report and Export carry hours only.
- Every time is Nairobi time, never the browser's zone. Wire names say `organization` where the server code says `site` (`_shared/types/timesheet-types.ts`).
- No pronouns: first names and "they". Display names are shown without their bracket suffix (`plainName`).
- The approved range picker is the one date control (Interaction spec rule 13).

## Parity manifest

"By eye" = the built screen in the browser (1440 for desktop, 390 for phone) next to Paper's frame; "by values" = built from the kit and Paper's values, seen. No pixel-diff tool was used. Paper file "Wendo RMS · Approved designs", page "Workforce · B. Schedule and time".

| Paper step | Screen | State |
|---|---|---|
| Ch 8 · 01 (`1BFT-0`) | Timesheets page | by eye at 1440: header, the four numbers, chips, people table with "what needs you", pager. Left out on purpose: the green "approve all clean days" band (decision 2) |
| Ch 8 · 02 (`1BQ2-0`) | A person's week | by eye: drawer, system line, quiet day rows with the clock range, exception card with only the buttons the viewer may use |
| Ch 8 · 03 (`1BX5-0`) | Overtime decision | by eye: planned, worked, extra, evidence, limits, the decision chips, decline reasons, the note about pay |
| Ch 8 · 04 (`1C48-0`) | Close early | by eye: what closing does, the three figures, what is left out and goes to HR, Keep it open, Close now |
| Ch 8 · 05 (`1CS8-0`) | The closed report | by eye at 1123 wide: header, status stamp, six figures, people table, "approved by the system" line, the PIN signature, QR, footer |
| Ch 9 · 01 left (`1CGC-0`) | My rota | by values: day cards, today marked, day off |
| Ch 9 · 01 right | My time | by eye at 390: dark band with the figure, rows with the clock range, the red problem row with "Report a problem" |
| Ch 9 · 02 (`1CIG-0`) | Report a problem | by eye at 390: the question list, the day with recorded beside "I say it should be", one line, the send button |
| Ch 9 · 03 (`1CJQ-0`) | My requests | by eye at 390: waiting with the sent and not-answered lines, answered with was and now. Left out: "Remind my manager", "Ask HR to look again" (decision 6) |

## Built beyond Paper

| Item | Why |
|---|---|
| The Requests page and menu row | Paper draws the person's side only; the manager needs somewhere to answer |
| Timesheets in the Accountant's menu | Paper's step 5 names the Accountant as a reader of the report |
| Timesheets under Team for a department head | The head reads their department |
| Export (CSV of the report) | Chapter 8 draws the button, not the file |
| The week picker on the page (the approved range picker) | Chapter 8 draws "5 Oct to 11 Oct ▾"; the picker is the one date control |
| "Take this request back" | The person may withdraw while it waits (R6) |
| Hover, pressed, focus, disabled, loading, empty and error states | The kit's rules and the States kit |

## Tests

Pure logic (words, period view, range rules, week view, overtime rules, before and after, report text and CSV, the phone's day lines, the Report a problem form, My rota), components as static markup (the day list shows only the buttons the viewer may use, the request card, the report table), the menu rule by role and by clock on or off, and the route gate. The run end to end was done in the browser on the lane database (Branch Manager on the desktop, a waiter on a phone, HR, plus the access matrix through the API) and the audit entries were checked in `workforce_audit_entries`.
