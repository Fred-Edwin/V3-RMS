/**
 * Plain-words summaries for the Payment tab's "Who changed these, and when" table (API_CONTRACT.md §30.10).
 * Built from the audit rows' masked snapshots, so no account number can reach the sentence.
 */

type Snapshot = Record<string, unknown> & { type?: string };

const TYPE_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'bank transfer',
  MPESA_PAYBILL: 'M-Pesa Paybill',
  MPESA_TILL: 'M-Pesa Till',
  MPESA_SEND_MONEY: 'M-Pesa Send Money',
  CASH: 'cash',
  CHEQUE: 'cheque',
};

/** snapshot field → the words used when it changes ("the account number"). */
const FIELD_LABEL: Record<string, string> = {
  bankName: 'bank',
  bankBranch: 'branch',
  accountName: 'account name',
  accountNumber: 'account number',
  paybillNumber: 'paybill number',
  accountReference: 'account reference',
  tillNumber: 'till number',
  phone: 'phone number',
  registeredName: 'name',
  note: 'note',
};

const typeLabel = (snapshot: Snapshot | null): string => TYPE_LABEL[snapshot?.type ?? ''] ?? 'payment method';

const listWords = (words: string[]): string =>
  words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

export const describePayMethodChange = (
  action: 'PAY_METHOD_CREATED' | 'PAY_METHOD_UPDATED' | 'PAY_METHOD_DELETED' | 'PAY_METHOD_DEFAULT_CHANGED',
  before: Snapshot | null,
  after: Snapshot | null,
): string => {
  switch (action) {
    case 'PAY_METHOD_CREATED': {
      if (after?.type === 'CHEQUE') {
        return after.registeredName ? `Added cheque, payable to ${String(after.registeredName)}` : 'Added cheque';
      }
      return `Added ${typeLabel(after)}`;
    }
    case 'PAY_METHOD_UPDATED': {
      const changed = Object.keys(FIELD_LABEL).filter((key) => (before?.[key] ?? null) !== (after?.[key] ?? null));
      const label = typeLabel(after ?? before);
      return changed.length === 0
        ? `Changed the ${label}`
        : `Changed the ${listWords(changed.map((key) => FIELD_LABEL[key]!))} on the ${label}`;
    }
    case 'PAY_METHOD_DELETED':
      return `Removed the ${typeLabel(before)}`;
    case 'PAY_METHOD_DEFAULT_CHANGED':
      return 'Changed which method is the default';
  }
};
