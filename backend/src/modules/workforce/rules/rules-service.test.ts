import type { UserRole } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEntryInput } from '../_shared/audit/audit.types';
import type { WorkforceEvent } from '../_shared/events';
import { parseNairobiDate } from '../_shared/time/nairobi-time';
import type { AccessSubject } from '../_shared/workforce-access';
import { RULE_DEFAULTS } from './rules-defaults';

interface Row {
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
  confirmations: { id: string; ruleVersionId: string; scope: string; confirmedById: string; confirmerRole: string; confirmedAt: Date; note: string | null }[];
}

const h = vi.hoisted(() => ({
  store: [] as Row[],
  entries: [] as AuditEntryInput[],
  events: [] as WorkforceEvent[],
  failCreate: false,
  confirmationsCreated: 0,
}));

const SITES: Record<string, string> = { s0: 'c1', s1: 'c1', s2: 'c1', sx: 'c2' };
const USERS: Record<string, { name: string; role: UserRole; siteId: string | null }> = {
  dir: { name: 'Dina Director', role: 'DIRECTOR', siteId: 's0' },
  bm1: { name: 'Bea Branch', role: 'MANAGER', siteId: 's1' },
  bm2: { name: 'Ben Branch', role: 'MANAGER', siteId: 's2' },
  acc: { name: 'Ann Accountant', role: 'ACCOUNTANT', siteId: 's0' },
  hr: { name: 'Hana HR', role: 'HR_MANAGER', siteId: 's0' },
  adm: { name: 'Ada Admin', role: 'SYSTEM_ADMIN', siteId: null },
  w1: { name: 'Wes Waiter', role: 'WAITER', siteId: 's1' },
};

vi.mock('../_shared/audit/audit-writer', () => ({
  runAudited: async (change: (tx: unknown) => Promise<{ result: unknown; entries: AuditEntryInput[]; events?: WorkforceEvent[] }>) => {
    const done = await change({});
    h.entries.push(...done.entries);
    h.events.push(...(done.events ?? []));
    return done.result;
  },
}));

vi.mock('./rules-repository', () => {
  const sorted = (rows: Row[]) => [...rows].sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || b.version - a.version);
  // The real repository returns a snapshot of the row, never the stored object itself.
  const snap = (row: Row | null | undefined): Row | null => (row ? { ...row, confirmations: [...row.confirmations] } : null);
  const scoped = (companyId: string, siteId: string | null, group: string) => h.store.filter((r) => r.companyId === companyId && r.siteId === siteId && r.group === group);
  return {
    rulesRepository: {
      findSite: async (id: string) => (SITES[id] ? { id, companyId: SITES[id] } : null),
      findUser: async (id: string) => {
        const user = USERS[id];
        return user ? { id, name: user.name, role: user.role, site: user.siteId ? { companyId: SITES[user.siteId] } : null } : null;
      },
      findOnlyCompanyId: async () => 'c1',
      findUserNames: async (_company: string, ids: string[]) => new Map(ids.filter((id) => USERS[id]).map((id) => [id, USERS[id]!.name])),
      findActiveUsers: async (_company: string, roles: UserRole[], siteId: string | null) =>
        Object.entries(USERS)
          .filter(([, u]) => roles.includes(u.role) && (siteId === null || u.siteId === siteId))
          .map(([id]) => ({ id })),
      findEffective: async (companyId: string, siteId: string | null, group: string, date: Date) =>
        snap(sorted(scoped(companyId, siteId, group).filter((r) => r.effectiveFrom.getTime() <= date.getTime()))[0]),
      findByNumber: async (companyId: string, siteId: string | null, group: string, version: number) => scoped(companyId, siteId, group).find((r) => r.version === version) ?? null,
      latestOfScope: async (companyId: string, siteId: string | null, group: string) => {
        const rows = scoped(companyId, siteId, group);
        if (rows.length === 0) return null;
        return { version: Math.max(...rows.map((r) => r.version)), effectiveFrom: sorted(rows)[0]!.effectiveFrom };
      },
      listVersions: async (companyId: string, group: string, siteId: string | null) => [...scoped(companyId, siteId, group)].sort((a, b) => b.version - a.version),
      findVersion: async (companyId: string, id: string) => snap(h.store.find((r) => r.id === id && r.companyId === companyId)),
      createVersion: async (_tx: unknown, data: Omit<Row, 'id' | 'createdAt' | 'confirmations' | 'valuesSchemaVersion'>) => {
        if (h.failCreate) throw new Error('database down');
        const row: Row = { ...data, id: `rv${h.store.length + 1}`, createdAt: new Date(), valuesSchemaVersion: 1, confirmations: [] };
        h.store.push(row);
        return row;
      },
      createConfirmation: async (_tx: unknown, data: { ruleVersionId: string; scope: string; confirmedById: string; confirmerRole: string; note: string | null }) => {
        h.confirmationsCreated += 1;
        const confirmation = { id: `rc${h.confirmationsCreated}`, confirmedAt: new Date(), ...data };
        h.store.find((r) => r.id === data.ruleVersionId)?.confirmations.push(confirmation);
        return confirmation;
      },
    },
  };
});

import { getEffectiveRules, getEffectiveRuleGroup, isPayConfirmed, rulesService } from './rules-service';

const as = (id: string): AccessSubject => ({ id, role: USERS[id]!.role, siteId: USERS[id]!.siteId });
const date = parseNairobiDate;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const seed = (over: Partial<Row> & { group: string; values: unknown }): Row => {
  const row: Row = {
    id: `seed${h.store.length + 1}`,
    companyId: 'c1',
    siteId: null,
    version: 1,
    effectiveFrom: day('2026-09-01'),
    valuesSchemaVersion: 1,
    reason: 'seed',
    createdById: 'dir',
    createdByRole: 'DIRECTOR',
    createdAt: new Date(),
    confirmations: [],
    ...over,
  };
  h.store.push(row);
  return row;
};

const lateness = (over: Record<string, unknown> = {}) => ({ ...RULE_DEFAULTS.LATENESS, ...over });
const siteLateness = (over: Record<string, unknown> = {}) => {
  const { deductionCapPercentOfPay: _cap, ...rest } = RULE_DEFAULTS.LATENESS;
  return { ...rest, ...over };
};
const create = (actor: string, over: Record<string, unknown> = {}) =>
  rulesService.createVersion(as(actor), {
    group: 'LATENESS',
    siteId: null,
    effectiveFrom: date('2026-10-06'),
    values: lateness({ graceMinutes: 10 }),
    reason: 'Because',
    ...over,
  } as Parameters<typeof rulesService.createVersion>[1]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T08:00:00Z')); // 11:00 in Nairobi
  h.store.length = 0;
  h.entries.length = 0;
  h.events.length = 0;
  h.failCreate = false;
  h.confirmationsCreated = 0;
});
afterEach(() => vi.useRealTimers());

describe('resolution', () => {
  it('serves the code defaults as version 0 when nothing exists', async () => {
    const rules = await getEffectiveRules('s1', date('2026-10-06'));
    expect(rules.LATENESS).toMatchObject({ isDefault: true, companyVersion: 0, siteVersion: null, effectiveFrom: null });
    expect(rules.LATENESS.values).toEqual(RULE_DEFAULTS.LATENESS);
    expect(rules.STATUTORY.values).toEqual({ tables: [] });
    expect(rules.HOLIDAYS.values.enabled).toBe(false);
  });

  it('picks the company version by date, and a later one is not yet in force', async () => {
    seed({ group: 'LATENESS', version: 1, effectiveFrom: day('2026-09-01'), values: lateness({ graceMinutes: 10 }) });
    seed({ group: 'LATENESS', version: 2, effectiveFrom: day('2026-10-20'), values: lateness({ graceMinutes: 15 }) });
    expect((await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS')).values.graceMinutes).toBe(10);
    expect((await getEffectiveRuleGroup('s1', date('2026-10-20'), 'LATENESS')).values.graceMinutes).toBe(15);
    expect((await getEffectiveRuleGroup('s1', date('2026-08-01'), 'LATENESS')).isDefault).toBe(true);
  });

  it('on a tie the higher version wins', async () => {
    seed({ group: 'LATENESS', version: 1, effectiveFrom: day('2026-10-01'), values: lateness({ graceMinutes: 10 }) });
    seed({ group: 'LATENESS', version: 2, effectiveFrom: day('2026-10-01'), values: lateness({ graceMinutes: 12 }) });
    expect(await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS')).toMatchObject({ companyVersion: 2, values: { graceMinutes: 12 } });
  });

  it('a site override supplies only its fields; a company change to another field reaches the site', async () => {
    seed({ group: 'LATENESS', version: 1, values: lateness({ graceMinutes: 10, deductionCapPercentOfPay: 20 }) });
    seed({ group: 'LATENESS', siteId: 's1', version: 1, values: siteLateness({ graceMinutes: 3 }) });
    const atS1 = await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS');
    expect(atS1.values).toMatchObject({ graceMinutes: 3, deductionCapPercentOfPay: 20 });
    expect(atS1.siteVersion).toBe(1);
    expect((await getEffectiveRuleGroup('s2', date('2026-10-06'), 'LATENESS')).values.graceMinutes).toBe(10);
  });

  it('refuses stored values that no longer pass the schema', async () => {
    seed({ group: 'LATENESS', values: lateness({ graceMinutes: 'ten' }) });
    await expect(getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS')).rejects.toThrow();
  });
});

describe('createVersion: who may write', () => {
  it('the Director writes a company default; every Branch Manager is told', async () => {
    const { version, notice } = await create('dir');
    expect(version).toMatchObject({ version: 1, group: 'LATENESS', siteId: null, changedFields: ['graceMinutes'], reason: 'Because' });
    expect(notice.recipients).toEqual([
      { userId: 'bm1', audience: 'ALL_BRANCH_MANAGERS' },
      { userId: 'bm2', audience: 'ALL_BRANCH_MANAGERS' },
    ]);
  });

  it('a Branch Manager writes their own branch’s override; the Director is told', async () => {
    const { version, notice } = await create('bm1', { siteId: 's1', values: siteLateness({ graceMinutes: 3 }) });
    expect(version).toMatchObject({ siteId: 's1', version: 1 });
    expect(notice.recipients).toEqual([{ userId: 'dir', audience: 'DIRECTOR' }]);
  });

  it('a Branch Manager cannot write a company default or another branch', async () => {
    await expect(create('bm1')).rejects.toMatchObject({ statusCode: 403, code: 'RULE_FIELD_NOT_EDITABLE' });
    await expect(create('bm1', { siteId: 's2', values: siteLateness({ graceMinutes: 3 }) })).rejects.toMatchObject({ statusCode: 403 });
    expect(h.store).toHaveLength(0);
  });

  it('a Branch Manager cannot override a company-wide field', async () => {
    await expect(create('bm1', { siteId: 's1', values: { ...siteLateness({ graceMinutes: 3 }), deductionCapPercentOfPay: 10 } })).rejects.toMatchObject({
      statusCode: 400,
      code: 'RULE_SITE_FIELD_NOT_OVERRIDABLE',
    });
    await expect(
      create('bm1', { group: 'ATTENDANCE', siteId: 's1', values: RULE_DEFAULTS.ATTENDANCE }),
    ).rejects.toMatchObject({ code: 'RULE_SITE_FIELD_NOT_OVERRIDABLE' });
  });

  it('HR cannot change lateness', async () => {
    await expect(create('hr')).rejects.toMatchObject({ statusCode: 403, code: 'RULE_FIELD_NOT_EDITABLE' });
  });

  it('a site of another company is not found', async () => {
    await expect(create('dir', { siteId: 'sx', values: siteLateness({ graceMinutes: 3 }) })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a person with no site resolves to the one company (System Admin)', async () => {
    expect((await create('adm')).version.version).toBe(1);
  });
});

describe('createVersion: dates and changes', () => {
  it('refuses a start date in the past', async () => {
    await expect(create('dir', { effectiveFrom: date('2026-10-05') })).rejects.toMatchObject({ statusCode: 400, code: 'RULE_BACKDATED' });
  });

  it('refuses a date earlier than a version already stored, and names it', async () => {
    seed({ group: 'LATENESS', version: 1, effectiveFrom: day('2026-10-20'), values: lateness({ graceMinutes: 12 }) });
    await expect(create('dir', { effectiveFrom: date('2026-10-10') })).rejects.toMatchObject({ statusCode: 409, code: 'RULE_FUTURE_VERSION_EXISTS' });
  });

  it('a new version on the same date wins', async () => {
    await create('dir', { effectiveFrom: date('2026-10-20') });
    const second = await create('dir', { effectiveFrom: date('2026-10-20'), values: lateness({ graceMinutes: 12 }) });
    expect(second.version.version).toBe(2);
    expect((await getEffectiveRuleGroup('s1', date('2026-10-20'), 'LATENESS')).values.graceMinutes).toBe(12);
  });

  it('refuses a change that changes nothing', async () => {
    await expect(create('dir', { values: lateness() })).rejects.toMatchObject({ statusCode: 409, code: 'RULE_NO_CHANGE' });
  });

  it('requires a reason', async () => {
    await expect(create('dir', { reason: '  ' })).rejects.toMatchObject({ statusCode: 400, code: 'RULE_REASON_REQUIRED' });
  });

  it('rejects values that fail the group schema', async () => {
    await expect(create('dir', { values: lateness({ policy: 'AFTER_N_LATES' }) })).rejects.toThrow();
  });
});

describe('createVersion: audit and events', () => {
  it('writes one entry with the changed fields only, the version and the reason', async () => {
    await create('dir');
    expect(h.entries).toHaveLength(1);
    expect(h.entries[0]).toMatchObject({
      action: 'rules.version_created',
      category: 'RULES_OPERATING',
      companyId: 'c1',
      siteId: null,
      actor: { id: 'dir', role: 'DIRECTOR', name: 'Dina Director' },
      subjectType: 'RuleVersion',
      reason: 'Because',
      before: { fields: { graceMinutes: 5 } },
      after: { group: 'LATENESS', version: 1, effectiveFrom: '2026-10-06', fields: { graceMinutes: 10 } },
    });
  });

  it('records the PIN signature in the entry', async () => {
    await create('dir', { signature: { method: 'PIN', signedAt: new Date('2026-10-06T08:00:00Z') } });
    expect(h.entries[0]?.after).toMatchObject({ signature: { method: 'PIN', signedAt: '2026-10-06T08:00:00.000Z' } });
  });

  it('files statutory, multiplier and holiday-pay changes under RULES_PAY, the rest under RULES_OPERATING', async () => {
    await create('acc', { group: 'STATUTORY', values: { tables: [{ code: 'PAYE', name: 'PAYE', bands: [], note: null }] } });
    await create('dir', { group: 'OVERTIME', values: { ...RULE_DEFAULTS.OVERTIME, multipliers: { standard: '1.5' } } });
    await create('hr', { group: 'HOLIDAYS', values: { enabled: true, payMultiplier: '2', holidays: [] } });
    await create('hr', { group: 'HOLIDAYS', effectiveFrom: date('2026-10-07'), values: { enabled: true, payMultiplier: '2', holidays: [{ date: '2026-12-25', name: 'Christmas' }] } });
    await create('dir', { group: 'ATTENDANCE', values: { ...RULE_DEFAULTS.ATTENDANCE, roundingMinutes: 5 } });
    expect(h.entries.map((e) => e.category)).toEqual(['RULES_PAY', 'RULES_PAY', 'RULES_PAY', 'RULES_OPERATING', 'RULES_OPERATING']);
  });

  it('emits the event with the notice, and nothing when the write fails', async () => {
    await create('dir');
    expect(h.events).toHaveLength(1);
    expect(h.events[0]).toMatchObject({ name: 'rules.version_created', payload: { companyId: 'c1', group: 'LATENESS', version: 1, effectiveFrom: '2026-10-06', createdById: 'dir' } });
    h.entries.length = 0;
    h.events.length = 0;
    h.failCreate = true;
    await expect(create('dir', { effectiveFrom: date('2026-10-20'), values: lateness({ graceMinutes: 12 }) })).rejects.toThrow('database down');
    expect(h.entries).toHaveLength(0);
    expect(h.events).toHaveLength(0);
  });
});

describe('confirmations', () => {
  const multipliers = (standard: string) => ({ group: 'OVERTIME', values: { ...RULE_DEFAULTS.OVERTIME, multipliers: { standard } } });

  it('a multiplier edit by the Director waits for the Accountant, who is told', async () => {
    const { version, notice } = await create('dir', multipliers('1.5'));
    expect(version.requiredConfirmations).toEqual(['overtime.multipliers']);
    expect(version.confirmations).toEqual([]);
    expect(notice.recipients).toContainEqual({ userId: 'acc', audience: 'ACCOUNTANT_TO_CONFIRM' });
  });

  it('the Director cannot confirm pay rates; the Accountant can, and twice is the same', async () => {
    const { version } = await create('dir', multipliers('1.5'));
    await expect(rulesService.confirmVersion(as('dir'), version.id, 'overtime.multipliers')).rejects.toMatchObject({ statusCode: 403, code: 'RULE_CONFIRM_NOT_ALLOWED' });

    const first = await rulesService.confirmVersion(as('acc'), version.id, 'overtime.multipliers', 'checked with payroll');
    expect(first.confirmations).toMatchObject([{ scope: 'overtime.multipliers', by: { id: 'acc', name: 'Ann Accountant' }, note: 'checked with payroll' }]);
    const entriesAfterFirst = h.entries.length;
    const second = await rulesService.confirmVersion(as('acc'), version.id, 'overtime.multipliers');
    expect(second.confirmations).toHaveLength(1);
    expect(h.confirmationsCreated).toBe(1);
    expect(h.entries).toHaveLength(entriesAfterFirst);
    expect(h.entries.at(-1)).toMatchObject({ action: 'rules.version_confirmed', category: 'RULES_PAY', actor: { id: 'acc' } });
    expect(h.events.at(-1)).toMatchObject({ name: 'rules.version_confirmed', payload: { scope: 'overtime.multipliers', confirmedById: 'acc' } });
  });

  it('confirming something the version does not need is a 409', async () => {
    const { version } = await create('dir');
    await expect(rulesService.confirmVersion(as('acc'), version.id, 'overtime.multipliers')).rejects.toMatchObject({ statusCode: 409, code: 'RULE_CONFIRM_NOT_REQUIRED' });
  });

  it('an unknown version is a 404', async () => {
    await expect(rulesService.confirmVersion(as('acc'), 'nope', 'statutory')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('an unchanged, confirmed scope is carried forward into the next version', async () => {
    const { version } = await create('dir', multipliers('1.5'));
    await rulesService.confirmVersion(as('acc'), version.id, 'overtime.multipliers');
    const next = await create('dir', {
      group: 'OVERTIME',
      effectiveFrom: date('2026-10-20'),
      values: { ...RULE_DEFAULTS.OVERTIME, serviceTailMinutes: 20, multipliers: { standard: '1.5' } },
    });
    expect(next.version.confirmations).toMatchObject([{ scope: 'overtime.multipliers', note: 'Carried forward from version 1' }]);
    expect(next.notice.recipients.some((r) => r.audience === 'ACCOUNTANT_TO_CONFIRM')).toBe(false);
  });

  it('a changed multiplier is not carried forward: it waits again', async () => {
    const { version } = await create('dir', multipliers('1.5'));
    await rulesService.confirmVersion(as('acc'), version.id, 'overtime.multipliers');
    const next = await create('dir', { ...multipliers('2'), effectiveFrom: date('2026-10-20') });
    expect(next.version.confirmations).toEqual([]);
  });

  it('the Accountant edits and confirms statutory in one step; only the Director is told', async () => {
    const { version, notice } = await create('acc', { group: 'STATUTORY', values: { tables: [{ code: 'NSSF', name: 'NSSF', bands: [], note: null }] } });
    expect(version.confirmations).toMatchObject([{ scope: 'statutory', by: { id: 'acc' } }]);
    expect(notice.recipients).toEqual([{ userId: 'dir', audience: 'DIRECTOR' }]);
  });

  it('HR editing holiday dates waits for the Director’s confirmation', async () => {
    const { version, notice } = await create('hr', { group: 'HOLIDAYS', values: { enabled: true, payMultiplier: null, holidays: [{ date: '2026-12-25', name: 'Christmas' }] } });
    expect(version.requiredConfirmations).toEqual(['holidays.dates']);
    expect(notice.recipients).toContainEqual({ userId: 'dir', audience: 'DIRECTOR_TO_CONFIRM' });
    const confirmed = await rulesService.confirmVersion(as('dir'), version.id, 'holidays.dates');
    expect(confirmed.confirmations).toHaveLength(1);
  });
});

describe('reads', () => {
  it('STATUTORY is locked without payrun.read, open with it', async () => {
    const bm = await rulesService.getEffective(as('bm1'), 's1', date('2026-10-06'));
    expect(bm.groups.find((g) => g.group === 'STATUTORY')).toEqual({ group: 'STATUTORY', locked: true });
    expect(bm.groups).toHaveLength(10);
    const acc = await rulesService.getEffective(as('acc'), 's1', date('2026-10-06'));
    expect(acc.groups.find((g) => g.group === 'STATUTORY')).toMatchObject({ values: { tables: [] } });
  });

  it('a unit holder cannot read another site, and a waiter reads nothing', async () => {
    await expect(rulesService.getEffective(as('bm1'), 's2', date('2026-10-06'))).rejects.toMatchObject({ statusCode: 403 });
    await expect(rulesService.getEffective(as('w1'), 's1', date('2026-10-06'))).rejects.toMatchObject({ statusCode: 403 });
    await expect(rulesService.getEffective(as('dir'), 'sx', date('2026-10-06'))).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lists versions newest first, with who and what changed', async () => {
    await create('dir');
    await create('dir', { effectiveFrom: date('2026-10-20'), values: lateness({ graceMinutes: 12 }) });
    const versions = await rulesService.listVersions(as('dir'), 'LATENESS', null);
    expect(Array.isArray(versions) && versions.map((v) => v.version)).toEqual([2, 1]);
    expect(Array.isArray(versions) && versions[0]).toMatchObject({ createdBy: { name: 'Dina Director' }, changedFields: ['graceMinutes'] });
  });

  it('versions of STATUTORY are locked without payrun.read; a unit holder reads company and own-site versions only', async () => {
    expect(await rulesService.listVersions(as('bm1'), 'STATUTORY', null)).toEqual({ group: 'STATUTORY', locked: true });
    await expect(rulesService.listVersions(as('bm1'), 'LATENESS', 's2')).rejects.toMatchObject({ statusCode: 403 });
    expect(await rulesService.listVersions(as('bm1'), 'LATENESS', null)).toEqual([]);
    expect(await rulesService.listVersions(as('bm1'), 'LATENESS', 's1')).toEqual([]);
  });

  it('an unknown group is a 404', async () => {
    await expect(rulesService.listVersions(as('dir'), 'NOPE' as never, null)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('isPayConfirmed', () => {
  it('is not ready with empty statutory tables', async () => {
    expect(isPayConfirmed(await getEffectiveRuleGroup('s1', date('2026-10-06'), 'STATUTORY'))).toEqual({ ready: false, reasons: ['Statutory tables are empty'] });
  });

  it('is not ready while a confirmation is missing, and ready once it is there', async () => {
    const { version } = await create('dir', { group: 'OVERTIME', values: { ...RULE_DEFAULTS.OVERTIME, multipliers: { standard: '1.5' } } });
    const waiting = isPayConfirmed(await getEffectiveRuleGroup('s1', date('2026-10-06'), 'OVERTIME'));
    expect(waiting).toEqual({ ready: false, reasons: ['Waiting for confirmation: overtime.multipliers'] });
    await rulesService.confirmVersion(as('acc'), version.id, 'overtime.multipliers');
    expect(isPayConfirmed(await getEffectiveRuleGroup('s1', date('2026-10-06'), 'OVERTIME'))).toEqual({ ready: true, reasons: [] });
  });

  it('a group with nothing set is ready', async () => {
    expect(isPayConfirmed(await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS'))).toEqual({ ready: true, reasons: [] });
  });
});
