# Final pass, section 2: Schedule. Decisions (step 3, Decide)

Written 24 Oct 2026 by the orchestrator from `2-schedule-change-log.md` (W1 to W65, D1 to D21, P1 to P4) and the owner's watch. **Everything is pre-filled with a recommendation. Change only what you disagree with.** Once the owner has answered, this file is final for section 2 (a new idea goes to a later section).

## The shape of the work
Schedule has grown from polish into three pieces of product work. We build them as three deliveries, in parallel where the files do not overlap. **Nothing ships until the whole feature ships** (owner, 24 Oct).

| Delivery | What | Who builds | Needs a Paper design? |
|---|---|---|---|
| **S1: quick fixes** | Naming sweep ("Shifts"), copy, timings in the grid cells, optional reason, dialogs, gates, refusal text, loading and error states, small numbers that disagree, the switch screen polish, the purpose-line mechanism | Lane 2, one lean session | No |
| **S2: the shift-end and overtime flow, back end** | Overtime requests before the end, the clock-out at the scheduled end, hand-over, "Needs an owner" and "Unaccounted" (30 minutes, never a deduction), lateness decisions, the fast planner's saved patterns and bulk apply, notifications, access, audit, tests on the clean database | Lane 4, back end first | No (the rules are agreed in the change log, sections B and C) |
| **S3: the screens for S2, the Homes and the Time tab** | The head and staff Homes with the compact clock card and "This week"; the shift-end phone flow; the head's approval and "Needs an owner" list; the lists for the Branch Manager, Director and Accountant; lateness actions; the planner with past and today styling; HR, Director and System Admin attendance cards; the employee file's Time tab | Lane 3 designs in Paper (three groups, you approve each), then lanes 2 and 4 build | Yes |

Order: S1 and S2 start now in parallel with the first design group. S3 builds after each design group is approved. The Timesheets side of overtime evidence and late minutes is built in **section 3**, which then reads the same records.

## Answers (owner, 24 Oct 2026)
Q1, Q2, Q3 and Q5 are decided as shown below. Q4, Q6 and Q7 stand as recommended unless the owner says otherwise. The plan and the order of work are in `2-schedule-plan.md` (approved 24 Oct): verticals V0 to V5, each in one lane from design to front end; designs one at a time; every design agent starts by reading the approved designs.

## Questions for the owner (the only ones that need your thinking)
| Q | Question | My recommendation |
|---|---|---|
| Q1 | **Scope of P3 (the fast planner).** | **DECIDED by the owner, 24 Oct: build everything, leave no gaps** (palette, row and column actions, saved week patterns per branch with a preview, apply to a week or a month, ten-minute undo, the month grid view and "fill the gaps"). |
| Q2 | **Scope of P1 (lateness actions).** | **DECIDED by the owner, 24 Oct: yes, as proposed, and "Mark absent today" and "Wait" are kept and built** (with a back end), in vertical V3. |
| Q3 | **W11: what the shift-end flow reads.** | **DECIDED by the owner, 24 Oct: read from Orders only** (unpaid tables and the kitchen and bar tickets of orders). Inventory prep and store dispatches are not included for now, so the store attendant's flow has no open items yet. Read only: the flow never changes Orders, so live service is not touched. The value of an unpaid table is the order total in Orders. |
| Q4 | **W60: what the System Admin does in Schedule.** | **Keep the menu and page gate as designed:** the admin acts as a user to plan or read shifts. The access table stays full as a safety net. |
| Q5 | **W65: does the Accountant read timesheets from the menu?** | **DECIDED by the owner, 24 Oct: yes.** Built in section 3 (a Time group with Timesheets and a site chooser). Not built here. |
| Q6 | **W36: may a head clock themselves in for someone else's convenience?** Heads clock others in (decided). | **No.** A head's own clock is their phone; a mistake is fixed through Fix time. |
| Q7 | **W56: the Central Store in the branch chooser.** | **Hide it** wherever the site has no shifts (Shifts, Today board). |

## Every item, where it goes
S1 = quick fixes. S2 = back end. S3 = design then build. **3** = section 3. **9** = section 9. **later** = after the pilot chain.

| Items | Short title | Decision | Where |
|---|---|---|---|
| W12, W21 | "Start from last week" wording | Fix | S1 |
| W14, D17 | Cells show timings, name in tooltip and legend | Fix | S1 |
| W15, D18 | Reason optional on shift edit (leave override stays required) | Fix | S1 |
| W20 | "Rota" becomes "Shifts" everywhere (menu, refusal text, print, notices) | Fix | S1 |
| W22, W27, W28, W29, W30, W31, W32, W33, W34 | Board and grid wording and small fixes; empty week "Not started"; shift colours; print says "Leave"; the board bell | Fix | S1 |
| W23, W51 | Person label everywhere; company roles open on the first branch; a name is never cut | Fix | S1 |
| W24, W62 | Home "Needs you" and Latest show only what concerns the role, and name the person | Fix | S1 |
| W25 | Edit time dialog order and styling; no old overtime sentence | Fix | S1 |
| W35 | Duplicate React key console error | Fix | S1 |
| W37, W39, W47, W40 | Head pages titled for the department; phone Shifts view; "Not available" text names the right roles | Fix | S1 |
| W38 | One definition of "on shift" everywhere | Fix | S1 |
| W42, W43, W44, W45 (copy part) | Leave balance not a dash; drawer closes; "My shifts"; "Not planned yet"; a no-shift-today card | Fix | S1 (card layout in S3) |
| W53, W61 | Switch screen title, dates, hide the hub, the admin's PIN to switch, plain words | Fix | S1 |
| W57, W59 | The Director may open the attendance switch; route gate and menu follow the access table, with a test | Fix | S1 |
| W63, W64 | One refusal pattern; a failed request never leaves "Still loading" | Fix | S1 |
| W36 | A head clocks someone in for their department | Fix (Q6: not themselves) | S1 |
| W48, W49, D21 | The purpose line on every page: the mechanism and copy file in S1, the rule in `UI_BUILD_RULES.md`; Schedule's lines written with the redesigned screens | Fix | S1 and S3 |
| W56 | Hide the Central Store where there are no shifts | Fix (Q7) | S1 |
| W10, W16, D7 to D16, D19 | The shift-end flow, overtime before the end, hand-over, "Needs an owner", "Unaccounted", notifications, access and audit; retire the "closed by the phone" notice | Fix | S2 |
| W11 | Open items read from Orders only (unpaid tables, kitchen and bar tickets) | Fix, read only (Q3) | V4 |
| P1 (back end) | Lateness decisions, make-up time, the carry-through to the month | Fix (Q2) | S2, then 3 |
| P3 (back end) | Saved patterns, bulk apply with a preview, undo | Fix (Q1) | S2 |
| W1, W2, W3, W4, W41, W45, W50 | Head, staff, HR, Director and System Admin Homes; compact clock card; "This week" | Fix | S3 |
| W5, W6, W7, W8 | The shift-end phone flow; the head's approval and "Needs an owner" list; hand-over received; the lists for the Branch Manager, Director and Accountant | Fix | S3 |
| W17, W26, W52, P1 (screens) | Lateness actions on the board and the timesheet; flag an early clock-out; one "late" number everywhere | Fix | S3, then 3 |
| W18, P2 | Today and past columns on the Shifts grid | Fix | S3 |
| W19, P3 (screens) | The fast planner screens, **everything** including the month grid and "fill the gaps" (Q1) | Fix | V2 |
| W54 | The employee file's Time and Leave tabs show real data | Fix (Time now; Leave data with section 7) | S3 and 7 |
| W9 | Overtime evidence on the timesheet | Fix | 3 |
| W65 | The Accountant reads timesheets from the menu | Fix (Q5) | 3 |
| W26 (timesheet part) | The "To decide" late items on the timesheet | Fix | 3 |
| W46 | The phone sign-in skips the PIN step after "Trust this device" | Defer (a security question) | 9 |
| W55 | "Home" on top and "Workforce / Overview" both open the same page | Leave (approved design) | none |
| W58 | Route the "closed by the system" item to the right owner | Retired by D19 | none |
| W13 | Tests and docs for both modules | Fix | each delivery's close-out |
| G2 / M9 | **Keep and build** "Mark absent today" (leave, sick, unpaid or no reason) and "Wait, they have told me" (owner, 24 Oct, reverses the removal idea) | Fix | V3 |
| G1, G3 | One fix path for the three "wrong time" cases; one line per open item | Fix | S3 |
| G4 | Remove the per-branch switch and the old-clock bridge once every branch is live | Later | after the rollout |

## Carried
Eight stale database tests to flip are listed in `SECTION_FLOW.md`; this section adds none.
