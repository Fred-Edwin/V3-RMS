/**
 * Hand-offs to Block 2 (contract §2.3 and §4.2). Both are deliberate no-ops in Block 1; Block 2 (dispatch, packing, deliveries)
 * fills the bodies, and the requisition service already calls them at the right moments, so nothing else changes then.
 */

/**
 * Called after every dispatch confirmation and discrepancy settlement (Block 2). When every department's dispatch is confirmed and
 * every discrepancy is settled or open-but-confirmed, it sets the requisition to CLOSED with `closedAt`. Block 1 sets nothing to CLOSED.
 */
export const closeIfComplete = async (_requisitionId: string): Promise<void> => {
  // Block 2 fills this in.
};

/**
 * Called when an addition is approved (R22). Block 2 joins the addition's lines to the department's unsigned dispatch. In Block 1 the
 * old dispatch builds its lines from the requisition when the store signs, and the approved addition's lines are already on the
 * section, so there is nothing to attach.
 */
export const attachAdditionToDispatch = async (_additionId: string): Promise<void> => {
  // Block 2 fills this in.
};
