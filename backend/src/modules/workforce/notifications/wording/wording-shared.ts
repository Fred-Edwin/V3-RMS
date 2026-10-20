import { clockLabel, monthName, num, plural, roleLabel, text } from './notification-format';
import type { NotifyData, RenderedNotification } from '../notification-types';
import type { Wording } from './wording-built';

const who = (d: NotifyData): string => (d.name ? `${text(d, 'name', '')}, ${roleLabel(text(d, 'role', ''))}` : roleLabel(text(d, 'role', '')));
const where = (d: NotifyData): string => `${text(d, 'device', 'A phone')}, ${text(d, 'place', 'an unknown place')}, ${clockLabel(text(d, 'at', ''))}`;

const problem = (href: string, title: string, body: string): RenderedNotification => ({ tone: 'problem', area: 'SECURITY', href, title, body, push: true });

/**
 * The Shared parts words (6a P1 and 6b N6): security, phones, openings, the chain check and reminders. The person and the System
 * Admin get different sentences for the same event, so each has its own kind. Never an amount, a code or a payslip number.
 */
export const SHARED_WORDING: Record<string, Wording> = {
  'payslip.on_unconfirmed_phone': (d) =>
    problem('/app/workforce/my-record', `Your ${monthName(text(d, 'month', ''))} payslip was opened on a phone you have not confirmed`, `${where(d)}. If it was you, tap Yes, this is my phone. If not, press This wasn't me.`),
  'payslip.on_unconfirmed_phone_admin': (d) =>
    problem('/app/workforce/security', 'A payslip was opened on an unconfirmed phone', `${who(d)}'s ${monthName(text(d, 'month', ''))} payslip was opened on a phone that is not confirmed: ${where(d)}. Nothing is locked. The audit row is open beside this.`),
  'payslip.three_wrong_codes': (d) =>
    problem('/app/workforce/my-record', '3 wrong codes on your payslips', `${text(d, 'device', 'A phone')}, ${clockLabel(text(d, 'at', ''))}. Nothing is locked. If it was not you, open Activity on my record and press This wasn't me.`),
  'payslip.three_wrong_codes_admin': (d) =>
    problem('/app/workforce/security', '3 wrong payslip codes', `3 wrong codes on ${who(d)}'s payslips. ${text(d, 'device', 'A phone')}, ${clockLabel(text(d, 'at', ''))}. Nothing is locked.`),
  'security.wasnt_me_admin': (d) =>
    problem('/app/workforce/security', "This wasn't me", `${who(d)} pressed This wasn't me for a payslip opening at ${clockLabel(text(d, 'at', ''))}. Every session was signed out. The audit row is open beside this.`),
  'security.new_phone': (d) => ({
    tone: 'information',
    area: 'SECURITY',
    href: '/app/workforce/my-record',
    title: 'Your account was signed in on a new phone',
    body: `${where(d)}. If it was not you, press This wasn't me.`,
    push: true,
  }),
  'payslip.opened_by_staff': (d) => ({
    tone: 'information',
    area: 'DOCUMENTS',
    href: '/app/workforce/audit-log',
    title: 'Payslips were opened',
    body: `${roleLabel(text(d, 'openerRole', ''))} opened ${plural(num(d, 'count') ?? 1, 'payslip', 'payslips')} today.`,
    push: false,
  }),
  'audit.chain_failed': (d) => problem('/app/workforce/security', 'The audit chain check failed', `The audit chain check found a problem at entry ${num(d, 'seq') ?? 'unknown'}. Nothing was changed.`),
  'document.mismatch': (d) =>
    problem('/app/workforce/audit-log?tab=documents', 'A printed copy does not match', `${text(d, 'label', 'A document')} ${text(d, 'number', '')} was checked on a phone and the printed copy does not match the record. Do not rely on that copy.`),
  'needs_you.overdue_reminder': (d) => ({
    tone: 'needsLook',
    area: 'TIME',
    href: text(d, 'href', '/app/workforce'),
    title: 'A reminder: someone is waiting for you',
    body: `${text(d, 'text', 'A request')} has waited ${plural(num(d, 'days') ?? 3, 'day', 'days')} for you. Reminder sent by the Director.`,
    push: true,
  }),
};

/** The spec's wording keys, so a caller may use either the dotted kind or the Paper table's name. */
export const KIND_ALIASES: Record<string, string> = {
  payRunForApproval: 'payroll.ready_to_approve',
  payRunApproved: 'payroll.approved',
  casualPayForApproval: 'casual.sent',
  requestMovedUp: 'time_request.escalated',
  overdueReminder: 'needs_you.overdue_reminder',
  payslipOpenedByStaff: 'payslip.opened_by_staff',
  payslipOnUnconfirmedPhone: 'payslip.on_unconfirmed_phone',
  payslipOnUnconfirmedPhoneAdmin: 'payslip.on_unconfirmed_phone_admin',
  thisWasntMe: 'security.wasnt_me_admin',
  threeWrongCodes: 'payslip.three_wrong_codes',
  newPhoneSignedIn: 'security.new_phone',
  auditChainFailed: 'audit.chain_failed',
  documentMismatch: 'document.mismatch',
};
