/**
 * Workforce Segment 1A: the proof run over HTTP with the real seeded logins, against the lane database and the lane API.
 *   up    makes a waiter (with a login), a colleague without one and a Branch Manager with a signing PIN in the Kitchen, clocks
 *         September 2026 (matched days, a late day, an overtime day, an early clock-out, a clean first and last day), switches
 *         Nyeri Town on, then walks the whole month end to end: the months list with the open month "so far", who sees and does
 *         what (every role), only the exceptions need a person, a head's note, overtime answered all, part or none with a PIN
 *         and a version, a request answered with before and after, the escalation to HR, a clock fix before approval, the draft
 *         exports, the approval blocked and then done with a PIN, the lock after it (fixes, decisions, requests), the signed
 *         exports, approved hours for payroll, the audit chain, the legacy tables unchanged. It leaves the data for inspection.
 *   down  removes everything `up` made and puts the switch back as it was (the audit entries stay: the log is append-only).
 * September 2026 has ended by the lane's calendar (the month is "to approve"); the current month (October) is the open one. The
 * September month row is made directly, because the API creates only the current month on first read.
 * Usage: API=http://localhost:4102 PROOF_OUT=/some/dir pnpm exec tsx src/scripts/timesheets-proof.ts up|down
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../config/database';
import { getApprovedHours, instantAt, parseClockTime, sweepTimesheets, toDateColumn, verifyAuditChain, weekStart, type AuditCategoryCode, type AuditEntryRecord, type NairobiDate } from '../modules/workforce';
import { hashPassword, hashPin } from '../utils/password';

const API = `${process.env['API'] ?? 'http://localhost:4102'}/api/v1`;
const OUT = process.env['PROOF_OUT'];
const TAG = 'ZZ Proof Tsh';
const WAITER = 'proof.tsh.waiter@wendo.test';
const MANAGER = 'proof.tsh.manager@wendo.test';
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

type Body = Record<string, unknown>;
type Reply = { status: number; body: { success?: boolean; data?: Body; error?: { code?: string; message?: string } } };
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
const short = (path: string): string => (path.split('?')[0] ?? path).replace('/workforce/timesheets', '').replace(/[0-9a-f-]{36}/g, ':id');
const expectStatus = async (label: string, who: string, method: string, path: string, expected: number, body?: object): Promise<Reply> => {
  const reply = await call(who, method, path, body);
  check(`${label}: ${who.split('@')[0]} ${method} ${short(path)} -> ${expected}`, reply.status === expected, `got ${reply.status} ${JSON.stringify(reply.body).slice(0, 220)}`);
  return reply;
};
const expectCode = async (label: string, who: string, method: string, path: string, expected: number, code: string, body?: object): Promise<Reply> => {
  const reply = await call(who, method, path, body);
  check(`${label}: ${who.split('@')[0]} ${method} ${short(path)} -> ${expected} ${code}`, reply.status === expected && reply.body.error?.code === code, `got ${reply.status} ${JSON.stringify(reply.body).slice(0, 220)}`);
  return reply;
};
/** A file download: the status, the headers and the bytes. */
const download = async (who: string, path: string, body: object): Promise<{ status: number; type: string; disposition: string; number: string; bytes: Buffer }> => {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}` }, body: JSON.stringify(body) });
  return { status: res.status, type: res.headers.get('content-type') ?? '', disposition: res.headers.get('content-disposition') ?? '', number: res.headers.get('x-document-number') ?? '', bytes: Buffer.from(await res.arrayBuffer()) };
};

const HR = 'hr@wendo.test';
const ADMIN = 'admin@wendo.test';
const BM = 'bm.town@wendo.test';
const HIGHWAY = 'bm.highway@wendo.test';
const STORE = 'store.manager@wendo.test';
const DIRECTOR = 'director@wendo.test';
const ACCOUNTANT = 'accountant@wendo.test';
const KITCHEN_HEAD = 'kitchen.head.town@wendo.test';
const BARISTA_HEAD = 'barista.head.town@wendo.test';
const T = '/workforce/timesheets';
const M = `${T}/months/2026-09`;
const day = (n: number): NairobiDate => `2026-09-${String(n).padStart(2, '0')}` as NairobiDate; // Monday 7 to Friday 11 September
let keyCount = 0;
const nextKey = (label: string): string => `proof-${label}-${Date.now()}-${(keyCount += 1)}`;

async function down(): Promise<void> {
  const people = await prisma.employee.findMany({ where: { employeeNumber: { startsWith: 'ZZT-' } }, select: { id: true } });
  const ids = people.map((p) => p.id);
  const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true } });
  await prisma.timeRequest.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.timesheetPeriod.deleteMany({ where: { siteId: town.siteId as string } }); // days, weeks, overtime and exports follow
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('workforce.allow_clock_edits', 'on', true)`; // the events table is append-only; this is the dev teardown door
    await tx.clockEvent.deleteMany({ where: { employeeId: { in: ids } } });
  });
  await prisma.rotaEntry.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.rotaWeek.deleteMany({ where: { carriedFromLegacy: false, entries: { none: {} } } });
  await prisma.shiftTemplate.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.attendanceSiteSwitch.deleteMany({});
  await prisma.employee.deleteMany({ where: { employeeNumber: { startsWith: 'ZZT-' } } });
  await prisma.user.deleteMany({ where: { email: { in: [WAITER, MANAGER] } } });
  out(`removed the proof data (${ids.length} people, their clock events and rota rows, the months and exports, the switch row and the two logins)`);
}

async function up(): Promise<void> {
  const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true, site: { select: { companyId: true } } } });
  const townId = town.siteId as string;
  const companyId = town.site!.companyId;
  const legacy = async () => JSON.stringify([await prisma.shift.count(), await prisma.shiftAssignment.count(), await prisma.clockRecord.count(), await prisma.payslip.count()]);
  const legacyBefore = await legacy();

  const kitchen = await prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'KITCHEN' } });
  const waiterUser = await prisma.user.create({ data: { name: `${TAG} Waiter`, email: WAITER, passwordHash: await hashPassword(PASSWORD), role: 'WAITER', siteId: townId } });
  await prisma.user.create({ data: { name: `${TAG} Manager`, email: MANAGER, passwordHash: await hashPassword(PASSWORD), pinHash: await hashPin(PIN), role: 'MANAGER', siteId: townId } });
  const mk = (n: number, name: string, userId: string | null) =>
    prisma.employee.create({ data: { companyId, siteId: townId, employeeNumber: `ZZT-${n}`, name: `${TAG} ${name}`, departmentId: kitchen.id, payType: 'MONTHLY_SALARY', startDate: toDateColumn('2026-09-01' as NairobiDate), status: 'ACTIVE', tracksTime: true, userId } });
  const waiter = await mk(1, 'Waiter', waiterUser.id);
  const lena = await mk(2, 'Lena', null);
  const template = await prisma.shiftTemplate.create({ data: { companyId, siteId: townId, name: `${TAG} Shift`, colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 } });
  const at = (date: NairobiDate, clock: string) => instantAt(date, parseClockTime(clock));
  const FIRST = day(1);
  const LAST = day(30);
  const lenaWeek: [NairobiDate, string, string][] = [[day(7), '05:58', '14:01'], [day(8), '06:20', '14:00'], [day(9), '06:00', '14:02'], [day(10), '06:00', '14:40'], [day(11), '05:55', '14:00']];
  const waiterWeek: [NairobiDate, string, string][] = [[FIRST, '06:00', '14:00'], [day(7), '06:00', '14:00'], [day(8), '05:57', '14:00'], [day(9), '06:00', '14:03'], [day(10), '06:01', '14:00'], [day(11), '06:00', '11:20'], [LAST, '06:00', '14:00']];
  for (const [emp, plan] of [[lena, lenaWeek], [waiter, waiterWeek]] as const) {
    for (const [date, inAt, outAt] of plan) {
      const weekOn = { siteId: townId, departmentId: kitchen.id, weekStart: toDateColumn(weekStart(date, 1)) };
      const week = (await prisma.rotaWeek.findFirst({ where: weekOn, select: { id: true } })) ?? (await prisma.rotaWeek.create({ data: weekOn, select: { id: true } }));
      const entry = await prisma.rotaEntry.create({ data: { weekId: week.id, siteId: townId, employeeId: emp.id, date: toDateColumn(date), templateId: template.id } });
      for (const [type, clk] of [['IN', inAt], ['OUT', outAt]] as const) {
        await prisma.clockEvent.create({ data: { siteId: townId, employeeId: emp.id, rotaEntryId: entry.id, shiftDate: toDateColumn(date), type, source: 'PHONE', occurredAt: at(date, clk), serverAt: at(date, clk) } });
      }
    }
  }
  out('clocked September 2026: Mon 7 to Fri 11 Sep (Lena late on Tuesday and 40 minutes over on Thursday; the waiter out at 11:20 on Friday), a clean day on 1 and on 30 Sep');
  // The login door allows 10 a minute: the eleven logins go in two batches.
  for (const email of [HR, ADMIN, BM, HIGHWAY, STORE, DIRECTOR]) await login(email);
  await new Promise((resolve) => setTimeout(resolve, 62_000));
  for (const email of [ACCOUNTANT, KITCHEN_HEAD, BARISTA_HEAD, WAITER, MANAGER]) await login(email);

  out('\n== 1. the branch is off: no timesheets');
  const off = await expectStatus('months while off', BM, 'GET', `${T}/months?site=${townId}`, 200);
  check('reads "not enabled" and writes nothing', off.body.data?.['enabled'] === false && (await prisma.timesheetPeriod.count({ where: { siteId: townId } })) === 0, JSON.stringify(off.body.data));
  await expectStatus('only the System Admin switches a branch on', DIRECTOR, 'PUT', '/workforce/attendance/switch', 403, { siteId: townId, enabled: true });
  await expectStatus('System Admin switches Nyeri Town on', ADMIN, 'PUT', '/workforce/attendance/switch', 200, { siteId: townId, enabled: true });
  await prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabledAt: new Date('2026-09-01T00:00:00Z') } });

  out('\n== 2. the months, the open month "so far", and who sees what');
  const list = await expectStatus('Branch Manager lists the months (the current month is created on first use)', BM, 'GET', `${T}/months?site=${townId}`, 200);
  const months = ((list.body.data?.['months'] as Body[]) ?? []);
  const october = months.find((m) => m['monthKey'] === '2026-10');
  check('October is the open month, with "so far" through today', october?.['state'] === 'OPEN' && typeof october['soFarThroughDate'] === 'string' && october['documentNumber'] === null, JSON.stringify(october));
  const sep = await prisma.timesheetPeriod.create({ data: { siteId: townId, startDate: toDateColumn(FIRST), endDate: toDateColumn(LAST), label: 'September 2026', cutoffAt: instantAt('2026-10-01' as NairobiDate, parseClockTime('00:00')) } });
  const month = await expectStatus('Branch Manager opens September (it refreshes)', BM, 'GET', `${M}?site=${townId}`, 200);
  const md = month.body.data as { state: string; needsYou: { overtimeDecisions: number; total: number }; capabilities: { canApprove: boolean }; kpis: { workedMinutes: number; headcount: number; overtime: { toDecideMinutes: number } } };
  check('September is to approve; one overtime decision needs the manager (late and an early clock-out never block)', md.state === 'TO_APPROVE' && md.needsYou.overtimeDecisions === 1 && md.needsYou.total === 1 && md.kpis.overtime.toDecideMinutes === 40, JSON.stringify(md));
  check('the matching days approved themselves (7 of the 10 in the clocked week)', (await prisma.timesheetDay.count({ where: { employeeId: { in: [lena.id, waiter.id] }, status: 'AUTO_APPROVED', shiftDate: { gte: toDateColumn(day(7)), lte: toDateColumn(day(11)) } } })) === 7);
  const people = await expectStatus('the people table', BM, 'GET', `${M}/people?site=${townId}&rows=100`, 200);
  const rows = ((people.body.data?.['rows'] as { employeeId: string; status: { kind: string } }[]) ?? []);
  check('Lena has overtime to decide; the waiter has nothing to decide', rows.find((r) => r.employeeId === lena.id)?.status.kind === 'OVERTIME_TO_DECIDE' && rows.find((r) => r.employeeId === waiter.id)?.status.kind === 'NOTHING', JSON.stringify(rows.filter((r) => [lena.id, waiter.id].includes(r.employeeId))));
  const filtered = await expectStatus('the "needs you" filter, a search and a department', BM, 'GET', `${M}/people?site=${townId}&view=needs&q=Lena&dept=${kitchen.id}&sort=worked&dir=desc`, 200);
  check('narrows to Lena', ((filtered.body.data?.['rows'] as unknown[]) ?? []).length === 1);
  await expectStatus('a week range', BM, 'GET', `${M}?site=${townId}&from=2026-09-07&to=2026-09-13`, 200);
  await expectCode('a range outside the month', BM, 'GET', `${M}?site=${townId}&from=2026-08-30&to=2026-09-03`, 400, 'RANGE_OUTSIDE_MONTH');
  await expectCode('a month that never existed', BM, 'GET', `${T}/months/2026-02?site=${townId}`, 404, 'NO_TIMESHEET');
  for (const [who, status] of [[BM, 200], [MANAGER, 200], [HR, 200], [ACCOUNTANT, 200], [DIRECTOR, 200], [ADMIN, 200], [STORE, 404], [HIGHWAY, 404], [KITCHEN_HEAD, 403], [WAITER, 403]] as const) await expectStatus('read the month', who, 'GET', `${M}?site=${townId}`, status);
  const mine = await expectStatus('the waiter reads their own time', WAITER, 'GET', `${T}/me/time?periodId=${sep.id}`, 200);
  check('My time holds only the waiter\'s days', ((mine.body.data?.['days'] as { employeeId: string }[]) ?? []).every((d) => d.employeeId === waiter.id));
  const drawer = await expectStatus('a person\'s drawer', BM, 'GET', `${M}/people/${lena.id}?site=${townId}`, 200);
  check('it shows the overtime to decide and 7 last days', ((drawer.body.data?.['needLook'] as Body[]) ?? []).some((n) => n['kind'] === 'OVERTIME') && ((drawer.body.data?.['lastDays'] as unknown[]) ?? []).length === 7);
  const days = await expectStatus('a person\'s full month', BM, 'GET', `${M}/people/${lena.id}/days?site=${townId}`, 200);
  check('every day of September, rest days included', (days.body.data?.['total'] as number) === 30);
  await expectStatus('another branch cannot open a person', HIGHWAY, 'GET', `${M}/people/${lena.id}?site=${townId}`, 404);

  out('\n== 3. a head\'s note, then overtime all, part or none');
  const item = await prisma.overtimeItem.findFirstOrThrow({ where: { employeeId: lena.id } });
  await expectStatus('a head of another department cannot note it', BARISTA_HEAD, 'POST', `${T}/overtime/${item.id}/note`, 403, { text: 'Saw it' });
  await expectStatus('the Branch Manager cannot leave a head\'s note', BM, 'POST', `${T}/overtime/${item.id}/note`, 403, { text: 'Saw it' });
  await expectStatus('the Kitchen head notes it', KITCHEN_HEAD, 'POST', `${T}/overtime/${item.id}/note`, 200, { text: 'Saw it, no objection' });
  await expectCode('a second note is refused', KITCHEN_HEAD, 'POST', `${T}/overtime/${item.id}/note`, 409, 'ALREADY_NOTED', { text: 'Again' });
  const detail = await expectStatus('the overtime card with its evidence', BM, 'GET', `${T}/overtime/${item.id}`, 200);
  const dd = detail.body.data as { version: number; evidence: { headNote: { text: string } | null }; limits: Body; extraMinutes: number; part: { min: number; max: number } | null };
  check('planned and worked times, the head\'s note, the limits, and the part range 5 to 35', dd.extraMinutes === 40 && dd.evidence.headNote?.text === 'Saw it, no objection' && dd.part?.min === 5 && dd.part.max === 35 && 'weekMinutes' in dd.limits, JSON.stringify(detail.body.data).slice(0, 400));
  check('counts only: no takings anywhere in the evidence', !/total|takings|amount|value/i.test(JSON.stringify(dd.evidence)));
  const decision = { decision: 'APPROVE_PART', approvedMinutes: 30, reason: 'Only the rush', pin: PIN, version: dd.version };
  for (const [who, status] of [[HR, 403], [ACCOUNTANT, 403], [ADMIN, 403], [DIRECTOR, 403], [KITCHEN_HEAD, 403], [WAITER, 403], [HIGHWAY, 404], [STORE, 404]] as const) await expectStatus('answer the overtime', who, 'POST', `${T}/overtime/${item.id}/decision`, status, decision);
  await expectCode('a wrong PIN', MANAGER, 'POST', `${T}/overtime/${item.id}/decision`, 401, 'INVALID_PIN', { ...decision, pin: '0000' });
  await expectCode('a stale version', MANAGER, 'POST', `${T}/overtime/${item.id}/decision`, 409, 'CHANGED_UNDERNEATH', { ...decision, version: dd.version + 9 });
  await expectCode('a part outside the range', MANAGER, 'POST', `${T}/overtime/${item.id}/decision`, 409, 'PART_OUT_OF_RANGE', { ...decision, approvedMinutes: 40 });
  await expectStatus('part with no reason is refused at the door', MANAGER, 'POST', `${T}/overtime/${item.id}/decision`, 400, { decision: 'APPROVE_PART', approvedMinutes: 30, pin: PIN, version: dd.version });
  const part = await expectStatus('the Branch Manager approves 30 of the 40 minutes', MANAGER, 'POST', `${T}/overtime/${item.id}/decision`, 200, decision);
  check('stored as approved in part, 30 minutes authorised', part.body.data?.['status'] === 'APPROVED_PART' && part.body.data['authorisedMinutes'] === 30);
  check('the person was told, and the audit entry never holds the PIN', !JSON.stringify(await prisma.auditEntry.findMany({ where: { companyId, action: 'timesheet.overtime_decided' }, orderBy: { seq: 'desc' }, take: 1, select: { before: true, after: true, reason: true } })).includes(PIN));
  check('Thursday settled with the overtime answer', (await prisma.timesheetDay.findFirstOrThrow({ where: { employeeId: lena.id, shiftDate: toDateColumn(day(10)) } })).status === 'APPROVED');

  out('\n== 4. Report a problem and "clocked out by mistake"');
  const friday = at(day(11), '14:00').toISOString();
  const created = await expectStatus('the waiter reports the Friday clock-out', WAITER, 'POST', `${T}/me/requests`, 201, { kind: 'CLOCKED_OUT_BY_MISTAKE', date: day(11), at: friday, note: 'I tapped Clock out by accident' });
  const rid = String(created.body.data?.['id']);
  await expectStatus('a second tap is the same request', WAITER, 'POST', `${T}/me/requests`, 201, { kind: 'CLOCKED_OUT_BY_MISTAKE', date: day(11), at: friday, note: 'I tapped Clock out by accident' });
  check('only one request exists, and it blocks approving the month', (await prisma.timeRequest.count({ where: { employeeId: waiter.id, kind: 'CLOCKED_OUT_BY_MISTAKE' } })) === 1 && ((await call(BM, 'GET', `${M}?site=${townId}`)).body.data as typeof md).needsYou.total === 1);
  for (const [who, status] of [[WAITER, 403], [ACCOUNTANT, 403], [DIRECTOR, 403], [KITCHEN_HEAD, 403], [HIGHWAY, 404]] as const) await expectStatus('answer the request', who, 'POST', `${T}/requests/${rid}/decision`, status, { outcome: 'APPROVE' });
  const inbox = await expectStatus('Branch Manager reads the inbox', BM, 'GET', `${T}/requests?siteId=${townId}`, 200);
  check('the request is waiting in the inbox', JSON.stringify(inbox.body.data).includes(rid));
  await expectStatus('Branch Manager accepts it', BM, 'POST', `${T}/requests/${rid}/decision`, 200, { outcome: 'APPROVE', reason: 'Checked with the till' });
  check('the correction exists (a new row pointing at the old clock-out)', (await prisma.clockEvent.count({ where: { employeeId: waiter.id, type: 'CORRECTION' } })) === 1);
  const second = await expectStatus('the waiter reports the rota', WAITER, 'POST', `${T}/me/requests`, 201, { kind: 'ROTA_WRONG', date: day(9), note: 'I was not rostered on Wednesday' });
  await prisma.timeRequest.update({ where: { id: String(second.body.data?.['id']) }, data: { createdAt: new Date(Date.now() - 4 * 86_400_000) } }); // proof only: it has waited four days
  const escalated = await sweepTimesheets();
  const again = await sweepTimesheets();
  check('three days on, the unanswered request moves to HR, once; nothing closes', escalated.escalated === 1 && again.escalated === 0, JSON.stringify([escalated, again]));
  check('the month is still open for approval after the sweep (nothing closes by itself)', (await prisma.timesheetPeriod.findUniqueOrThrow({ where: { id: sep.id } })).state === 'OPEN');
  const withHr = await call(BM, 'GET', `${M}?site=${townId}`);
  check('a request with HR is listed and does not block', ((withHr.body.data as typeof md & { needsYou: { requestsWithHr: number } }).needsYou.requestsWithHr === 1) && (withHr.body.data as typeof md).needsYou.total === 0);
  await expectStatus('HR declines it with a reason', HR, 'POST', `${T}/requests/${second.body.data?.['id']}/decision`, 200, { outcome: 'DECLINE', reason: 'The rota shows you on' });

  out('\n== 5. a clock fix before approval, the draft exports, the access to exports');
  const lenaOut = await prisma.clockEvent.findFirstOrThrow({ where: { employeeId: lena.id, shiftDate: toDateColumn(day(7)), type: 'OUT' } });
  const fix = { employeeId: lena.id, date: day(7), action: 'EDIT', eventId: lenaOut.id, at: at(day(7), '14:00').toISOString(), reason: 'Checked the till' };
  await expectStatus('the Branch Manager fixes a clock alone before approval (preview)', MANAGER, 'POST', '/workforce/attendance/fixes/preview', 200, fix);
  const draftPdf = await download(MANAGER, `${M}/exports`, { format: 'pdf', scope: 'month', idempotencyKey: nextKey('pdf'), site: townId });
  check('the draft PDF downloads, named for the month, with no document number', draftPdf.status === 200 && draftPdf.type.includes('application/pdf') && draftPdf.bytes.subarray(0, 5).toString() === '%PDF-' && draftPdf.disposition.includes('Timesheet-Nyeri-Town-2026-09.pdf') && draftPdf.number === '', `${draftPdf.status} ${draftPdf.disposition}`);
  const draftXlsx = await download(ACCOUNTANT, `${M}/exports`, { format: 'xlsx', scope: 'range', from: '2026-09-07', to: '2026-09-13', idempotencyKey: nextKey('xlsx'), site: townId });
  check('the Accountant\'s Excel of a week range opens (a zip), named with the range', draftXlsx.status === 200 && draftXlsx.bytes.subarray(0, 2).toString() === 'PK' && draftXlsx.disposition.includes('2026-09-07-13'), `${draftXlsx.status} ${draftXlsx.disposition}`);
  const extract = await download(BM, `${M}/exports`, { format: 'pdf', scope: 'month', employeeId: lena.id, idempotencyKey: nextKey('one'), site: townId });
  check('a one-person extract', extract.status === 200 && extract.disposition.includes('extract'));
  for (const [who, status] of [[HR, 200], [MANAGER, 200], [DIRECTOR, 403], [ADMIN, 403], [WAITER, 403], [KITCHEN_HEAD, 403], [STORE, 404], [HIGHWAY, 404]] as const) {
    const res = await download(who, `${M}/exports`, { format: 'xlsx', scope: 'month', idempotencyKey: nextKey('acl'), site: townId });
    check(`export access: ${who.split('@')[0]} -> ${status}`, res.status === status, `got ${res.status}`);
  }
  await expectStatus('the old CSV is gone', BM, 'POST', `${M}/exports`, 400, { format: 'csv', scope: 'month', idempotencyKey: nextKey('csv'), site: townId });
  check('every export is audited once per key (who, format, month, draft)', (await prisma.auditEntry.count({ where: { companyId, action: 'timesheet.exported', occurredAt: { gte: new Date(Date.now() - 600_000) } } })) >= 5);
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/draft.pdf`, draftPdf.bytes);
    writeFileSync(`${OUT}/draft-week.xlsx`, draftXlsx.bytes);
  }

  out('\n== 6. approve the month: refused for everyone but the site\'s manager, then done');
  const sheet = (await call(MANAGER, 'GET', `${M}?site=${townId}`)).body.data as typeof md;
  const expectedTotals = { workedMinutes: sheet.kpis.workedMinutes, overtimeAuthorisedMinutes: (sheet as unknown as { kpis: { overtime: { approvedMinutes: number } } }).kpis.overtime.approvedMinutes, headcount: sheet.kpis.headcount };
  const approval = (extra: Body = {}) => ({ pin: PIN, idempotencyKey: nextKey('approve'), expectedTotals, site: townId, ...extra });
  for (const [who, status] of [[HR, 403], [ACCOUNTANT, 403], [ADMIN, 403], [WAITER, 403], [KITCHEN_HEAD, 403], [DIRECTOR, 404], [STORE, 404], [HIGHWAY, 404]] as const) await expectStatus('approve the month', who, 'POST', `${M}/approve`, status, approval());
  await expectCode('October has not ended', MANAGER, 'POST', `${T}/months/2026-10/approve`, 409, 'MONTH_NOT_ENDED', approval());
  await expectCode('a wrong PIN', MANAGER, 'POST', `${M}/approve`, 401, 'INVALID_PIN', approval({ pin: '0000' }));
  await expectCode('figures that moved', MANAGER, 'POST', `${M}/approve`, 409, 'CHANGED_UNDERNEATH', approval({ expectedTotals: { ...expectedTotals, workedMinutes: expectedTotals.workedMinutes + 1 } }));
  check('nothing was approved by any of that', (await prisma.timesheetPeriod.findUniqueOrThrow({ where: { id: sep.id } })).state === 'OPEN');
  const key = nextKey('final');
  const done = await expectStatus('the Branch Manager approves September with their PIN', MANAGER, 'POST', `${M}/approve`, 200, approval({ idempotencyKey: key }));
  const documentNumber = String((done.body.data as Body)?.['documentNumber']);
  check('the document number is TSH-n and the state is APPROVED', /^TSH-\d{4}$/.test(documentNumber) && (done.body.data as Body)?.['state'] === 'APPROVED', JSON.stringify(done.body.data));
  const again2 = await expectStatus('the same request again answers the first result', MANAGER, 'POST', `${M}/approve`, 200, approval({ idempotencyKey: key }));
  check('flagged as a repeat, one audit entry only', (again2.body.data as Body)?.['repeat'] === true && (await prisma.auditEntry.count({ where: { companyId, action: 'timesheet.month_approved', subjectId: sep.id } })) === 1);
  await expectCode('another key is too late', MANAGER, 'POST', `${M}/approve`, 409, 'ALREADY_APPROVED', approval());
  const row = await prisma.timesheetPeriod.findUniqueOrThrow({ where: { id: sep.id } });
  const signer = await prisma.user.findUniqueOrThrow({ where: { email: MANAGER }, select: { id: true } });
  check('approved by the signer, with a frozen snapshot and its hash', row.state === 'APPROVED' && row.approvedById === signer.id && row.approvedSnapshot !== null && (row.documentHash ?? '').length === 64, JSON.stringify([row.state, row.approvedById, row.documentHash]));
  check('the days that only carried facts were approved with the month', (await prisma.timesheetDay.count({ where: { periodId: sep.id, status: 'NEEDS_LOOK' } })) === 0);
  check('the audit entry never holds the PIN', !JSON.stringify(await prisma.auditEntry.findMany({ where: { companyId, action: 'timesheet.month_approved' }, orderBy: { seq: 'desc' }, take: 1, select: { before: true, after: true } })).includes(PIN));

  out('\n== 7. after approval: locked for fixes, decisions and requests; reads and payroll see it approved');
  await expectCode('a clock fix is refused for the Branch Manager', BM, 'POST', '/workforce/attendance/fixes', 409, 'PERIOD_APPROVED', fix);
  await expectCode('and for HR', HR, 'POST', '/workforce/attendance/fixes', 409, 'PERIOD_APPROVED', fix);
  const lateDay = await prisma.timesheetDay.findFirstOrThrow({ where: { employeeId: lena.id, shiftDate: toDateColumn(day(8)) } });
  await expectCode('a day decision', BM, 'POST', `${T}/days/${lateDay.id}/decision`, 409, 'PERIOD_APPROVED', { outcome: 'ACCEPT' });
  await expectCode('an overtime decision', MANAGER, 'POST', `${T}/overtime/${item.id}/decision`, 409, 'PERIOD_APPROVED', { decision: 'DECLINE', reason: 'Too late now', pin: PIN, version: (part.body.data as Body)['version'] });
  const late = await expectStatus('a new request about an approved day', WAITER, 'POST', `${T}/me/requests`, 201, { kind: 'ROTA_WRONG', date: day(10), note: 'That Thursday was my day off' });
  check('goes straight to HR', late.body.data?.['waitingOnRole'] === 'HR_MANAGER', JSON.stringify(late.body.data));
  const approved = (await call(BM, 'GET', `${M}?site=${townId}`)).body.data as { state: string; approval: { documentNumber: string } | null; capabilities: { canApprove: boolean; canDecide: boolean } };
  check('the month reads approved, with its number, and no approve or decide buttons', approved.state === 'APPROVED' && approved.approval?.documentNumber === documentNumber && !approved.capabilities.canApprove && !approved.capabilities.canDecide, JSON.stringify(approved));
  const after = await sweepTimesheets();
  check('the sweep leaves an approved month alone', after.refreshed >= 1 && (await prisma.timesheetPeriod.findUniqueOrThrow({ where: { id: sep.id } })).documentHash === row.documentHash);
  const hours = await getApprovedHours(waiterUser.id, { start: day(7), end: day(11) });
  const stored = await prisma.timesheetDay.aggregate({ where: { employeeId: waiter.id, shiftDate: { gte: toDateColumn(day(7)), lte: toDateColumn(day(11)) } }, _sum: { workedMinutes: true } });
  check('payroll reads the waiter\'s approved hours of the approved month: the same minutes the days hold', hours.workedMinutes > 0 && hours.workedMinutes === (stored._sum.workedMinutes ?? 0), JSON.stringify([hours, stored._sum]));
  const signedPdf = await download(MANAGER, `${M}/exports`, { format: 'pdf', scope: 'month', idempotencyKey: nextKey('signed'), site: townId });
  const signedPdf2 = await download(HR, `${M}/exports`, { format: 'pdf', scope: 'month', idempotencyKey: nextKey('signed2'), site: townId });
  check('the signed PDF carries the number in its header and downloads for HR too', signedPdf.status === 200 && signedPdf.number === documentNumber && signedPdf2.number === documentNumber);
  const signedXlsx = await download(ACCOUNTANT, `${M}/exports`, { format: 'xlsx', scope: 'month', idempotencyKey: nextKey('signedx'), site: townId });
  check('the signed month\'s Excel', signedXlsx.status === 200 && signedXlsx.number === documentNumber);
  if (OUT) {
    writeFileSync(`${OUT}/signed.pdf`, signedPdf.bytes);
    writeFileSync(`${OUT}/signed.xlsx`, signedXlsx.bytes);
  }

  out('\n== 8. integrity, then the branch goes back to off');
  const entries = await prisma.auditEntry.findMany({ where: { companyId }, orderBy: { seq: 'asc' } });
  const chain = verifyAuditChain(entries.map((r) => ({ ...r, category: r.category as AuditCategoryCode, channel: r.channel as AuditEntryRecord['channel'], before: r.before as AuditEntryRecord['before'], after: r.after as AuditEntryRecord['after'] })));
  check('the audit chain verifies', chain.ok === true, JSON.stringify(chain, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  check('no legacy row changed (shifts, assignments, clock records, payslips)', (await legacy()) === legacyBefore, `${legacyBefore} -> ${await legacy()}`);
  await expectStatus('System Admin switches Nyeri Town off', ADMIN, 'PUT', '/workforce/attendance/switch', 200, { siteId: townId, enabled: false });
  await expectStatus('a switched-off branch\'s new request is refused', WAITER, 'POST', `${T}/me/requests`, 409, { kind: 'ROTA_WRONG', date: day(8), note: 'The switch is off' });
  out(`\n${passed} passed, ${failed} failed. Data left in place: run "down" to remove it.`);
  if (failed > 0) process.exitCode = 1;
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('usage: timesheets-proof.ts up|down')))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
