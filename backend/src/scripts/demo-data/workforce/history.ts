/** Three months of rota and clock history for the two branches (1 Aug to 20 Oct 2026). Repeatable: the same days every run. */
import { prisma } from '../../../config/database';
import { instantAt, parseClockTime, toDateColumn, weekStart, type NairobiDate } from '../../../modules/workforce';
import { out, type World } from './base';
import { PEOPLE } from './roster';

export const FIRST_DAY = '2026-08-01';
export const LAST_DAY = '2026-10-20'; // "yesterday" in the demo: today is 21 October
const pad = (n: number): string => String(n).padStart(2, '0');
export const weekday = (d: string): number => ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = Monday
export const rnd = (seed: number): number => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};
export const clock = (m: number): string => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Extra minutes worked after the shift (overtime for a manager to decide), by "person:date". */
const OVERTIME = new Map<string, number>([
  ['peter.kamau:2026-08-14', 60], ['cynthia.muthoni:2026-08-22', 45], ['esther.wambui:2026-08-29', 70],
  ['susan.wafula:2026-09-12', 40], ['brian.kiprop:2026-09-18', 55], ['samuel.kariuki:2026-09-25', 65], ['naomi.jepkorir:2026-09-26', 35],
  ['victor.mutua:2026-10-12', 45],
]);
const ABSENT = new Set(['isaac.kimani:2026-08-19', 'dennis.otieno:2026-09-10', 'paul.odhiambo:2026-09-22', 'mary.njeri:2026-10-07']);
const OPEN_SHIFT = new Set(['brian.kiprop:2026-10-20']); // clocked in, never clocked out: the Today board and fixing time have something to show

export async function seedHistory(world: World): Promise<void> {
  const templates = new Map<string, { morning: string; afternoon: string }>();
  for (const key of ['TOWN', 'HIGHWAY'] as const) {
    const siteId = world.siteIds[key];
    const base = { companyId: world.companyId, siteId, unpaidBreakMinutes: 0 };
    const morning = await prisma.shiftTemplate.create({ data: { ...base, name: 'Morning', letter: 'M', colour: 'BLUE', startTime: '06:00', endTime: '14:00' } });
    const afternoon = await prisma.shiftTemplate.create({ data: { ...base, name: 'Afternoon', letter: 'A', colour: 'AMBER', startTime: '14:00', endTime: '22:00' } });
    templates.set(key, { morning: morning.id, afternoon: afternoon.id });
    await prisma.attendanceSiteSwitch.create({ data: { siteId, enabled: true, enabledAt: new Date(`${FIRST_DAY}T00:00:00Z`) } });
  }

  let shifts = 0;
  let events = 0;
  const staff = PEOPLE.filter((p) => p.dept && p.site !== 'HUB');
  for (const [i, p] of staff.entries()) {
    const employeeId = world.employeeIds.get(p.email)!;
    const siteId = world.siteIds[p.site];
    const departmentId = world.departments.get(`${p.site}:${p.dept}`)!;
    const t = templates.get(p.site)!;
    const early = i % 2 === 0;
    const [start, end] = early ? [360, 840] : [840, 1320];
    const rest = [(i % 7) + 1, ((i + 3) % 7) + 1];
    const weeks = new Map<string, string>();
    const entryRows: { weekId: string; siteId: string; employeeId: string; date: Date; templateId: string; day: string }[] = [];
    const eventRows: { siteId: string; employeeId: string; shiftDate: Date; type: 'IN' | 'OUT'; source: 'PHONE'; occurredAt: Date; serverAt: Date; day: string }[] = [];
    for (let m = 8; m <= 10; m++) {
      for (let d = 1; d <= (m === 10 ? 20 : m === 9 ? 30 : 31); d++) {
        const day = `2026-${pad(m)}-${pad(d)}`;
        if (day < p.start || rest.includes(weekday(day))) continue;
        const wk = weekStart(day as NairobiDate, 1);
        if (!weeks.has(String(wk))) {
          const on = { siteId, departmentId, weekStart: toDateColumn(wk) };
          weeks.set(String(wk), (await prisma.rotaWeek.findFirst({ where: on, select: { id: true } }) ?? await prisma.rotaWeek.create({ data: on, select: { id: true } })).id);
        }
        entryRows.push({ weekId: weeks.get(String(wk))!, siteId, employeeId, date: toDateColumn(day as NairobiDate), templateId: early ? t.morning : t.afternoon, day });
        const tag = `${p.email}:${day}`;
        if (ABSENT.has(tag)) continue;
        const r = rnd(i * 1000 + m * 40 + d);
        const late = r < 0.08 ? 8 + Math.floor(rnd(i + d) * 20) : Math.floor(rnd(i * 7 + d) * 6) - 3; // mostly on time, one day in twelve late
        const outAt = end + (OVERTIME.get(tag) ?? 0) + Math.floor(rnd(i * 13 + d) * 6) - 1;
        const times: ['IN' | 'OUT', number][] = [['IN', start + late]];
        if (!OPEN_SHIFT.has(tag)) times.push(['OUT', outAt]);
        for (const [type, minutes] of times) {
          const at = instantAt(day as NairobiDate, parseClockTime(clock(minutes)));
          eventRows.push({ siteId, employeeId, shiftDate: toDateColumn(day as NairobiDate), type, source: 'PHONE', occurredAt: at, serverAt: at, day });
        }
      }
    }
    await prisma.rotaEntry.createMany({ data: entryRows.map(({ day: _d, ...row }) => row) });
    const saved = await prisma.rotaEntry.findMany({ where: { employeeId }, select: { id: true, date: true } });
    const entryOf = new Map(saved.map((e) => [e.date.toISOString().slice(0, 10), e.id]));
    await prisma.clockEvent.createMany({ data: eventRows.map(({ day, ...row }) => ({ ...row, rotaEntryId: entryOf.get(day) ?? null })) });
    shifts += entryRows.length;
    events += eventRows.length;
  }
  out(`seeded ${shifts} rota shifts and ${events} clock events (1 Aug to 20 Oct), attendance switched on for both branches`);
}
