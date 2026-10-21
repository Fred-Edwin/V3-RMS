import type { AuditArea, AuditEventCode, AuditQuery, AuditSort } from '../types/audit-log-types';

export const EVENT_CODES: readonly AuditEventCode[] = ['people', 'time', 'leave', 'pay', 'rules', 'payslips', 'documents', 'conduct', 'security'];
export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Today in Nairobi as `YYYY-MM-DD` (the log's days are Nairobi days, never the browser's). */
export function nairobiDayOf(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/** The default view: the last 30 days, newest first (spec A1). */
export function defaultQuery(today: string): AuditQuery {
  return { q: '', area: '', event: 'all', siteId: '', actorId: '', subjectUserId: '', flagged: false, from: addDays(today, -29), to: today, sort: 'newest', page: 1, pageSize: DEFAULT_PAGE_SIZE };
}

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback);
const uuid = (value: string | null): string => (value && UUID.test(value) ? value : '');
const clampDay = (value: string, today: string): string => (value > today ? today : value);
const day = (value: string | null, fallback: string): string => (value && DAY.test(value) ? value : fallback);

/** Reads the address bar. Anything unknown or malformed falls back to the default, so a hand-edited link never reaches the API as a 400. */
export function queryFromParams(get: (key: string) => string | null, today: string): AuditQuery {
  const base = defaultQuery(today);
  const from = day(get('from'), base.from);
  const to = day(get('to'), base.to);
  const page = Number.parseInt(get('page') ?? '1', 10);
  const size = Number.parseInt(get('rows') ?? '', 10);
  return {
    q: (get('q') ?? '').slice(0, 80),
    area: pick<AuditArea | ''>(get('area'), ['WORKFORCE', 'ACCESS', ''], ''),
    event: pick<AuditEventCode | 'all'>(get('event'), ['all', ...EVENT_CODES], 'all'),
    siteId: uuid(get('site')),
    actorId: uuid(get('actor')),
    subjectUserId: uuid(get('about')),
    flagged: get('flagged') === '1',
    // From after To swaps silently (spec A2), and no day is later than today.
    from: clampDay(from > to ? to : from, today),
    to: clampDay(from > to ? from : to, today),
    sort: pick<AuditSort>(get('sort'), ['newest', 'oldest'], 'newest'),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? (size as 25 | 50 | 100) : DEFAULT_PAGE_SIZE,
  };
}

/** The address-bar form: only what differs from the default, so a plain link stays short. */
export function paramsFromQuery(q: AuditQuery, today: string): URLSearchParams {
  const base = defaultQuery(today);
  const p = new URLSearchParams();
  if (q.q.trim()) p.set('q', q.q.trim());
  if (q.area) p.set('area', q.area);
  if (q.event !== 'all') p.set('event', q.event);
  if (q.siteId) p.set('site', q.siteId);
  if (q.actorId) p.set('actor', q.actorId);
  if (q.subjectUserId) p.set('about', q.subjectUserId);
  if (q.flagged) p.set('flagged', '1');
  if (q.from !== base.from) p.set('from', q.from);
  if (q.to !== base.to) p.set('to', q.to);
  if (q.sort !== 'newest') p.set('sort', q.sort);
  if (q.page > 1) p.set('page', String(q.page));
  if (q.pageSize !== DEFAULT_PAGE_SIZE) p.set('rows', String(q.pageSize));
  return p;
}

/** True when anything but the default view is on (the "Clear filters" button shows). */
export function isFiltered(q: AuditQuery, today: string): boolean {
  const base = defaultQuery(today);
  return Boolean(q.q.trim() || q.area || q.event !== 'all' || q.siteId || q.actorId || q.subjectUserId || q.flagged || q.from !== base.from || q.to !== base.to);
}

/** The page the pager shows past page 200: the API needs dates beyond it for a range over 90 days ("Choose dates to go further."). */
export const DEEP_PAGE = 200;
