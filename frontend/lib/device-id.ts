/**
 * The phone's own random id (8 to 64 characters). It is made once and kept in local storage; the server binds an unlock to it and
 * records it with each opening. If storage is blocked the id lives for the visit only. It is never shown on a screen.
 * The key is the one the payslip code already used, so a phone keeps the identity it had.
 */
const KEY = 'wendo.payslips.device';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
let visitOnly: string | null = null;

function randomId(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const valid = (value: string | null): value is string => value !== null && /^[A-Za-z0-9._-]{8,64}$/.test(value);

export function deviceId(): string {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (valid(saved)) return saved;
    const fresh = randomId();
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Storage blocked (a private window): one id for this visit, so the unlock still works.
    visitOnly ??= randomId();
    return visitOnly;
  }
}

/** The header every Workforce call carries, or nothing on the server (no window). */
export function deviceHeader(): Record<string, string> {
  return typeof window === 'undefined' ? {} : { 'x-device-id': deviceId() };
}
