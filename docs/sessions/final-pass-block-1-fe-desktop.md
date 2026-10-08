# Block 1, front end (desktop): the Requisitions list and file, approval, Departments

Start only after the contract is frozen (build against the contract's fixtures and a hand-written mock service until back end A and B land). Branch: `feat/req-fe-desktop` from `feat/final-pass-block-1`. Read `docs/sessions/final-pass-session-common.md`, the contract, `requisitions-flow.md`, `UI_BUILD_RULES.md` §4a, and the Paper sidebar masters. You are the **frontend design engineer**.

## Screens
Steps 7 and 7b (the one list, drawn once for every role; hub roles add a Branch column and filter and open on their own tab; tabs Collecting, To approve, To pack, On the way, To confirm, Discrepancies, Closed), 7c and 7d (hub History with a Branch filter and date range, hub Discrepancies list; the discrepancy content arrives in Block 2), 8 (the two-pane file while collecting: department rail, selected department's lines, dark hairlines), 9 (change a quantity in the row, reason chips), 11 (Approve and sign drawer, one PIN), 12 (approved), 13 (the file following its dispatches; dispatch rows empty until Block 2), 16 (approve the addition), 17 (the printed A4: route `app/app/branch/requisitions-print/[id]`, no money), 18b (the Director's list, urgent after 1 hour, **Open and approve**), 19 (cancel dialog with a required reason and a PIN), 20 (Departments in Settings: add, rename, retire; a retired row keeps its past requisitions), 21 (States kit reuse), 22 (wording tables), G4 (Departments of any branch, read only, branch picker; the Director's route Operations › Branch Settings › Departments). Also the department chips in the Catalog item panel driven by Department rows (a small change owned jointly with back end A: keep it to the chips).

## You own
`frontend/features/inventory/requisitions/` desktop components, hooks and services; `frontend/features/inventory/departments/`; the thin pages under `app/app/branch/(shell)/requisitions` and `app/app/inventory/(shell)/requisitions` and the print page; the **nav-table rows** (§12): Branch Manager Requisitions with the Queue, Discrepancies and History sub-links and no Deliveries row, hub roles one Requisitions row replacing Dispatch (the Attendant keeps Dispatch), Director's Departments row; badges from R2 with the socket nudge. Delete the old pages and components these replace (`app/app/requisitions/*` is the old head page; coordinate with the phone session through the orchestrator: you delete the old desktop pages, it deletes the old head route).

## You must not touch
Phone screens, the contract files (read only), back-end code, `components/ui/`, the shell except the nav-table rows (and `nav-table.test.ts` must pass).

## Behaviour that must be right
Money visible only with `requisitions.see_value`; write buttons **hidden, not greyed** for roles without the capability; each role opens on its own tab; Nudge as the one primary action with the menu (Fill it myself, Send without this section); Approve and sign summary equals what signing does; Director approval records the signer; cancel only before approval; tables follow §4a with the page state in the URL; the numbered pager; the shared date range picker; document numbers in `#1F5BAE` Geist Mono underlined where they are links.

## Verify
1440 in a real browser as the Branch Manager, Director, Store Manager and Accountant (logins from the owner); spot-check 768 and 1024; every state; keyboard, focus traps in the drawer and dialog, accessibility tree; zero console errors. Bring back the summary in the common file, with a per-screen Paper check table.
