import { AppError } from '../../../../utils/errors';

/**
 * The stable error codes of Purchasing and Receiving (docs/API_CONTRACT.md §31.6). The screens switch on `code`, so a
 * code is never renamed. `FORBIDDEN` is not here: `requireCapability` raises it.
 */
const STATUS = {
  INVALID_PIN: 401,
  ORDER_NOT_FOUND: 404,
  INVOICE_NOT_FOUND: 404,
  PAYMENT_NOT_FOUND: 404,
  SUPPLIER_NOT_FOUND: 404,
  ORDER_WRONG_STATE: 409,
  SUPPLIER_ORDER_OPEN: 409,
  SUPPLIER_ON_HOLD: 409,
  ITEM_SETUP_INCOMPLETE: 409,
  CANNOT_CANCEL_AFTER_DELIVERY: 409,
  INVOICE_EXISTS: 409,
  DUPLICATE_INVOICE_NUMBER: 409,
  INVOICE_HAS_PAYMENTS: 409,
  INVOICE_DISPUTED: 409,
  INVOICE_NOT_DISPUTED: 409,
  PAYMENT_ALREADY_REVERSED: 409,
  PRICE_CHANGE_UNCONFIRMED: 422,
  RECEIVED_EXCEEDS_ORDERED: 422,
  DELIVERY_NOTE_REQUIRED: 422,
  DEPOSIT_EXCEEDS_ORDER: 422,
  REASON_REQUIRED: 422,
  PAYMENT_EXCEEDS_BALANCE: 422,
  CHEQUE_NUMBER_REQUIRED: 422,
  VALIDATION: 422,
  UPLOAD_TOO_LARGE: 422,
  UPLOAD_BAD_TYPE: 422,
  UPLOAD_FAILED: 503,
} as const;

export type PurchasingErrorCode = keyof typeof STATUS;

export const purchasingError = (code: PurchasingErrorCode, message: string, details?: Record<string, unknown>): AppError =>
  new AppError(STATUS[code], code, message, details);

/** The default sentence for the codes whose wording the contract fixes. */
export const wrongStateError = (status: string): AppError =>
  purchasingError('ORDER_WRONG_STATE', `This order is ${status.toLowerCase().replace(/_/g, ' ')}, so you cannot do that.`, { status });

export const invalidPinError = (): AppError => purchasingError('INVALID_PIN', 'That PIN is not right.');
