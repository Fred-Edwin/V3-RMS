# Workforce segment 4: Leave, front end

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 1 worktree. **Start only after the Leave back end is merged on the stack (done: `feat/workforce-backends-4-6`).**

---

You are a tech lead on Wendo RMS building the **screens of Leave** (Paper "Workforce · C. Leave and conduct", Chapter 10) against the **real back end that already exists**. Read, in full and once, `docs/sessions/workforce-frontend-common.md` and `docs/sessions/workforce-two-part-method.md`: they hold the owner's standing rules, the two-part method with the planned stop, how Paper fidelity, hover and keyboard checks are done, the fresh-server and background-command rules, the gates and the code rules. **Everything in them applies to this brief.** Session name for files: `4-leave-frontend`.

### Where you work
Lane 1 worktree. `git status` must be clean; then `git checkout -b feat/workforce-4-leave-frontend origin/feat/workforce-backends-4-6` (if the lane already holds a branch at that commit, say so and continue on it). Run `git branch --show-current` and confirm `backend/src/modules/workforce/leave/` exists; if not, stop and say so. Front end `pnpm exec next dev -p 3101`, API 4101, browser `http://lane1.localhost:3101`, lane database `wendo_rms_lane1`.

### Read first (only these)
1. `docs/features/workforce/specs/4-leave-spec.md` and `4-leave-spec-screens.md` (every screen: values, copy, states, interactions, what production adds), `specs/decisions-4-spec.md` and `specs/decisions-owner-4-6.md`.
2. `docs/features/workforce/decisions-4-leave-backend.md` and `backend/src/modules/workforce/leave/README.md`, then `docs/API_CONTRACT.md` §45 (the endpoints, errors and shapes). Open validators and types files only for request and response shapes.
3. `frontend/features/workforce/_shared/README.md` and `index.ts` (the kit), `frontend/features/workforce/home/` (the card registry), `frontend/components/app/shell/nav-table.ts`, `frontend/lib/route-access.ts`.

### Facts from the back-end report you must honour
- Annual leave is granted **in full at the start of the year**. The lane database's seeded Rules give Annual leave **0 days**, so every balance starts at 0 until HR sets it. Show it honestly (no broken screen), and for your browser walk set the days as HR through the adjust-balance flow.
- A **casual worker** (on probation, daily rate, no contract) gets `200 { casual: true, cards: [], chips: [], message }` from `GET /me/overview`, never an error. Show the message, no cards.
- **Declining needs no PIN; adjusting a balance needs a PIN**, a reason and a note rule (`note` required for `OTHER`). Cancelling approved leave has its own rules per the spec.
- Every write sends the header `Idempotency-Key` (8 to 80 characters); an unknown body field is a 400; the same key again returns `repeat: true`. Approve and adjust send `expectedVersion` or `expectedNow`; handle `409 ALREADY_DECIDED`, `STALE_REQUEST`, `BALANCE_CHANGED` as the spec's "changed underneath you" states.
- `NOT_WITH_YOU_YET` (HR before 72 hours) carries `movesToHrAt`: show it.
- The slip PDF comes from `GET /applications/:id/slip.pdf` (a cancelled slip is stamped VOID); use the kit's phone Document view and `pdf-viewer`.
- **Not built on the back end, derive or omit as the spec's gap list says:** leave days in timesheets and payroll; only the On-leave count on the board; the documents-door registration; notification texts are generic (no names or dates), so the Inbox row must read the request itself.
- The Leave source of Needs you is `GET /workforce/leave/needs-you` and the menu badge is `GET /workforce/leave/badge`. **The Needs-you card and the generic badge machinery belong to the Shared parts front end (running in parallel):** you add only the Leave rows' wiring named in the spec section 9 and the nav-table rows `wf-leave`, `wf-my-leave`, `wf-staff-my-leave` (drop `notBuilt`, add `needsAttendance: true` as the spec says). Chapter 10 **step 9 is stale in Paper**: the Branch Manager decides leave only on the Leave page; do not build a "Waiting for you" page.

### Scope
**In:** every screen the spec lists for steps 1 to 17: staff Leave home and Request (phone and desktop), History and a followed request with the circle stepper, the approved and declined endings, the Document view of the slip, the Branch Manager's Leave page with the rota ("Review with the rota", approve and decline dialogs, own leave), HR's Balances, adjust a balance, Calendar, and the leave slip document; services, types, hooks and tests for every endpoint used; the three nav rows; the Home "On leave" and "Coming up" wiring the spec names. Steps 18 to 20 (Rules, Leave tab) are already built: record only how they connect.
**Out:** the Needs-you card and badge machinery, the audit log, the verify page (Shared parts front end); Conduct screens; anything that changes a site whose attendance switch is off.

### Checklist rows (create `docs/features/workforce/checklist-4-leave-frontend.md` with these, in order)
1 Staff Leave home and Request · 2 History and a followed request · 3 Endings (approved, declined) and the slip Document view · 4 Branch Manager Leave page with the rota · 5 Approve and decline dialogs · 6 Own leave on a desktop · 7 HR Balances and adjust a balance · 8 Calendar · 9 Navigation rows, Home wiring and permissions · 10 Services, hooks and tests.

### Final message
(1) decisions table, (2) 5-line recap, (3) the beyond-Paper items you added, the back-end fixes you made (if any) and the gaps left. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
