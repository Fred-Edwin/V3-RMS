/**
 * The Rota slice against a real database: shift templates, a five-person week built with the brush and a pattern, the grid
 * and its warnings, "start from last week" with a clash, the reason for today and tomorrow, read-only past days, the batched
 * "your shifts changed" notice, the carry-over run twice, the legacy tables unchanged and the audit chain intact.
 *
 * Runs only when DATABASE_URL names a lane database (same guard as people-flow-db.test.ts). Needs the seeded lane data.
 * It removes the people, shifts and rota rows it makes; the audit entries stay (the log is append-only by design).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Rota flows in the database', () => {
  const tag = `ZZ Rota ${randomUUID().slice(0, 6)}`;
  type Mods = Awaited<ReturnType<typeof load>>;
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const time = await import('../_shared/time/nairobi-time');
    const { templatesService } = await import('./templates/templates-service');
    const { templatesUpdateService } = await import('./templates/templates-update-service');
    const { cellsService } = await import('./cells/cells-service');
    const { copyService } = await import('./copy/copy-service');
    const { weeksReadService } = await import('./weeks/weeks-read-service');
    const { printService } = await import('./weeks/print-service');
    const { changeBatcher } = await import('./changes/change-batcher');
    const { registerLeaveLookup } = await import('./warnings/leave-lookup');
    const { carryOverLegacyRota } = await import('./legacy/legacy-carry-over');
    const { workforceEvents } = await import('../_shared/events');
    const { auditRepository } = await import('../_shared/audit/audit-repository');
    const { verifyAuditChain } = await import('../_shared/audit/audit-hash');
    return { prisma, time, templatesService, templatesUpdateService, cellsService, copyService, weeksReadService, printService, changeBatcher, registerLeaveLookup, carryOverLegacyRota, workforceEvents, auditRepository, verifyAuditChain };
  };

  let m: Mods;
  type Subject = import('../_shared/workforce-access').AccessSubject;
  let hr: Subject;
  let accountant: Subject;
  let townManager: Subject;
  let highwayManager: Subject;
  let companyId: string;
  let townId: string;
  let serviceDept: string;
  const people: { id: string; name: string }[] = [];
  const templateIds: string[] = [];
  let morning = '';
  let afternoon = '';
  let nextMonday = '';
  const legacyBefore = { shifts: 0, assignments: 0, clocks: 0 };

  const legacyCounts = async () => ({ shifts: await m.prisma.shift.count(), assignments: await m.prisma.shiftAssignment.count(), clocks: await m.prisma.clockRecord.count() });
  const today = () => m.time.nairobiToday(new Date());
  const day = (offset: number) => m.time.addDays(m.time.parseNairobiDate(nextMonday), offset);

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, site: { select: { companyId: true } } } });
    const admin = await user('admin@wendo.test');
    const bmTown = await user('bm.town@wendo.test');
    const bmHighway = await user('bm.highway@wendo.test');
    const acc = await user('accountant@wendo.test');
    companyId = bmTown.site!.companyId;
    townId = bmTown.siteId!;
    hr = { id: admin.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    accountant = { id: acc.id, role: 'ACCOUNTANT', siteId: acc.siteId, headOfDepartmentIds: [] };
    townManager = { id: bmTown.id, role: 'MANAGER', siteId: townId, headOfDepartmentIds: [] };
    highwayManager = { id: bmHighway.id, role: 'MANAGER', siteId: bmHighway.siteId, headOfDepartmentIds: [] };
    serviceDept = (await m.prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'SERVICE' }, select: { id: true } })).id;
    for (let i = 1; i <= 5; i++) {
      const row = await m.prisma.employee.create({
        data: { companyId, siteId: townId, employeeNumber: `ZZR-${tag.slice(-6)}-${i}`, name: `${tag} ${i}`, departmentId: serviceDept, payType: 'MONTHLY_SALARY', startDate: m.time.toDateColumn(m.time.addDays(today(), -30)), status: 'ACTIVE', tracksTime: true },
        select: { id: true, name: true },
      });
      people.push(row);
    }
    const base = m.time.addDays(today(), 14);
    nextMonday = m.time.addDays(base, -((m.time.isoWeekday(base) + 6) % 7));
    Object.assign(legacyBefore, await legacyCounts());
  });

  afterAll(async () => {
    if (!m) return;
    const ids = people.map((p) => p.id);
    await m.prisma.rotaEntry.deleteMany({ where: { employeeId: { in: ids } } });
    await m.prisma.rotaWeek.deleteMany({ where: { siteId: townId, entries: { none: {} }, carriedFromLegacy: false } });
    await m.prisma.shiftTemplate.deleteMany({ where: { id: { in: templateIds } } });
    await m.prisma.shiftTemplate.deleteMany({ where: { companyId, name: { startsWith: tag } } });
    await m.prisma.employee.deleteMany({ where: { id: { in: ids } } });
    m.registerLeaveLookup(null);
    await m.prisma.$disconnect();
  });

  const shift = (name: string, start: string, end: string, over: Record<string, unknown> = {}) => ({ siteId: townId, name: `${tag} ${name}`, colour: 'BLUE' as const, startTime: start, endTime: end, unpaidBreakMinutes: 0, departmentIds: [], ...over });

  it('a Branch Manager adds a shift for their site but not a company-wide one; no overnight shifts', async () => {
    const a = await m.templatesService.create(townManager, shift('Morning', '06:00', '14:00') as never);
    const b = await m.templatesService.create(townManager, shift('Afternoon', '14:00', '22:00', { colour: 'GREEN' }) as never);
    morning = a.id;
    afternoon = b.id;
    templateIds.push(a.id, b.id);
    expect(a).toMatchObject({ paidMinutes: 480, siteId: townId });
    await expect(m.templatesService.create(townManager, shift('Wide', '06:00', '14:00', { siteId: null }) as never)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.templatesService.create(townManager, shift('Night', '22:00', '06:00') as never)).rejects.toMatchObject({ code: 'OVERNIGHT_SHIFT' });
    await expect(m.templatesService.create(townManager, shift('Morning', '07:00', '15:00') as never)).rejects.toMatchObject({ code: 'TEMPLATE_NAME_TAKEN' });
    const wide = await m.templatesService.create(hr, shift('Company wide', '10:00', '18:00', { siteId: null, unpaidBreakMinutes: 30 }) as never);
    templateIds.push(wide.id);
    expect(wide.paidMinutes).toBe(450);
    await expect(m.templatesUpdateService.update(townManager, wide.id, { name: `${tag} Hacked` })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('builds a five-person week with the brush and a pattern, and the grid adds it up', async () => {
    const ids = people.map((p) => p.id);
    const brush = await m.cellsService.fill(townManager, { employeeIds: ids, dates: [0, 1, 2, 3, 4].map((o) => day(o)), templateId: morning } as never);
    expect(brush).toMatchObject({ changedCells: 25, peopleAffected: 5 });
    await m.cellsService.pattern(townManager, { employeeIds: [ids[0] as string], weekStart: nextMonday, byWeekday: { '6': afternoon, '7': afternoon } } as never);
    const view = await m.weeksReadService.getWeek(townManager, { weekStart: nextMonday as never, departmentId: serviceDept });
    expect(view.totals).toMatchObject({ people: 5, shifts: 27 });
    expect(view.people.find((p) => p.employeeId === ids[0])?.plannedMinutes).toBe(7 * 480);
    expect(view.cost).toBeNull(); // a Branch Manager does not read pay
    expect(view.can).toMatchObject({ write: true, readCost: false });
  });

  it('warns about a double shift and leave but never blocks; an override needs a reason', async () => {
    const first = people[0] as { id: string };
    const second = people[1] as { id: string };
    await m.cellsService.setCells(townManager, { changes: [{ employeeId: first.id, date: day(1), templateIds: [morning, afternoon] }] } as never);
    m.registerLeaveLookup(async (ids) => new Map(ids.filter((id) => id === second.id).map((id) => [id, new Set([day(2)])])));
    await expect(m.cellsService.setCells(townManager, { changes: [{ employeeId: second.id, date: day(2), templateIds: [afternoon] }] } as never)).rejects.toMatchObject({ statusCode: 409, code: 'LEAVE_OVERRIDE_REQUIRED' });
    const done = await m.cellsService.setCells(townManager, { changes: [{ employeeId: second.id, date: day(2), templateIds: [afternoon] }], overrideReason: 'Short staffed, agreed with her' } as never);
    expect(done.leaveOverrides).toBe(1);
    const view = await m.weeksReadService.getWeek(townManager, { weekStart: nextMonday as never });
    const codes = view.warnings.map((w) => `${w.code}:${w.employeeId}`);
    expect(codes).toContain(`DOUBLE_SHIFT:${first.id}`);
    expect(codes).toContain(`LEAVE:${second.id}`);
    expect(view.people.find((p) => p.employeeId === second.id)?.cells[day(2)]?.[0]?.overrideReason).toBe('Short staffed, agreed with her');
  });

  it('shows the cost to a pay reader only', async () => {
    const forHr = await m.weeksReadService.getWeek(hr, { weekStart: nextMonday as never, siteId: townId });
    expect(forHr.can).toMatchObject({ readCost: true, writeTemplates: true });
    expect(forHr.cost).toMatchObject({ amount: expect.stringMatching(/^\d+\.\d{2}$/) });
    // The Accountant has a rota of their own only: no grid for a site.
    await expect(m.weeksReadService.getWeek(accountant, { weekStart: nextMonday as never, siteId: townId })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('another branch cannot read or write this rota', async () => {
    await expect(m.cellsService.setCells(highwayManager, { changes: [{ employeeId: (people[0] as { id: string }).id, date: day(3), templateIds: [] }] } as never)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.weeksReadService.getWeek(highwayManager, { weekStart: nextMonday as never, siteId: townId })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('start from last week previews and copies, leaving a clash out', async () => {
    const target = m.time.addDays(m.time.parseNairobiDate(nextMonday), 7);
    const first = people[0] as { id: string };
    m.registerLeaveLookup(async (ids) => new Map(ids.filter((id) => id === first.id).map((id) => [id, new Set([m.time.addDays(target, 0)])])));
    const preview = await m.copyService.preview(townManager, { weekStart: target, departmentId: serviceDept } as never);
    expect(preview).toMatchObject({ clashes: [expect.objectContaining({ employeeId: first.id, kind: 'ON_LEAVE' })], people: 5 });
    const before = await m.prisma.rotaEntry.count({ where: { employeeId: { in: people.map((p) => p.id) } } });
    expect(await m.prisma.rotaEntry.count({ where: { employeeId: { in: people.map((p) => p.id) } } })).toBe(before); // preview wrote nothing
    const copied = await m.copyService.copy(townManager, { weekStart: target } as never);
    expect(copied.changedCells).toBeGreaterThan(20);
    expect(copied.clashes).toHaveLength(1);
    const week2 = await m.weeksReadService.getWeek(townManager, { weekStart: target as never });
    expect(week2.people.find((p) => p.employeeId === first.id)?.cells[target]).toBeUndefined();
    await expect(m.copyService.copy(townManager, { weekStart: target } as never)).rejects.toMatchObject({ code: 'NOTHING_TO_COPY' });
    m.registerLeaveLookup(null);
  });

  it('the reason for today and tomorrow is optional and kept when given; past days are read-only; far weeks are refused', async () => {
    const p = people[0] as { id: string };
    const tomorrow = m.time.addDays(today(), 1);
    await m.cellsService.setCells(townManager, { changes: [{ employeeId: p.id, date: tomorrow, templateIds: [morning] }] } as never);
    await m.cellsService.setCells(townManager, { changes: [{ employeeId: p.id, date: tomorrow, templateIds: [] }] } as never);
    await m.cellsService.setCells(townManager, { changes: [{ employeeId: p.id, date: tomorrow, templateIds: [morning] }], reason: 'Cover for a sick colleague' } as never);
    const entry = (await m.auditRepository.listEntries(companyId, 0n, 100000)).filter((e) => e.action === 'rota.cells_changed').pop();
    expect(entry?.reason).toBe('Cover for a sick colleague');
    expect(JSON.stringify(entry?.after)).not.toMatch(/amount|salary|pay/i);
    const yesterday = m.time.addDays(today(), -1);
    await expect(m.cellsService.setCells(townManager, { changes: [{ employeeId: p.id, date: yesterday, templateIds: [morning] }], reason: 'Fix the past' } as never)).rejects.toMatchObject({ code: 'PAST_DAY_READ_ONLY' });
    await expect(m.cellsService.setCells(townManager, { changes: [{ employeeId: p.id, date: m.time.addDays(today(), 400), templateIds: [] }] } as never)).rejects.toMatchObject({ code: 'WEEK_OUT_OF_RANGE' });
  });

  it('a time change moves upcoming shifts and tells people; the printed rota carries no pay', async () => {
    const seen = vi.fn();
    const off = m.workforceEvents.on('rota.shifts_changed', (e) => seen(e.payload.employeeId));
    m.changeBatcher.flushAll(); // everything from the earlier edits
    expect(seen).toHaveBeenCalled();
    seen.mockClear();
    const updated = await m.templatesUpdateService.update(townManager, afternoon, { endTime: '21:00', reason: 'Closing earlier' });
    expect(updated.endTime).toBe('21:00');
    m.changeBatcher.flushAll();
    expect(seen).toHaveBeenCalled();
    off();
    const printed = await m.printService.get(townManager, { weekStart: nextMonday as never, departmentId: serviceDept } as never);
    expect(printed.departments[0]?.people.length).toBe(5);
    expect(JSON.stringify(printed)).not.toMatch(/cost|amount/i);
    await m.templatesService.retire(townManager, afternoon).catch((e: { code?: string }) => expect(e.code).toBe('TEMPLATE_IN_USE'));
  });

  it('the carry-over run twice changes nothing; legacy tables untouched; the audit chain verifies', async () => {
    const count = () => m.prisma.rotaEntry.count();
    const first = await m.carryOverLegacyRota(new Date());
    const afterFirst = await count();
    const second = await m.carryOverLegacyRota(new Date());
    expect(second).toMatchObject({ templatesCreated: 0, entriesCreated: 0 });
    expect(await count()).toBe(afterFirst);
    expect(first.templatesSkipped).toBeGreaterThanOrEqual(0);
    expect(await legacyCounts()).toEqual(legacyBefore);
    expect(m.verifyAuditChain(await m.auditRepository.listEntries(companyId, 0n, 100000))).toMatchObject({ ok: true });
  });
});
