const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_WORD = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';
// "9 and 23 September", "the 2nd, 9th and 16th of Sept", "on 9 Sep"
const CHAIN = new RegExp(`((?:${DAY}\\s*(?:,|and|&)\\s*)*${DAY})\\s*(?:of\\s+)?${MONTH_WORD}\\b`, 'gi');

/**
 * The days of one month an appeal's free text names ("On 9 and 23 September the bus broke down"). Only a number that sits right
 * before a month name counts, so "5 minutes" or "twice" never matches. Free text cannot be matched reliably, so a day is returned
 * only when the month named is the notice's month; anything else answers an empty list and the screen tints nothing (spec S12).
 */
export function datesNamedInText(text: string, monthKey: string): string[] {
  const monthNumber = Number(monthKey.slice(5, 7));
  const found = new Set<string>();
  for (const match of text.matchAll(CHAIN)) {
    const named = MONTHS.indexOf((match[match.length - 1] ?? '').slice(0, 3).toLowerCase()) + 1;
    if (named !== monthNumber) continue;
    for (const day of (match[1] ?? '').matchAll(/\d{1,2}/g)) {
      const n = Number(day[0]);
      if (n >= 1 && n <= 31) found.add(`${monthKey}-${String(n).padStart(2, '0')}`);
    }
  }
  return [...found].sort();
}
