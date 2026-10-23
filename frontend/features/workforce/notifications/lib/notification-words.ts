import { NOTIFICATION_KIND_LABEL } from '../../_shared';
import type { NotificationArea, WorkforceNotification } from '../types/notification-types';

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

/** The chip names of the areas (sentence case; the row's mono label shows the area in capitals). */
export const AREA_LABEL: Readonly<Record<NotificationArea, string>> = {
  PAY: 'Pay',
  TIME: 'Time',
  LEAVE: 'Leave',
  PEOPLE: 'People',
  RULES: 'Rules',
  SECURITY: 'Security',
  CONDUCT: 'Conduct',
  DOCUMENTS: 'Documents',
};

/** "09:12": the clock of a row, in Nairobi. */
export function clockText(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

/** The heading of a day's rows: "TODAY", "YESTERDAY", then "MON 19 OCT" (Nairobi's calendar). */
export function dayHeading(iso: string, now: Date): string {
  const at = new Date(iso);
  const days = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(at))) / 86_400_000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  return new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, weekday: 'short', day: 'numeric', month: 'short' }).format(at).replace(',', '').toUpperCase();
}

/** Rows (already newest first) under their day headings, in order. */
export function groupByDay<T extends { createdAt: string }>(items: readonly T[], now: Date): Array<{ heading: string; items: T[] }> {
  const groups: Array<{ heading: string; items: T[] }> = [];
  for (const item of items) {
    const heading = dayHeading(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.items.push(item);
    else groups.push({ heading, items: [item] });
  }
  return groups;
}

/** "4 unread" / "1 unread" / "All read". */
export const unreadLine = (unread: number): string => (unread > 0 ? `${unread} unread` : 'All read');

/** The mono label above the title: "PAY · PROBLEM". */
export const areaKind = (row: Pick<WorkforceNotification, 'area' | 'tone'>): string => `${row.area} · ${NOTIFICATION_KIND_LABEL[row.tone].toUpperCase()}`;

/** A row's link must stay inside the app: anything else is dropped (a stored href is data, never trusted to leave the site). */
export function safeHref(href: string | null): string | null {
  if (href === null || !/^\/app(\/|\?|$)/.test(href)) return null;
  return href;
}
