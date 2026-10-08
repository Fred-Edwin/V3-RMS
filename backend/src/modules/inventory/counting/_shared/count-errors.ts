import { AppError } from '../../../../utils/errors';
import type { CountErrorCode } from './counting-contract';

/**
 * The stable error codes of Counting (`COUNT_ERROR_CODES` in the frozen contract). The screens switch on `code`, so a code is
 * never renamed; the message is a plain English fallback. `FORBIDDEN` is not here: `requireCapability` raises it.
 */
const STATUS: Record<CountErrorCode, number> = {
  YOU_HAVE_OPEN_COUNT: 409,
  SECTION_BUSY: 409,
  NOTHING_TO_COUNT: 422,
  RECOUNT_NOT_ALLOWED: 422,
  COUNT_NOT_OPEN: 409,
  COUNT_NOT_SUBMITTED: 409,
  NOT_YOUR_COUNT: 403,
  NOTHING_COUNTED: 422,
  CAUSE_REQUIRED: 422,
  LINES_UNDECIDED: 422,
  INVALID_PIN: 401,
  LAYOUT_CHANGED: 409,
  SECTION_NAME_TAKEN: 409,
  ITEM_NOT_IN_SETUP: 404,
  MOVE_ALREADY_UNDONE: 409,
};

export const countError = (code: CountErrorCode, message: string, details?: unknown): AppError => new AppError(STATUS[code], code, message, details);

export const invalidPinError = (): AppError => countError('INVALID_PIN', 'That PIN is not right.');
export const countNotOpenError = (): AppError => countError('COUNT_NOT_OPEN', 'This count has been signed, so it cannot be changed.');
export const countNotSubmittedError = (): AppError => countError('COUNT_NOT_SUBMITTED', 'This count is not waiting for a decision.');
export const notYourCountError = (): AppError => countError('NOT_YOUR_COUNT', 'This is not your count.');
