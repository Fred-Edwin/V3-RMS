import { NotFoundError } from '../../../../utils/errors';
import type { AccessSubject } from '../../_shared/workforce-access';
import { roleName } from './conduct-context';
import { conductNoticesRepository, type ConductNotice } from './conduct-notices-repository';
import { conductPeopleRepository, type ConductPerson } from './conduct-people-repository';
import { assertCanRead } from './conduct-scope';

export interface LoadedNotice {
  notice: ConductNotice;
  person: ConductPerson;
}

/** The notice and its person, or 404 (a notice outside the caller's scope is never confirmed to exist). */
export async function loadReadable(subject: AccessSubject, companyId: string, noticeId: string): Promise<LoadedNotice> {
  const notice = await conductNoticesRepository.findById(companyId, noticeId);
  if (!notice) throw new NotFoundError('We could not find that notice.', 'NOTICE_NOT_FOUND');
  const person = await conductPeopleRepository.personById(companyId, notice.employeeId);
  if (!person) throw new NotFoundError('We could not find that notice.', 'NOTICE_NOT_FOUND');
  assertCanRead(subject, { personUserId: notice.personUserId, siteId: notice.siteId, personSiteNow: person.siteId });
  return { notice, person };
}

/** "Barista", else the department, else the login's role: what the letter and the lists call the person's job. */
export const jobLabelOf = (person: ConductPerson): string => person.position ?? person.department ?? roleName(person.role);
