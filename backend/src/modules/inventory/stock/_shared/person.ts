import type { Person } from '../../_shared/wire';

/** Who a person is on the wire (`personSchema`): initials and a plain role label. */
export type PersonRow = { id: string; name: string; role: string };

const ROLE_LABELS: Record<string, string> = {
  STORE_MANAGER: 'Store Manager',
  STORE_ATTENDANT: 'Store Attendant',
  SYSTEM_ADMIN: 'System Admin',
  DIRECTOR: 'Director',
  ACCOUNTANT: 'Accountant',
  MANAGER: 'Branch Manager',
};

export const roleLabelOf = (role: string): string =>
  ROLE_LABELS[role] ?? role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
};

export const toPerson = (user: PersonRow): Person => ({ id: user.id, name: user.name, initials: initialsOf(user.name), roleLabel: roleLabelOf(user.role) });
