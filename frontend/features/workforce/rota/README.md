# Workforce · Rota (slice 2, front end)

Chapter 5 of the approved Paper designs ("Build the rota", steps 1 to 10), on the real API in `backend/src/modules/workforce/rota/` (see its README for the endpoints and who sees what). **Status: built, awaiting the owner's review** (18 Oct 2026, branch `feat/workforce-2-rota-frontend`, nothing pushed). Choices made without the owner: [decisions-2-rota-frontend.md](../../../../docs/features/workforce/decisions-2-rota-frontend.md).

**There is no publish step.** Every edit is sent at once, is live, and is one audited write; the server tells staff once, about five minutes after the last change. The top bar shows "Saved just now" (or the failure in words). The only questions an edit can ask are the ones the server asks: a reason for today or tomorrow, and an override reason for a shift on an approved-leave day.

## Sub-modules

| Folder | What the user does there |
|---|---|
| `grid/` | The Rota page: department or site list, four numbers, the week grid (picker, drag-fill, letter keys, Delete, arrows), warnings, "Copy day" |
| `dialogs/` | Start from last week (preview, then copy), the reason for a near-term change, the leave override, Copy day |
| `templates/` | Shift templates: list with chips and search, add and edit a shift, retire and restore |
| `phone/` | The day-at-a-time view for a department head (and anyone on a phone) |
| `print/` | The printed rota: one landscape A4 page from the print data |
| `_shared/` | Types, one service per endpoint, the data hooks, the editor hook (autosave), pure helpers (dates, shift look, week view, edits, words) |

Public face: `index.ts`. Route shells: `app/app/workforce/schedule/{rota,rota/print,templates}/page.tsx`. Home card: `home/cards/rota-data.ts` feeds the phone "This week" card with planned hours from `GET /workforce/rota/mine`. Navigation: the Schedule rows exist in `nav-table.ts` and are hidden for every role behind `SHOW_SCHEDULE_LINKS = false` until Attendance (slice 3) moves the clock onto the new rota; the pages open by address.

## Rules the screens follow

- A button shows only when the server's answer allows it (`week.can.write`, `can.writeTemplates`, `scopeOf`); no role name is read anywhere.
- Past days are read-only. A refusal from the server (`PAST_DAY_READ_ONLY`, `TEMPLATE_IN_USE`, a taken name or letter) is shown in the server's words, in the dialog or the top bar.
- Warnings never block: an amber cell, an amber note under a name, "3 thin" in the footer, and a "Needs a look" list.
- All dates are Nairobi calendar strings; all date words come from `_shared/lib/rota-dates.ts`. Copy says the first name or "they".
- The printed page carries no pay and says who printed it; it is not a signed act. A signature shows only the first and second name.

## Endpoints used

T1 to T5 (templates: list, create, edit, retire, restore); G1 week; G2 print; G3 mine; G4 cells; G5 fill (drag-fill); G6 copy preview; G7 copy. The standing-pattern endpoint (`POST /rota/pattern`) has no service and no screen here: Chapter 5 removed the button.

## Parity manifest

"By eye" = the built screen at 1440 (or 390) in the browser next to Paper's `get_screenshot` for the step. "By values" = built from the kit, which carries its own Paper values. No pixel-diff tool was used.

| Paper step | Screen | State |
|---|---|---|
| 01 Week grid | Rota page, Branch Manager | by eye at 1440: header, stepper, legend, four numbers, department list, grid, footer, note all match; the table width is Paper's 794 |
| 02 Set one shift | Cell picker | by eye: shifts with hours and letter, Day off with Delete, footer note and "Edit shifts →"; "Another time" left out (decision 5) |
| 03 Start from last week | Preview dialog | by eye: three boxes (sans labels, amber third), clash list, note, Cancel and brown button |
| 04 Leave warning | Leave override dialog | by values (the lane has no leave data until slice 5); same kit pieces as step 5 |
| 05 Near-term reason | Reason dialog | by eye: summary rows with "is told", three reason chips plus Other, "Save and tell N people" |
| 06 Shift templates | List page | by eye: three-number strip, chips with counts, table, retired row, note |
| 07 Add a shift | Add and edit dialog | by eye: name and times, break chips with paid hours, colour swatches (label added), who can use it, departments, footer note |
| 08 HR's rota | Sites list and department filter | by eye at 1440 |
| 09 Department head, phone | Day-at-a-time view | by eye at 390: day strip, person rows with "Pick shift", shift sheet, footer; the shell's compact bar sits above Paper's own header |
| 10 Printed rota | Landscape A4 | by eye: navy bar, header, key, department groups, signature, QR, footer |

## Built beyond Paper (undrawn, built in the same style)

| Item | Why |
|---|---|
| "Needs a look" list under the grid | Colour alone does not say why a cell is amber |
| "Print" link in the top bar | Step 10 needs a way in |
| "Copy day" dialog | Paper draws the button only |
| "Retire this shift" in the edit dialog | The API has it; Paper draws Edit and Restore |
| Reason chips in the edit dialog after the server asks | Needed when a time change moves a shift for today or tomorrow |
| Loading, error and no-access states, the "No one is on this rota yet" state | The States kit |
| Add shift in the page header below 1024 px | The compact bar has no action slot |
| Hover, pressed, focus, disabled | The kit's rules; letters, Delete and arrow keys on the grid |

## Tests

Pure helpers (dates, shift look, week view, edits and gates, side list, shift form, template rows, my-week, grid keys, signature name), the nav table switch, and the route gate. The run end to end was done in the browser on the lane database (Branch Manager, HR, Accountant) and checked against the audit table.
