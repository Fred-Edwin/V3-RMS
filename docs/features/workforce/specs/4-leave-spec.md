# Segment 4: Leave (spec, part 1: rules that apply to every screen)

20 October 2026. The build spec for the back-end and front-end sessions of Segment 4. Screens (steps 1 to 17, and how 18 to 20 connect) are in [`4-leave-spec-screens.md`](4-leave-spec-screens.md). Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · C. Leave and conduct", Chapter 10 (frame `2ZK9-0`, steps frame `1CW7-0`). Inputs: `design-pass-1-leave-conduct.md`, `design-pass-4-shared-parts.md`, `ROADMAP.md`, `specs/1b-rules-spec.md` (Leave tab), `1a-timesheets-spec.md` (documents), the old HR leave code, the rota, attendance and payroll READMEs. Choices are in [`decisions-4-spec.md`](decisions-4-spec.md), cited as L1, L2 and so on.

**The standing rule:** Paper is a demonstration, production is the goal. Every screen has **Paper** (exactly what is drawn) and **Production adds** (what real use needs, built in the same style and reported). Sample figures in Paper are illustrative. Words: roles in messages ("your Branch Manager"), name plus role on records, never a bare name where a record is shown, no he, she, her or his, no titles (L29).

**Owner correction, 20 Oct 2026 (L1):** Waiting for you no longer exists. Paper step 9 is stale and is **not a screen** in this spec. Leave is decided **only** on the Leave page (steps 10 to 12). Section 9 says what the badge, the Home card and the Leave page each do.

## 0. Paper map (node ids, read 20 Oct 2026)

Each step is one frame under `1CW7-0`. The **on-screen label** of steps 1 to 8 is out of order in Paper (see section 16); this table uses the brief's step numbers.

| Step | Node | On-screen label | What |
|---|---|---|---|
| 1 | `1EPK-0` | STEP 01 | Staff phone: menu, tap My leave |
| 2 | `2YU8-0` | STEP 01 | Leave home and Request (date picker) |
| 3 | `2YZK-0` | STEP 02 | History and one request followed |
| 4 | `2Z6E-0` | STEP 03 | Endings: approved (slip) and declined (reason) |
| 5 | `2ZB7-0` | STEP 04 | Moved to HR after 3 days |
| 6 | `2ZPN-0` | STEP 06 | Document view (slip LVE-0031 and notice WRN-0007) |
| 7 | `1CYH-0` | STEP 07 | Inbox answer |
| 8 | `1G7F-0` | STEP 08 | Not enough days |
| 9 | `1EUJ-0` | STEP 09 | **Waiting for you: stale, not specced** |
| 10 | `1CZI-0` | STEP 10 | Branch Manager: Leave with the rota |
| 11 | `1DAK-0` | STEP 11 | Approve dialog |
| 12 | `1FCJ-0` | STEP 12 | Decline dialog |
| 13 | `1R0H-0` | STEP 13 | Branch Manager's own leave on a desktop |
| 14 | `1DK1-0` | STEP 14 | Balances (HR) |
| 15 | `1FXR-0` | STEP 15 | Adjust a balance |
| 16 | `1DWH-0` | STEP 16 | Calendar |
| 17 | `1E9N-0` | STEP 17 | The leave slip LVE-0031 (A4 portrait, 794 wide) |
| 18 | `1F42-0` | STEP 18 | Rules, Leave tab (built in segment 1) |
| 19 | `307Y-0` | STEP 19 | Change Annual leave (built) |
| 20 | `1FO9-0` | STEP 20 | Change minimum cover (built) |

Design widths: phone 390; desktop 1440 (sidebar 236, main 1204, content 1140 between 32 px sides); document A4 portrait 794 × 1123. Paper tokens seen: ink `#171512` (`neutral-950`), grey `#635E57`, `#8D8982` (`neutral-400`), hairline `#E4E2DE`, strong border `#CFCBC4`/`#D2CFC9`, page `#F6F5F3`, header espresso `#2E1806` (**no token: use the kit's `PhoneDarkHeader` value**), brown button `#693C1B` (`espresso-600`), success `#2F6438`, warning text `#8A5A16` (`warning-fg`), warning tint `#FBF2E4`/`#E7D3AC` (`warning-bg`/`warning-border`), error `#97281D`, amber `#B5823E` and `#B0610F` (nearest `caramel-600`, flag), warm row `#FCF2E4`/`#FBF1DE`.

## 1. What exists today and what this segment adds

**Old system (live now):** `backend/src/services/hr-service.ts`, `routes/hr-routes.ts` (`/hr/leave/...`), `repositories/hr-repository.ts`, `validators/hr-schemas.ts`; screens `frontend/app/app/hr/leave/page.tsx`, `hr/leave/calendar`, `hr/my-leave`, and the staff file `LeaveTab.tsx`. Tables `leave_policies` (per contract type), `leave_balances` (per profile, type, year: `total_days`, `used_days`, `pending_days`), `leave_requests`, `leave_request_acknowledgements`. Types `ANNUAL SICK EMERGENCY UNPAID`; statuses `PENDING APPROVED REJECTED CANCELLED`. It counts **Monday to Friday only** (`calculateWorkingDays`), the approver is the legacy `MANAGER` of the branch or HR or Director, a manager's own leave goes to HR, it checks a shift clash only as a warning, and a request moves balances at submit (pending) and approve (used). There is no PIN, no slip, no 3-day escalation, no rota effect.

**New system (this segment):** module `backend/src/modules/workforce/leave/`, front end `frontend/features/workforce/leave/`. Tables are **new and additive** (section 2). The legacy tables are never altered.

**Coexistence (L2 to L5). Flagged for the owner:**
- **Who is on which system:** a site whose attendance switch is **on** uses the new Leave; every other site stays on the old screens. Menu rows `wf-leave`, `wf-my-leave`, `wf-staff-my-leave` get `needsAttendance: true` and drop `notBuilt`; the old rows (`hr-leave`, `hr-leave-calendar`, `accountant-leave`, `staff-leave`) already hide for a switched-on site through the nav table's switch logic (the build session adds `oldOnlyWhenSwitchOff` if the table lacks it; `nav-table.test.ts` proves it).
- **Never decided twice:** the old write paths (`submitLeaveRequest`, `approveLeaveRequest`, `rejectLeaveRequest`, `cancelLeaveRequest`, `revertLeaveRequest`, `updateLeaveBalance`, and the contract-type balance sync) call one new door function `assertLegacyLeaveWritable(siteId)` first. For a switched-on site it throws `409 LEAVE_IN_NEW_SYSTEM` ("Leave for this branch is now handled in the new Leave screens."). This is the **only change to old code** besides registering the door; reads stay.
- **Carry at switch-on** (`leave/carry/`, called by the attendance switch service after the clock carry, same transaction family, repeatable): for the site's people, copy legacy requests with `end_date >= today` (any status) and this year's decided ones into `leave_applications` with `origin = 'LEGACY'`, `legacy_request_id` unique, legacy `total_days` kept in `days`, `counted_in = 'WORKING_DAYS'`; write one `OPENING` ledger entry per person and type = `total_days - used_days` (floor at 0) dated the carry day. Legacy `PENDING` rows become `WAITING` with the original `asked_at` (so the 72 hours keeps counting). Re-running updates a still-waiting new copy if the legacy row was decided in the gap. `leave.legacy_carried` is audited, channel SYSTEM.
- **Switch-off** mirrors unfinished new requests back as marked legacy rows (L5). A later switch-on skips marked rows.
- **Wire names:** the old API keeps its `/hr/leave` paths; the new routes are under `/workforce/leave` (section 12).

## 2. Data (additive; names are a recommendation)

- `leave_applications`: `id`, `company_id`, `site_id` (the person's site at the time, column `organization_id` rule applies), `employee_id`, `type_code`, `type_snapshot` (label, paid, approvedBy, requiresReason, sickNoteAfterDays at the ask time), `start_date`, `end_date` (date-only), `days` (calendar days), `unpaid_tail_days`, `note`, `status` (`WAITING | APPROVED | DECLINED | CANCELLED`), `stage` (`MANAGER | HR | DIRECTOR`), `routed_to_role`, `asked_at`, `with_hr_at`, `decided_at`, `decided_by`, `decider_role`, `decision_reason_code`, `decision_note`, `cancelled_at`, `cancelled_by`, `cancel_reason`, `slip_number` (Int, unique), `slip_snapshot` (JSON), `slip_hash`, `balance_before`, `balance_after`, `version`, `origin`, `legacy_request_id`, `counted_in`, `idempotency_key` (unique with `employee_id`).
- `leave_balance_entries` (append-only ledger, a database trigger refuses UPDATE and DELETE like `workforce_audit_entries`): `employee_id`, `type_code`, `leave_year`, `kind` (`OPENING | CARRY_OVER | ADJUSTMENT`), `days` (signed int), `as_of`, `reason_code`, `reason_note`, `by_user`, `created_at`; unique per (employee, type, year) for `OPENING` and `CARRY_OVER`.
- `leave_document_seq` (Postgres sequence, like `timesheet_document_seq`).
- `leave_events` (status history for the stepper): `application_id`, `kind` (`ASKED`, `MOVED_TO_HR`, `APPROVED`, `DECLINED`, `CANCELLED`), `at`, `by_user`, `role`.
Audit actions to register in `audit-actions.ts` (category LEAVE): `leave.requested`, `leave.moved_to_hr`, `leave.approved`, `leave.declined`, `leave.cancelled`, `leave.balance_adjusted`, `leave.legacy_carried`, `leave.slip_cancelled_stamped`.
Every query carries `site_id` (non-negotiable 3). Business logic lives in services, queries in repositories; every endpoint has a Zod schema; no `any`.

## 3. Balances (L6 to L11)

- **Leave year** = calendar year (Nairobi). A request cannot cross 31 Dec (`LEAVE_CROSSES_YEAR`: "This runs into next year. Send two requests.").
- **Days** = `end - start + 1`, every calendar day. The unpaid tail is part of `days`.
- **Entitlement for type T in year Y** (pure function `leave-balance.ts`): `perYear = type.daysPerYear ?? defaultPolicy[T] ?? 0` read from the LEAVE rules version in force on the 1st of each credited month.
  - `UP_FRONT`: `perYear` from `max(1 Jan, start date)`; no proration.
  - `MONTHLY`: `perMonthDays` credited on the 1st of every month from the month **after** the start month (a joiner on 14 Jul gets the first credit on 1 Aug) until the exit month; `earned = floor(sum)`.
  - `PER_EVENT`: 0 until an adjustment adds days.
  - A person with an `OPENING` entry for the year: `credited = OPENING + MONTHLY credits for months after the carry month + adjustments after the carry date`, and `LEGACY` applications never count again.
- `credited(asOf) = entitlement(asOf) + CARRY_OVER + ADJUSTMENTs`. `taken` = approved days with date ≤ today; `booked` = approved days with date > today (both from `NEW` applications, per day); **`left now = credited - taken - booked`**; `waiting` is shown, never subtracted. Fractions never reach the screen: whole days only.
- **Bar colour** on the cards (fixed in code, not a Rules setting): `left / perYear` over 0.5 green `#2F6438`, 0.25 to 0.5 amber `#B5823E`, under 0.25 red `#97281D` (`perYear` = the year's credited-to-date for `MONTHLY` types would hide progress, so the bar uses the full year figure). A type with `perYear` 0 or "No limit" shows no bar.
- **Carry-over** (L9): `ensureYear(employee, year)` writes `CARRY_OVER = min(max(closing(Y-1), 0), carryOverDays)` once. `closing` uses the same functions.
- **Frozen at decision:** approval stores `balance_before` and `balance_after` on the application (left now before, minus this request's days), copied into the slip snapshot. Later adjustments change live balances only, never a slip.
- **Adjust** (HR, step 15, L25 and L26): `POST` writes an `ADJUSTMENT` entry, never edits one; to fix a wrong entry post a linked correcting entry. Result may not go below 0.
- **Rules change** (Rules tab dialog copy: "Leave already taken or booked: Not changed"): the function reads each month's rule, so a change from 1 Jan 2027 never touches 2026.

## 4. Status machine of a request (L18 to L23)

| State | Meaning | Person can | Who decides | Next |
|---|---|---|---|---|
| WAITING, stage MANAGER | Asked, with the routed decider | Cancel | The routed decider (section 5) | Approve, Decline, or after 72 h stage HR |
| WAITING, stage HR | Moved after 72 hours (or routed to HR from the start) | Cancel | HR (Director for HR's own) | Approve, Decline |
| APPROVED, booked | Start date after today | Cancel | Manager or HR may cancel with reason and PIN | CANCELLED |
| APPROVED, on leave | Today within the dates | Nothing | Nobody (HR adjusts the balance) | taken |
| APPROVED, taken | End date before today | Download slip | Nobody | final |
| DECLINED | Reason shown, nothing taken off | Ask for other dates (starts a new request with the dates prefilled) | final |  |
| CANCELLED | By the person or the manager | Slip (if one existed) shows CANCELLED | final |  |

"Booked / on leave / taken" are **derived from dates**, not stored. The stage `HR` is derived from `asked_at + 72 h` when no `with_hr_at` is written yet; an hourly worker job `leave-escalation-job` writes `with_hr_at`, the `MOVED_TO_HR` event, the audit entry and the notifications (L20). The decide rules, in order, for approve and decline:
1. Application must be `WAITING` (else `409 ALREADY_DECIDED` with who, when, what).
2. `expectedVersion` equals `version` (else `409 STALE_REQUEST`, the screen reloads the row).
3. Actor is the routed decider for the current stage (else `403 NOT_YOUR_DECISION`; HR before the move: `403 NOT_WITH_YOU_YET`; own request: `403 OWN_REQUEST`).
4. Approve only: days ≤ left now (`409 BALANCE_TOO_LOW`), PIN valid (`403 PIN_INVALID`, `403 PIN_NOT_SET`, `429 PIN_LOCKED`), start date not before today (a request whose start has passed while waiting answers `409 STARTED_WHILE_WAITING`: "These days have already started. Decline it or ask the person to send new dates.").
5. One transaction: update with `version + 1`, balance snapshot, slip number (approve), rota cells cleared (approve), `leave_events`, audit entry last (`runAudited`); then emit events and notifications.
Idempotency: `Idempotency-Key` on ask, approve, decline, cancel and adjust; the same key returns the first result.

## 5. Routing: who decides (L18, L19, L34)

| The person is | Decider | Capability |
|---|---|---|
| Staff, department head, Store Attendant, steward and so on at a branch | Branch Manager of the site | `leave.approve` scope `unit` |
| Staff at the Central Store | Store Manager | same |
| A Branch Manager or Store Manager | HR Manager | `leave.approve` `all` |
| HR Manager | Director | `leave.approve` `all` |
| Director, or any Head office person including the Accountant | Director for staff, HR Manager for the Director | same |
| Maternity or Paternity (type `approvedBy = HR`) | HR Manager from the start | same |
| Any request after 72 hours with the stage MANAGER | HR Manager (Director when the person is HR) | same |
The person may never decide their own (`assertNotSelf`). `System Admin` holds `leave.approve all` as a fallback only; the UI shows no decision buttons to them unless they are the routed decider.

## 6. Minimum cover and the rota (L15 to L17)

- `cover(application, day)` returns `{ department, people, working, minimum, tight, planned }`. Inputs: the person's department, the Rules `minimumCover[departmentId]` (site override first), rota entries for the site and department on the day, approved leave of others on the day, the person's own rostered state.
- Rota planned for that day: `working = rostered people - on approved leave (override-kept shifts excluded) - (this person rostered ? 1 : 0)`. Not planned: `working = active people - on approved leave - 1`, and the strip says "usual shifts, rota not planned yet".
- `tight = working < minimum`. Never blocks. The manager sees the numbers; the person asking sees only the line "Those days are tight for the {Department} team. Your Branch Manager will see this when deciding. You can still send it." (no counts, no names).
- **Approval writes:** the person's `rota_entries` on those days are removed through a new rota door `clearCellsForLeave(employeeId, dates, applicationId)` (one `rota.cells_changed` audit entry, reason "Leave approved", batched notice to the person); the leave lookup `registerLeaveLookup` returns the approved dates so the rota shows **Leave** and its warning "approved leave needs an override reason to keep" works; the attendance Today board `onLeave` becomes `{ count, available: true }` and lists the people; Home KPI **On leave** shows the count (today a dash); the Home **Coming up** card lists approved leave starting within 14 days (names plus dates, for the Branch Manager and department head). A cancel after approval leaves the days empty, the rota notice says "Leave cancelled: plan {Name, Role}'s days", and the lookup drops the dates.
- Timesheets: `leaveDays` per person per month = approved days in the month (paid and unpaid); day rows show Leave, not absent. The month snapshot gets `paidLeaveDays` and `unpaidLeaveDays`; payroll turns unpaid days into `UNPAID_ABSENCE` using `unpaidDayDivisor` (L33; additive change in `timesheets/approval/snapshot.ts` and `payroll/calculate/load-inputs.ts`).

## 7. The leave slip and documents (L27 to L29)

- **Numbering:** `LVE-nnnn` from `leave_document_seq` at approval, in the same transaction; gaps allowed; padded to four digits.
- **Frozen snapshot** (`slip_snapshot`, hashed into `slip_hash`): person name and role, department, site, type label, start and end, days, unpaid tail, asked and approved moments, approver name and role, balance before and after, department head name and role at approval (or none), signature moment, document number, the template version. The PDF is rendered from the snapshot only, so a re-render has the same bytes (as PD16). A cancelled slip re-renders from the same snapshot plus the cancel block.
- **Page:** A4 portrait 794 × 1123 px (595.28 × 841.89 pt) through `_shared/documents/portrait-doc.ts` (`openPortrait`, `addPortraitPage`, `letterhead`, `stamp`, `signature`, `footers`, `drawQr`). Fonts: Tinos (Times) body, Alex Brush signature 38 px; navy bar `#14284B` across the top; margins 40 pt; palette from `lib/document-palette.ts`. Paper layout (values at 794 wide): logo 52 and "Wendo Coffee Bistro" (navy, 24/28 serif bold) with "Nyeri Town branch · Nyeri, Kenya" (13/16), right block "LEAVE SLIP" (11/14, 0.14em) / "LVE-0031" (24/28 bold navy) / date (13/16); 1 px rule; addressee "Cynthia Wairimu" and "Barista · Nyeri Town" (no title); bold navy heading "Annual leave approved: Monday 26 to Wednesday 28 October 2026" (16/22); three paragraphs and "Yours sincerely,"; signature block at left (script name, 1 px navy line, "Faith Njeri · Branch Manager" 14/18, "Signed with PIN · 9 Oct 2026, 16:05" 12/16) and the QR (76 px) with "Scan to open LVE-0031" at right; footer line "Generated by Wendo RMS · LVE-0031 · Page 1 of 1" left, "Approved by the Branch Manager" right.
- **Template wording** (fixed, filled): "Your request for {type lower}, received on {asked date}, has been approved. You will be on leave for {days} {days}, from {Weekday date} to {Weekday date}, and you return to work on {Weekday date}." Then "Your {type lower} balance was {before} days and is now {after} days. {Leave days are paid at your normal pay. | These days are not paid.} Your department head, {Name}, {head role}, has been told, and your rota will show leave on those days." (no head: "Your department head has been told ..."). Unpaid tail: "{n} annual days and {m} unpaid days." Sick over `sickNoteAfterDays`: "A sick note is needed." Last paragraph: "If your plans change, please tell your Branch Manager before the leave begins, and the days will be returned to your balance." (role of the approver). Counts "1 day" singular.
- **Signing:** only the approver signs, with their PIN (the staff member never signs, design pass 1). When HR approves, the footer reads "Approved by HR" and the signature line "{Name} · HR Manager".
- **Cancelled:** a light diagonal CANCELLED watermark (`addPortraitPage(doc, 'VOID')`), a red-free navy stamp box "CANCELLED", and a line "Cancelled on {date} by {role}. The days were returned to the balance." The number stays valid as a record.
- **QR (L28):** `{FRONTEND_ORIGIN}/verify/lve/{number}?h={first 8 of slip_hash}`. Until segment 6's verify page exists it leads nowhere (already in the roadmap's gap list). The verify page returns `{ kind: 'LEAVE_SLIP', number, valid, status, issuedOn, issuerRole }` and never a name, reason or balance.
- **Document view** in the app: the kit's `PdfViewer` with pinch zoom (`lib/pinch-zoom`), header "‹ LEAVE SLIP · LVE-0031" and "1 / 1", dark `#46423C` canvas (no token, kit value), buttons **Download PDF** (brown) and **Share** (outlined; Web Share API with file, falls back to copying the link; hidden if neither exists).

## 8. Notifications (L30)

Kit `notification-copy.ts` is updated; the old rows with names and "Waiting for you" are replaced. Push and lock-screen text is generic; the in-app Inbox row may carry days. Names appear only in rows seen by a manager.

| Event | Told | Push (lock screen) | Inbox row (after unlock) | Button |
|---|---|---|---|---|
| Leave asked | The routed decider | "A leave request needs you." | "Annual leave, Cynthia Wairimu, Barista: 26 to 28 Oct, 3 days. Barista would have 4 of 6 working." (managers only) | Open Leave |
| Approved | The person; the department head | "Your leave request has an answer." | "Leave approved: 26 to 28 October. Approved by your Branch Manager. Back at work Thu 29 October. 9 days left." Head: "Cynthia Wairimu, Barista, is on leave 26 to 28 Oct." | See my leave slip |
| Declined | The person; the head | same push | "Leave not approved: 26 to 28 October. Declined by your Branch Manager. Reason: too few people that week. Your balance is still 12 days." | See why |
| Moved to HR | The person; HR | "Your leave request moved to HR." / "A leave request needs you." | "No answer in 3 days. HR decides now." / "Annual leave, Lucy Wambui, Service: 2 to 4 Nov. It waited 3 days for the Branch Manager." | Open Leave |
| Cancelled by the person | The decider (and the head if approved) | "A leave request was cancelled." | "{Name}, {Role}, cancelled leave for 26 to 28 Oct." | none |
| Cancelled by a manager | The person; the head | "Your approved leave was cancelled." | "Your Branch Manager cancelled your leave for 26 to 28 October. Reason: {chip}. Your days are back in your balance." | See why |
| Balance adjusted | The person | "Your leave balance changed." | "Annual leave balance changed from 5 to 7 days by HR. Reason: granted by the Director." | none |
| Minimum cover changed | Department head (Rules, built) | n/a | n/a | n/a |
Delivery goes through the shared notifier (`workforceEvents`; the `WorkforceNotifier` only logs until Notifications exist, so Inbox rows are written by the leave service into the existing Inbox table when it ships; until then the build session writes through the notifier and records the gap).

## 9. The three places leave appears for a decider (L1, L31, L35)

1. **The numbered badge on the Leave menu link** (`wf-leave`, badge key `workforce-leave`): `GET /workforce/leave/badge` → `{ count }` per role as in L31, refreshed on focus and every 60 s while visible, announced politely ("Leave: 2 waiting"). The shell shows nothing at 0.
2. **The Leave rows in the Branch Manager's Home "Needs you" card** (card is segment 6's). What this spec expects from it: the card asks `GET /workforce/leave/needs-you?limit=5` and draws one `AttentionRow` per row `{ id, kind: 'LEAVE', title: "Annual leave · Cynthia Wairimu, Barista", line: "Mon 26 to Wed 28 Oct, 3 days · Barista would have 4 of 6", since, tone: 'warning' when tight else 'neutral', href: '/app/workforce/leave?tab=requests&open={id}' }`, oldest first, plus `total`. A row's only action is to open the Leave page; **no Approve or Decline on Home**. The card's leave rows carry the same count as the badge. HR and the Director's Home show the same rows for their routed requests. The label of the section reads "Needs you" (never "Waiting for you").
3. **The Leave page** (`/app/workforce/leave`, steps 10 to 12) is the single place a request is decided, with the rota in front of the manager.
Overtime and clock fixes are **not** leave and are not in this spec (they are decided in Timesheets and the Today board).

## 10. Permissions table and 404 versus 403 (L26, L34)

Capabilities: existing `leave.request` (own), `leave.read` (dept, unit, all), `leave.approve` (unit, all); new `leave.balance_adjust` (HR, all), `leave.slip.read` is covered by `leave.read` scope or own. Heads' `leave.acknowledge` stays unused by the new screens.

| Role | Ask and cancel own | See own | Requests, Calendar, Balances of | Approve or decline | Cancel an approved one | Adjust balance |
|---|---|---|---|---|---|---|
| Staff, Store Attendant | yes | yes | no Leave page | no | own, before it starts | no |
| Department head | yes | yes | no page; told on approval; sees Leave on rota and Today | no | no | no |
| Branch Manager, Store Manager | yes (decided by HR) | yes | own site, read balances | own site, routed to them | own site, reason and PIN | no |
| HR Manager | yes (decided by the Director) | yes | all sites | routed to HR, own-type, moved; own manager's | any not started, reason and PIN | **yes** |
| Director | yes (decided by HR) | yes | all sites, read | Head office staff and HR's own | no | no |
| Accountant | yes (decided by the Director) | yes | no | no | no | no |
| System Admin | no | n/a | all sites, read | fallback only | no | no |
**Refusal rule (as in timesheets):** an application, person or site the caller may not see answers **404** (same body as a missing one); one they may see but may not act on answers **403** with a reason code (`NOT_YOUR_DECISION`, `NOT_WITH_YOU_YET`, `OWN_REQUEST`, `NOT_CANCELLABLE`). Staff asking for another person's application: 404. Every route keeps `authenticate`, `attachWorkforceSubject`, `requireCapability(...)`; no new `requireRole` list. The access matrix test gets one row per cell group.

## 11. Accessibility and keyboard (all screens)

WCAG 2.1 AA. One focus order top to bottom, left to right. Dialogs (`KitDialog`) trap focus, give it to the first field, return it to the opener on Escape, and Enter never signs a PIN (kit `PinField`). Colour is never the only signal: states say a word ("Waiting", "Approved", "Declined", "Clash") and carry an icon or shape; the stepper's current step has a ring and the words "Current step". Bar and card figures have a spoken label ("Annual leave, 12 of 21 days left, 9 taken, 0 booked"). The rota strip is a table with row and column headers; a dashed "Asked for" cell reads "Asked for, not approved yet". The calendar is a grid with `aria-label` "Leave calendar, Barista, 12 October to 1 November" and each bar a labelled button ("Dan Kiprop, leave, 3 days, 27 to 29 October"). Targets 44 px on touch (rows get a full-row target). Live regions: badge changes, the toast and the "left after this" line use `role="status"`; blocked and error states use `role="alert"`. Reduced motion removes the drawer slide and row highlight. Text under 13 px is only the small-caps labels; 11 px legend text keeps `neutral-600` (4.6:1).

## 12. Endpoints (for the back-end session; all under `/workforce/leave`)

| # | Route | Capability | Notes |
|---|---|---|---|
| M1 | `GET /me/overview` | `leave.request` | Cards per entitled type (credited, taken, booked, left, perYear, tone), waiting summary, chips. |
| M2 | `GET /me/applications?year&status&q&type&page&rows` | `leave.request` | Own list. |
| M3 | `GET /applications/:id` | scope | Detail with `steps[]`, counts, `can: { cancel, askAgain, slip }`. |
| M4 | `POST /applications/preview` | `leave.request` | `{ typeCode, start, end }` → `days`, `leftAfter`, `shortfall`, `suggestedTail`, `tight` (boolean only), `errors[]`, `sickNote`. No side effects. |
| M5 | `POST /applications` | `leave.request` | `Idempotency-Key`; `{ typeCode, start, end, unpaidTailDays?, note? }`; 201. |
| M6 | `POST /applications/:id/cancel` | own or `leave.approve` | Person: none. Manager: `{ reasonCode, note?, pin }`. |
| D1 | `GET /requests?site&dept&status&q&page&rows` | `leave.read` | List plus KPIs, scope-limited. |
| D2 | `GET /applications/:id/rota` | `leave.read` | Department strip, per-day cover, usual-or-planned flag. |
| D3 | `POST /applications/:id/approve` | `leave.approve` | `{ pin, expectedVersion }`, `Idempotency-Key`. |
| D4 | `POST /applications/:id/decline` | `leave.approve` | `{ reasonCode, note?, expectedVersion }`. |
| B1 | `GET /balances?site&dept&filter&q&page&rows` | `leave.read` | Rows, KPIs, sites list. |
| B2 | `GET /balances/:employeeId` | `leave.read` | Drawer: every type plus requests. |
| B3 | `POST /balances/adjust/preview`, `POST /balances/adjust` | `leave.balance_adjust` | `{ employeeId, typeCode, add, reasonCode, note?, pin }`. |
| C1 | `GET /calendar?site&dept&from` | `leave.read` | Three weeks. |
| S1 | `GET /applications/:id/slip`, `GET /applications/:id/slip.pdf` | scope | Model for the Document view and the PDF. |
| N1 | `GET /badge`, `GET /needs-you`, `GET /away?from&to` | scope | For the menu, Home and the Today board. |
Errors in plain words are listed per screen. `GET` lists answer `{ rows, total, page, rows }` in the table convention.

## 13. Migration and rollout plan

1. Back-end session: schema and migration (additive; `prisma migrate dev` locally, committed migration beside the schema folder), the leave module, the door in `workforce/index.ts` (`carryOverLegacyLeave`, `assertLegacyLeaveWritable`, `registerLeaveLookup` at start-up), the guard line in `hr-service.ts`, nav `needsAttendance`, the audit actions, capability `leave.balance_adjust` and its matrix test, notification wording. Tests: balance maths (accrual, joiner, leaver, carry-over, opening, adjust), routing table, status machine, double decide, escalation, cover, carry idempotence, guard, 404 versus 403.
2. Front-end session: `frontend/features/workforce/leave/` (sub-modules `mine`, `requests`, `balances`, `calendar`, `slip`, each with a README), routes `app/app/workforce/my-leave/...` and `leave/...` as thin shells, the new shared `CircleStepper` in `_shared` (whichever of Leave or Conduct builds first adds it; Conduct's spec session is assumed to need it too).
3. Switch-on of Nyeri Town follows the attendance switch (already planned): the owner switches the site, the carry runs, the old leave screens stop writing. Rehearsal on a restored copy covers the carry and the guard. Rollback section L5.

## 14. Dependencies on the two parallel specs

- **Conduct spec (segment 5):** assumes `CircleStepper` is one shared kit part, the Document view (`PdfViewer`) is reused for notices, and `Conduct` stays a separate menu link. Leave does not read or write Conduct data.
- **Shared-parts spec (segment 6):** assumes the "Needs you" Home card calls `GET /workforce/leave/needs-you` and the badge calls `GET /workforce/leave/badge` (section 9); the audit log's Area filter lists the `leave.*` actions; the verify page serves `/verify/lve/:number` (section 7); the Inbox accepts the rows in section 8; the card registry's `home/cards/` registers a leave KPI "On leave" and a "Coming up" source from `GET /away`.

## 15. Gap list against what is built

| Built today | Work | Side |
|---|---|---|
| Nav rows `wf-leave`, `wf-my-leave`, `wf-staff-my-leave` are `notBuilt` | Build the pages, set `needsAttendance`, keep `badge: 'workforce-leave'` | FE |
| `registerLeaveLookup` empty; rota warnings and copy-clash return none | Register the real lookup | BE |
| Attendance board `onLeave: { count: 0, available: false }` | Fill from the lookup | BE |
| Timesheets `leaveDays: 0` in `people-rows.ts` | Read approved days | BE |
| Snapshot and payroll inputs have `leaveDays` only | Add paid and unpaid leave days; unpaid → `UNPAID_ABSENCE` | BE |
| `notification-copy.ts` leave rows use names, balances and "Waiting for you" | Replace with section 8 | FE |
| `card-registry` has no leave card source | Segment 6 | FE |
| Old leave screens at `/app/hr/leave`, `/app/hr/my-leave`, `hr/staff/[userId]/LeaveTab.tsx` | Stay for sites not switched; hide for switched sites | FE |
| People file has no Leave tab | Not in Paper; out of scope | none |
| Rules Leave tab built (segment 1) | Read only: the Leave page links "Where leave is defined" to `/app/workforce/rules?tab=leave` for HR; the numbers come from the same version store | none |
| No retroactive leave | L32 | later |
| No sick-note upload | The slip says a note is needed; nothing is stored | later |

## 16. Paper inconsistencies (recorded, Paper not edited)

1. **Step 9 is stale** (owner, 20 Oct): it still draws the Waiting for you page, which design pass 4 removed. Not built; its useful content (the leave summary and "Review with the rota") moves to the Needs you row (section 9). Its chip "Waiting for you · 1" on step 10 should read "Needs you · 1".
2. On-screen step labels in Chapter 10 run 01, 01, 02, 03, 04, 06, 07, 08 for the brief's steps 1 to 8 (no 05, two 01). Content is right; labels are not.
3. Step 15 (Adjust a balance) has **no PIN**, step 12 (Decline) has none: this spec adds a PIN to adjust (L25) and keeps decline without (L24).
4. Cynthia has 12 of 21 annual days left on 9 Oct, which is "all at the start" arithmetic, while Rules and step 14 say Annual builds up 1.75 a month (L8).
5. Step 17 uses "Ms Cynthia Wairimu" and step 6's notice "Mr Mark Njoroge": titles guess gender (L29).
6. Slip numbers are out of order: LVE-0021 approved 27 Jul 15:40 but LVE-0019 approved 28 Jul 09:30 (step 13). The sequence is monotonic in production.
7. Steps 2, 8 (phone headers "Cynthia Wairimu", "Joy Chebet") and the KPI lines on step 10 use bare names; steps 11, 12 and 15 name people in the "who is told" line. The build uses the person's name plus role on records and tables, and the role alone in sentences.
8. Step 18: the Pastry row shows an unlocked Change for HR (already logged in the Rules spec); step 20's left panel label reads "SET BY HR" while step 18 reads "CHANGED BY HR". Step 19 says "The Director and the 4 Branch Managers are told" while the Rules spec tells Branch Managers and HR for the leave tab.
9. The request chip is "Family" while the card and type are "Family emergency". Build with the full type label.
10. Step 1's menu lists "Hours this week, My shifts, Overtime, My requests" under My time while the nav table has Hours this month, My rota, My requests (not this segment's).
11. Step 16 amber counts on Sat 17 (3 of 4) and Sun 18 (1) show cover below the minimum yet the clash line mentions only 27 and 28 October: build lists every tight day in the callout.
12. Step 13 draws the Branch Manager's own leave with the detail panel "Approved by Mercy Achieng" (a bare name); build "Approved by Mercy Achieng, HR Manager".
