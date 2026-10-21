import { prisma } from '../../../../config/database';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import type { ConductDecision } from '../appeals/decisions-repository';

/** Read-only queries for the Signed documents reconciliation. Every query carries the company. */
export const noticeSourceRepository = {
  /** Every notice that has a number (verbal notes have none), oldest number first. */
  letters: (companyId: string): Promise<ConductNotice[]> => prisma.conductNotice.findMany({ where: { companyId, number: { not: null } }, orderBy: { number: 'asc' } }),

  decisions: async (noticeIds: readonly string[]): Promise<Map<string, ConductDecision[]>> => {
    const byNotice = new Map<string, ConductDecision[]>();
    if (noticeIds.length === 0) return byNotice;
    for (const row of await prisma.conductDecision.findMany({ where: { noticeId: { in: [...noticeIds] } }, orderBy: { version: 'asc' } })) {
      byNotice.set(row.noticeId, [...(byNotice.get(row.noticeId) ?? []), row]);
    }
    return byNotice;
  },
};
