import { addDays, nairobiToday, weekStart, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { buildPersonDay } from '../days/person-day';
import { leftoversFor, type Leftover } from '../prompt/leftovers-service';
import { switchRepository } from '../switch/switch-repository';
import { currentOf, myEntryOf, noticesOf, weekBars, type MyEntry, type MyNotice, type WeekBar } from './my-day-view';

const LOOKAHEAD_DAYS = 28;
const NOTICE_LOOKBACK_DAYS = 2;

export interface MyDayView {
  /** False: this branch still clocks the old way (or the person has no file); the screen keeps the old clock. */
  enabled: boolean;
  serverNow: string;
  date?: NairobiDate;
  siteName?: string;
  rules?: { clockInOpensMinutesBefore: number; undoWindowSeconds: number; shiftEndHeadsUpMinutes: number; shiftEndPromptRepeatMinutes: number; autoCloseAfterMinutes: number };
  /** The card: the shift being worked, else the next one waiting today, else the last one of the day. */
  current: MyEntry | null;
  today: MyEntry[];
  /** The next shift on the rota when today has nothing left to clock. */
  next: { date: NairobiDate; templateName: string; startTime: string; endTime: string } | null;
  week: { first: NairobiDate; last: NairobiDate; plannedMinutes: number; workedMinutes: number; days: WeekBar[] };
  /** What is left in the person's own job; only filled once the shift-end prompt is due. */
  leftovers: Leftover[];
  notices: MyNotice[];
}

const EMPTY_WEEK = { first: '' as NairobiDate, last: '' as NairobiDate, plannedMinutes: 0, workedMinutes: 0, days: [] };

/** "My day" for the phone's clock card (Chapter 6). Reads only; nothing here writes. */
export async function myDay(subject: AccessSubject, now: Date = new Date()): Promise<MyDayView> {
  const off: MyDayView = { enabled: false, serverNow: now.toISOString(), current: null, today: [], next: null, week: EMPTY_WEEK, leftovers: [], notices: [] };
  const person = await daysRepository.personByUserId(subject.id);
  if (!person || !person.tracksTime || !(await switchRepository.isEnabled(person.siteId))) return off;

  const today = nairobiToday(now);
  const [rules, weekRule, site] = await Promise.all([
    attendanceRulesFor(person.siteId, today),
    getEffectiveRuleGroup(person.siteId, today, 'WEEK_AND_BREAKS'),
    daysRepository.siteFacts(person.siteId),
  ]);
  const first = weekStart(today, weekRule.values.weekStartsOn);
  const last = addDays(first, 6);
  const from = [first, addDays(today, -NOTICE_LOOKBACK_DAYS)].sort()[0] as NairobiDate;
  const data = await daysRepository.loadDayData(person.siteId, from, addDays(today, LOOKAHEAD_DAYS), [person.id]);

  const entries = buildPersonDay(person, today, data, rules, now).entries;
  const current = currentOf(entries);
  const headsUp = rules.attendance.shiftEndHeadsUpMinutes;
  const finished = !current || current.state === 'DONE' || current.state === 'AUTO_CLOSED' || current.state === 'MISSED';
  const upcoming = finished ? data.entries.filter((e) => e.date > today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0] : undefined;
  const bars = weekBars(person, first, last, today, data, rules, now);
  const recent = Array.from({ length: NOTICE_LOOKBACK_DAYS + 1 }, (_, i) => addDays(today, i - NOTICE_LOOKBACK_DAYS)).flatMap((date) => buildPersonDay(person, date, data, rules, now).entries);

  return {
    enabled: true,
    serverNow: now.toISOString(),
    date: today,
    siteName: site?.name ?? '',
    rules: {
      clockInOpensMinutesBefore: rules.attendance.clockInOpensMinutesBefore,
      undoWindowSeconds: rules.attendance.undoWindowSeconds,
      shiftEndHeadsUpMinutes: headsUp,
      shiftEndPromptRepeatMinutes: rules.attendance.shiftEndPromptRepeatMinutes,
      autoCloseAfterMinutes: rules.attendance.autoCloseAfterMinutes,
    },
    current: current ? myEntryOf(current, now, headsUp) : null,
    today: entries.map((e) => myEntryOf(e, now, headsUp)),
    next: upcoming ? { date: upcoming.date, templateName: upcoming.templateName, startTime: upcoming.startTime, endTime: upcoming.endTime } : null,
    week: { first, last, plannedMinutes: bars.reduce((s, b) => s + b.plannedMinutes, 0), workedMinutes: bars.reduce((s, b) => s + b.workedMinutes, 0), days: bars },
    leftovers: current && (current.state === 'PROMPT_DUE' || current.state === 'STAYING_ON') ? await leftoversFor(subject.role, person.siteId, subject.id) : [],
    notices: noticesOf(recent),
  };
}
