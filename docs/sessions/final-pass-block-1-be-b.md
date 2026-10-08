# Block 1, back end B: lists, badges, activity, print, notifications, audit, jobs

Start only after the contract is frozen and back end A's migration commit is on `feat/final-pass-block-1`. Branch: `feat/req-be-b` from it. Read `docs/sessions/final-pass-session-common.md` and the contract. You are the **backend architect**; you also own the quality of the notification layer every later block reuses.

## You own
- In `backend/src/modules/inventory/requisitions/`: **R1** (list with tabs, counts, `waitingForYou`, search, filters, dates, hub branch picker), **R2** (badges), **R4** (activity sentences, record links), **R5** (documents), **R7** (head home), **R9** (head history), and the A4 data builder behind **R6**. Put them in your own files (for example `requisitions-list-service.ts`, `requisitions-activity.ts`, `requisitions-print.ts`) and their routes in a router file the orchestrator mounts; do not edit back end A's service or repository files except to add an exported function it agrees to.
- `backend/src/modules/inventory/_shared/notify.ts` (+ test): the one notification layer (§7): Inbox row, FCM push through the existing push service, the `inventory:badges` socket nudge to the site room, `holdInQuietHours` (22:00 to 05:00 Africa/Nairobi). Documented in its header and in `docs/features/inventory/README.md` standing rules. Wire the Block 1 moments (map rows 1, 2, 3, 4, 13) using back end A's event interface.
- The **urgent escalation job** in the existing worker (every minute; idempotent; sets `urgentEscalatedAt`; tells the Director).
- The **Audit log source** `REQUISITIONS` (reads `RequisitionEvent`; sentences such as "Approved REQ-NYR-0112 · 40 lines · signed with PIN"; Branch filter; record link). Lane 0 has already added the Area menu and the Branch filter; confirm that has merged, or build only the source and say so.
- Tab derivation for `to-pack`, `on-the-way`, `to-confirm`, `discrepancies` from the existing dispatch and discrepancy status, written as one replaceable function Block 2 swaps out.

## You must not touch
The migration, back end A's write endpoints, the departments sub-module, `dispatch/`, `branch-day/`, `waste/`, `routes/index.ts`, the front end.

## Tests required
Each list tab and its count; `waitingForYou` per role; a head sees own department and no money; the Attendant sees no money; hub role Branch filter; search and date filters; badge counts; the notify layer (rows written, push called with the right audience, quiet-hours hold, socket nudge); the escalation job (idempotent, only after 1 hour, only unapproved); the audit source (events become sentences, never an account or PIN, branch filter); contract fixtures; `siteId` on every query.

Bring back the summary in the common file, plus a table of the notification moments wired and the ones left for Blocks 2 to 4.
