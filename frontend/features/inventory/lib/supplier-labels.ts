import type { SupplierContactRole, SupplierPayMethodType } from '../types/supplier';

export const SUPPLIER_CONTACT_ROLE_LABEL: Record<SupplierContactRole, string> = {
  SALES_REP: 'Sales rep',
  ACCOUNTS: 'Accounts',
  DELIVERY: 'Delivery',
  OWNER: 'Owner',
  OTHER: 'Other',
};
export const SUPPLIER_CONTACT_ROLE_ORDER: readonly SupplierContactRole[] = ['SALES_REP', 'ACCOUNTS', 'DELIVERY', 'OWNER', 'OTHER'];

export const PAY_METHOD_LABEL: Record<SupplierPayMethodType, string> = {
  BANK_TRANSFER: 'Bank transfer',
  MPESA_PAYBILL: 'M-Pesa Paybill',
  MPESA_TILL: 'M-Pesa Till',
  MPESA_SEND_MONEY: 'M-Pesa Send Money',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
};
/** The kinds offered in Add a payment method, in Paper's order. Cash is not drawn there: it needs no details, and Record payment always offers it. */
export const PAY_METHOD_ORDER: readonly SupplierPayMethodType[] = ['BANK_TRANSFER', 'MPESA_PAYBILL', 'MPESA_TILL', 'MPESA_SEND_MONEY', 'CHEQUE'];

/** Banks offered when adding a bank transfer or cheque; a bank not listed can be typed. */
export const COMMON_BANKS: readonly string[] = [
  'Equity Bank',
  'KCB Bank',
  'Co-operative Bank',
  'NCBA Bank',
  'Absa Bank',
  'Stanbic Bank',
  'Standard Chartered',
  'I&M Bank',
  'Family Bank',
  'Diamond Trust Bank',
  'Kenya Women Microfinance Bank',
];
