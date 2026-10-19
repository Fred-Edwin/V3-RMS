import type { UserRole } from '@prisma/client';
import type { AuditEntryInput } from '../../_shared/audit/audit.types';
import type { WorkforceEvent } from '../../_shared/events';
import type { AccessSubject } from '../../_shared/workforce-access';

/**
 * An in-memory stand-in for the rules tables, for unit tests. Tests mount it with vi.mock on the two repositories, the audit
 * writer and the PIN lookup (see versions-create.test.ts). It copies what the real repositories promise: withdrawn
 * versions are skipped, numbers are never reused, and a read returns a snapshot, never the stored object.
 */

export interface FakeRow {
  id: string;
  companyId: string;
  siteId: string | null;
  group: string;
  version: number;
  effectiveFrom: Date;
  values: unknown;
  valuesSchemaVersion: number;
  reason: string;
  createdById: string;
  createdByRole: string;
  createdAt: Date;
  idempotencyKey: string | null;
  confirmations: { id: string; ruleVersionId: string; scope: string; confirmedById: string; confirmerRole: string; confirmedAt: Date; note: string | null }[];
  withdrawal: { id: string; ruleVersionId: string; withdrawnById: string; withdrawnByRole: string; withdrawnAt: Date; reason: string } | null;
}

export const SITES: Record<string, { companyId: string; name: string; type: 'BRANCH' | 'CENTRAL_STORE' }> = {
  s0: { companyId: 'c1', name: 'Head office', type: 'BRANCH' },
  s1: { companyId: 'c1', name: 'Nyeri Town', type: 'BRANCH' },
  s2: { companyId: 'c1', name: 'Nyeri Highway', type: 'BRANCH' },
  sc: { companyId: 'c1', name: 'Central Store', type: 'CENTRAL_STORE' },
  sx: { companyId: 'c2', name: 'Other company', type: 'BRANCH' },
};

export const USERS: Record<string, { name: string; role: UserRole; siteId: string | null; pin: string | null }> = {
  dir: { name: 'Dina Director', role: 'DIRECTOR', siteId: 's0', pin: '1234' },
  dir2: { name: 'Dev Director', role: 'DIRECTOR', siteId: 's0', pin: '1234' },
  bm1: { name: 'Bea Branch', role: 'MANAGER', siteId: 's1', pin: '1234' },
  bm2: { name: 'Ben Branch', role: 'MANAGER', siteId: 's2', pin: '1234' },
  sm: { name: 'Sam Store', role: 'STORE_MANAGER', siteId: 'sc', pin: '1234' },
  acc: { name: 'Ann Accountant', role: 'ACCOUNTANT', siteId: 's0', pin: '1234' },
  hr: { name: 'Hana HR', role: 'HR_MANAGER', siteId: 's0', pin: '1234' },
  adm: { name: 'Ada Admin', role: 'SYSTEM_ADMIN', siteId: null, pin: '1234' },
  w1: { name: 'Wes Waiter', role: 'WAITER', siteId: 's1', pin: '1234' },
  nopin: { name: 'No Pin', role: 'DIRECTOR', siteId: 's0', pin: null },
};

export const HEADS: Record<string, string[]> = { s1: ['head1'], s2: ['head2'] };

export const state = {
  rows: [] as FakeRow[],
  entries: [] as AuditEntryInput[],
  events: [] as WorkforceEvent[],
  failCreate: false,
  counter: 0,
};

export const reset = (): void => {
  state.rows.length = 0;
  state.entries.length = 0;
  state.events.length = 0;
  state.failCreate = false;
  state.counter = 0;
};

export const as = (id: string): AccessSubject => ({ id, role: USERS[id]!.role, siteId: USERS[id]!.siteId });
export const day = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

const snap = (row: FakeRow | null | undefined): FakeRow | null => (row ? { ...row, confirmations: [...row.confirmations] } : null);
const inScope = (companyId: string, siteId: string | null, group: string) => state.rows.filter((r) => r.companyId === companyId && r.siteId === siteId && r.group === group);
const live = (rows: FakeRow[]) => rows.filter((r) => r.withdrawal === null);
const newest = (rows: FakeRow[]) => [...rows].sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || b.version - a.version);

/** Put a version straight into the store (as if made earlier). */
export const seed = (over: Partial<FakeRow> & { group: string; values: unknown }): FakeRow => {
  const row: FakeRow = {
    id: `seed${state.rows.length + 1}`,
    companyId: 'c1',
    siteId: null,
    version: 1,
    effectiveFrom: day('2026-09-01'),
    valuesSchemaVersion: 1,
    reason: 'seed',
    createdById: 'dir',
    createdByRole: 'DIRECTOR',
    createdAt: new Date(),
    idempotencyKey: null,
    confirmations: [],
    withdrawal: null,
    ...over,
  };
  state.rows.push(row);
  return row;
};

export const fakeRulesRepository = {
  findSite: async (id: string) => (SITES[id] ? { id, ...SITES[id]! } : null),
  findSites: async (companyId: string) => Object.entries(SITES).filter(([, s]) => s.companyId === companyId).map(([id, s]) => ({ id, name: s.name, type: s.type })),
  findUser: async (id: string) => {
    const user = USERS[id];
    return user ? { id, name: user.name, role: user.role, site: user.siteId ? { companyId: SITES[user.siteId]!.companyId } : null } : null;
  },
  findOnlyCompanyId: async () => 'c1',
  findUserNames: async (_company: string, ids: string[]) => new Map(ids.filter((id) => USERS[id]).map((id) => [id, USERS[id]!.name])),
  findActiveUsers: async (_company: string, roles: UserRole[], siteId: string | null) =>
    Object.entries(USERS)
      .filter(([, u]) => roles.includes(u.role) && (siteId === null || u.siteId === siteId))
      .map(([id]) => ({ id })),
  findHeadUserIds: async (_company: string, siteId: string | null) => (siteId ? (HEADS[siteId] ?? []) : Object.values(HEADS).flat()),
  findEffective: async (companyId: string, siteId: string | null, group: string, date: Date) =>
    snap(newest(live(inScope(companyId, siteId, group)).filter((r) => r.effectiveFrom.getTime() <= date.getTime()))[0]),
  findChainUpTo: async (companyId: string, group: string, date: Date) =>
    newest(live(inScope(companyId, null, group)).filter((r) => r.effectiveFrom.getTime() <= date.getTime())).map((r) => snap(r)!),
  findScheduled: async (companyId: string, siteId: string | null, group: string, today: Date) =>
    snap([...live(inScope(companyId, siteId, group)).filter((r) => r.effectiveFrom.getTime() > today.getTime())].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime() || a.version - b.version)[0]),
  findSiteOverrides: async (companyId: string, group: string, today: Date) =>
    newest(live(state.rows.filter((r) => r.companyId === companyId && r.siteId !== null && r.group === group && r.effectiveFrom.getTime() <= today.getTime()))).map((r) => snap(r)!),
  latestOfScope: async (companyId: string, siteId: string | null, group: string) => {
    const all = inScope(companyId, siteId, group);
    if (all.length === 0) return null;
    const top = newest(live(all))[0];
    return { number: Math.max(...all.map((r) => r.version)), live: top ? { version: top.version, effectiveFrom: top.effectiveFrom } : null };
  },
  listVersionsPage: async (companyId: string, group: string, siteId: string | null, skip: number, take: number) => {
    const all = [...inScope(companyId, siteId, group)].sort((a, b) => b.version - a.version);
    return { rows: all.slice(skip, skip + take + 1).map((r) => snap(r)!), total: all.length };
  },
  findByNumber: async (companyId: string, siteId: string | null, group: string, version: number) => snap(inScope(companyId, siteId, group).find((r) => r.version === version)),
  findVersion: async (companyId: string, id: string) => snap(state.rows.find((r) => r.id === id && r.companyId === companyId)),
  findByKey: async (companyId: string, key: string) => snap(state.rows.find((r) => r.companyId === companyId && r.idempotencyKey === key)),
};

export const fakeVersionsRepository = {
  lockScope: async () => undefined,
  createVersion: async (_tx: unknown, data: Omit<FakeRow, 'id' | 'createdAt' | 'confirmations' | 'valuesSchemaVersion' | 'withdrawal'>) => {
    if (state.failCreate) throw new Error('database down');
    const row: FakeRow = { ...data, id: `rv${state.rows.length + 1}`, createdAt: new Date(), valuesSchemaVersion: 1, confirmations: [], withdrawal: null };
    state.rows.push(row);
    return snap(row)!;
  },
  createConfirmation: async (_tx: unknown, data: { ruleVersionId: string; scope: string; confirmedById: string; confirmerRole: string; note: string | null }) => {
    state.counter += 1;
    const confirmation = { id: `rc${state.counter}`, confirmedAt: new Date(), ...data };
    state.rows.find((r) => r.id === data.ruleVersionId)?.confirmations.push(confirmation);
    return confirmation;
  },
  createWithdrawal: async (_tx: unknown, data: { ruleVersionId: string; withdrawnById: string; withdrawnByRole: string; reason: string }) => {
    const withdrawal = { id: `rw${state.rows.length}`, withdrawnAt: new Date(), ...data };
    const row = state.rows.find((r) => r.id === data.ruleVersionId);
    if (row) row.withdrawal = withdrawal;
    return withdrawal;
  },
};

type Change<T> = (tx: unknown) => Promise<{ result: T; entries: AuditEntryInput[]; events?: WorkforceEvent[] }>;

/** Like the real one: runs the change, then records the entries and events. A throw records nothing. */
export const fakeRunAudited = async <T>(change: Change<T>): Promise<T> => {
  const done = await change({});
  state.entries.push(...done.entries);
  state.events.push(...(done.events ?? []));
  return done.result;
};

export const fakePinHash = async (userId: string): Promise<string | null> => USERS[userId]?.pin ?? null;
