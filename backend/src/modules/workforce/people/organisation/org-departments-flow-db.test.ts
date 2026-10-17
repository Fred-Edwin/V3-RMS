/**
 * Departments and positions against a real database: add a department, names, offered positions, who sees which part of
 * the organisation, a head of a department with no inventory tag (no claim), retire and restore, a position with the
 * "clocks in" impact and its acknowledgement. Runs only against a lane database; removes what it makes (audit stays).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Departments and positions in the database', () => {
  const tag = randomUUID().slice(0, 6);
  type Mods = Awaited<ReturnType<typeof load>>;
  const load = async () => {
    const { prisma } = await import('../../../../config/database');
    const time = await import('../../_shared/time/nairobi-time');
    const { workforceEvents } = await import('../../_shared/events');
    const { hireService } = await import('../hire/hire-service');
    const { departmentsService } = await import('./departments/departments-service');
    const { departmentsReadService } = await import('./departments/departments-read-service');
    const { headsService } = await import('./heads/heads-service');
    const { positionsService } = await import('./positions/positions-service');
    return { prisma, time, workforceEvents, hireService, departmentsService, departmentsReadService, headsService, positionsService };
  };

  let m: Mods;
  type Subject = import('../../_shared/workforce-access').AccessSubject;
  let hr: Subject;
  let townManager: Subject;
  let accountant: Subject;
  let companyId: string;
  let town: { siteId: string; waiter: string };
  let highwaySiteId: string;
  const made = { departments: [] as string[], positions: [] as string[], employees: [] as string[], users: [] as string[] };
  const tracksEvents: boolean[] = [];
  let off: () => void = () => undefined;
  let dept = '';
  let position = '';
  let headEmployee = '';
  const today = () => m.time.nairobiToday(new Date());

  const hire = async (key: string, positionId: string) => {
    const result = await m.hireService.hire(hr, {
      who: { name: `ZZ Dept ${tag} ${key}`, phone: `07${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, nationalId: `97${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}` },
      job: { siteId: town.siteId, departmentId: dept, positionId, employment: 'MONTHLY_WITH_CONTRACT' as const, startDate: today() },
      confirmDuplicatePhone: false,
      login: { email: `zz.dept.${tag}.${key}@wendo.test`.toLowerCase(), loginRole: 'WAITER', temporaryPassword: 'temporary-pass-1' },
    } as never);
    const row = await m.prisma.employee.findUniqueOrThrow({ where: { id: result.employee.id }, select: { userId: true } });
    made.employees.push(result.employee.id);
    made.users.push(row.userId!);
    return result.employee.id;
  };

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, site: { select: { companyId: true } } } });
    const admin = await user('admin@wendo.test');
    const bmTown = await user('bm.town@wendo.test');
    const acc = await user('accountant@wendo.test');
    companyId = bmTown.site!.companyId;
    hr = { id: admin.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    townManager = { id: bmTown.id, role: 'MANAGER', siteId: bmTown.siteId, headOfDepartmentIds: [] };
    accountant = { id: acc.id, role: 'ACCOUNTANT', siteId: acc.siteId, headOfDepartmentIds: [] };
    town = { siteId: bmTown.siteId!, waiter: (await m.prisma.position.findFirstOrThrow({ where: { companyId, name: 'Waiter' }, select: { id: true } })).id };
    highwaySiteId = (await user('bm.highway@wendo.test')).siteId!;
    off = m.workforceEvents.on('employee.tracks_time_changed', (e) => tracksEvents.push(e.payload.tracksTime));
  });

  afterAll(async () => {
    if (!m) return;
    off();
    const p = m.prisma;
    const ids = made.employees;
    if (ids.length > 0) {
      for (const del of [p.payChange, p.payProfile, p.contract, p.employmentSpell, p.fileRequest, p.departmentHead, p.employeeMove]) await (del as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { employeeId: { in: ids } } });
      await p.employee.deleteMany({ where: { id: { in: ids } } });
    }
    for (const userId of made.users) {
      await p.refreshToken.deleteMany({ where: { userId } });
      await p.employeeProfile.deleteMany({ where: { userId } });
      await p.user.deleteMany({ where: { id: userId } });
    }
    await p.departmentPosition.deleteMany({ where: { OR: [{ departmentId: { in: made.departments } }, { positionId: { in: made.positions } }] } });
    await p.position.deleteMany({ where: { id: { in: made.positions } } });
    await p.department.deleteMany({ where: { id: { in: made.departments } } });
    await p.$disconnect();
  });

  it('HR adds a department with its positions; names are unique per branch and a manager cannot add one', async () => {
    const view = await m.departmentsService.create(hr, { siteId: town.siteId, name: `ZZ Bakery ${tag}`, description: 'Breads', positionIds: [town.waiter] });
    dept = view.id;
    made.departments.push(dept);
    expect(view).toMatchObject({ inventoryTag: null, isActive: true, hasGap: true, people: 0, head: null, can: { edit: true, assignHead: true } });
    expect(view.positions.map((p) => p.id)).toEqual([town.waiter]);
    await expect(m.departmentsService.create(hr, { siteId: town.siteId, name: `zz bakery ${tag.toUpperCase()}`, positionIds: [] })).rejects.toMatchObject({ statusCode: 409, code: 'DEPARTMENT_NAME_TAKEN' });
    await expect(m.departmentsService.create(townManager, { siteId: town.siteId, name: `ZZ Other ${tag}`, positionIds: [] })).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.departmentsService.create(hr, { siteId: randomUUID(), name: `ZZ Nowhere ${tag}`, positionIds: [] })).rejects.toMatchObject({ code: 'SITE_NOT_AVAILABLE' });
  });

  it('each role sees only its part of the organisation; the Accountant sees none', async () => {
    const all = await m.departmentsReadService.overview(hr, false);
    expect(all.sites.length).toBeGreaterThanOrEqual(3);
    expect(all.counts.gaps).toBeGreaterThan(0);
    const hub = all.sites.find((s) => s.isHub)!;
    expect(hub).toMatchObject({ headsAllowed: false, gaps: 0 });
    expect(hub.departments.every((d) => !d.hasGap)).toBe(true);

    const mine = await m.departmentsReadService.overview(townManager, false);
    expect(mine.sites.map((s) => s.id)).toEqual([town.siteId]);
    expect(mine.sites[0]!.departments.map((d) => d.id)).toContain(dept);

    const headOf = { id: randomUUID(), role: 'WAITER' as const, siteId: town.siteId, headOfDepartmentIds: [dept] };
    const own = await m.departmentsReadService.overview(headOf, false);
    expect(own.sites.flatMap((s) => s.departments.map((d) => d.id))).toEqual([dept]);
    const other = { ...headOf, headOfDepartmentIds: [] as string[] };
    await expect(m.departmentsReadService.getDepartment(other, dept, { page: 1, perPage: 10 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.departmentsReadService.overview(accountant, false)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.departmentsReadService.getDepartment({ ...townManager, siteId: highwaySiteId }, dept, { page: 1, perPage: 10 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a department with no inventory tag can have a head, but the head carries no claim', async () => {
    const pos = await m.positionsService.create(hr, { name: `ZZ Baker ${tag}`, defaultTracksTime: true, loginRole: null, casualsAllowed: true, departmentIds: [dept] });
    position = pos.id;
    made.positions.push(position);
    headEmployee = await hire('H', position);
    const preview = await m.headsService.preview(hr, dept, { employeeId: headEmployee, mode: 'REPLACE', replaceActing: false });
    expect(preview.claims.after).toEqual({ isDepartmentHead: false, departmentTag: null });
    const view = await m.headsService.assign(hr, dept, { employeeId: headEmployee, mode: 'REPLACE', replaceActing: false });
    expect(view.head?.employeeId).toBe(headEmployee);
    expect(view.hasGap).toBe(false);
    const userId = made.users[0]!;
    expect(await m.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { isDepartmentHead: true, departmentTag: true } })).toEqual({ isDepartmentHead: false, departmentTag: null });
    const subject = { id: userId, role: 'WAITER' as const, siteId: town.siteId, headOfDepartmentIds: [dept] };
    expect((await m.departmentsReadService.getDepartment(subject, dept, { page: 1, perPage: 10 })).peoplePage.total).toBe(1);
  });

  it('a department cannot be retired while people work in it, or lose a position someone holds', async () => {
    await expect(m.departmentsService.retire(hr, dept)).rejects.toMatchObject({ statusCode: 409, code: 'DEPARTMENT_HAS_PEOPLE' });
    await expect(m.departmentsService.update(hr, dept, { positionIds: [town.waiter] })).rejects.toMatchObject({ code: 'POSITION_HELD' });
    const renamed = await m.departmentsService.update(hr, dept, { name: `ZZ Bread ${tag}`, description: null, positionIds: [town.waiter, position] });
    expect(renamed.name).toBe(`ZZ Bread ${tag}`);
    expect(renamed.description).toBeNull();
    expect(renamed.positions).toHaveLength(2);
  });

  it('an empty department retires and restores; retiring twice is refused', async () => {
    const spare = await m.departmentsService.create(hr, { siteId: town.siteId, name: `ZZ Spare ${tag}`, positionIds: [] });
    made.departments.push(spare.id);
    expect((await m.departmentsService.retire(hr, spare.id)).isActive).toBe(false);
    await expect(m.departmentsService.retire(hr, spare.id)).rejects.toMatchObject({ code: 'DEPARTMENT_RETIRED' });
    await expect(m.headsService.candidates(hr, spare.id)).rejects.toMatchObject({ code: 'DEPARTMENT_RETIRED' });
    expect((await m.departmentsService.restore(hr, spare.id)).isActive).toBe(true);
    const listed = await m.departmentsReadService.overview(hr, true);
    expect(listed.sites.flatMap((s) => s.departments).map((d) => d.id)).toContain(spare.id);
  });

  it('changing "clocks in" for a position needs the head count confirmed, then updates those people', async () => {
    const second = await hire('P', position);
    expect(second).toBeTruthy();
    const impact = await m.positionsService.impact(hr, position, false);
    expect(impact.count).toBe(2);
    await expect(m.positionsService.update(hr, position, { defaultTracksTime: false })).rejects.toMatchObject({ statusCode: 409, code: 'ACKNOWLEDGE_IMPACT', details: { count: 2 } });
    await expect(m.positionsService.update(hr, position, { defaultTracksTime: false, acknowledgedPeople: 1 })).rejects.toMatchObject({ code: 'ACKNOWLEDGE_IMPACT' });
    const done = await m.positionsService.update(hr, position, { defaultTracksTime: false, acknowledgedPeople: 2 });
    expect(done.defaultTracksTime).toBe(false);
    expect(tracksEvents).toEqual([false, false]);
    const rows = await m.prisma.employee.findMany({ where: { id: { in: made.employees } }, select: { tracksTime: true } });
    expect(rows.every((r) => r.tracksTime === false)).toBe(true);
    expect((await m.positionsService.impact(hr, position, false)).count).toBe(0);
  });

  it('positions: unique names, held positions cannot retire, a manager reads but cannot write and sees only own holders', async () => {
    await expect(m.positionsService.create(hr, { name: `zz baker ${tag}`, defaultTracksTime: true, loginRole: null, casualsAllowed: true, departmentIds: [] })).rejects.toMatchObject({ code: 'POSITION_NAME_TAKEN' });
    await expect(m.positionsService.retire(hr, position)).rejects.toMatchObject({ statusCode: 409, code: 'POSITION_HELD', details: { holders: expect.any(Array) } });
    await expect(m.positionsService.update(townManager, position, { name: 'Nope' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.positionsService.update(hr, position, { departmentIds: [] })).rejects.toMatchObject({ code: 'POSITION_HELD' });
    const asManager = await m.positionsService.get(townManager, position);
    expect(asManager.holderCount).toBe(2);
    expect(asManager.holders.every((h) => h.siteId === town.siteId)).toBe(true);
    const forDepartment = await m.positionsService.list(townManager, { departmentId: dept, includeRetired: false });
    expect(forDepartment.map((p) => p.id)).toEqual(expect.arrayContaining([position, town.waiter]));
  });

  it('ending the head of an untagged department changes no claim; the whole flow left no secret in the log', async () => {
    const view = await m.headsService.end(hr, dept, { which: 'HEAD', reason: 'Reorganised' });
    expect(view.head).toBeNull();
    const entries = await m.prisma.auditEntry.findMany({ where: { companyId, subjectId: { in: [dept, position] } }, select: { action: true, before: true, after: true } });
    const actions = new Set(entries.map((e) => e.action));
    for (const action of ['org.department_created', 'org.department_updated', 'org.position_created', 'org.position_updated']) expect(actions, action).toContain(action);
    expect(JSON.stringify(entries)).not.toMatch(/temporary-pass|\b97\d{6}\b/);
  });
});
