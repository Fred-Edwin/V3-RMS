/** Plain-words formatters for rule values and days. Pure; the screens hold no wording of their own for these. */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parts = (day: string): { y: number; m: number; d: number; weekday: number } => {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};

/** "Mon 2 Nov 2026" */
export function longDay(day: string): string {
  const { y, m, d, weekday } = parts(day);
  return `${DAYS[weekday]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2 Nov 2026" */
export function shortDay(day: string): string {
  const { y, m, d } = parts(day);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Tue 20 Oct" */
export function dayAndMonth(day: string): string {
  const { m, d, weekday } = parts(day);
  return `${DAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
}

/** "19 Oct 2026" from an ISO instant, in Nairobi. */
export function instantDay(iso: string): string {
  const nairobi = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return shortDay(nairobi.toISOString().slice(0, 10));
}

export const isoWeekdayOf = (day: string): number => {
  const w = parts(day).weekday;
  return w === 0 ? 7 : w;
};

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Hours that divide into whole days read as days (D13). */
export function hoursAsDays(hours: number): string {
  return hours % 24 === 0 ? plural(hours / 24, 'day', 'days') : plural(hours, 'hour', 'hours');
}

export const minutesWords = (minutes: number): string => `${minutes} min`;

/** 720 minutes -> "12 h"; 750 -> "12.5 h". */
export function minutesAsHours(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

export const grouped = (value: string | number): string => {
  const [whole = '', fraction] = String(value).split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? withCommas : `${withCommas}.${fraction}`;
};

/** "112.50" from a daily rate: the hourly rate over 8 hours, shown to 2 decimals (D16). */
export const perHourOver8 = (dailyRate: string): string => (Number(dailyRate) / 8).toFixed(2);

/** "1.5 ×": trailing zeros dropped, one decimal kept. */
export function multiplierWords(value: string | null): string {
  if (value === null) return 'Not set';
  const n = Number(value);
  return `${Number.isInteger(n) ? n.toFixed(1) : String(n)} ×`;
}

export const ROLE_NAMES: Record<string, string> = {
  DIRECTOR: 'Director',
  HR_MANAGER: 'HR',
  ACCOUNTANT: 'Accountant',
  MANAGER: 'Branch Manager',
  STORE_MANAGER: 'Branch Manager',
  BRANCH_MANAGER: 'Branch Manager',
  SYSTEM_ADMIN: 'System Admin',
  DEPARTMENT_HEAD: 'Department head',
};

/** "the Director", "HR", "the Branch Manager of Nyeri Town" (Spec section 3). */
export function roleInSentence(role: string, siteName?: string): string {
  if (role === 'HR_MANAGER') return 'HR';
  const name = ROLE_NAMES[role] ?? role;
  return siteName ? `the ${name} of ${siteName}` : `the ${name}`;
}

/** A display name sometimes carries a role in brackets ("Anne Muthoni (Accountant)"); sentences show the name and the role once (D24). */
export const plainName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '');

export const unique =<T>(items: readonly T[]): T[] => items.filter((item, i) => items.indexOf(item) === i);

/** "A, B or C" */
export function orList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** "A, B and C" */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const TOLD_PLURAL: Record<string, string> = { BRANCH_MANAGER: 'Branch Managers', DEPARTMENT_HEAD: 'department heads', HR_MANAGER: 'HR', DIRECTOR: 'the Director', ACCOUNTANT: 'the Accountant' };

/** "The 4 Branch Managers, HR and the Accountant" from the preview's counts. */
export function toldPhrase(told: readonly { role: string; count?: number }[]): string {
  const bits = told.map(({ role, count }) => {
    if (role === 'BRANCH_MANAGER' || role === 'DEPARTMENT_HEAD') {
      const one = role === 'BRANCH_MANAGER' ? 'the Branch Manager' : 'the department head';
      return count === undefined ? (TOLD_PLURAL[role] as string) : count === 1 ? one : `the ${count} ${TOLD_PLURAL[role]}`;
    }
    return TOLD_PLURAL[role] ?? roleInSentence(role);
  });
  const text = andList(bits);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
