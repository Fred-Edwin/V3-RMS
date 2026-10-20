import * as React from 'react';

/**
 * The payslip unlock, held in memory only: never in storage, never in the page, gone when the tab closes (PD2). One unlock belongs to
 * one signed-in person on this phone. `live` is false once the server's idle time has passed without a read, so the screen can go back
 * to the code before the server has to refuse. A read that the server refuses with UNLOCK_REQUIRED clears it as well.
 */
interface Session {
  userId: string;
  token: string;
  expiresAt: number;
  idleMs: number;
  touchedAt: number;
}

let session: Session | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function openSession(userId: string, token: string, expiresAtIso: string, idleSeconds: number, now: number = Date.now()): void {
  session = { userId, token, expiresAt: Date.parse(expiresAtIso), idleMs: idleSeconds * 1000, touchedAt: now };
  emit();
}

export function clearSession(): void {
  if (session === null) return;
  session = null;
  emit();
}

const live = (s: Session | null, userId: string | null, now: number): s is Session =>
  s !== null && userId !== null && s.userId === userId && now < s.expiresAt && now - s.touchedAt < s.idleMs;

/** The token to send, or null when there is no live unlock for this person. */
export function currentToken(userId: string | null, now: number = Date.now()): string | null {
  return live(session, userId, now) ? session.token : null;
}

/** A good read keeps the unlock open: the server counts it as a tap, so does this. */
export function touchSession(now: number = Date.now()): void {
  if (session) session.touchedAt = now;
}

export function isUnlocked(userId: string | null, now: number = Date.now()): boolean {
  return live(session, userId, now);
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Re-renders when an unlock opens or closes. The idle time is checked on each render and each read. */
export function useUnlocked(userId: string | null): boolean {
  React.useSyncExternalStore(subscribe, () => version, () => 0);
  return isUnlocked(userId);
}
