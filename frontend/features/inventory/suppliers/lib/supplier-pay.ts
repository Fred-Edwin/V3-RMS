import type { SupplierPayMethod } from '../types/supplier';

/** "01702915 7702" → "0170 2915 7702": the full number in groups of four, once the user pressed Show. */
export function groupAccountNumber(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/** What a payment-method row says, by kind: the main line (mono for numbers) and a quieter second line. */
export function payMethodDetail(m: SupplierPayMethod): { primary: string; secondary: string | null; mono: boolean } {
  switch (m.type) {
    case 'BANK_TRANSFER':
      return {
        primary: [m.bankName, m.bankBranch ? `${m.bankBranch} branch` : null, m.accountName].filter(Boolean).join(' · '),
        secondary: null,
        mono: false,
      };
    case 'MPESA_PAYBILL':
      return { primary: `Paybill ${m.paybillNumber ?? ''}`.trim(), secondary: m.accountReference ? `Account reference ${m.accountReference}` : null, mono: true };
    case 'MPESA_TILL':
      return { primary: `Till ${m.tillNumber ?? ''}`.trim(), secondary: null, mono: true };
    case 'MPESA_SEND_MONEY':
      return { primary: m.phone ?? '', secondary: m.registeredName ? `Registered to ${m.registeredName}` : null, mono: true };
    case 'CHEQUE':
      return { primary: ['Payable to ' + (m.registeredName ?? ''), m.bankName].filter(Boolean).join(' · '), secondary: m.note, mono: false };
    case 'CASH':
      return { primary: 'Cash, no details to keep', secondary: null, mono: false };
  }
}
