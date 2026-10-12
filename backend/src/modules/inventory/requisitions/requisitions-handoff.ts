import { dispatchService } from '../dispatch/dispatch-service';
import { logger } from '../../../utils/logger';
import { requisitionsRepository } from './requisitions-repository';

/**
 * The two hand-offs between Requisitions (Block 1) and Dispatch (Block 2), contract §2.3 and §4.2. The requisition service calls them
 * at the right moments; the bodies live in `dispatch/dispatch-service.ts`. Both are best effort for the caller: a failure here is
 * logged and never undoes the write that triggered it (the pack screens reconcile on every look, and the next count tries to close again).
 */

/**
 * Called after every department count and discrepancy settlement (Block 2: Deliveries V6 and Discrepancies Q4 call it). A CONFIRMED dispatch with no gap held
 * becomes CLOSED; when every department's dispatch is CLOSED the requisition is set to CLOSED with `closedAt`.
 */
export const closeIfComplete = async (requisitionId: string): Promise<void> => {
  try {
    await dispatchService.closeIfComplete(requisitionId);
  } catch (error) {
    logger.error({ err: error, requisitionId }, 'closeIfComplete failed');
  }
};

/** Called when an addition is approved (R22): its lines join the department's unsigned dispatch (open pack screens refetch). */
export const attachAdditionToDispatch = async (additionId: string): Promise<void> => {
  try {
    const addition = await requisitionsRepository.findAdditionRef(additionId);
    if (addition) await dispatchService.attachAddition(addition.requisitionId, addition.departmentId);
  } catch (error) {
    logger.error({ err: error, additionId }, 'attachAdditionToDispatch failed');
  }
};
