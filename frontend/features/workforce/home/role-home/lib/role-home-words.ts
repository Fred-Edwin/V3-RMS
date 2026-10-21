/**
 * The words of the new Home that depend on numbers (Paper 1.1 to 1.13). Pure so they are tested. No role appears here: the server
 * decides what a person has, and these only turn counts into sentences.
 */

const things = (n: number): string => (n === 1 ? '1 thing needs' : `${n} things need`);

/** "14 things need you, and 1 is overdue." / "1 thing needs you." / "Nothing needs you right now." */
export function needsYouHeadline(total: number, overdue: number): string {
  if (total <= 0) return 'Nothing needs you right now.';
  if (overdue <= 0) return `${things(total)} you.`;
  const tail = overdue === 1 ? '1 is overdue' : `${overdue} are overdue`;
  return `${things(total)} you, and ${tail}.`;
}

/** The line under the greeting: "Wednesday 21 October." then, when the person has a Needs you list, its headline. */
export const greetingLine = (dateText: string, headline: string | null): string => (headline ? `${dateText}. ${headline}` : `${dateText}.`);

/** The section heading's small grey line: "14 in 5 kinds, most urgent first". */
export const needsYouSubtitle = (total: number, kinds: number): string => `${total} in ${kinds} ${kinds === 1 ? 'kind' : 'kinds'}, most urgent first`;

/** "Showing the top 5 of 14" (only when there is more than the table shows). */
export const showingTop = (shown: number, total: number): string | null => (total > shown ? `Showing the top ${shown} of ${total}` : null);

/** The See all page's line: "14 things in 5 kinds. Overdue first, then grouped by kind." */
export const needsYouPageLine = (all: number, kinds: number): string => `${all} ${all === 1 ? 'thing' : 'things'} in ${kinds} ${kinds === 1 ? 'kind' : 'kinds'}. Overdue first, then grouped by kind.`;

/** "See all 14". */
export const seeAllLabel = (total: number): string => `See all ${total}`;

/** How long a row has waited, in the mono caps of the Since column: "TODAY", "1 DAY", "7 DAYS", "3 WEEKS". */
export function sinceWords(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return '1 DAY';
  if (days < 14) return `${days} DAYS`;
  return `${Math.floor(days / 7)} WEEKS`;
}

/** "10:05" for today, "YEST" for yesterday, "19 OCT" before that (Nairobi calendar): the time column of Latest. */
export function latestWhen(iso: string, now: Date): string {
  const zone = 'Africa/Nairobi';
  const day = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(d);
  const at = new Date(iso);
  if (day(at) === day(now)) return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  const gap = Math.round((Date.parse(day(now)) - Date.parse(day(at))) / 86_400_000);
  if (gap === 1) return 'YEST';
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: 'numeric', month: 'short' }).format(at).toUpperCase();
}

/** The bell and menu show "99+" over 99. */
export const countText = (n: number): string => (n > 99 ? '99+' : String(n));

/** Pages the Home table may open: only inside the app. */
export const safeOpens = (opens: string): string => (/^\/app(\/|\?|$)/.test(opens) ? opens : '/app/workforce');
