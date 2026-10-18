import type { NextFunction, Request, Response } from 'express';
import { ConflictError } from '../../../../utils/errors';
import { logger } from '../../../../utils/logger';
import { switchRepository } from './switch-repository';

/**
 * Placed on the four legacy clock routes. While a site's new clock is switched on, the legacy endpoints for that site
 * answer a clear refusal and change nothing (decision A2); for every other site the request goes straight on, so the
 * legacy clock behaves exactly as before. Turning the switch off makes them work again at once.
 */
export const refuseLegacyClockWhenSwitched = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const siteId = req.user?.siteId;
  let switched = false;
  try {
    switched = siteId ? await switchRepository.isEnabled(siteId) : false;
  } catch (error) {
    // The legacy clock is live in production: if the switch cannot be read, it carries on exactly as before.
    logger.warn({ err: error, siteId }, 'attendance switch unreadable; the legacy clock continues');
  }
  if (switched) {
    throw new ConflictError('Your branch now clocks in the new way. Close the app and open it again.', 'CLOCK_MOVED_TO_NEW_ATTENDANCE');
  }
  next();
};
