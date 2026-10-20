/**
 * Casual pay against a real database, in the order a day lives it (Segment 3): a head adds casuals and records a day (an offline retry
 * with the same key makes one record; a stale version is refused; overlaps, the 3 day window and the future are refused), sends it (not
 * before every shift has ended), takes it back and sends again; the Branch Manager approves with a PIN (wrong PIN, moved total and the
 * recorder are each refused; a retry gives the same number); workers sign once; a signed sheet cannot be voided; an unsigned one can,
 * and the day is free to record again; a correction goes on a later sheet; the PDF is the same bytes until a new receipt; the month
 * summary Payroll reads adds the approved sheets up. Nobody else's department or site can see or change any of it.
 *
 * Runs only when DATABASE_URL names a lane database. It removes what it makes; the audit entries stay (the log is append-only).
 * Run the workforce database flows one file at a time.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Casual pay flows in the database', () => {
  const tag = `ZZ Cas ${randomUUID().slice(0, 6)}`;
  type Subject = import('../_shared/workforce-access').AccessSubject;
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    return {
      prisma,
      time: await import('../_shared/time/nairobi-time'),
      ...(await import('./recording/recording-service')), ...(await import('./recording/correction-service')), ...(await import('./approval/approval-service')),
      ...(await import('./approval/receipt-service')), ...(await import('./sheet/sheet-service')), ...(await import('./sheet/sheet-document-service')),
      ...(await import('../../../utils/password')),
    };
  };
  let m: Awaited<ReturnType<typeof load>>;
  let companyId = '';
  let siteId = '';
  let otherSiteId = '';
  let deptId = '';
  let dept2Id = '';
  let head: Subject;
  let head2: Subject; // heads the other department
  let bm: Subject;
  let bmOther: Subject; // manager of another site
  let bmHead: Subject; // a manager who is also a head: records, never approves their own
  let director: Subject;
  const made = { users: [] as string[], versions: [] as string[], workers: [] as string[] };
  const pinsBefore = new Map<string, string | null>();
  const PIN = '4321';
  let n = 0;
  const key = (label: string) => `${label}-${(n += 1)}-${tag.slice(-6)}`;
  const sfx = tag.slice(-6).replace(/\W/g, '');
  const t = () => m.time;
  const today = () => t().nairobiToday(new Date());
  const day = (offset: number) => t().addDays(today(), offset);
  const worker = async (subject: Subject, name: string, id: string) => m.addCasual(subject, { fullName: name, nationalId: id, nationalIdConfirm: id, idempotencyKey: key('person') });

  beforeAll(async () => {
    m = await load();
    const bmUser = await m.prisma.user.findUniqueOrThrow({ where: { email: 'bm.town@wendo.test' }, select: { site: { select: { companyId: true } } } });
    companyId = bmUser.site!.companyId;
    const director_ = await m.prisma.user.findUniqueOrThrow({ where: { email: 'director@wendo.test' }, select: { id: true, siteId: true, pinHash: true } });
    pinsBefore.set(director_.id, director_.pinHash);
    const pinHash = await m.hashPin(PIN);
    await m.prisma.user.update({ where: { id: director_.id }, data: { pinHash } });
    director = { id: director_.id, role: 'DIRECTOR', siteId: director_.siteId, headOfDepartmentIds: [] };

    const mkSite = (name: string) => m.prisma.site.create({ data: { companyId, name: `${tag} ${name}`, address: 'Proof Road', city: 'Nyeri', latitude: -0.42, longitude: 36.95, type: 'BRANCH' } });
    siteId = (await mkSite('Branch')).id;
    otherSiteId = (await mkSite('Other')).id;
    deptId = (await m.prisma.department.create({ data: { siteId, name: `${tag} Service` } })).id;
    dept2Id = (await m.prisma.department.create({ data: { siteId, name: `${tag} Kitchen` } })).id;
    const mkUser = async (label: string, role: 'WAITER' | 'MANAGER', site: string) => {
      const u = await m.prisma.user.create({ data: { name: `${tag} ${label}`, email: `zz.cas.${label.toLowerCase()}.${sfx.toLowerCase()}@wendo.test`, passwordHash: 'x', pinHash, role, siteId: site } });
      made.users.push(u.id);
      return u.id;
    };
    head = { id: await mkUser('Head', 'WAITER', siteId), role: 'WAITER', siteId, headOfDepartmentIds: [deptId] };
    head2 = { id: await mkUser('Head2', 'WAITER', siteId), role: 'WAITER', siteId, headOfDepartmentIds: [dept2Id] };
    bm = { id: await mkUser('Manager', 'MANAGER', siteId), role: 'MANAGER', siteId, headOfDepartmentIds: [] };
    bmOther = { id: await mkUser('OtherMgr', 'MANAGER', otherSiteId), role: 'MANAGER', siteId: otherSiteId, headOfDepartmentIds: [] };
    bmHead = { id: await mkUser('MgrHead', 'MANAGER', siteId), role: 'MANAGER', siteId, headOfDepartmentIds: [dept2Id] };

    const last = await m.prisma.ruleVersion.aggregate({ where: { companyId, siteId: null, group: 'CASUAL_WORK' }, _max: { version: true } });
    const rule = await m.prisma.ruleVersion.create({
      data: { companyId, siteId: null, group: 'CASUAL_WORK', version: (last._max.version ?? 0) + 1, effectiveFrom: m.time.toDateColumn('2026-01-01' as never), values: { defaultDailyRate: '900', rates: [], pettyCashHolder: { mode: 'BRANCH_MANAGER' }, latenessReducesPayout: true }, reason: `${tag} test`, createdById: director.id, createdByRole: 'DIRECTOR' },
    });
    made.versions.push(rule.id);
  });

  afterAll(async () => {
    if (!enabled) return;
    await m.prisma.casualSheet.deleteMany({ where: { siteId: { in: [siteId, otherSiteId] } } });
    await m.prisma.casualWorker.deleteMany({ where: { companyId, nationalId: { endsWith: sfx.toUpperCase() } } });
    await m.prisma.casualRequestKey.deleteMany({ where: { key: { endsWith: tag.slice(-6) } } });
    await m.prisma.ruleVersion.deleteMany({ where: { id: { in: made.versions } } });
    await m.prisma.department.deleteMany({ where: { id: { in: [deptId, dept2Id] } } });
    await m.prisma.user.deleteMany({ where: { id: { in: made.users } } });
    await m.prisma.site.deleteMany({ where: { id: { in: [siteId, otherSiteId] } } });
    for (const [id, hash] of pinsBefore) await m.prisma.user.update({ where: { id }, data: { pinHash: hash } });
    await m.prisma.$disconnect();
  });

  let peter = '';
  let rose = '';
  let sheetId = '';
  const yesterday = () => day(-1);
  const put = (subject: Subject, date: string, version: number, lines: { casualId: string; start: string; end: string }[], dept = deptId, k = key('lines')) =>
    m.putLines(subject, { siteId, departmentId: dept, date: date as never, version, idempotencyKey: k, lines });

  it('a casual is added once: a retry with the same key is the same worker, the same ID number with a new key is CASUAL_EXISTS', async () => {
    const k = key('person');
    const a = await m.addCasual(head, { fullName: 'Peter Mwangi', nationalId: `3${sfx}`, nationalIdConfirm: `3${sfx}`, idempotencyKey: k });
    const b = await m.addCasual(head, { fullName: 'Peter Mwangi', nationalId: `3${sfx}`, nationalIdConfirm: `3${sfx}`, idempotencyKey: k });
    expect(b.id).toBe(a.id);
    expect(a.idMasked).toMatch(/^3•+/);
    peter = a.id;
    await expect(worker(head2, 'Peter Again', `3${sfx}`)).rejects.toMatchObject({ code: 'CASUAL_EXISTS' }); // a head in another department finds the same record
    rose = (await worker(head, 'Rose Wanjiru', `2${sfx}`)).id;
  });

  it('a department head records the day: the day rate, 8 hours exactly, hours over 8 at an eighth, whole shillings', async () => {
    const empty = await m.getDay(head, { siteId, departmentId: deptId, date: yesterday() });
    expect(empty).toMatchObject({ status: 'NONE', rate: '900.00', version: 0, noRate: false });
    const saved = await put(head, yesterday(), 0, [{ casualId: peter, start: '07:00', end: '15:00' }, { casualId: rose, start: '10:00', end: '19:00' }]);
    sheetId = saved.id!;
    expect(saved.lines.map((l) => l.amount).sort()).toEqual(['1013.00', '900.00']);
    expect(saved.total).toBe('1913.00');
    expect(saved.status).toBe('DRAFT');
  });

  it('"My casuals" lists the department workers with the last day each worked, and a name or ID fragment narrows it', async () => {
    const all = await m.listWorkers(head, { siteId, departmentId: deptId });
    expect(all.map((w) => w.id)).toEqual(expect.arrayContaining([peter, rose]));
    expect(all.find((w) => w.id === peter)?.lastWorked).toBe(yesterday());
    expect((await m.listWorkers(head, { siteId, departmentId: deptId, q: 'Rose' })).map((w) => w.id)).toEqual([rose]);
  });

  it('an offline retry makes one record; a stale version is refused with CHANGED_UNDERNEATH', async () => {
    const k = key('lines');
    const lines = [{ casualId: peter, start: '07:00', end: '15:00' }, { casualId: rose, start: '10:00', end: '19:00' }];
    const first = await put(head, yesterday(), 1, lines, deptId, k);
    const retry = await put(head, yesterday(), 1, lines, deptId, k); // the phone never heard the answer
    expect(retry.version).toBe(first.version);
    await expect(put(head, yesterday(), 1, lines)).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' }); // another head saved meanwhile
    expect(await m.prisma.casualSheet.count({ where: { siteId, departmentId: deptId, workDate: m.time.toDateColumn(yesterday()) } })).toBe(1);
  });

  it('refuses a day more than 3 days back, a day in the future, a worker twice, 16+ hours, end before start', async () => {
    await expect(put(head, day(-4), 0, [{ casualId: peter, start: '07:00', end: '15:00' }])).rejects.toMatchObject({ code: 'DAY_TOO_OLD' });
    await expect(put(head, day(1), 0, [{ casualId: peter, start: '07:00', end: '15:00' }])).rejects.toMatchObject({ code: 'DAY_IN_FUTURE' });
    await expect(put(head, day(-2), 0, [{ casualId: peter, start: '07:00', end: '15:00' }, { casualId: peter, start: '16:00', end: '18:00' }])).rejects.toMatchObject({ code: 'DUPLICATE_WORKER' });
    await expect(put(head, day(-2), 0, [{ casualId: peter, start: '05:00', end: '22:30' }])).rejects.toMatchObject({ code: 'DAY_TOO_LONG' });
    await expect(put(head, day(-2), 0, [{ casualId: peter, start: '15:00', end: '07:00' }])).rejects.toMatchObject({ code: 'END_BEFORE_START' });
  });

  it('the same worker at overlapping times in another department is refused, naming the site and the times', async () => {
    await expect(put(head2, yesterday(), 0, [{ casualId: peter, start: '14:00', end: '18:00' }], dept2Id)).rejects.toMatchObject({ code: 'WORKER_OVERLAP', message: expect.stringContaining('from 07:00 to 15:00') });
    const touching = await put(head2, yesterday(), 0, [{ casualId: peter, start: '15:00', end: '18:00' }], dept2Id); // touching is fine
    expect(touching.lines).toHaveLength(1);
    await m.prisma.casualSheet.deleteMany({ where: { id: touching.id! } });
  });

  it('a head of another department, another site, or no one cannot see or change the sheet (404)', async () => {
    await expect(m.getById(head2, sheetId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.getById(bmOther, sheetId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(put(head2, yesterday(), 1, [], deptId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.sendSheet(head2, sheetId, { version: 1, idempotencyKey: key('send') })).rejects.toMatchObject({ statusCode: 404 });
    expect((await m.getById(bm, sheetId)).id).toBe(sheetId); // the site's manager reads it
  });

  it('it cannot be sent until every shift has ended; then it is sent, taken back, edited and sent again', async () => {
    const row = await m.prisma.casualSheet.findUniqueOrThrow({ where: { id: sheetId } });
    const early = m.time.instantAt(yesterday(), '16:00' as never); // 16:00: Peter has finished, Rose is on until 19:00
    await expect(m.sendSheet(head, sheetId, { version: row.version, idempotencyKey: key('send') }, early)).rejects.toMatchObject({ code: 'SHIFT_NOT_ENDED', message: expect.stringContaining('ends at 19:00') });
    const sent = await m.sendSheet(head, sheetId, { version: row.version, idempotencyKey: key('send') });
    expect(sent.status).toBe('SENT');
    await expect(put(head, yesterday(), sent.version, [])).rejects.toMatchObject({ code: 'SHEET_NOT_EDITABLE' });
    const back = await m.takeBack(head, sheetId, { version: sent.version, idempotencyKey: key('back') });
    expect(back.status).toBe('DRAFT');
    const again = await m.sendSheet(head, sheetId, { version: back.version, idempotencyKey: key('send') });
    expect(again.status).toBe('SENT');
  });

  it('only the approver decides: a wrong PIN, a moved total and a recorder are refused; the head holds no approve capability', async () => {
    const sent = await m.getById(bm, sheetId);
    const body = (over: object = {}) => ({ pin: PIN, version: sent.version, expectedTotal: sent.total, idempotencyKey: key('approve'), ...over });
    await expect(m.approveSheet(head, sheetId, body())).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.approveSheet(bmOther, sheetId, body())).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.approveSheet(bm, sheetId, body({ pin: '0000' }))).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(m.approveSheet(bm, sheetId, body({ expectedTotal: '1.00' }))).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' });
    await expect(m.approveSheet(bm, sheetId, body({ version: sent.version + 5 }))).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' });
  });

  it('the Branch Manager sends back with a reason; the head edits and sends again', async () => {
    const sent = await m.getById(bm, sheetId);
    const back = await m.sendBack(bm, sheetId, { reason: 'Rose finished at 18:00, not 19:00', version: sent.version, idempotencyKey: key('sb') });
    expect(back).toMatchObject({ status: 'SENT_BACK', sentBackReason: 'Rose finished at 18:00, not 19:00' });
    const edited = await put(head, yesterday(), back.version, [{ casualId: peter, start: '07:00', end: '15:00' }, { casualId: rose, start: '10:00', end: '18:00' }]);
    expect(edited.total).toBe('1800.00');
    const sentAgain = await m.sendSheet(head, sheetId, { version: edited.version, idempotencyKey: key('send') });
    expect(sentAgain.status).toBe('SENT');
  });

  let approved: Awaited<ReturnType<typeof m.getById>>;
  it('approval with the right PIN numbers the sheet once, freezes it, and a retry returns the same number', async () => {
    const sent = await m.getById(bm, sheetId);
    const k = key('approve');
    approved = await m.approveSheet(bm, sheetId, { pin: PIN, version: sent.version, expectedTotal: sent.total, idempotencyKey: k });
    expect(approved.status).toBe('APPROVED');
    expect(approved.number).toMatch(/^CPS-\d{4}$/);
    expect(approved.cashHolder?.id).toBe(bm.id);
    const retry = await m.approveSheet(bm, sheetId, { pin: PIN, version: sent.version, expectedTotal: sent.total, idempotencyKey: k });
    expect(retry.number).toBe(approved.number);
    const row = await m.prisma.casualSheet.findUniqueOrThrow({ where: { id: sheetId } });
    expect(row.documentHash).toMatch(/^[0-9a-f]{64}$/);
    await expect(m.approveSheet(bm, sheetId, { pin: PIN, version: sent.version, expectedTotal: sent.total, idempotencyKey: key('approve') })).rejects.toMatchObject({ code: 'SHEET_NOT_WAITING' });
    const entry = await m.prisma.auditEntry.findFirstOrThrow({ where: { action: 'casual.sheet_approved', subjectId: sheetId } });
    expect(Object.keys(entry.after as object).sort()).toEqual(['date', 'departmentId', 'method', 'number', 'workers']); // no amount, no PIN
    expect(entry.before).toBeNull();
  });

  it('workers sign once, on the head phone; a signed sheet cannot be voided', async () => {
    const lineId = approved.lines.find((l) => l.casualId === peter)!.id;
    const k = key('receive');
    const first = await m.receiveCash(head, sheetId, lineId, { name: 'Peter Mwangi', idempotencyKey: k });
    expect(first.waitingForCash).toBe(1);
    await m.receiveCash(head, sheetId, lineId, { name: 'Peter Mwangi', idempotencyKey: k }); // a double tap
    await expect(m.receiveCash(head, sheetId, lineId, { name: 'Peter Mwangi', idempotencyKey: key('receive') })).rejects.toMatchObject({ code: 'ALREADY_RECEIVED' });
    await expect(m.receiveCash(head2, sheetId, lineId, { name: 'Someone Else', idempotencyKey: key('receive') })).rejects.toMatchObject({ statusCode: 404 });
    const sheet = await m.getById(bm, sheetId);
    await expect(m.voidSheet(bm, sheetId, { reason: 'Wrong day entirely', pin: PIN, version: sheet.version, idempotencyKey: key('void') })).rejects.toMatchObject({ code: 'ALREADY_SIGNED' });
  });

  it('the PDF is the same bytes until a new receipt; the preview is a draft with no number', async () => {
    const a = await m.documentPdf(bm, sheetId);
    const b = await m.documentPdf(head, sheetId);
    expect(a.bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(a.bytes.equals(b.bytes)).toBe(true);
    const lineId = approved.lines.find((l) => l.casualId === rose)!.id;
    await m.receiveCash(head, sheetId, lineId, { name: 'Rose Wanjiru', idempotencyKey: key('receive') });
    expect((await m.documentPdf(bm, sheetId)).bytes.equals(a.bytes)).toBe(false);
    await expect(m.previewPdf(head, sheetId)).rejects.toMatchObject({ code: 'SHEET_NOT_DRAFT' });
  });

  it('a manager who is also a head records but cannot approve the sheet; the Director can', async () => {
    const wk = await worker(bmHead, 'Grace Njeri', `4${sfx}`);
    const saved = await m.putLines(bmHead, { siteId, departmentId: dept2Id, date: day(-2) as never, version: 0, idempotencyKey: key('lines'), lines: [{ casualId: wk.id, start: '08:00', end: '16:00' }] });
    const sent = await m.sendSheet(bmHead, saved.id!, { version: saved.version, idempotencyKey: key('send') });
    const body = { pin: PIN, version: sent.version, expectedTotal: sent.total, idempotencyKey: key('approve') };
    await expect(m.approveSheet(bmHead, saved.id!, body)).rejects.toMatchObject({ code: 'SELF_APPROVAL' });
    await expect(m.approveSheet(bm, saved.id!, { ...body, idempotencyKey: key('approve') })).rejects.toMatchObject({ code: 'DIRECTOR_ONLY' }); // a manager's sheet is the Director's
    expect((await m.waiting(bm)).toApprove.some((c) => c.id === saved.id)).toBe(false);
    expect((await m.waiting(director)).toApprove.some((c) => c.id === saved.id)).toBe(true);
    const done = await m.approveSheet(director, saved.id!, { ...body, idempotencyKey: key('approve') });
    expect(done).toMatchObject({ status: 'APPROVED', approvedBy: { id: director.id } });
    expect(done.cashHolder?.id).not.toBe(director.id); // the cash is the site manager's, not the Director's
  });

  it('an unsigned approved sheet can be voided, and the day is free to record again', async () => {
    const wk = await worker(head, 'Mary Atieno', `5${sfx}`);
    const saved = await put(head, day(-3), 0, [{ casualId: wk.id, start: '07:00', end: '15:00' }]);
    const sent = await m.sendSheet(head, saved.id!, { version: saved.version, idempotencyKey: key('send') });
    const ok = await m.approveSheet(bm, saved.id!, { pin: PIN, version: sent.version, expectedTotal: sent.total, idempotencyKey: key('approve') });
    const voided = await m.voidSheet(bm, saved.id!, { reason: 'Recorded on the wrong day', pin: PIN, version: ok.version, idempotencyKey: key('void') });
    expect(voided).toMatchObject({ status: 'VOID', number: ok.number });
    const fresh = await put(head, day(-3), 0, [{ casualId: wk.id, start: '07:00', end: '15:00' }]);
    expect(fresh.id).not.toBe(saved.id);
    expect((await m.documentPdf(bm, saved.id!)).bytes.length).toBeGreaterThan(1000); // the voided sheet still prints, marked VOID
  });

  it('a correction goes on a later sheet for a signed day and counts in its total; it needs a signed day', async () => {
    const todaySheet = await put(head, today(), 0, [{ casualId: peter, start: '07:00', end: '08:00' }]);
    const withCorrection = await m.addCorrection(head, todaySheet.id!, { casualId: peter, originalDate: yesterday() as never, amount: '-100', reason: 'Peter left an hour early', version: todaySheet.version, idempotencyKey: key('corr') });
    expect(withCorrection.corrections).toHaveLength(1);
    expect(withCorrection.total).toBe(String((Number(todaySheet.total) - 100).toFixed(2)));
    await expect(m.addCorrection(head, todaySheet.id!, { casualId: peter, originalDate: day(-2) as never, amount: '50', reason: 'No signed day here', version: withCorrection.version, idempotencyKey: key('corr') })).rejects.toMatchObject({ code: 'NO_SIGNED_DAY' });
    await expect(m.addCorrection(head, todaySheet.id!, { casualId: peter, originalDate: yesterday() as never, amount: '-5000', reason: 'Far too much taken off', version: withCorrection.version, idempotencyKey: key('corr') })).rejects.toMatchObject({ code: 'TOTAL_NEGATIVE' });
  });

  it('the month summary Payroll reads adds up the approved sheets, per department, and lists the waiting ones separately', async () => {
    const monthKey = yesterday().slice(0, 7);
    const summary = await m.monthSummary(companyId, monthKey);
    const mine = summary.byDepartment.find((d) => d.departmentId === deptId)!;
    expect(mine.workers).toBeGreaterThanOrEqual(2);
    expect(Number(summary.paidTotal)).toBeGreaterThanOrEqual(1800);
    expect(summary.latestSheets.some((s) => s.number === approved.number)).toBe(true);
    expect(summary.source).toBe('SHEETS');
  });
});
