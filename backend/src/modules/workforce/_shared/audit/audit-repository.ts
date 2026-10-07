import { Prisma, type AuditEntry } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { GENESIS_HASH } from './audit-hash';
import type { AuditCategoryCode, AuditChannelCode, AuditEntryRecord, JsonValue } from './audit.types';

/**
 * The only SQL for the audit log. There is deliberately no update, delete or upsert of an audit entry here (a database
 * trigger refuses them as well). Every query carries companyId.
 */

export interface ChainHead {
  lastSeq: bigint;
  lastHash: string;
}

export type NewAuditRow = Omit<AuditEntryRecord, 'id'>;

const json = (value: JsonValue | null): Prisma.InputJsonValue | typeof Prisma.JsonNull => (value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue));

const toRecord = (row: AuditEntry): AuditEntryRecord => ({
  id: row.id,
  companyId: row.companyId,
  siteId: row.siteId,
  seq: row.seq,
  occurredAt: row.occurredAt,
  action: row.action,
  category: row.category as AuditCategoryCode,
  subjectType: row.subjectType,
  subjectId: row.subjectId,
  actorId: row.actorId,
  actorRole: row.actorRole,
  actorName: row.actorName,
  channel: row.channel as AuditChannelCode,
  subjectUserId: row.subjectUserId,
  before: (row.before ?? null) as JsonValue | null,
  after: (row.after ?? null) as JsonValue | null,
  reason: row.reason,
  deviceLabel: row.deviceLabel,
  placeLabel: row.placeLabel,
  prevHash: row.prevHash,
  hash: row.hash,
});

export const auditRepository = {
  /** First entry ever for a company: create its chain head. A no-op afterwards. */
  ensureHead: async (tx: Prisma.TransactionClient, companyId: string): Promise<void> => {
    await tx.auditChainHead.createMany({ data: [{ companyId, lastSeq: 0n, lastHash: GENESIS_HASH }], skipDuplicates: true });
  },

  /** Takes the row lock that hands out seq numbers; held until the caller's transaction ends. */
  lockChainHead: async (tx: Prisma.TransactionClient, companyId: string): Promise<ChainHead> => {
    const rows = await tx.$queryRaw<{ last_seq: bigint; last_hash: string }[]>`
      SELECT last_seq, last_hash FROM workforce_audit_chain_heads WHERE company_id = ${companyId} FOR UPDATE`;
    const head = rows[0];
    if (!head) throw new Error('Audit chain head is missing after ensureHead');
    return { lastSeq: head.last_seq, lastHash: head.last_hash };
  },

  insertEntry: async (tx: Prisma.TransactionClient, row: NewAuditRow): Promise<AuditEntryRecord> => {
    const created = await tx.auditEntry.create({
      data: {
        companyId: row.companyId,
        siteId: row.siteId,
        seq: row.seq,
        occurredAt: row.occurredAt,
        actorId: row.actorId,
        actorRole: row.actorRole,
        actorName: row.actorName,
        channel: row.channel,
        action: row.action,
        category: row.category,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        subjectUserId: row.subjectUserId,
        before: json(row.before),
        after: json(row.after),
        reason: row.reason,
        deviceLabel: row.deviceLabel,
        placeLabel: row.placeLabel,
        prevHash: row.prevHash,
        hash: row.hash,
      },
    });
    return toRecord(created);
  },

  /** The trigger only allows last_seq to move to old + 1. */
  advanceHead: async (tx: Prisma.TransactionClient, companyId: string, seq: bigint, hash: string): Promise<void> => {
    await tx.auditChainHead.update({ where: { companyId }, data: { lastSeq: seq, lastHash: hash } });
  },

  /** Entries of one company in seq order, after `afterSeq`, for verification and (slice 7) the read side. */
  listEntries: async (companyId: string, afterSeq: bigint, limit: number): Promise<AuditEntryRecord[]> => {
    const rows = await prisma.auditEntry.findMany({ where: { companyId, seq: { gt: afterSeq } }, orderBy: { seq: 'asc' }, take: limit });
    return rows.map(toRecord);
  },
};
