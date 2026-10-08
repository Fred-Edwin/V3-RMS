import { AppError } from '../../../utils/errors';
import type { RequisitionErrorCode } from './_shared/requisitions-contract';

/**
 * The stable error codes of Requisitions (`REQUISITION_ERROR_CODES` in the frozen contract). The screens switch on `code`, so a
 * code is never renamed; the message is a plain English fallback. `INVALID_PIN` comes from the shared signing helper
 * (`counting/_shared/count-pin.ts`) with the same code and status.
 */
const STATUS: Record<RequisitionErrorCode, number> = {
  REQUISITION_ALREADY_OPEN: 409,
  INVALID_PIN: 401,
  NOT_YOUR_DEPARTMENT: 403,
  SECTION_EMPTY: 409,
  ITEM_NOT_IN_DEPARTMENT: 422,
  ALREADY_APPROVED: 409,
  NOT_READY_TO_APPROVE: 409,
  ADDITION_LOCKED: 409,
  REASON_REQUIRED: 422,
  DEPARTMENT_PACKED: 409,
  CANCELLED: 409,
};

export const requisitionError = (code: RequisitionErrorCode, message: string, details?: unknown): AppError => new AppError(STATUS[code], code, message, details);

/**
 * Codes the contract's list does not carry, for states it does not name (see the README, "Contract drift"). They are plain 409s with
 * a stable code so a screen can still switch on them.
 */
export const stateConflict = (code: 'SECTION_NOT_SENT' | 'SECTION_ALREADY_SENT' | 'NOT_APPROVED' | 'SECTION_NOT_OPEN' | 'ADDITION_NOT_PENDING', message: string): AppError =>
  new AppError(409, code, message);
