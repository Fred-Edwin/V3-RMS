const WHEN = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' });

/** "Fri 23 Oct, 14:05" in Nairobi time, built from parts so the punctuation never depends on the browser's locale. */
function whenLabel(date: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes): string => WHEN.formatToParts(date).find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`;
}

/**
 * What the hiring manager reads on the front of a file they just hired: "You can correct this until Fri 23 Oct, 14:05; after that ask HR."
 * `correctUntil` is the server's end of the 24-hour window; null (HR, not their hire, or over) draws nothing.
 */
export function correctionNote(correctUntil: string | null, now: Date = new Date()): string | null {
  if (!correctUntil) return null;
  const end = new Date(correctUntil);
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return null;
  return `You can correct this until ${whenLabel(end)}; after that ask HR.`;
}
