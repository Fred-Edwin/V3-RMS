import { ico } from '../nav/shared';
import type { MenuItem } from './menu-types';

/**
 * "My account" (Paper 2.8): the personal links as one more group after the features, Profile among them. The name at the bottom of the
 * menu opens Sign out only (owner decision, 22 Oct 2026).
 */
export const ACCOUNT_KEY = 'feature-account';

export function accountGroupOf(account: MenuItem[]): MenuItem | null {
  const first = account[0];
  if (!first) return null;
  return { key: ACCOUNT_KEY, label: 'My account', href: first.href, icon: ico.me, subItems: account.map((a) => ({ key: a.key, label: a.label, href: a.href, count: a.count, urgent: a.urgent })) };
}
