import { CAPABILITIES, type Capability } from '../../_shared/lib/capabilities';
import { PEOPLE } from './fixtures';
import type { Ctx } from './engine';

/**
 * Used ONLY to build scenarios and tests: the people the mock acts as, with the capabilities the backend table gives each
 * role. Screens never use this; they ask the server's table through `usePermissions()`. A test in the backend keeps the
 * capability NAMES in step; keep these rows in step with `central-store-access.ts` when a role's access changes.
 */
const READ: Capability[] = ['catalog.read', 'catalog.see_costs', 'restock.read', 'suppliers.read_basic', 'suppliers.read', 'payables.read', 'orders.read', 'audit.read', 'central_store.read_any_org'];

export const ROLE_CAPS: Record<keyof typeof PEOPLE, readonly Capability[]> = {
  STORE_MANAGER: CAPABILITIES.filter((c) => c !== 'central_store.read_any_org'),
  SYSTEM_ADMIN: CAPABILITIES,
  ACCOUNTANT: [...READ, 'suppliers.read_payment_details', 'suppliers.write_payment_methods', 'suppliers.upload_documents', 'payables.record_invoice', 'payables.record_payment', 'payables.record_deposit'],
  DIRECTOR: [...READ, 'suppliers.read_payment_details'],
  MANAGER: READ,
  STORE_ATTENDANT: ['catalog.read', 'catalog.add_missing', 'suppliers.read_basic', 'suppliers.quick_add', 'orders.request', 'orders.receive'],
};

export function ctxFor(role: keyof typeof PEOPLE): Ctx {
  const caps = ROLE_CAPS[role];
  return { actor: PEOPLE[role], can: (c) => caps.includes(c) };
}
