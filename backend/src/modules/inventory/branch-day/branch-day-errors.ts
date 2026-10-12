import { AppError } from '../../../utils/errors';
import type { BranchDayErrorCode } from './_shared/branch-day-contract';

/**
 * The stable error codes of Branch day (`BRANCH_DAY_ERROR_CODES` in the frozen contract). The screens switch on `code`, so a code is
 * never renamed; the message is a plain English fallback. `INVALID_PIN` comes from the shared signing helper
 * (`counting/_shared/count-pin.ts`) with the same code and status, so it is raised there and not here.
 */
const STATUS: Record<BranchDayErrorCode, number> = {
  INVALID_PIN: 401,
  NOT_YOUR_DEPARTMENT: 403,
  NOT_YOUR_BRANCH: 403,
  DAY_ALREADY_CLOSED: 409,
  DAY_NOT_READY: 409,
  DAY_NOT_CLOSED: 409,
  ALREADY_COUNTED: 409,
  COUNT_INCOMPLETE: 422,
  OPENING_ALREADY_CHECKED: 409,
  ITEM_NOT_IN_DAY: 422,
  DEPARTMENT_NOT_COUNTED: 409,
  CORRECTION_WINDOW_PASSED: 409,
  CORRECTION_NO_CHANGE: 422,
  NO_DEPARTMENTS: 409,
};

export const branchDayError = (code: BranchDayErrorCode, message: string, details?: unknown): AppError => new AppError(STATUS[code], code, message, details);
