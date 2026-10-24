/**
 * The Time tab and the board's new states against a real database: a person's month with a worked day, a late day, an absent
 * day and approved overtime; who may read it (another branch 404, a department head none, the Accountant read only); a person
 * who does not clock; a branch whose clock is off; the Overview tiles; and the Today board on a past day and with the clock off.
 *
 * Runs only when DATABASE_URL names a lane database (same guard as attendance-flow-db.test.ts). It removes what it makes; audit
 * entries stay (append-only). Dates are fixed in October 2026 and "now" is passed in, so the run does not depend on the calendar.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Time tab flows in the database', () => {
  const tag = `ZZ Tab ${randomUUID().slice(0, 6)}`;
  type Subject = import('../../_shared/workforce-access').AccessSubject;
  const load = async () => ({
    prisma: (await import('../../../../config/database')).prisma,
    time: await import('../../_shared/time/nairobi-time'),
    ...(await import('./time-tab-service')),
    ...(await import('../board/board-service')),
  });
  let m: Awaited<ReturnType<typeof load>>;

  let townId = '';
  let companyId = '';
  let hr: Subject;
  let director: Subject;
  let accountant: Subject;
  let townManager: Subject;
  let highwayManager: Subject;
  let chef: Subject;
  const ids = { lena: '', nia: '', ola: '', template: '', period: '', weekId: '' };
  const day = (value: string) => m.time.parseNairobiDate(value);
  const at = (date: string, clock: string) => m.time.instantAt(day(date), m.time.parseClockTime(clock));
  let NOW: Date;
  let n = 0;

  const tap = (rotaEntryId: string, date: string, type: 'IN' | 'OUT', clock: string) =>
    m.prisma.clockEvent.create({
      data: { siteId: townId, employeeId: ids.lena, rotaEntryId, shiftDate: m.time.toDateColumn(day(date)), type, source: 'PHONE', occurredAt: at(date, clock), clientEventId: `${tag}-${(n += 1)}` },
    });

  beforeAll(async () => {
    m = await load();
    NOW = at('2026-10-24', '10:12');
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true, siteId: true, site: { select: { companyId: true } } } });
    const [admin, dir, acc, bmTown, bmHighway, chefUser] = await Promise.all(['admin', 'director', 'accountant', 'bm.town', 'bm.highway', 'kitchen.head.town'].map((x) => user(`${x}@wendo.test`)));
    townId = bmTown!.siteId!;
    companyId = bmTown!.site!.companyId;
    const chefEmp = await m.prisma.employee.findFirstOrThrow({ where: { userId: chefUser!.id } });
    hr = { id: admin!.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    director = { id: dir!.id, role: 'DIRECTOR', siteId: dir!.siteId, headOfDepartmentIds: [] };
    accountant = { id: acc!.id, role: 'ACCOUNTANT', siteId: acc!.siteId, headOfDepartmentIds: [] };
    townManager = { id: bmTown!.id, role: 'MANAGER', siteId: townId, headOfDepartmentIds: [] };
    highwayManager = { id: bmHighway!.id, role: 'MANAGER', siteId: bmHighway!.siteId, headOfDepartmentIds: [] };
    chef = { id: chefUser!.id, role: 'CHEF', siteId: townId, headOfDepartmentIds: [chefEmp.departmentId as string] };

    const service = await m.prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'SERVICE' } });
    const person = (name: string, tracksTime: boolean) =>
      m.prisma.employee.create({
        data: { companyId, siteId: townId, employeeNumber: `ZZT-${tag.slice(-6)}-${name}`, name: `${tag} ${name}`, departmentId: service.id, payType: 'MONTHLY_SALARY', startDate: m.time.toDateColumn(day('2026-10-01')), status: 'ACTIVE', tracksTime },
      });
    ids.lena = (await person('Lena', true)).id;
    ids.nia = (await person('Nia', false)).id;
    ids.ola = (await person('Ola', true)).id;
    const template = await m.prisma.shiftTemplate.create({ data: { companyId, siteId: townId, name: `${tag} Morning`, colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 30 } });
    ids.template = template.id;
    const week = await m.prisma.rotaWeek.create({ data: { siteId: townId, departmentId: service.id, weekStart: m.time.toDateColumn(day('2026-10-19')) } }); // Mon 19 to Sun 25
    ids.weekId = week.id;
    const entry = async (date: string) => (await m.prisma.rotaEntry.create({ data: { weekId: week.id, siteId: townId, employeeId: ids.lena, date: m.time.toDateColumn(day(date)), templateId: template.id } })).id;
    const [wed, thu, fri] = [await entry('2026-10-21'), await entry('2026-10-22'), await entry('2026-10-23')];
    await tap(wed, '2026-10-21', 'IN', '05:58');
    await tap(wed, '2026-10-21', 'OUT', '14:00');
    await tap(fri, '2026-10-23', 'IN', '06:40'); // well past any grace
    await tap(fri, '2026-10-23', 'OUT', '14:00');
    void thu; // Thursday: rostered, never clocked
    const period = await m.prisma.timesheetPeriod.create({
      data: { siteId: townId, startDate: m.time.toDateColumn(day('2026-10-01')), endDate: m.time.toDateColumn(day('2026-10-31')), label: tag, cutoffAt: at('2026-11-01', '00:00') },
    });
    ids.period = period.id;
    await m.prisma.overtimeItem.create({
      data: { periodId: period.id, siteId: townId, employeeId: ids.lena, shiftDate: m.time.toDateColumn(day('2026-10-21')), rawMinutes: 100, authorisedMinutes: 90, status: 'APPROVED_PART', evidence: {}, limits: {} },
    });
    await m.prisma.overtimeItem.create({
      data: { periodId: period.id, siteId: townId, employeeId: ids.lena, shiftDate: m.time.toDateColumn(day('2026-10-23')), rawMinutes: 40, authorisedMinutes: 0, status: 'DECLINED', evidence: {}, limits: {} },
    });
    await m.prisma.attendanceSiteSwitch.upsert({
      where: { siteId: townId },
      create: { siteId: townId, enabled: true, enabledAt: at('2026-10-01', '00:00'), changedAt: at('2026-10-01', '00:00') },
      update: { enabled: true, enabledAt: at('2026-10-01', '00:00') },
    });
  }, 60_000);

  afterAll(async () => {
    if (!m) return;
    const everyone = [ids.lena, ids.nia, ids.ola];
    await m.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('workforce.allow_clock_edits', 'on', true)`; // tests only: the events table is append-only
      await tx.clockEvent.deleteMany({ where: { employeeId: { in: everyone } } });
    });
    await m.prisma.overtimeItem.deleteMany({ where: { periodId: ids.period } });
    await m.prisma.timesheetPeriod.deleteMany({ where: { id: ids.period } });
    await m.prisma.rotaEntry.deleteMany({ where: { employeeId: { in: everyone } } });
    await m.prisma.rotaWeek.deleteMany({ where: { id: ids.weekId } });
    await m.prisma.shiftTemplate.deleteMany({ where: { id: ids.template } });
    await m.prisma.attendanceSiteSwitch.deleteMany({ where: { siteId: townId } });
    await m.prisma.employee.deleteMany({ where: { id: { in: everyone } } });
    await m.prisma.$disconnect();
  }, 60_000);

  const month = (subject: Subject, employeeId: string, extra: object = {}) => m.personMonth(subject, { employeeId, month: '2026-10', filter: 'all', page: 1, pageSize: 50, ...extra }, NOW);

  it('lists the month: worked, late, absent and a day off, with the figures', async () => {
    const read = await month(townManager, ids.lena);
    expect(read).toMatchObject({ clocks: true, clockOn: true, emptyReason: null, canEditTime: true, month: '2026-10' });
    const rowOf = (date: string) => read.rows.find((r) => r.date === date);
    expect(rowOf('2026-10-21')).toMatchObject({ kind: 'WORKED', late: false, overtimeApprovedMinutes: 90 });
    expect(rowOf('2026-10-22')).toMatchObject({ kind: 'ABSENT' });
    expect(rowOf('2026-10-23')).toMatchObject({ kind: 'WORKED', late: true, overtimeApprovedMinutes: 0 }); // declined overtime is not approved
    expect(rowOf('2026-10-20')?.kind).toBe('DAY_OFF');
    expect(read.rows.some((r) => r.date < '2026-10-01')).toBe(false);
    expect(read.summary).toMatchObject({ daysWorked: 2, rosteredDays: 3, lateDays: 1, absentDays: 1, overtimeApprovedMinutes: 90 });
    expect(read.counts).toMatchObject({ late: 1, overtime: 1, absent: 1 });
    expect(read.last30).toMatchObject({ to: '2026-10-24', lateDays: 1 });
  });

  it('filters and pages', async () => {
    const late = await month(townManager, ids.lena, { filter: 'late' });
    expect(late.rows.map((r) => r.date)).toEqual(['2026-10-23']);
    expect(late.total).toBe(1);
    const all = await month(townManager, ids.lena, { pageSize: 10 });
    expect(all.rows).toHaveLength(10);
    expect(all.total).toBe(24); // 1 to 24 October
    expect((await month(townManager, ids.lena, { pageSize: 10, page: 3 })).rows).toHaveLength(4);
  });

  it('shows the Accountant the same month but no Edit time', async () => {
    const read = await month(accountant, ids.lena);
    expect(read.summary.daysWorked).toBe(2);
    expect(read.canEditTime).toBe(false);
    expect((await month(hr, ids.lena)).canEditTime).toBe(true);
  });

  it('keeps other branches and department heads out', async () => {
    await expect(month(highwayManager, ids.lena)).rejects.toMatchObject({ statusCode: 404 });
    await expect(month(chef, ids.lena)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.personTiles(chef, { employeeId: ids.lena }, NOW)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('says so when the person does not clock, or when the branch clock is off', async () => {
    expect(await month(townManager, ids.nia)).toMatchObject({ clocks: false, emptyReason: 'DOES_NOT_CLOCK', rows: [] });
    await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: false } });
    try {
      const off = await month(townManager, ids.ola);
      expect(off).toMatchObject({ clockOn: false, emptyReason: 'CLOCK_OFF', total: 0 });
      const kept = await month(townManager, ids.lena);
      expect(kept).toMatchObject({ clockOn: false, emptyReason: null, summary: { absentDays: 0 } }); // old days stay, nothing is called absent
      expect(kept.rows.find((r) => r.date === '2026-10-23')?.kind).toBe('WORKED');
      expect(kept.rows.some((r) => r.kind === 'ABSENT')).toBe(false);
    } finally {
      await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: true } });
    }
  });

  it('gives the Overview tiles', async () => {
    const tiles = await m.personTiles(townManager, { employeeId: ids.lena }, NOW);
    expect(tiles).toMatchObject({ clocks: true, onTime: { tracked: true, onTime: 1, worked: 2, to: '2026-10-24' }, overtime: { tracked: true, month: '2026-10', approvedMinutes: 90 }, leaveLeft: { state: 'NOT_SET' } });
    expect(await m.personTiles(townManager, { employeeId: ids.nia }, NOW)).toMatchObject({ clocks: false, onTime: { tracked: false }, overtime: { tracked: false } });
  });

  it('marks a past day read only, with no clock-for and the past-day wording', async () => {
    const past = await m.todayBoard(townManager, { date: day('2026-10-23') }, NOW);
    expect(past).toMatchObject({ enabled: true, readOnly: true, asOf: '', actions: { clockFor: false, fixTime: true }, pastDay: { tag: 'Past day · read only' }, clock: { on: true } });
    expect(past.tiles.notIn.count).toBe(0); // Lena clocked in on the 23rd
    const thursday = await m.todayBoard(townManager, { date: day('2026-10-22') }, NOW);
    expect(thursday.tiles.notIn.count).toBe(1);
    const live = await m.todayBoard(townManager, {}, NOW);
    expect(live).toMatchObject({ readOnly: false, pastDay: null, actions: { clockFor: true } });
  });

  it('says the clock is off, keeps On leave real, and says who can switch it', async () => {
    await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: false } });
    try {
      const manager = await m.todayBoard(townManager, {}, NOW);
      expect(manager).toMatchObject({ enabled: false, people: [], clock: { on: false, canSwitch: false, whoCanSwitch: expect.arrayContaining(['Director', 'System Admin']) }, actions: { clockFor: false } });
      expect(manager.clock.siteName).toBeTruthy();
      expect(manager.tiles.onLeave.available).toBe(true);
      expect((await m.todayBoard(director, { siteId: townId }, NOW)).clock.canSwitch).toBe(true);
    } finally {
      await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: true } });
    }
  });
});
