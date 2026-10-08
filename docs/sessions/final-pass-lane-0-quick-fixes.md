# Lane 0: quick fixes (one session, no new contract)

Branch: cut `feat/lane-0-quick-fixes` from `main`. Read `docs/sessions/final-pass-session-common.md` first and follow it. You are a **frontend design engineer with a backend architect's care** for the small API additions.

## Goal
Four small fixes that are in production today and need no new design: (1) remove the fake phone status bar; (2) Prep history From and To dates; (3) the Audit log's Area menu and date range picker; (4) a date range and pager on the Counts list, and search, filters, a date range and a pager on the Waste list.

## Read
`docs/features/inventory/role-coverage.md` (gaps G3, G4, G11, G12, G13, G14, G16), `paper-updates-needed.md`, `UI_BUILD_RULES.md` §4a and §7a, the READMEs of `audit-log`, `counting`, `waste`, `prep`, `stock-count-waste-contract.md` §4 (the endpoints you extend). Paper page "Inventory · Counting redesign (Oct 7)": steps 56, 57, 58, 59 (and the date range picker on page "Inventory . Stock and Counting (parts and reference only)", chapter 6) and the Prep page step 13.

## Build
1. **Status bar.** Remove `frontend/components/app/shell/mobile-status-bar.tsx` and every use (it is imported by catalog, counting, dispatch confirm, branch-day components and `mobile-states.tsx`; search `9:41`, battery and signal icons across `frontend/`). A phone screen starts at the app's own header. Add a test (or lint-style test) that fails if "9:41" appears in `frontend/` source.
2. **Prep history dates.** Add From and To (the approved date range picker) to Prep history as Paper step 13 draws; the API takes `from` and `to` if it does not already (additive, optional).
3. **Audit log.** Replace "When: Today / Show any time" with the approved date range picker (step 59). Add the **Area** menu as step 58 draws it: Central Store areas Catalog, Suppliers, Restock levels, Purchasing and payments, Prep, **Stock counts, Waste, Stock adjustments** (new), and Branches areas Requisitions, Dispatch, Discrepancies, Branch day, Branch waste (listed now; they stay empty until each block adds its source). Add the Branch filter (hub roles). The three new Central Store areas are **derived from existing rows, like Prep** (no event table): counts signed and approved from `counts`, waste logged and reversed from `waste_logs`, ledger adjustments from `ADJ` ledger rows, each with a plain sentence and a record link. Pager of 50 as today. Keep the architecture of `audit-log-service.ts` (merge of sources); add each source as a small module.
4. **Counts and Waste lists.** Counts: date range and the pager exactly as step 56 (the pager exists in production). Waste: search, filters (Department not applicable here: Reason, Logged by, Status), date range and pager as step 57. These are **additive optional query parameters** on the existing list endpoints (`from`, `to`, `q`, `reason`, `loggedBy`, `status`, `page`, `pageSize`); update the frozen contract files and fixtures on both sides in the same change and note the amendment in `stock-count-waste-contract.md` (the owner has accepted these two lists as part of Lane 0).

## Do not touch
Anything under `requisitions`, `dispatch`, `branch-day`, `waste/department`; `routes/index.ts` (ask if a mount is needed); the shell nav table.

## Verify
Backend `pnpm build`, `pnpm test`; frontend `pnpm build`. In a browser: Store Manager at 1440 (Audit log areas and range, Counts and Waste lists with the new controls), Attendant at 390 (no status bar anywhere you can reach), Prep history dates.

Bring back the summary in `final-pass-session-common.md`.
