# Workforce segment 5: Conduct, front end

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 2 worktree. **Start only after the Conduct back end is merged on the stack (done: `feat/workforce-backends-4-6`).**

---

You are a tech lead on Wendo RMS building the **screens of Conduct** (Paper "Workforce · C. Leave and conduct", Chapter 11) against the **real back end that already exists**. Read, in full and once, `docs/sessions/workforce-frontend-common.md` and `docs/sessions/workforce-two-part-method.md`: they hold the owner's standing rules, the two-part method with the planned stop, how Paper fidelity, hover and keyboard checks are done, the fresh-server and background-command rules, the gates and the code rules. **Everything in them applies to this brief.** Session name for files: `5-conduct-frontend`.

### Where you work
Lane 2 worktree. `git status` must be clean; then `git checkout -b feat/workforce-5-conduct-frontend feat/workforce-backends-4-6` (lane 2 holds that branch: cutting a new branch from it is fine). Run `git branch --show-current` and confirm `backend/src/modules/workforce/conduct/` exists; if not, stop and say so. Front end `pnpm exec next dev -p 3102`, API 4102, browser `http://lane2.localhost:3102`, lane database `wendo_rms_lane2`.

### Read first (only these)
1. `docs/features/workforce/specs/5-conduct-spec.md` (the screens S1 to S14, the status machine, letters, documents, permissions, notifications, accessibility, the gap list) and `specs/decisions-5-spec.md`, `specs/decisions-owner-4-6.md`.
2. `docs/features/workforce/decisions-5-conduct-backend.md`, `backend/src/modules/workforce/conduct/README.md`, then `docs/API_CONTRACT.md` §44 (endpoints, errors, shapes). Open validators and types files only for shapes.
3. `frontend/features/workforce/_shared/README.md` and `index.ts` (the kit: circle stepper, Document view, PinField, phone parts), `frontend/components/app/shell/nav-table.ts`, `frontend/lib/route-access.ts`.

### Facts from the back-end report you must honour
- **Staff have no `needs_you.read`:** the staff menu badge comes from `GET /conduct/badge` (the counts the Needs-you card shows), not the Needs-you counts.
- `GET /conduct/:id/document?inline=1` serves the phone Document view; the PDF comes `private, no-store`. A **verbal note has no letter** (`422 NO_LETTER`), so show its record without a document. Push and lock-screen texts never carry the reason.
- Signing uses the person's code through the shared PIN door: a wrong code is `403 PIN_INVALID`, **paused, never locked**; show the pause, and nothing that suggests being locked out. The System Admin is told after 3 wrong tries (not your screen).
- A person **with no login** can be issued a notice (printed, handed over, recorded as not signed with a witness and a PIN). The rule depends on having a login, not on being a casual worker; casual workers are on probation with no contract and some have logins, and those sign like anyone.
- One appeal per notice within 7 days (`409 ALREADY_APPEALED`); decisions `KEEP | REDUCE_TO_WRITTEN | REDUCE_TO_VERBAL | WITHDRAW` need a reason and a PIN; a second decider gets `409`. A reduction creates a new linked notice and the old letter becomes **version 2 with a decision page**, never edited. The Director decides appeals on notices HR issued (`403 NOT_DECIDER` otherwise). Handle all errors as the spec's states.
- `GET /workforce/people/:id/conduct` feeds the employee file's Conduct tab: new notices plus read-only "Before the new system" rows from the old table.
- The letters are **placeholder wording for the lawyer**: show them as the back end renders them and never imply the wording is final.
- **The Needs-you card and menu-badge machinery belong to the Shared parts front end (in parallel):** you add only the Conduct rows' wiring in the spec section 11 and the `wf-conduct` nav row (drop `notBuilt`). Chapter 11 step 10 still says "Waiting for you" in Paper (stale): build the HR appeal screen as the spec says.
- Not built: the public verify page, the audit read screens.

### Scope
**In:** every screen S1 to S14: staff Conduct list and one notice with the stepper, the Inbox message, the notice before signing, sign with your code, appeal, the list after HR decides, the Branch Manager's Conduct list, the person picker, issue a warning (draft preview, facts, one own line, PIN), the notice document and phone Document view, record that the notice was not signed (witness and PIN), HR's appeal and decision, the employee file's Conduct tab, the status reference; services, types, hooks and tests; the `wf-conduct` row; button visibility from the API's permissions.
**Out:** the Needs-you card and badge machinery, audit log, verify page (Shared parts front end); Leave screens; sites whose attendance switch is off.

### Checklist rows (create `docs/features/workforce/checklist-5-conduct-frontend.md` with these, in order)
1 Staff list and one notice with the stepper · 2 Inbox message and the notice before signing · 3 Sign with your code and appeal · 4 The list after HR decides · 5 Branch Manager Conduct list and person picker · 6 Issue a warning · 7 The notice document and phone Document view · 8 Record not signed (witness, PIN) · 9 HR appeal and decision · 10 Employee file Conduct tab and status reference · 11 Navigation row, permissions and wiring · 12 Services, hooks and tests.

### Final message
(1) decisions table, (2) 5-line recap, (3) the beyond-Paper items you added, the back-end fixes you made (if any) and the gaps left. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
