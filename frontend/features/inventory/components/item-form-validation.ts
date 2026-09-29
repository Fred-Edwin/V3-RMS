// Pure validation for the Item form's numeric fields — kept out of the .tsx so it is unit-testable.

/**
 * Mirrors the backend's `positiveDecimalSchema` (`inventory-validators.ts`):
 * up to 8 integer digits + up to 4 decimals, strictly greater than zero.
 * Empty is valid — the field is optional and sends `null`. Returns an
 * inline error message, or `null` when the value is empty or valid. Never
 * a silent drop: an invalid value blocks the save with this message.
 */
export function validateOptionalPositiveDecimal(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  if (/^-/.test(value) || (/^\d+(\.\d+)?$/.test(value) && Number.parseFloat(value) <= 0)) {
    return 'Enter a number greater than 0.';
  }
  if (!/^\d{1,8}(\.\d{1,4})?$/.test(value)) {
    return 'Enter a number like 25 or 12.5 (up to 4 decimal places).';
  }
  return null;
}

/** "25.0000" → "25", "12.5000" → "12.5". Same number, no trailing zeros — what the owner would type. */
export function normalizeDecimalInput(value: string | null | undefined): string {
  if (!value) return '';
  return /^\d+\.\d+$/.test(value) ? value.replace(/\.?0+$/, '') : value;
}

export interface ItemFormErrors {
  conversion?: string;
  packSize?: string;
}

export function getItemFormErrors(values: { conversion: string; packSize: string }): ItemFormErrors {
  const errors: ItemFormErrors = {};
  const conversion = validateOptionalPositiveDecimal(values.conversion);
  const packSize = validateOptionalPositiveDecimal(values.packSize);
  if (conversion) errors.conversion = conversion;
  if (packSize) errors.packSize = packSize;
  return errors;
}
