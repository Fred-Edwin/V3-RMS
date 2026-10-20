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

  it('attendance: the clock-edit escape hatch (workforce.allow_clock_edits) never appears in production source', () => {
    expect(sources.filter(({ text }) => /allow_clock_edits/.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it('attendance: only the legacy-clock repository touches the legacy clock tables', () => {
    const offenders = sources.filter(({ file, text }) => file.startsWith('attendance/') && /\.clockRecord\.|\.shiftAssignment\./.test(text) && file !== 'attendance/legacy/legacy-clock-repository.ts').map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('attendance: no attendance code writes to a clock event except through clock-repository.ts (events are only inserted)', () => {
    const offenders = sources.filter(({ file, text }) => file.startsWith('attendance/') && /clockEvent\.(update|updateMany|delete|deleteMany|upsert)\(/.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
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

  it('people: only people-account-gateway.ts imports legacy services/ or repositories/ (slice 1 contract 6.2)', () => {
    const legacy = /from\s+'(\.\.\/)+(services|repositories)\//;
    const offenders = sources.filter(({ file, text }) => file.startsWith('people/') && legacy.test(text)).map(({ file }) => file);
    expect(offenders).toEqual(['people/people-account-gateway.ts']);
  });

  it('slice 1b: only the head-claims repository (reached through the gateway) writes User.isDepartmentHead', () => {
    const writers = sources.filter(({ text }) => /user\.(update|updateMany|create|upsert)\(\{[^)]*isDepartmentHead/.test(text)).map(({ file }) => file);
    expect(writers).toEqual(['people/organisation/heads/heads-repository.ts']);
    const gateway = sources.find(({ file }) => file === 'people/people-account-gateway.ts')!.text;
    expect(gateway).toMatch(/headsRepository\.writeClaims/);
  });

  it('people: no prisma import outside a *-repository.ts', () => {
    const offenders = sources.filter(({ file, text }) => file.startsWith('people/') && !isRepository(file) && /config\/database'/.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('people: every repository query that names a tenant carries companyId or siteId', () => {
    // A cheap guard: no bare `findMany({})` / `deleteMany({})` / `updateMany({ data` without a where in the People repositories.
    const unscoped = /\.(findMany|deleteMany|updateMany|count)\(\s*\{?\s*\}?\s*\)/;
    const offenders = sources.filter(({ file, text }) => file.startsWith('people/') && isRepository(file) && unscoped.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

describe('the public door (contract 7.2)', () => {
  it('exports exactly what the contract lists', async () => {
    const door = await import('./index');
    const runtimeExports = Object.keys(door).sort();
    const expected = [
      // http (amendment 1)
      'workforcePermissionsRouter', 'workforceRulesRouter', 'workforcePeopleRouter', 'workforceOrgRouter', 'workforceRotaRouter', 'carryOverLegacyRota',
      // attendance (slice 3)
      'workforceAttendanceRouter', 'refuseLegacyClockWhenSwitched', 'sweepAutoClose', 'setPeriodClosedCheck', 'getOnShiftNow',
      // timesheets (slice 4a)
      'workforceTimesheetsRouter', 'registerTimesheets', 'sweepTimesheets', 'getApprovedHours',
      // payroll (segment 2A)
      'isSitePeriodOnNewPayroll', 'registerPayroll', 'workforcePayrollRouter', 'sweepPayroll', 'refreshPayrollEstimates',
      // casual pay (segment 3)
      'workforceCasualRouter', 'casualMonthSummary',
      // people (slice 1)
      'registerPeople', 'getEmployee', 'getActiveLoans', 'payAmountOn', 'registerImpactProvider', 'runPeopleScheduler', 'PEOPLE_SCHEDULER_TASKS',
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
      'isOnLeave',
    ].sort();
    expect(runtimeExports).toEqual(expected);
  }, 30_000); // importing the whole door takes seconds when the full suite is running

  it.each([['isOnLeave', 5]] as const)('the %s stub throws NotBuiltYetError naming slice %i', async (name, slice) => {
    const door = (await import('./index')) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    await expect(door[name]!({ siteId: 's' }, '2026-10-06')).rejects.toMatchObject({ statusCode: 501, code: 'NOT_BUILT_YET', message: expect.stringContaining(`slice ${slice}`) });
  });
});

describe('timesheets (slice 4a)', () => {
  const own = sources.filter(({ file }) => file.startsWith('timesheets/'));

  it('only timesheet repositories touch the timesheet tables', () => {
    const tables = /\.(timesheetPeriod|timesheetDay|timesheetWeek|timesheetExport|overtimeItem|timeRequest)\./;
    expect(own.filter(({ file, text }) => tables.test(text) && !isRepository(file)).map(({ file }) => file)).toEqual([]);
  });

  it('never writes the legacy payslip, attendance or clock tables', () => {
    const legacy = /\.(clockRecord|shiftAssignment|payslip|attendance|leaveRequest)\.(create|update|upsert|delete)/;
    expect(own.filter(({ text }) => legacy.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it('never stores money: no pay, rate, amount or total column in the timesheet schema', () => {
    const schema = readFileSync(join(root, '../../../prisma/schema/workforce/timesheets.prisma'), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/\/.*$/gm, '');
    expect(schema).not.toMatch(/\b(pay|rate|amount|salary|wage|money|deduction|price)\w*\s+(Decimal|Float|Int)\b/i);
    expect(schema).not.toMatch(/Decimal/);
  });

  it('the period-closed check is registered only through the hook (no second path around it)', () => {
    expect(own.filter(({ text }) => /setPeriodClosedCheck/.test(text)).map(({ file }) => file)).toEqual(['timesheets/register-timesheets.ts']);
  });
});
