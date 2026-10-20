# Workforce segment 6: Shared parts, front end A ("Needs you, phones and security")

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 3 worktree. **Start only after back end A and B are merged on the stack (done: `feat/workforce-backends-4-6`).** Front end B (Audit log, Activity on my record, the digest card, Signed documents and the public verify page) is a separate brief, written after this one.

---

You are a tech lead on Wendo RMS building **front end A of Shared parts** (Paper "Workforce · E. Trust and shared parts", Chapters 14 to 16 and the States kit) against the **real back end that already exists**. Read, in full and once, `docs/sessions/workforce-frontend-common.md` and `docs/sessions/workforce-two-part-method.md`: they hold the owner's standing rules, the two-part method with the planned stop, how Paper fidelity, hover and keyboard checks are done, the fresh-server and background-command rules, the gates and the code rules. **Everything in them applies to this brief.** Session name for files: `6a-shared-frontend`.

### Where you work
Lane 3 worktree. `git status` must be clean; then `git checkout -b feat/workforce-6a-shared-frontend origin/feat/workforce-backends-4-6` (if the lane already holds a branch at that commit, say so and continue on it). Run `git branch --show-current` and confirm `backend/src/modules/workforce/needs-you/` and `security/` exist; if not, stop and say so. Front end `pnpm exec next dev -p 3103`, API 4103, browser `http://lane3.localhost:3103`, lane database `wendo_rms_lane3`.

### Read first (only these)
1. `docs/features/workforce/specs/6b-needs-you-and-messages-spec.md` (Needs you cards and badges, delivery, the shared message table) and `6a-audit-and-security-spec.md` (**only** the parts on security alerts, "Your phones", "This wasn't me", first sign-in; skip the audit log screens), `specs/decisions-6-spec.md`, `specs/decisions-owner-4-6.md`.
2. `docs/features/workforce/decisions-6a-backend.md` and the READMEs of `backend/src/modules/workforce/needs-you`, `notifications` and `security`, then `docs/API_CONTRACT.md` §43 (the endpoints and errors).
3. `frontend/features/workforce/_shared/README.md` and `index.ts`, `frontend/features/workforce/home/` (the card registry), `frontend/components/app/shell/nav-table.ts` and its test, `frontend/lib/route-access.ts`.

### Facts from the back-end reports you must honour
- **"Waiting for you" and "Overdue approvals" are gone.** Replace them with numbered menu badges and a "Needs you" card on each Home (Branch Manager, HR, the Accountant, the Director with overdue reminders only). Remove the old `wf-waiting`, `wf-overdue` and `wf-head-waiting` rows from the nav table as part of the move (check `nav-table.test.ts`). Each Needs-you row opens the page where the decision is made.
- Needs-you counts, the card rows and the menu badge come from the **same rows**, so a badge cannot disagree with its card. Routes answer **404, not 403**, to a person without the capability. Leave and Conduct register their own sources (their front ends add their own rows; you build the card, the registry hook-up on the front end and the badge keys).
- **Row links:** `opens` is a guess for some rows (`/app/workforce/casual?sheet=`, `/workforce/security`, `/rules/statutory`, `/payslips/p9`). Verify each against the real routes and fix the link; log any you change.
- **Security:** the alert list has no "Waiting" state; the System Admin's alert view needs a nav row ("Security", add it) and is **designed from the kit** (Paper describes it but does not draw it): log the design. Clearing needs a one-line note; the "Start alerts" gate holds the unconfirmed-phone alert and the push to that person only.
- **Phone question:** while `GET /workforce/security/phones/me` says the phone is unconfirmed (its `phoneQuestion` flag), the app must show "Is this your phone?" (answers REMEMBER or ONCE; "once" counts for 12 hours). **The UI never explains how phones are recognised.** "Your phones": list, remove one (per phone; the person's other phones stay signed in), a five-phone warning.
- **Every Workforce call should send the header `x-device-id`.** After a password reset ("This wasn't me" flow) the app signs the person in again.
- Wrong codes pause (2, 4, 8, 16, 30 seconds) and **never lock**; show the pause, never a lock.
- Notifications: the Inbox gains a **Notifications tab** (`GET /workforce/notifications`, `/unread-count`, read and read-all). Texts never carry money figures or a conduct reason.
- Not in this session: the audit log screens, Activity on my record, the Director's payslip-opens digest, Signed documents and the public verify page (front end B).

### Scope
**In:** the Needs-you cards on each Home and the registry hook-up, menu badges and nav-table keys (including the removals above), the Inbox Notifications tab, the phone question, My phones, "This wasn't me", the System Admin's Security alerts view and its Home row, the shared messages (the three desktop message cards and the States-kit copy rows), services, types, hooks and tests; button visibility from the API's permissions.
**Out:** front end B screens; Leave and Conduct screens (their sessions run in parallel); sites whose attendance switch is off see nothing new.

### Checklist rows (create `docs/features/workforce/checklist-6a-shared-frontend.md` with these, in order)
1 Needs-you card, Branch Manager Home · 2 Needs-you card, HR, Accountant and Director Homes · 3 Menu badges and nav-table changes · 4 Inbox Notifications tab · 5 "Is this your phone?" prompt · 6 My phones and remove a phone · 7 "This wasn't me" and the password reset · 8 System Admin Security alerts (view, clear with a note, Start alerts) · 9 Shared message cards and States-kit copy · 10 Services, hooks and tests.

### Final message
(1) decisions table, (2) 5-line recap, (3) the beyond-Paper items you added (including the System Admin view design), the links you corrected, the back-end fixes you made (if any) and the gaps left. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
