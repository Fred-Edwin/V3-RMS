import { runAudited } from '../../_shared/audit/audit-writer';
import { hireRepository } from './hire-repository';

/**
 * Finding 12, existing rows: a new hire with nobody named already reports to the site's manager; this gives the same
 * default to people hired before that. A person is never made to report to themself, and a site with no manager is left
 * alone. One audit entry per change, filed by the system. Safe to run again: it only touches rows still without a boss.
 */
export async function backfillReportsTo(companyId: string): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;
  for (const person of await hireRepository.findWithoutBoss(companyId)) {
    const boss = await hireRepository.findSiteManager(companyId, person.siteId);
    if (!boss || boss.id === person.id) {
      skipped += 1;
      continue;
    }
    await runAudited(async (tx) => {
      await hireRepository.setBossIfNone(tx, companyId, person.id, boss.id);
      return {
        result: null,
        entries: [
          {
            companyId,
            siteId: person.siteId,
            actor: { id: null, role: 'SYSTEM', name: 'System' },
            channel: 'SYSTEM' as const,
            action: 'people.updated',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: person.id,
            subjectUserId: person.userId,
            before: { reportsToId: null },
            after: { reportsToId: boss.id, changed: ['reportsToId'] },
            reason: 'Reports to the site manager by default',
          },
        ],
      };
    });
    updated += 1;
  }
  return { updated, skipped };
}
