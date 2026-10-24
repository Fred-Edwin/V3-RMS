/**
 * What the Schedule walk needs, on top of the three months of history: a full plan for this week and the next, one person on approved
 * leave, a day short of cover, a late arrival today, a shift open now whose end-of-shift question is about to come, a shift the phone
 * closed, a clock-out to put right, and an empty week after the next one that "Start from last week" can fill.
 * "Today" is the real day in Nairobi, so the live items depend on the time the seed is run (run it again to move them).
 */
import { prisma } from '../../../config/database';
import { instantAt, parseClockTime, toDateColumn, weekStart, type NairobiDate } from '../../../modules/workforce';
import { key, login, must, PIN } from './api';
import { out, type World } from './base';
import { LAST_DAY, clock, rnd, weekday } from './history';
import { PEOPLE } from './roster';

const addDays = (iso: string, n: number): string => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const dayNo = (iso: string): number => Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000);
const at = (day: string, minutes: number): Date => instantAt(day as NairobiDate, parseClockTime(clock(minutes)));

type Kind = 'morning' | 'afternoon' | 'midday' | 'live';
interface Slot { i: number; email: string; site: 'TOWN' | 'HIGHWAY'; dept: string; day: string; kind: Kind; start: number; end: number }
interface EventRow { employeeId: string; siteId: string; day: string; type: 'IN' | 'OUT' | 'AUTO_OUT'; source: 'PHONE' | 'SYSTEM'; minutes: number; reasonCode?: string }

const TIMES: Record<Kind, [number, number]> = { morning: [360, 840], afternoon: [840, 1320], midday: [600, 1080], live: [0, 0] };

export async function seedSchedule(world: World): Promise<void> {
  const now = new Date(Date.now() + 3 * 3_600_000); // Nairobi wall clock, read with the UTC getters
  const today = now.toISOString().slice(0, 10);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const thisMonday = addDays(today, 1 - weekday(today));
  const nextMonday = addDays(thisMonday, 7);
  const lastPlanned = addDays(nextMonday, 6);
  const firstGap = addDays(LAST_DAY, 1);

  // One person on approved leave inside next week, through the real leave routes (the grid reads it as a grey cell and a warning).
  const leaveEmail = 'cynthia.muthoni';
  const leaveDays = [addDays(nextMonday, 1), addDays(nextMonday, 2)];
  await login(leaveEmail);
  const asked = (await must('ask leave', leaveEmail, 'POST', '/workforce/leave/applications', { typeCode: 'ANNUAL', start: leaveDays[0], end: leaveDays[1] }, { 'Idempotency-Key': key('sched-ask') }))['application'] as { id: string; version?: number };
  await must('approve leave', 'bm.town', 'POST', `/workforce/leave/applications/${asked.id}/approve`, { pin: PIN, expectedVersion: asked.version ?? 1 }, { 'Idempotency-Key': key('sched-ap') });

  // Minimum cover is each Branch Manager's own setting, so each saves it for their branch (the grid warns when a day is thinner).
  const today10 = today;
  for (const [bm, site, cover] of [['bm.town', 'TOWN', { BARISTA: 2, SERVICE: 3 }], ['bm.highway', 'HIGHWAY', { SERVICE: 2 }]] as const) {
    const minimumCover = Object.fromEntries(Object.entries(cover).map(([tag, n]) => [world.departments.get(`${site}:${tag}`)!, n]));
    await must(`minimum cover ${site}`, bm, 'POST', '/workforce/rules/LEAVE/versions', { siteId: world.siteIds[site], effectiveFrom: today10, values: { minimumCover }, reason: 'Demo minimum cover', pin: PIN, idempotencyKey: key('sched-cover') });
  }

  // A Mid-day shift (Town and Highway) and a "Cover shift" that is timed to the clock the seed runs on.
  const templates = new Map<string, Record<'morning' | 'afternoon' | 'midday' | 'live', string>>();
  const liveEnd = Math.ceil((nowMin + 25) / 5) * 5; // the end-of-shift question comes about 25 minutes after the seed
  const liveStart = Math.max(360, liveEnd - 480);
  const liveOn = liveEnd <= 1435 && liveStart < nowMin - 5;
  for (const site of ['TOWN', 'HIGHWAY'] as const) {
    const siteId = world.siteIds[site];
    const base = { companyId: world.companyId, siteId };
    const morning = await prisma.shiftTemplate.findFirstOrThrow({ where: { siteId, name: 'Morning' } });
    const afternoon = await prisma.shiftTemplate.findFirstOrThrow({ where: { siteId, name: 'Afternoon' } });
    const midday = await prisma.shiftTemplate.create({ data: { ...base, name: 'Mid-day', letter: 'D', colour: 'GREEN', startTime: '10:00', endTime: '18:00', unpaidBreakMinutes: 30 } });
    const live = liveOn
      ? await prisma.shiftTemplate.create({ data: { ...base, name: 'Cover shift', letter: 'C', colour: 'GREY', startTime: clock(liveStart), endTime: clock(liveEnd), unpaidBreakMinutes: 0 } })
      : midday;
    templates.set(site, { morning: morning.id, afternoon: afternoon.id, midday: midday.id, live: live.id });
  }

  // The plan: every floor person, every day from the end of the history to the end of next week, in the same pattern as the history.
  const staff = PEOPLE.filter((p) => p.dept && p.site !== 'HUB');
  const slots: Slot[] = [];
  const forced = new Set([`victor.mutua:${leaveDays[1]}`]); // works the day Cynthia is away and Brian is off: Barista Town is one short that Wednesday
  const off = new Set([`brian.kiprop:${leaveDays[1]}`]);
  for (const [i, p] of staff.entries()) {
    const rest = [(i % 7) + 1, ((i + 3) % 7) + 1];
    for (let day = firstGap; day <= lastPlanned; day = addDays(day, 1)) {
      const tag = `${p.email}:${day}`;
      if (day < p.start || off.has(tag) || (p.email === leaveEmail && leaveDays.includes(day))) continue;
      if (rest.includes(weekday(day)) && !forced.has(tag)) continue;
      const kind: Kind = p.dept === 'SERVICE' && weekday(day) >= 6 && i % 2 === 1 ? 'midday' : i % 2 === 0 ? 'morning' : 'afternoon';
      slots.push({ i, email: p.email, site: p.site as 'TOWN' | 'HIGHWAY', dept: p.dept!, day, kind, start: TIMES[kind][0], end: TIMES[kind][1] });
    }
  }
  // Naomi (a waiter at Town) is on the Cover shift today: it ends soon after the seed, so the end-of-shift question is about to appear.
  const liveEmail = 'naomi.jepkorir';
  const liveIdx = slots.findIndex((s) => s.email === liveEmail && s.day === today);
  if (liveOn) {
    const base = { i: staff.findIndex((p) => p.email === liveEmail), email: liveEmail, site: 'TOWN' as const, dept: 'SERVICE', day: today, kind: 'live' as const, start: liveStart, end: liveEnd };
    if (liveIdx >= 0) slots[liveIdx] = base; else slots.push(base);
  }

  // Rows in the database.
  const weeks = new Map<string, string>();
  const rows = [];
  for (const s of slots) {
    const siteId = world.siteIds[s.site];
    const departmentId = world.departments.get(`${s.site}:${s.dept}`)!;
    const monday = weekStart(s.day as NairobiDate, 1);
    const wkKey = `${departmentId}:${String(monday)}`;
    if (!weeks.has(wkKey)) {
      const on = { siteId, departmentId, weekStart: toDateColumn(monday) };
      weeks.set(wkKey, (await prisma.rotaWeek.findFirst({ where: on, select: { id: true } }) ?? await prisma.rotaWeek.create({ data: on, select: { id: true } })).id);
    }
    rows.push({ weekId: weeks.get(wkKey)!, siteId, employeeId: world.employeeIds.get(s.email)!, date: toDateColumn(s.day as NairobiDate), templateId: templates.get(s.site)![s.kind] });
  }
  await prisma.rotaEntry.createMany({ data: rows, skipDuplicates: true });
  const saved = await prisma.rotaEntry.findMany({ where: { date: { gte: toDateColumn(firstGap as NairobiDate) } }, select: { id: true, employeeId: true, date: true } });
  const entryOf = new Map(saved.map((e) => [`${e.employeeId}:${e.date.toISOString().slice(0, 10)}`, e.id]));

  // Clock events for the days since the history ended, and for today up to this minute.
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const events: EventRow[] = [];
  const noteOf = new Map<string, string>();
  const eligibleToday = slots.filter((s) => s.day === today && s.kind !== 'live' && s.start <= nowMin - 12).sort((a, b) => a.i - b.i);
  const lateTown = eligibleToday.find((s) => s.site === 'TOWN');
  const notInTown = eligibleToday.filter((s) => s.site === 'TOWN')[1];
  const lateHighway = eligibleToday.find((s) => s.site === 'HIGHWAY');
  const closedPhone = slots.find((s) => s.day === yesterday && s.site === 'TOWN' && s.kind === 'afternoon' && s.email !== liveEmail);
  const wrongOut = slots.find((s) => s.day === twoDaysAgo && s.site === 'TOWN' && s.kind === 'morning');
  for (const s of slots.filter((x) => x.day >= firstGap && x.day <= today)) {
    const employeeId = world.employeeIds.get(s.email)!;
    const siteId = world.siteIds[s.site];
    const mk = (type: EventRow['type'], minutes: number, extra: Partial<EventRow> = {}): void => void events.push({ employeeId, siteId, day: s.day, type, source: 'PHONE', minutes, ...extra });
    const jitter = Math.floor(rnd(s.i * 131 + dayNo(s.day)) * 6) - 3;
    if (s.day === today) {
      if (s === notInTown) { noteOf.set(s.email, 'not in'); continue; }
      const inAt = s === lateTown ? Math.min(s.start + 22, nowMin - 1) : s === lateHighway ? Math.min(s.start + 9, nowMin - 1) : Math.min(s.start + jitter, nowMin - 1);
      if (s === lateTown) noteOf.set(s.email, 'late today');
      if (s === lateHighway) noteOf.set(s.email, 'late today');
      if (inAt >= 0) mk('IN', inAt);
      if (s.kind !== 'live' && s.end + jitter <= nowMin) mk('OUT', s.end + jitter);
      if (s.kind === 'live') noteOf.set(s.email, 'open now, Cover shift ends ' + clock(s.end));
      continue;
    }
    if (s === closedPhone) { mk('IN', s.start); mk('AUTO_OUT', s.end, { source: 'SYSTEM', reasonCode: 'NO_ANSWER' }); noteOf.set(s.email, 'shift closed by the phone'); continue; }
    if (s === wrongOut) { mk('IN', s.start + 2); mk('OUT', s.start + 320); noteOf.set(s.email, 'clock-out at 11:20, to fix'); continue; }
    mk('IN', s.start + jitter);
    mk('OUT', s.end + Math.abs(jitter));
  }
  await prisma.clockEvent.createMany({
    data: events.map((e) => ({
      siteId: e.siteId, employeeId: e.employeeId, rotaEntryId: entryOf.get(`${e.employeeId}:${e.day}`) ?? null, shiftDate: toDateColumn(e.day as NairobiDate),
      type: e.type, source: e.source, occurredAt: at(e.day, e.minutes), serverAt: at(e.day, e.minutes), ...(e.reasonCode ? { reasonCode: e.reasonCode } : {}),
    })),
  });

  out(`seeded ${slots.length} shifts and ${events.length} clock events from ${firstGap} to ${lastPlanned} (today is ${today}, ${clock(nowMin)} in Nairobi)`);
  out(`  leave: ${leaveEmail} on approved annual leave ${leaveDays[0]} to ${leaveDays[1]}; Barista Town one short on ${leaveDays[1]}`);
  for (const [who, what] of noteOf) out(`  ${who}: ${what}`);
  out(`  ${weekday(addDays(lastPlanned, 1)) === 1 ? `the week from ${addDays(lastPlanned, 1)} is empty, ready for "Start from last week"` : 'no empty week'}`);
}
