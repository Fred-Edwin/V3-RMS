# Code session brief: one shell and one navigation table for every role

Written 5 Oct 2026 during the Purchasing mock build. Not started. Run as its own code lane, after the Purchasing mock (Session 1) is merged.

## Why
Today there are two shells. The old roles (Branch Manager, Accountant, Director, System Admin, waiters and the rest) use the legacy layout (`frontend/app/app/layout.tsx`) with its own sidebar, and `/app/inventory/*` bypasses it and brings the new geometric sidebar (`components/app/shell/sidebar-nav.tsx`, Paper `OQP-0`). A person crosses between them only by one "Central Store" link in (`lib/central-store-nav.ts`) and "My dashboard" out. The owner wants every role to see the new shell now, with links to old pages for features not yet rebuilt and links to the new pages for rebuilt ones, so progress shows as each feature is redone.

## What to build
1. **One navigation table**, like the access table, in `frontend/components/app/shell/nav-table.ts` next to `sidebar-nav.tsx` (it is shell configuration, and `components/app/shell/` is the new structure's home for the cross-feature shell; not `lib/`, not `components/ui/`). Rows of `{ key, label, group, icon, oldHref | newHref, roles/capabilities }`. Rebuilding a feature means changing that row's href from the old page to the new one. Nothing else.
2. **One shell** around every `/app/*` route for desktop roles: new sidebar + top bar. Old pages render inside the content area. Keep the legacy phone layouts and the kitchen/barista display routes (`isDisplayRoute`) as they are.
3. Groups per role come from the table (Paper `OQP-0` shows the pattern: group label, items with counts, user footer). Counts (badges) come from the existing hooks, not new endpoints.

## Structure rules (settled with the owner, 5 Oct 2026)
- The shell is **new-structure code** and carries both old and new screens. Over time the old pages shrink and `features/` grows; only the table's rows change. The shell itself is never touched again when a feature is rebuilt.
- `app/app/layout.tsx` holds **no role-specific sidebar logic**. All of it lives in the table. The layout renders the shell and nothing else.
- The new shell **must not import from `components/ui/`** (the frozen legacy design system). Old pages keep using it inside their own files. Once the layout stops building the old sidebar, the old sidebar components (`SidebarNav`, `DirectorSidebarNav`, `SidebarLayout`) have no users: delete them if nothing else imports them.
- Badge counts come through each feature's `index.ts` public API, never by importing a feature's internals. The table holds links, labels and roles, not feature code.
- Fixes for old pages that look wrong inside the new frame go in those old page files, not in the shell.

## Watch for
- Old pages draw their own headers, padding and sometimes their own sidebars; each needs a visual check inside the new frame and a small fix. Do the System Admin first (their legacy sidebar is the least used), then Accountant, Director, Branch Manager.
- `middleware.ts` gates routes by role; the table must not widen access. Keep the gate as the authority.
- The Central Store screens already use the geometric sidebar; do not redraw them.
- Do not redraw the roughly 80 old sidebars embedded in Paper (see memory: geometric sidebar standard).

## Done when
Every desktop role signs in and sees the new shell with every link they had before; clicking an old link opens the old page inside the new frame; the Central Store links open the rebuilt screens; changing one row of the table swaps a link from old to new.
