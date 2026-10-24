# Workforce · People (slice 1a front end)

Hire (Paper Chapter 2), the Employees list and the employee file (Chapter 4), and the person's own file, on the real API in `backend/src/modules/workforce/people/`. Status: **built, awaiting owner review** (17 Oct 2026, branch `feat/workforce-1a-frontend`, nothing pushed). Decisions made without the owner: `docs/features/workforce/decisions-1a-frontend.md`.

## Sub-modules

| Folder | What the user does there |
|---|---|
| `employees/` | The Employees list: four numbers, search, filters, the pending pay changes panel for approvers |
| `hire/` | The Add employee wizard (five steps, the casual's three), drafts, duplicate check, sign-in email suggestions |
| `file/` | The employee file: header, tabs (Overview in four variants, Job and pay, Documents, Activity), every dialog |
| `mine/` | My file (`/app/workforce/my-file`): still to finish, own job, own IDs and bank in clear |
| `_shared/` | Types, services (`people-reads.ts`, `people-writes.ts`), remote hooks, date words, the Home-card derivations, the people frame |

Public face: `index.ts` (screens and the hooks the Home cards use). Route shells: `app/app/workforce/employees/{page,new/page,[id]/page}.tsx`, `app/app/workforce/my-file/page.tsx`.

## Rules the screens follow

- Every button comes from `file.actions` (the server's answer for this viewer) or `usePermissions`-style capability names; no role name is read anywhere.
- A refusal from the server (`FIELD_NOT_ALLOWED`, `SELF_APPROVAL`, `FILE_LOCKED_FOR_EDIT`) is shown in the dialog in the server's words.
- Opening pay or a document, and revealing an ID or bank number, are audited by the server, so the screen asks only when the person presses a button or opens the tab.
- Dates are Nairobi calendar strings; the words come from `_shared/lib/people-dates.ts`. Copy uses the first name or "they", never a guessed pronoun.
- Pay shows "starts <date>" while the only approved amount has not reached its start day.

## Endpoints used

R1 list, R2 summary, R3 lookups, R4 duplicate-check, R6 me, R7 file, R8 pay (tab opens), R9 documents, R10 open a document, R11 pay changes; W1 to W4 drafts, W5 hire, W6 edit, W7 patch me, W8 photo, W9 pay profile, W10 pay change, W11 decision, W12 contract, W13 probation decision, W14 probation note, W15/W16 transfer (preview and save), W17 loan, W19 to W22 exit (preview, save, undo), W23 rehire, W24 login, W25 ask and remind, W26 verify statutory, W27 upload, W28 reveal. W18 (cancel or end a move) and the exit checklist PATCH have services but no screen yet (see gaps).

## Parity manifest

| Paper | Screen or dialog | State |
|---|---|---|
| Ch 4 R1, R2 | Employees list and numbers | built, checked at 1440 |
| Ch 2 steps 1 to 5, `SMV-0` | Hire wizard, casual three | built, checked at 1440 and 390 |
| `RE8-0`/`SBM-0` | Onboarding overview, "Hired" line | built |
| `Y8C-0` | HR overview (ring, probation, next steps, life band) | built, checked |
| `ZTB-0` | Branch Manager overview | built, checked at 1440 against Paper |
| `12L6-0` | Exited overview, banner with Undo | built |
| `YKO-0` | Job and pay | built, checked at 1440 |
| `YW5-0` | Documents | built (open a file, missing contract, asked details); signing is slice 4 |
| `Z7M-0` | Activity | built from the file's own timeline; full trail waits for the Audit log |
| `13F3-0` | Change pay | built, checked |
| `13F3-0`/Director | Approve or decline (no PIN: the API takes none) | built, run end to end |
| `136W-0` | Edit job | built |
| `11OV-0` | Decide probation, note | built, checked, extension run end to end |
| `ZJ7-0`, `127P-0` | Move: transfer and exit with preview | built, run end to end |
| `11YA-0` | Send to another site | built |
| `13NA-0` | Contract (record only) | built |
| `13VM-0` | Upload a document | built |
| `12UL-0`, `SJY-0` | My file, emergency contact, numbers, photo | built as dialogs on one page |
| Ch 1 | Home cards: Onboarding, No contract yet, Finish hiring, Probation ends, People by branch, Coming up, Company headcount | data wired |

## Finish-up checks (17 Oct 2026)

Run in the browser against the real API (lane ports 3101 / 4101).

| Check | Result |
|---|---|
| Branch Manager's hire, typed in the wizard (two steps: Who, Job) | Hired; the file shows pay and ID as "Locked for your role". `?draft=` reopened the saved name, phone and ID. HR's Home moved: Nyeri Town 3 to 4, No contract yet 13 to 14, 14 active. The duplicate-ID check refused a taken ID and cleared on a free one. |
| Accountant | Pay open, all 14 people, no Add employee, no action buttons. |
| Store Manager | Own site only (7), Add employee shown, no Job and pay or Documents tab, pay and ID locked. |
| Department head | The route gate keeps heads and floor staff off the desktop screens until their own screens are drawn (Chapter 1 decision); the API shows a head only their department (2). My file works. |
| Staff login (store attendant) | Employees bounces to their own landing; My file shows only their own job and IDs; emergency contact and numbers saved by keyboard. |
| Keyboard and names | 17 dialogs reached by key or script: 11 audited one by one for name, labelled fields, focus in, Esc and focus back. The other six (note, verify, login, photo, director decision, rehire) use the same kit dialog and were accepted by the owner on the Paper design on 17 Oct 2026 without a separate walk; they are covered by the shared kit behaviour and the pure form tests. Enter in a field does not submit by design (kit rule). |
| Paper pass at 1440 | Overview, Edit job, Contract, Send to site, Exit, Change pay, Move compared. Left as built, on purpose: Paper's exit checklist items for final pay and leave (need Payroll and Leave), the contract signing cells (slice 4), Employment as a picker in Edit job (API does not change it here), "she/her" copy. |

Found and fixed: picker had no arrow keys and lost focus on close; draft autosave fired a 404 after a hire; "Finish the file" and the ID chip were offered to roles the server refuses; My file showed two top bars to logins with no Workforce menu; focus fell to the page after a saved own-file dialog; completeness and probation cards were taller than Paper; contract dialog lacked Paper's card; Send to site lacked From and Until; dialog date labels were mono caps instead of Paper's plain labels.

## Built beyond Paper (undrawn, built in the same style)

| Item | Why |
|---|---|
| "IDs and bank" panel on Job and pay with Show/Hide | The brief asks for masked numbers with the audited reveal; Paper draws the mask only on one artboard |
| Pending pay changes panel on Employees | R11 needs a place; Paper draws none |
| "Review" banner for a waiting pay change on Job and pay | So the person who asked sees it is waiting |
| "Undo exit" button on the Overview of someone on notice | After the 30-second toast the undo would otherwise be lost until the last day passes |
| Loading, error, no-access and "not on your list" states | States kit |
| Details, bank, verify, ask/remind, photo, rehire, undo-exit dialogs | Named in the brief; Paper draws a button but not the form |
| Tab Leave drawn disabled with a "comes with a later slice" line | Paper draws the tab, the slice comes later. **Time** is live (24 Oct 2026, Schedule V1): `attendance/time-tab/`, offered only with `timesheet.read`; the Overview shows its three tiles for the same viewers |
| Empty pay history line | First-pay state |
| My file as one page with dialogs, not a full phone screen per form | See decision 17 |

## Gaps found in the back end

1. No audit read by person (Activity shows the file's own timeline).
2. No "ask HR to change something" endpoint (the Branch Manager button is hidden).
3. Photo upload needs the file id, so a photo chosen in the wizard uploads after the hire.
4. Employment type is not editable by PATCH (shown read-only).
5. Fixed here (`fix(workforce-people):`): a file-request next step now carries what was asked and when (`fileRequestKind`, `fileRequestAskedOn`).

## People batch 2B (22 Oct 2026, final pass)

Built to Paper frames 7.1 to 7.5, 8.1 to 8.6, 9.1 to 9.5 and 12.1, then walked in a browser as HR, Director, Accountant, Branch Manager, a head and staff.

- **Edit convention:** amber underlined `PanelLink` where the role may change a card, a pale grey pill tag (`PanelReadOnlyTag`, 12 px words) where it may only read. Cards use one shell (`titled-panel.tsx`: 52 px header, 20 px sides) and one row grid (`tabs/job-card-rows.tsx`: 150 px label column, values left, 48 px rows, 56 px with a second line). The Job card has six rows (`lib/job-card-rows.ts`).
- **Dialogs:** Edit IDs and bank (`ids-bank-dialog.tsx`; the Accountant's is bank only), Edit pay, the Director's review (Now, New, Difference tiles).
- **Person label:** `PersonLabel` and `PersonLabelLine` in the kit, used in Assign head, Reports to (hire form and Edit job) and the employee list; `Choice.render` lets a dialog picker draw it.
- **My file** (`mine/`, frames 13.3 to 13.7 and 13.14, built 23 Oct 2026): plain identity header (`own-header.tsx`, 72 px avatar, progress at the right), then two columns of 560 px on a desktop (Still to finish, Your job, Sign-in and alerts | IDs and bank with the blue note, Your contact) or one column on a phone. A desktop gets centred dialogs for the numbers (560) and the photo (`photo/components/photo-dialogs.tsx`: 480, 520, 480); a phone gets full pages (`own-numbers-page.tsx`, `photo/components/photo-pages.tsx`). Both photo layouts share `photo/hooks/use-photo-flow.ts`. **Sign-in and alerts** (`account/`): sign-in email, Password (Change opens `password-dialog.tsx`, the old Profile endpoint), Notifications (the browser permission, Turn on), and Sign out everywhere (`SignOutEverywhereDialog` from `features/workforce/security`: the same server step as "This wasn't me"). Profile and My phones are gone.
- **Head:** the report is a full page on a phone and a dialog on a desktop (`probation-report-screen.tsx`); My team is a list on a phone and a table on a desktop (`team/`). Routes: `/app/workforce/probation/[id]/report` and `/app/workforce/team`.
- **Phone inputs:** digits-only numbers (National ID, account, phone) use the in-app pad (`DialogDigits`, `NumberField`); KRA PIN, NSSF, SHA and HELB keep the phone keyboard because they can hold letters.
- **Shared files touched:** `components/app/shell/nav-table.ts` (two prefixes in `SELF_FRAMED_PREFIXES`), `lib/route-access.ts` (one block), `components/ui2/picker.tsx` (`render`), the kit `_shared/index.ts`, `person-radio-list.tsx` and `hooks/use-action.ts` (`reference`), `workforce-access.ts` and its matrix test.
- **Not built:** the "Deductions and rules" card of frame 7.1; the stacked Pay layout of 7.1 (the build keeps Job and IDs on the left, Pay on the right, as 12.1 draws it).

## Size checks (17 Oct 2026)

Largest files: `_shared/types/people-types.ts` 253 (types), `file/lib/file-model.ts` 224, `dialogs/dialog-fields.tsx` 201. No file over 350. Busiest folders: `file/components/dialogs/` 12, `file/lib/` 10, `file/components/tabs/` 10. None over 12.

## Tests

Pure files carry the tests (`lib/` and `lib/tests/`): file model, rows, timeline, dialog forms, moves, uploads, own file, home numbers, services. There is no DOM test library, so behaviour was checked in the browser with the real API on the lane database.
