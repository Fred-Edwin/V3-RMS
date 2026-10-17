# Workforce 1a front end: handoff (17 Oct 2026)

Working document. Delete it when Workforce ships. It continues `docs/sessions/workforce-1a-frontend.md` (the brief, below its divider line, still governs: finish everything, decide and log, size limits, per-screen loop, no subagents, **nothing pushed**). Read the brief first, then this.

## State at the handoff

Branch `feat/workforce-1a-frontend`, lane worktree `/home/fred/Projects/V3-RMS-lanes/lane-1`. Five commits after the brief: types and services, Employees list, hire wizard, suggested sign-in emails, file model plus Overview blocks. At the handoff `tsc`, `pnpm lint` and the whole suite (98 files, 1079 tests) pass. Nothing is pushed.

**Built and checked in the browser against Paper:** Employees list (`/app/workforce/employees`), hire wizard (`/app/workforce/employees/new`, steps 1 to 5 and the casual three). After the last commit the hire form's selects became the app `Picker` and its number boxes `PadNumberInput` (the project's input-convention tests required it): **look at the hire wizard once in the browser again**, at 1440 and 390, to confirm the 40 px fields still match Paper.

**Written, not yet on a page:** `people/file/lib/file-model.ts` (tabs, header tags, ring chips, probation card, next-step rows, `finishTarget`, `pageActions`), `file-timeline.ts`, `hooks/use-file-action.ts`, `components/file-header.tsx`, `components/tabs/overview-parts.tsx` (ring card, probation panel, next steps, life band). Both libs are tested.

Decisions are in `docs/features/workforce/decisions-1a-frontend.md` (rows 1 to 15). Append there; open the final message with that table.

## Environment (lane)

- Front end: `cd frontend && pnpm exec next dev -p 3101`, opened as `http://lane1.localhost:3101` (the API URL in `.env` is `http://lane1.localhost:4101/api/v1`; `localhost` will not work for the browser). API: `cd backend && pnpm exec tsx watch src/server.ts` on 4101. Both may already be running (check `ss -ltnp | grep -E '3101|4101'`); if the API was started before a backend change, restart it. **Never `pkill -f` with a pattern that matches your own command line** (it killed the shell once); use the pid.
- Lane database `wendo_rms_lane1` (localhost:5433): the People migration was **applied by the first session** (it was missing), which backfilled 12 employees, none with a head or reports-to. Logins, password `password123`: `hr@wendo.test` (HR Manager, **created by the first session in the lane database only**), `director@wendo.test`, `bm.town@wendo.test`, `bm.highway@wendo.test`, `accountant@wendo.test`, `store.manager@wendo.test`, `barista.head.town@wendo.test` (a department head, floor staff). Login is rate-limited (10 a minute).
- Browser: chrome-devtools MCP. The window is narrow by default: call `emulate` with `viewport: 1440x900x1` (and `390x844x2,mobile,touch` for phone). Filling React inputs: `fill` works; for selects and pickers script with the native value setter. Snapshots are long; prefer `evaluate_script` and screenshots.
- Postgres MCP is read-only; use `psql "$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2-)"` for lane-database writes (lane only).
- Edit and Write tools only (no scripts that write files), one `Why:` line before each; no task-list tool exists in this setup, so post a numbered list in messages.

## Facts learned the hard way

- Responses use the wire names (`organization`, `organizationId`, `organizationName`, `organizations`); requests may use `siteId`. Types already say so.
- The frontend compiles below ES2020: **no BigInt literals**.
- `lib/input-conventions.test.ts`: no native `<select>`/`<datalist>` (use `components/ui2/picker`), no raw numeric input (use `PadNumberInput` from `ui2/quantity-field`; `keepZeros` for IDs and account numbers), and every `<input>`/`<textarea>` sets `autoComplete`. `apiClient` sends JSON only, so uploads use `people-writes.ts`'s own `fetch`.
- No DOM test library: put logic in pure `lib/` files and test those; check behaviour in the browser.
- `ui2/data-table` takes `className="border-0 bg-transparent"` for Paper's naked table. The Workforce kit's `FormField` is the dialog form; the wizard has `hire-field.tsx`.
- Shared files moved this session: `useWorkforcePermissions`, capability names, `useWorkforceNavDrawer` now live in `features/workforce/_shared`.
- Paper uses "she/her"; write copy with the first name or "they". Never guess pronouns.
- Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · A. The people" (`p-A-0`). Chapter 2 steps: `QX1-0 R5O-0 RE8-0 RMY-0 RV0-0 S3F-0 SBM-0 SJY-0` (file after hire, phone welcome flow), `SMV-0` (casual pay). Chapter 4 steps: `Y8C-0` (HR overview), `YKO-0` (Job and pay), `YW5-0` (Documents), `Z7M-0` (Activity), `ZJ7-0` (Transfer dialog), `ZTB-0` (Branch Manager overview), `11OV-0` (probation dialog), `11YA-0` (send to another site), `127P-0` (exit dialog), `12L6-0` (exited file with Undo), `136W-0` (edit job), `13F3-0` (change pay), `13NA-0` (contract), `13VM-0` (upload), `12UL-0` (phone emergency contact). Read each live (`get_jsx` inline styles, `get_computed_styles`) as the loop says.

## What is left (everything in the brief's scope)

1. **File screen** (`/app/workforce/employees/[id]`, thin page; `people/file/components/file-screen.tsx`, ≤250 lines, split tabs into `components/tabs/`, dialogs into `components/dialogs/`). Frame: reuse `people/_shared/components/people-frame.tsx` (top bar actions from `pageActions(file, tab)`); `FileHeader`; `UnderlineTabs` from `tabsFor(file)` (Time, Leave, Conduct are drawn disabled: later slices). `useEmployeeFile(id)` from `_shared/hooks/use-people-data.ts`; `useFileAction(reload)` for every write (the server's refusal, including `FIELD_NOT_ALLOWED` and `SELF_APPROVAL`, shows as a message in the dialog).
   - Overview variants: HR (ring card + probation panel, next steps, life band), onboarding (checklist from `completeness.checklist` with the ring, "Job and leave" key-values; `?hired=1` adds the green "Hired…" banner), Branch Manager (KPI strip: With Wendo via `withWendo`, probation days left; "For you to do" with "Write a note"; "About {first}" with locked rows "Locked for your role"), exited (banner with "Undo exit · N days left", "The exit" rows, "If they come back later" with Rehire after the undo window).
   - **Job and pay tab** (`useEmployeePay`, audited: fetch only when the tab opens): Job panel with Edit, Pay panel (amount "KES 28,000 / month", **an amount whose start date is after today reads "starts <date>"**; the pending change shows with Approve/Decline for whoever has `payprofile.approve`), Pay history table.
   - **Documents tab** (R9 plus a missing-contract row and open file requests), opening a document calls R10 and opens its `url`. **Activity tab:** the API has no audit read yet, so show the file's timeline and say the full trail arrives with the Audit log (log as gap).
   - Masked numbers with **audited reveal** (W28): "Show" calls `reveal`, shows the clear value for 30 s, "Hide".
2. **Dialogs** (kit `KitDialog`, `ChangeDialog`, `ChangeSummary`, `DialogButton size="lg"`, `ReasonChips`, `SingleDateField`, `UndoToast`): edit job (W6), change pay (W10, Paper `13F3-0`), Director approve/decline (W11; no PIN: the API takes none, log it), probation decision (W13, extension needs months and reason) and note (W14), move dialog with Transfer/Exit toggle and **preview before confirm** (W15/16/19/20; impact lines from `MovePreview`), send to another site (W17, "Today only / Until a date / Until I bring them back"), exit checklist (W21) and 30 s Undo toast after an exit (W22, 7-day undo), rehire (W23), create login (W24; reuse `hire/lib` password and email suggestion), contract (W12, record only: signing is slice 4), upload (W27), ask for a detail and remind (W25), verify statutory (W26), details and bank dialogs for "Finish the file" gaps (W6 sensitive fields, W9), photo (W8).
3. **Pending pay changes** list for approvers on the Employees page (R11) with the decision dialog.
4. **Own file** (`me`, R6, W7, Paper `12UL-0` phone emergency contact, welcome steps): a `/app/workforce/my-file` page; widen `lib/route-access.ts` for floor staff for that prefix only and extend `route-access.workforce.test.ts`.
5. **Home cards** (`workforce/home/cards/`): Onboarding, No contract yet (HR KPI strip, `workforce.hr-kpis`), People by branch, Probation ends / Finish hiring (HR attention), Coming up (probation ends), company headcount (Director), People numbers. Write data hooks in `people/_shared/hooks`, export via `people/index.ts`, swap each card's `noSource`, tick `docs/features/workforce/chapter-1-ledger.md`. Needs a read of `home/cards/*.tsx` and `card-registry.ts` for the shapes.
6. **Tests and checks:** services, permission-driven visibility, route-access and nav tests extended; the per-screen loop for the file, each tab and each dialog (computed styles vs Paper, 1440/1024/820/390, keyboard walk, a11y names, zero console errors) and **a role walk** (HR, Branch Manager, Store Manager, Director, Accountant, a department head, one staff login) against the README's "Who sees what".
7. **End to end on the lane database:** hire as a Branch Manager (two steps) → HR adds pay → Director approves a pay change → probation decision → transfer → exit → undo; check the Home cards change.
8. **Finish:** `frontend/features/workforce/people/README.md` (spec, status, endpoints used, parity manifest, built-beyond-Paper, backend gaps), the size-check results, status rows in `docs/PROJECT_STATUS.md` and `docs/features/workforce/README.md`, `pnpm build` once, a back-end fix commit (`fix(workforce-people):`) only if a screen exposes a real gap. Gaps already known: no audit-read endpoint (Activity tab), no "ask HR to change something" endpoint (Branch Manager button hidden), photo upload needs the file id (done after hire), employment type is not editable by PATCH (shown read-only).
9. Final message: decisions table first, then the 5-line recap, then built-beyond-Paper, back-end fixes made, legacy pages now unreachable (`app/app/hr/staff`, `app/app/manage/staff` no longer linked).

## Size state at the handoff

Largest file 251 lines (`_shared/types/people-types.ts`; fine, types), no folder over 9 files. Re-run the two checks from the brief after every screen.
