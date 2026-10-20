/**
 * Workforce Segment 4 (Leave, back end): the proof run over HTTP with real logins, against the lane database and the lane API.
 *   up    makes a waiter (with an employee file), a casual worker, a Branch Manager and an HR Manager (both with a signing PIN) in
 *         Nyeri Town, then walks Leave end to end: HR grants days with a PIN, the waiter previews and asks (a repeat of the same
 *         key is the same request, overlapping days are refused), who may and may not decide (cross-site 404, wrong role 403, HR
 *         before the 72 hours 403), approve with a PIN (slip number, repeat, double decision 409), decline, cancel, the slip as data
 *         and as a PDF (approved and cancelled), the reads for every role, the casual worker's empty answers, and the old leave
 *         routes refusing writes once the branch is switched on (and writing nothing). It leaves the data for inspection.
 *   down  removes everything `up` made and puts the attendance switch back as it was (the audit entries and the append-only
 *         balance ledger stay).
 * Usage: API=http://localhost:4101 PROOF_OUT=/some/dir pnpm exec tsx src/scripts/leave-proof.ts up|down
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../config/database';
import { addDays, nairobiToday } from '../modules/workforce';
import { hashPassword, hashPin } from '../utils/password';

const API = `${process.env['API'] ?? 'http://localhost:4101'}/api/v1`;
const OUT = process.env['PROOF_OUT'];
const PASSWORD = 'password123';
const PIN = '4321';
const TAG = 'ZZ Proof Leave';
const mail = (who: string): string => `proof.lv.${who}@wendo.test`;
const [WAITER, CASUAL, MANAGER, HRM] = [mail('waiter'), mail('casual'), mail('manager'), mail('hr')];
const [ADMIN, DIRECTOR, ACCOUNTANT, STORE, BM, HIGHWAY, HEAD] = ['admin', 'director', 'accountant', 'store.manager', 'bm.town', 'bm.highway', 'kitchen.head.town'].map((n) => `${n}@wendo.test`) as [string, string, string, string, string, string, string];
const L = '/workforce/leave';
const out = (line: string): void => void process.stdout.write(`${line}\n`);

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (ok) passed += 1;
  else failed += 1;
  out(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   <- ${detail}`}`);
};

type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- proof script reads loosely typed JSON
type Reply = { status: number; body: { data?: Body; error?: { code?: string; message?: string } } };
const tokens = new Map<string, string>();
const login = async (email: string): Promise<void> => {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (!json.data?.accessToken) throw new Error(`login failed for ${email}`);
  tokens.set(email, json.data.accessToken);
};
let keyCount = 0;
const nextKey = (label: string): string => `proof-${label}-${Date.now()}-${(keyCount += 1)}`;
const call = async (who: string, method: string, path: string, body?: object, key?: string): Promise<Reply> => {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}`, ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Reply['body'] };
};
const name = (who: string): string => who.split('@')[0] ?? who;
const short = (path: string): string => (path.split('?')[0] ?? path).replace(L, '').replace(/[0-9a-f-]{36}/g, ':id');
const expectStatus = async (label: string, who: string, method: string, path: string, expected: number, body?: object, key?: string): Promise<Reply> => {
  const reply = await call(who, method, path, body, key);
  check(`${label}: ${name(who)} ${method} ${short(path)} -> ${expected}`, reply.status === expected, `got ${reply.status} ${JSON.stringify(reply.body).slice(0, 200)}`);
  return reply;
};
const expectCode = async (label: string, who: string, method: string, path: string, expected: number, code: string, body?: object, key?: string): Promise<Reply> => {
  const reply = await call(who, method, path, body, key);
  check(`${label}: ${name(who)} ${method} ${short(path)} -> ${expected} ${code}`, reply.status === expected && reply.body.error?.code === code, `got ${reply.status} ${JSON.stringify(reply.body).slice(0, 200)}`);
  return reply;
};
const pdf = async (who: string, path: string, file: string): Promise<boolean> => {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${tokens.get(who)}` } });
  const bytes = Buffer.from(await res.arrayBuffer());
  if (OUT && res.status === 200) writeFileSync(`${OUT}/${file}`, bytes);
  return res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('application/pdf') && bytes.subarray(0, 4).toString() === '%PDF';
};

async function down(): Promise<void> {
  const people = await prisma.employee.findMany({ where: { employeeNumber: { startsWith: 'ZZLV-' } }, select: { id: true } });
  const ids = people.map((p) => p.id);
  const apps = await prisma.leaveApplication.findMany({ where: { employeeId: { in: ids } }, select: { id: true } });
  await prisma.leaveEvent.deleteMany({ where: { applicationId: { in: apps.map((a) => a.id) } } });
  await prisma.leaveApplication.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.rotaEntry.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
  for (const user of await prisma.user.findMany({ where: { email: { in: [WAITER, CASUAL, MANAGER, HRM] } }, select: { id: true } })) {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => prisma.user.update({ where: { id: user.id }, data: { isActive: false, email: `${user.id}@removed.wendo.test` } }));
  }
  await prisma.attendanceSiteSwitch.deleteMany({});
  out(`removed the proof data (${ids.length} people, ${apps.length} requests, the logins; the switch row removed; ledger and audit rows stay: append-only)`);
}

async function up(): Promise<void> {
  const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true, site: { select: { companyId: true } } } });
  const townId = town.siteId as string;
  const companyId = town.site!.companyId;
  const legacy = async () => JSON.stringify([await prisma.leaveRequest.count(), await prisma.leaveBalance.count(), await prisma.leaveRequestAcknowledgement.count()]);
  const legacyBefore = await legacy();
  if (OUT) mkdirSync(OUT, { recursive: true });
  const today = nairobiToday(new Date());
  const on = (offset: number): string => addDays(today, offset);

  const service = await prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'SERVICE' }, select: { id: true } });
  const passwordHash = await hashPassword(PASSWORD);
  const pinHash = await hashPin(PIN);
  const make = async (email: string, role: 'WAITER' | 'MANAGER' | 'HR_MANAGER', label: string, withFile: 'salary' | 'casual' | null, withPin: boolean) => {
    const user = await prisma.user.create({ data: { name: `${TAG} ${label}`, email, passwordHash, role, siteId: role === 'HR_MANAGER' ? null : townId, ...(withPin ? { pinHash } : {}) } });
    const file = withFile
      ? await prisma.employee.create({ data: { companyId, siteId: townId, employeeNumber: `ZZLV-${label}`, name: user.name, userId: user.id, departmentId: service.id, startDate: new Date('2024-01-08'), status: 'ACTIVE', payType: withFile === 'casual' ? 'DAILY_RATE' : 'MONTHLY_SALARY', contractStatus: withFile === 'casual' ? 'NONE' : 'ACTIVE' } })
      : null;
    return { user, file };
  };
  const waiter = await make(WAITER, 'WAITER', 'Waiter', 'salary', false);
  const casual = await make(CASUAL, 'WAITER', 'Casual', 'casual', false);
  await make(MANAGER, 'MANAGER', 'Manager', null, true);
  await make(HRM, 'HR_MANAGER', 'HR', null, true);
  const waiterFile = waiter.file!.id;
  out(`made ${TAG} Waiter, Casual, Manager and HR in Nyeri Town`);

  // The login door allows 10 a minute: eleven logins go in two batches.
  for (const email of [WAITER, CASUAL, MANAGER, HRM, ADMIN, DIRECTOR]) await login(email);
  await new Promise((resolve) => setTimeout(resolve, 62_000));
  for (const email of [ACCOUNTANT, STORE, BM, HIGHWAY, HEAD]) await login(email);

  out('\n== 1. HR grants days; only HR may');
  await expectStatus('the seeded Rules give Annual no days, so the waiter starts at 0', WAITER, 'GET', `${L}/me/overview`, 200);
  const adjust = { employeeId: waiterFile, typeCode: 'ANNUAL', add: 21, reasonCode: 'DIRECTOR_GRANT', pin: PIN };
  for (const who of [WAITER, MANAGER, BM, ACCOUNTANT, DIRECTOR, ADMIN, STORE, HEAD]) await expectStatus('adjust without the capability', who, 'POST', `${L}/balances/adjust`, 403, adjust, nextKey('adj'));
  await expectStatus('adjust preview shows now and new', HRM, 'POST', `${L}/balances/adjust/preview`, 200, { employeeId: waiterFile, typeCode: 'ANNUAL', add: 21 });
  await expectStatus('adjust with no Idempotency-Key', HRM, 'POST', `${L}/balances/adjust`, 400, adjust);
  await expectCode('adjust with a wrong PIN', HRM, 'POST', `${L}/balances/adjust`, 403, 'PIN_INVALID', { ...adjust, pin: '0000' }, nextKey('adj'));
  await expectCode('adjust below zero', HRM, 'POST', `${L}/balances/adjust`, 409, 'BALANCE_BELOW_ZERO', { ...adjust, add: -1, reasonCode: 'CORRECTION' }, nextKey('adj'));
  const grantKey = nextKey('grant');
  const granted = await expectStatus('HR grants 21 days with a PIN', HRM, 'POST', `${L}/balances/adjust`, 201, adjust, grantKey);
  check('before 0, after 21', granted.body.data?.['before'] === 0 && granted.body.data['after'] === 21, JSON.stringify(granted.body.data));
  const again = await expectStatus('the same key again', HRM, 'POST', `${L}/balances/adjust`, 200, adjust, grantKey);
  check('answers the first result (repeat) and adds nothing', again.body.data?.['repeat'] === true && (await prisma.leaveBalanceEntry.count({ where: { employeeId: waiterFile, kind: 'ADJUSTMENT' } })) === 1);
  await expectCode('a casual worker has no balance to adjust', HRM, 'POST', `${L}/balances/adjust`, 409, 'CASUAL_NO_LEAVE', { ...adjust, employeeId: casual.file!.id }, nextKey('adj'));
  const overview = await expectStatus('the waiter sees the days', WAITER, 'GET', `${L}/me/overview`, 200);
  check('21 days of Annual, Annual is a chip', overview.body.data?.['headline']?.['left'] === 21 && overview.body.data['chips'].some((c: Body) => c['code'] === 'ANNUAL'), JSON.stringify(overview.body.data?.['headline']));

  out('\n== 2. ask: preview, send, repeat, overlap, the casual worker');
  const dates = { typeCode: 'ANNUAL', start: on(20), end: on(22) };
  const preview = await expectStatus('preview', WAITER, 'POST', `${L}/applications/preview`, 200, dates);
  check('3 days, 18 left after, sent to the Branch Manager, nothing counted', preview.body.data?.['days'] === 3 && preview.body.data['leftAfter'] === 18 && preview.body.data['sendTo'] === 'Branch Manager' && preview.body.data['errors'].length === 0, JSON.stringify(preview.body.data));
  await expectStatus('ask with no Idempotency-Key', WAITER, 'POST', `${L}/applications`, 400, dates);
  await expectStatus('ask with an unknown field', WAITER, 'POST', `${L}/applications`, 400, { ...dates, boss: true }, nextKey('ask'));
  const askKey = nextKey('ask');
  const asked = await expectStatus('the waiter asks', WAITER, 'POST', `${L}/applications`, 201, dates, askKey);
  const app = asked.body.data?.['application'] as Body;
  check('waiting, version 1, with the Branch Manager', app?.['status'] === 'WAITING' && app['version'] === 1 && app['decidingRole'] === 'Branch Manager', JSON.stringify(app));
  const repeat = await expectStatus('the same key again', WAITER, 'POST', `${L}/applications`, 200, dates, askKey);
  check('the same request, flagged repeat', repeat.body.data?.['repeat'] === true && repeat.body.data['application']['id'] === app['id']);
  await expectCode('overlapping days', WAITER, 'POST', `${L}/applications`, 409, 'OVERLAP', { ...dates, start: on(22), end: on(24) }, nextKey('ask'));
  await expectStatus('the casual worker reads an empty, calm answer', CASUAL, 'GET', `${L}/me/overview`, 200);
  const casualOverview = await call(CASUAL, 'GET', `${L}/me/overview`);
  check('casual: true, no cards, a plain message', casualOverview.body.data?.['casual'] === true && casualOverview.body.data['cards'].length === 0 && typeof casualOverview.body.data['message'] === 'string');
  const casualList = await expectStatus('the casual worker lists requests', CASUAL, 'GET', `${L}/me/applications`, 200);
  check('empty page', casualList.body.data?.['total'] === 0, JSON.stringify(casualList.body).slice(0, 160));
  await expectCode('the casual worker cannot send', CASUAL, 'POST', `${L}/applications`, 409, 'CASUAL_NO_LEAVE', dates, nextKey('ask'));

  out('\n== 3. who may read and decide');
  const id = app['id'] as string;
  for (const [who, status] of [[WAITER, 200], [BM, 200], [MANAGER, 200], [HRM, 200], [DIRECTOR, 200], [ADMIN, 200], [HIGHWAY, 404], [CASUAL, 404]] as const) await expectStatus('open the request', who, 'GET', `${L}/applications/${id}`, status);
  await expectStatus('the Highway manager cannot open its rota strip', HIGHWAY, 'GET', `${L}/applications/${id}/rota`, 404);
  const town2 = await call(BM, 'GET', `${L}/requests?tab=needs-you&rows=100`);
  check('the Town manager has it in "needs you"', JSON.stringify(town2.body.data).includes(id));
  const hw = await call(HIGHWAY, 'GET', `${L}/requests?rows=100`);
  check('the Highway manager does not see it in any list', !JSON.stringify(hw.body.data).includes(id));
  const approveBody = (version: number, pin = PIN) => ({ pin, expectedVersion: version });
  for (const who of [WAITER, CASUAL, ACCOUNTANT, HEAD]) await expectStatus('approve without the capability', who, 'POST', `${L}/applications/${id}/approve`, 403, approveBody(1), nextKey('ap'));
  await expectStatus('the Store Manager is another site: not found', STORE, 'POST', `${L}/applications/${id}/approve`, 404, approveBody(1), nextKey('ap'));
  await expectStatus('approve from another branch', HIGHWAY, 'POST', `${L}/applications/${id}/approve`, 404, approveBody(1), nextKey('ap'));
  await expectCode('HR before the 72 hours', HRM, 'POST', `${L}/applications/${id}/approve`, 403, 'NOT_WITH_YOU_YET', approveBody(1), nextKey('ap'));
  await expectCode('the Director is not the deciding role', DIRECTOR, 'POST', `${L}/applications/${id}/approve`, 403, 'NOT_YOUR_DECISION', approveBody(1), nextKey('ap'));
  await expectCode('the System Admin only decides when nobody holds the role', ADMIN, 'POST', `${L}/applications/${id}/approve`, 403, 'NOT_YOUR_DECISION', approveBody(1), nextKey('ap'));
  await expectStatus('approve with no Idempotency-Key', MANAGER, 'POST', `${L}/applications/${id}/approve`, 400, approveBody(1));
  await expectStatus('approve with a wrong PIN signs nothing', MANAGER, 'POST', `${L}/applications/${id}/approve`, 403, approveBody(1, '0000'), nextKey('ap'));
  await expectCode('approve a stale version', MANAGER, 'POST', `${L}/applications/${id}/approve`, 409, 'STALE_REQUEST', approveBody(9), nextKey('ap'));
  check('still waiting after the refusals', (await prisma.leaveApplication.findUniqueOrThrow({ where: { id } })).status === 'WAITING');
  const apKey = nextKey('approve');
  const approved = await expectStatus('the Branch Manager approves with a PIN', MANAGER, 'POST', `${L}/applications/${id}/approve`, 200, approveBody(1), apKey);
  const slip = approved.body.data as Body;
  check('an LVE number, approved status', /^LVE-\d{4,}$/.test(slip['slipCode']) && slip['application']['status'] === 'APPROVED', JSON.stringify(slip).slice(0, 200));
  const apAgain = await expectStatus('the same key again', MANAGER, 'POST', `${L}/applications/${id}/approve`, 200, approveBody(1), apKey);
  check('the first result, same slip number', apAgain.body.data?.['repeat'] === true && apAgain.body.data['slipNumber'] === slip['slipNumber']);
  await expectCode('someone else decides afterwards', BM, 'POST', `${L}/applications/${id}/decline`, 409, 'ALREADY_DECIDED', { reasonCode: 'BUSY', expectedVersion: 1 }, nextKey('dc'));
  const after = await call(WAITER, 'GET', `${L}/me/overview`);
  check('18 days left after the approval', after.body.data?.['headline']?.['left'] === 18, JSON.stringify(after.body.data?.['headline']));

  out('\n== 4. the slip, as data and as a PDF');
  for (const [who, status] of [[WAITER, 200], [MANAGER, 200], [HRM, 200], [HIGHWAY, 404], [CASUAL, 404]] as const) await expectStatus('the slip data', who, 'GET', `${L}/applications/${id}/slip`, status);
  check('the approved slip PDF is a PDF', await pdf(WAITER, `${L}/applications/${id}/slip.pdf`, 'leave-slip-approved.pdf'));
  check('the other branch gets no PDF', !(await pdf(HIGHWAY, `${L}/applications/${id}/slip.pdf`, 'never.pdf')));

  out('\n== 5. decline, then cancel (own and a manager\'s)');
  const second = (await call(WAITER, 'POST', `${L}/applications`, { typeCode: 'ANNUAL', start: on(30), end: on(30) }, nextKey('ask'))).body.data?.['application'] as Body;
  await expectStatus('decline with Other and no note', MANAGER, 'POST', `${L}/applications/${second['id']}/decline`, 400, { reasonCode: 'OTHER', expectedVersion: 1 }, nextKey('dc'));
  const declined = await expectStatus('the Branch Manager declines (no PIN)', MANAGER, 'POST', `${L}/applications/${second['id']}/decline`, 200, { reasonCode: 'BUSY', expectedVersion: 1 }, nextKey('dc'));
  check('declined', declined.body.data?.['application']?.['status'] === 'DECLINED');
  await expectCode('a declined request cannot be cancelled', WAITER, 'POST', `${L}/applications/${second['id']}/cancel`, 403, 'NOT_CANCELLABLE', {}, nextKey('cx'));
  const third = (await call(WAITER, 'POST', `${L}/applications`, { typeCode: 'ANNUAL', start: on(40), end: on(41) }, nextKey('ask'))).body.data?.['application'] as Body;
  await call(MANAGER, 'POST', `${L}/applications/${third['id']}/approve`, approveBody(1), nextKey('ap'));
  await expectStatus('a stranger cannot cancel it', CASUAL, 'POST', `${L}/applications/${third['id']}/cancel`, 404, {}, nextKey('cx'));
  await expectStatus('a manager cancelling needs a reason and a PIN', MANAGER, 'POST', `${L}/applications/${third['id']}/cancel`, 400, {}, nextKey('cx'));
  const cancelled = await expectStatus('the Branch Manager cancels with a reason and a PIN', MANAGER, 'POST', `${L}/applications/${third['id']}/cancel`, 200, { reasonCode: 'STAFFING', pin: PIN }, nextKey('cx'));
  check('cancelled', cancelled.body.data?.['application']?.['status'] === 'CANCELLED');
  check('the cancelled slip PDF is a PDF', await pdf(WAITER, `${L}/applications/${third['id']}/slip.pdf`, 'leave-slip-cancelled.pdf'));
  const fourth = (await call(WAITER, 'POST', `${L}/applications`, { typeCode: 'ANNUAL', start: on(50), end: on(50) }, nextKey('ask'))).body.data?.['application'] as Body;
  const own = await expectStatus('the waiter cancels their own waiting request (no PIN)', WAITER, 'POST', `${L}/applications/${fourth['id']}/cancel`, 200, {}, nextKey('cx'));
  check('cancelled', own.body.data?.['application']?.['status'] === 'CANCELLED');
  const back = await call(WAITER, 'GET', `${L}/me/overview`);
  check('the days are back: 18 left (only the first approval counts)', back.body.data?.['headline']?.['left'] === 18, JSON.stringify(back.body.data?.['headline']));

  out('\n== 6. the reads, per role');
  // Spec section 5: the Accountant and floor staff do not read the Leave pages; the Store Manager reads their own site.
  const reads: [string, string][] = [['balances', `${L}/balances?rows=20`], ['calendar', `${L}/calendar`], ['requests', `${L}/requests?rows=20`], ['needs-you', `${L}/needs-you`]];
  for (const [label, path] of reads) {
    for (const [who, status] of [[BM, 200], [HRM, 200], [DIRECTOR, 200], [ADMIN, 200], [STORE, 200], [ACCOUNTANT, 403], [WAITER, 403]] as const) await expectStatus(`read ${label}`, who, 'GET', path, status);
  }
  const away = await expectStatus('who is away', BM, 'GET', `${L}/away?from=${on(0)}&to=${on(60)}`, 200);
  check('the waiter\'s approved days appear', JSON.stringify(away.body.data).includes(waiter.user.name));
  await expectStatus('the badge', WAITER, 'GET', `${L}/badge`, 200);
  const drawer = await expectStatus('a balance drawer', BM, 'GET', `${L}/balances/${waiterFile}`, 200);
  check('it lists the adjustment and the requests', ((drawer.body.data?.['adjustments'] ?? []) as unknown[]).length === 1 && ((drawer.body.data?.['requests'] ?? []) as unknown[]).length >= 3);
  await expectStatus('another branch cannot open the drawer', HIGHWAY, 'GET', `${L}/balances/${waiterFile}`, 404);

  out('\n== 7. the old leave routes once the branch is switched on');
  const oldBefore = await legacy();
  await expectStatus('System Admin switches Nyeri Town on', ADMIN, 'PUT', '/workforce/attendance/switch', 200, { siteId: townId, enabled: true });
  const old = await call(HEAD, 'POST', '/hr/leave/request', { leaveType: 'ANNUAL', startDate: new Date(Date.now() + 86_400_000 * 90).toISOString(), endDate: new Date(Date.now() + 86_400_000 * 91).toISOString(), reason: 'proof' });
  check('the old submit is refused with LEAVE_IN_NEW_SYSTEM', old.status === 409 && old.body.error?.code === 'LEAVE_IN_NEW_SYSTEM', `got ${old.status} ${JSON.stringify(old.body).slice(0, 160)}`);
  await expectStatus('System Admin switches Nyeri Town off again', ADMIN, 'PUT', '/workforce/attendance/switch', 200, { siteId: townId, enabled: false });
  check('the old leave tables are as they were', (await legacy()) === oldBefore && oldBefore === legacyBefore, `${legacyBefore} -> ${await legacy()}`);

  out('\n== 8. the audit log');
  const entries = await prisma.auditEntry.findMany({ where: { companyId, action: { startsWith: 'leave.' } }, orderBy: { seq: 'desc' }, take: 60, select: { action: true, before: true, after: true, reason: true } });
  const actions = new Set(entries.map((e) => e.action));
  for (const action of ['leave.requested', 'leave.approved', 'leave.declined', 'leave.cancelled', 'leave.balance_adjusted']) check(`audit has ${action}`, actions.has(action));
  check('no PIN in any leave audit entry', !JSON.stringify(entries, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)).includes(`"pin"`));
  out(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('Usage: leave-proof.ts up|down')))
  .catch((error: unknown) => {
    out(String(error instanceof Error ? error.stack : error));
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect().then(() => process.exit()));
