/**
 * The access change of 21 Oct 2026 against a real database: the Director and the System Admin write everywhere in People,
 * and the rules that must still hold. Nobody changes, decides or exits themself; a Director's pay change applies at once and
 * tells HR and the Accountant (no amount); an HR request or a System Admin request still needs a different Director; no pay
 * figure reaches an audit entry. Runs only on a lane database. It removes the person, login and pay rows it makes.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../_shared/pin/signer-pin', () => ({ verifySignerPin: vi.fn(async () => ({ method: 'PIN', signedAt: new Date() })) }));
const toldMock = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../people-context', async (importOriginal) => ({ ...(await importOriginal<typeof import('../people-context')>()), told: toldMock }));

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('pay and file rules for the Director and the System Admin', () => {
  const tag = `ZZ Access ${randomUUID().slice(0, 6)}`;
  const first = '41000.00';
  const bump = '43000.00';
  const bumpAgain = '44000.00';

  type Mods = Awaited<ReturnType<typeof load>>;
  const load = async () => {
    const { prisma } = await import('../../../../config/database');
    const time = await import('../../_shared/time/nairobi-time');
    const { hireService } = await import('../hire/hire-service');
    const { payService } = await import('./pay-service');
    const { exitService } = await import('../lifecycle/exit-service');
    const { employeesService } = await import('../employees/employees-service');
    return { prisma, time, hireService, payService, exitService, employeesService };
  };
  type Subject = import('../../_shared/workforce-access').AccessSubject;

  let m: Mods;
  let hr: Subject;
  let director: Subject;
  let secondDirector: Subject;
  let admin: Subject;
  let selfAsDirector: Subject;
  let selfAsAdmin: Subject;
  let employeeId = '';
  let personUserId = '';
  const created = { employeeIds: [] as string[], userIds: [] as string[] };
  const today = () => m.time.nairobiToday(new Date());

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, site: { select: { companyId: true } } } });
    const adminRow = await user('admin@wendo.test');
    const dir = await user('director@wendo.test');
    const bmTown = await user('bm.town@wendo.test');
    hr = { id: adminRow.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    director = { id: dir.id, role: 'DIRECTOR', siteId: dir.siteId, headOfDepartmentIds: [] };
    // A second Director identity: any other real user id, so the audit foreign keys hold; only its role and id matter here.
    secondDirector = { id: bmTown.id, role: 'DIRECTOR', siteId: null, headOfDepartmentIds: [] };
    admin = { id: adminRow.id, role: 'SYSTEM_ADMIN', siteId: null, headOfDepartmentIds: [] };

    const companyId = bmTown.site!.companyId;
    const service = await m.prisma.department.findFirstOrThrow({ where: { siteId: bmTown.siteId!, key: 'SERVICE' }, select: { id: true } });
    const waiter = await m.prisma.position.findFirstOrThrow({ where: { companyId, name: 'Waiter' }, select: { id: true } });
    const result = await m.hireService.hire(
      hr,
      {
        who: { name: tag, phone: `07${Math.floor(Math.random() * 1e8)}`, nationalId: `98${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}` },
        job: { siteId: bmTown.siteId!, departmentId: service.id, positionId: waiter.id, employment: 'MONTHLY_WITH_CONTRACT', startDate: m.time.addDays(today(), 1) },
        pay: { amount: first, overtimeEligible: false },
        login: { email: `zz.access.${randomUUID().slice(0, 8)}@wendo.test`, loginRole: 'WAITER', temporaryPassword: 'temporary-pass-1' },
        confirmDuplicatePhone: false,
      } as never,
    );
    employeeId = result.employee.id;
    created.employeeIds.push(employeeId);
    personUserId = (await m.prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { userId: true } })).userId!;
    created.userIds.push(personUserId);
    // The same person acting as a Director or a System Admin (as if the file were their own): only the ids matter.
    selfAsDirector = { id: personUserId, role: 'DIRECTOR', siteId: bmTown.siteId, headOfDepartmentIds: [] };
    selfAsAdmin = { id: personUserId, role: 'SYSTEM_ADMIN', siteId: null, headOfDepartmentIds: [] };
  });

  afterAll(async () => {
    if (!m) return;
    const p = m.prisma;
    const ids = created.employeeIds;
    if (ids.length > 0) {
      await p.hrDocument.deleteMany({ where: { employeeId: { in: ids } } });
      await p.probationNote.deleteMany({ where: { employeeId: { in: ids } } });
      await p.fileRequest.deleteMany({ where: { employeeId: { in: ids } } });
      await p.payChange.deleteMany({ where: { employeeId: { in: ids } } });
      await p.payProfile.deleteMany({ where: { employeeId: { in: ids } } });
      await p.contract.deleteMany({ where: { employeeId: { in: ids } } });
      await p.employmentSpell.deleteMany({ where: { employeeId: { in: ids } } });
      await p.departmentHead.deleteMany({ where: { employeeId: { in: ids } } });
      await p.employee.deleteMany({ where: { id: { in: ids } } });
    }
    for (const userId of created.userIds) {
      await p.refreshToken.deleteMany({ where: { userId } });
      await p.employeeProfile.deleteMany({ where: { userId } });
      await p.user.deleteMany({ where: { id: userId } });
    }
    await p.$disconnect();
  });

  const change = (amount: string, effectiveFrom: string = today()) => ({ amount, effectiveFrom, reason: 'ANNUAL_REVIEW' as const, pin: '1234' });

  it('a Director changes someone’s pay: it applies at once, with no second Director, and HR and the Accountant are told without an amount', async () => {
    toldMock.mockClear();
    const row = await m.payService.requestChange(director, employeeId, change(bump));
    expect(row.status).toBe('APPROVED');
    expect(row.decidedByName).toBeTruthy();
    expect((await m.payService.view(hr, employeeId)).amount).toBe(bump);
    const call = toldMock.mock.calls.find((c) => (c as unknown[])[1] === 'pay.changed_by_director') as unknown[] | undefined;
    expect(call, 'HR and the Accountant are told').toBeDefined();
    expect(JSON.stringify(call)).not.toContain(bump);
    const hrIds = await m.prisma.user.findMany({ where: { role: { in: ['HR_MANAGER', 'ACCOUNTANT'] }, isActive: true }, select: { id: true } });
    for (const { id } of hrIds) expect((call![0] as string[]).includes(id), `told ${id}`).toBe(true);
  });

  it('no pay figure reaches an audit entry', async () => {
    const entries = await m.prisma.auditEntry.findMany({ where: { subjectUserId: personUserId, category: 'PAY_SETUP' }, select: { before: true, after: true, actorName: true } });
    expect(entries.length).toBeGreaterThan(0);
    const text = JSON.stringify(entries);
    for (const amount of [first, bump, bumpAgain, '43000', '44000']) expect(text).not.toContain(amount);
    expect(entries.every((e) => !!e.actorName)).toBe(true);
  });

  it('a System Admin’s pay change waits for a Director; the System Admin cannot decide it; another Director can', async () => {
    const asked = await m.payService.requestChange(admin, employeeId, change(bumpAgain));
    expect(asked.status).toBe('PENDING');
    await expect(m.payService.decide(admin, asked.id, { decision: 'APPROVE', pin: '1234' })).rejects.toMatchObject({ statusCode: 403, code: 'SELF_APPROVAL' });
    const decided = await m.payService.decide(secondDirector, asked.id, { decision: 'APPROVE', pin: '1234' });
    expect(decided.status).toBe('APPROVED');
    expect((await m.payService.view(hr, employeeId)).amount).toBe(bumpAgain);
  });

  it('an HR request still needs a Director other than HR, and HR cannot decide', async () => {
    const asked = await m.payService.requestChange(hr, employeeId, change('45000.00'));
    expect(asked.status).toBe('PENDING');
    await expect(m.payService.decide(hr, asked.id, { decision: 'APPROVE', pin: '1234' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.payService.decide(director, asked.id, { decision: 'DECLINE', pin: '1234' })).resolves.toMatchObject({ status: 'DECLINED' });
  });

  it('nobody changes their own pay or bank details, Director or System Admin', async () => {
    for (const self of [selfAsDirector, selfAsAdmin]) {
      await expect(m.payService.requestChange(self, employeeId, change('99000.00'))).rejects.toMatchObject({ statusCode: 403 });
      await expect(m.payService.updateProfile(self, employeeId, { overtimeEligible: true } as never)).rejects.toMatchObject({ statusCode: 403 });
    }
    expect((await m.payService.view(hr, employeeId)).amount).toBe(bumpAgain);
  });

  it('nobody exits themself; a Director exits someone else’s file', async () => {
    const lastDay = m.time.addDays(today(), 20);
    await expect(m.exitService.exit(selfAsDirector, employeeId, { lastDay, reason: 'RESIGNED', uniformReturned: false })).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.exitService.exit(selfAsAdmin, employeeId, { lastDay, reason: 'RESIGNED', uniformReturned: false })).rejects.toMatchObject({ statusCode: 403 });
    const done = await m.exitService.exit(director, employeeId, { lastDay, reason: 'RESIGNED', uniformReturned: false });
    expect(done).toBeTruthy();
  });

  it('the System Admin sees pay, bank, ids and documents; the file locks only nothing', async () => {
    const file = await m.employeesService.getFile(admin, employeeId);
    expect(file.locked).toEqual([]);
  });
});
