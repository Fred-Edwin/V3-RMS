/**
 * Timesheets against a real database, in the order a pilot branch lives it (Segment 1A): a switched-off branch has no timesheets;
 * a week is clocked (matched days, one late day, one overtime day, one early clock-out) and the matched days approve themselves;
 * a manager's clock fix works before approval; overtime is answered all, part or none with a PIN and a version; requests are
 * answered; nothing closes by itself; the month cannot be approved while something still needs deciding, and then it is, once,
 * with a document number, a frozen snapshot and an audit entry; after that every fix and decision is refused, a new request goes
 * to HR, payroll reads approved hours, both exports download, the sweep leaves it alone and the audit chain verifies.
 *
 * Runs only when DATABASE_URL names a lane database (same guard as the attendance flow). It removes what it makes; the audit
 * entries stay (the log is append-only by design). Run the workforce database flows one file at a time.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Timesheets flows in the database', () => {
  const tag = `ZZ Tsh ${randomUUID().slice(0, 6)}`;
  type Subject = import('../_shared/workforce-access').AccessSubject;
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    return {
      prisma,
      time: await import('../_shared/time/nairobi-time'),
      ...(await import('./months/months-service')), ...(await import('./months/people/person-month')), ...(await import('./approval/approve-service')),
      ...(await import('./exports/exports-service')), ...(await import('./days/decide-service')), ...(await import('./overtime/overtime-service')),
      ...(await import('./overtime/overtime-detail-service')), ...(await import('./overtime/overtime-note-service')),
      ...(await import('./requests/requests-service')), ...(await import('./requests/request-decide-service')), ...(await import('./requests/escalation-service')),
      ...(await import('./me/me-service')), ...(await import('./approved-hours')), ...(await import('./register-timesheets')), ...(await import('./timesheets-sweep')),
      ...(await import('../attendance/fixes/fixes-service')), ...(await import('../attendance/fixes/period-lock')), ...(await import('../_shared/audit/audit-repository')),
      ...(await import('../_shared/audit/audit-hash')), ...(await import('../_shared/events')), ...(await import('../../../utils/password')),
    };
  };
  let m: Awaited<ReturnType<typeof load>>;

  let townId = '';
  let companyId = '';
  let hr: Subject;
  let director: Subject;
  let accountant: Subject;
  let townManager: Subject;
  let highwayManager: Subject;
  let barista: Subject;
  let baristaUserId = '';
  let ids = { barista: '', lena: '', template: '' };
  let hadSwitch = false;
  const pinsBefore = new Map<string, string | null>();
  const weeks: string[] = [];
  const seen: string[] = [];
  const D = (day: number) => `2026-10-0${day}` as import('../_shared/time/nairobi-time').NairobiDate; // Mon 5 to Fri 9 October
  const at = (date: string, clock: string) => m.time.instantAt(date as never, m.time.parseClockTime(clock));
  const NOW = new Date('2026-10-09T17:00:00Z'); // Fri 20:00 in Nairobi: every shift is over, the month is still open
  const LATER = new Date('2026-11-03T09:00:00Z'); // the month has ended
  const PIN = '4321';
  const startedAt = new Date();
  let key = 0;
  const nextKey = (label: string) => `${label}-key-${(key += 1)}-${tag.slice(-6)}`;
  const dayOf = async (employeeId: string, date: string) => m.prisma.timesheetDay.findFirstOrThrow({ where: { employeeId, shiftDate: m.time.toDateColumn(date as never) } });
  const period = () => m.prisma.timesheetPeriod.findFirstOrThrow({ where: { siteId: townId, endDate: m.time.toDateColumn('2026-10-31' as never) } });
  const q = { people: { q: undefined, dept: undefined, view: 'all' as const, sort: 'department' as const, dir: 'asc' as const, page: 1, rows: 50 } };
  const totalsNow = async (when: Date) => {
    const month = await m.getMonth(townManager, '2026-10', {}, when);
    return { workedMinutes: month.kpis.workedMinutes, overtimeAuthorisedMinutes: month.kpis.overtime.approvedMinutes, headcount: month.kpis.headcount };
  };

  const clock = async (employeeId: string, entryId: string, date: string, inAt: string, outAt: string) => {
    for (const [type, clk] of [['IN', inAt], ['OUT', outAt]] as const) {
      await m.prisma.clockEvent.create({ data: { siteId: townId, employeeId, rotaEntryId: entryId, shiftDate: m.time.toDateColumn(date as never), type, source: 'PHONE', occurredAt: at(date, clk), serverAt: at(date, clk) } });
    }
  };

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, pinHash: true, site: { select: { companyId: true } } } });
    const [admin, dir, acc, bmTown, bmHighway, baristaUser] = await Promise.all(['admin', 'director', 'accountant', 'bm.town', 'bm.highway', 'barista.head.town'].map((n) => user(`${n}@wendo.test`)));
    for (const u of [admin!, dir!, acc!, bmTown!, bmHighway!]) pinsBefore.set(u.id, u.pinHash);
    // The people who sign here get a known PIN for the run; their own is put back afterwards.
    const pinHash = await m.hashPin(PIN);
    for (const u of [dir!, bmTown!, bmHighway!, admin!]) await m.prisma.user.update({ where: { id: u.id }, data: { pinHash } });
    townId = bmTown!.siteId!;
    companyId = bmTown!.site!.companyId;
    const baristaEmp = await m.prisma.employee.findFirstOrThrow({ where: { userId: baristaUser!.id } });
    baristaUserId = baristaUser!.id;
    hr = { id: admin!.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    director = { id: dir!.id, role: 'DIRECTOR', siteId: dir!.siteId, headOfDepartmentIds: [] };
    accountant = { id: acc!.id, role: 'ACCOUNTANT', siteId: acc!.siteId, headOfDepartmentIds: [] };
    townManager = { id: bmTown!.id, role: 'MANAGER', siteId: townId, headOfDepartmentIds: [] };
    highwayManager = { id: bmHighway!.id, role: 'MANAGER', siteId: bmHighway!.siteId, headOfDepartmentIds: [] };
    barista = { id: baristaUser!.id, role: 'BARISTA', siteId: townId, headOfDepartmentIds: [baristaEmp.departmentId as string] };

    const service = await m.prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'SERVICE' } });
    const lena = await m.prisma.employee.create({
      data: { companyId, siteId: townId, employeeNumber: `ZZT-${tag.slice(-6)}`, name: `${tag} Lena`, departmentId: service.id, payType: 'MONTHLY_SALARY', startDate: m.time.toDateColumn(D(1)), status: 'ACTIVE', tracksTime: true },
    });
    const template = await m.prisma.shiftTemplate.create({ data: { companyId, siteId: townId, name: `${tag} Morning`, colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 } });
    ids = { barista: baristaEmp.id, lena: lena.id, template: template.id };
    hadSwitch = (await m.prisma.attendanceSiteSwitch.count({ where: { siteId: townId } })) > 0;

    // Lena: Mon on time, Tue 20 minutes late, Wed on time, Thu 40 minutes over, Fri on time. The barista: Fri clocked out at 11:20.
    const plan: [string, string, string, string][] = [['lena', D(5), '05:58', '14:01'], ['lena', D(6), '06:20', '14:00'], ['lena', D(7), '06:00', '14:02'], ['lena', D(8), '06:00', '14:40'], ['lena', D(9), '05:55', '14:00']];
    const baristaPlan: [string, string, string, string][] = [['barista', D(5), '06:00', '14:00'], ['barista', D(6), '05:57', '14:00'], ['barista', D(7), '06:00', '14:03'], ['barista', D(8), '06:01', '14:00'], ['barista', D(9), '06:00', '11:20']];
    for (const [who, date, inAt, outAt] of [...plan, ...baristaPlan]) {
      const emp = who === 'lena' ? lena : baristaEmp;
      const week = await m.prisma.rotaWeek.create({ data: { siteId: townId, departmentId: emp.departmentId as string, weekStart: m.time.toDateColumn(m.time.weekStart(date as never, 1)) } }).catch(async () =>
        m.prisma.rotaWeek.findFirstOrThrow({ where: { siteId: townId, departmentId: emp.departmentId as string, weekStart: m.time.toDateColumn(m.time.weekStart(date as never, 1)) } }),
      );
      weeks.push(week.id);
      const entry = await m.prisma.rotaEntry.create({ data: { weekId: week.id, siteId: townId, employeeId: emp.id, date: m.time.toDateColumn(date as never), templateId: template.id } });
      await clock(emp.id, entry.id, date, inAt, outAt);
    }
    for (const name of ['timesheets.month_approved', 'timesheet.day_decided', 'overtime.decided', 'time_request.created', 'time_request.decided', 'time_request.escalated'] as const) {
      m.workforceEvents.on(name, () => seen.push(name));
    }
    m.registerTimesheets();
  }, 60_000);

  afterAll(async () => {
    if (!m) return;
    m.setPeriodClosedCheck(null);
    const everyone = [ids.barista, ids.lena];
    await m.prisma.timeRequest.deleteMany({ where: { employeeId: { in: everyone } } });
    await m.prisma.timesheetPeriod.deleteMany({ where: { siteId: townId } }); // days, weeks, overtime and exports follow
    await m.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('workforce.allow_clock_edits', 'on', true)`; // tests only: the events table is append-only
      await tx.clockEvent.deleteMany({ where: { employeeId: { in: everyone } } });
    });
    await m.prisma.rotaEntry.deleteMany({ where: { employeeId: { in: everyone } } });
    await m.prisma.rotaWeek.deleteMany({ where: { id: { in: weeks } } });
    await m.prisma.shiftTemplate.deleteMany({ where: { id: ids.template } });
    if (!hadSwitch) await m.prisma.attendanceSiteSwitch.deleteMany({ where: { siteId: townId } });
    await m.prisma.employee.deleteMany({ where: { id: ids.lena } });
    for (const [id, pinHash] of pinsBefore) await m.prisma.user.update({ where: { id }, data: { pinHash } });
    await m.prisma.$disconnect();
  }, 60_000);

  it('a branch with the switch off has no timesheets and nothing is written', async () => {
    await m.prisma.attendanceSiteSwitch.upsert({ where: { siteId: townId }, create: { siteId: townId, enabled: false }, update: { enabled: false } });
    expect(await m.listMonths(townManager, { site: townId, page: 1, rows: 5 }, NOW)).toMatchObject({ enabled: false, months: [], total: 0 });
    expect(await m.prisma.timesheetPeriod.count({ where: { siteId: townId } })).toBe(0);
    expect(await m.myTime(barista, {}, NOW)).toMatchObject({ enabled: false });
  });

  it('with the switch on, the open month shows "so far", the matched days approve themselves and only the exceptions need a person', async () => {
    await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: true, enabledAt: new Date(NOW.getTime() - 7 * 86_400_000) } });
    const list = await m.listMonths(townManager, { site: townId, page: 1, rows: 5 }, NOW);
    expect(list.enabled).toBe(true);
    expect(list.months[0]).toMatchObject({ monthKey: '2026-10', label: 'October 2026', state: 'OPEN', soFarThroughDate: '2026-10-09', approvedAt: null, documentNumber: null });
    expect(list.months[0]!.workedMinutes).toBeGreaterThan(0);
    expect(list.months[0]!.needsYouCount).toBe(1); // the overtime; late and an early clock-out never block (D2)

    const month = await m.getMonth(townManager, '2026-10', {}, NOW);
    expect(month).toMatchObject({ state: 'OPEN', window: { start: '2026-10-01', end: '2026-10-31' }, capabilities: { canApprove: true, canExport: true, canDecide: true }, approvableFrom: '2026-11-01' });
    expect(month.needsYou).toMatchObject({ clockOutFixes: 0, overtimeDecisions: 1, requestsWithManager: 0, daysToLookAt: 0, total: 1 });
    expect(month.kpis).toMatchObject({ overtime: { toDecideMinutes: 40 } });
    expect(month.soFar).toMatchObject({ throughDate: '2026-10-09' });
    expect(month.rulesUsed.map((r) => r.key)).toEqual(['LATENESS', 'OVERTIME']);

    const people = await m.listPeople(townManager, '2026-10', q.people as never, NOW);
    const lena = people.rows.find((r) => r.employeeId === ids.lena)!;
    expect(lena).toMatchObject({ status: { kind: 'OVERTIME_TO_DECIDE', minutes: 40 }, lateDays: 1, needsYou: 1 });
    expect(people.rows.find((r) => r.employeeId === ids.barista)!.status).toEqual({ kind: 'NOTHING' }); // an early clock-out is recorded, not decided
    expect((await dayOf(ids.lena, D(5))).status).toBe('AUTO_APPROVED');
    expect(await dayOf(ids.lena, D(6))).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['LATE'], minutesLate: 20 });
    expect(await dayOf(ids.lena, D(8))).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['OVERTIME'] });
    expect(await dayOf(ids.barista, D(9))).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['LEFT_EARLY'] });
  });

  it('refreshing again changes nothing and writes no second audit entry', async () => {
    const before = await m.prisma.auditEntry.count({ where: { companyId, action: 'timesheet.auto_approved' } });
    const stamp = await m.prisma.timesheetDay.findFirstOrThrow({ where: { employeeId: ids.lena, shiftDate: m.time.toDateColumn(D(5)) }, select: { updatedAt: true } });
    await m.getMonth(townManager, '2026-10', {}, new Date(NOW.getTime() + 60_000));
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'timesheet.auto_approved' } })).toBe(before);
    expect((await m.prisma.timesheetDay.findFirstOrThrow({ where: { employeeId: ids.lena, shiftDate: m.time.toDateColumn(D(5)) }, select: { updatedAt: true } })).updatedAt).toEqual(stamp.updatedAt);
  });

  it('who sees what: another branch gets 404, HR and the Accountant read and decide nothing, a head reads nothing', async () => {
    await expect(m.getMonth(highwayManager, '2026-10', { site: townId }, NOW)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.getMonth(barista, '2026-10', {}, NOW)).rejects.toMatchObject({ statusCode: 404 }); // a head reads no timesheet
    const day = await dayOf(ids.lena, D(6));
    await expect(m.decideDay(highwayManager, day.id, { outcome: 'ACCEPT' }, NOW)).rejects.toMatchObject({ statusCode: 404 });
    for (const who of [accountant, hr, director]) await expect(m.decideDay(who, day.id, { outcome: 'EXCUSE', reason: 'Not mine to do' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.decideDay(barista, day.id, { outcome: 'EXCUSE', reason: 'Not mine to do' }, NOW)).rejects.toMatchObject({ statusCode: 404 }); // a head reads no timesheet, so for them it is not there
    for (const who of [accountant, hr]) {
      const view = await m.getMonth(who, '2026-10', { site: townId }, NOW);
      expect(view.capabilities).toEqual({ canApprove: false, canExport: true, canDecide: false });
      expect((await m.listPeople(who, '2026-10', { ...q.people, site: townId } as never, NOW)).total).toBeGreaterThanOrEqual(2);
    }
    expect((await m.getMonth(director, '2026-10', { site: townId }, NOW)).capabilities).toMatchObject({ canApprove: false, canExport: false });
    await expect(m.approveMonth(hr, '2026-10', { pin: PIN, idempotencyKey: nextKey('hr'), expectedTotals: await totalsNow(NOW), site: townId }, LATER)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.approveMonth(accountant, '2026-10', { pin: PIN, idempotencyKey: nextKey('acc'), expectedTotals: await totalsNow(NOW), site: townId }, LATER)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.approveMonth(highwayManager, '2026-10', { pin: PIN, idempotencyKey: nextKey('hw'), expectedTotals: await totalsNow(NOW), site: townId }, LATER)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a person\'s drawer and full month read the same numbers as the table', async () => {
    const drawer = await m.personDrawer(townManager, '2026-10', ids.lena, {}, NOW);
    expect(drawer.needLook).toEqual([expect.objectContaining({ kind: 'OVERTIME', minutes: 40, date: D(8) })]);
    expect(drawer.totals).toMatchObject({ plannedMinutes: 2400, overtimeMinutes: 40 });
    expect(drawer.lastDays).toHaveLength(7);
    expect(drawer.lastDays[0]!.date).toBe('2026-10-31'); // the last 7 days of the range, newest first
    expect(drawer.neighbours.prevEmployeeId !== drawer.neighbours.nextEmployeeId || drawer.neighbours.prevEmployeeId === null).toBe(true);
    const days = await m.personDays(townManager, '2026-10', ids.lena, { view: 'all', page: 1, rows: 50 }, NOW);
    expect(days.total).toBe(31);
    expect(days.days.find((d) => d.date === D(8))).toMatchObject({ resultKey: 'OVERTIME_TO_DECIDE', overtimeMinutes: 40, needsLook: true, clockOut: '2026-10-08T11:40:00.000Z' });
    expect(days.days.find((d) => d.date === '2026-10-04')).toMatchObject({ resultKey: 'REST' });
    expect(days.glance.find((g) => g.date === D(6))!.kind).toBe('LATE');
    await expect(m.personDrawer(townManager, '2026-10', ids.lena, { from: '2026-09-01', to: '2026-09-30' }, NOW)).rejects.toMatchObject({ code: 'RANGE_OUTSIDE_MONTH' });
    await expect(m.personDrawer(highwayManager, '2026-10', ids.lena, {}, NOW)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a head leaves one note on pending overtime; it decides nothing and cannot be repeated', async () => {
    const item = await m.prisma.overtimeItem.findFirstOrThrow({ where: { employeeId: ids.lena } });
    await expect(m.noteOvertime(highwayManager, item.id, { text: 'Saw it' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.noteOvertime(barista, item.id, { text: 'Saw it, no objection' }, NOW)).rejects.toMatchObject({ statusCode: 403 }); // Lena is in another department
    const headService = { ...barista, headOfDepartmentIds: [(await m.prisma.employee.findUniqueOrThrow({ where: { id: ids.lena } })).departmentId as string] };
    await expect(m.noteOvertime(headService, item.id, { text: 'Saw it, no objection' }, NOW)).resolves.toMatchObject({ text: 'Saw it, no objection' });
    await expect(m.noteOvertime(headService, item.id, { text: 'Again' }, NOW)).rejects.toMatchObject({ code: 'ALREADY_NOTED' });
    const detail = await m.overtimeDetail(townManager, item.id);
    expect(detail).toMatchObject({ status: 'PENDING', extraMinutes: 40, canDecide: true, canNote: false, plannedStart: '06:00', plannedEnd: '14:00', part: { min: 5, max: 35, step: 5 } });
    expect(detail.evidence.headNote).toMatchObject({ text: 'Saw it, no objection' });
    expect(JSON.stringify(detail)).not.toMatch(/amount|total|takings|value/i); // counts only, never takings
    expect(await m.prisma.overtimeItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ status: 'PENDING', authorisedMinutes: 0 });
  });

  it('the month cannot be approved before it ends, nor while something still needs deciding', async () => {
    await expect(m.approveMonth(townManager, '2026-10', { pin: PIN, idempotencyKey: nextKey('early'), expectedTotals: await totalsNow(NOW) }, NOW)).rejects.toMatchObject({ code: 'MONTH_NOT_ENDED' });
    await expect(m.approveMonth(townManager, '2026-10', { pin: PIN, idempotencyKey: nextKey('blocked'), expectedTotals: await totalsNow(LATER) }, LATER)).rejects.toMatchObject({ code: 'NEEDS_YOU_REMAINS', details: expect.objectContaining({ overtimeDecisions: 1 }) });
    const listed = (await m.listMonths(townManager, { site: townId, page: 1, rows: 5 }, LATER)).months;
    expect(listed[0]).toMatchObject({ monthKey: '2026-11', state: 'OPEN' }); // November has begun
    expect(listed.find((row) => row.monthKey === '2026-10')).toMatchObject({ state: 'TO_APPROVE', needsYouCount: 1 });
    expect(await m.getApprovedHours(baristaUserId, { start: D(5), end: D(9) })).toEqual({ workedMinutes: 0, overtimeApprovedMinutes: 0 }); // nothing is approved hours before approval
  });

  it('a clock fix by the Branch Manager alone works before approval', async () => {
    const out = await m.prisma.clockEvent.findFirstOrThrow({ where: { employeeId: ids.lena, shiftDate: m.time.toDateColumn(D(5)), type: 'OUT' } });
    await expect(m.previewFix(townManager, { action: 'EDIT', employeeId: ids.lena, date: D(5), eventId: out.id, at: at(D(5), '14:00'), reason: 'Checked the till' }, NOW)).resolves.toBeDefined();
  });

  it('overtime: all, part or none, with a PIN, a reason for part or none, and the version the screen showed', async () => {
    const item = await m.prisma.overtimeItem.findFirstOrThrow({ where: { employeeId: ids.lena } });
    const base = { version: item.version };
    await expect(m.decideOvertime(townManager, item.id, { decision: 'APPROVE_ALL', pin: '0000', ...base }, NOW)).rejects.toMatchObject({ code: 'INVALID_PIN', statusCode: 401 });
    await expect(m.decideOvertime(townManager, item.id, { decision: 'APPROVE_ALL', pin: PIN, version: item.version + 5 }, NOW)).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' });
    await expect(m.decideOvertime(townManager, item.id, { decision: 'APPROVE_PART', approvedMinutes: 40, reason: 'Everything', pin: PIN, ...base }, NOW)).rejects.toMatchObject({ code: 'PART_OUT_OF_RANGE' });
    for (const who of [hr, accountant]) await expect(m.decideOvertime(who, item.id, { decision: 'APPROVE_ALL', pin: PIN, ...base }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.decideOvertime(barista, item.id, { decision: 'APPROVE_ALL', pin: PIN, ...base }, NOW)).rejects.toMatchObject({ statusCode: 404 }); // a head decides nothing and reads no timesheet
    await expect(m.decideOvertime(highwayManager, item.id, { decision: 'APPROVE_ALL', pin: PIN, ...base }, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(await m.prisma.overtimeItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ status: 'PENDING', authorisedMinutes: 0 });

    const part = await m.decideOvertime(townManager, item.id, { decision: 'APPROVE_PART', approvedMinutes: 30, reason: 'Only the rush', pin: PIN, ...base }, NOW);
    expect(part).toMatchObject({ status: 'APPROVED_PART', authorisedMinutes: 30, decisionReason: 'Only the rush', decidedById: townManager.id });
    expect(part.version).toBeGreaterThan(item.version);
    await expect(m.decideOvertime(townManager, item.id, { decision: 'DECLINE', reason: 'Changed my mind', pin: PIN, ...base }, NOW)).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' }); // a stale screen
    const all = await m.decideOvertime(townManager, item.id, { decision: 'APPROVE_ALL', pin: PIN, version: part.version }, NOW); // the answer can change until the month is approved
    expect(all).toMatchObject({ status: 'APPROVED', authorisedMinutes: 40 });
    const final = await m.decideOvertime(townManager, item.id, { decision: 'APPROVE_PART', approvedMinutes: 30, reason: 'Only the rush', pin: PIN, version: all.version }, NOW);
    expect(final).toMatchObject({ status: 'APPROVED_PART', authorisedMinutes: 30 });
    expect((await dayOf(ids.lena, D(8))).status).toBe('APPROVED'); // the day settles with the overtime answered
    expect(seen).toEqual(expect.arrayContaining(['overtime.decided']));
    const entries = await m.prisma.auditEntry.findMany({ where: { companyId, action: 'timesheet.overtime_decided', subjectId: ids.lena }, orderBy: { seq: 'asc' } });
    expect(entries).toHaveLength(3);
    expect(JSON.stringify(entries.map((e) => [e.before, e.after, e.reason]))).not.toContain(PIN);
  });

  it('a late day needs no decision (it is recorded); "clocked out by mistake" is answered with before and after', async () => {
    expect(await dayOf(ids.lena, D(6))).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['LATE'] }); // nobody decides it: payroll applies the Rules
    const created = await m.createRequest(barista, { kind: 'CLOCKED_OUT_BY_MISTAKE', date: D(9), at: at(D(9), '14:00').toISOString(), note: 'I tapped Clock out by accident' }, NOW);
    expect(created).toMatchObject({ state: 'WAITING', waitingOnRole: 'MANAGER' });
    expect((await m.getMonth(townManager, '2026-10', {}, NOW)).needsYou).toMatchObject({ requestsWithManager: 1, total: 1 }); // a request with the manager blocks approval
    await expect(m.decideRequest(barista, created.id, { outcome: 'APPROVE' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.decideRequest(highwayManager, created.id, { outcome: 'APPROVE' }, NOW)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.decideRequest(accountant, created.id, { outcome: 'APPROVE' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    const answered = await m.decideRequest(townManager, created.id, { outcome: 'APPROVE', reason: 'Checked with the till' }, NOW);
    expect(answered).toMatchObject({ state: 'APPROVED' });
    expect(answered.answerAfter).toMatchObject({ outcome: 'APPROVE', before: { workedMinutes: 320 }, after: { workedMinutes: 480 } });
    expect((await m.getMonth(townManager, '2026-10', {}, NOW)).needsYou.total).toBe(0);
  });

  it('a request nobody answers moves to HR after 3 days, once, and HR can answer it', async () => {
    const request = await m.createRequest(barista, { kind: 'ROTA_WRONG', date: D(7), note: 'I was not on Wednesday' }, NOW);
    const later = new Date(Date.now() + 4 * 86_400_000);
    expect(await m.escalateStaleRequests(later)).toEqual({ escalated: 1 });
    expect(await m.escalateStaleRequests(later)).toEqual({ escalated: 0 });
    expect((await m.getMonth(townManager, '2026-10', {}, NOW)).needsYou).toMatchObject({ requestsWithManager: 0, requestsWithHr: 1, total: 0 }); // with HR: listed, not blocking
    await expect(m.decideRequest(hr, request.id, { outcome: 'DECLINE', reason: 'The rota shows you on' }, NOW)).resolves.toMatchObject({ state: 'DECLINED' });
  });

  it('nothing closes by itself: the sweep refreshes and leaves the month open for approval', async () => {
    const result = await m.sweepTimesheets(LATER);
    expect(result.refreshed).toBeGreaterThanOrEqual(1);
    expect((await period()).state).toBe('OPEN');
    // (older runs left their entries: the log is append-only, so only this run's are counted)
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: { in: ['timesheet.period_closed', 'timesheet.period_reopened', 'timesheet.period_signed'] }, siteId: townId, occurredAt: { gte: startedAt } } })).toBe(0);
  });

  it('exports of a draft: PDF and Excel, stamped as drafts, audited once per key, limited per person', async () => {
    const pdf = await m.exportMonth(townManager, '2026-10', { format: 'pdf', scope: 'month', idempotencyKey: nextKey('draft-pdf') }, LATER);
    expect(pdf).toMatchObject({ filename: 'Timesheet-Nyeri-Town-2026-10.pdf', contentType: 'application/pdf', documentNumber: null });
    expect(pdf.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const xlsx = await m.exportMonth(accountant, '2026-10', { format: 'xlsx', scope: 'range', from: '2026-10-05', to: '2026-10-09', idempotencyKey: nextKey('draft-xlsx'), site: townId }, LATER);
    expect(xlsx.filename).toBe('Timesheet-Nyeri-Town-2026-10-05-09.xlsx');
    expect(xlsx.buffer.subarray(0, 2).toString()).toBe('PK');
    const extract = await m.exportMonth(townManager, '2026-10', { format: 'pdf', scope: 'month', employeeId: ids.lena, idempotencyKey: nextKey('extract') }, LATER);
    expect(extract.filename).toBe('Timesheet-Nyeri-Town-2026-10-extract.pdf');

    const repeatKey = nextKey('repeat');
    const before = await m.prisma.auditEntry.count({ where: { companyId, action: 'timesheet.exported' } });
    await m.exportMonth(townManager, '2026-10', { format: 'xlsx', scope: 'month', idempotencyKey: repeatKey }, LATER);
    await m.exportMonth(townManager, '2026-10', { format: 'xlsx', scope: 'month', idempotencyKey: repeatKey }, LATER);
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'timesheet.exported' } })).toBe(before + 1);
    const entry = await m.prisma.auditEntry.findFirstOrThrow({ where: { companyId, action: 'timesheet.exported' }, orderBy: { seq: 'desc' } });
    expect(entry.after).toMatchObject({ format: 'xlsx', month: '2026-10', document: 'draft' });

    await expect(m.exportMonth(director, '2026-10', { format: 'pdf', scope: 'month', idempotencyKey: nextKey('dir'), site: townId }, LATER)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.exportMonth(highwayManager, '2026-10', { format: 'pdf', scope: 'month', idempotencyKey: nextKey('hw'), site: townId }, LATER)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.exportMonth(townManager, '2026-10', { format: 'pdf', scope: 'range', from: '2026-09-01', to: '2026-09-30', idempotencyKey: nextKey('out') }, LATER)).rejects.toMatchObject({ code: 'RANGE_OUTSIDE_MONTH' });
    await expect(m.exportMonth(townManager, '2026-07', { format: 'pdf', scope: 'month', idempotencyKey: nextKey('none') }, LATER)).rejects.toMatchObject({ statusCode: 404 });
    // the rate limit: a person may make only so many files in a few minutes (counted on the real clock, like the rows)
    let limited = 0;
    for (let i = 0; i < m.EXPORT_LIMIT + 1; i += 1) {
      await m.exportMonth(accountant, '2026-10', { format: 'xlsx', scope: 'month', idempotencyKey: nextKey('rate'), site: townId }, new Date()).catch((error: { code?: string }) => {
        if (error.code === 'EXPORT_RATE_LIMIT') limited += 1;
      });
    }
    expect(limited).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it('approving the month: wrong PIN, stale figures, then once, with a number, a snapshot and an audit entry', async () => {
    const expected = await totalsNow(LATER);
    await expect(m.approveMonth(townManager, '2026-10', { pin: '0000', idempotencyKey: nextKey('wrong'), expectedTotals: expected }, LATER)).rejects.toMatchObject({ code: 'INVALID_PIN', statusCode: 401 });
    await expect(m.approveMonth(townManager, '2026-10', { pin: PIN, idempotencyKey: nextKey('stale'), expectedTotals: { ...expected, workedMinutes: expected.workedMinutes + 1 } }, LATER)).rejects.toMatchObject({ code: 'CHANGED_UNDERNEATH' });
    expect((await period()).state).toBe('OPEN');
    const approveKey = nextKey('approve');
    const [first, second] = await Promise.allSettled([
      m.approveMonth(townManager, '2026-10', { pin: PIN, idempotencyKey: approveKey, expectedTotals: expected }, LATER),
      m.approveMonth(townManager, '2026-10', { pin: PIN, idempotencyKey: nextKey('other'), expectedTotals: expected }, LATER),
    ]);
    const won = [first, second].filter((r) => r.status === 'fulfilled');
    const lost = [first, second].filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(won).toHaveLength(1); // two managers acting at once: one approval
    expect(lost[0]!.reason).toMatchObject({ code: 'ALREADY_APPROVED' });
    const row = await period();
    expect(row).toMatchObject({ state: 'APPROVED', approvedById: townManager.id, approverOwnHours: false });
    expect(row.documentNumber).toBeGreaterThan(0);
    expect(row.documentHash).toMatch(/^[0-9a-f]{64}$/);
    const snapshot = row.approvedSnapshot as { totals: { workedMinutes: number; people: number }; people: unknown[] };
    expect(snapshot.totals.workedMinutes).toBe(expected.workedMinutes);
    expect(snapshot.people).toHaveLength(expected.headcount);
    // days that only carried facts were approved with the month
    expect(await m.prisma.timesheetDay.count({ where: { periodId: row.id, status: 'NEEDS_LOOK' } })).toBe(0);
    expect(await dayOf(ids.lena, D(6))).toMatchObject({ status: 'APPROVED', decidedById: townManager.id, decisionReason: 'Approved with the month' });
    // a repeat of the winning key answers the first result; another key is a 409
    const repeat = await m.approveMonth(townManager, '2026-10', { pin: PIN, idempotencyKey: row.approveKey as string, expectedTotals: expected }, LATER);
    expect(repeat).toMatchObject({ repeat: true, documentNumber: `TSH-${String(row.documentNumber).padStart(4, '0')}` });
    await expect(m.approveMonth(townManager, '2026-10', { pin: PIN, idempotencyKey: nextKey('late'), expectedTotals: expected }, LATER)).rejects.toMatchObject({ code: 'ALREADY_APPROVED' });
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'timesheet.month_approved', siteId: townId, occurredAt: { gte: startedAt } } })).toBe(1);
    const audit = await m.prisma.auditEntry.findFirstOrThrow({ where: { companyId, action: 'timesheet.month_approved', siteId: townId, occurredAt: { gte: startedAt } } });
    expect(audit.after).toMatchObject({ state: 'APPROVED', method: 'PIN', headcount: expected.headcount, daysSettledWithMonth: 1 });
    expect(JSON.stringify(audit, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))).not.toContain(PIN);
    expect(seen).toContain('timesheets.month_approved');
  });

  it('after approval: the month is locked for fixes, decisions and requests; reads show it approved', async () => {
    const fix = { action: 'ADD' as const, employeeId: ids.lena, date: D(5), type: 'OUT' as const, at: at(D(5), '14:00'), reason: 'A late fix' };
    for (const who of [townManager, hr]) {
      await expect(m.applyFix(who, fix, LATER)).rejects.toMatchObject({ code: 'PERIOD_APPROVED', message: 'This month is approved. Ask HR to correct the payslip.' });
    }
    await expect(m.decideDay(townManager, (await dayOf(ids.lena, D(5))).id, { outcome: 'ACCEPT' }, LATER)).rejects.toMatchObject({ code: 'PERIOD_APPROVED' });
    const item = await m.prisma.overtimeItem.findFirstOrThrow({ where: { employeeId: ids.lena } });
    await expect(m.decideOvertime(townManager, item.id, { decision: 'DECLINE', reason: 'Too late now', pin: PIN, version: item.version }, LATER)).rejects.toMatchObject({ code: 'PERIOD_APPROVED' });
    const mistake = await m.createRequest(barista, { kind: 'ROTA_WRONG', date: D(8), note: 'This should have been a rest day' }, LATER);
    expect(mistake.waitingOnRole).toBe('HR_MANAGER'); // a request on an approved month goes straight to HR
    const detail = await m.overtimeDetail(townManager, item.id);
    expect(detail).toMatchObject({ month: { state: 'APPROVED' }, canDecide: false });

    const month = await m.getMonth(townManager, '2026-10', {}, LATER);
    expect(month).toMatchObject({ state: 'APPROVED', approval: { documentNumber: expect.stringMatching(/^TSH-\d{4}$/), approvedBy: { role: 'MANAGER' } }, capabilities: { canApprove: false, canDecide: false } });
    expect((await m.listMonths(townManager, { site: townId, page: 1, rows: 5 }, LATER)).months.find((row) => row.monthKey === '2026-10')).toMatchObject({ state: 'APPROVED', needsYouCount: 0 });
    const stamp = await dayOf(ids.lena, D(5));
    await m.sweepTimesheets(new Date(LATER.getTime() + 3_600_000));
    expect((await dayOf(ids.lena, D(5))).updatedAt).toEqual(stamp.updatedAt); // an approved month is never touched
  });

  it('payroll reads approved hours, and only from the approved month', async () => {
    const hours = await m.getApprovedHours(baristaUserId, { start: D(5), end: D(9) });
    expect(hours.workedMinutes).toBe(5 * 480 - 1); // Thursday's clock-in was one minute after the start
    const lena = await m.prisma.employee.findUniqueOrThrow({ where: { id: ids.lena }, select: { userId: true } });
    if (lena.userId) expect((await m.getApprovedHours(lena.userId, { start: D(5), end: D(9) })).overtimeApprovedMinutes).toBe(30);
  });

  it('exports of the approved month: signed, numbered, from the frozen snapshot, identical every time', async () => {
    const a = await m.exportMonth(townManager, '2026-10', { format: 'pdf', scope: 'month', idempotencyKey: nextKey('signed-a') }, new Date('2026-11-05T10:00:00Z'));
    const row = await period();
    expect(a.documentNumber).toBe(`TSH-${String(row.documentNumber).padStart(4, '0')}`);
    const b = await m.exportMonth(hr, '2026-10', { format: 'pdf', scope: 'month', idempotencyKey: nextKey('signed-b'), site: townId }, new Date('2026-11-05T10:00:00Z'));
    expect(Buffer.compare(a.buffer, b.buffer)).not.toBe(0); // the footer names who exported it
    const xlsx = await m.exportMonth(accountant, '2026-10', { format: 'xlsx', scope: 'month', idempotencyKey: nextKey('signed-x'), site: townId }, LATER);
    expect(xlsx.documentNumber).toBe(a.documentNumber);
    const audit = await m.prisma.auditEntry.findFirstOrThrow({ where: { companyId, action: 'timesheet.exported' }, orderBy: { seq: 'desc' } });
    expect(audit.after).toMatchObject({ document: a.documentNumber });
  });

  it('a request is refused where the branch is not switched on', async () => {
    await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: false } });
    await expect(m.createRequest(barista, { kind: 'ROTA_WRONG', date: D(8), note: 'Switch is off' }, NOW)).rejects.toMatchObject({ code: 'ATTENDANCE_NOT_ENABLED' });
    expect(await m.sweepTimesheets(new Date('2026-12-30T10:00:00Z'))).toMatchObject({ refreshed: expect.any(Number) });
    await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: true } });
  });

  it('the audit chain still verifies', async () => {
    const verdict = m.verifyAuditChain(await m.auditRepository.listEntries(companyId, 0n, 1_000_000));
    expect(verdict.ok).toBe(true);
  });
});
