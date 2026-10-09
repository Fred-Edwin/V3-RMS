import type { ConfirmDeliveryResult } from '../_shared/types/deliveries-contract';

/** The result of the last confirmation, kept for this tab so "Delivery confirmed" (D12) survives a reload. Blocked storage only means it is forgotten. */
const KEY = (id: string): string => `delivery-confirmed:${id}`;

export function rememberConfirmed(result: ConfirmDeliveryResult): void {
  try {
    window.sessionStorage.setItem(KEY(result.id), JSON.stringify(result));
  } catch {
    // Forgotten on reload; the screen then reads the delivery file instead.
  }
}

export function recallConfirmed(id: string): ConfirmDeliveryResult | null {
  try {
    const raw = window.sessionStorage.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as ConfirmDeliveryResult) : null;
  } catch {
    return null;
  }
}
