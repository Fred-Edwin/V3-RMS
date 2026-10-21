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

## Part 2 (browser walk, 21 Oct 2026)
| # | Question | Choice | Why | Changing it takes |
|---|---|---|---|---|
| 23 | The Balances page crashed for HR (`Cannot read properties of undefined (reading 'reduce')`) | Response types now use the wire names: `organizations`, `organizationName`, `organization` (person), `organizationId` (away). A check in `_shared/lib/wire-names.test.ts` keeps them. | The API sends `organization*` on purpose (`wire-names.ts`); the part 1 types said `site*`. | n/a |
| 24 | HR could not grant a first balance: the Adjust dialog took its kinds of leave from the drawer's cards, and a card exists only once days do | Back-end fix (own commit, with a test in `leave-flow-db.test.ts`, no migration): `GET /balances/:employeeId` also returns `adjustable`, every type the adjust rule accepts. The dialog reads it. | The seeded Annual leave is 0, so every person started with no cards and no kinds to pick. | Return `adjustable` from a rules read instead. |
| 25 | A wrong PIN showed no message in approve, decline, cancel and adjust | `useIdempotencyKey` returns one memoised object. | Each dialog listed `key` in an effect; a new object per render re-ran the effect after every render, clearing the error at once and renewing the key on a retry. | n/a |
| 26 | The Requests list wrapped dates onto three lines | Columns follow Paper (list 448 here, 470 in Paper; DATES Geist Mono 12, not 13 as the spec said); the PERSON cell truncates (`max-w-0`); DATES is 180 px and on one line. | Paper's own row "26 to 28 Oct · 3 d" did not fit our 118 px column. | Widen the list. |
| 27 | History header figures TAKEN and DECLINED were dark on the dark band | White (WAITING keeps `#EFCF9E`). | A missing colour class. | n/a |
| 28 | The Adjust note repeated the person's name | Uses the server's label alone. | `told.label` already holds "name, role". | n/a |
| 29 | With the switch off, `/app/workforce/my-leave` and `/leave` still open when typed | Left as it is; only the menu rows follow the switch. | The route gate is by role (decision 6), like the other Workforce pages. The old and new Leave screens read the same data (the back end carries it). | Add `needsAttendance` to the route gate. |
| 30 | A signer with no PIN sees "Set your signing PIN" before the form's fields | Left (kit behaviour, first use only). | The kit dialog owns it (decision 15). | Show the fields first. |

## Gaps left
- Timesheet and payroll leave days (back end, not built); documents-door registration; Inbox rows still generic (back end); Conduct and Shared parts are not here.
- Calendar department chips on "All sites" list only the viewer's own site's departments (decision 16): the leave back end has no list of departments across sites.
- The Balances tile "PEOPLE · on the leave policy" counts everyone in the list, including people the rows call "Not on the leave policy".
- After a decision the detail panel still says "IF APPROVED" and "balance 21 days, 14 after this", and the person's rota row says "Asking".
- The approved ending labels the 7 booked days "TAKEN" before the leave has started.
- The Requests row line shows the site even to a Branch Manager who has one site.
- Not checked in the browser: the offline states and Slow 3G, the cancel-approved send (opened and closed only), hover and disabled on every new control, keyboard on the Balances and Calendar tabs. Request form, approve and decline were run with the keyboard.
