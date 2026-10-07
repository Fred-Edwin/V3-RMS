# prep / record (front end)

**Design:** approved (Paper *Inventory · Prep*: steps 1-8, 35-41) · **Code:** built (Prep rebuild, Slice 2). Back end: `backend/src/modules/inventory/prep/record/README.md`.

## What it does
Record a prep run. One screen for every width, `RecordRunScreen` at `/app/inventory/prep/new?item=<id>` (no `item` opens the "What did you make?" picker):
- **Phone (390):** dark task header (no status bar, no bottom tabs), the form, "Review and confirm", the confirm sheet (`ConfirmSheet`), then "Recorded".
- **Tablet (768+) and computer (1024+):** the form and the live "This run" panel (`RunSummaryPanel`) side by side; Confirm sits in the panel. The computer uses the shell top bar with Cancel.
- **Manager (Store Manager, System Admin):** `ManagerRunDrawer` on the Runs home: same form body, "In stock now" under each ingredient and the input cost and cost per unit (only when the server sends them).

## Rules it follows
- Live check (`POST /runs/check`) is debounced and never blocks; a failure only hides the guide. Typo and repeat warnings never block; a repeat asks "Record it again?" first.
- The form makes one idempotency key when it opens, so a double tap on Confirm records one run.
- Steppers step 0.5 for kg and litres, 1 for portions and pieces, and tap-to-type (`PrepStepper`, `_shared/lib/prep-format.ts`).
- The Attendant sees no costs, no flags and no expected stock: none are sent, and nothing here asks for them.

## Code map
`components/` (screen, form body, confirm sheet, recorded, pickers, reason chips, manager drawer, header), `hooks/use-record-form.ts`. Shared pieces are in `../_shared/`.

## Tests
`_shared/lib/prep-format.test.ts` (stepper arithmetic, typing, Nairobi day wording). There is no component-test library in this repo (`@testing-library` is not installed), so screen states (loading, empty, error, locked, warnings) were checked in the browser, not in unit tests. Adding the library is a decision for the owner.
