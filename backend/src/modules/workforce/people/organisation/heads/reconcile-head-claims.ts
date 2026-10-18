import { runAudited } from '../../../_shared/audit/audit-writer';
import { toDateColumn, type NairobiDate } from '../../../_shared/time/nairobi-time';
import { syncHeadClaims } from './head-sync';
import { headsRepository } from './heads-repository';

const SYSTEM = { id: null, role: 'SYSTEM', name: 'System' } as const;

/**
 * The sixth scheduler task: recomputes the head claims of every login that carries one or has a head row open or ahead,
 * so a day an acting head's last day passes, or any drift, corrects itself. Idempotent: a second run on the same day
 * finds nothing to change and writes no entry. One entry per company per run, never one per person.
 */
export async function reconcileHeadClaims(today: NairobiDate): Promise<number> {
  let changed = 0;
  for (const companyId of await headsRepository.companyIds()) {
    const users = await headsRepository.usersToReconcile(companyId, toDateColumn(today));
    if (users.length === 0) continue;
    changed += await runAudited(async (tx) => {
      let count = 0;
      for (const user of users) if (await syncHeadClaims(tx, companyId, user.id, today)) count += 1;
      return {
        result: count,
        entries:
          count === 0
            ? []
            : [
                {
                  companyId,
                  siteId: null,
                  actor: SYSTEM,
                  channel: 'SYSTEM' as const,
                  action: 'org.head_claims_reconciled',
                  category: 'PEOPLE' as const,
                  subjectType: 'Company',
                  subjectId: companyId,
                  after: { count, onDate: today },
                },
              ],
      };
    });
  }
  return changed;
}
