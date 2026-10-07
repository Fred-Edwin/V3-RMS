# Table audit — every table and list screen (8 Oct 2026)

Input to the shared table component (`docs/UI_BUILD_RULES.md` §4a). Read-only audit; no code changed.

**Scope decision (owner, 8 Oct 2026).** Inventory only. Section C (legacy screens) is **out of scope**: those
features will be redone later and adopt the component then, as new tables are designed to §4a from the start.
Defaults for the open questions: restock levels (rows 5, 6) and the master-detail rails (row 16) keep their
current layout (no pager) until the owner decides otherwise.

**How it was done.** Inventory screens: read from code (screen, table component, hook, API service, backend validator).
Legacy screens (`app/app/accountant|admin|director|hr|manage|orders|payslips…`): read at grep level only (table
primitive, search/paging cues). Their list endpoints were **not** opened, so their verdicts are **provisional**
(marked ⚑) and must be confirmed before each is migrated. Roles are taken from the route prefix and the nav table.

**Verdicts.** `FOOTER` = footer swap only · `FILTERS` = add filters (+ footer) · `ENDPOINT` = endpoint needs
server-side search/filter/paging first · `FINE` = already fine · `IGNORE` = not a table.

**Row-count rule used.** §4a applies to a table that can pass ~25 rows. Short, bounded lists (one department's
sections, a supplier's contacts) are `IGNORE` or `FINE`.

## Migration status (8 Oct 2026, branch `feat/shared-table-component`)

On the shared table (`frontend/components/ui2/data-table/`): rows 1 Stock items (full table, cards on phones), 2 Stock ledger
(pager only), 3 Catalog, 4 Suppliers, 7 Audit log, 11 Prep history (pager only), 20 Discrepancies (server status, search and
paging added), 22 Requisition history (server paging added; no text search). Not migrated, by the owner's defaults: rows 5, 6, 16
(layout kept), rows 8 to 10 (purchasing tabs, need server paging first), 15 Team, 12 Recipes, section C (legacy, out of scope).

## A. Inventory — rebuilt screens in production use

| # | Screen / route | Roles | File | Primitive | Search / filter / paging today | Paging real? | Endpoint (supports) | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | Stock items `/app/inventory/stock/items` | Store Manager, other desktop roles (read), Attendant | `stock/components/screens/stock-items-screen.tsx`, `stock-table.tsx` | div grid | Search (debounced), type, category, below-restock, negative; URL state; page in URL; own pager | Yes (`page`, `pageSize` ≤100) | `GET /inventory/stock` — search, type, categoryId, belowRestock, negative, attention, page, pageSize | **FOOTER** (old footer → §4a pager; add rows-per-page; chips with counts) |
| 2 | Stock ledger (all items) `/stock/ledger` and branch `/branch/ledger` | Desktop roles, Branch Manager, Dept Head | `stock/components/screens/stock-ledger-screen.tsx` (938 L) | div grid | Item picker, range, type; page in URL, `PAGE_SIZE` fixed | Yes (`page`, `pageSize` ≤100) | `GET /inventory/stock/items/:id/ledger` — locationId, from, to, type, page, pageSize | **FOOTER** (no search by design: one item's ledger; add rows-per-page) |
| 3 | Item catalog `/inventory/catalog` | Store Manager (write), desktop roles (read), Attendant (read) | `catalog/components/screens/item-catalog-screen.tsx`, `catalog-table.tsx` | div grid | Search, type/category/dept filters, showRetired, needsSetup, lowOrOut chips; search debounced; **state not in URL**; own "Showing n of N" + Prev/Next "Page x of y" footer | Yes (`page`, `perPage` ≤100) | `GET /inventory/items` — search, type, categoryId, departmentTag, includeRetired, needsSetup, lowOrOut, sort, page, perPage | **FILTERS** (move state to URL, pager + rows-per-page; filter vocabulary is the source for the rest) |
| 4 | Suppliers list `/inventory/suppliers` | Store Manager, Accountant, Director, Branch Manager (no pay details) | `suppliers/components/screens/suppliers-list-screen.tsx`, `suppliers-table.tsx` | div grid | Search, status, type, category, unfinished; page in `useState` (**not URL**); "Showing n of N" text footer | Yes (`page`, `perPage`) | `GET /inventory/suppliers` — search, status, type, categoryId, includeRetired, profileNotFinished, page, perPage | **FOOTER** + URL state |
| 5 | Restock levels (Store) `/stock/restock-levels` | Store Manager (write), desktop (read) | `restock/components/screens/store-restock-levels-screen.tsx`, `restock-table.tsx` | div grid, **editable inputs** | Search only; client-side filtering; no paging; unsaved-changes guard | No (returns all rows) | `GET /inventory/restock-levels` — scope, branchId/locationId, search; no paging | **ENDPOINT** (editable table: edits span pages, so decide: page + keep edits in memory, or keep whole list). **Owner decision needed.** |
| 6 | Restock levels (Department) | Dept Head | `restock/components/screens/department-restock-levels-screen.tsx` | div grid, editable | as row 5 | No | same | **ENDPOINT** (same decision as 5) |
| 7 | Audit log `/inventory/audit-log` | Desktop roles | `audit-log/components/screens/audit-log-screen.tsx` | div grid | Area, person, period; page in `useState`; Prev/Next + "n of N" | Yes (`page`, `perPage` ≤100, default 50) | `GET /inventory/audit-log` — area, actorId, from, to, page, perPage; **no text search** | **FILTERS** + URL state (text search needs backend `q`) |
| 8 | Purchasing → Orders tabs (`/purchasing`) | Store Manager, Accountant, Director, Attendant (phone) | `purchasing/components/orders-tab.tsx`, `orders-money-tabs.tsx` | div rows | Search, supplier, raised-by (client-side); no paging | No | `GET …/orders` — stage, status, supplierId, raisedBy, q; **no page** | **ENDPOINT** (add page/perPage + total + stage counts) |
| 9 | Purchasing → Needs restocking | Store Manager | `purchasing/components/needs-restocking-tab.tsx` | div rows with selection | Search, supplier filter (client); grouped by supplier; no paging | No | `…/needs-restocking` — q; no page | **ENDPOINT** ⚑ (grouped + selectable: confirm it should page at all; may stay one list) |
| 10 | Purchasing → Audit panel | Store Manager, Accountant, Director | `purchasing/components/purchasing-audit-panel.tsx` | div rows | Search, person, area, action, dates, **all client-side** over the full list; own "Showing a to b of N" + Prev/Next | Client slice | purchasing audit list; no server filters/paging | **ENDPOINT** |
| 11 | Prep → Runs history `/prep/history` | Desktop roles, Attendant | `prep/runs/components/history-screen.tsx`, `history-table.tsx` | `ui2/table` | Search, output, person, status, dates, mine; URL state; "Showing n of N · Page x of y" + Prev/Next | Yes (`page`, `perPage`) | `GET …/prep/runs` — search, outputItemId, personId, status, needsLook, mine, from, to, page, perPage | **FOOTER** (reference implementation for URL state; first `ui2/table` consumer) |
| 12 | Prep → Recipes `/prep/recipes` | Store Manager, desktop (read) | `prep/recipes/components/recipes-screen.tsx`, `recipes-list-view.tsx`, `recipes-table.tsx` | div grid | Debounced search; list size small | Check `recipes-service` | `…/prep/recipes` — search | **FINE** ⚑ (a recipes list rarely passes 25; gets the toolbar for consistency when touched, footer only if it can pass 25) |
| 13 | Prep → Needs a look band | Store Manager | `prep/review/components/needs-look-band.tsx` | band of cards | n/a | n/a | — | **IGNORE** (a band, not a table) |
| 14 | Prep → Run table (inside run drawer/record) | all | `prep/_shared/components/run-table.tsx`, `run-drawer-body.tsx`, `corrected-compare.tsx` | `ui2/table` | Lines of one run | n/a | one run | **IGNORE** (document lines, bounded) |
| 15 | Settings → Team `/inventory/settings` | Store Manager, Director | `settings/components/team/team-panel.tsx` | `ui2/table` | None; whole list | No | `GET /staff` returns all (`perPage = length`) | **ENDPOINT** ⚑ (small team today; add search + role filter client-side first; server paging only if it grows past ~25) |
| 16 | Counting → Counts list (left list of master-detail) | Store Manager, Attendant (own) | `counting/components/screens/stock-counts-screen.tsx` (list part) | div list in master-detail | `limit=30`, no pager | Cursor-less `limit` | `GET /inventory/counts` — limit ≤100 | **ENDPOINT** ⚑ (master-detail rail, not a standard table: needs a design call on whether the pager applies) |
| 17 | Counting → Verified table inside a count | Store Manager | `stock-counts-screen.tsx` `VerifiedTable` | div grid | Lines of one count | n/a | one count | **IGNORE** (document lines) |
| 18 | Counting → Count setup (reorder lists) | Store Manager | counting setup / daily count | drag list | n/a | n/a | — | **FINE** (§4a exception 5: whole section, no pager) |
| 19 | Dispatch → Queue / Deliveries | Store Manager, Attendant, Branch Manager | `dispatch/components/screens/dispatch-queue-*.tsx`, `branch-incoming-*.tsx` | cards / rows | `limit` 50, no search | `limit` only | `GET /dispatch/queue`, `/deliveries` — limit ≤200 | **ENDPOINT** ⚑ (design not approved; leave until redone) |
| 20 | Dispatch → Discrepancies `/discrepancies`, `/branch/deliveries/discrepancies` | Store Manager, Branch Manager | `dispatch/components/screens/discrepancies-list-screen.tsx` | div rows | Open-only toggle (URL `open=`); no search, no paging | `limit` 50 only | `GET /discrepancies` — limit ≤200 | **ENDPOINT** (add search, status, page/perPage) |
| 21 | Requisitions → list / for approval | Dept Head, Store Manager, Branch Manager | `requisitions/components/screens/requisitions-list-screen.tsx` | cards (needs-section / earlier today) | None | `limit` 25 | `GET /requisitions`, `/requisitions/needs-approval` | **IGNORE** ⚑ (a worklist of cards, bounded to today) |
| 22 | Requisitions → History | Dept Head, Branch Manager, Store Manager | `requisitions/components/screens/requisition-history-screen.tsx` | rows | Date range + status; **"Load more" (cursor)** | Cursor (`limit`, `cursor`), **no total** | `GET /requisitions/history` — from, to, status, limit, cursor | **ENDPOINT** (cursor → page/perPage + total; "Load more" is infinite scroll in effect) |
| 23 | Branch day → History `/branch/day/history` | Branch Manager, Dept Head | `branch-day/components/history-list.tsx` | div list | Date range (URL) | No paging | `GET /branch-day/history?from&to` | **ENDPOINT** ⚑ (range-bounded; confirm size, then page) |
| 24 | Branch day → Department count / Day document | Branch Manager | `branch-day/components/department-count.tsx`, `day-document.tsx` | `<table>`/grid | Lines of one day | n/a | one day | **IGNORE** (document lines) |
| 25 | Stock hub tables (attention items, recent counts, waste) `/stock` | Store Manager | `stock/components/screens/stock-hub-screen.tsx` | small panels | "Showing n of N — filtered to attention items" | `pageSize` 4 | `GET /inventory/stock?attention=true` | **IGNORE** (hub summary panels, not tables; "see all" links go to rows 1–2) |
| 26 | Supplier page tabs: Catalog, Contacts, Payment, Documents, Purchasing | Store Manager, Accountant, Director | `suppliers/components/catalog-tab.tsx`, `contacts-tab.tsx`, `payment-tab.tsx`, `documents-tab.tsx`, `supplier-purchasing-tabs.tsx` | div rows | Per-supplier, bounded (`limit` 100–200) | `limit` | `/inventory/suppliers/:id/items`, `/documents?limit=`… | **FINE** ⚑ (bounded per supplier; revisit Catalog tab and Documents if a supplier passes ~25 lines) |
| 27 | Add items (supplier), add-one | Store Manager | `suppliers/components/add-items-view.tsx`, `add-one-view.tsx` | pickers | Search pickers | `limit` | — | **IGNORE** (picker, not a list screen) |
| 28 | Waste log / waste list | Dept Head, Store Manager | `waste/…`, hub waste panel | list | Search in picker, `limit` 20 | `limit` | `GET /inventory/waste` | **IGNORE** ⚑ (log form + 7-day panel) |
| 29 | Print documents (count, dispatch note, LPO, statement, payment advice) | various | `*print*` | `<table>` | Documents | n/a | — | **IGNORE** (paper documents) |

## B. Inventory — mock-data front-ends

| Screen | Status | Verdict |
|---|---|---|
| Purchasing and Receiving (`features/inventory/purchasing`) | **Live since the Central Store go-live (PR #87).** The `mock/` folder is gone; screens use the real API through `purchasing-api-service`. Rows 8–10 above. | see rows 8–10 |
| Workforce (`backend/src/modules/workforce`, HR) | No inventory table screens; HR pages are legacy (section C). | see C |

(No screen audited here is still on mock data. The inventory README already says Purchasing is live on the real
back-end since 6 Oct 2026.)

## C. Legacy screens (⚑ provisional: grep-level only)

All use legacy `components/ui/Table.tsx`, `ExcelTable.tsx` or raw `<table>`. The brief covers "every table in the
product"; these need their own pass after the inventory tables are done. Endpoints not inspected.

| Route | Roles (by prefix) | File | Primitive | Search/filter/paging seen | Verdict ⚑ |
|---|---|---|---|---|---|
| `/app/accountant/credit` | Accountant | `accountant/credit/page.tsx` (1174 L) | `<table>` ×5 | 1 search cue, 2 selects, no paging | ENDPOINT |
| `/app/accountant/reconciliation` | Accountant | `accountant/reconciliation/page.tsx` (1249 L) | `<table>` ×7 | 5 selects, no search/paging | FILTERS |
| `/app/admin/discounts` | System Admin | `admin/discounts/page.tsx` | `<table>` | 2 selects | FINE (small config list) |
| `/app/admin/menu`, `/app/manage/menu` | System Admin, Manager | `admin/menu/page.tsx`, `manage/menu/page.tsx` | `<table>` ×3 / none | search, selects; no paging | FILTERS |
| `/app/admin/order-corrections` | System Admin | `admin/order-corrections/page.tsx` (1328 L) | `<table>` ×2 | search + paging cues | ENDPOINT ⚑ |
| `/app/admin/house-accounts`, `/app/admin/corporate-accounts`, `/app/director/corporate-accounts`, `/app/manage/customer-credit` | Admin, Director, Manager | pages | `<table>` | 1 select, no search/paging | FILTERS |
| `/app/manage/outstanding-balances`, `/app/director/outstanding-balances` | Manager, Director | pages (director page is a 1-line re-export) | `<table>` ×4 | none | FILTERS |
| `/app/director/branches/[branchId]` | Director | page | `<table>` ×2 | paging cue ×1 | FILTERS |
| `/app/director/incidents`, `/app/manage/incidents` | Director, Manager | pages | `<table>` ×3 | 2–4 selects, paging cues ×2 | ENDPOINT ⚑ |
| `/app/hr/staff`, `/app/manage/staff` | HR, Manager | pages | `<table>` ×2 / list | search ×9–16, 1–4 selects, no paging | FOOTER ⚑ |
| `/app/hr/leave`, `/app/hr/leave/calendar`, `/app/hr/my-leave` | HR, staff | pages | `<table>` | search ×9 (leave) | FILTERS |
| `/app/hr/attendance`, `/app/hr/payroll`, `/app/manage/shifts`, `/app/hr/shifts`, `/app/shifts`, `/app/department/shifts` | HR, Manager, staff | pages | `<table>` | mixed | FILTERS ⚑ |
| `/app/payslips`, `/app/manage/payslips`, `components/payslips/PayslipTable.tsx` | staff, Manager | page + component | `<table>` | paging cue ×1–2 | FOOTER ⚑ |
| `/app/orders`, `/app/history`, `components/orders/TabOrderHistoryTable.tsx` | Waiter, Manager | pages | div cards / `<table>` | search ×3 on orders; paging cue on tab history | ENDPOINT ⚑ |
| `/app/other-income/history` | Manager, Director | page | `<table>` ×2 | paging cues ×2 | ENDPOINT ⚑ |
| `/app/manage/delivery-zones`, `/app/manage/departments` | Manager | pages | `<table>` ×2 / list | none | FINE (small config lists) |
| `/app/inbox` lists (broadcast, conversation, notice) | all | `inbox/components/*List.tsx` | list | `hasMore`/cursor | IGNORE (feed-like but paged by `nextCursor`; **owner call**: §4a says no infinite scroll anywhere) |
| Kitchen / barista displays (`DisplayBoard.tsx`) | KDS/BDS | `components/kitchen/DisplayBoard.tsx` | cards | none | IGNORE (live ticket boards) |
| Dashboards (`/app/manage/dashboard`, `/app/accountant`, analytics) | Manager, Accountant, Director | pages | small tables inside cards | none | IGNORE (summary tables inside dashboards) |

## D. Findings that change the plan

1. **The component can be built with no backend change.** Rows 1, 2, 4, 7, 11 already take `page` and
   `perPage`/`pageSize` ≤ 100, so the 25/50/100 sizes fit. The Prep runs screen (row 11) already holds search,
   filters and page in the URL; it is the model for the URL hook.
2. **Seven screens have their own footer today** (stock items, ledger, catalog, suppliers, audit log, prep
   history, purchasing audit) and one uses "Load more" (requisition history). Several different Prev/Next styles exist.
3. **Backend work needed before migration (rows):** 8 orders, 10 purchasing audit, 20 discrepancies, 22
   requisition history (cursor to page), 7 audit-log text search, possibly 5/6 restock levels, 15 team.
4. **Two design questions for the owner** (not decided here): (a) editable restock-levels table with a pager:
   edits survive page changes? (b) master-detail rails (counts list, requisitions): does the pager apply to a
   rail? Until answered, rows 5, 6, 16 stay as they are.
5. **Legacy section C is large (~30 routes) and unverified.** It is outside the inventory `features/` tree; build
   the component first, migrate inventory (section A), then take section C as its own sessions.
