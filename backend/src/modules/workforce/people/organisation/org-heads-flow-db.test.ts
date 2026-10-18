/**
 * Department heads against a real database: assign, replace, acting, exit of a head, undo, transfer of a head, end, the
 * claims on `User` after every step, `department.head_changed` for each, the audit chain, and the scheduler's
 * `reconcileHeadClaims` run twice. Runs only when DATABASE_URL names a lane database (same guard as people-flow-db).
 * It removes the people and logins it makes; audit entries stay (the log is append-only).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Department heads in the database', () => {
  const tag = randomUUID().slice(0, 6);
  type Mods = Awaited<ReturnType<typeof load>>;
  const load = async () => {
    const { prisma } = await import('../../../../config/database');
    const time = await import('../../_shared/time/nairobi-time');
    const { workforceEvents } = await import('../../_shared/events');
    const { hireService } = await import('../hire/hire-service');
    const { headsService } = await import('./heads/heads-service');
    const { departmentsReadService } = await import('./departments/departments-read-service');
    const { probationService } = await import('../lifecycle/probation-service');
    const { movesService } = await import('../lifecycle/moves-service');
    const { exitService } = await import('../lifecycle/exit-service');
    const { runPeopleScheduler } = await import('../scheduler/people-scheduler');
    const { auditRepository } = await import('../../_shared/audit/audit-repository');
    const { verifyAuditChain } = await import('../../_shared/audit/audit-hash');
    return { prisma, time, workforceEvents, hireService, headsService, departmentsReadService, lifecycle: { ...probationService, ...movesService, ...exitService }, runPeopleScheduler, auditRepository, verifyAuditChain };
  };

  let m: Mods;
  type Subject = import('../../_shared/workforce-access').AccessSubject;
  let hr: Subject;
  let townManager: Subject;
  let highwayManager: Subject;
  let companyId: string;
  let town: { siteId: string; service: string; waiter: string };
  let highway: { siteId: string; service: string };
  let hubDepartment: string;
  const people: Record<'A' | 'B' | 'C' | 'D', { employeeId: string; userId: string }> = {} as never;
  const events: { previous: string | null; next: string | null; effectiveOn: string }[] = [];
  const stop: (() => void)[] = [];

  const today = () => m.time.nairobiToday(new Date());
  const plus = (days: number) => m.time.addDays(today(), days);
  const at = (date: string) => new Date(`${date}T09:00:00+03:00`);
  const claimsOf = async (who: keyof typeof people) => m.prisma.user.findUniqueOrThrow({ where: { id: people[who].userId }, select: { isDepartmentHead: true, departmentTag: true, departmentId: true } });
  const lastEvent = () => events[events.length - 1];

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, site: { select: { companyId: true } } } });
    const admin = await user('admin@wendo.test');
    const bmTown = await user('bm.town@wendo.test');
    const bmHighway = await user('bm.highway@wendo.test');
    companyId = bmTown.site!.companyId;
    hr = { id: admin.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    townManager = { id: bmTown.id, role: 'MANAGER', siteId: bmTown.siteId, headOfDepartmentIds: [] };
    highwayManager = { id: bmHighway.id, role: 'MANAGER', siteId: bmHighway.siteId, headOfDepartmentIds: [] };
    const service = async (siteId: string) => (await m.prisma.department.findFirstOrThrow({ where: { siteId, key: 'SERVICE' }, select: { id: true } })).id;
    const waiter = await m.prisma.position.findFirstOrThrow({ where: { companyId, name: 'Waiter' }, select: { id: true } });
    town = { siteId: bmTown.siteId!, service: await service(bmTown.siteId!), waiter: waiter.id };
    highway = { siteId: bmHighway.siteId!, service: await service(bmHighway.siteId!) };
    hubDepartment = (await m.prisma.department.findFirstOrThrow({ where: { site: { companyId, isHub: true } }, select: { id: true } })).id;
    stop.push(
      m.workforceEvents.on('department.head_changed', (e) => {
        if (e.payload.departmentId === town.service) events.push({ previous: e.payload.previousHeadUserId, next: e.payload.newHeadUserId, effectiveOn: e.payload.effectiveOn });
      }),
    );
    let n = 0;
    for (const key of ['A', 'B', 'C', 'D'] as const) {
      n += 1;
      const result = await m.hireService.hire(hr, {
        who: { name: `ZZ Org ${tag} ${key}`, phone: `07${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, nationalId: `98${tag.replace(/\D/g, '0')}${n}${String(Math.floor(Math.random() * 1e3)).padStart(3, '0')}` },
        job: { siteId: town.siteId, departmentId: town.service, positionId: town.waiter, employment: 'MONTHLY_WITH_CONTRACT' as const, startDate: today() },
        confirmDuplicatePhone: false,
        login: { email: `zz.org.${tag}.${key}@wendo.test`.toLowerCase(), loginRole: 'WAITER', temporaryPassword: 'temporary-pass-1' },
      } as never);
      const row = await m.prisma.employee.findUniqueOrThrow({ where: { id: result.employee.id }, select: { userId: true } });
      people[key] = { employeeId: result.employee.id, userId: row.userId! };
    }
  });

  afterAll(async () => {
    if (!m) return;
    for (const off of stop) off();
    const ids = Object.values(people).map((p) => p.employeeId);
    const p = m.prisma;
    if (ids.length > 0) {
      await p.employeeMove.deleteMany({ where: { employeeId: { in: ids } } });
      await p.payChange.deleteMany({ where: { employeeId: { in: ids } } });
      await p.payProfile.deleteMany({ where: { employeeId: { in: ids } } });
      await p.contract.deleteMany({ where: { employeeId: { in: ids } } });
      await p.employmentSpell.deleteMany({ where: { employeeId: { in: ids } } });
      await p.fileRequest.deleteMany({ where: { employeeId: { in: ids } } });
      await p.departmentHead.deleteMany({ where: { employeeId: { in: ids } } });
      await p.employee.deleteMany({ where: { id: { in: ids } } });
    }
    for (const { userId } of Object.values(people)) {
      await p.refreshToken.deleteMany({ where: { userId } });
      await p.staffTransfer.deleteMany({ where: { userId } });
      await p.employeeProfile.deleteMany({ where: { userId } });
      await p.user.deleteMany({ where: { id: userId } });
    }
    await p.$disconnect();
  });

  const assign = (subject: Subject, departmentId: string, body: Record<string, unknown>, day: string) => m.headsService.assign(subject, departmentId, body as never, at(day));

  it('previews a head without writing anything, then names the first head', async () => {
    const preview = await m.headsService.preview(townManager, town.service, { employeeId: people.A.employeeId, mode: 'REPLACE', replaceActing: false }, at(today()));
    expect(preview.claims.before).toEqual({ isDepartmentHead: false, departmentTag: null });
    expect(preview.claims.after).toEqual({ isDepartmentHead: true, departmentTag: 'SERVICE' });
    expect(preview.endsHeadRoleOf).toEqual([]);
    expect(preview.notified.map((u) => u.userId)).toEqual(expect.arrayContaining([townManager.id, people.A.userId]));
    expect(await m.prisma.departmentHead.count({ where: { employeeId: people.A.employeeId } })).toBe(0);
    expect((await claimsOf('A')).isDepartmentHead).toBe(false);

    const view = await assign(townManager, town.service, { employeeId: people.A.employeeId, mode: 'REPLACE' }, today());
    expect(view.head).toMatchObject({ employeeId: people.A.employeeId, isActing: false, since: today() });
    expect(view.hasGap).toBe(false);
    expect(await claimsOf('A')).toEqual({ isDepartmentHead: true, departmentTag: 'SERVICE', departmentId: town.service });
    expect(lastEvent()).toEqual({ previous: null, next: people.A.userId, effectiveOn: today() });
  });

  it('refuses the wrong people, the wrong branch and the Central Store', async () => {
    await expect(assign(townManager, town.service, { employeeId: people.A.employeeId, mode: 'REPLACE' }, today())).rejects.toMatchObject({ code: 'ALREADY_HEAD' });
    const kitchenHead = await m.prisma.employee.findFirstOrThrow({ where: { companyId, siteId: town.siteId, department: { key: 'KITCHEN' }, status: 'ACTIVE', userId: { not: null } }, select: { id: true } });
    await expect(assign(townManager, town.service, { employeeId: kitchenHead.id, mode: 'REPLACE' }, today())).rejects.toMatchObject({ code: 'HEAD_NOT_ELIGIBLE' });
    await expect(assign(highwayManager, town.service, { employeeId: people.B.employeeId, mode: 'REPLACE' }, today())).rejects.toMatchObject({ statusCode: 403 });
    await expect(assign(hr, hubDepartment, { employeeId: people.B.employeeId, mode: 'REPLACE' }, today())).rejects.toMatchObject({ code: 'HUB_HAS_NO_HEADS' });
    await expect(m.departmentsReadService.getDepartment(highwayManager, town.service, { page: 1, perPage: 10 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(assign(hr, town.service, { employeeId: people.B.employeeId, mode: 'ACTING', returnsOn: today(), replaceActing: false }, today())).rejects.toMatchObject({ code: 'INVALID_RETURN_DATE' });
  });

  it('replacing the head ends the old row, moves the claims and lists the candidates without the head', async () => {
    const candidates = await m.headsService.candidates(townManager, town.service, at(plus(3)));
    const ids = candidates.map((c) => c.employeeId);
    expect(ids).not.toContain(people.A.employeeId);
    expect(ids).toEqual(expect.arrayContaining([people.B.employeeId, people.C.employeeId, people.D.employeeId]));
    expect(candidates.filter((c) => c.recommended)).toHaveLength(1);

    const view = await assign(hr, town.service, { employeeId: people.B.employeeId, mode: 'REPLACE', reason: 'Promotion' }, plus(3));
    expect(view.head?.employeeId).toBe(people.B.employeeId);
    const old = await m.prisma.departmentHead.findFirstOrThrow({ where: { employeeId: people.A.employeeId } });
    expect(m.time.fromDateColumn(old.endsOn!)).toBe(plus(2));
    expect(old.endReason).toBe('REPLACED');
    expect(await claimsOf('A')).toMatchObject({ isDepartmentHead: false, departmentTag: null });
    expect(await claimsOf('B')).toMatchObject({ isDepartmentHead: true, departmentTag: 'SERVICE' });
    expect(lastEvent()).toEqual({ previous: people.A.userId, next: people.B.userId, effectiveOn: plus(3) });
  });

  it('an acting head covers until the day before the head returns; a second acting head needs replaceActing', async () => {
    const view = await assign(townManager, town.service, { employeeId: people.C.employeeId, mode: 'ACTING', returnsOn: plus(9) }, plus(4));
    expect(view.actingHead).toMatchObject({ employeeId: people.C.employeeId, isActing: true, returnsOn: plus(9) });
    expect(view.head?.employeeId).toBe(people.B.employeeId); // the head stays
    expect((await claimsOf('C')).isDepartmentHead).toBe(true);
    const row = await m.prisma.departmentHead.findFirstOrThrow({ where: { employeeId: people.C.employeeId } });
    expect(m.time.fromDateColumn(row.endsOn!)).toBe(plus(8));

    const second = { employeeId: people.D.employeeId, mode: 'ACTING', returnsOn: plus(9) };
    await expect(assign(townManager, town.service, { ...second, replaceActing: false }, plus(4))).rejects.toMatchObject({ code: 'ACTING_HEAD_EXISTS' });
    await assign(townManager, town.service, { ...second, replaceActing: true }, plus(4));
    expect((await claimsOf('C')).isDepartmentHead).toBe(false);
    expect(await m.prisma.departmentHead.count({ where: { employeeId: people.C.employeeId } })).toBe(0); // started that day: removed, not ended
    expect((await claimsOf('D')).isDepartmentHead).toBe(true);
    expect(lastEvent()).toEqual({ previous: people.C.userId, next: people.D.userId, effectiveOn: plus(4) });
  });

  it('reconcileHeadClaims drops an acting head the night their cover ends, and a second run changes nothing', async () => {
    const first = await m.runPeopleScheduler(plus(9), at(plus(9)));
    expect(first.find((r) => r.task === 'reconcileHeadClaims')?.changed).toBe(1);
    expect((await claimsOf('D')).isDepartmentHead).toBe(false);
    expect(first.map((r) => r.task)).toContain('reconcileHeadClaims');
    const second = await m.runPeopleScheduler(plus(9), at(plus(9)));
    expect(second.map((r) => r.changed)).toEqual([0, 0, 0, 0, 0, 0]);
    // Drift is repaired too: a stray claim on someone with no head row is cleared by the next run.
    await m.prisma.user.update({ where: { id: people.A.userId }, data: { isDepartmentHead: true, departmentTag: 'SERVICE' } });
    expect((await m.runPeopleScheduler(plus(9), at(plus(9)))).find((r) => r.task === 'reconcileHeadClaims')?.changed).toBe(1);
    expect((await claimsOf('A')).isDepartmentHead).toBe(false);
  });

  it('a head who leaves loses the claim; undoing the exit gives the role back', async () => {
    await m.lifecycle.exit(hr, people.B.employeeId, { lastDay: plus(10), reason: 'RESIGNED', uniformReturned: true }, at(plus(9)));
    expect((await claimsOf('B')).isDepartmentHead).toBe(true); // still working out the notice
    await m.runPeopleScheduler(plus(11), at(plus(11)));
    expect(await claimsOf('B')).toMatchObject({ isDepartmentHead: false, departmentTag: null });
    expect(lastEvent()).toEqual({ previous: people.B.userId, next: null, effectiveOn: plus(11) });
    const gap = await m.departmentsReadService.getDepartment(hr, town.service, { page: 1, perPage: 10 }, at(plus(11)));
    expect(gap.hasGap).toBe(true);

    const undone = await m.lifecycle.undoExit(hr, people.B.employeeId, at(plus(12)));
    expect(undone.notRestored).toEqual([]);
    expect(await claimsOf('B')).toMatchObject({ isDepartmentHead: true, departmentTag: 'SERVICE' });
    expect(lastEvent()).toEqual({ previous: null, next: people.B.userId, effectiveOn: plus(12) });
  });

  it('a head who transfers loses the claim', async () => {
    await m.lifecycle.transfer(hr, people.B.employeeId, { toSiteId: highway.siteId, toDepartmentId: highway.service, startsOn: plus(13) }, at(plus(13)));
    expect(await claimsOf('B')).toMatchObject({ isDepartmentHead: false, departmentTag: null });
    expect(lastEvent()).toEqual({ previous: people.B.userId, next: null, effectiveOn: plus(13) });
    const row = await m.prisma.departmentHead.findFirstOrThrow({ where: { employeeId: people.B.employeeId, departmentId: town.service }, orderBy: { startsOn: 'desc' } });
    expect(row.endReason).toBe('TRANSFER');
  });

  it('ending a head needs a reason and a head to end', async () => {
    await assign(hr, town.service, { employeeId: people.A.employeeId, mode: 'REPLACE' }, plus(14));
    expect((await claimsOf('A')).isDepartmentHead).toBe(true);
    const view = await m.headsService.end(townManager, town.service, { which: 'HEAD', reason: 'Moved to the till' }, at(plus(15)));
    expect(view.head).toBeNull();
    expect(await claimsOf('A')).toMatchObject({ isDepartmentHead: false, departmentTag: null });
    expect(lastEvent()).toEqual({ previous: people.A.userId, next: null, effectiveOn: plus(15) });
    await expect(m.headsService.end(townManager, town.service, { which: 'HEAD', reason: 'again' }, at(plus(15)))).rejects.toMatchObject({ code: 'NO_HEAD_TO_END' });
  });

  it('the audit chain links, every head entry is on file and no entry carries a secret', async () => {
    const entries = await m.auditRepository.listEntries(companyId, 0n, 100000);
    expect(m.verifyAuditChain(entries)).toMatchObject({ ok: true });
    const mine = entries.filter((e) => e.action.startsWith('org.head'));
    const actions = new Set(mine.map((e) => e.action));
    for (const action of ['org.head_changed', 'org.head_ended', 'org.head_claims_reconciled']) expect(actions, action).toContain(action);
    expect(mine.filter((e) => e.action === 'org.head_claims_reconciled').every((e) => e.channel === 'SYSTEM')).toBe(true);
    expect(JSON.stringify(mine.map((e) => [e.before, e.after]))).not.toContain('temporary-pass-1');
  });
});
