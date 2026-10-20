import { NotFoundError } from '../../../utils/errors';
import type { AuditCategoryCode, JsonValue } from '../_shared/audit/audit.types';
import type { AccessSubject } from '../_shared/workforce-access';
import { resolveActor, type ActorCtx } from '../people/people-context';
import { COUNT_CAP, auditReadRepository, type LogFilter } from './audit-read-repository';
import { assertPageReachable, rangeOf, type LogRange } from './audit-range';
import { asJson, toLogRow, type LogRow, type StoredEntry } from './audit-rows';
import { categoriesFor, logScopeOf, mayReadChanges, readableEvents, type LogScope } from './audit-visibility';
import type { ExportQuery, ListQuery } from './audit-validators';
import { noteLogViewed } from './log-views';

type FilterQuery = Pick<ListQuery, 'area' | 'event' | 'siteId' | 'actorId' | 'subjectUserId' | 'flagged' | 'q'> & Pick<ExportQuery, 'from' | 'to'>;

export interface ReaderCtx {
  ctx: ActorCtx;
  scope: LogScope;
}

/** A person with nothing to read gets the route's 404 (A1): the log does not admit it exists. */
export async function readerOf(subject: AccessSubject): Promise<ReaderCtx> {
  const scope = logScopeOf(subject);
  if (!scope) throw new NotFoundError('We could not find that page.', 'NOT_FOUND');
  return { ctx: await resolveActor(subject), scope };
}

/**
 * The query's input, narrowed to what this reader may read. A category or site outside the reader's scope is dropped here, so the
 * answer is an empty list and a zero count (never a 403, never a number that leaks).
 */
export function filterOf(reader: ReaderCtx, q: FilterQuery, range: LogRange): LogFilter | null {
  const categories = categoriesFor(reader.scope, q.event);
  if (categories.length === 0) return null;
  if (reader.scope.unit && q.siteId && q.siteId !== reader.scope.siteId) return null;
  return {
    companyId: reader.ctx.companyId,
    categories,
    siteId: reader.scope.unit ? reader.scope.siteId : (q.siteId ?? null),
    area: q.area,
    actorId: q.actorId,
    subjectUserId: q.subjectUserId,
    from: range.start,
    before: range.end,
    flagged: q.flagged,
    q: q.q || undefined,
  };
}

export interface LogPage {
  entries: LogRow[];
  total: number;
  totalIsExact: boolean;
  page: number;
  pageSize: number;
  range: { from: string; to: string; reachesArchive: boolean };
  facets: Facets;
}

export interface Facets {
  areas: string[];
  events: { code: string; label: string }[];
  sites: { id: string; name: string }[];
}

export async function entriesFor(reader: ReaderCtx, ids: readonly string[], areaById: ReadonlyMap<string, string>): Promise<LogRow[]> {
  const entries = (await auditReadRepository.entriesByIds(reader.ctx.companyId, ids)) as StoredEntry[];
  const siteIds = [...new Set(entries.map((e) => e.siteId).filter((s): s is string => s !== null))];
  const personIds = [...new Set(entries.map((e) => e.subjectUserId).filter((s): s is string => s !== null))];
  const [siteNames, userNames] = await Promise.all([auditReadRepository.siteNames(siteIds), auditReadRepository.userNames(personIds)]);
  const byId = new Map(entries.map((e) => [e.id, e]));
  return ids.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [toLogRow(entry, { scope: reader.scope, area: areaById.get(id) ?? 'WORKFORCE', siteNames, userNames })] : [];
  });
}

export async function listFacets(reader: ReaderCtx): Promise<Facets> {
  const { companyId } = reader.ctx;
  const found = await Promise.all(['WORKFORCE', 'ACCESS'].map(async (area) => ((await auditReadRepository.areaHasRows(companyId, area, reader.scope.categories, reader.scope.siteId)) ? area : null)));
  const sites = reader.scope.unit ? [] : await auditReadRepository.sites(companyId);
  return { areas: found.filter((a): a is string => a !== null), events: readableEvents(reader.scope), sites };
}

/** A1. One page of the company log plus its capped exact count. Writes at most one `audit.log_viewed` per reader per 10 minutes. */
export async function listEntries(subject: AccessSubject, query: ListQuery, now: Date = new Date()): Promise<LogPage> {
  const reader = await readerOf(subject);
  const range = rangeOf(query.from, query.to, now);
  assertPageReachable(query.page, range);
  const filter = filterOf(reader, query, range);
  const facets = await listFacets(reader);
  const head = { page: query.page, pageSize: query.pageSize, range: { from: range.from, to: range.to, reachesArchive: range.reachesArchive }, facets };
  await noteLogViewed(reader.ctx, 'list', now);
  if (!filter) return { entries: [], total: 0, totalIsExact: true, ...head };
  const [rows, counted] = await Promise.all([
    auditReadRepository.page(filter, query.sort, (query.page - 1) * query.pageSize, query.pageSize),
    auditReadRepository.countCapped(filter),
  ]);
  const entries = await entriesFor(reader, rows.map((r) => r.entryId), new Map(rows.map((r) => [r.entryId, r.area])));
  return { entries, total: Math.min(counted, COUNT_CAP), totalIsExact: counted <= COUNT_CAP, ...head };
}

export interface EntryDetail extends LogRow {
  before: JsonValue | null;
  after: JsonValue | null;
  hash: string;
  prevHash: string;
  /** No writer records the signing method on an entry yet, so this is null until one does (decisions-6b-backend, B11). */
  signature: 'PIN' | null;
}

/** A3. One entry in full. 404 when it is outside the reader's categories or site (no hint which). */
export async function entryDetail(subject: AccessSubject, id: string, now: Date = new Date()): Promise<EntryDetail> {
  const reader = await readerOf(subject);
  const entry = (await auditReadRepository.entry(reader.ctx.companyId, id)) as StoredEntry | null;
  const category = entry?.category as AuditCategoryCode | undefined;
  const allowed = entry && category && reader.scope.categories.includes(category) && (!reader.scope.unit || entry.siteId === reader.scope.siteId);
  if (!entry || !category || !allowed) throw new NotFoundError('We could not find that entry.', 'ENTRY_NOT_FOUND');
  await noteLogViewed(reader.ctx, 'detail', now);
  const index = await auditReadRepository.indexOf(reader.ctx.companyId, id);
  const [row] = await entriesFor(reader, [id], new Map([[id, index?.area ?? 'WORKFORCE']]));
  if (!row) throw new NotFoundError('We could not find that entry.', 'ENTRY_NOT_FOUND');
  const changes = mayReadChanges(category, reader.scope);
  return { ...row, before: changes ? asJson(entry.before) : null, after: changes ? asJson(entry.after) : null, hash: entry.hash, prevHash: entry.prevHash, signature: null };
}

/** A1 facets for the actor type-ahead: readers only, names with roles; a unit-scope reader sees their own site's people. */
export async function findActors(subject: AccessSubject, q: string): Promise<{ id: string; name: string; role: string }[]> {
  const reader = await readerOf(subject);
  return auditReadRepository.actors(reader.ctx.companyId, q, reader.scope.unit ? reader.scope.siteId : null);
}
