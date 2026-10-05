# Code session: one shell and one navigation table for every role

**Status: built 5 Oct 2026 on branch `feat/one-shell-navigation`; waiting for the owner's "merge".**

## Why
There were three shells: the legacy layout with a per-role sidebar, the Central Store's own sidebar, and the Branch workspace's own sidebar. A person crossed between them by one "Central Store" link. The owner wants every role to see the new shell now, with links to old pages for features not yet rebuilt and links to the new pages for rebuilt ones, so progress shows as each feature is redone.

## What was built
- **The navigation table**, `frontend/components/app/shell/nav-table.ts`. Rows of `{ key, label, group, icon, oldHref | newHref, roles, capability?, flag?, departmentHead? }`, plus the Central Store tree with its sub-links. `navFor(context)` turns it into the sidebar for one person; `activeFor` says which row a path lights and whether the page draws its own top bar.
- **One shell**, `components/app/shell/app-shell.tsx`: the geometric sidebar plus, for old pages, a thin breadcrumb top bar (rebuilt screens draw their own). `app/app/layout.tsx` only decides which frame a page gets.
- **Route gate** moved from `middleware.ts` into `lib/route-access.ts` (same rules) so it can be tested. `nav-table.test.ts` checks every role (with and without the department-head marker and with different capabilities) and fails if the table shows a link the gate would bounce.
- **Removed:** the legacy per-role sidebars (`DirectorSidebarNav`, `SidebarLayout`, old `SidebarNav`), the Inventory and Branch private sidebars (`inventory-shell.tsx`, `branch-shell.tsx`, `nav-groups.ts`). Their rules and tests moved into the table.

## Decisions (owner, 5 Oct 2026)
1. **Rebuilding a feature changes only that feature's rows** (`oldHref` to `newHref`). The shell, the layout and the sidebar component are not edited for it. Fixes for an old page that looks wrong in the new frame go in that page's own file.
2. **The table never widens access.** `middleware.ts` stays the authority.
3. **Phones: desktop roles migrate, floor staff wait.** The Branch Manager, Director, Accountant, System Admin, HR Manager, Store Manager and Store Attendant use the shell at every width: below `lg` the sidebar becomes a top bar with a menu button that opens the same links as a drawer, and the bottom tabs are gone for them. The floor staff (waiter, chef, barista, steward, housekeeping) keep the legacy bottom tabs, because they work from phones all shift and need one-tap Orders and New Order. They move into the table, and `app/app/_legacy-phone/`, `BottomNav` and `MobileLayout` are deleted, when their screens are rebuilt.
4. Kitchen and barista display routes and print documents stay bare.

## How to rebuild a feature into the shell
Change that feature's row(s) in `nav-table.ts`: set `newHref`, drop `oldHref`. A row with a `newHref` is treated as drawing its own top bar (`framed`); set `framed: true` on an `oldHref` row only if the old page already draws one. Run `pnpm test` (the gate test runs against the new href).

## Open items
- The Director's branch links are fetched in `use-shell-nav.ts` (a Director-only list), not in the table.
- The Branch workspace's placeholder links (Branch, Waste) were dropped; add rows when those screens exist.
- The footer avatar is round (owner decision of 15 Sep 2026); Paper's master draws it square.
