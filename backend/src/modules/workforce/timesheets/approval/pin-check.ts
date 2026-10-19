import { AppError, ConflictError } from '../../../../utils/errors';
import { comparePin } from '../../../../utils/password';
import { pinRepository } from './pin-repository';

/**
 * The signer's own PIN (D26): a missing PIN asks them to set one (409 PIN_NOT_SET); a wrong one is 401 INVALID_PIN. No lockout
 * and the tries are not logged (the owner's rule for codes); the PIN is never stored or written to the audit log.
 */
export async function assertOwnPin(userId: string, pin: string): Promise<void> {
  const hash = await pinRepository.hashOf(userId);
  if (hash === null) throw new ConflictError('Set your PIN first.', 'PIN_NOT_SET');
  if (!(await comparePin(pin, hash))) throw new AppError(401, 'INVALID_PIN', 'That PIN is not right.');
}
