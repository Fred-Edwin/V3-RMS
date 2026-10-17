# Workforce UI kit: front-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree (setup is in the orchestrator's message, not part of the paste).

---

You are a tech lead on Wendo RMS building the **Workforce UI kit**: the shared screen pieces and behaviour rules that every Workforce screen will use, built **once**, to the owner-approved Paper designs, so no later screen has to invent or re-do them. **Front end only. No back end, no migration, no endpoint.**

### Why this session exists
Workforce is about 140 designed steps. If each screen builds its own status pill, ring, timeline, wizard or empty state, they drift from Paper and from each other, and finished screens get reopened. The kit is the fix: every piece, in every state, with hover, focus, pressed, disabled and motion decided once. Later sessions only compose these pieces. Nothing in this session builds a real Workforce page.

### Where you work
- The lane worktree on branch **`feat/workforce-ui-kit`** (cut from the docs branch `docs/workforce-orchestration`, not `origin/main`, so the Workforce docs are current). Run `git branch --show-current` first; it must print that.
- Your lane's ports: front end `pnpm exec next dev -p 3101`; API from this worktree's `backend/` with `PORT=4101 FRONTEND_ORIGIN=http://localhost:3101` and `NEXT_PUBLIC_API_URL=http://localhost:4101/api/v1` (check `scripts/lane.sh status 1` for the real values). Do not touch the owner's main folder, other lanes, or production.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only** (no sed, awk, python or heredoc scripts in Bash); one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` and end each commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing is pushed, no PR**; end with a plain-English recap of about 5 lines.
- Gates for every commit: `cd frontend && pnpm exec tsc --noEmit && pnpm lint && pnpm test`; `pnpm build` before you report.

### Read first (only these parts)
1. `docs/features/workforce/README.md`: the "Interaction", "Colour", "Documents", "Notifications" and "Dates and payslip security" notes (the owner's decisions on look and behaviour).
2. `docs/UI_BUILD_RULES.md` (all of it: states, tables, interactive states, fidelity, responsiveness), `docs/DESIGN_SYSTEM.md` (tokens, `wds-`), `docs/CODING_STANDARDS.md` section 9 (frontend layout).
3. **Paper** (file "Wendo RMS · Approved designs", `01M3TP8J54R83RHC9FJ7RAHGKG`). Call `get_guide` with `paper-mcp-instructions` first. Read live, never from memory:
   - **Workforce · Interaction spec** (page "Workforce · E. Trust and shared parts", node `1Q58-0`): 14 behaviour rules (Nairobi time, PIN only for a signed act, answer and undo, one brown button per screen, finding a row, forms, notifications, phone, keyboard and focus, the system does the obvious thing, waiting times, the log, one date picker, phones and payslips).
   - **Workforce · States kit** (same page, node `1Q6R-0`): loading, empty (nothing yet, nothing found), error (with reference `WF-xxxx`, Try again), offline strip and "Saved on this phone" marker, plus the per-screen copy table.
   - **Shared · Notifications** (page "Workforce · B. Schedule and time", node `19PW-0`): the five-part template and the wording table.
   - The component sources, by reading these screens and extracting what repeats: Chapter 2 step 1 (Employees list, node `QX1-0`) and step 2 (Add employee wizard, node `R5O-0`); Chapter 4 step 1 (employee file, node `Y8C-0`); Chapter 1 steps 2 and 5 (HR Home `OOZ-0`; phone Home `QG8-0`). Use `get_tree_summary` on a chapter's artboard to find other steps.
4. Code that exists, so you reuse and do not duplicate: `frontend/components/ui2/` (button, badge, status-dot, sheet, confirm-dialog, toast, input-otp, date-range-picker, combobox, data-table, skeleton and the rest), `frontend/components/app/shell/signing-pin-card.tsx` and `sign-sheet.tsx`, `frontend/features/inventory/_shared/components/` (`kpi-strip.tsx`, `skeletons.tsx`, `stock-states.tsx`, `drawer-shell.tsx`, `decision-dialog.tsx`) and `frontend/app/dev/components/page.tsx`. Features must not deep-import each other's internals: if Inventory has a generic piece Workforce needs (the KPI strip), **add a Workforce or `ui2` version modelled on it; do not import from `features/inventory`, and do not edit Inventory files.**

### What you build
Put Workforce-specific pieces in `frontend/features/workforce/_shared/` (`components/`, `lib/`, `hooks/`, `types/`, with an `index.ts` public API and a `README.md`). Put a piece in `components/ui2/` only if it is generic and missing there (additive: a new file; never edit an existing ui2 primitive in a way that changes its look). Every piece below takes its words as props or from the typed copy table; none holds role names (test a capability or a prop).

1. **Behaviour rules as code.** Hover (pointer devices only), focus ring, pressed and disabled-with-reason styles, and motion (fast ease-out, honours reduced motion) as shared classes or tokens that all pieces use. Load the **`emil-design-eng`** skill with the Skill tool before your first piece and re-read its checklist for each. Rule 04 (one brown button per screen, status colours, hidden never greyed) and rule 09 (Escape closes and returns focus; Enter never completes a signed act) are enforced in the pieces, not left to screens.
2. **KPI strip** (the approved Catalog strip: bordered band, soft white-to-grey fill; 10 px mono caption, 30 px semibold number, 12 px grey line; actionable cells get a 2 px warning top border, warning number and an arrow).
3. **Status pills and tags**, every variant drawn on the Employees, file and Home screens (complete, needs finishing, probation ends, bank missing, On probation, Monthly, Clocks in, Casual, Exited, late, overtime, pending, and so on).
4. **Filter chips with counts**, and the search and filter bar pattern from UI_BUILD_RULES section 4a.
5. **Avatar** with initials and photo, with the presence dot used on the phone Home.
6. **Completeness ring** (red under 50, amber 50 to 84, green 85 to 99, solid green with a tick at 100) and **probation bar** (green with more than 30 days left, amber at 30 or fewer, red at 7 or fewer). The thresholds are pure functions with tests.
7. **Timeline** ("Life at Wendo": dots with the concentric ring, a dashed future dot) and the "Coming up" variant.
8. **List and detail layout** (two columns, selected row marked with a caramel bar) and **stepper wizard layout** (steps on the left, form centre, "the file so far" panel right, footer actions; saved-as-a-draft indicator).
9. **Reason chips** (short list plus "Other"), the **"what changes" confirmation summary** dialog, the **PIN dialog** for a signed act (reuse the existing PIN pieces), the **Undo toast** (30 seconds, rule 03), a **single-day date field** that opens the approved range picker in single-day mode (rule 13; extend `ui2/date-range-picker` additively if it lacks a single-day mode).
10. **States kit**: loading list skeleton (grey bars in the shape of the rows; after 8 seconds the line "Still loading. Your work is safe."), the two empty states, the error block (reference and Try again, replaces only the failed part), the offline strip and the "Saved on this phone" marker. The **per-screen copy table** from Paper as a typed module (`states-copy.ts`), every row, so a screen asks for its words by key; a test fails if a screen key from the Paper table is missing.
11. **Notifications**: the wording table as a typed module and the Inbox row component (the lock-screen mock is documentation, not a component).

**Not in this session:** the A4 document shell (Times New Roman, QR, signature; the first slice that prints builds it), the shift pill and clock card (Attendance), the rota grid (Rota), the menu and Home (the next session), anything that needs data.

### A dev gallery to prove every piece
Add `frontend/app/dev/workforce-kit/page.tsx` (a thin shell, like the existing `app/dev/components`; check how that page is guarded from production and guard this one the same way) rendering each piece in every state, labelled with its Paper node id. This is how the owner and the next sessions see the kit; it is not a product screen.

### The per-piece loop (run it on every piece before the next; do not batch)
1. Pull exact values from Paper: `get_jsx` and `get_computed_styles` on the piece's node. **Every number from computed styles, never from a screenshot.** Use `wds-` tokens; where a value has no token, report it, do not hard-code a hex.
2. Build the piece with all its states: default, hover, focus-visible, pressed, disabled (reason visible), loading, empty, error where they apply. Paper does not draw hover or pressed: build them in the same visual style and list them in the README's "Built beyond Paper" table so the owner can see them.
3. Compare at the Paper width by eye against the screenshot and by `getComputedStyle` of the key elements against Paper's computed styles (size, weight, colour, spacing, radius, border, height). **No automated pixel-diff, ever** (`pixelmatch` and `visual-diff` are banned).
4. Keyboard-only walk, a screen-reader-name check in the accessibility snapshot, zero console errors. Use the chrome-devtools MCP directly (not the `run-frontend-browser` skill). Log in with the seeded lane logins (all `password123`: `admin@wendo.test`, `director@wendo.test`, `bm.town@wendo.test`, `accountant@wendo.test`, `store.manager@wendo.test`; find the HR login in the seed script or with the read-only Postgres MCP). The gallery needs a login only if the dev route requires one.
5. Tick the piece's row in the **parity manifest** in `features/workforce/_shared/README.md` (columns: Paper node, piece, states built, width checked, verdict: matches / corrected / needs owner decision), then commit.

### Tests
Pure logic with unit tests (ring and bar colour thresholds, copy-table completeness, any formatters). Components with the repo's existing component test setup (`pnpm test` is vitest; follow how `ui2` components are tested). No test is skipped.

### Gates and finish
- `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` all pass. The backend is untouched; say so.
- The README holds: what each piece is for, the parity manifest, the "Built beyond Paper" table, and open questions for the owner.
- Commit in reviewable steps (suggested: behaviour rules; KPI strip, pills, chips, avatar; ring, bar, timeline; layouts; dialogs and toast; states kit and copy table; notifications; gallery; README). Nothing pushed.
- Give the 5-line recap, the list of "Built beyond Paper" items, and any token Paper uses that the design system lacks. **Do not draft the next session's prompt.** Stop for the owner's review: they will open `/dev/workforce-kit`.
