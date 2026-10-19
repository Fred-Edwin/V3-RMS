/**
 * Attendance against a real database, in the order a pilot branch lives it: the switch is off and nothing changes; a legacy
 * clock-in blocks switching on; switching on carries the day's legacy records; a late clock-in, a retry and a double tap;
 * undo inside and outside its window; the Today board and who sees what; clocking someone in; the shift-end prompt and
 * "Stay on"; the phone closing a shift nobody answered for; a manager fixing time; lateness; switching off mirrors the day
 * back and switching on again counts nothing twice; the events table refuses edits; the audit chain verifies.
 *
 * Runs only when DATABASE_URL names a lane database (same guard as rota-flow-db.test.ts). It removes the shifts, rota rows,
 * legacy fixtures and clock events it makes; the audit entries stay (the log is append-only by design).
 */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Attendance flows in the database', () => {
  const tag = `ZZ Att ${randomUUID().slice(0, 6)}`;
  type Subject = import('../_shared/workforce-access').AccessSubject;
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const time = await import('../_shared/time/nairobi-time');
    return {
      prisma, time,
      ...(await import('./clock/clock-in-service')), ...(await import('./clock/clock-out-service')), ...(await import('./clock/undo-service')),
      ...(await import('./prompt/shift-end-service')), ...(await import('./prompt/auto-close-service')), ...(await import('./me/my-day-service')),
      ...(await import('./board/board-service')), ...(await import('./board/clock-for-service')), ...(await import('./board/on-shift-now')),
      ...(await import('./fixes/fixes-service')), ...(await import('./fixes/history-service')), ...(await import('./fixes/period-lock')),
      ...(await import('./lateness/lateness-service')), ...(await import('./switch/switch-service')), ...(await import('./switch/legacy-clock-guard')),
      ...(await import('./legacy/legacy-clock-repository')), ...(await import('../_shared/events')),
      ...(await import('../_shared/audit/audit-repository')), ...(await import('../_shared/audit/audit-hash')),
    };
  };
  let m: Awaited<ReturnType<typeof load>>;

  let townId = '';
  let companyId = '';
  let chef: Subject;
  let hr: Subject;
  let director: Subject;
  let accountant: Subject;
  let townManager: Subject;
  let highwayManager: Subject;
  let pos = { latitude: 0, longitude: 0 };
  let ids = { chefEmp: '', baristaEmp: '', lena: '', chefEntry: '', baristaEntry: '', lenaEntry: '', legacyAsgB: '', legacyAsgC: '', legacyRecB: '', legacyShift: '', template: '' };
  let today = '' as import('../_shared/time/nairobi-time').NairobiDate;
  const weeks: string[] = [];
  const seen: string[] = [];
  const at = (clock: string) => m.time.instantAt(today, m.time.parseClockTime(clock));
  const eventsOf = (employeeId: string) => m.prisma.clockEvent.findMany({ where: { employeeId }, orderBy: [{ createdAt: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }] });
  const legacyCounts = async () => ({ shifts: await m.prisma.shift.count(), assignments: await m.prisma.shiftAssignment.count(), clocks: await m.prisma.clockRecord.count() });
  let legacyBefore = { shifts: 0, assignments: 0, clocks: 0 };
  let keyN = 0;
  const key = () => `${tag.slice(-6)}-key-${++keyN}`;
  const tap = (extra: object = {}) => ({ clientEventId: key(), ...pos, ...extra });

  beforeAll(async () => {
    m = await load();
    today = m.time.nairobiToday(new Date());
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true, siteId: true, site: { select: { companyId: true } } } });
    const [admin, dir, acc, bmTown, bmHighway, chefUser, baristaUser] = await Promise.all(['admin', 'director', 'accountant', 'bm.town', 'bm.highway', 'kitchen.head.town', 'barista.head.town'].map((n) => user(`${n}@wendo.test`)));
    townId = bmTown!.siteId!;
    companyId = bmTown!.site!.companyId;
    const site = await m.prisma.site.findUniqueOrThrow({ where: { id: townId } });
    pos = { latitude: Number(site.latitude), longitude: Number(site.longitude) };
    const chefEmp = await m.prisma.employee.findFirstOrThrow({ where: { userId: chefUser!.id } });
    const baristaEmp = await m.prisma.employee.findFirstOrThrow({ where: { userId: baristaUser!.id } });
    chef = { id: chefUser!.id, role: 'CHEF', siteId: townId, headOfDepartmentIds: [chefEmp.departmentId as string] };
    hr = { id: admin!.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    director = { id: dir!.id, role: 'DIRECTOR', siteId: dir!.siteId, headOfDepartmentIds: [] };
    accountant = { id: acc!.id, role: 'ACCOUNTANT', siteId: acc!.siteId, headOfDepartmentIds: [] };
    townManager = { id: bmTown!.id, role: 'MANAGER', siteId: townId, headOfDepartmentIds: [] };
    highwayManager = { id: bmHighway!.id, role: 'MANAGER', siteId: bmHighway!.siteId, headOfDepartmentIds: [] };

    const service = await m.prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'SERVICE' } });
    const lena = await m.prisma.employee.create({
      data: { companyId, siteId: townId, employeeNumber: `ZZA-${tag.slice(-6)}`, name: `${tag} Lena`, departmentId: service.id, payType: 'MONTHLY_SALARY', startDate: m.time.toDateColumn(m.time.addDays(today, -30)), status: 'ACTIVE', tracksTime: true },
    });
    const template = await m.prisma.shiftTemplate.create({ data: { companyId, siteId: townId, name: `${tag} Morning`, colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 30 } });
    const legacyShift = await m.prisma.shift.create({ data: { siteId: townId, name: tag, startTime: '06:00', endTime: '14:00' } });
    const asg = (userId: string) => m.prisma.shiftAssignment.create({ data: { siteId: townId, shiftId: legacyShift.id, userId, date: m.time.toDateColumn(today) } });
    const [asgB, asgC] = [await asg(baristaUser!.id), await asg(chefUser!.id)];
    const recB = await m.prisma.clockRecord.create({ data: { siteId: townId, shiftAssignmentId: asgB.id, userId: baristaUser!.id, clockInAt: at('06:02'), clockInMethod: 'GPS' } }); // still open: blocks switching on
    const weekRow = async (departmentId: string) => {
      // A lane database may already hold this week (someone built a rota there): reuse it and leave it alone at the end.
      const weekStart = m.time.toDateColumn(m.time.weekStart(today, 1));
      const existing = await m.prisma.rotaWeek.findFirst({ where: { siteId: townId, departmentId, weekStart } });
      if (existing) return existing.id;
      const w = await m.prisma.rotaWeek.create({ data: { siteId: townId, departmentId, weekStart } });
      weeks.push(w.id);
      return w.id;
    };
    const entry = async (departmentId: string, employeeId: string, legacyAssignmentId: string | null) =>
      (await m.prisma.rotaEntry.create({ data: { weekId: await weekRow(departmentId), siteId: townId, employeeId, date: m.time.toDateColumn(today), templateId: template.id, legacyAssignmentId } })).id;
    ids = {
      chefEmp: chefEmp.id, baristaEmp: baristaEmp.id, lena: lena.id, template: template.id, legacyShift: legacyShift.id, legacyAsgB: asgB.id, legacyAsgC: asgC.id, legacyRecB: recB.id,
      chefEntry: await entry(chefEmp.departmentId as string, chefEmp.id, asgC.id),
      baristaEntry: await entry(baristaEmp.departmentId as string, baristaEmp.id, asgB.id),
      lenaEntry: await entry(service.id, lena.id, null),
    };
    legacyBefore = await legacyCounts();
    for (const name of ['attendance.clocked_in', 'attendance.late', 'attendance.undone', 'attendance.stayed_on', 'attendance.auto_closed', 'attendance.fixed', 'attendance.switch_changed'] as const) {
      m.workforceEvents.on(name, () => seen.push(name));
    }
  }, 60_000);

  afterAll(async () => {
    if (!m) return;
    m.setPeriodClosedCheck(null);
    const everyone = [ids.chefEmp, ids.baristaEmp, ids.lena];
    await m.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('workforce.allow_clock_edits', 'on', true)`; // tests only: the events table is append-only
      await tx.clockEvent.deleteMany({ where: { employeeId: { in: everyone } } });
    });
    await m.prisma.shiftEndAnswer.deleteMany({ where: { employeeId: { in: everyone } } });
    await m.prisma.rotaEntry.deleteMany({ where: { employeeId: { in: everyone } } });
    await m.prisma.rotaWeek.deleteMany({ where: { id: { in: weeks } } });
    await m.prisma.shiftTemplate.deleteMany({ where: { id: ids.template } });
    await m.prisma.clockRecord.deleteMany({ where: { shiftAssignment: { shiftId: ids.legacyShift } } });
    await m.prisma.shiftAssignment.deleteMany({ where: { shiftId: ids.legacyShift } });
    await m.prisma.shift.deleteMany({ where: { id: ids.legacyShift } });
    await m.prisma.attendanceSiteSwitch.deleteMany({ where: { siteId: townId } });
    await m.prisma.employee.deleteMany({ where: { id: ids.lena } });
    await m.prisma.$disconnect();
  }, 60_000);

  it('with the switch off nothing changes: no new clock, the legacy guard lets the legacy clock through', async () => {
    expect(await m.getSwitch(townId)).toMatchObject({ enabled: false });
    // S3: the Director sees every site with its switch, a branch manager only their own.
    const all = await m.listSwitches(director);
    expect(all.length).toBeGreaterThan(1);
    expect(all.every((s) => !s.enabled)).toBe(true);
    expect((await m.listSwitches(townManager)).map((s) => s.siteId)).toEqual([townId]);
    expect((await m.listSwitches(chef)).map((s) => s.siteId)).toEqual([townId]);
    expect(await m.myDay(chef, at('06:20'))).toMatchObject({ enabled: false, current: null });
    await expect(m.clockIn(chef, tap(), at('06:20'))).rejects.toMatchObject({ code: 'ATTENDANCE_NOT_ENABLED' });
    let passed = 0;
    await m.refuseLegacyClockWhenSwitched({ user: { siteId: townId } } as Request, {} as Response, (() => { passed += 1; }) as NextFunction);
    expect(passed).toBe(1);
  });

  it('refuses to switch a site on while someone is clocked in on the legacy clock, then carries the day\'s finished legacy records', async () => {
    await expect(m.setSwitch(director, townId, true, at('06:30'))).rejects.toMatchObject({ code: 'OPEN_LEGACY_CLOCK_IN' });
    expect(await m.prisma.attendanceSiteSwitch.count({ where: { siteId: townId } })).toBe(0);
    await m.prisma.clockRecord.update({ where: { id: ids.legacyRecB }, data: { clockOutAt: at('06:30') } }); // she clocks out the old way
    const on = await m.setSwitch(director, townId, true, at('06:31'));
    expect(on).toMatchObject({ enabled: true, carriedFromLegacy: 2, mirroredToLegacy: 0 });
    expect((await eventsOf(ids.baristaEmp)).map((e) => [e.type, e.source, e.rotaEntryId])).toEqual([['IN', 'LEGACY', ids.baristaEntry], ['OUT', 'LEGACY', ids.baristaEntry]]);
    expect(await m.setSwitch(director, townId, true, at('06:32'))).toMatchObject({ enabled: true }); // already on: nothing happens
    expect(await m.prisma.clockEvent.count({ where: { employeeId: ids.baristaEmp } })).toBe(2);
    expect(seen.filter((n) => n === 'attendance.switch_changed')).toHaveLength(1);
  });

  it('the legacy clock now answers a refusal for this site only', async () => {
    const run = (siteId: string) => m.refuseLegacyClockWhenSwitched({ user: { siteId } } as Request, {} as Response, (() => undefined) as NextFunction);
    await expect(run(townId)).rejects.toMatchObject({ statusCode: 409, code: 'CLOCK_MOVED_TO_NEW_ATTENDANCE' });
    const other = (await m.prisma.site.findFirstOrThrow({ where: { id: { not: townId }, type: 'BRANCH' } })).id;
    await expect(run(other)).resolves.toBeUndefined();
  });

  it('a late clock-in: geofence and position are checked, a retry makes no second event, lateness is Nairobi time with the grace rule', async () => {
    await expect(m.clockIn(chef, tap({ latitude: pos.latitude + 0.01 }), at('06:20'))).rejects.toMatchObject({ code: 'CLOCK_OUTSIDE_GEOFENCE' });
    await expect(m.clockIn(chef, { clientEventId: key() }, at('06:20'))).rejects.toMatchObject({ code: 'LOCATION_REQUIRED' });
    const k = key();
    const first = await m.clockIn(chef, { clientEventId: k, ...pos }, at('06:20'));
    expect(first).toMatchObject({ replayed: false, lateness: { minutesLate: 20, countsAsLate: true, minutesAfterGrace: 15 } });
    expect(await m.clockIn(chef, { clientEventId: k, ...pos }, at('06:20'))).toMatchObject({ replayed: true });
    expect(await m.prisma.clockEvent.count({ where: { employeeId: ids.chefEmp, type: 'IN' } })).toBe(1);
    expect(seen).toEqual(expect.arrayContaining(['attendance.clocked_in', 'attendance.late']));
    const view = await m.myDay(chef, at('06:21')); // a minute after the tap: the counter runs and Undo is still there
    expect(view.current).toMatchObject({ state: 'ON_SHIFT', countsAsLate: true, secondsOnShift: 60, undo: { kind: 'IN' } });
    expect((await m.myDay(chef, at('06:25'))).current?.undo).toBeNull(); // five minutes on, the two minutes have passed
    expect(view.week.days).toHaveLength(7);
  });

  it('undo works inside the two minutes; a double tap from two phones makes one event; undo past the window points to the manager', async () => {
    await m.undoLastTap(chef, { clientEventId: key() }, at('06:21'));
    expect((await m.myDay(chef, at('06:22'))).current).toMatchObject({ state: 'NOT_IN', clockedInAt: null });
    await expect(m.undoLastTap(chef, { clientEventId: key() }, at('06:22'))).rejects.toMatchObject({ code: 'UNDO_NOT_AVAILABLE' });
    const race = await Promise.allSettled([m.clockIn(chef, tap(), at('06:30')), m.clockIn(chef, tap(), at('06:30'))]);
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((race.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'CLOCK_ALREADY_IN' });
    await expect(m.undoLastTap(chef, { clientEventId: key() }, at('06:40'))).rejects.toMatchObject({ code: 'UNDO_EXPIRED' });
    expect((await eventsOf(ids.chefEmp)).map((e) => e.type)).toEqual(['IN', 'CORRECTION', 'IN']);
  });

  it('the Today board: states, tiles, who sees what, and the on-shift list for the displays', async () => {
    const board = await m.todayBoard(townManager, {}, at('06:42'));
    expect(Object.fromEntries(board.people.filter((p) => p.shifts.length).map((p) => [p.employeeId, p.state]))).toMatchObject({ [ids.lena]: 'NOT_IN', [ids.chefEmp]: 'LATE', [ids.baristaEmp]: 'FINISHED' });
    expect(board.tiles).toMatchObject({ onShift: { count: 1 }, notIn: { count: 1 }, late: { count: 1 } });
    const head = await m.todayBoard(chef, {}, at('06:42'));
    expect(head.people.map((p) => p.employeeId)).toEqual([ids.chefEmp]); // a head sees only their own department
    await expect(m.todayBoard(highwayManager, { siteId: townId }, at('06:42'))).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.todayBoard({ id: 'w', role: 'WAITER', siteId: townId, headOfDepartmentIds: [] }, {}, at('06:42'))).rejects.toMatchObject({ statusCode: 403 });
    expect((await m.todayBoard(director, { siteId: townId }, at('06:42'))).people.length).toBe(board.people.length);
    expect((await m.getOnShiftNow({ siteId: townId }, undefined, at('06:42'))).map((p) => p.userId)).toEqual([chef.id]);
  });

  it('clocking someone in: time and reason, today only, inside the person\'s scope, one clock-in at a time', async () => {
    const base = { employeeId: ids.lena, type: 'IN' as const, reason: 'Her phone was dead' };
    await expect(m.clockForSomeone(chef, { ...base, at: at('06:15') }, at('06:50'))).rejects.toMatchObject({ statusCode: 403 }); // Kitchen head, Service person
    await expect(m.clockForSomeone(highwayManager, { ...base, at: at('06:15') }, at('06:50'))).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.clockForSomeone(townManager, { ...base, at: at('09:00') }, at('06:50'))).rejects.toMatchObject({ code: 'FIX_IN_FUTURE' });
    await expect(m.clockForSomeone(townManager, { ...base, at: m.time.instantAt(m.time.addDays(today, -1), m.time.parseClockTime('06:15')) }, at('06:50'))).rejects.toMatchObject({ code: 'CLOCK_FOR_TODAY_ONLY' });
    const done = await m.clockForSomeone(townManager, { ...base, at: at('06:15') }, at('06:50'));
    expect(done).toMatchObject({ source: 'MANAGER', lateness: { minutesLate: 15, countsAsLate: true } });
    await expect(m.clockForSomeone(townManager, { ...base, at: at('06:16') }, at('06:50'))).rejects.toMatchObject({ code: 'CLOCK_ALREADY_IN' });
  });

  it('leaving early needs a reason; at the end the prompt asks; "Stay on" is kept with its reason and answered once', async () => {
    await expect(m.clockOut(chef, tap(), at('11:20'))).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    const input = { rotaEntryId: ids.chefEntry, answer: 'STAY_ON' as const, reasonCode: 'BUSY' as const, estimateMinutes: 30 as const };
    await expect(m.stayOn(chef, input, at('13:59'))).rejects.toMatchObject({ code: 'PROMPT_NOT_DUE' });
    expect((await m.myDay(chef, at('14:05'))).current).toMatchObject({ state: 'PROMPT_DUE' });
    expect(await m.stayOn(chef, input, at('14:05'))).toMatchObject({ replayed: false, reasonCode: 'BUSY', estimateMinutes: 30 });
    expect(await m.stayOn(chef, input, at('14:06'))).toMatchObject({ replayed: true });
    expect((await m.myDay(chef, at('14:07'))).current).toMatchObject({ state: 'STAYING_ON', stayedOn: { reasonCode: 'BUSY' } });
    expect(seen).toContain('attendance.stayed_on');
  });

  it('the phone closes a shift nobody answered for, at its scheduled end, flagged, and the manager sees it', async () => {
    const swept = await m.sweepAutoClose(at('14:16'));
    expect(swept.closed).toBeGreaterThanOrEqual(1);
    const lena = (await eventsOf(ids.lena)).filter((e) => e.type === 'AUTO_OUT');
    expect(lena).toHaveLength(1);
    expect(lena[0]).toMatchObject({ source: 'SYSTEM', reasonCode: 'NO_ANSWER', occurredAt: at('14:00') });
    expect((await m.sweepAutoClose(at('14:17'))).closed).toBe(0); // idempotent
    expect((await eventsOf(ids.chefEmp)).some((e) => e.type === 'AUTO_OUT')).toBe(false); // the stay-on person is left alone
    expect((await m.todayBoard(townManager, {}, at('14:20'))).attention).toEqual([expect.objectContaining({ employeeId: ids.lena, kind: 'AUTO_CLOSED' })]);
    expect(seen).toContain('attendance.auto_closed');
  });

  it('a manager fixes time with a reason: preview, the old value stays in the history, an approved month refuses everyone, nothing breaks the order', async () => {
    const autoOut = (await eventsOf(ids.lena)).find((e) => e.type === 'AUTO_OUT')!;
    const fix = { employeeId: ids.lena, date: today, action: 'EDIT' as const, eventId: autoOut.id, at: at('15:20'), reason: 'She worked until 15:20, her manager confirmed' };
    expect(await m.previewFix(townManager, fix, at('16:00'))).toMatchObject({ before: { afterEndMinutes: 0 }, after: { afterEndMinutes: 80 } });
    await expect(m.applyFix(townManager, { ...fix, at: at('05:00') }, at('16:00'))).rejects.toMatchObject({ code: 'FIX_BREAKS_ORDER' });
    await expect(m.applyFix(highwayManager, fix, at('16:00'))).rejects.toMatchObject({ statusCode: 404 });
    m.setPeriodClosedCheck(async () => true);
    await expect(m.applyFix(townManager, fix, at('16:00'))).rejects.toMatchObject({ code: 'PERIOD_APPROVED', message: 'This month is approved. Ask HR to correct the payslip.' });
    await expect(m.previewFix(hr, fix, at('16:00'))).rejects.toMatchObject({ code: 'PERIOD_APPROVED' }); // Segment 1A: nobody, HR included; the payslip is corrected, not the clock
    m.setPeriodClosedCheck(null);

    const applied = await m.applyFix(townManager, fix, at('16:00'));
    expect(applied.eventId).toBeTruthy();
    const history = await m.dayHistory(townManager, { employeeId: ids.lena, date: today }, at('16:01'));
    const statuses = history.entries[0]!.events.map((e) => [e.type, e.status]);
    expect(statuses).toEqual([['IN', 'COUNTS'], ['AUTO_OUT', 'REPLACED'], ['CORRECTION', 'CORRECTION']]);
    expect(history.entries[0]!.events[1]).toMatchObject({ recordedAt: at('14:00').toISOString(), countsAt: at('15:20').toISOString() });
    expect((await m.todayBoard(townManager, {}, at('16:01'))).attention).toEqual([]); // fixed: no longer waiting
    const audit = (await m.auditRepository.listEntries(companyId, 0n, 100000)).filter((e) => e.action === 'attendance.time_fixed').pop();
    expect(audit?.reason).toMatch(/15:20/);
    expect(JSON.stringify({ before: audit?.before, after: audit?.after })).not.toMatch(/salary|amount|pay_/i);
    expect(seen).toContain('attendance.fixed');
  });

  it('lateness as data, in Nairobi time, with the grace rule and the same scope as the board', async () => {
    const report = await m.latenessReport(accountant, { siteId: townId, from: today, to: today }, at('16:05'));
    expect(report.lines.map((l) => [l.employeeId, l.minutesLate, l.minutesAfterGrace, l.graceMinutes]).sort()).toEqual([[ids.chefEmp, 30, 25, 5], [ids.lena, 15, 10, 5]].sort());
    expect(report.summary[0]).toMatchObject({ employeeId: ids.chefEmp, lateDays: 1, minutesAfterGrace: 25 });
    expect((await m.latenessReport(accountant, { siteId: townId, from: today, to: today, includeOnTime: true }, at('16:05'))).lines).toHaveLength(3); // the barista, 2 minutes in
    expect((await m.latenessReport(chef, { from: today, to: today }, at('16:05'))).lines.map((l) => l.employeeId)).toEqual([ids.chefEmp]);
  });

  it('switching off mirrors the day back (insert only) and switching on again counts nothing twice', async () => {
    await m.clockOut(chef, tap(), at('14:30')); // he finishes, half an hour over
    const before = { chefEvents: await m.prisma.clockEvent.count({ where: { employeeId: ids.chefEmp } }), baristaRec: await m.prisma.clockRecord.findUniqueOrThrow({ where: { id: ids.legacyRecB } }) };
    const off = await m.setSwitch(director, townId, false, at('16:30'));
    expect(off).toMatchObject({ enabled: false, mirroredToLegacy: 1 });
    expect(off.notMirrored).toEqual([ids.lena]); // a shift only the new rota knows
    const mirrored = await m.prisma.clockRecord.findFirstOrThrow({ where: { shiftAssignmentId: ids.legacyAsgC } });
    expect(mirrored).toMatchObject({ userId: chef.id, overrideNote: m.MIRROR_NOTE });
    expect(mirrored.clockInAt?.toISOString()).toBe(at('06:30').toISOString());
    expect(mirrored.clockOutAt?.toISOString()).toBe(at('14:30').toISOString());
    expect(await m.prisma.clockRecord.findUniqueOrThrow({ where: { id: ids.legacyRecB } })).toEqual(before.baristaRec); // the legacy row we did not write is untouched
    expect(await legacyCounts()).toEqual({ ...legacyBefore, clocks: legacyBefore.clocks + 1 });
    expect((await m.getOnShiftNow({ siteId: townId }, undefined, at('16:31'))).length).toBe(0); // the legacy read, nobody open

    const on = await m.setSwitch(director, townId, true, at('16:40'));
    expect(on).toMatchObject({ enabled: true, carriedFromLegacy: 0 }); // barista already carried; the mirror is not carried back
    expect(await m.prisma.clockEvent.count({ where: { employeeId: ids.chefEmp } })).toBe(before.chefEvents);
    expect(await m.prisma.clockEvent.count({ where: { employeeId: ids.baristaEmp } })).toBe(2);
  });

  it('clock events are append-only; removing a shift from the rota keeps the clock time and the day', async () => {
    const event = (await eventsOf(ids.lena))[0]!;
    await expect(m.prisma.clockEvent.update({ where: { id: event.id }, data: { reason: 'edited' } })).rejects.toThrow(/append-only/);
    await expect(m.prisma.clockEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
    await m.prisma.rotaEntry.delete({ where: { id: ids.lenaEntry } }); // the one allowed change: the foreign key nulls the link
    const kept = await m.prisma.clockEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(kept).toMatchObject({ rotaEntryId: null, occurredAt: event.occurredAt });
    expect((await m.dayHistory(townManager, { employeeId: ids.lena, date: today }, at('17:00'))).unscheduled.length).toBe(3);
  });

  it('every attendance change is in the audit chain and the chain verifies', async () => {
    const entries = await m.auditRepository.listEntries(companyId, 0n, 100000);
    const mine = new Set(entries.filter((e) => e.action.startsWith('attendance.')).map((e) => e.action));
    expect([...mine].sort()).toEqual(expect.arrayContaining(['attendance.auto_closed', 'attendance.clocked_for', 'attendance.clocked_in', 'attendance.clocked_out', 'attendance.legacy_carried', 'attendance.shift_end_answered', 'attendance.switch_changed', 'attendance.time_fixed', 'attendance.undone']));
    expect(entries.filter((e) => e.action === 'attendance.auto_closed').every((e) => e.channel === 'SYSTEM' && e.actorId === null)).toBe(true);
    expect(m.verifyAuditChain(entries)).toMatchObject({ ok: true });
  });
});
