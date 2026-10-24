/** A role in plain words, for "name plus role" lines (the naming rule: never a bare person name). */
const ROLE_WORDS: Record<string, string> = {
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
  STEWARD: 'Steward',
  HOUSEKEEPING: 'Housekeeping',
  MANAGER: 'Branch Manager',
  STORE_MANAGER: 'Store Manager',
  STORE_ATTENDANT: 'Store Attendant',
  HR_MANAGER: 'HR',
  ACCOUNTANT: 'Accountant',
  DIRECTOR: 'Director',
  SYSTEM_ADMIN: 'System Admin',
};

export const roleWords = (role: string | null | undefined): string => (role ? (ROLE_WORDS[role] ?? role.toLowerCase().replace(/_/g, ' ')) : '');

/** "Cynthia Wairimu, Barista". */
export const nameAndRole = (name: string, role: string | null | undefined): string => {
  const r = roleWords(role);
  return r ? `${name}, ${r}` : name;
};
