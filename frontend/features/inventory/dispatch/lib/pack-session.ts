import type { SignDispatchResult } from '../_shared/types/dispatch-contract';

/**
 * Small per-device memories of the packing flow. Storage can be blocked (private windows), so every read and write is wrapped:
 * the screens work without it, they only forget between pages.
 *   - which departments the packer has left out of the final review (kept until it is signed),
 *   - the result of the last signature, so "On the way" (D6) survives a reload,
 *   - the carrier the packer chose last time (a convenience, never the answer: the list is always the server's).
 */
const LEFT_OUT_KEY = (requisitionId: string): string => `dispatch-left-out:${requisitionId}`;
const SENT_KEY = (requisitionId: string): string => `dispatch-sent:${requisitionId}`;
const CARRIER_KEY = 'dispatch-last-carrier';

const read = (key: string): string | null => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null): void => {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Blocked storage: the flow simply forgets between pages.
  }
};

export function getLeftOut(requisitionId: string): Set<string> {
  const raw = read(LEFT_OUT_KEY(requisitionId));
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export function setLeftOut(requisitionId: string, ids: ReadonlySet<string>): void {
  write(LEFT_OUT_KEY(requisitionId), ids.size === 0 ? null : JSON.stringify(Array.from(ids)));
}

export function rememberSent(result: SignDispatchResult): void {
  write(SENT_KEY(result.requisitionId), JSON.stringify(result));
  write(LEFT_OUT_KEY(result.requisitionId), null);
}

export function recallSent(requisitionId: string): SignDispatchResult | null {
  const raw = read(SENT_KEY(requisitionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SignDispatchResult;
  } catch {
    return null;
  }
}

/** The carrier chosen last time lives in localStorage (it outlives the tab); an unknown id is simply ignored by the caller. */
export function getLastCarrier(): string | null {
  try {
    return window.localStorage.getItem(CARRIER_KEY);
  } catch {
    return null;
  }
}
export function setLastCarrier(id: string): void {
  try {
    window.localStorage.setItem(CARRIER_KEY, id);
  } catch {
    // Not remembered; the packer picks again next time.
  }
}
