/**
 * Workforce access change (21 Oct 2026): the per-role HTTP proof against the lane database.
 * The app is served inside this process (the same Express app and middleware the API runs) on a free port, so it always runs
 * the current code. It makes its own logins (a Director x2, a System Admin, HR, a Branch Manager, a Store Manager), never
 * touches a seeded person's PIN, walks one write in each area as the Director and as the System Admin, shows the Branch and
 * Store Manager and the self-approval refusals, then removes everything it made and ends by itself.
 * Usage: RATE_LIMIT_MAX=100000 pnpm exec tsx src/scripts/access-change-proof.ts up|down
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { app } from '../app';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { hashPassword, hashPin } from '../utils/password';
import { addDays, nairobiToday } from '../modules/workforce/_shared/time/nairobi-time';

const TAG = 'ZZ Proof Access';
const MAIL = (n: string): string => `zz.proof.access.${n}@wendo.test`;
const PASSWORD = 'password123';
const PIN = '4321';
const out = (line: string): void => void process.stdout.write(`${line}\n`);
let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (ok) passed += 1;
  else failed += 1;
  out(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   <- ${detail}`}`);
};

type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- the proof reads loose JSON
type Reply = { status: number; body: { data?: Body; error?: { code?: string; message?: string } } };
let base = '';
const tokens = new Map<string, string>();
const call = async (who: string, method: string, path: string, body?: object): Promise<Reply> => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  let parsed: Reply['body'] = {};
  try {
    parsed = (await res.json()) as Reply['body'];
  } catch {
    /* empty */
  }
  return { status: res.status, body: parsed };
};
const expectStatus = async (who: string, method: string, path: string, expected: number | number[], body?: object): Promise<Reply> => {
  const r = await call(who, method, path, body);
  const ok = (Array.isArray(expected) ? expected : [expected]).includes(r.status);
  check(`${who} ${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')} -> ${Array.isArray(expected) ? expected.join('/') : expected}`, ok, `got ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r;
};

async function down(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { startsWith: 'zz.proof.access.' }, NOT: { email: { startsWith: 'zz.proof.access.old.' } } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const employees = await prisma.employee.findMany({ where: { OR: [{ userId: { in: ids } }, { name: { startsWith: TAG } }] }, select: { id: true } });
  const eids = employees.map((e) => e.id);
  const depts = await prisma.department.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  await prisma.departmentHead.deleteMany({ where: { OR: [{ employeeId: { in: eids } }, { departmentId: { in: depts.map((d) => d.id) } }] } });
  await prisma.hrDocument.deleteMany({ where: { employeeId: { in: eids } } });
  await prisma.probationNote.deleteMany({ where: { employeeId: { in: eids } } });
  await prisma.fileRequest.deleteMany({ where: { employeeId: { in: eids } } });
  await prisma.employeeMove.deleteMany({ where: { employeeId: { in: eids } } });
  await prisma.payChange.deleteMany({ where: { employeeId: { in: eids } } });
  await prisma.payProfile.deleteMany({ where: { employeeId: { in: eids } } });
  await prisma.contract.deleteMany({ where: { employeeId: { in: eids } } });
  await prisma.employmentSpell.deleteMany({ where: { employeeId: { in: eids } } });
  await prisma.employee.deleteMany({ where: { id: { in: eids } } }).catch(() => undefined);
  await prisma.department.deleteMany({ where: { id: { in: depts.map((d) => d.id) } } }).catch(() => undefined);
  const hired = await prisma.user.findMany({ where: { email: { startsWith: 'zz.proof.access.login.' } }, select: { id: true } });
  const all = [...ids, ...hired.map((u) => u.id)];
  await prisma.workforceNotification.deleteMany({ where: { userId: { in: all } } });
  await prisma.workforcePinTry.deleteMany({ where: { userId: { in: all } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: all } } });
  // The audit log is append-only, so a person who wrote to it cannot be deleted: they stay, switched off, renamed.
  for (const u of await prisma.user.findMany({ where: { email: { startsWith: 'zz.proof.access.' }, NOT: { email: { startsWith: 'zz.proof.access.old.' } } }, select: { id: true } })) {
    const gone = await prisma.user.delete({ where: { id: u.id } }).then(() => true, () => false);
    if (!gone) await prisma.user.update({ where: { id: u.id }, data: { isActive: false, isTestUser: true, email: `zz.proof.access.old.${u.id}@wendo.test` } });
  }
  out('Proof data removed (test logins that wrote to the append-only audit log stay as inactive rows).');
}

async function up(): Promise<void> {
  if (!/_lane\d*(\?|$)/.test(process.env['DATABASE_URL'] ?? '') && !/_lane\d*_/.test(process.env['DATABASE_URL'] ?? '')) throw new Error('Refusing to run: DATABASE_URL is not a lane database.');
  await down();
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}${env.API_PREFIX}`;
  try {
    out('== 0. fixture');
    const town = await prisma.user.findUniqueOrThrow({ where: { email: 'bm.town@wendo.test' }, select: { siteId: true, site: { select: { companyId: true } } } });
    const dirSeed = await prisma.user.findUniqueOrThrow({ where: { email: 'director@wendo.test' }, select: { siteId: true } });
    const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true, companyId: town.site!.companyId }, select: { id: true } });
    const townId = town.siteId!;
    const companyId = town.site!.companyId;
    const pinHash = await hashPin(PIN);
    const passwordHash = await hashPassword(PASSWORD);
    const mk = (n: string, role: 'DIRECTOR' | 'SYSTEM_ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'STORE_MANAGER', siteId: string | null) =>
      prisma.user.create({ data: { id: randomUUID(), ...(siteId ? { siteId } : {}), name: `${TAG} ${n}`, email: MAIL(n), role, passwordHash, pinHash, isTestUser: true } });
    const d1 = await mk('d1', 'DIRECTOR', dirSeed.siteId);
    await mk('d2', 'DIRECTOR', dirSeed.siteId);
    await mk('sa', 'SYSTEM_ADMIN', null);
    await mk('hr', 'HR_MANAGER', null);
    await mk('bm', 'MANAGER', townId);
    await mk('sm', 'STORE_MANAGER', hub.id);
    // d1 has a file at the Central Store (a company-level person); two departments at Nyeri Town, each with a head.
    const person = (userId: string | null, name: string, siteId: string) =>
      prisma.employee.create({ data: { companyId, siteId, ...(userId ? { userId } : {}), employeeNumber: `ZZA-${randomUUID().slice(0, 8)}`, name: `${TAG} ${name}`, payType: 'MONTHLY_SALARY', startDate: new Date('2026-01-01'), status: 'ACTIVE' } });
    const d1File = await person(d1.id, 'd1 file', hub.id);
    const deptA = await prisma.department.create({ data: { siteId: townId, name: `${TAG} A` } });
    const deptB = await prisma.department.create({ data: { siteId: townId, name: `${TAG} B` } });
    const headA = await person(null, 'head A', townId);
    const headB = await person(null, 'head B', townId);
    await prisma.departmentHead.create({ data: { departmentId: deptA.id, employeeId: headA.id, startsOn: new Date('2026-01-01') } });
    await prisma.departmentHead.create({ data: { departmentId: deptB.id, employeeId: headB.id, startsOn: new Date('2026-01-01') } });
    const service = await prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'SERVICE' }, select: { id: true } });
    const waiter = await prisma.position.findFirstOrThrow({ where: { companyId, name: 'Waiter' }, select: { id: true } });
    for (const n of ['d1', 'd2', 'sa', 'hr', 'bm', 'sm']) {
      const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: MAIL(n), password: PASSWORD }) });
      const json = (await res.json()) as { data?: { accessToken?: string } };
      if (json.data?.accessToken) tokens.set(n, json.data.accessToken);
      check(`${n} signs in`, res.status === 200, `got ${res.status}`);
    }

    out('\n== 1. this is the new code (a stale server would still give the Director no rota.write)');
    const perms = await call('d1', 'GET', '/workforce/permissions/me');
    const grants = JSON.stringify(perms.body.data ?? {});
    check('the Director holds rota.write, payprofile.write and employee.lifecycle', ['rota.write', 'payprofile.write', 'employee.lifecycle'].every((c) => grants.includes(c)), grants.slice(0, 200));
    const saPerms = JSON.stringify((await call('sa', 'GET', '/workforce/permissions/me')).body.data ?? {});
    check('the System Admin holds payprofile.read, employee.read_sensitive and rules.edit.statutory', ['payprofile.read', 'employee.read_sensitive', 'rules.edit.statutory'].every((c) => saPerms.includes(c)), saPerms.slice(0, 200));
    check('the System Admin does not hold payroll.approve, payroll.pay or me.payslip', !['"payroll.approve"', '"payroll.pay"', '"me.payslip"'].some((c) => saPerms.includes(c)), saPerms.slice(0, 300));

    out('\n== 2. one write in each area, as the Director (d1) and as the System Admin (sa)');
    const today = nairobiToday(new Date());
    const hireBody = (n: string) => ({
      who: { name: `${TAG} hire ${n}`, phone: `07${Math.floor(Math.random() * 1e8)}`, nationalId: `97${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}` },
      job: { siteId: townId, departmentId: service.id, positionId: waiter.id, employment: 'MONTHLY_WITH_CONTRACT', startDate: addDays(today, 1) },
      pay: { amount: '41000.00', overtimeEligible: false },
      confirmDuplicatePhone: false,
    });
    const hired: Record<string, string> = {};
    for (const who of ['d1', 'sa']) {
      const r = await expectStatus(who, 'POST', '/workforce/people', [200, 201], hireBody(who));
      hired[who] = (r.body.data as Body | undefined)?.['employee']?.id ?? '';
    }
    for (const who of ['d1', 'sa']) {
      const r = await expectStatus(who, 'POST', `/workforce/people/${hired[who]}/pay-changes`, [200, 201], { amount: '43000.00', effectiveFrom: today, reason: 'ANNUAL_REVIEW', pin: PIN });
      const status = (r.body.data as Body | undefined)?.['status'];
      check(`${who}'s pay change: ${who === 'd1' ? 'applied at once (APPROVED)' : 'waits for a Director (PENDING)'}`, status === (who === 'd1' ? 'APPROVED' : 'PENDING'), `status ${String(status)}`);
    }
    const waiting = await prisma.payChange.findFirst({ where: { employeeId: hired['sa'], status: 'PENDING' }, select: { id: true } });
    out('\n== 3. self-approval and the second pair of eyes');
    await expectStatus('sa', 'POST', `/workforce/people/pay-changes/${waiting?.id ?? randomUUID()}/decision`, 403, { decision: 'APPROVE', pin: PIN });
    await expectStatus('d2', 'POST', `/workforce/people/pay-changes/${waiting?.id ?? randomUUID()}/decision`, [200, 201], { decision: 'APPROVE', pin: PIN });
    await expectStatus('d1', 'POST', `/workforce/people/${d1File.id}/pay-changes`, 403, { amount: '99000.00', effectiveFrom: today, reason: 'ANNUAL_REVIEW', pin: PIN });
    await expectStatus('d1', 'POST', `/workforce/people/${d1File.id}/exit`, 403, { lastDay: addDays(today, 20), reason: 'RESIGNED', uniformReturned: false });
    await expectStatus('hr', 'POST', `/workforce/people/${hired['d1']}/pay-changes`, [200, 201], { amount: '45000.00', effectiveFrom: today, reason: 'ANNUAL_REVIEW', pin: PIN });
    const hrChange = await prisma.payChange.findFirst({ where: { employeeId: hired['d1'], status: 'PENDING' }, select: { id: true } });
    await expectStatus('hr', 'POST', `/workforce/people/pay-changes/${hrChange?.id ?? randomUUID()}/decision`, 403, { decision: 'APPROVE', pin: PIN });
    await expectStatus('d1', 'POST', `/workforce/people/pay-changes/${hrChange?.id ?? randomUUID()}/decision`, [200, 201], { decision: 'APPROVE', pin: PIN });

    out('\n== 4. end a head');
    await expectStatus('d1', 'POST', `/workforce/org/departments/${deptA.id}/head/end`, [200, 201], { which: 'HEAD', reason: 'Proof of the access change' });
    await expectStatus('sa', 'POST', `/workforce/org/departments/${deptB.id}/head/end`, [200, 201], { which: 'HEAD', reason: 'Proof of the access change' });

    out('\n== 5. a Rules draft (written for a future day, withdrawn at the end)');
    // Leftovers of an earlier run that stopped half way: withdraw them first, newest first (a version can only be withdrawn when it is the latest).
    const left = await prisma.ruleVersion.findMany({ where: { reason: 'Proof of the access change', withdrawal: null }, orderBy: { version: 'desc' }, select: { id: true } });
    for (const v of left) await call('d1', 'POST', `/workforce/rules/versions/${v.id}/withdraw`, { reason: 'Leftover of the proof', pin: PIN });
    const versions: { who: string; id: string }[] = [];
    for (const [who, days, grace] of [['d1', 60, 7], ['sa', 61, 8]] as const) {
      const r = await expectStatus(who, 'POST', '/workforce/rules/LATENESS/versions', [200, 201], { siteId: null, effectiveFrom: addDays(today, days), values: { graceMinutes: grace }, reason: 'Proof of the access change', pin: PIN });
      const id = (r.body.data as Body | undefined)?.['version']?.id as string | undefined;
      if (id) versions.push({ who, id });
    }
    for (const v of [...versions].reverse()) await expectStatus(v.who, 'POST', `/workforce/rules/versions/${v.id}/withdraw`, [200, 201], { reason: 'Proof is over', pin: PIN });

    out('\n== 6. the Branch Manager and the Store Manager cannot reach the Director');
    for (const who of ['bm', 'sm']) {
      await expectStatus(who, 'GET', `/workforce/people/${d1File.id}`, [403, 404]);
      await expectStatus(who, 'POST', `/workforce/people/${d1File.id}/pay-changes`, [403, 404], { amount: '99000.00', effectiveFrom: today, reason: 'ANNUAL_REVIEW', pin: PIN });
      await expectStatus(who, 'POST', `/workforce/people/${d1File.id}/exit`, [403, 404], { lastDay: addDays(today, 20), reason: 'RESIGNED', uniformReturned: false });
      await expectStatus(who, 'PATCH', `/workforce/people/${d1File.id}`, [403, 404], { personalPhone: '0700000000' });
      await expectStatus(who, 'POST', '/workforce/rules/LATENESS/versions', 403, { siteId: null, effectiveFrom: addDays(today, 70), values: { graceMinutes: 9 }, reason: 'x', pin: PIN });
    }
    out(`\n${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await down();
  }
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('usage: access-change-proof.ts up|down')))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().finally(() => process.exit(process.exitCode ?? 0)));
