import type { AppRole } from '@/types/auth';
import { NAV_ROWS } from './rows';
import { NAV_GROUP_LABELS } from './shared';
import {
  BADGE_CAPABILITY,
  type ActiveNav,
  type NavBadge,
  type NavContext,
  type NavGroup,
  type NavLink,
  type NavLinkSub,
  type NavRow,
  type Visibility,
} from './types';

/** Turns the table's rows into one person's sidebar. Pure, so it can be tested without a browser. */

const visible = (rule: Visibility, actor: AppRole, ctx: NavContext): boolean =>
  !rule.notBuilt &&
  (!rule.needsAttendance || ctx.attendanceOn === true) &&
  (!rule.oldOnlyWhenSwitchOff || ctx.attendanceOn !== true) &&
  (!rule.needsPayroll || ctx.payrollOn === true) &&
  (!rule.oldOnlyWhenPayrollOff || ctx.payrollOn !== true) &&
  rule.roles.includes(actor) &&
  (!rule.capability || ctx.can(rule.capability)) &&
  (!rule.anyCapability || rule.anyCapability.some(ctx.can)) &&
  (rule.flag !== 'credit' || ctx.creditAccounts) &&
  (!rule.departmentHead || ctx.isDepartmentHead) &&
  (!rule.departmentMemberOnly || (ctx.isDepartmentMember === true && !ctx.isDepartmentHead)) &&
  (!rule.hideForDepartmentHead || !(ctx.isDepartmentHead || ctx.isDepartmentMember === true));

/** The badge a person may see: dropped when the badge needs a capability they do not hold. */
const badgeFor = (badge: NavBadge | undefined, ctx: NavContext): NavBadge | undefined => {
  if (!badge) return undefined;
  const needs = BADGE_CAPABILITY[badge];
  return needs && !ctx.can(needs) ? undefined : badge;
};

const hrefOf = (row: { oldHref?: string; newHref?: string }): string => row.newHref ?? row.oldHref ?? '#';

/** The sidebar for one person: the rows they may see, grouped, in table order. */
export function navFor(ctx: NavContext, rows: readonly NavRow[] = NAV_ROWS): NavGroup[] {
  if (!ctx.role) return [];
  const groups = new Map<string, NavLink[]>();
  const add = (groupKey: string, link: NavLink): void => {
    const items = groups.get(groupKey);
    if (items) items.push(link);
    else groups.set(groupKey, [link]);
  };

  for (const row of rows) {
    const actor = row.hub ? (ctx.hubRole ?? ctx.role) : ctx.role;
    if (!visible(row, actor, ctx)) continue;
    const framed = row.framed ?? Boolean(row.newHref);
    const match = row.match ?? [];

    if (row.expand === 'branches') {
      for (const branch of ctx.branches ?? []) {
        add(row.group, { key: `${row.key}-${branch.id}`, label: branch.name, href: hrefOf(row).replace(':id', branch.id), icon: row.icon, framed, match });
      }
      continue;
    }

    if (row.subItems) {
      const subItems = row.subItems
        .filter((sub) => visible(sub, actor, ctx))
        .map((sub): NavLinkSub => ({ key: sub.key, label: sub.label, href: hrefOf(sub), framed: sub.framed ?? Boolean(sub.newHref), match: sub.match ?? [], badge: badgeFor(sub.badge, ctx), section: sub.section }));
      const first = subItems[0];
      if (first) add(row.group, { key: row.key, label: row.label, href: first.href, icon: row.icon, framed, match, badge: badgeFor(row.badge, ctx), subItems });
      continue;
    }

    add(row.group, { key: row.key, label: row.label, href: hrefOf(row), icon: row.icon, framed, match, badge: badgeFor(row.badge, ctx), quick: row.quick?.[actor], hideBar: row.hideBar });
  }

  return Array.from(groups.entries()).map(([key, items]) => ({ key, label: NAV_GROUP_LABELS[key] ?? key.toUpperCase(), items }));
}

/** The phone bottom bar's links for one person: the rows that have a slot for their role, in slot order. Empty means no bar. */
export function quickLinksFor(groups: readonly NavGroup[]): NavLink[] {
  return groups
    .flatMap((group) => group.items)
    .filter((link) => link.quick !== undefined)
    .sort((a, b) => (a.quick ?? 0) - (b.quick ?? 0));
}

/**
 * Whether the bottom bar shows on this page: only on a page the menu links to, never on a task screen reached from one (a count, a
 * confirm, a send sheet) or on a row that draws its own sticky bar (`hideBar`), so two bars never stack.
 */
export function showsBottomBar(groups: readonly NavGroup[], pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  // Workforce pages draw their own top bar and, like Workforce Home, no order tabs (My file and My payslips used to show them).
  if (path === '/app/workforce' || path.startsWith('/app/workforce/')) return false;
  return groups.some((group) =>
    group.items.some((link) => (link.subItems ? link.subItems.some((sub) => sub.href === path) : link.href === path && !link.hideBar))
  );
}

const under = (pathname: string, prefix: string): boolean => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Paths whose pages always draw their own top bar, even when no row matches them (screens reached from a row, phone-first task routes). */
const SELF_FRAMED_PREFIXES: readonly string[] = ['/app/inventory', '/app/branch', '/app/workforce/my-file', '/app/workforce/attendance', '/app/workforce/needs-you', '/app/workforce/notifications', '/app/not-available', '/app/workforce/team', '/app/workforce/probation'];

/** Which row (and sub-link) the current path lights: the longest matching prefix wins, so `/app/director/analytics` beats `/app/director`. */
export function activeFor(groups: readonly NavGroup[], pathname: string): ActiveNav {
  let best: { length: number; link: NavLink; sub?: NavLinkSub; group: NavGroup } | null = null;
  const consider = (prefixes: readonly string[], link: NavLink, group: NavGroup, sub?: NavLinkSub): void => {
    for (const prefix of prefixes) {
      if (!under(pathname, prefix)) continue;
      // On a tie the sub-link wins over its parent, so `/app/inventory/stock` lights "Overview".
      if (!best || prefix.length > best.length || (sub && prefix.length === best.length)) best = { length: prefix.length, link, sub, group };
    }
  };
  for (const group of groups) {
    for (const link of group.items) {
      if (!link.subItems) consider([link.href, ...link.match], link, group);
      else {
        consider(link.match, link, group);
        for (const sub of link.subItems) consider([sub.href, ...sub.match], link, group, sub);
      }
    }
  }
  const hit = best as { link: NavLink; sub?: NavLinkSub; group: NavGroup } | null;
  // Workforce Home draws its own top bar for every role, including a department head who has no Home row yet (finding 60).
  if (!hit) return { activeKey: '', framed: pathname.replace(/\/+$/, '') === '/app/workforce' || SELF_FRAMED_PREFIXES.some((p) => under(pathname, p)) };
  return {
    activeKey: hit.link.key,
    activeSubKey: hit.sub?.key,
    framed: hit.sub?.framed ?? hit.link.framed,
    groupLabel: hit.group.label,
    label: hit.sub?.label ?? hit.link.label,
  };
}

/** True when the role has any Central Store row, so the shell asks the server for that role's capabilities only when it needs them. */
export const hasHubRows = (role: AppRole | null | undefined): boolean => Boolean(role) && NAV_ROWS.some((row) => row.hub && role !== null && role !== undefined && row.roles.includes(role));
