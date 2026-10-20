/**
 * Staff payslips against a real database (Segment 3). A fixture month is marked published through the publication seam (Payroll part 2
 * is not merged here). In order: the list needs no code and carries no amount; a wrong code is recorded, the third raises the notices
 * once, from the fifth a try waits a few seconds (and the right code still opens: nobody is locked out); a first code can be chosen
 * once; the reads and the stored A4 file (same bytes every time, version 1 REPLACED once version 2 exists); every opening is audited
 * with no amount and HR's openings reach the Director's daily count; a person on a branch not yet on the new payslips gets the old-card
 * data; the P9 is gated by the date and by the Accountant's confirmation, built once, and refuses a missing KRA PIN or month.
 *
 * Runs only when DATABASE_URL names a lane database. It removes what it makes; the audit entries stay (append-only by design).
 * Run the workforce database flows one file at a time.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Payslip flows in the database', () => {
  const tag = `ZZ Slip ${randomUUID().slice(0, 6)}`;
  const sfx = tag.slice(-6).replace(/\W/g, '').toLowerCase();
  type Subject = import('../_shared/workforce-access').AccessSubject;
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    return {
      prisma,
      time: await import('../_shared/time/nairobi-time'),
      events: await import('../_shared/events'),
      unlockSvc: await import('./unlock/unlock-service'),
      mw: await import('./unlock/unlock-middleware'),
      reads: await import('./reads/reads-service'),
      others: await import('./reads/others-service'),
      p9: await import('./p9/p9-service'),
      pub: await import('./reads/publication'),
      password: await import('../../../utils/password'),
      docs: await import('./documents/document-service'),
    };
  };
  let m: Awaited<ReturnType<typeof load>>;
  let companyId = '';
  let siteId = '';
  let oldSiteId = '';
  let staff: Subject;
  let noCode: Subject;
  let oldSite: Subject;
  let oldSiteEmpty: Subject;
  let hr: Subject;
  let accountant: Subject;
  let director: Subject;
  let sysadmin: Subject;
  let employeeId = '';
  let septId = '';
  const made = { users: [] as string[], employees: [] as string[], months: [] as string[], legacy: [] as string[], payslips: [] as string[] };
  const pinsBefore = new Map<string, string | null>();
  const notes: { to: string; kind: string; data: Record<string, unknown> }[] = [];
  let priorNotifier: import('../_shared/events').WorkforceNotifier;
  let createdConfirmation = false;
  const published = new Set<string>();
  const paid = new Map<string, string>();
  const PIN = '4321';
  const DEVICE = `device-${sfx}-aaaa`;
  const T0 = new Date('2026-10-19T08:00:00.000Z');
  const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
  const phone = { id: DEVICE, label: 'Android, Chrome' };

  async function mkMonth(monthKey: string, versions: { gross: string; net: string; late: string }[]) {
    const month = await m.prisma.payrollMonth.create({ data: { companyId, monthKey, state: 'TO_PUBLISH', stateVersion: 1, includedSiteIds: [siteId], approvedAt: new Date('2025-01-02T10:00:00Z'), approvedById: accountant.id, documentNumber: `PAY-${monthKey}`, rulesUsed: {} } });
    made.months.push(month.id);
    const run = await m.prisma.payrollRun.create({ data: { monthId: month.id, runNumber: 1, trigger: 'SYSTEM', status: 'SUCCEEDED', inputsHash: 'x', headcount: 1, totals: {} } });
    await m.prisma.payrollMonth.update({ where: { id: month.id }, data: { currentRunId: run.id } });
    const ids: string[] = [];
    for (const [i, v] of versions.entries()) {
      const slip = await m.prisma.payrollPayslip.create({
        data: {
          monthId: month.id, runId: run.id, employeeId, siteId, version: i + 1, employeeName: `${tag} Barista`, employeeNumber: `ZZS-${sfx}-0214`, department: 'Service', siteName: `${tag} Branch`,
          basic: '50000.00', gross: v.gross, statutoryEmployee: '8000.00', incomeTax: '6000.00', otherDeductions: v.late, net: v.net, employerShare: '1080.00', taxablePay: '48000.00', overtimePay: '0.00', latenessDeduction: v.late, unpaidAbsence: '0.00', input: {},
          documentNumber: monthKey === '2024-12' ? 'PS-0987' : 'PS-0986', ...(i > 0 ? { replacesVersion: i, correctedAt: new Date('2025-01-20T07:15:00Z'), correctedById: accountant.id, reason: 'fixture' } : {}),
          lines: {
            create: [
              { position: 1, code: 'BASIC', label: 'Basic pay', kind: 'EARNING', amount: '50000.00', taxable: true, source: {}, workingText: 'Monthly rate' },
              { position: 2, code: 'PENSION', label: 'NSSF', kind: 'STATUTORY', amount: '2000.00', taxable: false, share: 'EMPLOYEE', source: {}, workingText: 'Tier I and II' },
              { position: 3, code: 'PAYE', label: 'PAYE', kind: 'STATUTORY', amount: '6000.00', taxable: false, share: 'EMPLOYEE', source: {}, workingText: 'After relief', bandsUsed: [{ from: '0', to: null, ratePercent: '10', amount: '9000.00' }] },
              { position: 4, code: 'LATE', label: 'Lateness', kind: 'DEDUCTION', amount: v.late, taxable: false, source: {}, workingText: 'Minutes late' },
              { position: 5, code: 'NSSF_ER', label: 'NSSF, employer share', kind: 'MEMO', amount: '1080.00', taxable: false, share: 'EMPLOYER', source: {}, workingText: '' },
            ],
          },
        },
      });
      ids.push(slip.id);
      made.payslips.push(slip.id);
    }
    published.add(month.id);
    return { monthId: month.id, ids };
  }

  beforeAll(async () => {
    m = await load();
    const real = async (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, pinHash: true, site: { select: { companyId: true } } } });
    const [h, a, d, s, bm] = await Promise.all(['hr@wendo.test', 'accountant@wendo.test', 'director@wendo.test', 'admin@wendo.test', 'bm.town@wendo.test'].map(real));
    for (const u of [h!, a!, d!]) pinsBefore.set(u.id, u.pinHash);
    const pinHash = await m.password.hashPin(PIN);
    await m.prisma.user.updateMany({ where: { id: { in: [h!.id, a!.id, d!.id] } }, data: { pinHash } });
    companyId = bm!.site!.companyId;
    hr = { id: h!.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    accountant = { id: a!.id, role: 'ACCOUNTANT', siteId: a!.siteId, headOfDepartmentIds: [] };
    director = { id: d!.id, role: 'DIRECTOR', siteId: d!.siteId, headOfDepartmentIds: [] };
    sysadmin = { id: s!.id, role: 'SYSTEM_ADMIN', siteId: s!.siteId, headOfDepartmentIds: [] };

    const mkSite = (name: string) => m.prisma.site.create({ data: { companyId, name: `${tag} ${name}`, address: 'Proof Road', city: 'Nyeri', latitude: -0.42, longitude: 36.95, type: 'BRANCH' } });
    siteId = (await mkSite('Branch')).id;
    oldSiteId = (await mkSite('Old')).id;
    const mkUser = async (label: string, site: string, withPin: boolean) => {
      const u = await m.prisma.user.create({ data: { name: `${tag} ${label}`, email: `zz.slip.${label.toLowerCase()}.${sfx}@wendo.test`, passwordHash: 'x', ...(withPin ? { pinHash } : {}), role: 'BARISTA', siteId: site } });
      made.users.push(u.id);
      return u.id;
    };
    const staffId = await mkUser('Staff', siteId, true);
    staff = { id: staffId, role: 'BARISTA', siteId, headOfDepartmentIds: [] };
    noCode = { id: await mkUser('NoCode', siteId, false), role: 'BARISTA', siteId, headOfDepartmentIds: [] };
    oldSite = { id: await mkUser('OldSite', oldSiteId, true), role: 'BARISTA', siteId: oldSiteId, headOfDepartmentIds: [] };
    oldSiteEmpty = { id: await mkUser('OldEmpty', oldSiteId, true), role: 'BARISTA', siteId: oldSiteId, headOfDepartmentIds: [] };

    const emp = await m.prisma.employee.create({ data: { companyId, siteId, userId: staffId, employeeNumber: `ZZS-${sfx}-0214`, name: `${tag} Barista`, payType: 'MONTHLY_SALARY', startDate: m.time.toDateColumn('2024-11-01' as never), status: 'ACTIVE', kraPin: 'A001234567Z', nssfNumber: '123456789', shaNumber: '987654321' } });
    employeeId = emp.id;
    made.employees.push(emp.id);
    await m.prisma.payProfile.create({ data: { employeeId, amount: '50000', payoutMethod: 'BANK', bankName: 'Equity', accountNumber: '0123456789124412' } });

    // two months of 2024: November (one version) and December (version 2 corrects the lateness)
    const nov = await mkMonth('2024-11', [{ gross: '50000.00', net: '38000.00', late: '0.00' }]);
    septId = nov.ids[0]!;
    await mkMonth('2024-12', [{ gross: '50000.00', net: '37795.00', late: '410.00' }, { gross: '50000.00', net: '38000.00', late: '205.00' }]);

    const legacy = await m.prisma.payslip.create({ data: { siteId: oldSiteId, userId: oldSite.id, payPeriod: '2026-08', payDate: new Date('2026-08-28'), grossPay: '1000', paye: '1', sha: '1', nssfTier1: '1', nssfTier2: '1', housingLevy: '1', totalDeductions: '4', netPay: '996', isLocked: true, createdById: oldSite.id } });
    made.legacy.push(legacy.id);

    m.pub.setPublicationSource(async (months) => new Map(months.map((x) => [x.id, { published: published.has(x.id), paid: paid.has(x.id), payDay: null, paidOn: (paid.get(x.id) as never) ?? null }])));
    priorNotifier = m.events.getWorkforceNotifier();
    m.events.setWorkforceNotifier({ notify: async (to, kind, data) => void notes.push({ to, kind, data }) });
  });

  afterAll(async () => {
    if (!enabled) return;
    m.pub.setPublicationSource(null);
    m.events.setWorkforceNotifier(priorNotifier);
    await m.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wendo.allow_payroll_edit', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('wendo.allow_payslip_edit', 'on', true)`;
      await tx.payslipDocument.deleteMany({ where: { payslipId: { in: made.payslips } } });
      await tx.p9Document.deleteMany({ where: { employeeId: { in: made.employees } } });
      await tx.payslipCodeTry.deleteMany({ where: { userId: { in: made.users } } });
      await tx.payrollMonth.deleteMany({ where: { id: { in: made.months } } });
    });
    await m.prisma.payslipUnlock.deleteMany({ where: { userId: { in: made.users } } });
    await m.prisma.payslipOpenDigest.deleteMany({ where: { openerId: { in: [hr.id, accountant.id] } } });
    if (createdConfirmation) await m.prisma.p9FormatConfirmation.deleteMany({ where: { companyId, confirmedById: accountant.id } });
    await m.prisma.payslip.deleteMany({ where: { id: { in: made.legacy } } });
    await m.prisma.payProfile.deleteMany({ where: { employeeId: { in: made.employees } } });
    await m.prisma.employee.deleteMany({ where: { id: { in: made.employees } } });
    await m.prisma.user.deleteMany({ where: { id: { in: made.users } } });
    await m.prisma.site.deleteMany({ where: { id: { in: [siteId, oldSiteId] } } });
    for (const [id, hash] of pinsBefore) await m.prisma.user.update({ where: { id }, data: { pinHash: hash } });
    await m.prisma.$disconnect();
  });

  it('the list needs no code and carries no amount; a payslip not published is not listed; the System Admin has none', async () => {
    const list = await m.reads.list(staff);
    expect(list).toMatchObject({ unlockRequired: true, hasCode: true });
    expect(list.items.map((i) => i.month)).toEqual(['2024-12', '2024-11']);
    expect(JSON.stringify(list)).not.toMatch(/"(gross|net|amount)"/);
    expect(list.items[0]).toMatchObject({ versionNumber: 2, status: 'PUBLISHED' });
    published.clear();
    expect((await m.reads.list(staff)).items).toEqual([]);
    for (const id of made.months) published.add(id);
    await expect(m.reads.list(sysadmin)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('a wrong code is recorded; the third raises the notices once; from the fifth a try waits; the right code still opens (nobody is locked out)', async () => {
    const wrong = (s: number) => m.unlockSvc.unlock(staff, { code: '0000', deviceId: DEVICE }, 'Android, Chrome', at(s));
    for (const s of [0, 1]) await expect(wrong(s)).rejects.toMatchObject({ code: 'CODE_WRONG' });
    expect(notes.filter((n) => n.kind === 'payslip.three_wrong_codes')).toHaveLength(0);
    await expect(wrong(2)).rejects.toMatchObject({ code: 'CODE_WRONG' });
    const alerts = notes.filter((n) => n.kind === 'payslip.three_wrong_codes');
    expect(alerts.map((n) => n.to)).toContain(staff.id); // the person
    expect(alerts.length).toBeGreaterThanOrEqual(2); // and at least one System Admin
    await expect(wrong(3)).rejects.toMatchObject({ code: 'CODE_WRONG' });
    await expect(wrong(4)).rejects.toMatchObject({ code: 'CODE_WRONG', details: { waitSeconds: 2 } }); // the 5th wrong: a pause is announced
    expect(notes.filter((n) => n.kind === 'payslip.three_wrong_codes')).toHaveLength(alerts.length); // once per window
    await expect(m.unlockSvc.unlock(staff, { code: PIN, deviceId: DEVICE }, null, at(5))).rejects.toMatchObject({ code: 'CODE_SLOWED', details: { waitSeconds: 1 } }); // even the right code waits one second
    const opened = await m.unlockSvc.unlock(staff, { code: PIN, deviceId: DEVICE }, null, at(7));
    expect(opened.unlockToken.length).toBeGreaterThan(30);
    const rows = await m.prisma.payslipCodeTry.findMany({ where: { userId: staff.id }, orderBy: { createdAt: 'asc' } });
    expect(rows.filter((r) => !r.success)).toHaveLength(5);
    expect(JSON.stringify(rows)).not.toMatch(/0000|4321/); // never the digits
    // a right code ends the count: the next wrong try is the first of a new count
    await expect(m.unlockSvc.unlock(staff, { code: '1111', deviceId: DEVICE }, null, at(8))).rejects.toMatchObject({ code: 'CODE_WRONG' });
    await expect(m.unlockSvc.unlock(staff, { code: '2222', deviceId: DEVICE }, null, at(8))).rejects.toMatchObject({ code: 'CODE_WRONG' }); // no pause yet
  }, 30_000); // ten real bcrypt checks

  it('the unlock token is for that person and that phone, ends when they leave, and relocks after 10 idle minutes', async () => {
    const t = await m.unlockSvc.unlock(staff, { code: PIN, deviceId: DEVICE }, null);
    const run = async (userId: string, token: string | undefined, device: string | undefined) => {
      const req = { user: { id: userId }, header: (n: string) => (n === m.mw.UNLOCK_HEADER ? token : n === m.mw.DEVICE_HEADER ? device : undefined) } as never;
      let passed = false;
      await m.mw.requireUnlock(req, {} as never, () => void (passed = true));
      return passed;
    };
    expect(await run(staff.id, t.unlockToken, DEVICE)).toBe(true);
    await expect(run(staff.id, t.unlockToken, 'another-phone-0000')).rejects.toMatchObject({ code: 'UNLOCK_REQUIRED' });
    await expect(run(noCode.id, t.unlockToken, DEVICE)).rejects.toMatchObject({ code: 'UNLOCK_REQUIRED' }); // someone else's token
    await expect(run(staff.id, undefined, DEVICE)).rejects.toMatchObject({ code: 'UNLOCK_REQUIRED' });
    await m.prisma.payslipUnlock.updateMany({ where: { userId: staff.id }, data: { lastUsedAt: new Date(Date.now() - 11 * 60_000) } });
    await expect(run(staff.id, t.unlockToken, DEVICE)).rejects.toMatchObject({ code: 'UNLOCK_REQUIRED', details: { reason: 'idle' } });
    const t2 = await m.unlockSvc.unlock(staff, { code: PIN, deviceId: DEVICE }, null);
    await m.unlockSvc.lock(staff, DEVICE);
    await expect(run(staff.id, t2.unlockToken, DEVICE)).rejects.toMatchObject({ code: 'UNLOCK_REQUIRED', details: { reason: 'revoked' } });
  });

  it('a person with no code chooses one once; it opens at once', async () => {
    expect((await m.reads.list(noCode)).hasCode).toBe(false);
    await expect(m.unlockSvc.unlock(noCode, { code: PIN, deviceId: DEVICE }, null)).rejects.toMatchObject({ code: 'NO_CODE_SET' });
    const first = await m.unlockSvc.setFirstCode(noCode, { code: '7391', deviceId: DEVICE }, null);
    expect(first.unlockToken).toBeTruthy();
    await expect(m.unlockSvc.setFirstCode(noCode, { code: '1234', deviceId: DEVICE }, null)).rejects.toMatchObject({ code: 'CODE_EXISTS' });
    expect((await m.unlockSvc.unlock(noCode, { code: '7391', deviceId: DEVICE }, null)).unlockToken).toBeTruthy();
  });

  it('home, history and one payslip read from the frozen lines; version 1 is replaced, version 2 marks what changed', async () => {
    const home = await m.reads.home(staff);
    expect(home.latest).toMatchObject({ month: '2024-12', versionNumber: 2, net: '38000.00', bank: { name: 'Equity', last4: '4412' } });
    expect(home.ytd).toMatchObject({ fromMonth: '2024-11', toMonth: '2024-12', earned: '100000.00', net: '76000.00' });
    expect(home.recent.map((r) => r.month)).toEqual(['2024-12', '2024-11']);
    const hist = await m.reads.history(staff, null, new Date('2025-02-01T09:00:00Z'));
    expect(hist.years).toEqual([2024]);
    expect(hist.items).toHaveLength(2);
    const dec = home.latest!;
    const v2 = await m.reads.detail(staff, dec.id, null, phone, T0);
    expect(v2).toMatchObject({ versionNumber: 2, number: 'PS-0987', replacedBy: null, status: 'PUBLISHED' });
    expect(v2.thisMonth.deductions.find((l) => l.key === 'LATE')).toMatchObject({ amount: '205.00', correctedFrom: '410.00' });
    expect(v2.thisMonth.totalDeductions).toBe('12000.00');
    expect(v2.ytd.net).toBe('76000.00');
    expect(v2.hrContact).toBeNull();
    expect(v2.versions.map((v) => v.current)).toEqual([false, true]);
    const v1 = await m.reads.detail(staff, dec.id, 1, phone, T0);
    expect(v1.replacedBy).toMatchObject({ versionNumber: 2 });
    expect(v1.thisMonth.deductions.find((l) => l.key === 'LATE')?.correctedFrom).toBeNull();
    expect((await m.reads.versionsOf(staff, dec.id)).length).toBe(2);
  });

  it("nobody reads another person's payslip: it is the same 404 as one that does not exist", async () => {
    await expect(m.reads.detail(noCode, septId, null, phone)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.reads.detail(staff, randomUUID(), null, phone)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.reads.documentOf(oldSite, septId, null, 'view', phone)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('the A4 file is made once and stored: the same bytes every time; version 1 is the REPLACED copy; every opening is audited with no amount', async () => {
    const home = await m.reads.home(staff);
    const a = await m.reads.documentOf(staff, home.latest!.id, null, 'view', phone, T0);
    const b = await m.reads.documentOf(staff, home.latest!.id, null, 'download', phone, at(60));
    expect(a.bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.filename).toBe('Payslip-PS-0987-2024-12-v2.pdf');
    const old = await m.reads.documentOf(staff, home.latest!.id, 1, 'view', phone);
    expect(old.variant).toBe('REPLACED');
    expect(old.bytes.equals(a.bytes)).toBe(false);
    expect(await m.prisma.payslipDocument.count({ where: { number: 'PS-0987' } })).toBe(2);
    const entries = await m.prisma.auditEntry.findMany({ where: { action: 'payslip.opened', subjectUserId: staff.id }, orderBy: { seq: 'desc' }, take: 6 });
    expect(entries.length).toBeGreaterThanOrEqual(5);
    const purposes = entries.map((e) => (e.after as { purpose: string }).purpose);
    expect(purposes).toEqual(expect.arrayContaining(['view', 'download']));
    for (const e of entries) expect(Object.keys(e.after as object).sort()).toEqual(['confirmed', 'month', 'number', 'openerRole', 'ownerOpened', 'purpose', 'unconfirmed', 'version']);
  });

  it("HR and the Accountant open anyone's published payslip without a code; each is audited and counted for the Director; staff cannot", async () => {
    const id = (await m.reads.home(staff)).latest!.id;
    await m.others.openAny(hr, id, null, 'Linux, Chrome');
    await m.others.openAny(hr, id, 1, 'Linux, Chrome');
    await m.others.openAny(accountant, id, null, null);
    expect(notes.filter((n) => n.kind === 'payslip.opened_by_staff' && n.data['openerId'] === hr.id)).toHaveLength(1); // one notice per opener per day
    const day = m.time.nairobiToday(new Date());
    const rows = await m.others.openingsOfDay(director, day);
    expect(rows.find((r) => r.openerId === hr.id)?.count).toBeGreaterThanOrEqual(2);
    expect(rows.find((r) => r.openerId === accountant.id)?.count).toBeGreaterThanOrEqual(1);
    const mine = await m.prisma.auditEntry.findFirstOrThrow({ where: { action: 'payslip.opened', actorId: hr.id }, orderBy: { seq: 'desc' } });
    expect(mine).toMatchObject({ subjectUserId: staff.id, actorRole: 'HR_MANAGER' });
    expect(mine.after).toMatchObject({ ownerOpened: false });
    await expect(m.others.openAny(staff, id, null, null)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.others.openAny(hr, randomUUID(), null, null)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.others.openingsOfDay(hr, day)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('a person on a branch not yet on the new payslips gets the old-card data, or the empty reason', async () => {
    const withOld = await m.reads.list(oldSite);
    expect(withOld.items).toEqual([]);
    expect(withOld.legacy).toMatchObject({ onNewSystem: false, hasOldPayslips: true, card: true, historyRow: false, emptyReason: null });
    expect(withOld.legacyAvailable).toBe(true);
    const empty = await m.reads.list(oldSiteEmpty);
    expect(empty.legacy).toMatchObject({ card: false, emptyReason: 'BRANCH_NOT_MOVED' });
    const onNew = await m.reads.list(staff);
    expect(onNew.legacy).toMatchObject({ onNewSystem: true, card: false });
  });

  it('the P9: not before December is Paid; waits for the Accountant; built once; refuses a missing KRA PIN or month; a joiner shows Not employed', async () => {
    const jan = new Date('2025-02-01T09:00:00Z');
    expect((await m.p9.myP9Status(staff, 2024, jan)).status).toBe('NOT_YET'); // December is not Paid
    await expect(m.p9.myP9Document(staff, 2024, null, jan)).rejects.toMatchObject({ code: 'P9_NOT_AVAILABLE' });
    const dec = await m.prisma.payrollMonth.findFirstOrThrow({ where: { companyId, monthKey: '2024-12' } });
    paid.set(dec.id, '2024-12-23');
    const waiting = await m.p9.myP9Status(staff, 2024, jan);
    expect(waiting).toMatchObject({ status: 'WAITING_FORMAT', availableFrom: '2025-01-01' });
    expect((await m.p9.myP9Status(staff, 2024, new Date('2024-12-30T09:00:00Z'))).status).toBe('NOT_YET'); // before 1 January
    await expect(m.p9.myP9Document(staff, 2024, null, jan)).rejects.toMatchObject({ code: 'P9_NOT_AVAILABLE', details: { status: 'WAITING_FORMAT' } });
    await expect(m.p9.confirmP9Format(hr, PIN)).rejects.toMatchObject({ statusCode: 403 }); // only the Accountant
    await expect(m.p9.confirmP9Format(accountant, '0000', jan)).rejects.toMatchObject({ code: 'PIN_INVALID' });
    const had = await m.prisma.p9FormatConfirmation.count({ where: { companyId } });
    const confirmed = await m.p9.confirmP9Format(accountant, PIN, jan);
    createdConfirmation = had === 0;
    expect(confirmed).toMatchObject({ confirmed: true });
    expect((await m.p9.myP9Status(staff, 2024, jan)).status).toBe('READY');
    const a = await m.p9.myP9Document(staff, 2024, 'Android, Chrome', jan);
    const b = await m.p9.myP9Document(staff, 2024, 'Android, Chrome', new Date('2025-03-01T09:00:00Z'));
    expect(a.number).toMatch(/^P9-2024-\d{4,6}$/);
    expect(a.bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(a.bytes.equals(b.bytes)).toBe(true); // built once, the same card every time
    expect(await m.prisma.p9Document.count({ where: { employeeId } })).toBe(1);
    const row = await m.prisma.p9Document.findFirstOrThrow({ where: { employeeId } });
    const rows = (row.data as { rows: { monthKey: string; state: string }[] }).rows;
    expect(rows.slice(0, 10).every((r) => r.state === 'NOT_EMPLOYED')).toBe(true); // joined in November
    expect(rows.slice(10).every((r) => r.state === 'PAYSLIP')).toBe(true);
    expect(await m.prisma.auditEntry.count({ where: { action: 'payslip.p9_opened', subjectUserId: staff.id } })).toBeGreaterThanOrEqual(2);
    expect(await m.prisma.auditEntry.count({ where: { action: 'p9.generated', subjectUserId: staff.id } })).toBe(1);
  });

  it('a card is refused, and HR told, when the KRA PIN is missing or a month of the employment has no payslip', async () => {
    await m.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wendo.allow_payslip_edit', 'on', true)`;
      await tx.p9Document.deleteMany({ where: { employeeId } });
    });
    await m.prisma.employee.update({ where: { id: employeeId }, data: { kraPin: null } });
    const jan = new Date('2025-02-01T09:00:00Z');
    const before = notes.length;
    await expect(m.p9.myP9Document(staff, 2024, null, jan)).rejects.toMatchObject({ code: 'P9_NO_KRA_PIN' });
    expect(notes.slice(before).some((n) => n.kind === 'p9.no_kra_pin')).toBe(true);
    await m.prisma.employee.update({ where: { id: employeeId }, data: { kraPin: 'A001234567Z', startDate: m.time.toDateColumn('2024-06-01' as never) } });
    await expect(m.p9.myP9Document(staff, 2024, null, jan)).rejects.toMatchObject({ code: 'P9_MONTH_MISSING' });
    await m.prisma.employee.update({ where: { id: employeeId }, data: { startDate: m.time.toDateColumn('2024-11-01' as never) } });
  });

  it('HR builds a card for a leaver the same way, and the opening is audited as not the owner', async () => {
    const jan = new Date('2025-02-01T09:00:00Z');
    const file = await m.p9.generateP9(hr, 2024, employeeId, 'Linux, Chrome', jan);
    expect(file.status).toBe('READY');
    expect(file.bytes.subarray(0, 4).toString()).toBe('%PDF');
    await expect(m.p9.generateP9(staff, 2024, employeeId, null, jan)).rejects.toMatchObject({ statusCode: 403 });
    const entry = await m.prisma.auditEntry.findFirstOrThrow({ where: { action: 'payslip.p9_opened', actorId: hr.id }, orderBy: { seq: 'desc' } });
    expect(entry.after).toMatchObject({ ownerOpened: false, year: 2024 });
  });
});
