import { Prisma, type WorkforceRecordAnswer } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AuditCategoryCode } from '../../_shared/audit/audit.types';
import type { StoredEntry } from '../audit-rows';
import { HIDDEN_FROM_MY_RECORD } from './my-record-wording';

/** Every query here is for one person's own rows (`subject_user_id = me`) in one company. */
export interface RecordFilter {
  companyId: string;
  userId: string;
  categories: readonly AuditCategoryCode[];
  from: Date;
  before: Date;
}

const base = (f: RecordFilter): Prisma.Sql =>
  Prisma.sql`FROM workforce_audit_entry_index i JOIN workforce_audit_entries e ON e.id = i.entry_id
    WHERE i.company_id = ${f.companyId} AND i.subject_user_id = ${f.userId} AND i.category = ANY(${[...f.categories]}::text[])
      AND i.occurred_at >= ${f.from} AND i.occurred_at < ${f.before} AND e.action <> ALL(${[...HIDDEN_FROM_MY_RECORD]}::text[])`;

export const myRecordRepository = {
  pageIds: async (f: RecordFilter, offset: number, limit: number): Promise<string[]> =>
    (await prisma.$queryRaw<{ entry_id: string }[]>(Prisma.sql`SELECT i.entry_id ${base(f)} ORDER BY i.occurred_at DESC, i.seq DESC OFFSET ${offset} LIMIT ${limit}`)).map((r) => r.entry_id),

  count: async (f: RecordFilter): Promise<number> => Number((await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT count(*) AS n ${base(f)}`))[0]?.n ?? 0n),

  entries: (companyId: string, ids: readonly string[]) => prisma.auditEntry.findMany({ where: { companyId, id: { in: [...ids] } } }) as Promise<StoredEntry[]>,

  /** One of the person's own entries, or null: another person's id is the same as no id. */
  ownEntry: (companyId: string, userId: string, id: string) =>
    prisma.auditEntry.findFirst({ where: { companyId, id, subjectUserId: userId, action: { notIn: [...HIDDEN_FROM_MY_RECORD] }, category: { not: 'LOG_ACCESS' } } }) as Promise<StoredEntry | null>,

  answersOf: async (userId: string, entryIds: readonly string[]): Promise<Map<string, 'ME' | 'NOT_ME'>> => {
    const rows = await prisma.workforceRecordAnswer.findMany({ where: { userId, entryId: { in: [...entryIds] } }, select: { entryId: true, answer: true } });
    return new Map(rows.map((r) => [r.entryId, r.answer as 'ME' | 'NOT_ME']));
  },

  answerFor: (userId: string, entryId: string) => prisma.workforceRecordAnswer.findUnique({ where: { entryId_userId: { entryId, userId } } }),

  answerByKey: (userId: string, answerKey: string) => prisma.workforceRecordAnswer.findUnique({ where: { userId_answerKey: { userId, answerKey } } }),

  /** Inside the audit transaction. A second answer to the same entry is refused by the unique key. */
  insertAnswer: (tx: Prisma.TransactionClient, row: { entryId: string; userId: string; answer: 'ME' | 'NOT_ME'; answerKey: string }): Promise<WorkforceRecordAnswer> =>
    tx.workforceRecordAnswer.create({ data: row }),

  /** The same insert, outside a transaction (the NOT_ME answer is stored after the sign-out has committed). */
  insertAnswerLoose: (row: { entryId: string; userId: string; answer: 'ME' | 'NOT_ME'; answerKey: string }) => prisma.workforceRecordAnswer.createMany({ data: [row], skipDuplicates: true }),
};
