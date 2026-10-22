import type { AppRole } from '@/types/auth';
import { navFor } from './engine';
import { ico } from './shared';
import { NAV_ROWS } from './rows';
import type { NavContext, NavGroup, NavLink, NavLinkSub, NavRow } from './types';

/**
 * The menu as Paper 2.1 to 2.7 draws it: three levels. At the top, Home. Then one row per feature (Workforce, Inventory, Operations,
 * Company; a floor person's own work row and a head's Department), each opening with its links, split by small captions. Personal items
 * (My file, My payslips, Profile, ...) are not in the sidebar: they open from the name at the bottom (`account`).
 *
 * It is built from the same table as everything else: Workforce and Department are rows of their own (`rows-workforce.ts`); the older
 * groups are placed under Inventory, Operations, Company or the person's work row by `GROUP_PLACE` below, their group name becoming
 * the caption. A page that has a row is a page that has a link: nothing is dropped, only re-homed.
 */

export type FeatureKey = 'workforce' | 'department' | 'work' | 'inventory' | 'operations' | 'company';

/** Where each older group goes, and the caption its links sit under. */
const GROUP_PLACE: Readonly<Record<string, { feature: FeatureKey | 'account'; caption: string }>> = {
  'feature:company': { feature: 'company', caption: '' },
  'central-store': { feature: 'inventory', caption: 'Central Store' },
  procurement: { feature: 'inventory', caption: 'Procurement' },
  'mgr-operations': { feature: 'operations', caption: 'Operations' },
  'mgr-manage': { feature: 'operations', caption: 'Manage' },
  'mgr-credit': { feature: 'operations', caption: 'Credit' },
  'mgr-income': { feature: 'operations', caption: 'Other income' },
  'mgr-branch': { feature: 'operations', caption: 'Branch' },
  'dir-operations': { feature: 'operations', caption: 'Operations' },
  'dir-branches': { feature: 'operations', caption: 'Branches' },
  'dir-income': { feature: 'operations', caption: 'Other income' },
  'dir-credit': { feature: 'operations', caption: 'Credit' },
  'acc-financials': { feature: 'operations', caption: 'Financials' },
  'acc-credit': { feature: 'operations', caption: 'Credit accounts' },
  branches: { feature: 'operations', caption: 'Branches' },
  'mgr-company': { feature: 'company', caption: '' },
  'dir-company': { feature: 'company', caption: '' },
  'adm-company': { feature: 'company', caption: '' },
  'staff-nav': { feature: 'work', caption: '' },
  'staff-income': { feature: 'work', caption: 'Other income' },
  department: { feature: 'work', caption: 'Department' },
  account: { feature: 'account', caption: '' },
};

export const FEATURE_LABEL: Readonly<Record<Exclude<FeatureKey, 'work'>, string>> = {
  workforce: 'Workforce',
  department: 'Department',
  inventory: 'Inventory',
  operations: 'Operations',
  company: 'Company',
};

/** The order the feature rows appear in: a floor person's work row comes before Department; the desktop roles have Workforce first. */
const FEATURE_ORDER: readonly FeatureKey[] = ['workforce', 'work', 'department', 'inventory', 'operations', 'company'];

/** The work row is named for the department (Paper 11.1 to 11.3). */
const WORK_LABEL: Partial<Record<AppRole, string>> = { WAITER: 'Service', CHEF: 'Kitchen', BARISTA: 'Barista', STEWARD: 'Steward', HOUSEKEEPING: 'Housekeeping' };

export interface MenuModel {
  /** Home. */
  top: NavLink[];
  /** The feature rows, each with `subItems` carrying their captions. */
  features: NavLink[];
  /** Personal items: opened from the name at the bottom. */
  account: NavLink[];
}

const HOME_HREF = '/app/workforce';

const homeLink = (): NavLink => ({ key: 'home', label: 'Home', href: HOME_HREF, icon: ico.home, framed: true, match: [] });

/** A legacy link or its sub-links as sub-links under one caption (the sidebar draws a caption where it changes from the link above). */
function subsOf(link: NavLink, caption: string): NavLinkSub[] {
  if (link.subItems) return link.subItems.map((s) => ({ ...s, section: s.section ?? link.label }));
  return [{ key: link.key, label: link.label, href: link.href, framed: link.framed, match: link.match, badge: link.badge, section: caption || undefined }];
}

export function menuFor(ctx: NavContext, rows: readonly NavRow[] = NAV_ROWS): MenuModel {
  if (!ctx.role) return { top: [], features: [], account: [] };
  const groups = navFor(ctx, rows);
  // The display screens have no sidebar and no Home: nothing to show.
  if (groups.length === 0) return { top: [], features: [], account: [] };
  const buckets = new Map<FeatureKey, NavLinkSub[]>();
  const ready = new Map<FeatureKey, NavLink>();
  const account: NavLink[] = [];
  const adminOnly = ctx.role === 'SYSTEM_ADMIN' && (!ctx.hubRole || ctx.hubRole === 'SYSTEM_ADMIN');

  const push = (feature: FeatureKey, subs: NavLinkSub[]): void => {
    buckets.set(feature, [...(buckets.get(feature) ?? []), ...subs]);
  };

  for (const group of groups) {
    if (group.key === 'feature:workforce' || group.key === 'feature:department') {
      const link = group.items[0];
      if (link) ready.set(group.key === 'feature:workforce' ? 'workforce' : 'department', link);
      continue;
    }
    const place = GROUP_PLACE[group.key];
    if (!place) continue;
    if (place.feature === 'account') {
      account.push(...group.items);
      continue;
    }
    // The System Admin's menu is Home and Company only (Paper 2.x): it acts as a user instead of working in the features. A System Admin
    // previewing another role's Central Store keeps that role's Inventory rows.
    if (adminOnly && place.feature !== 'company') continue;
    for (const item of group.items) push(place.feature, subsOf(item, place.caption));
  }

  const features: NavLink[] = [];
  for (const key of FEATURE_ORDER) {
    const made = ready.get(key);
    if (made) {
      features.push({ ...made, key: `feature-${key}` });
      continue;
    }
    const subs = buckets.get(key);
    if (!subs || subs.length === 0) continue;
    const label = key === 'work' ? (WORK_LABEL[ctx.role] ?? 'Department work') : FEATURE_LABEL[key];
    const first = subs[0] as NavLinkSub;
    features.push({ key: `feature-${key}`, label, href: first.href, icon: featureIcon(key), framed: false, match: [], subItems: subs });
  }

  return { top: [homeLink()], features, account };
}

function featureIcon(key: FeatureKey): NavLink['icon'] {
  switch (key) {
    case 'inventory':
      return ico.truck;
    case 'operations':
      return ico.clipboard;
    case 'company':
      return ico.departments;
    case 'work':
      return ico.chef;
    default:
      return ico.staff;
  }
}

/** The menu as plain groups, for the active-row logic and the Search list: Home, the features, then the personal items. */
export function menuGroups(model: MenuModel): NavGroup[] {
  return [
    { key: 'top', label: '', items: model.top },
    { key: 'features', label: '', items: model.features },
    { key: 'account', label: '', items: model.account },
  ];
}
