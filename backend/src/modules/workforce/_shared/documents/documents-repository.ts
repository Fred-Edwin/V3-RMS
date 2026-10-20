import { Prisma, type WorkforceDocument } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { ReadableKind } from './document-kinds';

/** The only SQL of the documents read model. Every query carries companyId, except the public number lookup (which has no company). */

export type DocumentRow = WorkforceDocument;

export interface NewDocumentRow {
  companyId: string;
  siteId: string | null;
  kind: string;
  number: string;
  version: number;
  title: string;
  about: string;
  subjectUserId: string | null;
  signedById: string | null;
  signedByName: string;
  signedByRole: string;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedByRole: string | null;
  reviewedAt: Date | null;
  signedAt: Date;
  method: string;
  hashPrefix: string;
  hash: string;
  openHref: string;
  searchText: string;
}

export interface DocumentFilter {
  companyId: string;
  kinds: readonly ReadableKind[];
  type?: string | undefined;
  siteId?: string | undefined;
  from?: Date | undefined;
  before?: Date | undefined;
  q?: string | undefined;
}

export const DOCUMENT_COUNT_CAP = 50_000;
const likeEscape = (text: string): string => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** (kind and, for a unit-scope type, site) alternatives; no readable type at all matches nothing. */
function where(f: DocumentFilter): Prisma.Sql {
  const allowed = f.kinds.filter((k) => !f.type || k.kind === f.type);
  if (allowed.length === 0) return Prisma.sql`false`;
  const kindSql = Prisma.join(allowed.map((k) => (k.siteId ? Prisma.sql`(d.kind = ${k.kind} AND d.organization_id = ${k.siteId})` : Prisma.sql`d.kind = ${k.kind}`)), ' OR ');
  const parts: Prisma.Sql[] = [Prisma.sql`d.company_id = ${f.companyId}`, Prisma.sql`(${kindSql})`];
  if (f.siteId) parts.push(Prisma.sql`d.organization_id = ${f.siteId}`);
  if (f.from) parts.push(Prisma.sql`d.signed_at >= ${f.from}`);
  if (f.before) parts.push(Prisma.sql`d.signed_at < ${f.before}`);
  if (f.q) parts.push(Prisma.sql`d.search_text LIKE ${`%${likeEscape(f.q.toLowerCase())}%`} ESCAPE '\\'`);
  return Prisma.join(parts, ' AND ');
}

export const documentsRepository = {
  /** Inserts the row unless (company, number, version) exists (a repeat of the same call). Returns whether this call created it. */
  insertIfAbsent: async (tx: Prisma.TransactionClient, row: NewDocumentRow): Promise<boolean> => (await tx.workforceDocument.createMany({ data: [row], skipDuplicates: true })).count === 1,

  find: (client: Prisma.TransactionClient | typeof prisma, companyId: string, number: string, version: number) =>
    client.workforceDocument.findUnique({ where: { companyId_number_version: { companyId, number, version } } }),

  maxVersion: async (tx: Prisma.TransactionClient, companyId: string, number: string): Promise<number> =>
    (await tx.workforceDocument.findFirst({ where: { companyId, number }, orderBy: { version: 'desc' }, select: { version: true } }))?.version ?? 0,

  /** Versions below `version` that are still CURRENT become REPLACED, in the same transaction as the new version. */
  markReplaced: (tx: Prisma.TransactionClient, companyId: string, number: string, version: number, at: Date) =>
    tx.workforceDocument.updateMany({ where: { companyId, number, version: { lt: version }, status: 'CURRENT' }, data: { status: 'REPLACED', replacedByVersion: version, replacedAt: at } }),

  markWithdrawn: (tx: Prisma.TransactionClient, companyId: string, number: string, at: Date, byRole: string, replacedByNumber: string | null) =>
    tx.workforceDocument.updateMany({ where: { companyId, number, status: { not: 'WITHDRAWN' } }, data: { status: 'WITHDRAWN', withdrawnAt: at, withdrawnByRole: byRole, replacedByNumber } }),

  page: (f: DocumentFilter, sort: 'newest' | 'oldest', offset: number, limit: number): Promise<DocumentRow[]> =>
    prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`SELECT d.id FROM workforce_documents d WHERE ${where(f)} ORDER BY d.signed_at ${sort === 'newest' ? Prisma.sql`DESC, d.number DESC, d.version DESC` : Prisma.sql`ASC, d.number ASC, d.version ASC`} OFFSET ${offset} LIMIT ${limit}`,
    ).then(async (ids) => {
      const order = ids.map((r) => String(r['id']));
      const rows = await prisma.workforceDocument.findMany({ where: { id: { in: order } } });
      const byId = new Map(rows.map((r) => [r.id, r]));
      return order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    }),

  countCapped: async (f: DocumentFilter): Promise<number> =>
    Number((await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT count(*) AS n FROM (SELECT 1 FROM workforce_documents d WHERE ${where(f)} LIMIT ${DOCUMENT_COUNT_CAP + 1}) c`))[0]?.n ?? 0n),

  /** Every version of one number in the company, newest first. */
  versionsOf: (companyId: string, number: string) => prisma.workforceDocument.findMany({ where: { companyId, number }, orderBy: { version: 'desc' } }),

  /** The public lookup: no company is known to the caller, so it asks by kind and number and compares the hash itself. */
  byNumber: (kind: string, number: string) => prisma.workforceDocument.findMany({ where: { kind, number }, orderBy: { version: 'desc' }, take: 20 }),

  siteNames: async (ids: readonly string[]): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await prisma.site.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  personOf: async (userId: string): Promise<{ name: string; role: string } | null> => {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
    return u ? { name: u.name, role: u.role } : null;
  },

  sites: (companyId: string) => prisma.site.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),

  /** The numbers the index already holds for a kind, from `after` on, for the reconciliation. */
  numbersHeld: async (companyId: string, kind: string): Promise<Set<string>> =>
    new Set((await prisma.workforceDocument.findMany({ where: { companyId, kind }, select: { number: true, version: true } })).map((r) => `${r.number}#${r.version}`)),
};
