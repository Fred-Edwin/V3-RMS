import { ConflictError } from '../../../../utils/errors';
import { logger } from '../../../../utils/logger';
import { switchRepository } from '../../attendance/switch/switch-repository';

/**
 * Called first by the old leave write paths (submit, approve, reject, cancel, revert, balance update and the contract-type balance
 * sync). For a site whose attendance switch is ON the old screens may not write: that site's leave is decided in the new Leave
 * (L2 and L3). Every other site goes straight on, so the old leave behaves exactly as before. If the switch cannot be read the old
 * code carries on, because it is live in production (same rule as the legacy clock guard).
 */
export async function assertLegacyLeaveWritable(siteId: string | null | undefined): Promise<void> {
  if (!siteId) return;
  let switched = false;
  try {
    switched = await switchRepository.isEnabled(siteId);
  } catch (error) {
    logger.warn({ err: error, siteId }, 'attendance switch unreadable; legacy leave continues');
  }
  if (switched) throw new ConflictError('Leave for this branch is now handled in the new Leave screens.', 'LEAVE_IN_NEW_SYSTEM');
}
