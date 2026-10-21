/**
 * The banks HR picks from (finding 29), so "Equity", "equity bank" and "EQUITY" stop being three banks in payroll. A first list of
 * the banks staff most often use; "Other bank" lets HR type a name that is missing, and a missing bank is added here.
 */
export const KENYAN_BANKS: readonly string[] = [
  'Absa Bank Kenya',
  'Co-operative Bank',
  'Diamond Trust Bank',
  'Equity Bank',
  'Family Bank',
  'I&M Bank',
  'KCB Bank',
  'National Bank of Kenya',
  'NCBA Bank',
  'Stanbic Bank',
  'Standard Chartered Bank',
  'Sidian Bank',
  'Gulf African Bank',
  'HF Group',
  'Postbank',
];

export const OTHER_BANK = 'Other bank';

/** True when the saved name is one of the list (so the picker shows it); anything else is an "Other bank" being typed. */
export const isListedBank = (name: string): boolean => KENYAN_BANKS.includes(name);
