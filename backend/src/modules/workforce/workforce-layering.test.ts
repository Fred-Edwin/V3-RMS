import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({ prisma: {} }));

const root = __dirname;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const sources = walk(root)
  .filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts') && !path.endsWith('.example.ts'))
  .map((path) => ({ file: relative(root, path), text: readFileSync(path, 'utf8') }));
const isRepository = (file: string) => file.endsWith('-repository.ts');

describe('workforce layering (contract section 9)', () => {
  it('finds the module’s files', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it('no runtime @prisma/client import outside a repository (type imports are fine)', () => {
    const offenders = sources
      .filter(({ file, text }) => !isRepository(file) && /^import\s+(?!type\b)[^;]*from\s+'@prisma\/client'/m.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('no prisma client import outside a repository, except the $transaction in audit-writer.ts (the one named exception)', () => {
    const offenders = sources.filter(({ file, text }) => !isRepository(file) && /config\/database'/.test(text)).map(({ file }) => file);
    expect(offenders).toEqual(['_shared/audit/audit-writer.ts']);
  });

  it('the writer uses prisma only for $transaction', () => {
    const writer = sources.find(({ file }) => file === '_shared/audit/audit-writer.ts')!.text;
    const uses = writer.match(/prisma\.[\w$]+/g) ?? [];
    expect(uses).toEqual(['prisma.$transaction']);
  });

  it('no any', () => {
    const pattern = /(:\s*any\b|<any>|\bas any\b|\bany\[\]|Array<any>)/;
    expect(sources.filter(({ text }) => pattern.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it('no requireRole( anywhere: access is by capability', () => {
    expect(sources.filter(({ text }) => /requireRole\(/.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it('every route file runs authenticate before the capability', () => {
    for (const { file, text } of sources.filter(({ file }) => file.endsWith('-routes.ts'))) {
      expect(text, file).toMatch(/authenticate/);
    }
  });
});

describe('the public door (contract 7.2)', () => {
  it('exports exactly what the contract lists', async () => {
    const door = await import('./index');
    const runtimeExports = Object.keys(door).sort();
    const expected = [
      // http (amendment 1)
      'workforcePermissionsRouter', 'workforceRulesRouter',
      // access
      'CAPABILITIES', 'SCOPES', 'ROLE_GRANTS', 'grantsOf', 'scopeOf', 'workforceCan', 'inScope', 'assertInScope', 'assertNotSelf', 'requireCapability',
      'lockedGroupsFor', 'redactSensitive', 'defaultTracksTime', 'tracksTime', 'requireTracksTime', 'setTracksTimeResolver',
      // time engine
      'NAIROBI_OFFSET_MINUTES', 'parseNairobiDate', 'parseClockTime', 'nairobiDateOf', 'nairobiClockOf', 'nairobiToday', 'minutesOfDay', 'instantAt', 'addDays',
      'daysBetween', 'eachDay', 'isoWeekday', 'weekStart', 'monthKey', 'toDateColumn', 'fromDateColumn',
      'computeLateness', 'assertNoOvernight', 'shiftInstants', 'resolveClockPairs', 'computeDayHours', 'makeUpMinutes', 'overtimeCandidate', 'weeklyOvertime',
      'weeklyTotals', 'periodTotals', 'deductibleLateness', 'periodContaining', 'periodsBetween', 'isInPeriod',
      // audit
      'writeAuditEntry', 'runAudited', 'verifyAuditChain', 'GENESIS_HASH', 'auditReadScopeOf', 'AUDIT_ACTIONS', 'AUDIT_CATEGORIES',
      // rules
      'getEffectiveRules', 'getEffectiveRuleGroup', 'isPayConfirmed', 'RULE_DEFAULTS', 'RULE_SCHEMAS',
      // events
      'workforceEvents', 'setWorkforceNotifier',
      // stubs
      'getOnShiftNow', 'getEmployee', 'isOnLeave', 'getApprovedHours',
    ].sort();
    expect(runtimeExports).toEqual(expected);
  });

  it.each([
    ['getOnShiftNow', 3],
    ['getEmployee', 1],
    ['isOnLeave', 5],
    ['getApprovedHours', 4],
  ] as const)('the %s stub throws NotBuiltYetError naming slice %i', async (name, slice) => {
    const door = (await import('./index')) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    await expect(door[name]!({ siteId: 's' }, '2026-10-06')).rejects.toMatchObject({ statusCode: 501, code: 'NOT_BUILT_YET', message: expect.stringContaining(`slice ${slice}`) });
  });
});
