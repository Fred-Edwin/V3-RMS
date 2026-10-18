import { ForbiddenError, NotFoundError } from '../../../utils/errors';
import { assertInScope, scopeOf, type AccessSubject, type Capability } from '../_shared/workforce-access';
import type { PersonRow } from './attendance.types';
import { daysRepository } from './days/days-repository';

/**
 * The person an action is about, if the caller may act on them. Another branch answers 404 (nothing about it is
 * revealed). Inside the branch, a department head outside their departments is refused (403 for a write, 404 for a
 * read, as the rota does). Nobody changes their own clock through these routes.
 */
export async function personInScope(subject: AccessSubject, capability: Capability, employeeId: string, mode: 'read' | 'write'): Promise<PersonRow> {
  const person = await daysRepository.personAnywhere(employeeId);
  const scope = scopeOf(subject, capability);
  if (!person || scope === null) throw new NotFoundError('Person not found');
  if (scope !== 'all' && person.siteId !== subject.siteId) throw new NotFoundError('Person not found');
  assertInScope(subject, capability, { userId: person.userId, siteId: person.siteId, departmentId: person.departmentId }, mode === 'read' ? 'not_found' : 'forbidden');
  if (mode === 'write' && person.userId !== null && person.userId === subject.id) {
    throw new ForbiddenError('You cannot change your own time. Ask your manager.', 'CANNOT_CHANGE_OWN_TIME');
  }
  return person;
}
