/**
 * The People slice against a real database, end to end: hire, masking and reveal, pay change with the Director's
 * decision, probation, contract, transfer (with a login), send to another site, exit, undo, finalise, rehire, and the
 * daily scheduler run twice. It then checks the audit chain links and that no amount or ID number reached an entry.
 *
 * Runs only when DATABASE_URL names a lane database (same guard as audit-db.test.ts); skipped everywhere else. It needs
 * the seeded lane data (two branches, a hub, the backfilled departments and positions). It removes the people, logins and
 * pay rows it makes; the audit entries it writes stay (the log is append-only by design).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('People flows in the database', () => {
  const tag = `ZZ Flow ${randomUUID().slice(0, 6)}`;
  const nationalId = `99${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
  const monthly = '45500.00';
  const raise = '52750.00';

  type Mods = Awaited<ReturnType<typeof load>>;
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const time = await import('../_shared/time/nairobi-time');
    const { hireService } = await import('./hire/hire-service');
    const { employeesService: reads } = await import('./employees/employees-service');
    const { employeeSensitiveService } = await import('./employees/employee-sensitive-service');
    const { payService } = await import('./pay/pay-service');
    const { probationService } = await import('./lifecycle/probation-service');
    const { movesService } = await import('./lifecycle/moves-service');
    const { exitService } = await import('./lifecycle/exit-service');
    const { runPeopleScheduler } = await import('./scheduler/people-scheduler');
    // The test bodies talk to "employees" and "lifecycle" as a whole; these compose the split services.
    const employeesService = { ...reads, ...employeeSensitiveService };
    const lifecycleService = { ...probationService, ...movesService, ...exitService };
    const { auditRepository } = await import('../_shared/audit/audit-repository');
    const { verifyAuditChain } = await import('../_shared/audit/audit-hash');
    const { getEmployee, getActiveLoans, payAmountOn } = await import('./people-door');
    return { prisma, time, hireService, employeesService, payService, lifecycleService, runPeopleScheduler, auditRepository, verifyAuditChain, getEmployee, getActiveLoans, payAmountOn };
  };

  let m: Mods;
  let hr: import('../_shared/workforce-access').AccessSubject;
  let director: import('../_shared/workforce-access').AccessSubject;
  let townManager: import('../_shared/workforce-access').AccessSubject;
  let highwayManager: import('../_shared/workforce-access').AccessSubject;
  let companyId: string;
  let town: { siteId: string; serviceDept: string; positionId: string };
  let highway: { siteId: string; serviceDept: string };
  const created = { employeeIds: [] as string[], userIds: [] as string[] };

  const today = () => m.time.nairobiToday(new Date());
  const plus = (days: number) => m.time.addDays(today(), days);
  const at = (date: string) => new Date(`${date}T09:00:00+03:00`);

  beforeAll(async () => {
    m = await load();
    const user = async (email: string) => {
      const row = await m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, site: { select: { companyId: true } } } });
      return row;
    };
    const admin = await m.prisma.user.findUniqueOrThrow({ where: { email: 'admin@wendo.test' }, select: { id: true } });
    const dir = await user('director@wendo.test');
    const bmTown = await user('bm.town@wendo.test');
    const bmHighway = await user('bm.highway@wendo.test');
    companyId = bmTown.site!.companyId;
    // The HR actor is the admin's user id (a real user, so foreign keys hold) acting with the HR role.
    hr = { id: admin.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    director = { id: dir.id, role: 'DIRECTOR', siteId: dir.siteId, headOfDepartmentIds: [] };
    townManager = { id: bmTown.id, role: 'MANAGER', siteId: bmTown.siteId, headOfDepartmentIds: [] };
    highwayManager = { id: bmHighway.id, role: 'MANAGER', siteId: bmHighway.siteId, headOfDepartmentIds: [] };
    const service = async (siteId: string) =>
      m.prisma.department.findFirstOrThrow({ where: { siteId, key: 'SERVICE' }, select: { id: true } });
    const waiter = await m.prisma.position.findFirstOrThrow({ where: { companyId, name: 'Waiter' }, select: { id: true } });
    town = { siteId: bmTown.siteId!, serviceDept: (await service(bmTown.siteId!)).id, positionId: waiter.id };
    highway = { siteId: bmHighway.siteId!, serviceDept: (await service(bmHighway.siteId!)).id };
  });

  afterAll(async () => {
    if (!m) return;
    const ids = created.employeeIds;
    const p = m.prisma;
    if (ids.length > 0) {
      await p.hrDocument.deleteMany({ where: { employeeId: { in: ids } } });
      await p.probationNote.deleteMany({ where: { employeeId: { in: ids } } });
      await p.fileRequest.deleteMany({ where: { employeeId: { in: ids } } });
      await p.employeeMove.deleteMany({ where: { employeeId: { in: ids } } });
      await p.payChange.deleteMany({ where: { employeeId: { in: ids } } });
      await p.payProfile.deleteMany({ where: { employeeId: { in: ids } } });
      await p.contract.deleteMany({ where: { employeeId: { in: ids } } });
      await p.employmentSpell.deleteMany({ where: { employeeId: { in: ids } } });
      await p.departmentHead.deleteMany({ where: { employeeId: { in: ids } } });
      await p.employee.deleteMany({ where: { id: { in: ids } } });
    }
    for (const userId of created.userIds) {
      await p.refreshToken.deleteMany({ where: { userId } });
      await p.staffTransfer.deleteMany({ where: { userId } });
      await p.employeeProfile.deleteMany({ where: { userId } });
      await p.user.deleteMany({ where: { id: userId } });
    }
    await p.employeeDraft.deleteMany({ where: { companyId, createdById: hr.id, kind: 'MONTHLY', payload: { path: ['name'], equals: tag } } });
    await p.$disconnect();
  });

  const hireBody = (over: Record<string, unknown> = {}, jobOver: Record<string, unknown> = {}) => ({
    who: { name: tag, phone: `07${Math.floor(Math.random() * 1e8)}`, nationalId },
    job: {
      siteId: town.siteId,
      departmentId: town.serviceDept,
      positionId: town.positionId,
      employment: 'MONTHLY_WITH_CONTRACT' as const,
      startDate: plus(1),
      ...jobOver,
    },
    confirmDuplicatePhone: false,
    ...over,
  });

  let employeeId = '';
  let loginUserId = '';

  it('a Branch Manager hires the basics only; pay, bank and login are HR', async () => {
    await expect(m.hireService.hire(townManager, hireBody({ pay: { amount: monthly, overtimeEligible: false } }) as never)).rejects.toMatchObject({ statusCode: 403, code: 'FIELD_NOT_ALLOWED' });
    await expect(
      m.hireService.hire(townManager, hireBody({ login: { email: 'x@wendo.test', loginRole: 'WAITER', temporaryPassword: 'temporary-pass-1' } }) as never),
    ).rejects.toMatchObject({ statusCode: 403 });
    // A manager cannot hire into the other branch.
    await expect(m.hireService.hire(townManager, hireBody({}, { siteId: highway.siteId, departmentId: highway.serviceDept }) as never)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('HR hires a monthly person with pay, bank details and a login; the pay set at hire is in force at once', async () => {
    const email = `zz.flow.${randomUUID().slice(0, 8)}@wendo.test`;
    const result = await m.hireService.hire(
      hr,
      hireBody({
        pay: { amount: monthly, overtimeEligible: true, standardWeekHours: '48', standardDayHours: '8' },
        statutory: { payoutMethod: 'BANK', bankName: 'Equity', accountNumber: '0123456789', nssfNumber: 'NSSF-ZZ', shaNumber: 'SHA-ZZ' },
        login: { email, loginRole: 'WAITER', temporaryPassword: 'temporary-pass-1' },
      }) as never,
    );
    employeeId = result.employee.id;
    created.employeeIds.push(employeeId);
    expect(result.login).toEqual({ created: true });
    expect(result.nextStep).toBe('CREATE_CONTRACT');
    expect(result.employee.employeeNumber).toMatch(/^W-\d{4,}$/);
    expect(result.employee.status).toBe('ONBOARDING'); // starts tomorrow
    expect(result.employee.hasLogin).toBe(true);
    expect(result.employee.probation?.endsOn).toBeTruthy();
    const row = await m.prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { userId: true } });
    loginUserId = row.userId!;
    created.userIds.push(loginUserId);

    const pay = await m.payService.view(hr, employeeId);
    expect(pay.amount).toBe(monthly);
    expect(pay.hourlyEquivalent).toBe('218.75'); // 45,500 / (48 x 52 / 12)
    expect(pay.history.map((h) => h.reason)).toEqual(['HIRING']);
    expect(pay.history[0]?.status).toBe('APPROVED');
  });

  it('refuses a duplicate ID number and needs a confirmation for a duplicate phone', async () => {
    await expect(m.hireService.hire(hr, hireBody() as never)).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_NATIONAL_ID' });
    const phone = (await m.prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { personalPhone: true } })).personalPhone!;
    await expect(m.hireService.hire(hr, hireBody({ who: { name: tag, phone, nationalId: `${nationalId}1` } }) as never)).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_PHONE' });
    expect(await m.employeesService.duplicateCheck(hr, { nationalId })).toEqual({ nationalId: true, phone: false, email: false });
  });

  it('shows each role only what it may see, masked, and hides other branches', async () => {
    const asHr = await m.employeesService.getFile(hr, employeeId);
    // Only the Director sees who opened payslips; HR sees everything else about the person.
    expect(asHr.locked).toEqual(['payslip_opens']);
    expect(asHr.sensitive['nationalId']).toMatch(/^•••• /);
    expect(asHr.sensitive['nationalId']).not.toContain(nationalId);
    expect(asHr.completeness).not.toBeNull();

    const asDirector = await m.employeesService.getFile(director, employeeId);
    expect(asDirector.locked).toEqual([]);

    const asManager = await m.employeesService.getFile(townManager, employeeId);
    expect(asManager.locked.filter((g) => g !== 'payslip_opens').sort()).toEqual(['bank', 'documents', 'ids', 'pay']);
    expect(asManager.sensitive).not.toHaveProperty('nationalId');
    expect(asManager.sensitive).not.toHaveProperty('accountNumber');
    expect(asManager.completeness).toBeNull();
    expect(asManager.actions.editJob).toBe(true); // onboarding

    await expect(m.employeesService.getFile(highwayManager, employeeId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.payService.view(townManager, employeeId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('reveal and opening pay write an audit row; the person’s own view does not', async () => {
    const count = () => m.prisma.auditEntry.count({ where: { companyId, subjectId: employeeId, category: 'SENSITIVE_VIEW' } });
    const before = await count();
    const revealed = await m.employeesService.reveal(hr, employeeId, 'nationalId');
    expect(revealed.value).toBe(nationalId);
    await m.payService.view(hr, employeeId);
    expect(await count()).toBe(before + 2);
    await expect(m.employeesService.reveal(townManager, employeeId, 'nationalId')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('an asked detail shows in the next steps with what was asked and the day', async () => {
    await m.employeesService.askForDetail(hr, employeeId, 'NSSF_SHA');
    const step = (await m.employeesService.getFile(hr, employeeId)).nextSteps.find((s) => s.code === 'FILE_REQUEST');
    expect(step).toMatchObject({ fileRequestKind: 'NSSF_SHA', fileRequestAskedOn: m.time.nairobiDateOf(new Date()) });
    expect(step?.fileRequestId).toBeTruthy();
  });

  it('a Branch Manager edits an onboarding file; after activation only HR can', async () => {
    await m.employeesService.update(townManager, employeeId, { personalEmail: 'joy@example.com' });
    await m.runPeopleScheduler(plus(1), at(plus(1))); // the start day arrives
    expect((await m.employeesService.getFile(hr, employeeId)).status).toBe('ACTIVE');
    await expect(m.employeesService.update(townManager, employeeId, { personalEmail: 'again@example.com' })).rejects.toMatchObject({ statusCode: 403, code: 'FILE_LOCKED_FOR_EDIT' });
    await expect(m.employeesService.update(townManager, employeeId, { nationalId: '1' })).rejects.toMatchObject({ statusCode: 403, code: 'FIELD_NOT_ALLOWED' });
    await m.employeesService.update(hr, employeeId, { personalEmail: 'joy2@example.com' });
  });

  it('a pay change waits for the Director; nobody approves their own; a future change is applied by the scheduler', async () => {
    const request = await m.payService.requestChange(hr, employeeId, { amount: raise, effectiveFrom: plus(3), reason: 'PROMOTION' }, at(today()));
    expect(request.status).toBe('PENDING');
    await expect(m.payService.requestChange(hr, employeeId, { amount: raise, effectiveFrom: plus(3), reason: 'PROMOTION' })).rejects.toMatchObject({ code: 'PAY_CHANGE_PENDING' });
    await expect(m.payService.decide(hr, request.id, { decision: 'APPROVE' })).rejects.toMatchObject({ statusCode: 403 });
    const decided = await m.payService.decide(director, request.id, { decision: 'APPROVE' });
    expect(decided.status).toBe('APPROVED');
    expect((await m.payService.viewQuiet(hr, employeeId)).amount).toBe(monthly); // not yet: it starts in three days
    expect(await m.payAmountOn(employeeId, plus(3))).toBe(raise);
    expect(await m.payAmountOn(employeeId, today())).toBeNull(); // the hire pay starts tomorrow
    expect(await m.payAmountOn(employeeId, plus(1))).toBe(monthly);
    expect(await m.payAmountOn(employeeId, plus(2))).toBe(monthly);
    await expect(m.payService.decide(director, request.id, { decision: 'APPROVE' })).rejects.toMatchObject({ code: 'PAY_CHANGE_NOT_PENDING' });

    const first = await m.runPeopleScheduler(plus(3), at(plus(3)));
    expect(first.find((r) => r.task === 'applyPayChanges')?.changed).toBe(1);
    expect((await m.payService.viewQuiet(hr, employeeId)).amount).toBe(raise);
    const second = await m.runPeopleScheduler(plus(3), at(plus(3)));
    expect(second.map((r) => r.changed)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('probation: a confirmation waits for the contract, then completes; extension is limited', async () => {
    await expect(m.lifecycleService.decideProbation(hr, employeeId, { decision: 'EXTEND', months: 99, reason: 'x' } as never)).rejects.toThrow();
    const confirmed = await m.lifecycleService.decideProbation(hr, employeeId, { decision: 'CONFIRM' });
    expect(confirmed).toMatchObject({ confirmationWaitingForContract: true, confirmedOn: null });
    await m.lifecycleService.createContract(hr, employeeId, { startsOn: today() });
    const file = await m.employeesService.getFile(hr, employeeId);
    expect(file.contractStatus).toBe('ACTIVE');
    expect(file.probation?.confirmedOn).not.toBeNull();
    await expect(m.lifecycleService.decideProbation(hr, employeeId, { decision: 'CONFIRM' })).rejects.toMatchObject({ code: 'NO_PROBATION' });
    await expect(m.lifecycleService.createContract(hr, employeeId, { startsOn: today() })).rejects.toMatchObject({ code: 'CONTRACT_EXISTS' });
  });

  it('a transfer is scheduled, previewed and applied by the scheduler, moving the login', async () => {
    const body = { toSiteId: highway.siteId, toDepartmentId: highway.serviceDept, startsOn: plus(5) };
    const preview = await m.lifecycleService.previewTransfer(hr, employeeId, body);
    expect(preview.effectiveOn).toBe(plus(5));
    const move = await m.lifecycleService.transfer(hr, employeeId, body, at(today()));
    expect(move.status).toBe('SCHEDULED');
    await expect(m.lifecycleService.transfer(hr, employeeId, body)).rejects.toMatchObject({ code: 'TRANSFER_SCHEDULED' });
    await expect(m.lifecycleService.transfer(townManager, employeeId, body)).rejects.toMatchObject({ statusCode: 403 });

    await m.runPeopleScheduler(plus(5), at(plus(5)));
    const file = await m.employeesService.getFile(hr, employeeId);
    expect(file.site.id).toBe(highway.siteId);
    const login = await m.prisma.user.findUniqueOrThrow({ where: { id: loginUserId }, select: { siteId: true } });
    expect(login.siteId).toBe(highway.siteId);
    expect(await m.prisma.staffTransfer.count({ where: { userId: loginUserId } })).toBe(1);
    const again = await m.runPeopleScheduler(plus(5), at(plus(5)));
    expect(again.map((r) => r.changed)).toEqual([0, 0, 0, 0, 0, 0]);
    // The person now belongs to Highway: the Town manager no longer sees the file.
    await expect(m.employeesService.getFile(townManager, employeeId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('sending to another site is a dated loan that ends by itself and can be cancelled', async () => {
    const loan = await m.lifecycleService.loan(hr, employeeId, { toSiteId: town.siteId, from: plus(6), until: plus(8) }, at(plus(5)));
    expect(loan.status).toBe('SCHEDULED');
    await m.runPeopleScheduler(plus(6), at(plus(6)));
    expect((await m.getActiveLoans(town.siteId, plus(7))).map((l) => l.employeeId)).toContain(employeeId);
    await m.runPeopleScheduler(plus(9), at(plus(9)));
    expect((await m.prisma.employeeMove.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe('DONE');

    const second = await m.lifecycleService.loan(hr, employeeId, { toSiteId: town.siteId, from: plus(20), until: null }, at(plus(9)));
    expect((await m.lifecycleService.cancelMove(hr, employeeId, second.id)).status).toBe('CANCELLED');
  });

  it('exit: a notice, then finalised by the scheduler (login stopped, contract ended); undo puts it back', async () => {
    const lastDay = plus(10);
    const file = await m.lifecycleService.exit(hr, employeeId, { lastDay, reason: 'RESIGNED', uniformReturned: false }, at(plus(9)));
    expect(file.status).toBe('NOTICE');
    await expect(m.lifecycleService.exit(hr, employeeId, { lastDay, reason: 'RESIGNED', uniformReturned: false })).rejects.toMatchObject({ code: 'ALREADY_EXITED' });
    await m.lifecycleService.updateExitChecklist(hr, employeeId, { uniformReturned: true });

    await m.runPeopleScheduler(plus(11), at(plus(11)));
    const exited = await m.employeesService.getFile(hr, employeeId);
    expect(exited.status).toBe('EXITED');
    expect(exited.contractStatus).toBe('ENDED');
    expect((await m.prisma.user.findUniqueOrThrow({ where: { id: loginUserId }, select: { isActive: true } })).isActive).toBe(false);
    expect(await m.prisma.refreshToken.count({ where: { userId: loginUserId } })).toBe(0);
    expect((await m.runPeopleScheduler(plus(11), at(plus(11)))).map((r) => r.changed)).toEqual([0, 0, 0, 0, 0, 0]);

    await expect(m.lifecycleService.rehire(hr, employeeId, { startsOn: plus(12) }, at(plus(11)))).rejects.toMatchObject({ code: 'UNDO_WINDOW_OPEN' });
    const undone = await m.lifecycleService.undoExit(hr, employeeId, at(plus(12)));
    expect(undone.status).toBe('ACTIVE');
    expect(undone.contractStatus).toBe('ACTIVE');
    expect((await m.prisma.user.findUniqueOrThrow({ where: { id: loginUserId }, select: { isActive: true } })).isActive).toBe(true);
  });

  it('after the undo window an exited person is rehired on the same file', async () => {
    const lastDay = plus(13);
    await m.lifecycleService.exit(hr, employeeId, { lastDay, reason: 'END_OF_CONTRACT', uniformReturned: true }, at(plus(12)));
    await m.runPeopleScheduler(plus(14), at(plus(14)));
    await expect(m.lifecycleService.undoExit(hr, employeeId, at(plus(21)))).rejects.toMatchObject({ code: 'UNDO_WINDOW_CLOSED' });
    const number = (await m.employeesService.getFile(hr, employeeId)).employeeNumber;
    const back = await m.lifecycleService.rehire(hr, employeeId, { startsOn: plus(30) }, at(plus(25)));
    expect(back.employeeNumber).toBe(number); // never a second file
    expect(back.status).toBe('ONBOARDING');
    expect(back.contractStatus).toBe('NONE');
    expect(await m.prisma.employmentSpell.count({ where: { employeeId } })).toBe(2);
    expect((await m.prisma.user.findUniqueOrThrow({ where: { id: loginUserId }, select: { isActive: true } })).isActive).toBe(true);
    expect((await m.getEmployee(loginUserId))?.employeeId).toBe(employeeId);
  });

  it('the audit chain links and no amount or ID number reached an entry', async () => {
    const entries = await m.auditRepository.listEntries(companyId, 0n, 100000);
    expect(m.verifyAuditChain(entries)).toMatchObject({ ok: true });
    const mine = entries.filter((e) => e.subjectId === employeeId || e.actorId === hr.id || e.actorId === director.id || e.subjectUserId === loginUserId).filter((e) => e.subjectType === 'Employee' || e.subjectType === 'PayChange');
    expect(mine.length).toBeGreaterThan(10);
    const text = JSON.stringify(mine.map((e) => [e.before, e.after, e.reason]));
    for (const secret of [nationalId, monthly, raise, '45500', '52750', '0123456789', 'temporary-pass-1']) expect(text).not.toContain(secret);
    const actions = new Set(mine.map((e) => e.action));
    for (const action of ['people.hired', 'people.login_created', 'people.pay_change_requested', 'people.pay_change_decided', 'people.pay_change_applied', 'people.transferred', 'people.transfer_applied', 'people.exit_recorded', 'people.exit_finalized', 'people.exit_undone', 'people.rehired']) {
      expect(actions, action).toContain(action);
    }
    expect(mine.filter((e) => e.action === 'people.transfer_applied' || e.action === 'people.exit_finalized').every((e) => e.channel === 'SYSTEM')).toBe(true);
  });
});
