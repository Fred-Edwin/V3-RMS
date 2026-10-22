import { ApiError } from '@/types/api';

/**
 * The words and small rules of the sign-in screens (Paper 3.1 to 4.5). Pure: no screen, no request.
 */

export type SigninNoticeKind = 'wrong' | 'offline' | 'ended' | 'paused' | 'other';

export interface SigninNotice {
  kind: SigninNoticeKind;
  message: string;
  /** For `paused`: seconds the person must wait before the next try is answered. */
  waitSeconds?: number;
}

const WRONG = 'That email or password is not right. Check them and try again.';

/** What a failed sign-in says, in plain words and no codes. A pause is a wait, never a lock. */
export function noticeFor(error: unknown, online: boolean): SigninNotice {
  if (!online) return { kind: 'offline', message: 'You are offline. We will try again when the connection is back.' };
  if (error instanceof ApiError) {
    if (error.statusCode === 429 && error.code === 'LOGIN_SLOWED') {
      const details = error.details as { waitSeconds?: unknown } | undefined;
      const waitSeconds = typeof details?.waitSeconds === 'number' && details.waitSeconds > 0 ? Math.ceil(details.waitSeconds) : 2;
      return { kind: 'paused', message: pausedMessage(waitSeconds), waitSeconds };
    }
    if (error.statusCode === 401 && error.code === 'TEMPORARY_PASSWORD_EXPIRED') return { kind: 'other', message: error.message };
    if (error.statusCode === 401) return { kind: 'wrong', message: WRONG };
  }
  return { kind: 'other', message: 'Something went wrong. Try again.' };
}

export const pausedMessage = (seconds: number): string => (seconds > 0 ? `Too many tries. Wait ${seconds} ${seconds === 1 ? 'second' : 'seconds'}, then try again.` : 'You can try again now.');

/** The sign-in page was opened because the server ended the session (never for being away: nobody is signed out for that). */
export const ENDED_NOTICE: SigninNotice = { kind: 'ended', message: 'You were signed out. Sign in to carry on.' };

/** A PIN may not be 1234 or one digit four times. Returns the reason, or null when it is fine. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return 'Use four digits.';
  if (pin === '1234') return 'Not 1234. Choose another PIN.';
  if (/^(\d)\1{3}$/.test(pin)) return 'Not the same digit four times. Choose another PIN.';
  return null;
}

export type DeviceKind = 'computer' | 'phone';

/** "Chrome on Linux", "Safari on iPhone", "Android phone": the device as a person would say it. Never an id. */
export function deviceLabel(userAgent: string): { label: string; kind: DeviceKind } {
  const ua = userAgent;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return { label: 'Android phone', kind: 'phone' };
  if (/Android/i.test(ua)) return { label: 'Android tablet', kind: 'phone' };
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'This browser';
  if (/iPhone|iPad|iPod/.test(ua)) return { label: `${browser} on iPhone`, kind: 'phone' };
  const system = /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : null;
  return { label: system ? `${browser} on ${system}` : browser, kind: 'computer' };
}

/** Where this browser remembers that a person trusted it. Per person, so a shared computer asks each one. */
export const trustKey = (userId: string): string => `wendo.trusted-device.${userId}`;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export const WHATSAPP_URL = 'https://wa.me/254113176613';
export const SUPPORT_LINE = 'Need help? Call or WhatsApp Fred on +254 113 176 613 · Every day, 6 a.m. to 10 p.m.';
