/**
 * Fixture mode only (`NEXT_PUBLIC_SCW_FIXTURES=1`): which role the fixture handlers answer as. The dev story page
 * (`/app/inventory/stock/fixtures`) switches it. Nothing outside the fixture handlers and this file names a role; screens read
 * `can` flags and whether a response key is present, exactly as against the real back end.
 */
import type { Capability } from '../lib/capabilities';

export type FixtureRole = 'STORE_MANAGER' | 'STORE_ATTENDANT' | 'DIRECTOR' | 'ACCOUNTANT' | 'BRANCH_MANAGER' | 'SYSTEM_ADMIN';

export const FIXTURE_ROLES: { role: FixtureRole; label: string }[] = [
  { role: 'STORE_MANAGER', label: 'Store Manager' },
  { role: 'STORE_ATTENDANT', label: 'Store Attendant' },
  { role: 'DIRECTOR', label: 'Director' },
  { role: 'ACCOUNTANT', label: 'Accountant' },
  { role: 'BRANCH_MANAGER', label: 'Branch Manager' },
  { role: 'SYSTEM_ADMIN', label: 'System Admin' },
];

const READS: Capability[] = ['catalog.read', 'catalog.see_costs', 'restock.read', 'stock.read', 'counts.read', 'waste.read'];

/** A copy of the capability grid for the six roles, for fixtures only. The real table is the back end's. */
const GRID: Record<FixtureRole, Capability[]> = {
  STORE_MANAGER: [...READS, 'counts.record', 'counts.resolve', 'counts.setup', 'waste.log', 'waste.reverse_own', 'waste.reverse_any'],
  SYSTEM_ADMIN: [
    ...READS,
    'counts.record', 'counts.resolve', 'counts.setup', 'counts.acknowledge', 'counts.set_director_alert',
    'waste.log', 'waste.reverse_own', 'waste.reverse_any',
  ],
  DIRECTOR: [...READS, 'counts.acknowledge', 'counts.set_director_alert'],
  ACCOUNTANT: [...READS],
  BRANCH_MANAGER: [...READS],
  STORE_ATTENDANT: ['catalog.read', 'catalog.see_costs', 'counts.record', 'waste.read', 'waste.log', 'waste.reverse_own'],
};

const KEY = 'scw-fixture-role';
let current: FixtureRole = 'STORE_MANAGER';
const listeners = new Set<() => void>();

function load(): void {
  try {
    const stored = window.localStorage.getItem(KEY) as FixtureRole | null;
    if (stored && stored in GRID) current = stored;
  } catch {
    // Blocked storage: the default role stands.
  }
}
if (typeof window !== 'undefined') load();

export const getFixtureRole = (): FixtureRole => current;
export const fixtureCapabilities = (): Capability[] => GRID[current];
export const fixtureCan = (capability: Capability): boolean => GRID[current].includes(capability);

export function setFixtureRole(role: FixtureRole): void {
  current = role;
  try {
    window.localStorage.setItem(KEY, role);
  } catch {
    // Blocked storage: the choice lasts until reload.
  }
  listeners.forEach((l) => l());
}

export function subscribeFixtureRole(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
