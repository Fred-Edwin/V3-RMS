import type { DocumentsQuery } from '../types/documents-types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIZES = [25, 50, 100] as const;
export const DEFAULT_SIZE = 50;

export function nairobiDayOf(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const addDays = (day: string, n: number): string => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** The default view: the last 30 days, newest first. */
export const defaultQuery = (today: string): DocumentsQuery => ({ q: '', type: '', siteId: '', from: addDays(today, -29), to: today, sort: 'newest', page: 1, pageSize: DEFAULT_SIZE });

/** A selected document in the address bar is `PS-0987.2` (number, then version). */
export function parseSelected(value: string | null): { number: string; version: number } | null {
  const m = /^([A-Z0-9]{2,4}(?:-[A-Z0-9]{1,8}){1,2})\.(\d{1,3})$/.exec(value ?? '');
  return m ? { number: m[1] as string, version: Number(m[2]) } : null;
}

export const selectedKey = (number: string, version: number): string => `${number}.${version}`;

/** Reads the address bar; anything malformed falls back to the default so a hand-edited link never reaches the API as a 400. */
export function queryFromParams(get: (key: string) => string | null, today: string, types: readonly string[] | null): DocumentsQuery {
  const base = defaultQuery(today);
  const clamp = (d: string): string => (d > today ? today : d);
  const f = get('from');
  const t = get('to');
  const from = f && DAY.test(f) ? f : base.from;
  const to = t && DAY.test(t) ? t : base.to;
  const type = get('type') ?? '';
  const page = Number.parseInt(get('page') ?? '1', 10);
  const size = Number.parseInt(get('rows') ?? '', 10);
  return {
    q: (get('q') ?? '').slice(0, 60),
    type: type && (types === null || types.includes(type)) && /^[A-Z0-9]{2,4}$/.test(type) ? type : '',
    siteId: UUID.test(get('site') ?? '') ? (get('site') as string) : '',
    from: clamp(from > to ? to : from),
    to: clamp(from > to ? from : to),
    sort: get('sort') === 'oldest' ? 'oldest' : 'newest',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (SIZES as readonly number[]).includes(size) ? (size as 25 | 50 | 100) : DEFAULT_SIZE,
  };
}

/** Only what differs from the default. */
export function paramsFromQuery(q: DocumentsQuery, today: string): URLSearchParams {
  const base = defaultQuery(today);
  const p = new URLSearchParams();
  if (q.q.trim()) p.set('q', q.q.trim());
  if (q.type) p.set('type', q.type);
  if (q.siteId) p.set('site', q.siteId);
  if (q.from !== base.from) p.set('from', q.from);
  if (q.to !== base.to) p.set('to', q.to);
  if (q.sort !== 'newest') p.set('sort', q.sort);
  if (q.page > 1) p.set('page', String(q.page));
  if (q.pageSize !== DEFAULT_SIZE) p.set('rows', String(q.pageSize));
  return p;
}

export const isFiltered = (q: DocumentsQuery, today: string): boolean => {
  const b = defaultQuery(today);
  return Boolean(q.q.trim() || q.type || q.siteId || q.from !== b.from || q.to !== b.to);
};
