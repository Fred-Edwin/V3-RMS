/**
 * Timesheets against a real database, in the order a pilot branch lives it: a switched-off branch has no timesheets; a week is
 * clocked (matched days, one late day, one overtime day, one early clock-out) and the matched days approve themselves while
 * only the exceptions need a person; the manager decides the late day and the overtime; a staff member asks for a correction
 * and the manager answers with before and after; a request nobody answers moves to HR once, and only once; the period closes
 * at the Nairobi cut-off (not a second earlier), a fix is then refused, HR reopens with a reason, the manager closes early;
 * a wrong PIN is refused; approved hours add up; another branch sees nothing; the audit chain verifies.
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
      ...(await import('./periods/periods-service')), ...(await import('./periods/close-service')), ...(await import('./periods/reopen-service')),
      ...(await import('./periods/periods-validators')), ...(await import('./days/decide-service')), ...(await import('./days/person-service')),
      ...(await import('./overtime/overtime-service')), ...(await import('./requests/requests-service')), ...(await import('./requests/request-decide-service')),
      ...(await import('./requests/escalation-service')), ...(await import('./report/report-service')), ...(await import('./me/me-service')),
      ...(await import('./approved-hours')), ...(await import('./register-timesheets')), ...(await import('../attendance/fixes/fixes-service')),
      ...(await import('../attendance/fixes/period-lock')), ...(await import('../_shared/audit/audit-repository')), ...(await import('../_shared/audit/audit-hash')),
      ...(await import('../_shared/events')),
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
  const weeks: string[] = [];
  const seen: string[] = [];
  const D = (day: number) => `2026-10-0${day}` as import('../_shared/time/nairobi-time').NairobiDate; // Mon 5 to Fri 9 October
  const at = (date: string, clock: string) => m.time.instantAt(date as never, m.time.parseClockTime(clock));
  const NOW = new Date('2026-10-09T17:00:00Z'); // Fri 20:00 in Nairobi: every shift is over
  const query = () => ({ ...({} as object), filter: 'ALL' as const, page: 1, pageSize: 50 });
  let periodId = '';
  const dayOf = async (employeeId: string, date: string) => (await m.prisma.timesheetDay.findFirstOrThrow({ where: { employeeId, shiftDate: m.time.toDateColumn(date as never) } }));

  const clock = async (employeeId: string, entryId: string, date: string, inAt: string, outAt: string) => {
    for (const [type, clk] of [['IN', inAt], ['OUT', outAt]] as const) {
      await m.prisma.clockEvent.create({ data: { siteId: townId, employeeId, rotaEntryId: entryId, shiftDate: m.time.toDateColumn(date as never), type, source: 'PHONE', occurredAt: at(date, clk), serverAt: at(date, clk) } });
    }
  };

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, site: { select: { companyId: true } } } });
    const [admin, dir, acc, bmTown, bmHighway, baristaUser] = await Promise.all(['admin', 'director', 'accountant', 'bm.town', 'bm.highway', 'barista.head.town'].map((n) => user(`${n}@wendo.test`)));
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
    for (const name of ['timesheet.period_closed', 'timesheet.period_reopened', 'timesheet.day_decided', 'overtime.decided', 'time_request.created', 'time_request.decided', 'time_request.escalated'] as const) {
      m.workforceEvents.on(name, () => seen.push(name));
    }
    m.registerTimesheets();
  }, 60_000);

  afterAll(async () => {
    if (!m) return;
    m.setPeriodClosedCheck(null);
    const everyone = [ids.barista, ids.lena];
    await m.prisma.timeRequest.deleteMany({ where: { employeeId: { in: everyone } } });
    await m.prisma.timesheetPeriod.deleteMany({ where: { siteId: townId } }); // days, weeks and overtime follow
    await m.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('workforce.allow_clock_edits', 'on', true)`; // tests only: the events table is append-only
      await tx.clockEvent.deleteMany({ where: { employeeId: { in: everyone } } });
    });
    await m.prisma.rotaEntry.deleteMany({ where: { employeeId: { in: everyone } } });
    await m.prisma.rotaWeek.deleteMany({ where: { id: { in: weeks } } });
    await m.prisma.shiftTemplate.deleteMany({ where: { id: ids.template } });
    if (!hadSwitch) await m.prisma.attendanceSiteSwitch.deleteMany({ where: { siteId: townId } });
    await m.prisma.employee.deleteMany({ where: { id: ids.lena } });
    await m.prisma.$disconnect();
  }, 60_000);

  it('a branch with the switch off has no timesheets and nothing is written', async () => {
    await m.prisma.attendanceSiteSwitch.upsert({ where: { siteId: townId }, create: { siteId: townId, enabled: false }, update: { enabled: false } });
    expect(await m.listPeriods(townManager, { siteId: townId }, NOW)).toEqual({ enabled: false, periods: [] });
    expect(await m.prisma.timesheetPeriod.count({ where: { siteId: townId } })).toBe(0);
    expect(await m.myTime(barista, {}, NOW)).toMatchObject({ enabled: false });
  });

  it('with the switch on, matched days approve themselves and only the exceptions need a person', async () => {
    await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: true, enabledAt: new Date(NOW.getTime() - 7 * 86_400_000) } });
    const list = await m.listPeriods(townManager, { siteId: townId }, NOW);
    expect(list.enabled).toBe(true);
    const period = list.periods.find((p) => p.start <= D(5) && p.end >= D(9))!;
    periodId = period.id;
    expect(period).toMatchObject({ state: 'OPEN', end: '2026-10-16' });
    expect(period.cutoffAt.toISOString()).toBe('2026-10-16T15:00:00.000Z'); // 18:00 in Nairobi

    const view = await m.getPeriod(townManager, periodId, query() as never, NOW);
    const lena = view.people.rows.find((r) => r.employeeId === ids.lena)!;
    const barista = view.people.rows.find((r) => r.employeeId === ids.barista)!;
    expect(lena).toMatchObject({ status: 'NEEDS_LOOK', needsLookDays: 2, lateDays: 1, overtimePendingMinutes: 40 });
    expect(barista).toMatchObject({ status: 'NEEDS_LOOK', needsLookDays: 1 });
    expect((await dayOf(ids.lena, D(5))).status).toBe('AUTO_APPROVED');
    expect(await m.prisma.timesheetDay.count({ where: { employeeId: ids.lena, status: 'AUTO_APPROVED' } })).toBe(3);
    expect(await dayOf(ids.lena, D(6))).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['LATE'], minutesLate: 20 });
    expect(await dayOf(ids.lena, D(8))).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['OVERTIME'] });
    expect(await dayOf(ids.barista, D(9))).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['LEFT_EARLY'] });
    expect((await m.prisma.timesheetDay.count({ where: { employeeId: { in: [ids.lena, ids.barista] }, status: 'AUTO_APPROVED' } }))).toBe(7);
  });

  it('refreshing again changes nothing and writes no second audit entry', async () => {
    const before = await m.prisma.auditEntry.count({ where: { companyId, action: 'timesheet.auto_approved' } });
    const stamp = await m.prisma.timesheetDay.findFirstOrThrow({ where: { employeeId: ids.lena, shiftDate: m.time.toDateColumn(D(5)) }, select: { updatedAt: true } });
    await m.getPeriod(townManager, periodId, query() as never, new Date(NOW.getTime() + 60_000));
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'timesheet.auto_approved' } })).toBe(before);
    expect((await m.prisma.timesheetDay.findFirstOrThrow({ where: { employeeId: ids.lena, shiftDate: m.time.toDateColumn(D(5)) }, select: { updatedAt: true } })).updatedAt).toEqual(stamp.updatedAt);
  });

  it('who sees what: another branch gets 404, the Accountant reads and acts on nothing, the Director reads all', async () => {
    await expect(m.getPeriod(highwayManager, periodId, query() as never, NOW)).rejects.toMatchObject({ statusCode: 404 });
    const day = await dayOf(ids.lena, D(6));
    await expect(m.decideDay(highwayManager, day.id, { outcome: 'ACCEPT' }, NOW)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.decideDay(accountant, day.id, { outcome: 'EXCUSE', reason: 'Not mine to do' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.decideDay(director, day.id, { outcome: 'EXCUSE', reason: 'Not mine to do' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    expect((await m.getPeriod(accountant, periodId, query() as never, NOW)).people.total).toBeGreaterThanOrEqual(2);
    expect((await m.getPeriod(director, periodId, query() as never, NOW)).people.total).toBeGreaterThanOrEqual(2);
    // the barista is a head of their own department: they read it, not Lena's
    const headView = await m.getPeriod(barista, periodId, query() as never, NOW);
    expect(headView.people.rows.some((r) => r.employeeId === ids.lena)).toBe(false);
    expect(headView.people.rows.some((r) => r.employeeId === ids.barista)).toBe(true);
    await expect(m.decideDay(barista, (await dayOf(ids.barista, D(9))).id, { outcome: 'ACCEPT' }, NOW)).rejects.toMatchObject({ statusCode: 403 }); // never their own
  });

  it('the manager excuses the late day and answers the overtime; the week settles', async () => {
    const lateDay = await dayOf(ids.lena, D(6));
    await expect(m.decideDay(townManager, lateDay.id, { outcome: 'ACCEPT' }, NOW)).resolves.toMatchObject({ status: 'APPROVED' });
    const overtime = await m.prisma.overtimeItem.findFirstOrThrow({ where: { employeeId: ids.lena } });
    expect(overtime).toMatchObject({ status: 'PENDING', needsMinutes: 40, authorisedMinutes: 0 });
    await expect(m.decideOvertime(townManager, overtime.id, { outcome: 'APPROVE', minutes: 30 }, NOW)).resolves.toMatchObject({ status: 'APPROVED', authorisedMinutes: 30 });
    await expect(m.decideOvertime(townManager, overtime.id, { outcome: 'DECLINE', reason: 'Changed my mind' }, NOW)).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
    expect((await dayOf(ids.lena, D(8))).status).toBe('APPROVED');
    expect((await m.prisma.timesheetWeek.findFirstOrThrow({ where: { employeeId: ids.lena, periodId } })).status).toBe('APPROVED');
    expect(await m.prisma.timesheetDay.count({ where: { employeeId: ids.lena, status: { in: ['NEEDS_LOOK', 'HELD'] } } })).toBe(0);
    expect(seen).toEqual(expect.arrayContaining(['timesheet.day_decided', 'overtime.decided']));
  });

  it('"clocked out by mistake": the staff member asks, the manager accepts, the correction appears and the day settles', async () => {
    const created = await m.createRequest(barista, { kind: 'CLOCKED_OUT_BY_MISTAKE', date: D(9), at: at(D(9), '14:00').toISOString(), note: 'I tapped Clock out by accident' }, NOW);
    expect(created).toMatchObject({ state: 'WAITING', waitingOnRole: 'MANAGER' });
    expect((await m.createRequest(barista, { kind: 'CLOCKED_OUT_BY_MISTAKE', date: D(9), at: at(D(9), '14:00').toISOString(), note: 'I tapped Clock out by accident' }, NOW)).id).toBe(created.id); // a double tap makes one
    await expect(m.decideRequest(barista, created.id, { outcome: 'APPROVE' }, NOW)).rejects.toMatchObject({ statusCode: 403 }); // nobody answers their own
    await expect(m.decideRequest(highwayManager, created.id, { outcome: 'APPROVE' }, NOW)).rejects.toMatchObject({ statusCode: 404 });
    const answered = await m.decideRequest(townManager, created.id, { outcome: 'APPROVE', reason: 'Checked with the till' }, NOW);
    expect(answered).toMatchObject({ state: 'APPROVED' });
    expect(answered.answerAfter).toMatchObject({ outcome: 'APPROVE', before: { workedMinutes: 320 }, after: { workedMinutes: 480 } });
    const correction = await m.prisma.clockEvent.findFirstOrThrow({ where: { employeeId: ids.barista, type: 'CORRECTION' } });
    expect(correction).toMatchObject({ source: 'MANAGER', reasonCode: 'FIX', recordedById: townManager.id });
    expect(answered.appliedEventId).toBe(correction.id);
    expect((await dayOf(ids.barista, D(9))).status).toBe('APPROVED');
    await expect(m.decideRequest(townManager, created.id, { outcome: 'APPROVE' }, NOW)).rejects.toMatchObject({ code: 'ALREADY_ANSWERED' });
    expect(await m.prisma.clockEvent.count({ where: { employeeId: ids.barista, type: 'CORRECTION' } })).toBe(1); // no second correction
    expect((await m.myRequests(barista, 'ALL', NOW)).requests[0]).toMatchObject({ state: 'APPROVED', decidedByName: expect.any(String) });
  });

  it('a request nobody answers moves to HR after 3 days, once, and HR can answer it', async () => {
    const escalatedBefore = await m.prisma.auditEntry.count({ where: { companyId, action: 'timesheet.request_escalated', subjectId: ids.barista } });
    const request = await m.createRequest(barista, { kind: 'ROTA_WRONG', date: D(7), note: 'I was not on Wednesday' }, NOW);
    const soon = new Date(Date.now() + 86_400_000);
    expect(await m.escalateStaleRequests(soon)).toEqual({ escalated: 0 });
    const later = new Date(Date.now() + 4 * 86_400_000);
    expect(await m.escalateStaleRequests(later)).toEqual({ escalated: 1 });
    expect(await m.escalateStaleRequests(later)).toEqual({ escalated: 0 });
    expect((await m.requestDetail(barista, request.id, later))).toMatchObject({ waitingOnRole: 'HR_MANAGER', escalatedToHr: true });
    expect(await m.prisma.auditEntry.count({ where: { companyId, action: 'timesheet.request_escalated', subjectId: ids.barista } })).toBe(escalatedBefore + 1);
    await expect(m.decideRequest(hr, request.id, { outcome: 'DECLINE', reason: 'The rota shows you on' }, NOW)).resolves.toMatchObject({ state: 'DECLINED' });
    const withdrawn = await m.createRequest(barista, { kind: 'PAY_OTHER', date: D(8), note: 'Question about my pay' }, NOW);
    expect(withdrawn.waitingOnRole).toBe('HR_MANAGER');
    await expect(m.withdrawRequest(barista, withdrawn.id, NOW)).resolves.toMatchObject({ state: 'WITHDRAWN' });
  });

  it('the period closes at the Nairobi cut-off and not a second before, then refuses fixes', async () => {
    expect(await m.sweepPeriods(new Date('2026-10-16T14:59:59Z'))).toEqual({ closed: 0 }); // 17:59:59 in Nairobi
    expect(await m.sweepPeriods(new Date('2026-10-16T15:00:00Z'))).toEqual({ closed: 1 }); // 18:00:00 in Nairobi (it is 15:00 in UTC)
    expect(await m.sweepPeriods(new Date('2026-10-16T15:10:00Z'))).toEqual({ closed: 0 }); // a second sweep does nothing
    expect(await m.prisma.timesheetPeriod.findUniqueOrThrow({ where: { id: periodId } })).toMatchObject({ state: 'CLOSED', closeKind: 'AUTO' });
    const fix = { action: 'ADD' as const, employeeId: ids.lena, date: D(5), type: 'OUT' as const, at: at(D(5), '14:00'), reason: 'A late fix' };
    await expect(m.applyFix(townManager, fix, NOW)).rejects.toMatchObject({ code: 'PERIOD_CLOSED' });
    await expect(m.applyFix(hr, fix, NOW)).rejects.toMatchObject({ code: 'PERIOD_CLOSED' }); // HR reopens first, with a reason
    await expect(m.decideDay(townManager, (await dayOf(ids.lena, D(5))).id, { outcome: 'ACCEPT' }, NOW)).rejects.toMatchObject({ code: 'PERIOD_CLOSED' });
    const report = await m.periodReport(accountant, periodId);
    expect(report).toMatchObject({ closed: { automatically: true }, signatures: { signedBy: null } });
    expect(report.number).toMatch(/^TSH-\d{4}$/);
    expect(report.rows.find((r) => r.employeeId === ids.lena)).toMatchObject({ plannedMinutes: 2400, overtimeAuthorisedMinutes: 30 });
    expect(JSON.stringify(report)).not.toMatch(/amount|salary|rate/i); // hours only
  });

  it('only HR reopens, with a reason; a wrong PIN signs nothing; the manager can close early', async () => {
    await expect(m.reopenPeriod(townManager, periodId, { reason: 'I want to' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.signReport(townManager, periodId, { pin: '0000' }, NOW)).rejects.toMatchObject({ code: 'INVALID_PIN' });
    const reopened = await m.reopenPeriod(hr, periodId, { reason: 'Dan\'s clock-out was missed' }, new Date('2026-10-16T16:00:00Z'));
    expect(reopened).toMatchObject({ state: 'OPEN', reopenReason: 'Dan\'s clock-out was missed' });
    await expect(m.reopenPeriod(hr, periodId, { reason: 'Again' }, NOW)).rejects.toMatchObject({ code: 'NOT_CLOSED' });
    const out = await m.prisma.clockEvent.findFirstOrThrow({ where: { employeeId: ids.lena, shiftDate: m.time.toDateColumn(D(5)), type: 'OUT' } });
    await expect(m.previewFix(townManager, { action: 'EDIT', employeeId: ids.lena, date: D(5), eventId: out.id, at: at(D(5), '14:00'), reason: 'Now allowed' }, NOW)).resolves.toBeDefined();
    await expect(m.closePeriodEarly(townManager, periodId, { confirmCarry: false }, new Date('2026-10-14T09:00:00Z'))).rejects.toMatchObject({ code: 'TOO_EARLY' });
    const early = await m.closePeriodEarly(townManager, periodId, { confirmCarry: false }, new Date('2026-10-16T09:00:00Z'));
    expect(early).toMatchObject({ state: 'CLOSED', closeKind: 'EARLY', closedById: townManager.id });
    await expect(m.closePeriodEarly(townManager, periodId, { confirmCarry: false }, new Date('2026-10-16T09:30:00Z'))).rejects.toMatchObject({ code: 'ALREADY_CLOSED' });
    expect(seen).toEqual(expect.arrayContaining(['timesheet.period_closed', 'timesheet.period_reopened']));
  });

  it('payroll reads approved hours only, and a person sees only their own time', async () => {
    const hours = await m.getApprovedHours(baristaUserId, { start: D(5), end: D(9) });
    expect(hours.workedMinutes).toBe(5 * 480 - 1); // Thursday's clock-in was one minute after the start
    const mine = await m.myTime(barista, { periodId }, NOW);
    expect(mine).toMatchObject({ enabled: true, totals: { plannedMinutes: 2400 } });
    expect(mine.days.every((d) => d.employeeId === ids.barista)).toBe(true);
  });

  it('a request is refused where the branch is not switched on', async () => {
    await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: false } });
    await expect(m.createRequest(barista, { kind: 'ROTA_WRONG', date: D(8), note: 'Switch is off' }, NOW)).rejects.toMatchObject({ code: 'ATTENDANCE_NOT_ENABLED' });
    expect(await m.sweepPeriods(new Date('2026-12-30T10:00:00Z'))).toEqual({ closed: 0 });
    await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: true } });
  });

  it('the audit chain still verifies', async () => {
    const verdict = m.verifyAuditChain(await m.auditRepository.listEntries(companyId, 0n, 1_000_000));
    expect(verdict.ok).toBe(true);
  });
});
