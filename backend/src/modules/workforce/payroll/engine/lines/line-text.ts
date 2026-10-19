import type { LineKind, PayLine } from '../engine.types';
import { formatCents, formatWhole, type Cents } from '../money';

/** "11 h 05 min": minutes are never rounded, only written as hours and minutes. */
export function minutesText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest} min` : `${hours} h ${String(rest).padStart(2, '0')} min`;
}

export const daysText = (days: number): string => `${days} ${days === 1 ? 'day' : 'days'}`;

/** A multiplier the way Rules shows it: "1.5 ×", "2 ×". */
export const multiplierText = (multiplier: string): string => `${multiplier.includes('.') ? multiplier.replace(/0+$/, '').replace(/\.$/, '') : multiplier} ×`;

export const whole = (cents: Cents): string => formatWhole(cents);

interface LineDraft {
  code: string;
  label: string;
  kind: LineKind;
  amount: Cents;
  workingText: string;
  taxable?: boolean;
  base?: string | null;
  baseAmount?: Cents | null;
  rate?: string | null;
  bandsUsed?: PayLine['bandsUsed'];
  quantity?: string | null;
  unit?: string | null;
  source: PayLine['source'];
  tableCode?: string | null;
  share?: PayLine['share'];
}

/** Every line is stored with its amount at 2 decimals and the working that produced it. */
export function payLine(draft: LineDraft): PayLine {
  return {
    code: draft.code,
    label: draft.label,
    kind: draft.kind,
    amount: formatCents(draft.amount),
    taxable: draft.taxable ?? false,
    base: draft.base ?? null,
    baseAmount: draft.baseAmount === undefined || draft.baseAmount === null ? null : formatCents(draft.baseAmount),
    rate: draft.rate ?? null,
    bandsUsed: draft.bandsUsed ?? null,
    quantity: draft.quantity ?? null,
    unit: draft.unit ?? null,
    source: draft.source,
    workingText: draft.workingText,
    tableCode: draft.tableCode ?? null,
    share: draft.share ?? null,
  };
}
