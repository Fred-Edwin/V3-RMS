# Block 1, front end (phone): the heads' Requisitions

Start only after the contract is frozen (the front end builds against the contract's fixtures and the hand-written mock service until back end A and B land; wire to the real API at integration). Branch: `feat/req-fe-phone` from `feat/final-pass-block-1`. Read `docs/sessions/final-pass-session-common.md`, the contract, `requisitions-flow.md`, `docs/features/inventory/paper-updates-needed.md` (Requisitions group), and the one-shell decisions in `CLAUDE.md` and `docs/sessions/one-shell-navigation.md`. You are the **frontend design engineer** (Next.js, the new design system, accessibility).

## Screens (Paper page "Inventory · Requisition and dispatch" and the gap-fixes page)
Steps 1, 2, 3, 4, 5 (summary and PIN are **one sheet**), 6, 10, 14 (without dispatch data: the tracker and the carrier slot show nothing until Block 2), 15, 18; gap fix G1 (My requisitions: History with a Requisitions tab; the Deliveries tab is Block 2's, leave it out). Drawer rows per "Phone menus by role" (map page) for the Department Head and the member (a member has no Requisitions row). The phone column is centred at every width, the same pattern as Stock, Count and Waste; back arrow on task screens, menu icon on the home; **no status bar**; no money anywhere; titles not names.

## You own
`frontend/features/inventory/requisitions/` phone components, hooks, services and types for those screens; the thin page shells for them; the nav-table rows for heads and members (Requisitions, History; the floor-staff heads move off the legacy bottom tabs onto the shell, their other rows kept as links to the old pages; delete from `app/app/_legacy-phone/` only what is now unused for those roles); the states copy and wording tables from Paper steps 21 and 22.

## You must not touch
Desktop screens (the other front-end session owns them), the contract files (read only), back-end code, `components/ui/`, the shell beyond the nav-table rows.

## Behaviour that must be right
Pre-filled lines (restock level minus on hand, grouped by category, two levels for Kitchen); **Send as suggested** in 4 taps including the PIN; steppers and typing; remove with Undo; add an item by search grouped by category, only the department's items; changed lines show "changed from 27"; the note for the manager; Recall until approved; Urgent switch; "Sent, waiting for the Branch Manager"; "The head is told" shows what changed; additions with the head's PIN and the "Added after approval" block; the head's history with date range, status filter and numbered pager; idempotency keys on every signing write; PIN sheet that sets a PIN first if none (existing `sign-sheet.tsx`).

## Verify
390 in a real browser as a Kitchen head (login from the owner); every state of each screen (loading skeleton, empty, error with Retry, 409 for a second requisition in the same cycle, wrong PIN, offline error); keyboard, focus, screen-reader tree; zero console errors. Bring back the summary in the common file, with a per-screen Paper check table.
