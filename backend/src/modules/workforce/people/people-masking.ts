/** "•••• 5678": the last four characters, never more. Short values are fully masked. */
export const maskTail = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const tail = value.length > 6 ? value.slice(-4) : '';
  return tail ? `•••• ${tail}` : '••••';
};

/** Identifiers shown masked even to people who may see them; the clear value comes only from the audited reveal call. */
export const MASKED_FIELDS = ['nationalId', 'kraPin', 'shaNumber', 'nssfNumber', 'helbNumber', 'accountNumber', 'mpesaPhone'] as const;
export type MaskedField = (typeof MASKED_FIELDS)[number];

export const isMaskedField = (field: string): field is MaskedField => (MASKED_FIELDS as readonly string[]).includes(field);

/** The value to show for a field: clear on the person's own record, masked for identifiers otherwise. */
export const presentField = (field: string, value: string | null, own: boolean): string | null =>
  own || !isMaskedField(field) ? value : maskTail(value);
