import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { roleLabel } from '../../notifications';
import { listAlerts } from '../../security';
import type { NeedsYouRow, NeedsYouSource } from '../needs-you-types';

const TEXT: Record<string, (who: string) => string> = {
  WASNT_ME: (who) => `${who} pressed "This wasn't me"`,
  UNCONFIRMED_PHONE: (who) => `A payslip was opened on a phone ${who} has not confirmed`,
  WRONG_CODES: (who) => `3 wrong payslip codes for ${who}`,
  CHAIN_FAILED: () => 'The audit log check found a problem',
};

/** The System Admin's open security alerts. Wording carries a person and a kind, never an amount or a code. */
export const securitySource: NeedsYouSource = {
  id: 'security',
  kinds: ['security'],
  async list(subject: AccessSubject) {
    if (!workforceCan(subject, 'security.alerts.read')) return [];
    const open = await listAlerts(subject, { status: 'OPEN', page: 1, pageSize: 100 });
    return open.items.map<NeedsYouRow>((a) => ({
      id: `security:${a.id}`,
      kind: 'security',
      text: (TEXT[a.kind] ?? TEXT['CHAIN_FAILED']!)(a.person ? `${a.person.name}, ${roleLabel(a.person.role)}` : 'someone'),
      opens: '/app/workforce/security',
      badge: 'workforce-security',
      since: a.occurredAt,
      siteId: a.siteId,
      siteName: null,
      waitingOnRole: 'SYSTEM_ADMIN',
      personUserId: a.person?.id ?? null,
      canRemind: false,
    }));
  },
};
