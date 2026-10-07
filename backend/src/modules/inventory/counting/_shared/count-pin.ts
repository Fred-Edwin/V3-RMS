import type { Request } from 'express';
import { comparePin } from '../../../../utils/password';
import { invalidPinError } from './count-errors';
import { countPinRepository, type PinHolder } from './pin-repository';

type Actor = NonNullable<Request['user']>;

export const countPin = {
  /**
   * The caller signs with their OWN PIN, whoever they are (the System Admin signs with theirs, so the record names them). A missing
   * PIN and a wrong PIN are the same `INVALID_PIN`: nothing is said about which. The front end never reaches the "missing" case,
   * because the shell's sign dialog checks the caller's PIN status first and shows "Set your signing PIN".
   */
  verifyOwn: async (actor: Actor, pin: string): Promise<PinHolder> => {
    const holder = await countPinRepository.findHolder(actor.id);
    if (!holder || holder.pinHash === null || !(await comparePin(pin, holder.pinHash))) throw invalidPinError();
    return holder;
  },
};
