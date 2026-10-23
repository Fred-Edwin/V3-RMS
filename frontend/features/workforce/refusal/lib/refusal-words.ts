import type { PageFor } from '../types/refusal-types';

/** The words of the one refusal screen. Pure, so they are tested; the server supplies who the page is for and the reference. */

export const REFUSAL_TITLE = 'Not available for your role';

/** "PAYROLL · NOT AVAILABLE" */
export const refusalCaption = (page: string): string => `${page.toUpperCase()} · NOT AVAILABLE`;

/** "Payroll is for HR, the Director and the Accountant. Your own pay is under My payslips." */
export function refusalBody(info: Pick<PageFor, 'page' | 'forWords' | 'instead'> | null, page: string): string {
  const name = info?.page ?? page;
  const first = info?.forWords ? `${name} is for ${info.forWords}.` : `${name} is not available for your role.`;
  return info?.instead ? `${first} ${info.instead.line}` : first;
}

/** "Wrong page? Ask your manager or HR (reference WF-R7K2). Nothing was changed." The reference is the server's; none is shown without one. */
export const refusalFooter = (reference: string | null, role: string | null = null): string => {
  // HR is not told to ask HR; the System Admin sets who may open what.
  const whoToAsk = role === 'HR_MANAGER' ? 'the System Admin' : role === 'SYSTEM_ADMIN' ? 'the Director' : 'your manager or HR';
  return `Wrong page? Ask ${whoToAsk}${reference ? ` (reference ${reference})` : ''}. Nothing was changed.`;
};

/** The blocked path the middleware passes in `from`: only a path inside the app is believed. */
export function safeFrom(raw: string | null): string | null {
  return raw && /^\/app\/[A-Za-z0-9/_-]*$/.test(raw) && raw.length <= 200 ? raw : null;
}

/** A page name from a path when the server cannot answer: "/app/workforce/leave-calendar" becomes "Leave calendar". */
export function pageNameFromPath(path: string | null): string {
  const last = (path ?? '').split('/').filter(Boolean).pop() ?? '';
  const words = last.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'This page';
}
