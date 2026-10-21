/**
 * Leave against a real database: ask and overlap, the same key twice, a double decision (409), approve with a slip number and an
 * idempotent repeat, a wrong PIN, cancel, carry-over once, adjust below zero and with a repeated key, a casual worker's empty answer,
 * the legacy carry run twice with the old tables unchanged, and the audit chain.
 *
 * Every call is made on a fixed day (NOW, early March 2026) so the dates never cross a leave year whenever the suite runs.
 * Runs only when DATABASE_URL names a lane database (same guard as rota-flow-db.test.ts). Needs the seeded lane data.
 * It removes the people and requests it makes; the balance ledger and the audit log are append-only by design, so their rows stay.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Leave flows in the database', () => {
  const tag = randomUUID().slice(0, 6);
  const PIN = '4321';
  const NOW = new Date('2026-03-02T09:00:00+03:00');
  type Mods = Awaited<ReturnType<typeof load>>;
  type Subject = import('../_shared/workforce-access').AccessSubject;
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const time = await import('../_shared/time/nairobi-time');
    const { hashPin } = await import('../../../utils/password');
    const { createAsk } = await import('./applications/ask-service');
    const { approveLeave } = await import('./applications/approve-service');
    const { declineLeave } = await import('./applications/decline-service');
    const { cancelLeave } = await import('./applications/cancel-service');
    const { adjustBalance } = await import('./balances/adjust-service');
    const { balancesOf } = await import('./balances/balance-service');
    const { balanceDrawer } = await import('./balances/balances-read-service');
    const { rulesToday } = await import('./balances/rules-loader');
    const { myOverview } = await import('./reads/mine-service');
    const { carryLegacyLeave } = await import('./carry/carry-service');
    const { peopleRepository } = await import('./data/people-repository');
    const { resolveActor } = await import('../people/people-context');
    const { auditRepository } = await import('../_shared/audit/audit-repository');
    const { verifyAuditChain } = await import('../_shared/audit/audit-hash');
    const { vi } = await import('vitest');
    const { eventsRepository } = await import('./data/events-repository');
    const { slipOf } = await import('./slip/slip-service');
    const { hashPrefixOf } = await import('../_shared/documents/qr-hash');
    const { checkDocument } = await import('../verify/verify-service');
    const { resetRateLimits } = await import('../_shared/limits/rate-limit');
    const { reconcileDocuments, registerDocuments } = await import('../documents');
    const docs = { slipOf, hashPrefixOf, checkDocument, resetRateLimits, reconcileDocuments, registerDocuments };
    return { vi, eventsRepository, docs, prisma, time, hashPin, createAsk, approveLeave, declineLeave, cancelLeave, adjustBalance, balancesOf, balanceDrawer, rulesToday, myOverview, carryLegacyLeave, peopleRepository, resolveActor, auditRepository, verifyAuditChain };
  };

  let m: Mods;
  let hr: Subject;
  let manager: Subject;
  let waiter: Subject;
  let casual: Subject;
  let companyId = '';
  let townId = '';
  const pinsBefore = new Map<string, string | null>();
  const userIds: string[] = [];
  const employeeIds: string[] = [];
  let waiterEmployee = '';
  let casualEmployee = '';
  let key = 0;
  const nextKey = (label: string) => `${label}-${tag}-${(key += 1)}-key`;
  const day = (offset: number) => m.time.addDays(m.time.nairobiToday(NOW), offset);
  const annualLeft = async (): Promise<number> => {
    const person = await m.peopleRepository.byUserId(waiter.id);
    const card = (await m.balancesOf(person!, 2026, NOW)).cards.find((c) => c.typeCode === 'ANNUAL');
    return card?.left ?? 0;
  };
  const askDays = (from: number, to: number, label: string) => m.createAsk(waiter, { typeCode: 'ANNUAL', start: day(from), end: day(to) }, nextKey(label), NOW);
  const approve = (id: string, version: number, k = nextKey('approve')) => m.approveLeave(manager, id, { pin: PIN, expectedVersion: version }, k, NOW);

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, pinHash: true, site: { select: { companyId: true } } } });
    const admin = await user('admin@wendo.test');
    const bmTown = await user('bm.town@wendo.test');
    for (const u of [admin, bmTown]) pinsBefore.set(u.id, u.pinHash);
    const pinHash = await m.hashPin(PIN);
    for (const u of [admin, bmTown]) await m.prisma.user.update({ where: { id: u.id }, data: { pinHash } });
    companyId = bmTown.site!.companyId;
    townId = bmTown.siteId!;
    hr = { id: admin.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    manager = { id: bmTown.id, role: 'MANAGER', siteId: townId, headOfDepartmentIds: [] };
    const service = await m.prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'SERVICE' }, select: { id: true } });
    for (const who of ['waiter', 'casual'] as const) {
      const login = await m.prisma.user.create({ data: { name: `ZZ Leave ${who} ${tag}`, email: `zz.leave.${who}.${tag}@wendo.test`, passwordHash: 'not-a-real-hash', role: 'WAITER', siteId: townId, isTestUser: true } });
      userIds.push(login.id);
      const employee = await m.prisma.employee.create({
        data: {
          companyId, siteId: townId, employeeNumber: `ZZL-${tag}-${who}`, name: login.name, userId: login.id, departmentId: service.id, startDate: m.time.toDateColumn('2024-01-08' as never), status: 'ACTIVE',
          payType: who === 'casual' ? 'DAILY_RATE' : 'MONTHLY_SALARY', contractStatus: who === 'casual' ? 'NONE' : 'ACTIVE',
        },
      });
      employeeIds.push(employee.id);
      if (who === 'waiter') {
        waiterEmployee = employee.id;
        waiter = { id: login.id, role: 'WAITER', siteId: townId, headOfDepartmentIds: [] };
        // The seeded lane Rules give Annual leave no days a year, so HR grants the days the way HR would: a signed adjustment.
        await m.adjustBalance(hr, { employeeId: employee.id, typeCode: 'ANNUAL', add: 21, reasonCode: 'DIRECTOR_GRANT', pin: PIN }, `setup-${tag}-grant`, NOW);
      } else {
        casualEmployee = employee.id;
        casual = { id: login.id, role: 'WAITER', siteId: townId, headOfDepartmentIds: [] };
      }
    }
  }, 60_000);

  afterAll(async () => {
    if (!m) return;
    const apps = await m.prisma.leaveApplication.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
    // The index rows these slips made go with them (the index has no append-only rule; the audit log and ledger do).
    await m.prisma.workforceDocument.deleteMany({ where: { companyId, kind: 'LVE', OR: apps.map((a) => ({ openHref: { contains: a.id } })) } });
    await m.prisma.leaveEvent.deleteMany({ where: { applicationId: { in: apps.map((a) => a.id) } } });
    await m.prisma.leaveApplication.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await m.prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
    // The audit log keeps the user ids; a login that cannot be deleted is switched off instead.
    for (const id of userIds) await m.prisma.user.delete({ where: { id } }).catch(() => m.prisma.user.update({ where: { id }, data: { isActive: false } }));
    for (const [id, pinHash] of pinsBefore) await m.prisma.user.update({ where: { id }, data: { pinHash } });
    await m.prisma.$disconnect();
  }, 60_000);

  it('a request is sent to the Branch Manager; the same key again is the same request; overlapping days are refused', async () => {
    const first = await askDays(20, 22, 'ask');
    expect(first.repeat).toBe(false);
    expect(first.application).toMatchObject({ status: 'WAITING', days: 3, typeCode: 'ANNUAL', stage: 'MANAGER', version: 1 });
    const k = nextKey('twice');
    const a = await m.createAsk(waiter, { typeCode: 'ANNUAL', start: day(40), end: day(40) }, k, NOW);
    const b = await m.createAsk(waiter, { typeCode: 'ANNUAL', start: day(40), end: day(40) }, k, NOW);
    expect(b.repeat).toBe(true);
    expect(b.application.id).toBe(a.application.id);
    await expect(askDays(22, 24, 'overlap')).rejects.toMatchObject({ statusCode: 409, code: 'OVERLAP' });
    expect(await m.prisma.leaveApplication.count({ where: { employeeId: waiterEmployee, startDate: m.time.toDateColumn(day(40)) } })).toBe(1);
  });

  it('two people deciding at once: one wins, the other gets 409; a later decision says who answered', async () => {
    const asked = await askDays(60, 61, 'race');
    const results = await Promise.allSettled([
      approve(asked.application.id, asked.application.version),
      m.declineLeave(manager, asked.application.id, { reasonCode: 'BUSY', expectedVersion: asked.application.version }, nextKey('decline'), NOW),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toMatchObject({ statusCode: 409 });
    expect(['ALREADY_DECIDED', 'STALE_REQUEST']).toContain((lost.reason as { code: string }).code);
    await expect(m.declineLeave(manager, asked.application.id, { reasonCode: 'BUSY', expectedVersion: asked.application.version }, nextKey('late'), NOW)).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_DECIDED' });
    expect(await m.prisma.leaveApplication.count({ where: { id: asked.application.id, status: { in: ['APPROVED', 'DECLINED'] } } })).toBe(1);
  });

  it('approve numbers the slip once; the same key again returns the first result; the days come off the balance', async () => {
    const before = await annualLeft();
    const asked = await askDays(80, 82, 'approve');
    const k = nextKey('approve-once');
    const done = await approve(asked.application.id, asked.application.version, k);
    expect(done).toMatchObject({ repeat: false, application: { status: 'APPROVED' } });
    expect(done.slipNumber).toBeGreaterThan(0);
    expect(done.slipCode).toMatch(/^LVE-\d{4,}$/);
    const again = await approve(asked.application.id, asked.application.version, k);
    expect(again).toMatchObject({ repeat: true, slipNumber: done.slipNumber });
    expect(await m.prisma.leaveApplication.count({ where: { slipNumber: done.slipNumber } })).toBe(1);
    expect(await annualLeft()).toBe(before - 3);
  });

  it('a wrong PIN signs nothing: the request stays waiting', async () => {
    const asked = await askDays(120, 120, 'wrong-pin');
    await expect(m.approveLeave(manager, asked.application.id, { pin: '0000', expectedVersion: asked.application.version }, nextKey('wrong'), NOW)).rejects.toMatchObject({ statusCode: 403 });
    expect(await m.prisma.leaveApplication.findUniqueOrThrow({ where: { id: asked.application.id }, select: { status: true, slipNumber: true } })).toEqual({ status: 'WAITING', slipNumber: null });
  });

  it('a person cancels their own approved leave before it starts; the days come back', async () => {
    const asked = await askDays(100, 101, 'cancel');
    await approve(asked.application.id, asked.application.version);
    const withIt = await annualLeft();
    const cancelled = await m.cancelLeave(waiter, asked.application.id, {}, nextKey('cancel'), NOW);
    expect(cancelled.application.status).toBe('CANCELLED');
    expect(await annualLeft()).toBe(withIt + 2);
  });

  describe('the Signed documents index', () => {
    const who = () => ({ address: `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, deviceLabel: null });
    const rowOf = async (applicationId: string) => m.prisma.workforceDocument.findFirstOrThrow({ where: { companyId, kind: 'LVE', openHref: { contains: applicationId } } });

    it('approve indexes the slip in its own transaction; the QR carries the index hash; nothing private reaches the row; the public page says genuine', async () => {
      const { checkDocument, resetRateLimits, slipOf, hashPrefixOf } = m.docs;
      resetRateLimits();
      const asked = await askDays(140, 142, 'index');
      const done = await approve(asked.application.id, asked.application.version);
      const row = await rowOf(asked.application.id);
      expect(row).toMatchObject({ number: done.slipCode, version: 1, title: 'Leave slip', status: 'CURRENT', subjectUserId: waiter.id, signedByRole: 'Branch Manager', method: 'PIN' });
      const stored = await m.prisma.leaveApplication.findUniqueOrThrow({ where: { id: asked.application.id }, select: { slipHash: true } });
      expect(row.hash).toBe(stored.slipHash);
      expect(row.hashPrefix).toBe(hashPrefixOf(stored.slipHash as string));
      expect((await slipOf(manager, asked.application.id)).qrUrl).toBe(`${(await import('../../../config/env')).env.FRONTEND_ORIGIN.replace(/\/$/, '')}/verify/lve/${done.slipCode}?h=${row.hashPrefix}`);
      expect(row.about).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} to [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/);
      expect(`${row.title} ${row.about} ${row.searchText}`).not.toMatch(/annual|sick|balance|\bdays?\b|\d+\.\d{2}/i);
      const verdict = await checkDocument('lve', done.slipCode, row.hashPrefix, who());
      expect(verdict.answer).toMatchObject({ outcome: 'GENUINE', number: done.slipCode, signedByRole: 'Branch Manager' });
      expect(JSON.stringify(verdict.answer)).not.toContain('ZZ Leave');
      expect((await checkDocument('lve', 'LVE-999999', row.hashPrefix, who())).answer.outcome).toBe('NOT_VERIFIED');
    });

    it('a failure after the door call rolls the index row back with the slip', async () => {
      const asked = await askDays(150, 150, 'rollback');
      const spy = m.vi.spyOn(m.eventsRepository, 'add').mockRejectedValueOnce(new Error('the issuer failed after registering'));
      await expect(approve(asked.application.id, asked.application.version)).rejects.toThrow('the issuer failed');
      spy.mockRestore();
      expect(await m.prisma.workforceDocument.count({ where: { companyId, openHref: { contains: asked.application.id } } })).toBe(0);
      expect(await m.prisma.leaveApplication.findUniqueOrThrow({ where: { id: asked.application.id }, select: { status: true, slipNumber: true } })).toEqual({ status: 'WAITING', slipNumber: null });
    });

    it('cancelling a slip keeps its number and the verify page reads it as voided', async () => {
      const { checkDocument, resetRateLimits } = m.docs;
      resetRateLimits();
      const asked = await askDays(160, 161, 'void');
      const done = await approve(asked.application.id, asked.application.version);
      const hash = (await rowOf(asked.application.id)).hashPrefix;
      await m.cancelLeave(waiter, asked.application.id, {}, nextKey('void'), NOW);
      const row = await rowOf(asked.application.id);
      expect(row).toMatchObject({ number: done.slipCode, status: 'WITHDRAWN' });
      expect(row.withdrawnAt).not.toBeNull();
      const verdict = await checkDocument('lve', done.slipCode, hash, who());
      expect(verdict.answer.outcome).toBe('WITHDRAWN');
      expect(verdict.answer.withdrawnByRole).toBeTruthy();
    });

    it('the reconciliation indexes slips issued before the wiring, voided ones as withdrawn, and a second run adds nothing', async () => {
      const { reconcileDocuments, registerDocuments } = m.docs;
      registerDocuments();
      const slips = await m.prisma.leaveApplication.findMany({ where: { employeeId: waiterEmployee, slipNumber: { not: null } }, select: { id: true, status: true, slipNumber: true } });
      expect(slips.some((s) => s.status === 'CANCELLED') && slips.some((s) => s.status === 'APPROVED')).toBe(true);
      const mine = { companyId, kind: 'LVE', OR: slips.map((s) => ({ openHref: { contains: s.id } })) };
      const before = await m.prisma.workforceDocument.findMany({ where: mine, select: { number: true, hash: true, status: true } });
      await m.prisma.workforceDocument.deleteMany({ where: mine });
      const first = await reconcileDocuments(companyId);
      expect(first.failed).toBe(0);
      expect(first.registered).toBeGreaterThanOrEqual(slips.length);
      const rebuilt = await m.prisma.workforceDocument.findMany({ where: mine, select: { number: true, hash: true, status: true } });
      const order = (a: { number: string }, b: { number: string }) => a.number.localeCompare(b.number);
      expect(rebuilt.sort(order)).toEqual(before.sort(order));
      expect(rebuilt.some((r) => r.status === 'WITHDRAWN')).toBe(true);
      const second = await reconcileDocuments(companyId);
      expect(second.registered).toBe(0);
      expect(await m.prisma.workforceDocument.count({ where: mine })).toBe(slips.length);
    });
  });

  it('carry-over is written once per type, however often the new year is read', async () => {
    const person = (await m.peopleRepository.byUserId(waiter.id))!;
    const rules = await m.rulesToday(townId, NOW);
    const lines = () => m.prisma.leaveBalanceEntry.findMany({ where: { employeeId: waiterEmployee, kind: 'CARRY_OVER', leaveYear: 2027 } });
    await m.balancesOf(person, 2027, NOW);
    const first = await lines();
    await m.balancesOf(person, 2027, NOW);
    await Promise.all([m.balancesOf(person, 2027, NOW), m.balancesOf(person, 2027, NOW)]);
    const second = await lines();
    expect(second.map((l) => l.id).sort()).toEqual(first.map((l) => l.id).sort());
    expect(second.length).toBeLessThanOrEqual(rules.leaveTypes.filter((t) => t.carryOverDays > 0).length);
    expect(new Set(second.map((l) => l.typeCode)).size).toBe(second.length);
  });

  it('adjusting a balance needs a PIN and a reason, cannot go below zero, and a repeated key adjusts once', async () => {
    const left = await annualLeft();
    // HR can pick a kind of leave to adjust even when the person has no days yet (no card): the drawer lists every adjustable type.
    expect((await m.balanceDrawer(hr, waiterEmployee, undefined, NOW)).adjustable).toEqual(expect.arrayContaining([{ code: 'ANNUAL', label: 'Annual leave' }]));
    await expect(m.adjustBalance(hr, { employeeId: waiterEmployee, typeCode: 'ANNUAL', add: -(left + 1), reasonCode: 'CORRECTION', pin: PIN }, nextKey('below'), NOW)).rejects.toMatchObject({ statusCode: 409, code: 'BALANCE_BELOW_ZERO' });
    await expect(m.adjustBalance(hr, { employeeId: waiterEmployee, typeCode: 'ANNUAL', add: 2, reasonCode: 'CORRECTION', pin: '0000' }, nextKey('pin'), NOW)).rejects.toMatchObject({ statusCode: 403 });
    expect(await annualLeft()).toBe(left);
    const k = nextKey('adjust');
    const done = await m.adjustBalance(hr, { employeeId: waiterEmployee, typeCode: 'ANNUAL', add: 2, reasonCode: 'DIRECTOR_GRANT', pin: PIN, expectedNow: left }, k, NOW);
    expect(done).toMatchObject({ before: left, after: left + 2, repeat: false });
    const repeat = await m.adjustBalance(hr, { employeeId: waiterEmployee, typeCode: 'ANNUAL', add: 2, reasonCode: 'DIRECTOR_GRANT', pin: PIN }, k, NOW);
    expect(repeat.repeat).toBe(true);
    expect(await annualLeft()).toBe(left + 2);
    expect(await m.prisma.leaveBalanceEntry.count({ where: { employeeId: waiterEmployee, kind: 'ADJUSTMENT', idempotencyKey: k } })).toBe(1);
    // Who may adjust is the route's `requireCapability('leave.balance_adjust')`; the per-role HTTP proof (leave-proof.ts) shows the 403.
  }, 30_000); // three real bcrypt checks and the drawer read: about 2.5 s alone, over the 5 s default when the whole suite runs

  it('a casual worker gets an empty, well-formed answer, a calm refusal to send, and no adjustment', async () => {
    const overview = await m.myOverview(casual, undefined, NOW);
    expect(overview).toMatchObject({ casual: true, onPolicy: true, cards: [], chips: [], headline: null, message: 'Leave starts when your contract starts.' });
    await expect(m.createAsk(casual, { typeCode: 'ANNUAL', start: day(20), end: day(21) }, nextKey('casual'), NOW)).rejects.toMatchObject({ statusCode: 409 });
    await expect(m.adjustBalance(hr, { employeeId: casualEmployee, typeCode: 'ANNUAL', add: 1, reasonCode: 'CORRECTION', pin: PIN }, nextKey('casual-adj'), NOW)).rejects.toMatchObject({ statusCode: 409, code: 'CASUAL_NO_LEAVE' });
    expect(await m.prisma.leaveApplication.count({ where: { employeeId: casualEmployee } })).toBe(0);
  });

  it('the legacy carry run twice copies nothing the second time and leaves the old leave tables as they were', async () => {
    const old = async () => ({ requests: await m.prisma.leaveRequest.count(), balances: await m.prisma.leaveBalance.count(), acks: await m.prisma.leaveRequestAcknowledgement.count() });
    const before = await old();
    const actor = (await m.resolveActor(hr)).auditActor;
    const rollback = new Error('roll back the carry');
    let second: { requests: number; updated: number; openings: number } | null = null;
    await m.prisma
      .$transaction(async (tx) => {
        await m.carryLegacyLeave(tx, townId, companyId, actor, new Date());
        second = await m.carryLegacyLeave(tx, townId, companyId, actor, new Date());
        throw rollback;
      })
      .catch((error: unknown) => {
        if (error !== rollback) throw error;
      });
    expect(second).toMatchObject({ requests: 0, updated: 0, openings: 0 });
    expect(await old()).toEqual(before);
  });

  it('every leave entry is on the audit log, in a chain that verifies, and none carries a PIN', async () => {
    const entries = await m.auditRepository.listEntries(companyId, 0n, 100000);
    expect(m.verifyAuditChain(entries)).toMatchObject({ ok: true });
    const mine = entries.filter((e) => e.action.startsWith('leave.') && JSON.stringify(e, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)).includes(waiter.id));
    const actions = new Set(mine.map((e) => e.action));
    for (const action of ['leave.requested', 'leave.approved', 'leave.cancelled', 'leave.balance_adjusted']) expect(actions.has(action)).toBe(true);
    expect(JSON.stringify(mine, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(`"pin"`);
  });
});
