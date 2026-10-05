import type { OrderStatus } from '../types';

/** "13776.00" -> "13,776" (whole shillings, as Paper draws them in lists). */
export const kes = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n.toLocaleString('en-KE', { maximumFractionDigits: 0 }) : '—';
};

/** "13776.5" -> "13,776.50" (two decimals, for totals and documents). */
export const kes2 = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
};

/** "82.000" -> "82", "1.5" -> "1.5". */
export const qty = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : '—';
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-30" or an ISO time -> "30 Sep". */
export const dayMonth = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
};

/** "2026-09-30" -> "30 Sep 2026". */
export const fullDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** An ISO time -> "Today 14:10", "Yesterday 09:42" or "29 Sep 14:10". */
export const whenLabel = (iso: string | null | undefined, now: Date = new Date()): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  return `${dayMonth(iso)} ${time}`;
};

/** "2026-09-30" for an input, from a Date. */
export const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  MPESA_PAYBILL: 'M-Pesa Paybill',
  MPESA_TILL: 'M-Pesa Till',
  MPESA_SEND_MONEY: 'M-Pesa Send Money',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  AWAITING_APPROVAL: 'Awaiting approval',
  RETURNED: 'Returned',
  APPROVED: 'Approved · ready to send',
  SENT: 'Sent · to receive',
  DELIVERED: 'Delivered · awaiting invoice',
  INVOICED: 'Invoiced · to pay',
  CLOSED: 'Closed · paid in full',
  CANCELLED: 'Cancelled',
};

/** The short stage word shown in a list row. */
export const STAGE_WORD: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  AWAITING_APPROVAL: 'Awaiting approval',
  RETURNED: 'Returned',
  APPROVED: 'Ready to send',
  SENT: 'Awaiting delivery',
  DELIVERED: 'Awaiting invoice',
  INVOICED: 'To pay',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
