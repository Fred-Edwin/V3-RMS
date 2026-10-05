# Code session brief: one shell and one navigation table for every role

Written 5 Oct 2026 during the Purchasing mock build. Not started. Run as its own code lane, after the Purchasing mock (Session 1) is merged.

## Why
Today there are two shells. The old roles (Branch Manager, Accountant, Director, System Admin, waiters and the rest) use the legacy layout (`frontend/app/app/layout.tsx`) with its own sidebar, and `/app/inventory/*` bypasses it and brings the new geometric sidebar (`components/app/shell/sidebar-nav.tsx`, Paper `OQP-0`). A person crosses between them only by one "Central Store" link in (`lib/central-store-nav.ts`) and "My dashboard" out. The owner wants every role to see the new shell now, with links to old pages for features not yet rebuilt and links to the new pages for rebuilt ones, so progress shows as each feature is redone.

## What to build
1. **One navigation table**, like the access table: `frontend/lib/nav-table.ts` (or similar), rows of `{ key, label, group, icon, oldHref | newHref, roles/capabilities }`. Rebuilding a feature means changing that row's href from the old page to the new one. Nothing else.
2. **One shell** around every `/app/*` route for desktop roles: new sidebar + top bar. Old pages render inside the content area. Keep the legacy phone layouts and the kitchen/barista display routes (`isDisplayRoute`) as they are.
3. Groups per role come from the table (Paper `OQP-0` shows the pattern: group label, items with counts, user footer). Counts (badges) come from the existing hooks, not new endpoints.

## Watch for
- Old pages draw their own headers, padding and sometimes their own sidebars; each needs a visual check inside the new frame and a small fix. Do the System Admin first (their legacy sidebar is the least used), then Accountant, Director, Branch Manager.
- `middleware.ts` gates routes by role; the table must not widen access. Keep the gate as the authority.
- The Central Store screens already use the geometric sidebar; do not redraw them.
- Do not redraw the roughly 80 old sidebars embedded in Paper (see memory: geometric sidebar standard).

## Done when
Every desktop role signs in and sees the new shell with every link they had before; clicking an old link opens the old page inside the new frame; the Central Store links open the rebuilt screens; changing one row of the table swaps a link from old to new.
