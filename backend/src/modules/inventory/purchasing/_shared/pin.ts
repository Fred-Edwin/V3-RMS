import type { Request } from 'express';
import { comparePin } from '../../../../utils/password';
import { actorCan } from '../../_shared/central-store-access';
import { invalidPinError } from './purchasing-errors';
import { pinRepository, type PinHolder } from './pin-repository';

type Actor = NonNullable<Request['user']>;

/** Who may approve a payment reversal besides the caller's own PIN: a Store Manager or the System Admin. */
const REVERSAL_APPROVER_ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN'] as const;

const matches = async (holder: PinHolder, pin: string): Promise<boolean> => holder.pinHash !== null && (await comparePin(pin, holder.pinHash));

export const purchasingPin = {
  /** The caller signs with their own PIN. A missing or wrong PIN is the same `INVALID_PIN` (nothing is said about which). */
  verifyOwn: async (actor: Actor, pin: string): Promise<PinHolder> => {
    const holder = await pinRepository.findHolder(actor.id);
    if (!holder || !(await matches(holder, pin))) throw invalidPinError();
    return holder;
  },

  /**
   * A reversal is approved by a Store Manager or System Admin. When the caller holds `orders.approve` they sign with their own
   * PIN; otherwise (the Accountant) the approver types theirs in the same drawer and we find whose it is. Returns the approver.
   */
  verifyReversalApprover: async (actor: Actor, siteId: string, pin: string): Promise<PinHolder> => {
    if (actorCan(actor, 'orders.approve')) return purchasingPin.verifyOwn(actor, pin);
    const approvers = await pinRepository.findApprovers(siteId, REVERSAL_APPROVER_ROLES);
    for (const approver of approvers) {
      if (await matches(approver, pin)) return approver;
    }
    throw invalidPinError();
  },
};
