/**
 * Workforce slice 3: the proof run over HTTP with the real seeded logins, against the lane database and the lane API.
 *   up    makes a waiter, a "not in" colleague and a short shift, checks every role against the access table, then walks one
 *         day end to end (switch on, late clock-in, undo, board, clock for someone, the shift-end prompt, a fix, switch off,
 *         the legacy clock answering again, the audit chain, the legacy tables unchanged). It leaves the data for inspection.
 *   down  removes everything `up` made (the audit entries stay: the log is append-only).
 * Usage: API=http://localhost:4102 pnpm exec tsx src/scripts/attendance-proof.ts up|down
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { auditRepository } from '../modules/workforce/_shared/audit/audit-repository';
import { verifyAuditChain } from '../modules/workforce/_shared/audit/audit-hash';
import { addDays, instantAt, nairobiToday, parseClockTime, toDateColumn, weekStart } from '../modules/workforce/_shared/time/nairobi-time';
import { hashPassword } from '../utils/password';

const API = `${process.env['API'] ?? 'http://localhost:4102'}/api/v1`;
const TAG = 'ZZ Proof Att';
const WAITER_EMAIL = 'proof.waiter@wendo.test';
const PASSWORD = 'password123';
const out = (line: string): void => void process.stdout.write(`${line}\n`);

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (ok) passed += 1;
  else failed += 1;
  out(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   <- ${detail}`}`);
};

type Reply = { status: number; body: { success?: boolean; data?: Record<string, unknown>; error?: { code?: string } } };
const tokens = new Map<string, string>();
const login = async (email: string): Promise<void> => {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (!json.data?.accessToken) throw new Error(`login failed for ${email}`);
  tokens.set(email, json.data.accessToken);
};
const call = async (who: string, method: string, path: string, body?: object): Promise<Reply> => {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Reply['body'] };
};
const expectStatus = async (label: string, who: string, method: string, path: string, expected: number, body?: object): Promise<Reply> => {
  const reply = await call(who, method, path, body);
  check(`${label}: ${who.split('@')[0]} ${method} ${(path.split('?')[0] ?? path).replace('/workforce/attendance', '')} -> ${expected}`, reply.status === expected, `got ${reply.status} ${JSON.stringify(reply.body).slice(0, 160)}`);
  return reply;
};

const HR = 'hr@wendo.test';
const BM = 'bm.town@wendo.test';
const STORE = 'store.manager@wendo.test';
const DIRECTOR = 'director@wendo.test';
const ACCOUNTANT = 'accountant@wendo.test';
const HEAD = 'kitchen.head.town@wendo.test';
const ADMIN = 'admin@wendo.test';
const A = '/workforce/attendance';
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function down(): Promise<void> {
  const people = await prisma.employee.findMany({ where: { employeeNumber: { startsWith: 'ZZP-' } }, select: { id: true } });
  const chefEmp = await prisma.employee.findFirst({ where: { user: { email: HEAD } }, select: { id: true } });
  const ids = [...people.map((p) => p.id), ...(chefEmp ? [chefEmp.id] : [])];
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('workforce.allow_clock_edits', 'on', true)`; // the events table is append-only; this is the dev teardown door
    await tx.clockEvent.deleteMany({ where: { employeeId: { in: ids } } });
  });
  await prisma.shiftEndAnswer.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.rotaEntry.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.rotaWeek.deleteMany({ where: { carriedFromLegacy: false, entries: { none: {} } } });
  await prisma.shiftTemplate.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.attendanceSiteSwitch.deleteMany({});
  await prisma.employee.deleteMany({ where: { employeeNumber: { startsWith: 'ZZP-' } } });
  await prisma.user.deleteMany({ where: { email: WAITER_EMAIL } });
  out(`removed the proof data (${ids.length} people's clock events, rota rows, shift, switch row, waiter login)`);
}

async function up(): Promise<void> {
  const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true, site: { select: { companyId: true, latitude: true, longitude: true } } } });
  const townId = town.siteId as string;
  const pos = { latitude: Number(town.site?.latitude), longitude: Number(town.site?.longitude) };
  const legacy = async () => JSON.stringify([await prisma.shift.count(), await prisma.shiftAssignment.count(), await prisma.clockRecord.count()]);
  const legacyBefore = await legacy();

  const nowMin = ((): number => {
    const n = new Date(Date.now() + 3 * 3_600_000);
    return n.getUTCHours() * 60 + n.getUTCMinutes();
  })();
  if (nowMin < 40 || nowMin > 1380) throw new Error('Run the proof between 00:40 and 23:00 Nairobi time (the shift must sit inside one day)');
  const hhmm = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const [startAt, endAt] = [hhmm(nowMin - 25), hhmm(nowMin + 3)];

  const today = nairobiToday(new Date());
  const service = await prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'SERVICE' } });
  const chefEmp = await prisma.employee.findFirstOrThrow({ where: { user: { email: HEAD } } });
  const waiterUser = await prisma.user.create({ data: { name: `${TAG} Waiter`, email: WAITER_EMAIL, passwordHash: await hashPassword(PASSWORD), role: 'WAITER', siteId: townId } });
  const mk = (n: number, name: string, userId: string | null) =>
    prisma.employee.create({ data: { companyId: town.site!.companyId, siteId: townId, employeeNumber: `ZZP-${n}`, name: `${TAG} ${name}`, departmentId: service.id, payType: 'MONTHLY_SALARY', startDate: toDateColumn(addDays(today, -30)), status: 'ACTIVE', tracksTime: true, userId } });
  const waiter = await mk(1, 'Waiter', waiterUser.id);
  const lena = await mk(2, 'Lena', null);
  const template = await prisma.shiftTemplate.create({ data: { companyId: town.site!.companyId, siteId: townId, name: `${TAG} Shift`, colour: 'BLUE', startTime: startAt, endTime: endAt, unpaidBreakMinutes: 0 } });
  for (const [emp, dept] of [[waiter, service.id], [lena, service.id], [chefEmp, chefEmp.departmentId as string]] as const) {
    const weekOn = { siteId: townId, departmentId: dept, weekStart: toDateColumn(weekStart(today, 1)) };
    const week = (await prisma.rotaWeek.findFirst({ where: weekOn, select: { id: true } })) ?? (await prisma.rotaWeek.create({ data: weekOn, select: { id: true } }));
    await prisma.rotaEntry.create({ data: { weekId: week.id, siteId: townId, employeeId: emp.id, date: toDateColumn(today), templateId: template.id } });
  }
  out(`shift ${startAt}-${endAt} Nairobi today, ${today}; waiter, Lena (no login) and the Kitchen head are on it`);
  for (const email of [HR, BM, STORE, DIRECTOR, ACCOUNTANT, HEAD, WAITER_EMAIL, ADMIN]) await login(email);

  out('\n== 1. who may do what (switch still off)');
  const loose = { latitude: pos.latitude, longitude: pos.longitude };
  for (const [who, status] of [[WAITER_EMAIL, 200], [HEAD, 200], [ACCOUNTANT, 200], [HR, 403], [BM, 403], [DIRECTOR, 403], [STORE, 403]] as const) await expectStatus('my day', who, 'GET', `${A}/me`, status);
  for (const [who, status] of [[BM, 200], [HR, 200], [DIRECTOR, 200], [HEAD, 200], [STORE, 404], [ACCOUNTANT, 403], [WAITER_EMAIL, 403]] as const) await expectStatus('board', who, 'GET', `${A}/board?siteId=${townId}`, status);
  const range = `siteId=${townId}&from=${today}&to=${today}`;
  for (const [who, status] of [[ACCOUNTANT, 200], [BM, 200], [HR, 200], [DIRECTOR, 200], [HEAD, 200], [STORE, 404], [WAITER_EMAIL, 403]] as const) await expectStatus('lateness', who, 'GET', `${A}/lateness?${range}`, status);
  for (const [who, status] of [[BM, 200], [HR, 200], [ACCOUNTANT, 200], [STORE, 404], [HEAD, 404], [WAITER_EMAIL, 403]] as const) await expectStatus('a person\'s day', who, 'GET', `${A}/day?employeeId=${lena.id}&date=${today}`, status);
  const fix = { employeeId: lena.id, date: today, action: 'ADD', type: 'OUT', at: new Date().toISOString(), reason: 'Proof run' };
  for (const [who, status] of [[BM, 409], [HR, 409], [STORE, 404], [DIRECTOR, 403], [HEAD, 403], [WAITER_EMAIL, 403], [ACCOUNTANT, 403]] as const) await expectStatus('fix time (off site)', who, 'POST', `${A}/fixes/preview`, status, fix);
  for (const who of [BM, HR, HEAD, WAITER_EMAIL, ACCOUNTANT, STORE]) await expectStatus('switch', who, 'PUT', `${A}/switch`, 403, { siteId: townId, enabled: true });
  await expectStatus('new clock before the switch', WAITER_EMAIL, 'POST', `${A}/clock-in`, 409, { clientEventId: 'proof-before-switch', ...loose });

  out('\n== 2. switch on, then the day');
  const refused = (reply: Reply): boolean => reply.status === 409 && JSON.stringify(reply.body).includes('CLOCK_MOVED_TO_NEW_ATTENDANCE');
  const legacyBody = { shiftAssignmentId: '00000000-0000-0000-0000-000000000000', ...loose };
  const legacyClockBefore = await call(WAITER_EMAIL, 'POST', '/clock/in', legacyBody);
  check('legacy clock reachable with the switch off (answers its own error, not the refusal)', !refused(legacyClockBefore), JSON.stringify(legacyClockBefore.body));
  const on = await expectStatus('Director switches Nyeri Town on', DIRECTOR, 'PUT', `${A}/switch`, 200, { siteId: townId, enabled: true });
  check('the switch reads on', on.body.data?.['enabled'] === true);
  const legacyClockAfter = await call(WAITER_EMAIL, 'POST', '/clock/in', legacyBody);
  check('legacy clock answers a clear refusal for this site', refused(legacyClockAfter), JSON.stringify(legacyClockAfter.body));

  const first = await expectStatus('waiter clocks in 25 minutes late', WAITER_EMAIL, 'POST', `${A}/clock-in`, 201, { clientEventId: 'proof-waiter-in-1', ...loose });
  const lateness = first.body.data?.['lateness'] as { minutesLate: number; countsAsLate: boolean } | undefined;
  check('lateness: 25 minutes (26 if the minute turned), counts after the 5-minute grace', (lateness?.minutesLate ?? 0) >= 25 && (lateness?.minutesLate ?? 0) <= 26 && lateness?.countsAsLate === true, JSON.stringify(lateness));
  const retry = await expectStatus('the same tap again (a retry)', WAITER_EMAIL, 'POST', `${A}/clock-in`, 200, { clientEventId: 'proof-waiter-in-1', ...loose });
  check('retry made no second event', retry.body.data?.['replayed'] === true);
  const mine = await call(WAITER_EMAIL, 'GET', `${A}/me`);
  check('my day: on shift with Undo', (mine.body.data?.['current'] as { state?: string; undo?: unknown } | undefined)?.state === 'ON_SHIFT' && !!(mine.body.data?.['current'] as { undo?: unknown }).undo, JSON.stringify(mine.body.data?.['current']));
  await expectStatus('undo inside the window', WAITER_EMAIL, 'POST', `${A}/undo`, 200, { clientEventId: 'proof-waiter-undo-1' });
  await expectStatus('clock in again', WAITER_EMAIL, 'POST', `${A}/clock-in`, 201, { clientEventId: 'proof-waiter-in-2', ...loose });
  await expectStatus('Lena clocked in for by her Branch Manager', BM, 'POST', `${A}/clock-for`, 201, { employeeId: lena.id, type: 'IN', at: new Date(Date.now() - 15 * 60_000).toISOString(), reason: 'Her phone had no signal' });
  await expectStatus('a Kitchen head cannot clock a Service person', HEAD, 'POST', `${A}/clock-for`, 403, { employeeId: lena.id, type: 'IN', at: new Date().toISOString(), reason: 'Not mine to do' });
  await expectStatus('Store Manager cannot reach another branch', STORE, 'POST', `${A}/clock-for`, 404, { employeeId: lena.id, type: 'OUT', at: new Date().toISOString(), reason: 'Wrong branch' });

  const board = await call(BM, 'GET', `${A}/board`);
  const states = Object.fromEntries(((board.body.data?.['people'] as { employeeId: string; state: string }[]) ?? []).map((p) => [p.employeeId, p.state]));
  check('board: waiter LATE, Lena LATE (clocked in for), the Kitchen head NOT_IN', states[waiter.id] === 'LATE' && states[lena.id] === 'LATE' && states[chefEmp.id] === 'NOT_IN', JSON.stringify([states[waiter.id], states[lena.id], states[chefEmp.id]]));
  const tiles = board.body.data?.['tiles'] as { notIn: { count: number }; late: { count: number } } | undefined;
  check('board tiles: at least 2 late and at least 1 not in', (tiles?.late.count ?? 0) >= 2 && (tiles?.notIn.count ?? 0) >= 1, JSON.stringify(tiles));

  out('\n== 3. the shift ends: the prompt, "finish now", fixes');
  const wait = instantAt(today, parseClockTime(endAt)).getTime() + 70_000 - Date.now();
  out(`waiting ${Math.max(0, Math.round(wait / 1000))}s for the scheduled end ${endAt} (and a minute after)…`);
  await sleep(Math.max(0, wait));
  const due = await call(WAITER_EMAIL, 'GET', `${A}/me`);
  check('prompt is due after the scheduled end', (due.body.data?.['current'] as { state?: string } | undefined)?.state === 'PROMPT_DUE', JSON.stringify(due.body.data?.['current']));
  const out1 = await expectStatus('"Finish now" is the clock-out', WAITER_EMAIL, 'POST', `${A}/clock-out`, 201, { clientEventId: 'proof-waiter-out-1', ...loose });
  check('the clock-out is not early, so no reason was needed', (out1.body.data?.['leftEarlyMinutes'] ?? 0) === 0);
  const history = await call(BM, 'GET', `${A}/day?employeeId=${waiter.id}&date=${today}`);
  const outEvent = ((history.body.data?.['entries'] as { events: { id: string; type: string }[] }[])[0]?.events ?? []).find((e) => e.type === 'OUT');
  const endInstant = instantAt(today, parseClockTime(endAt)).toISOString();
  const waiterFix = { employeeId: waiter.id, date: today, action: 'EDIT', eventId: outEvent?.id, at: endInstant, reason: 'He tapped out a minute late; he left at the end' };
  const preview = await expectStatus('Branch Manager previews a fix of the waiter\'s clock-out', BM, 'POST', `${A}/fixes/preview`, 200, waiterFix);
  check('preview shows minutes after the end falling to 0', ((preview.body.data?.['after'] as { afterEndMinutes?: number } | undefined)?.afterEndMinutes) === 0 && ((preview.body.data?.['before'] as { afterEndMinutes?: number } | undefined)?.afterEndMinutes ?? 0) >= 1, JSON.stringify(preview.body.data));
  await expectStatus('Branch Manager applies it', BM, 'POST', `${A}/fixes`, 201, waiterFix);
  await expectStatus('Branch Manager adds the clock-out Lena forgot', BM, 'POST', `${A}/fixes`, 201, { employeeId: lena.id, date: today, action: 'ADD', type: 'OUT', at: endInstant, reason: 'She left at the end and forgot to tap out' });
  const after = await call(BM, 'GET', `${A}/day?employeeId=${waiter.id}&date=${today}`);
  check('history keeps the old time (REPLACED) and shows the correction', JSON.stringify(after.body.data).includes('REPLACED') && JSON.stringify(after.body.data).includes('CORRECTION'));
  await expectStatus('Director cannot fix time', DIRECTOR, 'POST', `${A}/fixes`, 403, { employeeId: waiter.id, date: today, action: 'VOID', eventId: outEvent?.id, reason: 'Not mine to do' });
  const report = await call(ACCOUNTANT, 'GET', `${A}/lateness?${range}`);
  check('lateness lists the waiter (25 or 26 min) for the Accountant', /"minutesLate":2[56]/.test(JSON.stringify(report.body.data)) && /"minutesAfterGrace":2[01]/.test(JSON.stringify(report.body.data)), JSON.stringify(report.body.data).slice(0, 300));

  out('\n== 4. switch off: the legacy clock works again');
  await expectStatus('Director switches Nyeri Town off', DIRECTOR, 'PUT', `${A}/switch`, 200, { siteId: townId, enabled: false });
  const legacyBack = await call(WAITER_EMAIL, 'POST', '/clock/in', { shiftAssignmentId: '00000000-0000-0000-0000-000000000000', ...loose });
  check('legacy clock reachable again (its own validation answers, not the refusal)', !refused(legacyBack), JSON.stringify(legacyBack.body));
  await expectStatus('new clock refuses once off', WAITER_EMAIL, 'POST', `${A}/clock-in`, 409, { clientEventId: 'proof-after-off', ...loose });

  out('\n== 5. integrity');
  const chain = verifyAuditChain(await auditRepository.listEntries(town.site!.companyId, 0n, 1_000_000));
  check('the audit chain verifies', chain.ok === true, JSON.stringify(chain, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  check('no legacy row changed (shifts, assignments, clock records)', (await legacy()) === legacyBefore, `${legacyBefore} -> ${await legacy()}`);
  out(`\n${passed} passed, ${failed} failed. Data left in place: run "down" to remove it.`);
  if (failed > 0) process.exitCode = 1;
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('usage: attendance-proof.ts up|down')))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
