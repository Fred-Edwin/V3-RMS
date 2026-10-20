import type { PayoutView } from '../_shared/types/action-types';

/** Why Mark as paid cannot be pressed yet, as text; null when it can. The server checks the same things again. */
export function markPaidBlock(p: PayoutView): string | null {
  if (p.cannotPay.length > 0) return `Fix the ${p.cannotPay.length} ${p.cannotPay.length === 1 ? 'person' : 'people'} with no bank account first.`;
  const bank = p.methods[0];
  if (bank && bank.people > 0 && bank.file.state !== 'DOWNLOADED') return bank.file.state === 'VOIDED' ? 'The bank file was voided. Download the new one first.' : 'Download the bank file first.';
  return null;
}

/** The pay-out card's file line. */
export function fileStateWords(state: 'NONE' | 'DOWNLOADED' | 'VOIDED'): string {
  return state === 'NONE' ? 'Not downloaded yet' : state === 'DOWNLOADED' ? 'Downloaded' : 'Voided';
}
