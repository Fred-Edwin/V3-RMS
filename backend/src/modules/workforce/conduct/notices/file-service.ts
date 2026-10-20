import { NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiDateOf } from '../../_shared/time/nairobi-time';
import { grantsOf, inScope, scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { decisionsRepository } from '../appeals/decisions-repository';
import { conductActor, conductEntry } from '../_shared/conduct-context';
import { conductNoticesRepository } from '../_shared/conduct-notices-repository';
import { conductPeopleRepository } from '../_shared/conduct-people-repository';
import { legacyRepository } from '../rollout/legacy-repository';
import { effectiveStatus, STATUS_WORDS, titleOf } from './notice-view';
import { hasLetter } from '../_shared/conduct-model';
import { fileReadRepository } from './file-read-repository';

export interface FileTab {
  notices: { id: string; title: string; aboutLabel: string; status: string; statusWord: string; issuedAt: string; validUntil: string; issuerLabel: string; hasLetter: boolean; live: boolean }[];
  timeline: { at: string; text: string }[];
  legacy: { id: string; level: string; actionDate: string; label: string }[];
  access: { role: string; text: string }[];
  canIssue: boolean;
}

/** Who can see conduct, generated from the access table rather than typed (S14). */
function accessRows(): FileTab['access'] {
  return [
    { role: 'The staff member', text: 'Own notices' },
    { role: 'Branch Manager', text: 'Own site, issues' },
    { role: 'Store Manager', text: 'Central Store, issues' },
    { role: 'HR Manager', text: 'All sites, decides appeals' },
    { role: 'Director', text: 'Reads all; decides notices HR issued' },
    { role: 'Department head', text: 'Nothing unless named as a witness' },
    { role: 'Accountant, others', text: 'Nothing' },
  ];
}

const EVENT_TEXT: Record<string, (who: string, payload: Record<string, unknown>) => string> = {
  ISSUED: (who) => `${who} issued the notice`,
  SIGNED: (who) => `${who} signed that the notice was received`,
  SIGNED_LATE: (who) => `${who} signed that the notice was received (late)`,
  NOT_SIGNED_RECORDED: (who) => `${who} recorded that the notice was given and not signed`,
  WITNESS_CONFIRMED: (who) => `${who} confirmed as witness`,
  WITNESS_DECLINED: (who) => `${who} did not confirm as witness`,
  APPEALED: (who) => `${who} appealed`,
  DECIDED: (who, p) => `${who} decided the appeal: ${String(p.outcome ?? '').toLowerCase().replace(/_/g, ' ')}`,
  CHANGED: (who, p) => `${who} changed the notice: ${String(p.outcome ?? '').toLowerCase().replace(/_/g, ' ')}`,
  ENDED: () => 'The notice ended by itself',
};

/**
 * The Conduct tab of an employee file (S14). A person outside the reader's scope is 404; a role without `discipline.read` is 403.
 * Reading it writes one `conduct.file_read` entry per person per viewer per day. The timeline comes from the notice events.
 */
export async function fileTab(subject: AccessSubject, employeeId: string, now: Date = new Date()): Promise<FileTab> {
  const ctx = await conductActor(subject, 'discipline.read');
  const person = await conductPeopleRepository.personById(ctx.companyId, employeeId);
  if (!person || !inScope(subject, 'discipline.read', { userId: person.userId, siteId: person.siteId })) throw new NotFoundError('We could not find that person.', 'PERSON_NOT_FOUND');
  const notices = await conductNoticesRepository.forEmployee(ctx.companyId, employeeId);
  const decisions = await decisionsRepository.latestFor(notices.map((n) => n.id));
  const timeline: FileTab['timeline'] = [];
  for (const notice of notices) {
    for (const event of await conductNoticesRepository.eventsOf(notice.id)) {
      const who = event.actorName ? `${event.actorName}, ${event.actorRole ?? ''}`.replace(/, $/, '') : 'The system';
      const text = EVENT_TEXT[event.kind]?.(who, (event.payload ?? {}) as Record<string, unknown>);
      if (text) timeline.push({ at: event.at.toISOString(), text: `${titleOf(notice)}: ${text}` });
    }
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));
  await logFileRead(subject, ctx, person.siteId, person.userId, employeeId, now);
  return {
    notices: notices.map((notice) => {
      const status = effectiveStatus(notice, now);
      return {
        id: notice.id,
        title: titleOf(notice),
        aboutLabel: decisions.has(notice.id) ? `${notice.about.toLowerCase()} · decided on appeal` : notice.about.toLowerCase(),
        status,
        statusWord: STATUS_WORDS[status],
        issuedAt: notice.issuedAt.toISOString(),
        validUntil: notice.validUntil.toISOString().slice(0, 10),
        issuerLabel: `${notice.issuerName}, ${notice.issuerRole}`,
        hasLetter: hasLetter(notice.level),
        live: ['ISSUED', 'RECORDED', 'SIGNED', 'GIVEN_NOT_SIGNED', 'APPEALED', 'KEPT'].includes(status),
      };
    }),
    timeline,
    legacy: person.userId ? await legacyRepository.forUser(person.userId) : [],
    access: accessRows(),
    canIssue: workforceCan(subject, 'discipline.issue') && scopeOf(subject, 'discipline.issue') !== null && grantsOf(subject)['discipline.issue'] !== undefined && person.userId !== subject.id,
  };
}

/** One `conduct.file_read` entry per person per viewer per day (spec S14). */
async function logFileRead(subject: AccessSubject, ctx: Awaited<ReturnType<typeof conductActor>>, siteId: string, personUserId: string | null, employeeId: string, now: Date): Promise<void> {
  const dayStart = new Date(`${nairobiDateOf(now)}T00:00:00+03:00`);
  if (await fileReadRepository.readToday({ companyId: ctx.companyId, viewerId: subject.id, employeeId, dayStart })) return;
  await runAudited<void>(async () => ({
    result: undefined,
    entries: [{ ...conductEntry({ ctx, siteId, action: 'conduct.file_read', noticeId: employeeId, subjectUserId: personUserId, after: { employeeId } }), subjectType: 'Employee' }],
  }));
}
