import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import type { AuditCategoryCode } from '../_shared/audit/audit.types';

/**
 * The only SQL of the audit read side. Every query carries companyId. The list reads the entry index (one narrow row per entry, indexed
 * on company, category, actor, person and time) and fetches the 25 to 100 full entries of a page by primary key, so a very large log
 * is never scanned through the big append-only table. Nothing here writes to an audit table.
 */

export const COUNT_CAP = 50_000;

export interface LogFilter {
  companyId: string;
  categories: readonly AuditCategoryCode[];
  siteId?: string | null;
  area?: string | undefined;
  actorId?: string | undefined;
  subjectUserId?: string | undefined;
  from?: Date | undefined; // inclusive instant
  before?: Date | undefined; // exclusive instant
  flagged?: boolean | undefined;
  q?: string | undefined;
  /** Rows the reader may not name (a payslip-opening's person) are never filtered by person unless the reader may name them. */
}

/** `%`, `_` and `\` in what the person typed are plain letters. */
const likeEscape = (text: string): string => text.replace(/[\\%_]/g, (c) => `\\${c}`);

function where(f: LogFilter): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`i.company_id = ${f.companyId}`, Prisma.sql`i.category = ANY(${[...f.categories]}::text[])`];
  if (f.siteId) parts.push(Prisma.sql`i.organization_id = ${f.siteId}`);
  if (f.area) parts.push(Prisma.sql`i.area = ${f.area}`);
  if (f.actorId) parts.push(Prisma.sql`i.actor_id = ${f.actorId}`);
  if (f.subjectUserId) parts.push(Prisma.sql`i.subject_user_id = ${f.subjectUserId}`);
  if (f.from) parts.push(Prisma.sql`i.occurred_at >= ${f.from}`);
  if (f.before) parts.push(Prisma.sql`i.occurred_at < ${f.before}`);
  if (f.flagged) parts.push(Prisma.sql`i.flagged = true`);
  if (f.q) parts.push(Prisma.sql`i.search_text LIKE ${`%${likeEscape(f.q.toLowerCase())}%`} ESCAPE '\\'`);
  return Prisma.join(parts, ' AND ');
}

export interface IndexRow {
  entryId: string;
  seq: bigint;
  occurredAt: Date;
  area: string;
  flagged: boolean;
  title: string;
}

export const auditReadRepository = {
  page: (f: LogFilter, sort: 'newest' | 'oldest', offset: number, limit: number): Promise<IndexRow[]> =>
    prisma.$queryRaw<{ entry_id: string; seq: bigint; occurred_at: Date; area: string; flagged: boolean; title: string }[]>(
      Prisma.sql`SELECT i.entry_id, i.seq, i.occurred_at, i.area, i.flagged, i.title FROM workforce_audit_entry_index i WHERE ${where(f)}
        ORDER BY i.occurred_at ${sort === 'newest' ? Prisma.sql`DESC, i.seq DESC` : Prisma.sql`ASC, i.seq ASC`} OFFSET ${offset} LIMIT ${limit}`,
    ).then((rows) => rows.map((r) => ({ entryId: r.entry_id, seq: r.seq, occurredAt: r.occurred_at, area: r.area, flagged: r.flagged, title: r.title }))),

  /** Counts up to COUNT_CAP + 1 rows and stops, so a narrow filter is exact and a huge one costs the same as a page. */
  countCapped: async (f: LogFilter): Promise<number> => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>(
      Prisma.sql`SELECT count(*) AS n FROM (SELECT 1 FROM workforce_audit_entry_index i WHERE ${where(f)} LIMIT ${COUNT_CAP + 1}) c`,
    );
    return Number(rows[0]?.n ?? 0n);
  },

  /**
   * For the large-log test: the plan of the same SQL the page and the count run, with sequential scans switched off for that one
   * transaction, so a plan without an index means no index can serve the query (a small test table would otherwise hide that).
   */
  explain: (f: LogFilter, which: 'page' | 'count'): Promise<string> =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
      const rows = await tx.$queryRaw<Record<string, string>[]>(
        which === 'page'
          ? Prisma.sql`EXPLAIN SELECT i.entry_id FROM workforce_audit_entry_index i WHERE ${where(f)} ORDER BY i.occurred_at DESC, i.seq DESC OFFSET 0 LIMIT 50`
          : Prisma.sql`EXPLAIN SELECT count(*) FROM (SELECT 1 FROM workforce_audit_entry_index i WHERE ${where(f)} LIMIT ${COUNT_CAP + 1}) c`,
      );
      return rows.map((r) => Object.values(r)[0]).join('\n');
    }),

  entriesByIds: (companyId: string, ids: readonly string[]) => prisma.auditEntry.findMany({ where: { companyId, id: { in: [...ids] } } }),

  entry: (companyId: string, id: string) => prisma.auditEntry.findFirst({ where: { companyId, id } }),

  indexOf: (companyId: string, entryId: string) => prisma.workforceAuditEntryIndex.findFirst({ where: { companyId, entryId } }),

  /** True when the area has at least one row the reader may read (an EXISTS that stops at the first hit). */
  areaHasRows: async (companyId: string, area: string, categories: readonly AuditCategoryCode[], siteId: string | null): Promise<boolean> => {
    const rows = await prisma.$queryRaw<{ found: boolean }[]>(
      Prisma.sql`SELECT EXISTS (SELECT 1 FROM workforce_audit_entry_index i WHERE ${where({ companyId, categories, siteId, area })}) AS found`,
    );
    return rows[0]?.found === true;
  },

  sites: (companyId: string) => prisma.site.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),

  siteNames: async (ids: readonly string[]): Promise<Map<string, string>> => {
    const rows = await prisma.site.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  /** Type-ahead for the actor filter: people of the company by name, limited to one site for a unit-scope reader. */
  actors: (companyId: string, q: string, siteId: string | null) =>
    prisma.user.findMany({
      where: { name: { contains: q, mode: 'insensitive' }, OR: [{ site: { companyId } }, { siteId: null, role: 'SYSTEM_ADMIN' }], ...(siteId ? { siteId } : {}) },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
      take: 10,
    }),

  /**
   * Once per reader per 10 minutes: true for the caller that moves `last_at` forward. Runs inside the audit transaction so the mark
   * and the `audit.log_viewed` entry commit together or not at all.
   */
  claimViewMark: async (tx: Prisma.TransactionClient, userId: string, now: Date, windowMs: number): Promise<boolean> => {
    const rows = await tx.$queryRaw<{ user_id: string }[]>(
      Prisma.sql`INSERT INTO workforce_audit_view_marks (user_id, last_at) VALUES (${userId}, ${now})
        ON CONFLICT (user_id) DO UPDATE SET last_at = EXCLUDED.last_at WHERE workforce_audit_view_marks.last_at < ${new Date(now.getTime() - windowMs)}
        RETURNING user_id`,
    );
    return rows.length > 0;
  },

  userNames: async (ids: readonly string[]): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  /** Entry at one seq, for the start of a chain slice. */
  entryAtSeq: (companyId: string, seq: bigint) => prisma.auditEntry.findFirst({ where: { companyId, seq } }),

  companies: () => prisma.company.findMany({ where: { isActive: true }, select: { id: true } }),

  /** The first seq written at or after `since` (the start of the nightly slice); null when nothing is newer. */
  firstSeqSince: async (companyId: string, since: Date): Promise<bigint | null> =>
    (await prisma.auditEntry.findFirst({ where: { companyId, occurredAt: { gte: since } }, orderBy: { seq: 'asc' }, select: { seq: true } }))?.seq ?? null,

  /** Entries older than the oldest index row: back end A writes the index with every entry, so only entries from before it can lack one. */
  minIndexedSeq: async (companyId: string): Promise<bigint | null> =>
    (await prisma.workforceAuditEntryIndex.findFirst({ where: { companyId }, orderBy: { seq: 'asc' }, select: { seq: true } }))?.seq ?? null,

  entriesBelow: (companyId: string, seq: bigint | null, take: number) =>
    prisma.auditEntry.findMany({ where: { companyId, ...(seq === null ? {} : { seq: { lt: seq } }) }, orderBy: { seq: 'desc' }, take }),

  insertIndexRows: (rows: Prisma.WorkforceAuditEntryIndexCreateManyInput[]) => prisma.workforceAuditEntryIndex.createMany({ data: rows, skipDuplicates: true }),

  lastSeq: async (companyId: string): Promise<bigint> => (await prisma.auditChainHead.findUnique({ where: { companyId } }))?.lastSeq ?? 0n,
};
