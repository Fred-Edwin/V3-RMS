import { getTodayYmdInTimeZone, toYmdInTimeZone } from '@/lib/date';

export interface StripDay {
  ymd: string;
  /** "Mon", "Tue", … */
  weekday: string;
  /** Day of month, e.g. 19. */
  dom: number;
  isToday: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** The Monday on or before `date` (the strip runs Mon–Sun, matching the artboard). */
const mondayOf = (date: Date): Date => {
  const day = date.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
};

/** One Mon–Sun week of days for the strip, `today` highlighted. */
export const buildWeekStrip = (reference: Date = new Date()): StripDay[] => {
  const todayYmd = getTodayYmdInTimeZone();
  const monday = mondayOf(reference);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const ymd = toYmdInTimeZone(date);
    return {
      ymd,
      weekday: WEEKDAYS[date.getDay()],
      dom: date.getDate(),
      isToday: ymd === todayYmd,
    };
  });
};

/** "Tuesday, 19 Aug" from a YYYY-MM-DD. */
export const longDayLabel = (ymd: string): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekdayLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    date.getDay()
  ];
  return `${weekdayLong}, ${d} ${MONTHS[m - 1]}`;
};

/** "Tuesday" from a YYYY-MM-DD. */
export const weekdayLong = (ymd: string): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(y, m - 1, d).getDay()
  ];
};

/** "6:00 AM – 2:00 PM" from "06:00" / "14:00". */
export const formatShiftWindow = (start: string, end: string): string =>
  `${to12h(start)} – ${to12h(end)}`;

const to12h = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};
