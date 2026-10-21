/**
 * THE NAVIGATION TABLE, the door. Every sidebar link for every role is a row in `nav/rows-*.ts` (one file per module); `nav/engine.ts`
 * builds one person's sidebar from them; `nav/types.ts` holds the shapes. Everything else imports from here.
 *
 * Rebuilding a feature means changing that feature's rows from `oldHref` to `newHref` and nothing else. The route gate
 * (`lib/route-access.ts`, called by `middleware.ts`) stays the only authority on access; `nav-table.test.ts` fails if a row shows a
 * role a link that gate would bounce.
 */
export { NAV_GROUP_LABELS } from './nav/shared';
export { NAV_ROWS, WORKFORCE_ROWS } from './nav/rows';
export { activeFor, hasHubRows, navFor, quickLinksFor, showsBottomBar } from './nav/engine';
export { FLOOR_ROLES, isBareRoute, usesAppShell, usesDesktopShell } from './nav/shell-roles';
export { BADGE_CAPABILITY } from './nav/types';
export type { ActiveNav, NavBadge, NavContext, NavFlag, NavGroup, NavLink, NavLinkSub, NavRow, NavSubRow } from './nav/types';
