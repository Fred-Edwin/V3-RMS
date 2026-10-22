# Workforce · Leave (segment 4, front end)

Status: built and walked in a real browser (21 Oct 2026, phone 390 and desktop 1440, lane 1, Nyeri Town switched on for the walk and off again), awaiting the owner's review. Spec: `docs/features/workforce/specs/4-leave-spec.md` and `-screens.md`. Choices: `docs/features/workforce/decisions-4-leave-frontend.md`. API: `docs/API_CONTRACT.md` §45.

| Folder | Holds | Routes |
|---|---|---|
| `mine/home` | Phone Leave home; `MyLeavePage` picks phone or desktop | `/app/workforce/my-leave` |
| `mine/request` | Request form, shortfall (unpaid tail) block | `/my-leave/request` |
| `mine/history`, `mine/follow` | History with tabs; one request with the circle stepper, endings, cancel | `/my-leave/history`, `/history/[id]` |
| `mine/desktop` | Own leave on a desktop, Ask drawer | `/my-leave` (from 1024 px) |
| `slip` | Document view of the slip | `/my-leave/[id]/slip`, `/leave/[id]/slip` |
| `requests` | The Leave page shell, Requests tab, rota strip, approve, decline, cancel dialogs | `/app/workforce/leave` |
| `balances` | Balances tab, drawer, Adjust a balance | `?tab=balances` |
| `calendar` | Three-week grid | `?tab=calendar` |
| `_shared` | types, services (one per endpoint), dates, copy, idempotency, card, slip buttons | |

Kit additions: `CircleStepper`, chip tone `asked`, capability `leave.balance_adjust`. Other changes: `nav-table.ts` (flag `oldOnlyWhenSwitchOff`, three rows, four old rows), `route-access.ts`, `notification-copy.ts` (six rows), `home/cards/leave-data.ts` (Coming up).
Access comes from the server (`can()` and each request's `can`), never from role names. Public door: `index.ts`.

Response types use the **wire names** for a branch (`organization`, `organizations`, `organizationName`, `organizationId`), not `site*`; `_shared/lib/wire-names.test.ts` guards it. Dialogs that sign (approve, decline, cancel, adjust) take their idempotency key from `useIdempotencyKey`, whose object is stable per component.

## Parity manifest (one line per screen)

| Screen | Paper | Built | Notes |
|---|---|---|---|
| Leave home and Request (phone) | steps 2, 8 | `mine/home`, `mine/request` | Waiting banner, colour key, unpaid-tail block, preview line, disabled send with its reason. Looked at by eye; keyboard run done (arrows, Enter, Tab). |
| History and a followed request | steps 3, 4 | `mine/history`, `mine/follow` | Own list with the shared pager (decision 8). Header figures were dark on dark; fixed. |
| Endings and the slip Document view | steps 4, 6 | `mine/follow`, `slip` | Approved, declined (reason box) checked; the 72-hour move to HR line shown. Slip is the kit's phone Document view and the desktop page. |
| Leave page with the rota | step 10, `1CZI-0` | `requests` | List columns checked against Paper values (PERSON 170, DATES 150, Geist Mono 12); the 7-day strip scrolls sideways by design. |
| Approve and decline dialogs | steps 11, 12 | `requests` | Approve: rota, balance, pay rows, PIN. Decline: no PIN. Wrong PIN message now shows (see below). |
| Own leave on a desktop | step 13 | `mine/desktop` | Manager note "A manager's own leave is approved by HR". |
| Balances and Adjust a balance | steps 14, 15 | `balances` | Sites panel, KPIs, drawer; Adjust offers every adjustable kind even with no days yet. |
| Calendar | step 16 | `calendar` | Three weeks, leave bar, today underline. Arrow-key map not built (decision 17). |
| Cancel an approved leave | not in Paper | `requests` | Production add: reasons, note, PIN. |

**Beyond Paper:** year stepper, pager, offline and error states, "Show all N days", the cancelled-slip note, the desktop Ask drawer, the cancel-approved dialog, the Adjust "Add or take off" chips.

## Shared-file changes (line level, for the orchestrator's merge)
- `frontend/components/app/shell/nav-table.ts`: flag `oldOnlyWhenSwitchOff` on `hr-leave`, `hr-leave-calendar`, `accountant-leave`, `staff-leave`; rows `wf-leave`, `wf-my-leave`, `wf-staff-my-leave` lose `notBuilt`, gain `needsAttendance`; Store Attendant added to `wf-staff-my-leave`. `nav-table.test.ts` follows.
- `frontend/lib/route-access.ts`: `/app/workforce/my-leave` and `/app/workforce/leave` gates.
- `frontend/features/workforce/_shared`: `CircleStepper` (new), chip tone `asked`, capability `leave.balance_adjust`; `lib/notification-copy.ts` six Leave rows; `lib/wire-names.test.ts` one Leave check.
- (History: `home/cards/leave-data.ts` was deleted in batch 2A, 22 Oct 2026, with the Coming up card.) `frontend/features/workforce/home/cards/leave-data.ts`: Coming up merges `GET /away`.
- Back end (own commit, with a test): `GET /workforce/leave/balances/:employeeId` also returns `adjustable`.
