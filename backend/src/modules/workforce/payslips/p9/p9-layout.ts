/**
 * The P9 layout definition (S12): the columns of the monthly table, by key, with the words printed above them. STRUCTURE ONLY. No tax
 * rule, rate, band or relief amount is written here or anywhere in the P9 code: every figure is read from the frozen payslip lines
 * (PD16), and the columns are mapped to those lines in `p9-model.ts`.
 *
 * The Accountant confirms this layout once against the KRA's current P9 form (PD14). The confirmation is stored against `P9_LAYOUT_VERSION`;
 * changing a column name or adding a column means a new version, and a new version needs a new confirmation before anyone can download.
 */
export const P9_LAYOUT_VERSION = 1;

export const P9_COLUMNS = [
  { key: 'gross', label: 'Gross pay' },
  { key: 'contributions', label: 'Contributions that reduce taxable pay' },
  { key: 'taxable', label: 'Taxable pay' },
  { key: 'taxCharged', label: 'Tax charged' },
  { key: 'relief', label: 'Relief' },
  { key: 'paye', label: 'PAYE deducted' },
] as const;

export type P9ColumnKey = (typeof P9_COLUMNS)[number]['key'];
