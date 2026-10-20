/**
 * Payroll part 1 against a real database, in the order a month lives it (Segment 2A): a site that is switched on has approved its
 * September timesheets; the tax tables are not confirmed, so the month waits and says so; the Accountant's confirmation arrives; the
 * sweep calculates (by the system); one person has no pay profile and blocks the month; HR leaves them out and the month is worked
 * again with HR's ticks kept; the figures match a hand calculation; HR sends it; the approver can never be a preparer; a wrong PIN,
 * the first-month hand check and moved figures are each refused; two Accountants approving at once give exactly one approval; after
 * it the month cannot be calculated again or sent back; payroll rows cannot be edited; the old payslip guard now covers the site.
 *
 * Runs only when DATABASE_URL names a lane database (same guard as the other workforce flows). It removes what it makes; the audit
 * entries stay (the log is append-only by design). Run the workforce database flows one file at a time.
 */
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Payroll flows in the database', () => {
  const tag = `ZZ Pay ${randomUUID().slice(0, 6)}`;
  type Subject = import('../_shared/workforce-access').AccessSubject;
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    return {
      prisma,
      time: await import('../_shared/time/nairobi-time'),
      ...(await import('./months/months-service')), ...(await import('./review/review-service')), ...(await import('./review/adjustments-service')),
      ...(await import('./approval/approval-service')), ...(await import('./sites/sites-service')), ...(await import('./payroll-sweep')),
      ...(await import('./rollout/rollout-guard')), ...(await import('./estimate/estimate-service')), ...(await import('./reads/tabs-service')),
      ...(await import('./reads/payslips-service')), ...(await import('../rules/rules-defaults')), ...(await import('../../../utils/password')),
      // Segment 2B
      ...(await import('./publish/publish-service')), ...(await import('./corrections/correction-service')), ...(await import('./bank/bank-service')),
      ...(await import('./paid/paid-service')), ...(await import('./exports/exports-service')), ...(await import('./register-payroll')),
      ...(await import('../attendance/switch/switch-off-check')), auditRepository: (await import('../_shared/audit/audit-repository')).auditRepository, ...(await import('../_shared/audit/audit-hash')),
    };
  };
  let m: Awaited<ReturnType<typeof load>>;

  let companyId = '';
  let siteId = '';
  let hr: Subject;
  let accountant: Subject;
  let director: Subject;
  let maker: Subject; // an Accountant account that is not the HR user and did nothing: can approve
  const pinsBefore = new Map<string, string | null>();
  const made = { versions: [] as string[], employees: [] as string[], users: [] as string[] };
  const PIN = '4321';
  let key = 0;
  const nextKey = (label: string) => `${label}-key-${(key += 1)}-${tag.slice(-6)}`;
  const KEY = '2026-09';
  const month = () => m.prisma.payrollMonth.findFirstOrThrow({ where: { companyId, monthKey: KEY } });
  const people: Record<string, string> = {};

  const versionOf = async (group: 'STATUTORY' | 'OVERTIME', values: object, scope: string, confirmed: boolean) => {
    const last = await m.prisma.ruleVersion.aggregate({ where: { companyId, siteId: null, group }, _max: { version: true } });
    const row = await m.prisma.ruleVersion.create({ data: { companyId, siteId: null, group, version: (last._max.version ?? 0) + 1, effectiveFrom: m.time.toDateColumn('2026-01-01' as never), values, reason: `${tag} test`, createdById: accountant.id, createdByRole: 'ACCOUNTANT' } });
    made.versions.push(row.id);
    if (confirmed) await confirm(row.id, scope);
    return row.id;
  };
  const confirm = (ruleVersionId: string, scope: string) => m.prisma.ruleConfirmation.create({ data: { ruleVersionId, scope, confirmedById: accountant.id, confirmerRole: 'ACCOUNTANT' } });

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, pinHash: true, site: { select: { companyId: true } } } });
    const [h, a, d, bm] = await Promise.all(['hr', 'accountant', 'director', 'bm.town'].map((n) => user(`${n}@wendo.test`)));
    for (const u of [h!, a!, d!]) pinsBefore.set(u.id, u.pinHash);
    const pinHash = await m.hashPin(PIN);
    for (const u of [h!, a!, d!]) await m.prisma.user.update({ where: { id: u.id }, data: { pinHash } });
    companyId = bm!.site!.companyId;
    hr = { id: h!.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    accountant = { id: a!.id, role: 'ACCOUNTANT', siteId: a!.siteId, headOfDepartmentIds: [] };
    director = { id: d!.id, role: 'DIRECTOR', siteId: d!.siteId, headOfDepartmentIds: [] };
    maker = { id: randomUUID(), role: 'ACCOUNTANT', siteId: null, headOfDepartmentIds: [] }; // replaced below by a real second accountant

    const second = await m.prisma.user.create({ data: { name: `${tag} Accountant`, email: `zz.pay.${tag.slice(-6).toLowerCase()}@wendo.test`, passwordHash: await m.hashPassword('password123'), pinHash, role: 'ACCOUNTANT' } });
    made.users.push(second.id);
    maker = { id: second.id, role: 'ACCOUNTANT', siteId: null, headOfDepartmentIds: [] };

    const site = await m.prisma.site.create({ data: { companyId, name: `${tag} Branch`, address: 'Proof Road', city: 'Nyeri', latitude: -0.42, longitude: 36.95, type: 'BRANCH' } });
    siteId = site.id;
    await m.prisma.attendanceSiteSwitch.create({ data: { siteId, enabled: true, enabledAt: new Date('2026-01-01T00:00:00Z') } });

    const mkUser = async (label: string) => {
      const u = await m.prisma.user.create({ data: { name: `${tag} ${label}`, email: `zz.pay.${label.toLowerCase()}.${tag.slice(-6).toLowerCase()}@wendo.test`, passwordHash: 'x', role: 'WAITER', siteId } });
      made.users.push(u.id);
      return u.id;
    };
    const mkEmployee = async (label: string, n: number, opts: { amount: string | null; userId?: string | null }) => {
      const e = await m.prisma.employee.create({ data: { companyId, siteId, employeeNumber: `ZZP-${tag.slice(-4)}-${n}`, name: `${tag} ${label}`, payType: 'MONTHLY_SALARY', startDate: m.time.toDateColumn('2026-01-01' as never), status: 'ACTIVE', tracksTime: true, userId: opts.userId ?? null, kraPin: 'A001', nssfNumber: '1', shaNumber: '1' } });
      made.employees.push(e.id);
      await m.prisma.employmentSpell.create({ data: { employeeId: e.id, startsOn: m.time.toDateColumn('2026-01-01' as never) } });
      if (opts.amount) {
        await m.prisma.payProfile.create({ data: { employeeId: e.id, amount: opts.amount, overtimeEligible: true, standardWeekHours: '48', standardDayHours: '8', payoutMethod: 'BANK', bankName: 'Proof Bank', accountName: label, accountNumber: `${n}${tag.slice(-4)}` } });
        await m.prisma.payChange.create({ data: { employeeId: e.id, amount: opts.amount, effectiveFrom: m.time.toDateColumn('2026-01-01' as never), reason: 'test', status: 'APPROVED', requestedById: hr.id, decidedById: director.id, decidedAt: new Date() } });
      }
      people[label] = e.id;
      return e;
    };
    const aliceUser = await mkUser('Alice');
    await mkEmployee('Alice', 1, { amount: '30000', userId: aliceUser });
    await mkEmployee('Brian', 2, { amount: '45678.90' });
    await mkEmployee('Carol', 3, { amount: null }); // no pay profile: blocks the month

    // September's timesheet month for the site, approved by its manager, with Alice's hours: 1 unpaid day, 2 hours of authorised overtime.
    const number = ((await m.prisma.timesheetPeriod.aggregate({ _max: { documentNumber: true } }))._max.documentNumber ?? 0) + 1;
    const snapshot = { people: [{ employeeId: people['Alice'], absentDays: 1, leaveDays: 0 }, { employeeId: people['Brian'], absentDays: 0, leaveDays: 0 }, { employeeId: people['Carol'], absentDays: 0, leaveDays: 0 }] };
    const period = await m.prisma.timesheetPeriod.create({ data: { siteId, startDate: m.time.toDateColumn('2026-09-01' as never), endDate: m.time.toDateColumn('2026-09-30' as never), label: 'September 2026', cutoffAt: new Date('2026-10-01T00:00:00Z'), state: 'APPROVED', approvedAt: new Date('2026-10-02T08:00:00Z'), approvedById: director.id, documentNumber: number, documentHash: 'h', approvedSnapshot: snapshot } });
    for (const [label, minutes] of [['Alice', 480], ['Brian', 480]] as const) {
      await m.prisma.timesheetDay.create({ data: { periodId: period.id, siteId, employeeId: people[label] as string, shiftDate: m.time.toDateColumn('2026-09-08' as never), status: 'AUTO_APPROVED', evidenceHash: 'h', scheduledMinutes: minutes, workedMinutes: minutes } });
    }
    await m.prisma.overtimeItem.create({ data: { periodId: period.id, siteId, employeeId: people['Alice'] as string, shiftDate: m.time.toDateColumn('2026-09-08' as never), rawMinutes: 120, needsMinutes: 120, authorisedMinutes: 120, status: 'APPROVED', evidence: {}, limits: {} } });
  });

  afterAll(async () => {
    if (!enabled) return;
    await m.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wendo.allow_payroll_edit', 'on', true)`; // the dev teardown door for the insert-only tables
      await tx.payrollMonth.deleteMany({ where: { companyId, OR: [{ includedSiteIds: { has: siteId } }, { monthKey: { in: [KEY, '2026-08', '2026-07'] } }] } });
    });
    await m.prisma.payrollReminder.deleteMany({ where: { siteId } });
    await m.prisma.payrollRequestKey.deleteMany({ where: { key: { endsWith: tag.slice(-6) } } });
    await m.prisma.payrollEstimate.deleteMany({ where: { companyId } });
    await m.prisma.timesheetPeriod.deleteMany({ where: { siteId } });
    await m.prisma.payChange.deleteMany({ where: { employeeId: { in: made.employees } } });
    await m.prisma.payProfile.deleteMany({ where: { employeeId: { in: made.employees } } });
    await m.prisma.employmentSpell.deleteMany({ where: { employeeId: { in: made.employees } } });
    await m.prisma.employee.deleteMany({ where: { id: { in: made.employees } } });
    await m.prisma.ruleConfirmation.deleteMany({ where: { ruleVersionId: { in: made.versions } } });
    await m.prisma.ruleVersion.deleteMany({ where: { id: { in: made.versions } } });
    await m.prisma.attendanceSiteSwitch.deleteMany({ where: { siteId } });
    await m.prisma.user.deleteMany({ where: { id: { in: made.users } } });
    await m.prisma.site.deleteMany({ where: { id: siteId } });
    for (const [id, hash] of pinsBefore) await m.prisma.user.update({ where: { id }, data: { pinHash: hash } });
    await m.prisma.$disconnect();
  });

  const totals = async () => {
    const state = await m.getMonth(hr, KEY);
    return { gross: state.kpis?.gross ?? '', net: state.kpis?.net ?? '', headcount: state.kpis?.headcount ?? 0, stateVersion: state.stateVersion };
  };

  it('1. the month ended and the tax tables are not confirmed: the sweep makes the row, does not calculate, and the month says what it waits for', async () => {
    await versionOf('STATUTORY', { tables: [] }, 'statutory', false);
    const result = await m.sweepPayroll(new Date('2026-10-19T09:00:00Z'));
    expect(result.created).toBeGreaterThanOrEqual(1);
    const row = await month();
    expect(row.state).toBe('WAITING');
    const view = await m.getMonth(hr, KEY, new Date('2026-10-19T09:00:00Z'));
    expect(view.state).toBe('WAITING');
    expect(view.banner).toMatchObject({ kind: 'TABLES', title: 'Payroll is waiting for the tax tables' });
    expect(row.currentRunId).toBeNull(); // nothing was calculated
  });

  it('2. the tables are confirmed: the sweep calculates, and the figures match a hand calculation', async () => {
    const tables = {
      tables: [
        { code: 'NSSF', name: 'Alpha', bands: [{ fromAmount: '0', toAmount: null, ratePercent: '6', flatAmount: null }], note: null, kind: 'RATE', base: 'GROSS', reducesTaxable: true, isIncomeTax: false, employerRatePercent: '6', reliefMonthly: null, floorAmount: null, ceilingAmount: null },
        { code: 'PAYE', name: 'Gamma', bands: [{ fromAmount: '0', toAmount: '24000', ratePercent: '10', flatAmount: null }, { fromAmount: '24000', toAmount: '32333', ratePercent: '25', flatAmount: null }, { fromAmount: '32333', toAmount: null, ratePercent: '30', flatAmount: null }], note: null, kind: 'BANDS', base: 'TAXABLE', reducesTaxable: false, isIncomeTax: true, employerRatePercent: null, reliefMonthly: '2000', floorAmount: null, ceilingAmount: null },
      ],
    };
    await m.prisma.ruleVersion.deleteMany({ where: { id: { in: made.versions } } });
    made.versions.length = 0;
    await versionOf('STATUTORY', tables, 'statutory', true);
    await versionOf('OVERTIME', { ...m.RULE_DEFAULTS.OVERTIME, multipliers: { ordinaryDay: '1.5', restDay: '2' } }, 'overtime.multipliers', true);
    const result = await m.sweepPayroll(new Date('2026-10-19T09:30:00Z'));
    expect(result.calculated).toBeGreaterThanOrEqual(1);
    const row = await month();
    expect(row.state).toBe('IN_REVIEW');
    expect(row.includedSiteIds).toEqual([siteId]);
    expect(row.firstMonthSiteIds).toEqual([siteId]);

    const list = await m.listPayslips(hr, KEY, { page: 1, rows: 50 });
    const alice = list.rows.find((r) => r.name.endsWith('Alice'));
    // Alice: basic 30,000; overtime 2 h × (30,000 ÷ 208 = 144.2308) × 1.5 = 432.69; absence 1 × 30,000 ÷ 30 = 1,000.
    // Gross 29,432.69. Alpha 6% = 1,765.96 (allowable). Taxable 27,666.73: 2,400 + 3,666.73 × 25% = 3,316.68, less relief 2,000 = 1,316.68.
    // Net 29,432.69 − 1,765.96 − 1,316.68 = 26,350.05. Statutory taken from pay 1,765.96 + 1,316.68 = 3,082.64.
    const detail = await m.payslipDetail(hr, KEY, alice!.payslipId);
    expect(detail.totals).toMatchObject({ basic: '30000.00', gross: '29432.69', statutory: '3082.64', incomeTax: '1316.68', net: '26350.05', employerShare: '1765.96' });
    expect(detail.lines.find((l) => l.code === 'OVERTIME_ORDINARY')?.workingText).toContain('2 h 00 min authorised');
    expect(detail.lines.find((l) => l.code === 'UNPAID_ABSENCE')?.workingText).toBe('1 day unpaid: 30,000 ÷ 30 × 1');
    const brian = list.rows.find((r) => r.name.endsWith('Brian'));
    // Brian: 45,678.90; Alpha 2,740.73; taxable 42,938.17: 2,400 + 8,333 × 25% (2,083.25) + 10,605.17 × 30% (3,181.55) = 7,664.80, less relief = 5,664.80.
    expect(brian?.net).toBe('37273.37'); // 45,678.90 − 2,740.73 − 5,664.80
  });

  it('3. a person with no pay profile blocks the month; HR leaves them out; the month is worked again and the ticks are kept', async () => {
    const before = await m.listReview(hr, KEY, { page: 1, rows: 50 });
    const blocking = before.lines.find((l) => l.severity === 'BLOCK');
    expect(blocking).toMatchObject({ kind: 'MISSING_PAY_PROFILE' });
    await expect(m.sendToAccountant(hr, KEY, { idempotencyKey: nextKey('send'), stateVersion: before.stateVersion })).rejects.toMatchObject({ code: 'BLOCKING_LINES' });
    const tick = before.lines.find((l) => l.severity === 'TICK' && l.name.endsWith('Alice'));
    await m.checkLine(hr, KEY, tick!.id, { checked: true, stateVersion: before.stateVersion });

    const left = await m.leaveOut(hr, KEY, blocking!.id, { reason: 'No pay profile yet', stateVersion: before.stateVersion, idempotencyKey: nextKey('out') });
    expect(left.recalculated?.runNumber).toBe(2);
    const after = await m.listReview(hr, KEY, { page: 1, rows: 50 });
    expect(after.counts.blocking).toBe(0);
    expect(after.lines.find((l) => l.kind === 'LEFT_OUT')).toMatchObject({ state: 'CHECKED', text: 'Left out of this run; paid in the next run once added' });
    expect(after.lines.find((l) => l.id !== tick!.id && l.name.endsWith('Alice') && l.kind === tick!.kind)?.state).toBe('CHECKED'); // Alice's earlier tick came through the second run
    const t = await totals();
    expect(t.headcount).toBe(2);
  });

  it('4. HR adds a line (with a PIN) and takes it back; a wrong PIN and a stale version are refused', async () => {
    const t = await totals();
    const list = await m.listPayslips(hr, KEY, { page: 1, rows: 50 });
    const brian = list.rows.find((r) => r.name.endsWith('Brian'))!;
    const body = { employeeId: brian.employeeId, type: 'ALLOWANCE' as const, label: 'Airtime', amount: '500', taxable: true, reason: 'Agreed with the Director', pin: PIN, idempotencyKey: nextKey('adj'), stateVersion: t.stateVersion };
    await expect(m.addAdjustment(hr, KEY, { ...body, pin: '0000' })).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(m.addAdjustment(hr, KEY, { ...body, stateVersion: t.stateVersion + 5 })).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' });
    await expect(m.addAdjustment(accountant, KEY, body)).rejects.toMatchObject({ statusCode: 403 });
    const added = await m.addAdjustment(hr, KEY, body);
    expect(added.recalculated?.state).toBe('IN_REVIEW');
    const repeat = await m.addAdjustment(hr, KEY, body);
    expect(repeat.repeat).toBe(true);
    expect(await m.prisma.payrollAdjustment.count({ where: { monthId: (await month()).id, removedAt: null } })).toBe(1);
    const next = await totals();
    await m.removeAdjustment(hr, KEY, added.id as string, { stateVersion: next.stateVersion, idempotencyKey: nextKey('rm') });
    expect(await m.prisma.payrollAdjustment.count({ where: { monthId: (await month()).id, removedAt: null } })).toBe(0);
    expect(await m.prisma.payrollAdjustment.count({ where: { monthId: (await month()).id } })).toBe(1); // kept, with who removed it
  });

  it('5. the month cannot be sent while a line is open; ticking a kind and sending works once, and the repeat answers the first result', async () => {
    let review = await m.listReview(hr, KEY, { page: 1, rows: 50 });
    const open = review.lines.filter((l) => l.state === 'OPEN');
    if (open.length > 0) {
      await expect(m.sendToAccountant(hr, KEY, { idempotencyKey: nextKey('send'), stateVersion: review.stateVersion })).rejects.toMatchObject({ code: 'LINES_OPEN' });
      for (const kind of new Set(open.map((l) => l.kind))) await m.checkKind(hr, KEY, { kind, stateVersion: review.stateVersion }).catch(() => undefined);
      for (const l of (await m.listReview(hr, KEY, { page: 1, rows: 50, state: 'OPEN' })).lines) await m.checkLine(hr, KEY, l.id, { checked: true, stateVersion: review.stateVersion });
    }
    review = await m.listReview(hr, KEY, { page: 1, rows: 50 });
    expect(review.counts.checked).toBe(review.counts.total);
    const sendKey = nextKey('send');
    const sent = await m.sendToAccountant(hr, KEY, { idempotencyKey: sendKey, stateVersion: review.stateVersion });
    expect(sent.state).toBe('TO_APPROVE');
    expect((await m.sendToAccountant(hr, KEY, { idempotencyKey: sendKey, stateVersion: review.stateVersion })).repeat).toBe(true);
    await expect(m.sendToAccountant(hr, KEY, { idempotencyKey: nextKey('send'), stateVersion: sent.stateVersion })).rejects.toMatchObject({ code: 'MONTH_NOT_IN_REVIEW' });
    await expect(m.recalculate(hr, KEY, { idempotencyKey: nextKey('calc'), stateVersion: sent.stateVersion })).rejects.toMatchObject({ code: 'MONTH_NOT_CALCULABLE' });
    await expect(m.checkLine(hr, KEY, randomUUID(), { checked: true, stateVersion: sent.stateVersion })).rejects.toMatchObject({ code: 'MONTH_NOT_IN_REVIEW' });
  });

  it('5b. a draft export says so, is audited once per key, and all payslips wait for publishing', async () => {
    const key = nextKey('export');
    const file = await m.exportMonth(hr, KEY, { kind: 'REGISTER', format: 'xlsx', idempotencyKey: key });
    expect(file).toMatchObject({ filename: 'Payroll-2026-09.xlsx', documentNumber: null, revision: 1 });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Register')!.getCell('A1').value).toBe('Working copy, draft, not approved');
    expect(wb.worksheets.map((w) => w.name)).not.toContain('Bank file'); // HR never gets the bank sheet
    await m.exportMonth(hr, KEY, { kind: 'REGISTER', format: 'xlsx', idempotencyKey: key });
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'payroll.exported', actorId: hr.id, after: { path: ['document'], equals: 'draft' } } })).toBe(1);
    await expect(m.exportMonth(hr, KEY, { kind: 'PAYSLIPS', format: 'zip', idempotencyKey: nextKey('export') })).rejects.toMatchObject({ code: 'PAYSLIPS_NOT_PUBLISHED' });
    await expect(m.exportMonth({ ...hr, role: 'SYSTEM_ADMIN' }, KEY, { kind: 'SUMMARY', format: 'pdf', idempotencyKey: nextKey('export') })).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.exportMonth(hr, '2026-08', { kind: 'SUMMARY', format: 'pdf', idempotencyKey: nextKey('export') })).rejects.toMatchObject({ code: 'NOTHING_CALCULATED' });
  });

  it('6. the approval: HR cannot, the preparer cannot, a wrong PIN, the hand check and moved figures are each refused', async () => {
    const t = await totals();
    const row = await month();
    const run = await m.prisma.payrollRun.findFirstOrThrow({ where: { monthId: row.id }, orderBy: { runNumber: 'desc' } });
    const sums = (run.totals as { total: { taxStatutory: string; other: string } }).total;
    const body = { pin: PIN, idempotencyKey: nextKey('approve'), stateVersion: t.stateVersion, expectedTotals: { gross: t.gross, net: t.net, taxStatutory: sums.taxStatutory, other: sums.other, headcount: t.headcount }, handChecked: true };
    await expect(m.approveMonth(hr, KEY, body)).rejects.toMatchObject({ statusCode: 403 }); // HR has no payroll.approve
    const hrAsAccountant: Subject = { ...hr, role: 'ACCOUNTANT' }; // the same person holding both roles
    await expect(m.approveMonth(hrAsAccountant, KEY, body)).rejects.toMatchObject({ code: 'SELF_APPROVAL' });
    await expect(m.approveMonth(maker, KEY, { ...body, pin: '0000' })).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(m.approveMonth(maker, KEY, { ...body, handChecked: false })).rejects.toMatchObject({ code: 'HAND_CHECK_REQUIRED' });
    await expect(m.approveMonth(maker, KEY, { ...body, expectedTotals: { ...body.expectedTotals, net: '1.00' } })).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' });
    await expect(m.approveMonth(maker, KEY, { ...body, stateVersion: t.stateVersion + 3 })).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' });
    expect((await month()).state).toBe('TO_APPROVE');

    const sentBack = await m.sendBack(maker, KEY, { reason: 'Please look at the overtime again', idempotencyKey: nextKey('back'), stateVersion: t.stateVersion });
    expect(sentBack.state).toBe('IN_REVIEW');
    expect((await m.listReview(hr, KEY, { page: 1, rows: 50 })).counts.checked).toBeGreaterThan(0); // HR's ticks are kept
    const resend = await m.sendToAccountant(hr, KEY, { idempotencyKey: nextKey('send'), stateVersion: sentBack.stateVersion });
    expect(resend.state).toBe('TO_APPROVE');
  });

  it('7. two Accountants approve at the same moment: exactly one approval, one number, one snapshot', async () => {
    const t = await totals();
    const row = await month();
    const run = await m.prisma.payrollRun.findFirstOrThrow({ where: { monthId: row.id }, orderBy: { runNumber: 'desc' } });
    const sums = (run.totals as { total: { taxStatutory: string; other: string } }).total;
    const mk = () => ({ pin: PIN, idempotencyKey: nextKey('approve'), stateVersion: t.stateVersion, expectedTotals: { gross: t.gross, net: t.net, taxStatutory: sums.taxStatutory, other: sums.other, headcount: t.headcount }, handChecked: true });
    const results = await Promise.allSettled([m.approveMonth(maker, KEY, mk()), m.approveMonth(accountant, KEY, mk())]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(['ALREADY_APPROVED', 'CHANGED_UNDERNEATH', 'MONTH_NOT_WITH_ACCOUNTANT']).toContain((lost.reason as { code: string }).code);
    const done = await month();
    expect(done).toMatchObject({ state: 'TO_PUBLISH', documentNumber: 'PAY-2026-09', handChecked: true });
    expect(await m.prisma.payrollSnapshot.count({ where: { monthId: done.id } })).toBe(1);
    expect((await m.prisma.payrollSnapshot.findFirstOrThrow({ where: { monthId: done.id } })).hash).toHaveLength(64);
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'payroll.approved', subjectId: done.id } })).toBe(1);
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'payroll.hand_check_confirmed', subjectId: done.id } })).toBe(1);
    const entries = JSON.stringify(await m.prisma.auditEntry.findMany({ where: { companyId, subjectId: done.id }, select: { before: true, after: true, reason: true } }));
    expect(entries).not.toContain(PIN);
    expect(entries).not.toMatch(/"(gross|net)"/);
  });

  it('8. after approval: no recalculation, no send back, frozen rows cannot be edited, and the old payslip run is refused for the site', async () => {
    const t = await totals();
    await expect(m.recalculate(hr, KEY, { idempotencyKey: nextKey('calc'), stateVersion: t.stateVersion })).rejects.toMatchObject({ code: 'MONTH_NOT_CALCULABLE' });
    await expect(m.sendBack(maker, KEY, { reason: 'Too late now', idempotencyKey: nextKey('back'), stateVersion: t.stateVersion })).rejects.toMatchObject({ code: 'MONTH_NOT_WITH_ACCOUNTANT' });
    const row = await month();
    await expect(m.prisma.payrollPayslip.updateMany({ where: { monthId: row.id }, data: { net: 1 } })).rejects.toThrow(/insert-only/);
    await expect(m.prisma.payrollSnapshot.deleteMany({ where: { monthId: row.id } })).rejects.toThrow(/insert-only/);
    expect(await m.isSitePeriodOnNewPayroll(siteId, '2026-09')).toBe(true);
    expect(await m.isSitePeriodOnNewPayroll(siteId, '2026-10')).toBe(true); // switched on from January: later months are the new system's too
    expect(await m.isSitePeriodOnNewPayroll(siteId, '2025-12')).toBe(false); // before the switch the old run is untouched
    const other = await m.prisma.site.findFirstOrThrow({ where: { companyId, id: { not: siteId }, isActive: true }, select: { id: true } });
    expect(await m.isSitePeriodOnNewPayroll(other.id, '2026-09')).toBe(false);
  });

  it('9. a month that is waiting for a site can remind it once a day, and the estimate is stored by the nightly job', async () => {
    const aug = await m.prisma.payrollMonth.findUniqueOrThrow({ where: { companyId_monthKey: { companyId, monthKey: '2026-08' } } }); // the sweep made it: nobody approved August
    expect(aug.state).toBe('WAITING');
    const body = { idempotencyKey: nextKey('remind') };
    await expect(m.remindSite(accountant, '2026-08', siteId, body, new Date('2026-10-19T09:00:00Z'))).resolves.toMatchObject({ siteId, repeat: false });
    await expect(m.remindSite(accountant, '2026-08', siteId, { idempotencyKey: nextKey('remind') }, new Date('2026-10-19T09:05:00Z'))).rejects.toMatchObject({ statusCode: 429, code: 'REMINDED_RECENTLY' });
    await expect(m.remindSite(hr, '2026-08', siteId, body)).resolves.toMatchObject({ repeat: true });
    await expect(m.remindSite({ ...hr, role: 'MANAGER', siteId }, '2026-08', siteId, { idempotencyKey: nextKey('remind') })).rejects.toMatchObject({ statusCode: 403 });

    const out = await m.refreshEstimates(new Date('2026-10-19T00:30:00Z'));
    expect(out.computed).toBeGreaterThanOrEqual(1);
    const estimate = await m.readEstimate(director, '2026-10');
    expect(estimate.ready).toBe(true);
    await expect(m.readEstimate({ ...hr, role: 'WAITER' }, '2026-10')).rejects.toMatchObject({ statusCode: 403 });
  });
});
