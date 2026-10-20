# Timesheets · mine (the phone)

**Spec:** Paper Chapter 9. **Status:** built, awaiting review (19 Oct 2026). **Endpoints:** M1 (My time), M2 (My rota), R4 to R6 (My requests, send, take back).

Four screens in the phone frame (the dark band with the back arrow on a phone; the shell's top bar and one 480 px column on a desktop, for a desktop role's own time):

- **My time** (`/app/workforce/my-time`): the month's hours as the big figure, each day newest first with its clock range and hours (green tick, amber for a short day, a red bar with "Clocked out early. Is this wrong?" and **Report a problem** when something looks wrong; once a report is waiting the row says so and the button goes), overtime as authorised or waiting, a month stepper.
- **Report a problem** (`/my-time/report?date=`): "What went wrong?" (six lines), then the day, what was recorded beside "I say it should be", the times (the in-app number pad), one line, and **Send to your manager** (or HR for a pay question). Nothing changes until someone answers.
- **My requests** (`/my-time/requests`): waiting (sent, not answered; after three days "also gone to HR, you do not need to do anything"), approved with was and now and "Your Friday now shows 8 h 00", not approved with the reason. **Take this request back** while it waits.
- **My rota** (`/my-time/rota`): the next two weeks, today marked, days off drawn as off.

The Attendance clock card's "clocked out by mistake?" note and the closed-shift notice now link here.

| Piece | File |
|---|---|
| Frame | `PhoneScreen` from the shared kit (moved to `_shared/components/phone-screen.tsx` in Segment 3) |
| Screens | `components/my-time-screen.tsx`, `report-problem-screen.tsx`, `my-requests-screen.tsx`, `my-rota-screen.tsx` |
| A request card | `components/request-card.tsx` |
| Day lines, week groups, overtime words | `lib/my-view.ts` |
| The Report a problem form and the request it becomes | `lib/report-form.ts` |
| My rota days and hours | `lib/rota-lines.ts` |

**Coupling:** Attendance (clock helpers), Rota (`toneOfColour`, dates). A branch whose new clock is off sees "still uses the old clock".
