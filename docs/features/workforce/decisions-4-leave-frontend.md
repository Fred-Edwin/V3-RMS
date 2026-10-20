# Workforce 4 (Leave, front end): decisions

Branch `feat/workforce-4-leave-frontend`, 20 Oct 2026, part 1 (build). Each row: question, choice, why, what changing it takes.

| # | Question | Choice | Why | Changing it takes |
|---|---|---|---|---|
| 1 | Who builds `CircleStepper`? | Added to the shared kit (`_shared/components/circle-stepper.tsx`, exported). Conduct may reuse it. | Spec: whichever of Leave or Conduct builds first. | Conduct merging its own copy: keep one. |
| 2 | `ShiftChip` look for "Asked for" | New chip tone `asked` (dashed caramel border, warning text) via `ShiftChipTone`; `ShiftTone` and the rota's colour map untouched. `leave` already existed. | Rota code maps `ShiftTone` exhaustively. | Fold into `ShiftTone` and add it to the rota map. |
| 3 | Capability `leave.balance_adjust` | Added to the front-end capability union. | The server holds it; the Adjust button asks `can()`. | n/a |
| 4 | Old leave rows | New nav flag `oldOnlyWhenSwitchOff`, set on `hr-leave`, `hr-leave-calendar`, `accountant-leave`, `staff-leave`. New rows `wf-leave`, `wf-my-leave`, `wf-staff-my-leave` lose `notBuilt`, gain `needsAttendance`. | Spec section 1. | Remove the flag. |
| 5 | Store Attendant | `wf-staff-my-leave` roles now include the Store Attendant. | Spec section 10: Staff and Store Attendant ask leave; the route gate allows it. | Edit roles. |
| 6 | Route gate | `/app/workforce/my-leave`: everyone but System Admin. `/app/workforce/leave`: HR, Branch Manager, Store Manager, Director, System Admin. | Heads and the Accountant have no Leave page (spec L34). | Edit `route-access.ts`. |
| 7 | One URL, two layouts | `/my-leave` shows the phone Leave home under 1024 px and the desktop list-and-detail from there up (`useMediaQuery`, nothing mounted until the width is known). | Step 13 is the desktop of the same route. | Two routes. |
| 8 | History list | Own light list with the shared `TablePager` (25, 50, 100 per page), not `DataTable`; tab counts and the header figures come from one extra call for the year (100 rows). | The phone list has tabs, circles and a fixed download slot that `DataTable` rows do not draw. | `DataTable layout="cards"`. |
| 9 | History: reason in the status line | Declined rows read "Declined" only; the reason chip is not in the list payload (it is in the followed request). | Server list has no reason code. | Add `decisionReasonCode` to `GET /me/applications`. |
| 10 | "Builds up from {date}" | The card says "Builds up 1.75 days a month" with no date. | Server sends `builds: { perMonth }` only. | Add `from` to the overview card. |
| 11 | Requests tab filters | The list filter row owns the `status` URL key (All recent, Needs you). `tab` stays the page's Requests, Calendar, Balances. | Spec URL `?tab=requests&status=`. | n/a |
| 12 | Approver's name on a finished request | The outcome line reads role and moment ("Approved by Branch Manager, Tue 6 Oct, 10:05 · LVE-0030"), not the person's name. | `GET /applications/:id` returns `decision.byRole` only. | Add `decidedByName` to the detail. |
| 13 | Balances KPIs | PEOPLE, ANNUAL DAYS BOOKED, LOW BALANCE (the server's red-bar count, not "under 3 days"), ADJUSTED THIS MONTH. No average. No Department filter on the Balances table. | B1 sends exactly these four numbers and no department list. | Server: average and "under 3 days"; a departments list. |
| 14 | Adjust: signed days | ADD is the in-app number pad (digits only; project rule) with "Add days / Take days off" chips beside it; the sign is applied before sending. | `lib/input-conventions.test.ts` forbids a raw numeric input. | A signed pad. |
| 15 | Adjust and Approve: Approve/Adjust enabled before fields are complete | They use the kit `WorkforcePinDialog`, whose button is enabled by the PIN alone. Missing fields are shown as a status line and refused with the same words on submit. | The kit dialog also owns first-use "set your PIN". | Give the kit dialog a `disabledReason` prop. |
| 16 | Departments for the Calendar filter | Read from the Organisation overview (`GET /workforce/org`); a reader who may not see it gets no filter. | No leave endpoint lists departments. | Add them to C1. |
| 17 | Calendar keyboard | Each bar is a button in tab order; the arrow-key grid map of the spec is not built. | Time; the bars are reachable and named. | Add roving focus across people and days. |
| 18 | Idempotency | One key per intent (`useIdempotencyKey`): kept for a retry or double tap, renewed when dates, type, reason or amount change and after a success. | Spec section 4. | n/a |
| 19 | Slip buttons | Leave has its own copy of download/share (`slip-buttons.tsx`, `use-file-action.ts`) instead of importing Payslips' internals. | No cross-feature deep imports. | Move both into the kit. |
| 20 | Notification wording | The six Leave rows of `notification-copy.ts` follow spec section 8 (push text generic; Inbox text for managers). | Gap list. | n/a |
| 21 | Home | "On leave" on the Today board already reads `onLeave.available`; no front-end change. "Coming up" gets `GET /away` (next 14 days) merged in by `home/cards/leave-data.ts`. The Needs-you card and badge are Shared parts'. | Spec section 9. | n/a |
| 22 | Not drawn in Paper, added | Year stepper, pager, offline states, "Show all N days" for long requests, the cancelled-slip bar note, desktop Ask drawer. | "Production adds" in the spec. | n/a |

## Gaps left (for part 2 or later)
Timesheet and payroll leave days (back end, not built); documents-door registration; Inbox rows still generic (back end); Conduct, Shared parts not here.
