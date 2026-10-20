import type { LeaveEventKind, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Db = Prisma.TransactionClient | typeof prisma;

export interface LeaveEventRow {
  id: string;
  applicationId: string;
  kind: LeaveEventKind;
  at: Date;
  byUser: string | null;
  role: string | null;
  idempotencyKey: string | null;
}

/** The status history that feeds the stepper on one request. */
export const eventsRepository = {
  add: async (tx: Prisma.TransactionClient, event: { applicationId: string; kind: LeaveEventKind; at: Date; byUser?: string | null; role?: string | null; idempotencyKey?: string | null }): Promise<void> => {
    await tx.leaveEvent.create({ data: { applicationId: event.applicationId, kind: event.kind, at: event.at, byUser: event.byUser ?? null, role: event.role ?? null, idempotencyKey: event.idempotencyKey ?? null } });
  },

  /** The event a decision or cancel with this key wrote, if it already ran. */
  byKey: (db: Db, applicationId: string, idempotencyKey: string) => db.leaveEvent.findFirst({ where: { applicationId, idempotencyKey } }),

  forApplication: (db: Db, applicationId: string): Promise<LeaveEventRow[]> => db.leaveEvent.findMany({ where: { applicationId }, orderBy: { at: 'asc' } }),
};
