import type { UserRole } from '@prisma/client';
import type { TypeBalance, TypeSnapshot, LeaveTypeRule } from './leave.types';
import type { DeciderRole } from './leave.constants';

/** The deciding role in the words the screens use ("Send to your Branch Manager"). */
export const DECIDER_WORDS: Record<DeciderRole, string> = {
  MANAGER: 'Branch Manager',
  STORE_MANAGER: 'Store Manager',
  HR_MANAGER: 'HR',
  DIRECTOR: 'Director',
};

const ROLE_WORDS: Partial<Record<UserRole, string>> = {
  SYSTEM_ADMIN: 'System Admin',
  DIRECTOR: 'Director',
  HR_MANAGER: 'HR Manager',
  MANAGER: 'Branch Manager',
  ACCOUNTANT: 'Accountant',
  STORE_MANAGER: 'Store Manager',
  STORE_ATTENDANT: 'Store Attendant',
  DEPARTMENT_HEAD: 'Department head',
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
  KITCHEN_DISPLAY: 'Kitchen screen',
  BARISTA_DISPLAY: 'Barista screen',
  STEWARD: 'Steward',
  HOUSEKEEPING: 'Housekeeping',
};

/** "Name, Role" for records (never a bare name, spec L29 and section 16). */
export const nameAndRole = (name: string, positionName: string | null, role: UserRole | null): string => `${name}, ${positionName ?? (role ? ROLE_WORDS[role] : undefined) ?? 'Staff'}`;

export const roleWord = (role: string | null): string => (role && (ROLE_WORDS[role as UserRole] ?? DECIDER_WORDS[role as DeciderRole])) || 'Staff';

export const snapshotOfType = (type: LeaveTypeRule): TypeSnapshot => ({
  code: type.code,
  label: type.label,
  paid: type.paid,
  approvedBy: type.approvedBy,
  requiresReason: type.requiresReason,
  sickNoteAfterDays: type.sickNoteAfterDays,
  accrual: type.accrual,
});

export const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** The card's spoken label: "Annual leave, 12 of 21 days left, 9 taken, 0 booked". */
export const spokenLabel = (card: TypeBalance): string => `${card.label}, ${card.left}${card.perYear ? ` of ${card.perYear}` : ''} days left, ${card.taken} taken, ${card.booked} booked`;
