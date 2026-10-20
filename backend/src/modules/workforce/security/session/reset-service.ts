import { z } from 'zod';
import { ConflictError, ValidationError } from '../../../../utils/errors';
import { comparePassword, hashPassword } from '../../../../utils/password';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { securityEntry } from '../security-context';
import { forgetSession } from './reset-gate';
import { sessionRepository } from './session-repository';

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Use at least 8 characters.').max(128),
    confirm: z.string().max(128),
  })
  .strict()
  .refine((v) => v.newPassword === v.confirm, { message: 'The two passwords are different.', path: ['confirm'] });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** What the shell asks on every load: does this person have to choose a new password before anything else? */
export async function securityState(subject: AccessSubject): Promise<{ mustChangePassword: boolean }> {
  const flag = await sessionRepository.flagOf(subject.id);
  return { mustChangePassword: flag?.mustChangePassword === true };
}

/**
 * The new password after "This wasn't me". Only while the flag is up (else 409 RESET_NOT_REQUIRED). It cannot be the old one. The
 * answer carries no tokens: the front end signs in again with the new password (the sign-in code is the old auth module).
 */
export async function resetPassword(subject: AccessSubject, input: ResetPasswordInput): Promise<{ reset: true }> {
  const ctx = await resolveActor(subject);
  if (!(await securityState(subject)).mustChangePassword) throw new ConflictError('You do not need to choose a new password.', 'RESET_NOT_REQUIRED');
  const oldHash = await sessionRepository.passwordHashOf(subject.id);
  if (oldHash && (await comparePassword(input.newPassword, oldHash))) throw new ValidationError('Choose a password you have not used before.');
  const passwordHash = await hashPassword(input.newPassword);
  await runAudited<void>(async (tx) => {
    const done = await sessionRepository.setPassword(tx, subject.id, passwordHash);
    if (done.count !== 1) throw new ConflictError('You do not need to choose a new password.', 'RESET_NOT_REQUIRED');
    await sessionRepository.clearMustChange(tx, subject.id);
    await sessionRepository.deleteRefreshTokens(tx, subject.id);
    return { result: undefined, entries: [securityEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'security.password_reset', subjectType: 'User', subjectId: subject.id, subjectUserId: subject.id })] };
  });
  forgetSession(subject.id);
  return { reset: true };
}
