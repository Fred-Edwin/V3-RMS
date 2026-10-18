/**
 * Workforce slice 4a: the proof run over HTTP with the real seeded logins, against the lane database and the lane API.
 *   up    makes a waiter (with a login), a colleague without one and a Branch Manager with a signing PIN, clocks a week
 *         (matched days, a late day, an overtime day, an early clock-out), switches Nyeri Town on, then walks the whole
 *         timesheet end to end: who sees what, only the exceptions need a person, the decisions, a request answered with
 *         before and after, the escalation to HR, the close at the cut-off, a refused fix, HR's reopen, the early close,
 *         the PIN signature, the audit chain, the legacy tables unchanged. It leaves the data for inspection.
 *   down  removes everything `up` made and puts the switch back as it was (the audit entries stay: the log is append-only).
 * The week is the one before the last cut-off (5 to 9 October); its period is created by hand with a cut-off one hour away
 * and then brought to the past, so the job can close it the way the clock would.
 * Usage: API=http://localhost:4102 pnpm exec tsx src/scripts/timesheets-proof.ts up|down
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { instantAt, parseClockTime, sweepTimesheets, toDateColumn, verifyAuditChain, weekStart, type AuditCategoryCode, type AuditEntryRecord, type NairobiDate } from '../modules/workforce';
import { hashPassword, hashPin } from '../utils/password';

const API = `${process.env['API'] ?? 'http://localhost:4102'}/api/v1`;
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
type Reply = { status: number; body: { success?: boolean; data?: Body; error?: { code?: string } } };
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
  check(`${label}: ${who.split('@')[0]} ${method} ${(path.split('?')[0] ?? path).replace('/workforce/timesheets', '').replace(/[0-9a-f-]{36}/g, ':id')} -> ${expected}`, reply.status === expected, `got ${reply.status} ${JSON.stringify(reply.body).slice(0, 200)}`);
  return reply;
};

const HR = 'hr@wendo.test';
const BM = 'bm.town@wendo.test';
const HIGHWAY = 'bm.highway@wendo.test';
const STORE = 'store.manager@wendo.test';
const DIRECTOR = 'director@wendo.test';
const ACCOUNTANT = 'accountant@wendo.test';
const KITCHEN_HEAD = 'kitchen.head.town@wendo.test';
const T = '/workforce/timesheets';
const day = (n: number): NairobiDate => `2026-10-0${n}` as NairobiDate; // Monday 5 to Friday 9 October

async function down(): Promise<void> {
  const people = await prisma.employee.findMany({ where: { employeeNumber: { startsWith: 'ZZT-' } }, select: { id: true } });
  const ids = people.map((p) => p.id);
  const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true } });
  await prisma.timeRequest.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.timesheetPeriod.deleteMany({ where: { siteId: town.siteId as string } });
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
  out(`removed the proof data (${ids.length} people, their clock events and rota rows, the periods, the switch row and the two logins)`);
}

async function up(): Promise<void> {
  const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true, site: { select: { companyId: true } } } });
  const townId = town.siteId as string;
  const companyId = town.site!.companyId;
  const legacy = async () => JSON.stringify([await prisma.shift.count(), await prisma.shiftAssignment.count(), await prisma.clockRecord.count(), await prisma.payslip.count()]);
  const legacyBefore = await legacy();

  const service = await prisma.department.findFirstOrThrow({ where: { siteId: townId, key: 'SERVICE' } });
  const waiterUser = await prisma.user.create({ data: { name: `${TAG} Waiter`, email: WAITER, passwordHash: await hashPassword(PASSWORD), role: 'WAITER', siteId: townId } });
  await prisma.user.create({ data: { name: `${TAG} Manager`, email: MANAGER, passwordHash: await hashPassword(PASSWORD), pinHash: await hashPin(PIN), role: 'MANAGER', siteId: townId } });
  const mk = (n: number, name: string, userId: string | null) =>
    prisma.employee.create({ data: { companyId, siteId: townId, employeeNumber: `ZZT-${n}`, name: `${TAG} ${name}`, departmentId: service.id, payType: 'MONTHLY_SALARY', startDate: toDateColumn(day(1)), status: 'ACTIVE', tracksTime: true, userId } });
  const waiter = await mk(1, 'Waiter', waiterUser.id);
  const lena = await mk(2, 'Lena', null);
  const template = await prisma.shiftTemplate.create({ data: { companyId, siteId: townId, name: `${TAG} Shift`, colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 } });
  const at = (date: NairobiDate, clock: string) => instantAt(date, parseClockTime(clock));
  const lenaWeek: [number, string, string][] = [[5, '05:58', '14:01'], [6, '06:20', '14:00'], [7, '06:00', '14:02'], [8, '06:00', '14:40'], [9, '05:55', '14:00']];
  const waiterWeek: [number, string, string][] = [[5, '06:00', '14:00'], [6, '05:57', '14:00'], [7, '06:00', '14:03'], [8, '06:01', '14:00'], [9, '06:00', '11:20']];
  for (const [emp, plan] of [[lena, lenaWeek], [waiter, waiterWeek]] as const) {
    for (const [n, inAt, outAt] of plan) {
      const weekOn = { siteId: townId, departmentId: service.id, weekStart: toDateColumn(weekStart(day(n), 1)) };
      const week = (await prisma.rotaWeek.findFirst({ where: weekOn, select: { id: true } })) ?? (await prisma.rotaWeek.create({ data: weekOn, select: { id: true } }));
      const entry = await prisma.rotaEntry.create({ data: { weekId: week.id, siteId: townId, employeeId: emp.id, date: toDateColumn(day(n)), templateId: template.id } });
      for (const [type, clk] of [['IN', inAt], ['OUT', outAt]] as const) {
        await prisma.clockEvent.create({ data: { siteId: townId, employeeId: emp.id, rotaEntryId: entry.id, shiftDate: toDateColumn(day(n)), type, source: 'PHONE', occurredAt: at(day(n), clk), serverAt: at(day(n), clk) } });
      }
    }
  }
  out('a week (Mon 5 to Fri 9 Oct) is clocked: Lena late on Tuesday and 40 minutes over on Thursday; the waiter clocked out at 11:20 on Friday');

  for (const email of [HR, BM, HIGHWAY, STORE, DIRECTOR, ACCOUNTANT, KITCHEN_HEAD, WAITER, MANAGER]) await login(email);

  out('\n== 1. the branch is off: no timesheets');
  const offList = await expectStatus('periods while off', BM, 'GET', `${T}/periods?siteId=${townId}`, 200);
  check('reads "not enabled" and writes nothing', offList.body.data?.['enabled'] === false && (await prisma.timesheetPeriod.count({ where: { siteId: townId } })) === 0, JSON.stringify(offList.body.data));
  await expectStatus('Director switches Nyeri Town on', DIRECTOR, 'PUT', '/workforce/attendance/switch', 200, { siteId: townId, enabled: true });

  out('\n== 2. the period, and who sees what');
  const past = { siteId: townId, startDate: toDateColumn('2026-09-19' as NairobiDate), endDate: toDateColumn('2026-10-16' as NairobiDate), label: '21 Sep to 18 Oct 2026', cutoffAt: new Date(Date.now() + 3_600_000) };
  const period = await prisma.timesheetPeriod.create({ data: past });
  const P = `${T}/periods/${period.id}`;
  const view = await expectStatus('Branch Manager opens the period', BM, 'GET', `${P}?pageSize=100`, 200);
  const rows = ((view.body.data?.['people'] as { rows: Body[] })?.rows ?? []) as { employeeId: string; name: string; status: string; needsLookDays: number; overtimePendingMinutes: number }[];
  const lenaRow = rows.find((r) => r.employeeId === lena.id);
  const waiterRow = rows.find((r) => r.employeeId === waiter.id);
  check('Lena needs a look (late Tuesday, overtime Thursday); the waiter needs a look (left early Friday)', lenaRow?.needsLookDays === 2 && lenaRow.overtimePendingMinutes === 40 && waiterRow?.needsLookDays === 1, JSON.stringify([lenaRow, waiterRow]));
  check('the matching days approved themselves: 7 of the 10', (await prisma.timesheetDay.count({ where: { employeeId: { in: [lena.id, waiter.id] }, status: 'AUTO_APPROVED' } })) === 7);
  for (const [who, status] of [[HR, 200], [DIRECTOR, 200], [ACCOUNTANT, 200], [KITCHEN_HEAD, 200], [STORE, 404], [HIGHWAY, 404], [WAITER, 403]] as const) await expectStatus('period', who, 'GET', P, status);
  const headView = await call(KITCHEN_HEAD, 'GET', `${P}?pageSize=100`);
  check('a Kitchen head sees none of the Service people', (((headView.body.data?.['people'] as { rows: Body[] })?.rows) ?? []).every((r) => r['employeeId'] !== lena.id));
  const mine = await expectStatus('the waiter reads their own time', WAITER, 'GET', `${T}/me/time?periodId=${period.id}`, 200);
  check('My time holds only the waiter\'s days', ((mine.body.data?.['days'] as { employeeId: string }[]) ?? []).every((d) => d.employeeId === waiter.id) && ((mine.body.data?.['days'] as unknown[]) ?? []).length === 5);
  await expectStatus('My rota', WAITER, 'GET', `${T}/me/rota?from=2026-10-05&to=2026-10-09`, 200);
  for (const who of [BM, HR]) await expectStatus('person view', who, 'GET', `${P}/people/${lena.id}`, 200);
  await expectStatus('another branch cannot open a person', HIGHWAY, 'GET', `${P}/people/${lena.id}`, 404);

  out('\n== 3. deciding: forbidden writes, then the manager decides');
  const lateDay = await prisma.timesheetDay.findFirstOrThrow({ where: { employeeId: lena.id, shiftDate: toDateColumn(day(6)) } });
  const decision = { outcome: 'EXCUSE', reason: 'The bus broke down' };
  for (const [who, status] of [[ACCOUNTANT, 403], [DIRECTOR, 403], [WAITER, 403], [KITCHEN_HEAD, 403], [HIGHWAY, 404]] as const) await expectStatus('excuse the late day', who, 'POST', `${T}/days/${lateDay.id}/decision`, status, decision);
  await expectStatus('Branch Manager is past the 48-hour excuse window (the day was 12 days ago)', BM, 'POST', `${T}/days/${lateDay.id}/decision`, 409, decision);
  await expectStatus('HR is not held to the window and excuses it', HR, 'POST', `${T}/days/${lateDay.id}/decision`, 200, decision);
  const item = await prisma.overtimeItem.findFirstOrThrow({ where: { employeeId: lena.id } });
  await expectStatus('Accountant cannot answer overtime', ACCOUNTANT, 'POST', `${T}/overtime/${item.id}/decision`, 403, { outcome: 'APPROVE' });
  const overtimeList = await expectStatus('Branch Manager sees the overtime waiting', BM, 'GET', `${T}/overtime?status=PENDING&siteId=${townId}`, 200);
  check('the card carries its evidence and limits', JSON.stringify(overtimeList.body.data).includes('"limits"') && JSON.stringify(overtimeList.body.data).includes('"evidence"'));
  await expectStatus('Branch Manager authorises 30 of the 40 minutes', BM, 'POST', `${T}/overtime/${item.id}/decision`, 200, { outcome: 'APPROVE', minutes: 30 });
  check('Thursday settled with the overtime answer', (await prisma.timesheetDay.findFirstOrThrow({ where: { employeeId: lena.id, shiftDate: toDateColumn(day(8)) } })).status === 'APPROVED');

  out('\n== 4. Report a problem and "clocked out by mistake"');
  const friday = at(day(9), '14:00').toISOString();
  const created = await expectStatus('the waiter reports the Friday clock-out', WAITER, 'POST', `${T}/me/requests`, 201, { kind: 'CLOCKED_OUT_BY_MISTAKE', date: day(9), at: friday, note: 'I tapped Clock out by accident' });
  const rid = String(created.body.data?.['id']);
  await expectStatus('a second tap is the same request', WAITER, 'POST', `${T}/me/requests`, 201, { kind: 'CLOCKED_OUT_BY_MISTAKE', date: day(9), at: friday, note: 'I tapped Clock out by accident' });
  check('only one request exists', (await prisma.timeRequest.count({ where: { employeeId: waiter.id, kind: 'CLOCKED_OUT_BY_MISTAKE' } })) === 1);
  for (const [who, status] of [[WAITER, 403], [ACCOUNTANT, 403], [DIRECTOR, 403], [HIGHWAY, 404]] as const) await expectStatus('answer the request', who, 'POST', `${T}/requests/${rid}/decision`, status, { outcome: 'APPROVE' });
  const inbox = await expectStatus('Branch Manager reads the inbox', BM, 'GET', `${T}/requests?siteId=${townId}`, 200);
  check('the request is waiting in the inbox', JSON.stringify(inbox.body.data).includes(rid));
  await expectStatus('Branch Manager accepts it', BM, 'POST', `${T}/requests/${rid}/decision`, 200, { outcome: 'APPROVE', reason: 'Checked with the till' });
  check('the correction exists (a new row pointing at the old clock-out)', (await prisma.clockEvent.count({ where: { employeeId: waiter.id, type: 'CORRECTION' } })) === 1);
  const myList = await expectStatus('My requests shows the answer', WAITER, 'GET', `${T}/me/requests`, 200);
  const answered = ((myList.body.data?.['requests'] as Body[]) ?? []).find((r) => r['id'] === rid);
  check('with before and after', answered?.['state'] === 'APPROVED' && JSON.stringify(answered['answerAfter']).includes('"before"') && JSON.stringify(answered['answerAfter']).includes('"after"'), JSON.stringify(answered));
  const second = await expectStatus('the waiter reports the rota', WAITER, 'POST', `${T}/me/requests`, 201, { kind: 'ROTA_WRONG', date: day(7), note: 'I was not rostered on Wednesday' });
  await prisma.timeRequest.update({ where: { id: String(second.body.data?.['id']) }, data: { createdAt: new Date(Date.now() - 4 * 86_400_000) } }); // proof only: it has waited four days
  const escalated = await sweepTimesheets();
  const again = await sweepTimesheets();
  check('three days on, the unanswered request moves to HR, once', escalated.escalated === 1 && again.escalated === 0 && escalated.closed === 0, JSON.stringify([escalated, again]));
  const seenByHr = await expectStatus('HR opens it', HR, 'GET', `${T}/requests/${second.body.data?.['id']}`, 200);
  check('it reads "escalated to HR"', seenByHr.body.data?.['escalatedToHr'] === true && seenByHr.body.data?.['waitingOnRole'] === 'HR_MANAGER');
  await expectStatus('HR declines it with a reason', HR, 'POST', `${T}/requests/${second.body.data?.['id']}/decision`, 200, { outcome: 'DECLINE', reason: 'The rota shows you on' });

  out('\n== 5. the cut-off: closing, a refused fix, HR\'s reopen, closing early, the signature');
  check('before the cut-off nothing closes', (await sweepTimesheets()).closed === 0 && (await prisma.timesheetPeriod.findUniqueOrThrow({ where: { id: period.id } })).state === 'OPEN');
  await prisma.timesheetPeriod.update({ where: { id: period.id }, data: { cutoffAt: new Date(Date.now() - 60_000) } });
  check('after the cut-off the job closes it by itself', (await sweepTimesheets()).closed === 1 && (await prisma.timesheetPeriod.findUniqueOrThrow({ where: { id: period.id } })).closeKind === 'AUTO');
  const lenaOut = await prisma.clockEvent.findFirstOrThrow({ where: { employeeId: lena.id, shiftDate: toDateColumn(day(5)), type: 'OUT' } });
  const fix = { employeeId: lena.id, date: day(5), action: 'EDIT', eventId: lenaOut.id, at: at(day(5), '14:00').toISOString(), reason: 'A late fix' };
  await expectStatus('a clock fix in the closed period is refused', BM, 'POST', '/workforce/attendance/fixes', 409, fix);
  await expectStatus('even for HR', HR, 'POST', '/workforce/attendance/fixes', 409, fix);
  await expectStatus('the Branch Manager cannot reopen', BM, 'POST', `${P}/reopen`, 403, { reason: 'I want to' });
  const report = await expectStatus('the closed report (TSH)', ACCOUNTANT, 'GET', `${P}/report`, 200);
  check('numbered, closed automatically, no pay figure', /^TSH-\d{4}$/.test(String(report.body.data?.['number'])) && JSON.stringify(report.body.data).includes('"automatically":true') && !/amount|salary|rate/i.test(JSON.stringify(report.body.data)));
  await expectStatus('HR reopens with a reason', HR, 'POST', `${P}/reopen`, 200, { reason: 'Lena\'s Monday clock-out needs a fix' });
  await expectStatus('the same fix now previews', BM, 'POST', '/workforce/attendance/fixes/preview', 200, fix);
  await expectStatus('the Branch Manager closes early', BM, 'POST', `${P}/close`, 200, { confirmCarry: false });
  check('the close is recorded as early', (await prisma.timesheetPeriod.findUniqueOrThrow({ where: { id: period.id } })).closeKind === 'EARLY');
  await expectStatus('a wrong PIN signs nothing', MANAGER, 'POST', `${P}/sign`, 401, { pin: '0000' });
  await expectStatus('the Accountant cannot sign', ACCOUNTANT, 'POST', `${P}/sign`, 403, { pin: PIN });
  await expectStatus('the Branch Manager signs with their PIN', MANAGER, 'POST', `${P}/sign`, 200, { pin: PIN });
  await expectStatus('signing twice is refused', MANAGER, 'POST', `${P}/sign`, 409, { pin: PIN });
  const signed = await call(HR, 'GET', `${P}/report`);
  check('the report shows who signed', JSON.stringify(signed.body.data?.['signatures']).includes(`${TAG} Manager`), JSON.stringify(signed.body.data?.['signatures']));
  check('the audit entry for the signature never holds the PIN', !JSON.stringify(await prisma.auditEntry.findMany({ where: { companyId, action: 'timesheet.period_signed' }, orderBy: { seq: 'desc' }, take: 1, select: { before: true, after: true, reason: true } })).includes(PIN));

  out('\n== 6. integrity, then the branch goes back to off');
  const entries = await prisma.auditEntry.findMany({ where: { companyId }, orderBy: { seq: 'asc' } });
  const chain = verifyAuditChain(entries.map((row) => ({ ...row, category: row.category as AuditCategoryCode, channel: row.channel as AuditEntryRecord['channel'], before: row.before as AuditEntryRecord['before'], after: row.after as AuditEntryRecord['after'] })));
  check('the audit chain verifies', chain.ok === true, JSON.stringify(chain, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  check('no legacy row changed (shifts, assignments, clock records, payslips)', (await legacy()) === legacyBefore, `${legacyBefore} -> ${await legacy()}`);
  await expectStatus('Director switches Nyeri Town off', DIRECTOR, 'PUT', '/workforce/attendance/switch', 200, { siteId: townId, enabled: false });
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
