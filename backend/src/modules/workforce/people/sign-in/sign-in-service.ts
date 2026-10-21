import { ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { addDays, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { employeesRepository } from '../employees/employees-repository';
import { resolveActor, todayOf } from '../people-context';
import { suggestSignInEmail } from './sign-in-email';
import { TEMPORARY_PASSWORD_DAYS, generateTemporaryPassword } from './temporary-password';

export interface TemporaryPasswordIssue {
  password: string;
  /** The last day it works if the person has not signed in by then. */
  expiresOn: NairobiDate;
}

/** The sign-in address and the temporary password for hire step 5 (findings 43 and 44). Both come from the server. */
export const signInService = {
  async suggestEmail(subject: AccessSubject, name: string): Promise<{ email: string }> {
    await resolveActor(subject);
    const email = await suggestSignInEmail(name, (candidate) => employeesRepository.emailTaken(candidate));
    if (!email) throw new ValidationError('Add the first and second name to get a sign-in address', 'NAME_TOO_SHORT');
    return { email };
  },

  /**
   * A fresh password each call. The audit entry records that one was generated, by whom and for whom, and its expiry date:
   * never the password itself.
   */
  async newTemporaryPassword(subject: AccessSubject, employeeId: string | undefined, now: Date = new Date()): Promise<TemporaryPasswordIssue> {
    const ctx = await resolveActor(subject);
    const expiresOn = addDays(todayOf(now), TEMPORARY_PASSWORD_DAYS);
    const password = generateTemporaryPassword();
    await runAudited(async () => ({
      result: null,
      entries: [
        {
          companyId: ctx.companyId,
          siteId: subject.siteId,
          actor: ctx.auditActor,
          action: 'people.temporary_password_generated',
          category: 'PEOPLE' as const,
          subjectType: employeeId ? 'Employee' : 'Company',
          subjectId: employeeId ?? ctx.companyId,
          after: { expiresOn },
        },
      ],
    }));
    return { password, expiresOn };
  },
};
