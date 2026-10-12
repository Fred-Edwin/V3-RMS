import { AppError } from '../../../utils/errors';
import type { DiscrepancyErrorCode } from './_shared/discrepancies-contract';

/**
 * The stable error codes of Discrepancies (`DISCREPANCY_ERROR_CODES` in the frozen contract). The screens switch on `code`, so a code
 * is never renamed. `INVALID_PIN` comes from the shared signing helper (`counting/_shared/count-pin.ts`) with the same code and status.
 */
const STATUS: Record<DiscrepancyErrorCode, number> = {
  FINDING_ALREADY_RECORDED: 409,
  INVALID_PIN: 401,
  FINDING_NOT_ALLOWED: 422,
  FINDING_NOT_REVERSIBLE: 409,
};

export const discrepancyError = (code: DiscrepancyErrorCode, message: string, details?: unknown): AppError => new AppError(STATUS[code], code, message, details);
