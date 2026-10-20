import { NOTIFICATION_KIND_LABEL } from '../../_shared';
import type { WorkforceNotification } from '../types/notification-types';

const NAIROBI = 'Africa/Nairobi';
const dayKey = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: NAIROBI }).format(d);

/** The short "when" of an Inbox row: "Now", "12 min", "3 h", "Yesterday", then "Mon 12 Oct" (Nairobi's calendar). */
export function whenWords(iso: string, now: Date): string {
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes} min`;
  const sameDay = dayKey(at) === dayKey(now);
  if (sameDay) return `${Math.floor(minutes / 60)} h`;
  const days = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(at))) / 86_400_000);
  if (days === 1) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, weekday: 'short', day: 'numeric', month: 'short' }).format(at);
}

/** The exact time for the hover title and screen readers: "Mon 19 Oct, 14:05". */
export function whenExact(iso: string): string {
  const at = new Date(iso);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, weekday: 'short', day: 'numeric', month: 'short' }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  return `${date}, ${time}`;
}

/** The mono label above the title: "PAY · PROBLEM". */
export const areaKind = (row: Pick<WorkforceNotification, 'area' | 'tone'>): string => `${row.area} · ${NOTIFICATION_KIND_LABEL[row.tone].toUpperCase()}`;

/** A row's link must stay inside the app: anything else is dropped (a stored href is data, never trusted to leave the site). */
export const safeHref = (href: string | null): string | null => (href !== null && /^\/app(\/|\?|$)/.test(href) ? href : null);
