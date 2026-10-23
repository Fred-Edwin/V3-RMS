import { describe, expect, it } from 'vitest';
import { ico } from '../nav/shared';
import { ACCOUNT_KEY, accountGroupOf } from './account-group';
import type { MenuItem } from './menu-types';

const item = (key: string, label: string): MenuItem => ({ key, label, href: `/app/${key}`, icon: ico.me });

describe('My account group', () => {
  it('holds every personal link, in order, under the name "My account"', () => {
    const account = [item('me-file', 'My file'), item('me-leave', 'My leave'), item('profile', 'Profile')];
    const group = accountGroupOf(account);
    expect(group?.key).toBe(ACCOUNT_KEY);
    expect(group?.label).toBe('My account');
    expect(group?.subItems?.map((s) => s.label)).toEqual(['My file', 'My leave', 'Profile']);
    expect(group?.href).toBe('/app/me-file');
  });

  it('holds Profile even when it is the only personal link', () => {
    expect(accountGroupOf([item('profile', 'Profile')])?.subItems?.map((s) => s.label)).toEqual(['Profile']);
    expect(accountGroupOf([])).toBeNull();
  });
});
