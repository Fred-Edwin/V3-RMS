/**
 * Workforce Segment 1A: a branch-sized demo of timesheets on the LANE database, for a browser walkthrough. Not a test.
 *   up    makes 24 people in Nyeri Town (Kitchen, Pastry, Barista, Service), a morning and an afternoon shift, a rota and clock events
 *         for all of September 2026 (to approve) and 1 to 18 October (open): mostly on time, some late, a few days of overtime to decide,
 *         one shift left open (a clock-out to fix), a couple of absences, one person who joined mid-month; a Branch Manager login with
 *         a PIN; switches Nyeri Town on; and opens both months so the days are assembled. September is left UNAPPROVED.
 *   down  removes everything `up` made and switches the branch off again (the audit entries stay: the log is append-only).
 * Logins (password123): demo.bm@wendo.test (PIN 4321), hr@, accountant@, director@, admin@wendo.test.
 * Usage: pnpm exec tsx src/scripts/timesheets-demo-seed.ts up|down
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { instantAt, parseClockTime, toDateColumn, weekStart, type NairobiDate } from '../modules/workforce';
import { hashPassword, hashPin } from '../utils/password';

const API = `${process.env['API'] ?? 'http://localhost:4102'}/api/v1`;
const BM_EMAIL = 'demo.bm@wendo.test';
const TOWN_BM = 'bm.town@wendo.test';
const PREFIX = 'ZZD-';
const out = (line: string): void => void process.stdout.write(`${line}\n`);

const NAMES: [string, string][] = [
  ['Grace Wanjiru', 'KITCHEN'], ['Peter Kamau', 'KITCHEN'], ['Mary Njeri', 'KITCHEN'], ['John Mwangi', 'KITCHEN'], ['Esther Wambui', 'KITCHEN'], ['Samuel Kariuki', 'KITCHEN'], ['Lucy Wangari', 'KITCHEN'],
  ['Joseph Maina', 'PASTRY'], ['Alice Nyambura', 'PASTRY'], ['Daniel Gitau', 'PASTRY'], ['Ruth Wairimu', 'PASTRY'],
  ['Cynthia Muthoni', 'BARISTA'], ['Brian Kiprop', 'BARISTA'], ['Faith Chebet', 'BARISTA'], ['Dennis Otieno', 'BARISTA'], ['Mercy Akinyi', 'BARISTA'], ['Kevin Mutua', 'BARISTA'],
  ['Susan Wafula', 'SERVICE'], ['Victor Njoroge', 'SERVICE'], ['Beatrice Atieno', 'SERVICE'], ['Isaac Kimani', 'SERVICE'], ['Naomi Jepkorir', 'SERVICE'], ['Paul Odhiambo', 'SERVICE'], ['Joy Chepkoech', 'SERVICE'],
];

const pad = (n: number): string => String(n).padStart(2, '0');
const ymd = (month: number, d: number): NairobiDate => `2026-${pad(month)}-${pad(d)}` as NairobiDate;
const weekday = (date: string): number => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = Monday

/** A repeatable pseudo-random number in [0, 1): the same demo every time. */
const rnd = (seed: number): number => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};
const clockText = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

async function down(): Promise<void> {
  const people = await prisma.employee.findMany({ where: { employeeNumber: { startsWith: PREFIX } }, select: { id: true } });
  const ids = people.map((p) => p.id);
  const town = await prisma.user.findUniqueOrThrow({ where: { email: TOWN_BM }, select: { siteId: true } });
  await prisma.timeRequest.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.timesheetPeriod.deleteMany({ where: { siteId: town.siteId as string } });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('workforce.allow_clock_edits', 'on', true)`; // the events table is append-only; this is the dev teardown door
    await tx.clockEvent.deleteMany({ where: { employeeId: { in: ids } } });
  });
  await prisma.rotaEntry.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.rotaWeek.deleteMany({ where: { carriedFromLegacy: false, entries: { none: {} } } });
  await prisma.shiftTemplate.deleteMany({ where: { name: { startsWith: 'Demo ' } } });
  await prisma.attendanceSiteSwitch.deleteMany({});
  await prisma.employee.deleteMany({ where: { employeeNumber: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: BM_EMAIL } });
  out(`removed the demo (${ids.length} people, their clock events and rota rows, the months, the switch row and the demo manager)`);
}

async function token(email: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'password123' }) });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (!json.data?.accessToken) throw new Error(`login failed for ${email}`);
  return json.data.accessToken;
}

async function up(): Promise<void> {
  const town = await prisma.user.findUniqueOrThrow({ where: { email: TOWN_BM }, select: { siteId: true, site: { select: { companyId: true } } } });
  const townId = town.siteId as string;
  const companyId = town.site!.companyId;
  const departments = new Map<string, string>((await prisma.department.findMany({ where: { siteId: townId } })).map((d) => [d.key ?? '', d.id]));

  await prisma.user.create({ data: { name: 'Faith Njeri', email: BM_EMAIL, passwordHash: await hashPassword('password123'), pinHash: await hashPin('4321'), role: 'MANAGER', siteId: townId } });
  const morning = await prisma.shiftTemplate.create({ data: { companyId, siteId: townId, name: 'Demo Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 } });
  const afternoon = await prisma.shiftTemplate.create({ data: { companyId, siteId: townId, name: 'Demo Afternoon', colour: 'AMBER', startTime: '14:00', endTime: '22:00', unpaidBreakMinutes: 0 } });

  // The few days the manager has to deal with (person index, date, what happened).
  const overtime = new Map<string, number>([['11:2026-09-12', 40], ['16:2026-09-18', 55], ['19:2026-09-25', 70], ['3:2026-09-26', 35], ['14:2026-10-12', 45]]);
  const openShift = new Set(['5:2026-09-17']);
  const absent = new Set(['8:2026-09-10', '20:2026-09-22', '12:2026-10-07']);
  const earlyLeave = new Map<string, number>([['17:2026-09-14', 120]]);

  let entries = 0;
  let events = 0;
  const today = '2026-10-19';
  for (let i = 0; i < NAMES.length; i++) {
    const [name, key] = NAMES[i]!;
    const joined = i === 23 ? '2026-09-14' : '2026-09-01';
    const emp = await prisma.employee.create({
      data: { companyId, siteId: townId, employeeNumber: `${PREFIX}${i + 1}`, name, departmentId: departments.get(key)!, payType: 'MONTHLY_SALARY', startDate: toDateColumn(joined as NairobiDate), status: 'ACTIVE', tracksTime: true, userId: null },
    });
    const template = i % 2 === 0 ? morning : afternoon;
    const [start, end] = i % 2 === 0 ? [360, 840] : [840, 1320];
    const rest = [(i % 7) + 1, ((i + 3) % 7) + 1];
    const weeks = new Map<string, string>();
    const entryRows: { weekId: string; siteId: string; employeeId: string; date: Date; templateId: string; dateText: string }[] = [];
    const eventRows: { siteId: string; employeeId: string; shiftDate: Date; type: 'IN' | 'OUT'; source: 'PHONE'; occurredAt: Date; serverAt: Date; dateText: string }[] = [];
    for (const [month, last] of [[9, 30], [10, 18]] as const) {
      for (let d = 1; d <= last; d++) {
        const date = ymd(month, d);
        if (date < joined || date >= today || rest.includes(weekday(date))) continue;
        const wk = weekStart(date, 1);
        const wkKey = String(wk);
        if (!weeks.has(wkKey)) {
          const on = { siteId: townId, departmentId: departments.get(key)!, weekStart: toDateColumn(wk) };
          const week = (await prisma.rotaWeek.findFirst({ where: on, select: { id: true } })) ?? (await prisma.rotaWeek.create({ data: on, select: { id: true } }));
          weeks.set(wkKey, week.id);
        }
        entryRows.push({ weekId: weeks.get(wkKey)!, siteId: townId, employeeId: emp.id, date: toDateColumn(date), templateId: template.id, dateText: date });
        const tag = `${i}:${date}`;
        if (absent.has(tag)) continue;
        const r = rnd(i * 1000 + month * 40 + d);
        const lateBy = r < 0.1 ? 8 + Math.floor(rnd(i + d) * 20) : Math.floor(rnd(i * 7 + d) * 6) - 3; // mostly -3..+2 min, one day in ten late
        const extra = overtime.get(tag) ?? 0;
        const leaveEarly = earlyLeave.get(tag) ?? 0;
        const inAt = start + lateBy;
        const outAt = end - leaveEarly + extra + Math.floor(rnd(i * 13 + d) * 6) - 1;
        const times: ['IN' | 'OUT', number][] = [['IN', inAt]];
        if (!openShift.has(tag)) times.push(['OUT', outAt]);
        for (const [type, minutes] of times) {
          const at = instantAt(date, parseClockTime(clockText(minutes)));
          eventRows.push({ siteId: townId, employeeId: emp.id, shiftDate: toDateColumn(date), type, source: 'PHONE', occurredAt: at, serverAt: at, dateText: date });
        }
      }
    }
    await prisma.rotaEntry.createMany({ data: entryRows.map(({ dateText: _t, ...row }) => row) });
    const saved = await prisma.rotaEntry.findMany({ where: { employeeId: emp.id }, select: { id: true, date: true } });
    const entryOf = new Map(saved.map((e) => [e.date.toISOString().slice(0, 10), e.id]));
    await prisma.clockEvent.createMany({ data: eventRows.map(({ dateText, ...row }) => ({ ...row, rotaEntryId: entryOf.get(dateText) ?? null })) });
    entries += entryRows.length;
    events += eventRows.length;
  }
  out(`seeded ${NAMES.length} people, ${entries} rota shifts and ${events} clock events`);

  const admin = await token('admin@wendo.test');
  const on = await fetch(`${API}/workforce/attendance/switch`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${admin}` }, body: JSON.stringify({ siteId: townId, enabled: true }) });
  out(`switch on: ${on.status}`);
  await prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabledAt: new Date('2026-09-01T00:00:00Z') } });
  const bm = await token(BM_EMAIL);
  const read = (path: string) => fetch(`${API}/workforce/timesheets${path}?site=${townId}`, { headers: { authorization: `Bearer ${bm}` } });
  await read('/months'); // creates the current month
  await prisma.timesheetPeriod.create({ data: { siteId: townId, startDate: toDateColumn(ymd(9, 1)), endDate: toDateColumn(ymd(9, 30)), label: 'September 2026', cutoffAt: instantAt('2026-10-01' as NairobiDate, parseClockTime('00:00')) } });
  for (const key of ['2026-09', '2026-10']) {
    const res = await read(`/months/${key}`);
    const body = (await res.json()) as { data?: { state?: string; needsYou?: { total?: number }; kpis?: { headcount?: number; workedMinutes?: number } } };
    out(`${key}: ${res.status} ${body.data?.state} people ${body.data?.kpis?.headcount} worked ${Math.round((body.data?.kpis?.workedMinutes ?? 0) / 60)} h, needs you ${body.data?.needsYou?.total}`);
  }
  out('\nDone. Log in as demo.bm@wendo.test / password123 (PIN 4321). September is left unapproved.');
}

const mode = process.argv[2];
(mode === 'up' ? up() : mode === 'down' ? down() : Promise.reject(new Error('Usage: timesheets-demo-seed.ts up|down')))
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
