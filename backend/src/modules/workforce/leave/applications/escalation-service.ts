import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import { applicationsRepository } from '../data/applications-repository';
import { eventsRepository } from '../data/events-repository';
import { peopleRepository } from '../data/people-repository';
import { ESCALATION_BATCH, ESCALATION_MS } from '../leave.constants';
import { SYSTEM_ACTOR, asJson, eventOf, leaveEntry } from '../leave-audit';
import { deciderUserIds, tell } from '../leave-notify';

/**
 * The hourly job (L20). The stage is already DERIVED from the ask time, so a request is with HR after 72 hours even if this job is
 * down; this only writes the "moved to HR" step, the audit entry (channel SYSTEM), the `leave.moved_up` event and the two notices.
 * It marks each request in its own transaction and only while it is still waiting and unmarked, so a second run, or two workers at
 * once, write nothing twice. A failure on one request is logged and the others carry on.
 */
export async function sweepLeave(now: Date = new Date()): Promise<{ moved: number; failed: number }> {
  const due = await applicationsRepository.dueForHr(new Date(now.getTime() - ESCALATION_MS), ESCALATION_BATCH);
  let moved = 0;
  let failed = 0;
  for (const app of due) {
    try {
      const person = await peopleRepository.byId(app.companyId, app.employeeId);
      if (!person) continue;
      const did = await runAudited<boolean>(async (tx) => {
        if (!(await applicationsRepository.markWithHr(tx, app.id, now))) return { result: false, entries: [] };
        await eventsRepository.add(tx, { applicationId: app.id, kind: 'MOVED_TO_HR', at: now, byUser: null, role: 'SYSTEM' });
        const entry = leaveEntry({
          companyId: app.companyId, siteId: app.siteId, actor: SYSTEM_ACTOR, channel: 'SYSTEM', action: 'leave.moved_to_hr', subjectId: app.id, userId: person.userId,
          before: asJson({ stage: 'MANAGER' }), after: asJson({ stage: 'HR', type: app.typeCode, start: app.start, end: app.end, days: app.days }),
        });
        return { result: true, entries: [entry], events: [eventOf('leave.moved_up', { siteId: app.siteId, requestId: app.id, employeeId: person.id, toRole: 'HR_MANAGER' }, now)] };
      });
      if (!did) continue;
      moved += 1;
      await tell([person.userId], 'leave.moved_to_hr_person', { id: app.id });
      await tell(await deciderUserIds('HR_MANAGER', person), 'leave.moved_to_hr', { id: app.id });
    } catch (error) {
      failed += 1;
      logger.error({ err: error, applicationId: app.id }, 'leave escalation failed');
    }
  }
  return { moved, failed };
}
