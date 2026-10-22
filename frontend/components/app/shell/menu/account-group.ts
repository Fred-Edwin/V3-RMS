import { ico } from '../nav/shared';
import type { MenuItem } from './menu-types';

/**
 * "My account" (Paper 2.8): the personal links as one more group after the features. A person whose only personal link is Profile has
 * no group: Profile stays under the name.
 */
export const ACCOUNT_KEY = 'feature-account';

export function accountGroupOf(account: MenuItem[]): MenuItem | null {
  const first = account[0];
  if (!first || account.length < 2) return null;
  return { key: ACCOUNT_KEY, label: 'My account', href: first.href, icon: ico.me, subItems: account.map((a) => ({ key: a.key, label: a.label, href: a.href, count: a.count, urgent: a.urgent })) };
}

/** What the name at the bottom still opens besides Sign out: Profile when the group exists, every personal link when it does not. */
export function underNameOf(account: MenuItem[], hasGroup: boolean): MenuItem[] {
  return hasGroup ? account.filter((a) => a.label === 'Profile') : account;
}
