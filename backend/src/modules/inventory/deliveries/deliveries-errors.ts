import { AppError } from '../../../utils/errors';
import type { DeliveryErrorCode } from './_shared/deliveries-contract';

/**
 * The stable error codes of Deliveries (`DELIVERY_ERROR_CODES` in the frozen contract). The screens switch on `code`, so a code is
 * never renamed; the message is a plain English fallback. `INVALID_PIN` comes from the shared signing helper
 * (`counting/_shared/count-pin.ts`) with the same code and status, so it is raised there and not here.
 */
const STATUS: Record<DeliveryErrorCode, number> = {
  INVALID_PIN: 401,
  NOT_YOUR_DEPARTMENT: 403,
  NOT_ON_THE_WAY: 409,
  COUNT_AGAIN_PENDING: 409,
  LINE_NOT_DIFFERENT: 409,
  PHOTO_TYPE_NOT_ALLOWED: 415,
  ON_BEHALF_NOT_ALLOWED: 403,
  ALREADY_CONFIRMED: 409,
  NOT_COUNTED: 409,
  RECOUNT_USED: 409,
  REASON_REQUIRED: 422,
  DISPATCH_CANCELLED: 409,
  TOO_MANY_PHOTOS: 409,
  PHOTO_TOO_LARGE: 413,
};

export const deliveryError = (code: DeliveryErrorCode, message: string, details?: unknown): AppError => new AppError(STATUS[code], code, message, details);
