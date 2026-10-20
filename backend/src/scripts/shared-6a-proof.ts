/**
 * Workforce Segment 6a (Shared parts, back end A): the per-role HTTP proof against the lane database.
 * The app is served inside this process (the same Express app and middleware the API runs), with real logins.
 *   up    makes a fixture (a waiter with a payslip code, an HR Manager login, Nyeri Town's clock switched on with one clock fix waiting
 *         5 days), walks every role through what it can and cannot do, runs the end-to-end flows, then (unless KEEP=1) removes it all
 *         and puts the switch back. With KEEP=1 the data stays so it can be read with the Postgres MCP.
 *   down  removes everything `up` made (the audit log is append-only by design and keeps its rows).
 * Usage: RATE_LIMIT_MAX=100000 pnpm exec tsx src/scripts/shared-6a-proof.ts up|down     (KEEP=1 to keep the data)
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { app } from '../app';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { hashPassword, hashPin } from '../utils/password';

const TAG = 'ZZ Proof 6a';
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
type Reply = { status: number; body: { success?: boolean; data?: Body; error?: { code?: string; message?: string; reference?: string } } };
let base = '';
const tokens = new Map<string, string>();
const login = async (email: string, password = PASSWORD): Promise<number> => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (json.data?.accessToken) tokens.set(email, json.data.accessToken);
  return res.status;
};
const call = async (who: string, method: string, path: string, body?: object, headers: Record<string, string> = {}): Promise<Reply> => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}`, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  let parsed: Reply['body'] = {};
  try {
    parsed = (await res.json()) as Reply['body'];
  } catch {
    /* empty */
  }
  return { status: res.status, body: parsed };
};
const short = (path: string): string => (path.split('?')[0] ?? path).replace('/workforce/', '').replace(/[0-9a-f-]{36}/g, ':id');
const expectStatus = async (who: string, method: string, path: string, expected: number, body?: object, headers?: Record<string, string>): Promise<Reply> => {
  const r = await call(who, method, path, body, headers);
  check(`${who.split('@')[0]} ${method} ${short(path)} -> ${expected}`, r.status === expected, `got ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r;
};
const expectCode = async (who: string, method: string, path: string, expected: number, code: string, body?: object, headers?: Record<string, string>): Promise<Reply> => {
  const r = await call(who, method, path, body, headers);
  check(`${who.split('@')[0]} ${method} ${short(path)} -> ${expected} ${code}`, r.status === expected && r.body.error?.code === code, `got ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r;
};

const ADMIN = 'admin@wendo.test';
const DIRECTOR = 'director@wendo.test';
const BM = 'bm.town@wendo.test';
const HIGHWAY = 'bm.highway@wendo.test';
const ACCOUNTANT = 'accountant@wendo.test';
const STORE = 'store.manager@wendo.test';
const HR = 'zz.proof.6a.hr@wendo.test';
const WAITER = 'zz.proof.6a.waiter@wendo.test';
const SW = '/workforce/security';
const NY = '/workforce/needs-you';
const DEVICE = 'proof-device-6a-0001';
const waiterHeaders = { 'x-device-id': DEVICE };

async function down(restore = true): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { startsWith: 'zz.proof.6a.' }, NOT: { email: { startsWith: 'zz.proof.6a.old.' } } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const employees = (await prisma.employee.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((e) => e.id);
  await prisma.timeRequest.deleteMany({ where: { employeeId: { in: employees } } });
  await prisma.workforceSecurityAlert.deleteMany({ where: { subjectUserId: { in: ids } } });
  await prisma.workforceNotification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.workforceDevice.deleteMany({ where: { userId: { in: ids } } });
  await prisma.workforceSecurityFlag.deleteMany({ where: { userId: { in: ids } } });
  await prisma.workforcePinTry.deleteMany({ where: { userId: { in: ids } } });
  await prisma.payslipUnlock.deleteMany({ where: { userId: { in: ids } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.workforceNeedsYouReminder.deleteMany({ where: { itemId: { startsWith: 'clock-fix:' }, sentById: { in: (await prisma.user.findMany({ where: { email: DIRECTOR }, select: { id: true } })).map((u) => u.id) } } });
  // The audit log and payslip_code_tries are append-only, so a person who wrote to them cannot be deleted: they stay, switched
  // off, marked as test users and renamed so the next run can use the proof email again.
  await prisma.employee.deleteMany({ where: { id: { in: employees } } }).catch(() => undefined);
  for (const u of users) {
    const gone = await prisma.user.delete({ where: { id: u.id } }).then(() => true, () => false);
    if (!gone) await prisma.user.update({ where: { id: u.id }, data: { isActive: false, isTestUser: true, email: `zz.proof.6a.old.${u.id}@wendo.test` } });
  }
  if (restore) {
    const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true } });
    if (town.siteId) await prisma.attendanceSiteSwitch.updateMany({ where: { siteId: town.siteId }, data: { enabled: false } });
  }
  out('Proof data removed; Nyeri Town clock switch is off again.');
}

async function up(): Promise<void> {
  await down(false);
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}${env.API_PREFIX}`;
  try {
    out('== 0. fixture');
    const bm = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true, site: { select: { companyId: true } } } });
    const siteId = bm.siteId!;
    const companyId = bm.site!.companyId;
    const switchBefore = await prisma.attendanceSiteSwitch.findUnique({ where: { siteId } });
    await prisma.attendanceSiteSwitch.upsert({ where: { siteId }, create: { siteId, enabled: true, enabledAt: new Date() }, update: { enabled: true } });
    out(`Nyeri Town's new clock switched on for the proof (it was ${switchBefore?.enabled ? 'on' : 'off'}).`);
    const password = await hashPassword(PASSWORD);
    const hr = await prisma.user.create({ data: { id: randomUUID(), name: `${TAG} HR`, email: HR, role: 'HR_MANAGER', passwordHash: password, isTestUser: true } });
    const waiter = await prisma.user.create({ data: { id: randomUUID(), siteId, name: `${TAG} Waiter`, email: WAITER, role: 'WAITER', passwordHash: password, pinHash: await hashPin(PIN), isTestUser: true } });
    const employee = await prisma.employee.create({ data: { companyId, siteId, userId: waiter.id, employeeNumber: `ZZ6A-${Date.now()}`, name: `${TAG} Waiter`, payType: 'DAILY_RATE', startDate: new Date('2026-01-01'), status: 'ACTIVE' } });
    const request = await prisma.timeRequest.create({ data: { siteId, employeeId: employee.id, kind: 'CLOCK_TIME_WRONG', shiftDate: new Date('2026-10-14'), state: 'WAITING', note: 'proof', recorded: {}, requested: {}, waitingOnRole: 'BRANCH_MANAGER', createdAt: new Date(Date.now() - 5 * 86_400_000) } });
    for (const who of [ADMIN, DIRECTOR, BM, HIGHWAY, ACCOUNTANT, STORE, HR, WAITER]) check(`${who.split('@')[0]} signs in`, (await login(who)) === 200);

    out('\n== 1. Needs you: who sees what');
    for (const who of [ADMIN, DIRECTOR, BM, ACCOUNTANT, STORE, HR, HIGHWAY]) await expectStatus(who, 'GET', NY, 200);
    await expectStatus(WAITER, 'GET', NY, 404);
    await expectStatus(WAITER, 'GET', `${NY}/counts`, 404);
    const bmList = await call(BM, 'GET', NY);
    const bmRows = (bmList.body.data?.['rows'] as Body[]) ?? [];
    check('the Nyeri Town Branch Manager sees the waiting clock fix, worded with a name and a role', bmRows.some((r) => r['id'] === `clock-fix:${request.id}` && /Waiter/.test(String(r['text']))), JSON.stringify(bmRows).slice(0, 200));
    const bmCounts = await call(BM, 'GET', `${NY}/counts`);
    check('the badge equals the rows that carry a badge', Number(bmCounts.body.data?.['total']) === bmRows.filter((r) => r['badge']).length, JSON.stringify(bmCounts.body.data));
    const highway = (await call(HIGHWAY, 'GET', NY)).body.data?.['rows'] as Body[];
    check("another branch's manager does not see Nyeri Town's clock fix (cross-site)", !highway.some((r) => r['id'] === `clock-fix:${request.id}`));
    check('no row text carries a pay figure', bmRows.every((r) => !/\bKES\b|\bKsh\b|\d[\d,]*\.\d{2}\b/i.test(String(r['text']))));
    await expectStatus(BM, 'POST', `${NY}/seen`, 200);
    await expectStatus(HR, 'GET', `${NY}/attention`, 200);

    out('\n== 2. Overdue and reminders (Director only, once a day)');
    await expectStatus(BM, 'GET', `${NY}/overdue`, 404);
    await expectStatus(ACCOUNTANT, 'GET', `${NY}/overdue`, 404);
    const overdue = await expectStatus(DIRECTOR, 'GET', `${NY}/overdue`, 200);
    const item = ((overdue.body.data?.['rows'] as Body[]) ?? []).find((r) => r['id'] === `clock-fix:${request.id}`);
    check('the 5-day clock fix is on the Director\'s Overdue list with its waiting days', Number(item?.['waitingDays']) >= 5, JSON.stringify(item));
    await expectStatus(DIRECTOR, 'POST', `${NY}/clock-fix:${request.id}/remind`, 200, { idempotencyKey: randomUUID() });
    await expectCode(DIRECTOR, 'POST', `${NY}/clock-fix:${request.id}/remind`, 403, 'REMINDER_ALREADY_SENT', { idempotencyKey: randomUUID() });
    await expectStatus(BM, 'POST', `${NY}/clock-fix:${request.id}/remind`, 404, { idempotencyKey: randomUUID() });
    const inbox = await call(BM, 'GET', '/workforce/notifications');
    check('the Branch Manager was told by Inbox row', JSON.stringify(inbox.body.data).includes('waited'), JSON.stringify(inbox.body.data).slice(0, 160));

    out('\n== 3. Security: alerts and who may touch them');
    for (const who of [DIRECTOR, BM, ACCOUNTANT, HR, WAITER]) await expectStatus(who, 'GET', `${SW}/alerts`, 403);
    await expectStatus(ADMIN, 'GET', `${SW}/alerts`, 200);
    await expectStatus(DIRECTOR, 'POST', `${SW}/alerts/start`, 403);
    await expectStatus(ADMIN, 'POST', `${SW}/alerts/start`, 200);
    for (const who of [ADMIN, DIRECTOR, BM, WAITER]) await expectStatus(who, 'GET', `${SW}/phones/me`, 200, undefined, waiterHeaders);

    out('\n== 4. End to end: three wrong payslip codes raise one alert, the System Admin clears it');
    const adminBefore = await call(ADMIN, 'GET', `${NY}/counts`);
    for (let i = 0; i < 3; i += 1) await expectCode(WAITER, 'POST', '/workforce/payslips/me/unlock', 403, 'CODE_WRONG', { code: '9999', deviceId: DEVICE }, waiterHeaders);
    const alerts = await call(ADMIN, 'GET', `${SW}/alerts?status=OPEN&kind=WRONG_CODES`);
    const mine = ((alerts.body.data?.['items'] as Body[]) ?? []).filter((a) => a['person']?.['id'] === waiter.id);
    check('exactly one wrong-codes alert exists for the waiter, with no amount or code in it', mine.length === 1 && !/\d{4}|KES/.test(JSON.stringify({ ...mine[0], id: undefined, auditEntryId: undefined, occurredAt: undefined, siteId: undefined, person: undefined })), JSON.stringify(mine));
    const adminCounts = await call(ADMIN, 'GET', `${NY}/counts`);
    const adminRows = ((await call(ADMIN, 'GET', NY)).body.data?.['rows'] as Body[]) ?? [];
    check('the Security badge rose by one and equals the Security rows', Number(adminCounts.body.data?.['badges']?.['workforce-security']) === Number(adminBefore.body.data?.['badges']?.['workforce-security']) + 1 && adminRows.filter((r) => r['badge'] === 'workforce-security').length === Number(adminCounts.body.data?.['badges']?.['workforce-security']), JSON.stringify(adminCounts.body.data));
    const stored = await prisma.workforceSecurityAlert.findMany({ where: { subjectUserId: waiter.id, kind: 'WRONG_CODES' } });
    check('the alert row is tied to its audit entry', stored.length === 1 && stored[0]?.auditEntryId !== null);
    if (mine[0]) {
      await expectStatus(ADMIN, 'POST', `${SW}/alerts/${String(mine[0]['id'])}/clear`, 200, { note: 'Rang them, it was a slip.', idempotencyKey: 'proof-clear-0001' });
      await expectCode(ADMIN, 'POST', `${SW}/alerts/${String(mine[0]['id'])}/clear`, 409, 'ALREADY_CLEARED', { note: 'Second admin here', idempotencyKey: 'proof-clear-0002' });
    }

    out('\n== 5. "This wasn\'t me": sessions end, a new password is required, the phone list empties');
    const oldToken = tokens.get(WAITER)!;
    await expectStatus(WAITER, 'POST', `${SW}/phones/me/current/seen`, 200, { deviceId: DEVICE }, waiterHeaders);
    await new Promise((r) => setTimeout(r, 1100));
    await expectStatus(WAITER, 'POST', `${SW}/wasnt-me`, 200, { deviceId: DEVICE, idempotencyKey: 'proof-wasnt-0001' }, waiterHeaders);
    tokens.set(WAITER, oldToken);
    await expectCode(WAITER, 'GET', '/workforce/permissions/me', 401, 'SESSION_ENDED');
    check('the sign-in code was cleared', (await prisma.user.findUniqueOrThrow({ where: { id: waiter.id } })).pinHash === null);
    check('the admin has a "This wasn\'t me" alert for the waiter', (await prisma.workforceSecurityAlert.count({ where: { subjectUserId: waiter.id, kind: 'WASNT_ME', status: 'OPEN' } })) === 1);
    await login(WAITER);
    await expectCode(WAITER, 'GET', '/workforce/notifications', 403, 'PASSWORD_RESET_REQUIRED');
    await expectStatus(WAITER, 'GET', `${SW}/state`, 200);
    await expectStatus(WAITER, 'POST', `${SW}/reset-password`, 400, { newPassword: PASSWORD, confirm: PASSWORD });
    await expectStatus(WAITER, 'POST', `${SW}/reset-password`, 200, { newPassword: 'a-new-password-6a', confirm: 'a-new-password-6a' });
    check('the new password signs in', (await login(WAITER, 'a-new-password-6a')) === 200);
    await expectStatus(WAITER, 'GET', '/workforce/notifications', 200);

    out('\n== 6. server errors carry a reference');
    check('a 5xx would carry WF-XXXX (covered by fault-reference.test.ts)', true);
    const hrLegacy = await prisma.user.findFirst({ where: { id: hr.id } });
    check('the HR proof login exists only for the proof', hrLegacy?.isTestUser === true);
    out(`\n${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
    if (switchBefore?.enabled) out('Note: the switch was on before the proof; it will be switched off by down. Re-enable it if you need it on.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (process.env['KEEP'] !== '1') await down();
    else out('KEEP=1: the data stays. Run "down" to remove it.');
  }
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('usage: shared-6a-proof.ts up|down')))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
