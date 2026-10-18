import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import { daysRepository } from '../../attendance/days/days-repository';
import { told } from '../../people/people-context';
import { SYSTEM_ACTOR, eventOf, timesheetEntry } from '../timesheets-audit';
import { escalationCut, escalationDue, waitingDays } from './requests-rules';
import { requestsRepository } from './requests-repository';

/**
 * The scheduled task: a request nobody has answered for 3 Nairobi calendar days moves to HR (Chapter 9, step 3). The person
 * keeps seeing it in My requests as "escalated to HR". Idempotent: the update claims only a request that has not moved, so
 * running it twice, or two servers at once, moves each request once and writes one audit entry.
 */
export async function escalateStaleRequests(now: Date = new Date()): Promise<{ escalated: number }> {
  const candidates = (await requestsRepository.staleWaiting(escalationCut(now))).filter((request) => escalationDue(request.createdAt, now));
  if (candidates.length === 0) return { escalated: 0 };
  const [hr] = await requestsRepository.approverCandidates(null, ['HR_MANAGER']);
  let escalated = 0;
  for (const request of candidates) {
    try {
      const site = await daysRepository.siteFacts(request.siteId);
      const person = await daysRepository.personAnywhere(request.employeeId);
      if (!site || !person) continue;
      const moved = await runAudited(async (tx) => {
        if (!(await requestsRepository.escalate(tx, request.id, now, { userId: hr?.id ?? null }))) return { result: false, entries: [] };
        const entry = timesheetEntry({
          companyId: site.companyId,
          siteId: request.siteId,
          actor: SYSTEM_ACTOR,
          channel: 'SYSTEM',
          action: 'timesheet.request_escalated',
          subjectId: request.employeeId,
          userId: person.userId,
          before: { requestId: request.id, waitingOn: request.waitingOnRole },
          after: { requestId: request.id, waitingOn: 'HR_MANAGER', waitingDays: waitingDays(request.createdAt, now) },
        });
        const event = eventOf('time_request.escalated', { siteId: request.siteId, requestId: request.id, employeeId: request.employeeId, userId: person.userId, kind: request.kind, waitingDays: waitingDays(request.createdAt, now) }, now);
        return { result: true, entries: [entry], events: [event] };
      });
      if (!moved) continue;
      escalated += 1;
      await told([hr?.id, person.userId], 'time_request.escalated', { kind: request.kind });
    } catch (error) {
      logger.error({ err: error, requestId: request.id }, 'time request escalation failed');
    }
  }
  return { escalated };
}
