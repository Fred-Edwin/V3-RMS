import { prisma } from '../../../../config/database';

export interface LegacyRow {
  id: string;
  level: string;
  actionDate: string;
  label: string;
}

const LABELS: Record<string, { level: string; label: string }> = {
  VERBAL_WARNING: { level: 'VERBAL_NOTE', label: 'Verbal warning' },
  WRITTEN_WARNING: { level: 'WRITTEN_WARNING', label: 'Written warning' },
  FINAL_WARNING: { level: 'FINAL_WRITTEN_WARNING', label: 'Final written warning' },
  SUSPENSION: { level: 'OTHER', label: 'Other action' },
  TERMINATION: { level: 'OTHER', label: 'Other action' },
};

/**
 * The old HR disciplinary records, read only, for "Before the new system" (C2). Nothing here writes, copies or counts toward the
 * ladder. The old table keys people by employee profile, so the lookup goes through the login.
 */
export const legacyRepository = {
  async forUser(userId: string): Promise<LegacyRow[]> {
    const rows = await prisma.disciplinaryRecord.findMany({
      where: { employeeProfile: { userId } },
      orderBy: { actionDate: 'desc' },
      take: 100,
      select: { id: true, actionDate: true, actionTaken: true },
    });
    return rows.map((row) => ({ id: row.id, level: LABELS[row.actionTaken]?.level ?? 'OTHER', actionDate: row.actionDate.toISOString().slice(0, 10), label: LABELS[row.actionTaken]?.label ?? 'Other action' }));
  },
};
