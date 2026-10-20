import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AlertKind, AlertStatus } from '../security-types';

type Tx = Prisma.TransactionClient;

export interface NewAlert {
  companyId: string;
  siteId: string | null;
  kind: AlertKind;
  subjectUserId: string | null;
  deviceId: string | null;
  deviceLabel: string | null;
  placeLabel: string | null;
  detail: string | null;
  occurredAt: Date;
  auditEntryId: string | null;
}

export interface AlertFilter {
  companyId: string;
  status?: AlertStatus | undefined;
  kind?: AlertKind | undefined;
  siteId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

const whereOf = (f: AlertFilter): Prisma.WorkforceSecurityAlertWhereInput => ({
  companyId: f.companyId,
  ...(f.status ? { status: f.status } : {}),
  ...(f.kind ? { kind: f.kind } : {}),
  ...(f.siteId ? { siteId: f.siteId } : {}),
  ...(f.from || f.to ? { occurredAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
});

export const alertsRepository = {
  /**
   * One alert per person, kind and window (15 minutes). Takes a lock on the person and kind so two requests at once cannot both
   * pass; the caller inserts inside the same transaction and the lock lasts until it commits. True = free to raise.
   */
  async claimWindow(tx: Tx, subjectUserId: string, kind: AlertKind, since: Date): Promise<boolean> {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`security-alert:${kind}:${subjectUserId}`}))`);
    return (await tx.workforceSecurityAlert.count({ where: { subjectUserId, kind, occurredAt: { gt: since } } })) === 0;
  },

  insert: (tx: Tx, data: NewAlert) => tx.workforceSecurityAlert.create({ data, select: { id: true } }),

  async list(filter: AlertFilter, page: number, pageSize: number) {
    const where = whereOf(filter);
    const [rows, total] = await Promise.all([
      prisma.workforceSecurityAlert.findMany({ where, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.workforceSecurityAlert.count({ where }),
    ]);
    return { rows, total };
  },

  async counts(companyId: string): Promise<{ open: number; cleared: number }> {
    const [open, cleared] = await Promise.all([prisma.workforceSecurityAlert.count({ where: { companyId, status: 'OPEN' } }), prisma.workforceSecurityAlert.count({ where: { companyId, status: 'CLEARED' } })]);
    return { open, cleared };
  },

  openCount: (companyId: string): Promise<number> => prisma.workforceSecurityAlert.count({ where: { companyId, status: 'OPEN' } }),
  openRows: (companyId: string, limit: number) => prisma.workforceSecurityAlert.findMany({ where: { companyId, status: 'OPEN' }, orderBy: { occurredAt: 'asc' }, take: limit }),

  findIn: (companyId: string, id: string) => prisma.workforceSecurityAlert.findFirst({ where: { id, companyId } }),

  /** Clears an open alert. False when someone else got there first (or it was never open). */
  async clear(tx: Tx, companyId: string, id: string, byId: string, note: string, key: string, now: Date): Promise<boolean> {
    const result = await tx.workforceSecurityAlert.updateMany({ where: { id, companyId, status: 'OPEN' }, data: { status: 'CLEARED', clearedById: byId, clearedAt: now, clearNote: note, clearKey: key } });
    return result.count === 1;
  },

  namesOf: async (ids: readonly string[]) => new Map((await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } })).map((u) => [u.id, u])),

  settingOf: (companyId: string) => prisma.workforceSecuritySetting.findUnique({ where: { companyId } }),
  /** True when this call started the alerts; false when they were already started (two System Admins at once). */
  async startAlerts(tx: Tx, companyId: string, byId: string, now: Date): Promise<boolean> {
    const created = await tx.workforceSecuritySetting.createMany({ data: [{ companyId, alertsStartedAt: now, startedById: byId }], skipDuplicates: true });
    if (created.count === 1) return true;
    const updated = await tx.workforceSecuritySetting.updateMany({ where: { companyId, alertsStartedAt: null }, data: { alertsStartedAt: now, startedById: byId } });
    return updated.count === 1;
  },
};
