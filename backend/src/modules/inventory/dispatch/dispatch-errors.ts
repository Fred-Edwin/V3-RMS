import { AppError } from '../../../utils/errors';
import type { DispatchErrorCode } from './_shared/dispatch-contract';

/**
 * The stable error codes of Dispatch (`DISPATCH_ERROR_CODES` in the frozen contract). The screens switch on `code`, so a code is
 * never renamed; the message is a plain English fallback. `INVALID_PIN` comes from the shared signing helper
 * (`counting/_shared/count-pin.ts`) with the same code and status, so it is raised there and not here.
 */
const STATUS: Record<DispatchErrorCode, number> = {
  NOT_ALL_PACKED: 409,
  INVALID_PIN: 401,
  CARRIER_INACTIVE: 409,
  NOTHING_TO_SEND: 409,
  REQUISITION_NOT_APPROVED: 409,
  OVER_REQUESTED: 422,
  NOT_SIGNED: 409,
  ALREADY_SIGNED: 409,
  STOCK_CHANGED: 409,
  DISPATCH_ALREADY_COUNTED: 409,
  DISPATCH_CANCELLED: 409,
  CARRIER_NAME_TAKEN: 409,
};

export const dispatchError = (code: DispatchErrorCode, message: string, details?: unknown): AppError => new AppError(STATUS[code], code, message, details);
