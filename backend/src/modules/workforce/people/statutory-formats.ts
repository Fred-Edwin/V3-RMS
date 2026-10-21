import { z } from 'zod';

/**
 * Formats of the statutory numbers (finding 21 and 65). KRA PIN is exact: a letter, nine digits, a letter. NSSF and SHA are
 * lenient on purpose because the real formats vary (older NSSF numbers are 6 to 10 digits, SHA/SHIF numbers follow the National
 * ID): five to fifteen letters or digits with at least five digits. Tighten when the client confirms the formats.
 */
const squash = (value: string): string => value.replace(/[\s-]+/g, '').toUpperCase();

export const KRA_PIN_PATTERN = /^[A-Z]\d{9}[A-Z]$/;
export const LENIENT_NUMBER_PATTERN = /^(?=(?:\D*\d){5})[A-Z0-9]{5,15}$/;

export const kraPinField = z
  .string()
  .transform(squash)
  .refine((v) => KRA_PIN_PATTERN.test(v), 'A KRA PIN is a letter, nine digits and a letter, for example A123456789B');

export const nssfField = z
  .string()
  .transform(squash)
  .refine((v) => LENIENT_NUMBER_PATTERN.test(v), 'Check the NSSF number: five to fifteen letters or digits');

export const shaField = z
  .string()
  .transform(squash)
  .refine((v) => LENIENT_NUMBER_PATTERN.test(v), 'Check the SHA number: five to fifteen letters or digits');

/** The payout choices. Cash is for casual (daily) staff only; the same rule answers the hire screen and the API. */
export const PAYOUT_METHODS = ['BANK', 'MPESA', 'CASH'] as const;
export type PayoutChoice = (typeof PAYOUT_METHODS)[number];
export const MONTHLY_PAYOUT_METHODS: readonly PayoutChoice[] = ['BANK', 'MPESA'];
export const CASUAL_PAYOUT_METHODS: readonly PayoutChoice[] = ['CASH', 'MPESA', 'BANK'];
export const payoutAllowed = (casual: boolean, method: PayoutChoice): boolean =>
  (casual ? CASUAL_PAYOUT_METHODS : MONTHLY_PAYOUT_METHODS).includes(method);
export const PAYOUT_CASH_REFUSAL = 'Cash is only for casual staff paid by the day. Choose a bank account or M-Pesa.';
