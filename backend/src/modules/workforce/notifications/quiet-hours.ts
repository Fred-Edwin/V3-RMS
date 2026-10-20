import { addDays, instantAt, minutesOfDay, nairobiClockOf, nairobiDateOf, parseClockTime } from '../_shared/time/nairobi-time';
import type { NotificationTone } from './notification-types';

const START = minutesOfDay(parseClockTime('22:00'));
const END = minutesOfDay(parseClockTime('05:00'));

/** 22:00 to 05:00 Nairobi. */
export function inQuietHours(now: Date): boolean {
  const minutes = minutesOfDay(nairobiClockOf(now));
  return minutes >= START || minutes < END;
}

/** The next 05:00 Nairobi at or after `now`. */
export function nextQuietHoursEnd(now: Date): Date {
  const today = nairobiDateOf(now);
  const five = instantAt(today, parseClockTime('05:00'));
  return five.getTime() > now.getTime() ? five : instantAt(addDays(today, 1), parseClockTime('05:00'));
}

/** Only an `information` push is held. A change, a thing to look at, a result and every problem goes at once (SD13). */
export const isHeldInQuietHours = (tone: NotificationTone, now: Date): boolean => tone === 'information' && inQuietHours(now);
