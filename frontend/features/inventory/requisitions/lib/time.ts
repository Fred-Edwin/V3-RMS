/** Times and dates as Paper writes them, in Africa/Nairobi: "1:52 pm", "Wed 7 Oct", "Wednesday 7 October · 1:40 pm". */
const ZONE = 'Africa/Nairobi';

const parts = (iso: string, options: Intl.DateTimeFormatOptions): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, ...options }).formatToParts(new Date(iso))) out[p.type] = p.value;
  return out;
};

export const timeText = (iso: string): string => {
  const p = parts(iso, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toLowerCase()}`;
};

export const shortDateText = (iso: string): string => {
  const p = parts(iso, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${p.weekday} ${p.day} ${p.month}`;
};

export const longDateText = (iso: string): string => {
  const p = parts(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${p.weekday} ${p.day} ${p.month}`;
};

/** "Thu 8 Oct 2026" for the History header. */
export const fullDateText = (iso: string): string => {
  const p = parts(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
};

/** "Wed 7 Oct · 6:40 am" */
export const dateTimeText = (iso: string): string => `${shortDateText(iso)} · ${timeText(iso)}`;
