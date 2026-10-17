/**
 * The words at the top of Home that need only the clock and the person's name. Nairobi time, whatever the device says (Workforce
 * rule: all time maths is Nairobi time). The counts that Paper's sentence adds ("11 things are waiting...") come from slices, not here.
 */
const ZONE = 'Africa/Nairobi';

export type DayPart = 'morning' | 'afternoon' | 'evening';

const hourInNairobi = (now: Date): number => Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', hour12: false }).format(now)) % 24;

export function dayPartOf(now: Date): DayPart {
  const h = hourInNairobi(now);
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

/** "Good morning, Mercy": the first word of the name. */
export function greetingFor(now: Date, fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first ? `Good ${dayPartOf(now)}, ${first}` : `Good ${dayPartOf(now)}`;
}

/** "Sunday 4 October". */
export function homeDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long' }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`;
}

/** "10:42". */
export function homeClock(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}
