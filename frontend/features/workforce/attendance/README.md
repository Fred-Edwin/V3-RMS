# Workforce · Attendance (slice 3, front end)

Chapter 6 "A day at work" (the staff phone) and Chapter 7 "Today board and fixing time" (the manager's desktop) of the approved Paper designs, on the real API in `backend/src/modules/workforce/attendance/` (its README has the endpoints and who sees what). **Status: built, awaiting the owner's review** (18 Oct 2026, branch `feat/workforce-3-attendance-frontend`, nothing pushed). Choices made without the owner: [decisions-3-attendance-frontend.md](../../../../docs/features/workforce/decisions-3-attendance-frontend.md).

**The new clock runs behind a per-site switch that is off everywhere.** For a branch that is off nothing here shows: the clock, week and board cards answer "no source", and the menu rows wait (`needsAttendance` in `nav-table.ts`). The old clock is untouched.

## Sub-modules

| Folder | What the person does there |
|---|---|
| `clock/` | The staff phone: the clock card, the two-minute Undo, the heads-up, leaving early, the shift-end prompt (finish, or stay on with a reason), no signal (taps kept on the phone), the phone-closed notice, the shift pill, hours worked in the week card |
| `board/` | The Today board's numbers, department chips, "Needs a look", departments, a person's drawer, the board hook (asked every 30 s) |
| `fixes/` | Clock in for someone, Edit time (edit, add, remove, with the server's preview), the real finish of a phone-closed shift, a person's day and lateness reads |
| `switch/` | The per-site switch screen and the "is the new clock on for me" hook the menu uses |
| `_shared/` | Types, one service function per endpoint, Nairobi time helpers |

Public face: `index.ts` (screens, hooks, pure helpers) and `shell.ts` (the one hook the app shell reads, kept apart so the shell does not import the screens). The composed screens live in Home: `home/components/live-board.tsx` (the board with its dialogs), `today-screen.tsx` (`/app/workforce/today`), `live-team-card.tsx`; the card data hooks are `home/cards/attendance-data.ts`. Route shells: `app/app/workforce/today/page.tsx`, `app/app/workforce/attendance/switch/page.tsx`.

## Endpoints used

C1 to C5 (my day, clock in, clock out, undo, stay on), B1 B2 (board, clock for), F1 to F3 (a day's events, preview, fix), L1 (lateness, in a person's drawer), S1 is not used; **S2** (switch) and **S3** (the list of branches; a small back-end gap added in this session, see decision 1).

## Rules the screens follow

- Buttons follow the server's table (`today.act`, `time.fix`, `timesheet.read`, `attendance.switch`), never a role name. A refusal shows in the server's words.
- Every time is Nairobi time; every counter runs on the server's clock (`offsetMs`).
- A tap carries a `clientEventId`; a retry makes no second event. Taps made with no signal wait on the phone and are sent when the signal returns.
- Nobody fixes their own time: the server refuses and the words show.
- No pronouns: first names and "they".

## Parity manifest

"By eye" = the built screen in the browser (390 for phone, 1440 for desktop) next to Paper's frame; "by values" = built from the kit and Paper's values, seen. No pixel-diff tool was used.

| Paper step | Screen | State |
|---|---|---|
| Ch 6 · 01 | Clock card, before the shift, Undo | by eye at 390: band with the grey pill, card, button, location line, Undo note; the progress bar has two-clock-time labels on a short shift |
| Ch 6 · 02 | On shift, the heads-up | by eye at 390: timer, bar, amber "ENDS IN 10 MIN", the heads-up note |
| Ch 6 · 03 | Shift-end prompt, Stay on | by values (the kit's `PhonePrompt`, `OptionList`): finish, stay on, four reasons, the 15-minute line |
| Ch 6 · 04 | Leaving early | by values; "clocked out by mistake" is words only (slice 4) |
| Ch 6 · 05 | No signal, closed by the phone | by values: "Saved on this phone", "Waiting to send", the closed notice (no button, slice 4) |
| Ch 6 · 06 | Prompt by job | by values: tables (with Hand over), tickets, dispatches |
| Ch 7 · 01 | The Today board | by eye at 1440: numbers, chips, Needs a look with bars, departments |
| Ch 7 · 02 | A person who is not in (drawer) | by eye at 1440: red box, Today rows, the three actions |
| Ch 7 · 03 | Clock in for someone | by eye at 1440: time, reasons, note, "Clock in at 19:35" |
| Ch 7 · 04 | Fix a clock-out (request) | the dialog body is Edit time; the request itself is slice 4 |
| Ch 7 · 05 | A shift the phone closed | by values: keep the closing time or set the real finish, reasons |
| Ch 7 · 06 | Edit time | by eye at 1440: events table, preview before and after, reasons, history link |

## Built beyond Paper

| Item | Why |
|---|---|
| The switch screen (`/app/workforce/attendance/switch`) and its Home card | Paper draws none; the brief asks for the simplest card |
| The Today page's day stepper, branch chooser and "Everyone today" list | The board has its own page; "who is on" needs a list |
| A short-shift progress label (two clock times) | Hour ticks make no sense on a 35-minute shift |
| "Finish now anyway" for a waiter with open tables | Paper's two buttons would trap a waiter who has handed nothing over |
| "Wait, they have told me" hides a person for 30 minutes on the screen | Paper draws it with no endpoint behind it |
| Loading, error and old-clock states | The States kit |
| Hover, pressed, focus, disabled | The kit's rules |

## Not here

Timesheets, overtime, "clocked out by mistake" requests, Report a problem, approvals (slice 4); leave data (slice 5); "Mark absent today" (no endpoint).

## Tests

Pure helpers (card phases and words, hour labels, the shift pill, the week with worked hours, the offline queue, the board's words, the Edit time model), the prompt, leaving-early and note components as static markup, the menu rule by role, the nav table and route gate. The run end to end was done in the browser on the lane database (barista head on the phone, Branch Manager on the board) and checked against the audit table.
