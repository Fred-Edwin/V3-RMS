import { Prisma, type ConductNotice, type ConductNoticeEvent, type ConductStatus } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { toDateColumn, nairobiToday } from '../../_shared/time/nairobi-time';
import { ACTIVE_STATUSES } from './conduct-status';

export type Db = Prisma.TransactionClient | typeof prisma;

/** A frozen snapshot (letter, facts) as the JSON column wants it; a round trip proves it holds plain data only. */
export const asJson = (value: object): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export type { ConductNotice, ConductNoticeEvent };

export type NewNotice = Omit<Prisma.ConductNoticeUncheckedCreateInput, 'id' | 'createdAt' | 'updatedAt' | 'number'> & { number?: number | null };

/** What a transition writes besides the new status. */
export type NoticePatch = Omit<Prisma.ConductNoticeUncheckedUpdateManyInput, 'id' | 'status' | 'updatedAt'>;

/**
 * Notices are read and changed here and only here. Nothing is ever deleted (there is no delete in this file). Every read carries the
 * company; a list also carries the site (see conduct-list-repository.ts). A change is a compare-and-set on the status, so two
 * people acting on the same notice cannot both win (spec section 9).
 */
export const conductNoticesRepository = {
  findById: (companyId: string, id: string, db: Db = prisma): Promise<ConductNotice | null> => db.conductNotice.findFirst({ where: { id, companyId } }),

  findByIdempotency: (issuerId: string, key: string, db: Db = prisma): Promise<ConductNotice | null> =>
    db.conductNotice.findUnique({ where: { issuerId_idempotencyKey: { issuerId, idempotencyKey: key } } }),

  /** One person's checks for new notices run one at a time, so two managers issuing together see each other's notice. */
  async lockPerson(tx: Prisma.TransactionClient, employeeId: string): Promise<void> {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`conduct-person:${employeeId}`}))`);
  },

  async nextNumber(tx: Prisma.TransactionClient): Promise<number> {
    const rows = await tx.$queryRaw<{ n: number }[]>`SELECT nextval('conduct_notice_seq')::int AS n`;
    const first = rows[0];
    if (!first) throw new Error('conduct_notice_seq returned no row');
    return first.n;
  },

  create: (tx: Prisma.TransactionClient, data: NewNotice): Promise<ConductNotice> => tx.conductNotice.create({ data }),

  /**
   * Changes the notice only if it is still in one of `from`. Returns the updated notice, or null when someone else moved it first
   * (the caller then re-reads and answers 409 with the real status).
   */
  async transition(tx: Prisma.TransactionClient, companyId: string, id: string, from: readonly ConductStatus[], to: ConductStatus, patch: NoticePatch = {}): Promise<ConductNotice | null> {
    const changed = await tx.conductNotice.updateMany({ where: { id, companyId, status: { in: [...from] } }, data: { ...patch, status: to } });
    if (changed.count === 0) return null;
    return tx.conductNotice.findFirst({ where: { id, companyId } });
  },

  /** A change that is not a status move (the witness answered, the Director was told). Guarded by `where` fields the caller names. */
  async patch(tx: Prisma.TransactionClient, companyId: string, id: string, guard: Prisma.ConductNoticeWhereInput, data: NoticePatch): Promise<ConductNotice | null> {
    const changed = await tx.conductNotice.updateMany({ where: { AND: [{ id, companyId }, guard] }, data });
    if (changed.count === 0) return null;
    return tx.conductNotice.findFirst({ where: { id, companyId } });
  },

  addEvent: (tx: Prisma.TransactionClient, event: { noticeId: string; at: Date; kind: string; actor?: { id: string; name: string; role: string } | null; payload?: Prisma.InputJsonValue }) =>
    tx.conductNoticeEvent.create({
      data: {
        noticeId: event.noticeId,
        at: event.at,
        kind: event.kind,
        actorId: event.actor?.id ?? null,
        actorName: event.actor?.name ?? null,
        actorRole: event.actor?.role ?? null,
        ...(event.payload !== undefined ? { payload: event.payload } : {}),
      },
    }),

  eventsOf: (noticeId: string, db: Db = prisma): Promise<ConductNoticeEvent[]> => db.conductNoticeEvent.findMany({ where: { noticeId }, orderBy: [{ at: 'asc' }, { id: 'asc' }] }),

  /** The notices on a person's file that count towards the ladder now: live status and inside the end date. */
  activeForEmployee: (companyId: string, employeeId: string, now: Date, db: Db = prisma): Promise<ConductNotice[]> =>
    db.conductNotice.findMany({
      where: { companyId, employeeId, status: { in: [...ACTIVE_STATUSES] }, validUntil: { gte: toDateColumn(nairobiToday(now)) } },
      orderBy: { issuedAt: 'desc' },
    }),

  /** Every notice about a person (the file tab and the staff list read this; the caller filters what the reader may see). */
  forEmployee: (companyId: string, employeeId: string, db: Db = prisma): Promise<ConductNotice[]> =>
    db.conductNotice.findMany({ where: { companyId, employeeId }, orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }] }),

  /** Notices whose person's login is this user (the staff list). A transferred person keeps the same login, so this follows them. */
  forUser: (companyId: string, userId: string, db: Db = prisma): Promise<ConductNotice[]> =>
    db.conductNotice.findMany({ where: { companyId, personUserId: userId }, orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }] }),

  /** The last issued notice for the same person created by the same issuer within a minute (the "just issued" warning, S9). */
  recentFor: (companyId: string, employeeId: string, since: Date, db: Db = prisma): Promise<ConductNotice | null> =>
    db.conductNotice.findFirst({ where: { companyId, employeeId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' } }),
};
