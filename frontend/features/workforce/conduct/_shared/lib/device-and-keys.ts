/**
 * Two small ids a signed act carries. `deviceId` is the phone's own random id (8 to 64 characters), kept in local storage; it is the same
 * one the payslip code uses, so one phone is one device. `newIdempotencyKey` is made once per open dialog or screen, so a double tap or a
 * retry after a lost answer sends the same key and the server returns the first result (spec section 9).
 */
const KEY = 'wendo.payslips.device';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
let visitOnly: string | null = null;

function randomText(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const valid = (value: string | null): value is string => value !== null && /^[A-Za-z0-9._-]{8,64}$/.test(value);

export function deviceId(): string {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (valid(saved)) return saved;
    const fresh = randomText(24);
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Storage blocked (a private window): one id for this visit.
    visitOnly ??= randomText(24);
    return visitOnly;
  }
}

/** 8 to 100 characters, as the server's schema asks. */
export const newIdempotencyKey = (): string => `conduct-${randomText(28)}`;
