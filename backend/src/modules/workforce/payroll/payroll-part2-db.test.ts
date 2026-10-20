/**
 * Payroll part 2 against a real database (Segment 2B), for a July month that part 1's rules carry to TO_PUBLISH: HR publishes (one
 * result for two clicks, PS numbers from the sequence); the pay-out card and the bank file; a correction makes version 2 while version 1
 * stays readable, voids the downloaded file, adds a snapshot revision and moves the totals to the hand-worked figures; two people
 * correcting one payslip give one result; the file is downloaded again, an account that changes voids it again; Mark as paid needs the
 * current file and one result for two Accountants; after it every service write answers MONTH_LOCKED and the database refuses direct
 * writes; the clock can be switched off; every document opens and agrees with the figures; the audit chain verifies.
 *
 * Runs only when DATABASE_URL names a lane database. It removes what it makes; the audit entries stay (append-only by design).
 * Run the workforce database flows one file at a time.
 */
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Payroll part 2 flows in the database', () => {
  const tag = `ZZ Pay2 ${randomUUID().slice(0, 6)}`;
  type Subject = import('../_shared/workforce-access').AccessSubject;
  const load = async () => ({
    prisma: (await import('../../../config/database')).prisma,
    time: await import('../_shared/time/nairobi-time'),
    ...(await import('./months/months-service')), ...(await import('./review/review-service')), ...(await import('./calculate/calculate-service')),
    ...(await import('./approval/approval-service')), ...(await import('./reads/payslips-service')), ...(await import('./reads/tabs-service')),
    ...(await import('../rules/rules-defaults')), ...(await import('../../../utils/password')), ...(await import('./publish/publish-service')),
    ...(await import('./corrections/correction-service')), ...(await import('./bank/bank-service')), ...(await import('./paid/paid-service')),
    ...(await import('./exports/exports-service')), ...(await import('./register-payroll')), ...(await import('./review/adjustments-service')),
    ...(await import('./sites/sites-service')), ...(await import('../attendance/switch/switch-off-check')),
    auditRepository: (await import('../_shared/audit/audit-repository')).auditRepository, verifyAuditChain: (await import('../_shared/audit/audit-hash')).verifyAuditChain,
  });
  let m: Awaited<ReturnType<typeof load>>;
  let companyId = '';
  let siteId = '';
  let hr: Subject;
  let accountant: Subject;
  let second: Subject; // another Accountant who prepared nothing
  let director: Subject;
  const pinsBefore = new Map<string, string | null>();
  const made = { versions: [] as string[], employees: [] as string[], users: [] as string[] };
  const PIN = '4321';
  const KEY = '2026-07';
  const people: Record<string, string> = {};
  let n = 0;
  const key = (label: string) => `${label}-key-${(n += 1)}-${tag.slice(-6)}`;
  const month = () => m.prisma.payrollMonth.findFirstOrThrow({ where: { companyId, monthKey: KEY } });
  const version = async () => (await month()).stateVersion;
  const slipOf = async (label: string) => (await m.listPayslips(hr, KEY, { page: 1, rows: 50 })).rows.find((r) => r.name.endsWith(label))!;
  const accountOf = async (label: string) => m.prisma.payProfile.findUniqueOrThrow({ where: { employeeId: people[label] as string } });
  const NETS = { alice: '26350.05', brian: '37273.37', aliceFixed: '27055.05', total: '63623.42', totalFixed: '64328.42' };

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, pinHash: true, site: { select: { companyId: true } } } });
    const [h, a, d, bm] = await Promise.all(['hr', 'accountant', 'director', 'bm.town'].map((x) => user(`${x}@wendo.test`)));
    for (const u of [h!, a!, d!]) pinsBefore.set(u.id, u.pinHash);
    const pinHash = await m.hashPin(PIN);
    for (const u of [h!, a!, d!]) await m.prisma.user.update({ where: { id: u.id }, data: { pinHash } });
    companyId = bm!.site!.companyId;
    hr = { id: h!.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    accountant = { id: a!.id, role: 'ACCOUNTANT', siteId: a!.siteId, headOfDepartmentIds: [] };
    director = { id: d!.id, role: 'DIRECTOR', siteId: d!.siteId, headOfDepartmentIds: [] };
    const other = await m.prisma.user.create({ data: { name: `${tag} Accountant`, email: `zz.pay2.${tag.slice(-6).toLowerCase()}@wendo.test`, passwordHash: await m.hashPassword('password123'), pinHash, role: 'ACCOUNTANT' } });
    made.users.push(other.id);
    second = { id: other.id, role: 'ACCOUNTANT', siteId: null, headOfDepartmentIds: [] };

    const site = await m.prisma.site.create({ data: { companyId, name: `${tag} Branch`, address: 'Proof Road', city: 'Nyeri', latitude: -0.42, longitude: 36.95, type: 'BRANCH' } });
    siteId = site.id;
    await m.prisma.attendanceSiteSwitch.create({ data: { siteId, enabled: true, enabledAt: new Date('2026-01-01T00:00:00Z') } });
    const date = (d: string) => m.time.toDateColumn(d as never);
    const mkEmployee = async (label: string, num: number, amount: string, userId: string | null) => {
      const e = await m.prisma.employee.create({ data: { companyId, siteId, employeeNumber: `ZZ2-${tag.slice(-4)}-${num}`, name: `${tag} ${label}`, payType: 'MONTHLY_SALARY', startDate: date('2026-01-01'), status: 'ACTIVE', tracksTime: true, userId, kraPin: 'A001234567Z', nssfNumber: '123456', shaNumber: '98765' } });
      made.employees.push(e.id);
      await m.prisma.employmentSpell.create({ data: { employeeId: e.id, startsOn: date('2026-01-01') } });
      await m.prisma.payProfile.create({ data: { employeeId: e.id, amount, overtimeEligible: true, standardWeekHours: '48', standardDayHours: '8', payoutMethod: 'BANK', bankName: 'Proof Bank', accountName: label, accountNumber: `${num}${tag.slice(-4)}` } });
      await m.prisma.payChange.create({ data: { employeeId: e.id, amount, effectiveFrom: date('2026-01-01'), reason: 'test', status: 'APPROVED', requestedById: hr.id, decidedById: director.id, decidedAt: new Date() } });
      people[label] = e.id;
    };
    const login = await m.prisma.user.create({ data: { name: `${tag} Alice`, email: `zz.pay2.alice.${tag.slice(-6).toLowerCase()}@wendo.test`, passwordHash: 'x', role: 'WAITER', siteId } });
    made.users.push(login.id);
    await mkEmployee('Alice', 1, '30000', login.id);
    await mkEmployee('Brian', 2, '45678.90', null);

    const number = ((await m.prisma.timesheetPeriod.aggregate({ _max: { documentNumber: true } }))._max.documentNumber ?? 0) + 1;
    const snapshot = { people: [{ employeeId: people['Alice'], absentDays: 1, leaveDays: 0 }, { employeeId: people['Brian'], absentDays: 0, leaveDays: 0 }] };
    const period = await m.prisma.timesheetPeriod.create({ data: { siteId, startDate: date('2026-07-01'), endDate: date('2026-07-31'), label: 'July 2026', cutoffAt: new Date('2026-08-01T00:00:00Z'), state: 'APPROVED', approvedAt: new Date('2026-08-02T08:00:00Z'), approvedById: director.id, documentNumber: number, documentHash: 'h', approvedSnapshot: snapshot } });
    for (const label of ['Alice', 'Brian']) await m.prisma.timesheetDay.create({ data: { periodId: period.id, siteId, employeeId: people[label] as string, shiftDate: date('2026-07-08'), status: 'AUTO_APPROVED', evidenceHash: 'h', scheduledMinutes: 480, workedMinutes: 480 } });
    await m.prisma.overtimeItem.create({ data: { periodId: period.id, siteId, employeeId: people['Alice'] as string, shiftDate: date('2026-07-08'), rawMinutes: 120, needsMinutes: 120, authorisedMinutes: 120, status: 'APPROVED', evidence: {}, limits: {} } });
  });

  afterAll(async () => {
    if (!enabled) return;
    await m.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wendo.allow_payroll_edit', 'on', true)`; // the dev teardown door for the insert-only and locked tables
      await tx.payrollMonth.deleteMany({ where: { companyId, OR: [{ includedSiteIds: { has: siteId } }, { monthKey: KEY }] } });
    });
    await m.prisma.payrollRequestKey.deleteMany({ where: { key: { endsWith: tag.slice(-6) } } });
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

  const newRule = async (group: 'STATUTORY' | 'OVERTIME', values: object, scope: string) => {
    const last = await m.prisma.ruleVersion.aggregate({ where: { companyId, siteId: null, group }, _max: { version: true } });
    const row = await m.prisma.ruleVersion.create({ data: { companyId, siteId: null, group, version: (last._max.version ?? 0) + 1, effectiveFrom: m.time.toDateColumn('2026-01-01' as never), values, reason: `${tag} test`, createdById: accountant.id, createdByRole: 'ACCOUNTANT' } });
    made.versions.push(row.id);
    await m.prisma.ruleConfirmation.create({ data: { ruleVersionId: row.id, scope, confirmedById: accountant.id, confirmerRole: 'ACCOUNTANT' } });
  };

  it('1. a July month is calculated, reviewed and approved by someone who prepared nothing', async () => {
    const band = (fromAmount: string, toAmount: string | null, ratePercent: string) => ({ fromAmount, toAmount, ratePercent, flatAmount: null });
    await newRule('STATUTORY', { tables: [
      { code: 'NSSF', name: 'Alpha', bands: [band('0', null, '6')], note: null, kind: 'RATE', base: 'GROSS', reducesTaxable: true, isIncomeTax: false, employerRatePercent: '6', reliefMonthly: null, floorAmount: null, ceilingAmount: null },
      { code: 'PAYE', name: 'Gamma', bands: [band('0', '24000', '10'), band('24000', '32333', '25'), band('32333', null, '30')], note: null, kind: 'BANDS', base: 'TAXABLE', reducesTaxable: false, isIncomeTax: true, employerRatePercent: null, reliefMonthly: '2000', floorAmount: null, ceilingAmount: null },
    ] }, 'statutory');
    await newRule('OVERTIME', { ...m.RULE_DEFAULTS.OVERTIME, multipliers: { ordinaryDay: '1.5', restDay: '2' } }, 'overtime.multipliers');
    const calculated = await m.calculateMonth({ companyId, monthKey: KEY, trigger: 'SYSTEM', actor: null, now: new Date('2026-08-10T09:00:00Z') });
    expect(calculated).toMatchObject({ state: 'IN_REVIEW', headcount: 2, blocking: 0 });
    for (const line of (await m.listReview(hr, KEY, { page: 1, rows: 50 })).lines) await m.checkLine(hr, KEY, line.id, { checked: true, stateVersion: await version() });
    await m.sendToAccountant(hr, KEY, { idempotencyKey: key('send'), stateVersion: await version() });
    const row = await month();
    const run = await m.prisma.payrollRun.findFirstOrThrow({ where: { monthId: row.id }, orderBy: { runNumber: 'desc' } });
    const sums = (run.totals as { total: { gross: string; net: string; taxStatutory: string; other: string } }).total;
    await m.approveMonth(second, KEY, { pin: PIN, idempotencyKey: key('approve'), stateVersion: row.stateVersion, handChecked: true, expectedTotals: { gross: sums.gross, net: sums.net, taxStatutory: sums.taxStatutory, other: sums.other, headcount: 2 } });
    expect(await month()).toMatchObject({ state: 'TO_PUBLISH', documentNumber: 'PAY-2026-07' });
    expect(sums.net).toBe(NETS.total); // the part 1 hand calculation: 26,350.05 + 37,273.37
  });

  it('2. only HR publishes, with the PIN and the version; two clicks give one publish and one set of PS numbers', async () => {
    const body = { pin: PIN, idempotencyKey: key('publish'), stateVersion: await version() };
    await expect(m.publishMonth(accountant, KEY, body)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.publishMonth(hr, KEY, { ...body, pin: '0000' })).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(m.publishMonth(hr, KEY, { ...body, stateVersion: body.stateVersion + 4 })).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' });
    expect(await m.prisma.payrollPublication.count({ where: { monthId: (await month()).id } })).toBe(0);
    await expect(m.exportMonth(hr, KEY, { kind: 'PAYSLIPS', format: 'zip', idempotencyKey: key('export') })).rejects.toMatchObject({ code: 'PAYSLIPS_NOT_PUBLISHED' });

    const results = await Promise.allSettled([m.publishMonth(hr, KEY, body), m.publishMonth(hr, KEY, { ...body, idempotencyKey: key('publish') })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason as { code: string }).code).toBe('ALREADY_PUBLISHED');
    const published = await month();
    expect(published).toMatchObject({ state: 'PUBLISHED', publishedById: hr.id });
    const numbers = await m.prisma.payrollPublication.findMany({ where: { monthId: published.id } });
    expect(numbers).toHaveLength(2);
    expect(new Set(numbers.map((x) => x.number)).size).toBe(2);
    await expect(m.publishMonth(hr, KEY, { ...body, idempotencyKey: key('publish'), stateVersion: published.stateVersion })).rejects.toMatchObject({ code: 'ALREADY_PUBLISHED' });
    const list = await m.listPayslips(hr, KEY, { page: 1, rows: 50 });
    expect(list.rows.map((r) => r.documentNumber)).toEqual(expect.arrayContaining([expect.stringMatching(/^PS-\d{4}$/)]));
    expect(list.rows.every((r) => r.status === 'PUBLISHED')).toBe(true);
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'payroll.published', subjectId: published.id } })).toBe(1);
    m.registerPayroll();
    await expect(m.assertMaySwitchOff(siteId)).rejects.toMatchObject({ code: 'SITE_IN_UNPAID_PAYROLL' }); // unpaid: the clock stays on
  });

  it('3. the pay-out card and the bank file: only the Accountant downloads; a repeat of the key is the same file', async () => {
    const view = await m.payoutView(hr, KEY);
    expect(view.methods[0]).toMatchObject({ method: 'BANK', people: 2, amount: NETS.total, file: { state: 'NONE' } });
    expect(view).toMatchObject({ canMarkPaid: false, blockedBy: 'NO_FILE' });
    expect(JSON.stringify(view)).not.toContain(`1${tag.slice(-4)}`); // no account number is ever in a read
    const pay = { pin: PIN, idempotencyKey: key('pay'), stateVersion: await version() };
    await expect(m.markPaid(accountant, KEY, pay)).rejects.toMatchObject({ code: 'BANK_FILE_REQUIRED' });
    await expect(m.downloadBankFile(hr, KEY, { idempotencyKey: key('bank') })).rejects.toMatchObject({ statusCode: 403 });
    const dl = key('bank');
    const file = await m.downloadBankFile(accountant, KEY, { idempotencyKey: dl });
    const lines = file.text.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Reference,Account name,Bank name,Branch,Account number,Amount,Currency,Narration,Employee number');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(new RegExp(`^PS-\\d{4},Alice,Proof Bank,,1${tag.slice(-4)},${NETS.alice},KES,Wendo salary Jul 2026,ZZ2-`));
    expect(file).toMatchObject({ filename: 'bank-2026-07.csv', version: 1, repeat: false });
    expect(await m.downloadBankFile(accountant, KEY, { idempotencyKey: dl })).toMatchObject({ hash: file.hash, repeat: true });
    expect(await m.prisma.payrollBankFile.count({ where: { monthId: (await month()).id } })).toBe(1);
    expect(await m.payoutView(hr, KEY)).toMatchObject({ canMarkPaid: true, methods: [{ file: { state: 'DOWNLOADED', hash: file.hash } }] });
  });

  it('4. a correction is version 2: version 1 stays, the file is voided, the snapshot gets a revision, the totals follow the hand figures', async () => {
    const alice = await slipOf('Alice');
    const change = { kind: 'UNPAID_ABSENCE' as const, changes: { absentDays: 0 } };
    const aliceLogin = (await m.prisma.employee.findUniqueOrThrow({ where: { id: people['Alice'] as string } })).userId!;
    await expect(m.correctionInputs({ ...hr, id: aliceLogin }, KEY, alice.payslipId, 1)).rejects.toMatchObject({ code: 'SELF_CORRECTION' });
    expect((await m.correctionInputs(hr, KEY, alice.payslipId, 1)).current.absentDays).toBe(1);
    const preview = await m.previewCorrection(hr, KEY, alice.payslipId, { change, expectedVersion: 1 });
    // No absence: gross 30,432.69; Alpha 6% 1,825.96; taxable 28,606.73: 2,400 + 4,606.73 × 25% (1,151.68) = 3,551.68, less relief 2,000 = 1,551.68.
    expect(preview).toMatchObject({ netNow: NETS.alice, netCorrected: NETS.aliceFixed, netChange: '705.00', voidsBankFile: true });
    expect(preview.lines.map((l) => l.code)).toContain('UNPAID_ABSENCE');
    expect(await m.prisma.payrollPayslip.count({ where: { monthId: (await month()).id, employeeId: people['Alice'] as string } })).toBe(1); // a preview saves nothing

    const body = { change, reason: 'The absence was approved by the manager', pin: PIN, expectedVersion: 1, idempotencyKey: key('correct') };
    await expect(m.correctPayslip(accountant, KEY, alice.payslipId, { ...body, pin: '0000' })).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(m.correctPayslip(accountant, KEY, alice.payslipId, { ...body, expectedVersion: 2 })).rejects.toMatchObject({ code: 'PAYSLIP_CHANGED' });
    await expect(m.correctPayslip(director, KEY, alice.payslipId, body)).rejects.toMatchObject({ statusCode: 403 });
    const done = await m.correctPayslip(accountant, KEY, alice.payslipId, body);
    expect(done).toMatchObject({ version: 2, netBefore: NETS.alice, netAfter: NETS.aliceFixed, bankFileVoided: true });
    expect(await m.correctPayslip(accountant, KEY, alice.payslipId, body)).toMatchObject({ repeat: true, version: 2 });
    await expect(m.correctPayslip(accountant, KEY, alice.payslipId, { ...body, idempotencyKey: key('correct') })).rejects.toMatchObject({ code: 'PAYSLIP_CHANGED' }); // version 1 is no longer the current one

    const versions = await m.prisma.payrollPayslip.findMany({ where: { monthId: (await month()).id, employeeId: people['Alice'] as string }, orderBy: { version: 'asc' } });
    expect(versions.map((v) => [v.version, v.net.toFixed(2)])).toEqual([[1, NETS.alice], [2, NETS.aliceFixed]]);
    expect(versions[1]).toMatchObject({ replacesVersion: 1, reason: body.reason, correctedById: accountant.id });
    const old = await m.payslipDetail(hr, KEY, alice.payslipId);
    expect(old).toMatchObject({ version: 1, replacedBy: 2 });
    expect(old.versions).toHaveLength(2);
    expect((await m.listPayslips(hr, KEY, { page: 1, rows: 50 })).counts).toMatchObject({ all: 2, corrected: 1 });
    const state = await m.getMonth(hr, KEY);
    expect(state.kpis?.net).toBe(NETS.totalFixed);
    expect((await m.totals(hr, KEY)).total.net).toBe(NETS.totalFixed);
    const snaps = await m.prisma.payrollSnapshot.findMany({ where: { monthId: (await month()).id }, orderBy: { revision: 'asc' } });
    expect(snaps.map((s) => s.revision)).toEqual([1, 2]);
    expect((snaps[0]!.data as { totals: { net: string } }).totals.net).toBe(NETS.total); // revision 1 is untouched
    expect((snaps[1]!.data as { totals: { net: string } }).totals.net).toBe(NETS.totalFixed);
    expect(snaps[0]!.hash).not.toBe(snaps[1]!.hash);
    expect(await m.payoutView(hr, KEY)).toMatchObject({ methods: [{ file: { state: 'VOIDED', voidReason: expect.stringContaining('payslip was corrected') } }] });
    expect(await m.prisma.auditEntry.count({ where: { companyId, subjectId: snaps[0]!.monthId, action: { in: ['payroll.payslip_corrected', 'payroll.bank_file_voided'] } } })).toBe(2);
  });

  it('5. two people correct the same payslip at once: one result; putting it back gives the part 1 figure again', async () => {
    const brian = await slipOf('Brian');
    const change = { kind: 'BASIC' as const, changes: { amount: '46000.00' } };
    const mk = (by: Subject) => m.correctPayslip(by, KEY, brian.payslipId, { change, reason: 'The pay change took effect early', pin: PIN, expectedVersion: 1, idempotencyKey: key('correct') });
    const results = await Promise.allSettled([mk(hr), mk(accountant)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason as { code: string }).code).toBe('PAYSLIP_CHANGED');
    const v2 = (await m.listPayslips(hr, KEY, { page: 1, rows: 50 })).rows.find((r) => r.name.endsWith('Brian'))!;
    expect(v2.version).toBe(2);
    expect(v2.net).not.toBe(NETS.brian);
    await m.correctPayslip(hr, KEY, v2.payslipId, { change: { kind: 'BASIC', changes: { amount: '45678.90' } }, reason: 'That was a mistake, back to the agreed pay', pin: PIN, expectedVersion: 2, idempotencyKey: key('correct') });
    const v3 = (await m.listPayslips(hr, KEY, { page: 1, rows: 50 })).rows.find((r) => r.name.endsWith('Brian'))!;
    expect(v3).toMatchObject({ version: 3, net: NETS.brian });
    expect((await m.getMonth(hr, KEY)).kpis?.net).toBe(NETS.totalFixed);
  });

  it('6. Mark as paid needs a current file: nobody without an account, a moved account voids the file, a new version is numbered', async () => {
    const brianProfile = await accountOf('Brian');
    await m.prisma.payProfile.update({ where: { employeeId: people['Brian'] as string }, data: { accountNumber: null } });
    expect(await m.payoutView(hr, KEY)).toMatchObject({ canMarkPaid: false, blockedBy: 'CANNOT_PAY', cannotPay: [{ name: expect.stringContaining('Brian') }] });
    await expect(m.downloadBankFile(accountant, KEY, { idempotencyKey: key('bank') })).rejects.toMatchObject({ code: 'PEOPLE_CANNOT_BE_PAID' });
    await expect(m.markPaid(accountant, KEY, { pin: PIN, idempotencyKey: key('pay'), stateVersion: await version() })).rejects.toMatchObject({ code: 'PEOPLE_CANNOT_BE_PAID' });
    await m.prisma.payProfile.update({ where: { employeeId: people['Brian'] as string }, data: { accountNumber: brianProfile.accountNumber } });

    await expect(m.markPaid(accountant, KEY, { pin: PIN, idempotencyKey: key('pay'), stateVersion: await version() })).rejects.toMatchObject({ code: 'BANK_FILE_REQUIRED' }); // the old file is voided
    const v2 = await m.downloadBankFile(accountant, KEY, { idempotencyKey: key('bank') });
    expect(v2).toMatchObject({ filename: 'bank-2026-07-v2.csv', version: 2 });
    expect(v2.text).toContain(NETS.aliceFixed);

    await m.prisma.payProfile.update({ where: { employeeId: people['Brian'] as string }, data: { bankName: 'Other Bank' } }); // payment details moved after the download
    expect(await m.payoutView(hr, KEY)).toMatchObject({ canMarkPaid: false, methods: [{ file: { state: 'VOIDED' } }] });
    await expect(m.markPaid(accountant, KEY, { pin: PIN, idempotencyKey: key('pay'), stateVersion: await version(), bankFileHash: v2.hash })).rejects.toMatchObject({ code: 'BANK_FILE_CHANGED' });
    const v3 = await m.downloadBankFile(accountant, KEY, { idempotencyKey: key('bank') });
    expect(v3).toMatchObject({ filename: 'bank-2026-07-v3.csv', version: 3 });
    expect(await m.prisma.payrollBankFile.count({ where: { monthId: (await month()).id, state: 'DOWNLOADED' } })).toBe(1); // only the newest is good
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'payroll.bank_file_downloaded', after: { path: ['month'], equals: KEY } } })).toBeGreaterThanOrEqual(3);

    const pay = { pin: PIN, idempotencyKey: key('pay'), stateVersion: await version(), bankFileHash: v3.hash };
    await expect(m.markPaid(hr, KEY, pay)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.markPaid(accountant, KEY, { ...pay, pin: '0000' })).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(m.markPaid(accountant, KEY, { ...pay, stateVersion: pay.stateVersion + 3 })).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' });
    await expect(m.markPaid(accountant, KEY, { ...pay, bankFileHash: 'a'.repeat(64) })).rejects.toMatchObject({ code: 'BANK_FILE_CHANGED' });
    expect((await month()).state).toBe('PUBLISHED');

    const results = await Promise.allSettled([m.markPaid(accountant, KEY, pay), m.markPaid(second, KEY, { ...pay, idempotencyKey: key('pay') })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(['ALREADY_PAID', 'CHANGED_UNDERNEATH', 'MONTH_NOT_PUBLISHED']).toContain(((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason as { code: string }).code);
    const paid = await month();
    expect(paid).toMatchObject({ state: 'PAID' });
    expect(paid.lockedAt).not.toBeNull();
    expect(paid.paidById).not.toBeNull();
    const winner = results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ repeat: boolean }>;
    expect(winner.value.repeat).toBe(false);
    await expect(m.markPaid(accountant, KEY, { ...pay, idempotencyKey: key('pay') })).rejects.toMatchObject({ code: 'ALREADY_PAID' });
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'payroll.marked_paid', subjectId: paid.id } })).toBe(1);
  });

  it('7. the lock: every service write answers MONTH_LOCKED, the database refuses direct writes, the clock may be switched off', async () => {
    const stateVersion = await version();
    const ids = { id: randomUUID() };
    const alice = await slipOf('Alice');
    const k = () => key('locked');
    const writes: [string, () => Promise<unknown>][] = [
      ['recalculate', () => m.recalculate(hr, KEY, { idempotencyKey: k(), stateVersion })],
      ['send', () => m.sendToAccountant(hr, KEY, { idempotencyKey: k(), stateVersion })],
      ['send back', () => m.sendBack(accountant, KEY, { reason: 'Too late to look again', idempotencyKey: k(), stateVersion })],
      ['approve', () => m.approveMonth(second, KEY, { pin: PIN, idempotencyKey: k(), stateVersion, expectedTotals: { gross: '1', net: '1', taxStatutory: '0', other: '0', headcount: 1 } })],
      ['publish', () => m.publishMonth(hr, KEY, { pin: PIN, idempotencyKey: k(), stateVersion })],
      ['correct', () => m.correctPayslip(hr, KEY, alice.payslipId, { change: { kind: 'UNPAID_ABSENCE', changes: { absentDays: 2 } }, reason: 'Trying after the month is paid', pin: PIN, expectedVersion: 2, idempotencyKey: k() })],
      ['preview', () => m.previewCorrection(hr, KEY, alice.payslipId, { change: { kind: 'UNPAID_ABSENCE', changes: { absentDays: 2 } }, expectedVersion: 2 })],
      ['add a line', () => m.addAdjustment(hr, KEY, { employeeId: people['Alice'] as string, type: 'ALLOWANCE', label: 'Late', amount: '100', taxable: false, reason: 'Trying after the month is paid', pin: PIN, idempotencyKey: k(), stateVersion })],
      ['tick', () => m.checkLine(hr, KEY, ids.id, { checked: true, stateVersion })],
      ['remind', () => m.remindSite(hr, KEY, siteId, { idempotencyKey: k() })],
    ];
    for (const [name, write] of writes) await expect(write(), name).rejects.toMatchObject({ code: 'MONTH_LOCKED', statusCode: 409 });

    const row = await month();
    const copy = await m.prisma.payrollPayslip.findFirstOrThrow({ where: { monthId: row.id } });
    const { id: _id, createdAt: _at, ...rest } = copy;
    const direct: [string, () => Promise<unknown>][] = [
      ['month', () => m.prisma.payrollMonth.update({ where: { id: row.id }, data: { state: 'PUBLISHED', lockedAt: null } })],
      ['month delete', () => m.prisma.payrollMonth.delete({ where: { id: row.id } })],
      ['payslip version', () => m.prisma.payrollPayslip.create({ data: { ...rest, input: rest.input as object, diff: undefined, version: 99 } })],
      ['adjustment', () => m.prisma.payrollAdjustment.create({ data: { monthId: row.id, employeeId: copy.employeeId, siteId, kind: 'ALLOWANCE', label: 'x', amount: 1, reason: 'x', idempotencyKey: 'x', createdById: hr.id } })],
      ['bank file', () => m.prisma.payrollBankFile.create({ data: { monthId: row.id, version: 9, formatId: 'x', fileName: 'x', hash: 'x', people: 1, total: 1, downloadedById: hr.id, downloadedAt: new Date(), idempotencyKey: 'x' } })],
      ['bank file void', () => m.prisma.payrollBankFile.updateMany({ where: { monthId: row.id }, data: { state: 'VOIDED', voidedAt: new Date(), voidReason: 'x' } })],
      ['left out', () => m.prisma.payrollLeftOut.create({ data: { monthId: row.id, employeeId: copy.employeeId, siteId, reason: 'x', byId: hr.id } })],
      ['snapshot', () => m.prisma.payrollSnapshot.create({ data: { monthId: row.id, revision: 9, hash: 'x', data: {} } })],
      ['number', () => m.prisma.payrollPublication.create({ data: { monthId: row.id, employeeId: randomUUID(), publishedAt: new Date() } })],
      ['site row', () => m.prisma.payrollMonthSite.deleteMany({ where: { monthId: row.id } })],
    ];
    for (const [name, write] of direct) await expect(write(), name).rejects.toThrow(/MONTH_LOCKED|insert-only/);
    await expect(m.prisma.$executeRaw`UPDATE payroll_months SET paid_by_id = NULL WHERE id = ${row.id}`).rejects.toThrow(/MONTH_LOCKED/);
    expect(await month()).toMatchObject({ state: 'PAID', stateVersion });
    expect(await m.prisma.payrollBankFile.count({ where: { monthId: row.id } })).toBe(3);

    await expect(m.assertMaySwitchOff(siteId)).resolves.toBeUndefined(); // paid: the branch's clock may be switched off
    const again = await m.downloadBankFile(accountant, KEY, { idempotencyKey: k() }); // re-downloading changes nothing and is audited
    expect(again.version).toBe(3);
    expect(await m.prisma.payrollBankFile.count({ where: { monthId: row.id } })).toBe(3);
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'payroll.bank_file_downloaded', subjectId: row.id, after: { path: ['again'], equals: true } } })).toBeGreaterThanOrEqual(1);
  });

  it('8. every document opens after Paid, carries the latest revision (three corrections made revision 4), and agrees with the figures', async () => {
    const make = (by: Subject, kind: 'REGISTER' | 'SUMMARY' | 'STATUTORY' | 'PAYSLIPS', format: 'pdf' | 'xlsx' | 'zip') => m.exportMonth(by, KEY, { kind, format, idempotencyKey: key('export') });
    for (const [kind, format] of [['REGISTER', 'pdf'], ['SUMMARY', 'pdf']] as const) {
      const file = await make(accountant, kind, format);
      expect(file.buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(file).toMatchObject({ documentNumber: 'PAY-2026-07', revision: 4 });
    }
    const register = new ExcelJS.Workbook();
    await register.xlsx.load((await make(accountant, 'REGISTER', 'xlsx')).buffer as unknown as ArrayBuffer);
    expect(register.worksheets.map((w) => w.name)).toEqual(['Summary', 'Register', 'Statutory', 'Casual pay', 'Bank file']);
    const sheet = register.getWorksheet('Register')!;
    expect(String(sheet.getCell('A1').value)).toContain('Working copy of PAY-2026-07');
    expect(String(sheet.getCell('A1').value)).toContain('Revision 4, includes 3 corrections after approval');
    const heads = (sheet.getRow(2).values as unknown[]).slice(1);
    expect(heads).toEqual(['Person', 'Department', 'Site', 'Basic', 'Overtime', 'Gross', 'Alpha', 'Gamma', 'Other deductions', 'Net pay']);
    const nets = [3, 4].map((r) => Number(sheet.getRow(r).getCell(10).value));
    expect(nets.reduce((a, b) => a + b, 0).toFixed(2)).toBe(NETS.totalFixed);
    const bank = register.getWorksheet('Bank file')!;
    expect(Number(bank.getRow(2).getCell(6).value)).toBe(Number(NETS.aliceFixed)); // the bank sheet holds the corrected figure
    const hrBook = new ExcelJS.Workbook();
    await hrBook.xlsx.load((await make(hr, 'REGISTER', 'xlsx')).buffer as unknown as ArrayBuffer);
    expect(hrBook.worksheets.map((w) => w.name)).not.toContain('Bank file');
    const statutory = new ExcelJS.Workbook();
    await statutory.xlsx.load((await make(director, 'STATUTORY', 'xlsx')).buffer as unknown as ArrayBuffer);
    expect(statutory.worksheets.map((w) => w.name)).toEqual(['Index', 'Alpha', 'Gamma']);
    expect(statutory.getWorksheet('Alpha')!.getCell('C3').value).toBe('A001234567Z');
    const zip = (await make(hr, 'PAYSLIPS', 'zip')).buffer;
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2); // one PDF per person, the current version
    await expect(make({ ...hr, role: 'SYSTEM_ADMIN' }, 'SUMMARY', 'pdf')).rejects.toMatchObject({ statusCode: 403 });
    await expect(make({ ...hr, role: 'MANAGER', siteId }, 'SUMMARY', 'pdf')).rejects.toMatchObject({ statusCode: 403 });
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'payroll.exported', actorId: accountant.id, after: { path: ['document'], equals: 'PAY-2026-07' } } })).toBeGreaterThanOrEqual(3);
  });

  it('9. the audit chain still verifies, and nothing the month wrote holds a PIN or an account number', async () => {
    let after = 0n;
    let start: { seq: bigint; hash: string } | undefined;
    let checked = 0;
    for (;;) {
      const page = await m.auditRepository.listEntries(companyId, after, 500);
      if (page.length === 0) break;
      const verdict = m.verifyAuditChain(page, start);
      expect(verdict.ok).toBe(true);
      const last = page[page.length - 1]!;
      start = { seq: last.seq, hash: last.hash };
      after = last.seq;
      checked += page.length;
    }
    expect(checked).toBeGreaterThan(10);
    const row = await month();
    const entries = JSON.stringify(await m.prisma.auditEntry.findMany({ where: { companyId, subjectId: row.id }, select: { before: true, after: true, reason: true } }));
    expect(entries).not.toContain(PIN);
    expect(entries).not.toContain(`1${tag.slice(-4)}`);
  });
});
