import { num, text } from './notification-format';
import type { NotifyData, RenderedNotification } from '../notification-types';
import type { Wording } from './wording-built';

/** The lock screen can be seen by others, so every Conduct push is the same generic line (C27). The Inbox row inside the app says more. */
const PUSH = { title: 'Wendo', body: 'You have a message in your Inbox.' };

const row = (tone: RenderedNotification['tone'], href: string, title: string, body: string, push = true): RenderedNotification => ({
  tone,
  area: 'CONDUCT',
  href,
  title,
  body,
  push,
  pushText: PUSH,
});

const label = (d: NotifyData): string => {
  const number = text(d, 'number', '');
  return number ? `${text(d, 'level', 'Notice')} ${number}` : text(d, 'level', 'Notice');
};
const staff = (d: NotifyData): string => `/app/conduct/${text(d, 'noticeId', '')}`;
const desk = (d: NotifyData): string => `/app/workforce/conduct?id=${text(d, 'noticeId', '')}`;
const outcomePhrase = (d: NotifyData): string => ({ kept: 'kept as it was', withdrawn: 'withdrawn', reduced: 'reduced' })[text(d, 'outcome', '') as 'kept'] ?? 'decided';

/**
 * Conduct words (spec section 11). Roles, never names, and never the manager's own line, the facts or a reason: the reason a decision
 * gives is read inside the notice. HR rows name the level and number and the person's role. No row has a pay figure.
 */
export const CONDUCT_WORDING: Record<string, Wording> = {
  'conduct.issued': (d) => row('needsLook', staff(d), `${text(d, 'level', 'Notice')} from your ${text(d, 'issuerRole', 'manager')}`, `${text(d, 'number', '') ? `${text(d, 'number', '')}. ` : ''}Please read it and sign that you received it.`),
  'conduct.verbal_recorded': (d) => row('information', staff(d), 'Verbal note on your file', `A verbal note was recorded on your file by your ${text(d, 'issuerRole', 'manager')}. You can read it and appeal.`),
  'conduct.issued_oversight': (d) => row('information', desk(d), `${text(d, 'level', 'Notice')} issued`, `${label(d)} was issued to a ${text(d, 'personRole', 'staff member')} at ${text(d, 'site', 'a branch')} by a ${text(d, 'issuerRole', 'manager')}.`, false),
  'conduct.signed': (d) => row('done', desk(d), `${label(d)} signed`, `A ${text(d, 'personRole', 'staff member')} at ${text(d, 'site', 'a branch')} signed that they received ${label(d)}.`, false),
  'conduct.not_signed': (d) => row('information', staff(d), 'A record was made about your notice', `Your ${text(d, 'issuerRole', 'manager')} recorded that ${label(d)} was given and not signed. The notice stays in force. You can still sign it and you can appeal.`),
  'conduct.witness_asked': (d) => row('needsLook', `/app/conduct/witness/${text(d, 'noticeId', '')}`, 'Confirm what you saw', `A ${text(d, 'issuerRole', 'manager')} asked you to confirm a record about a ${text(d, 'personRole', 'staff member')}. Confirm only if it is true.`),
  'conduct.not_signed_oversight': (d) => row('information', desk(d), `${label(d)} recorded as not signed`, `${label(d)} for a ${text(d, 'personRole', 'staff member')} at ${text(d, 'site', 'a branch')} was recorded as given and not signed, with a witness.`, false),
  'conduct.witness_unconfirmed': (d) => row('needsLook', desk(d), 'Witness not confirmed', `The witness on ${label(d)} has not confirmed. The notice stays valid.`, false),
  'conduct.appeal_sent': (d) => row('needsLook', desk(d), 'An appeal is waiting', `A ${text(d, 'personRole', 'staff member')} at ${text(d, 'site', 'a branch')} appealed ${label(d)}. A decision is due within 7 days.`, false),
  'conduct.appeal_sent_issuer': (d) => row('information', desk(d), 'Your notice was appealed', `${label(d)} was appealed. HR decides, not you.`, false),
  'conduct.appeal_decided': (d) => row('changed', staff(d), `Appeal decided: ${outcomePhrase(d)}`, `${label(d)} was ${outcomePhrase(d)} by HR. Open it to read the reason.`),
  'conduct.appeal_decided_issuer': (d) => row('changed', desk(d), `Appeal decided: ${outcomePhrase(d)}`, `${label(d)} was ${outcomePhrase(d)} on appeal. Open it to read the reason.`),
  'conduct.changed': (d) => row('changed', staff(d), `Your notice was ${outcomePhrase(d)}`, `${label(d)} was ${outcomePhrase(d)} by HR. Open it to read the reason.`),
  'conduct.changed_issuer': (d) => row('changed', desk(d), `A notice you issued was ${outcomePhrase(d)}`, `${label(d)} was ${outcomePhrase(d)} by HR. Open it to read the reason.`, false),
  'conduct.appeal_overdue': (d) => row('needsLook', desk(d), 'An appeal is overdue', `The appeal on ${label(d)} at ${text(d, 'site', 'a branch')} has waited ${num(d, 'days') ?? 1} ${num(d, 'days') === 1 ? 'day' : 'days'} past the 7 days HR has to decide.`),
  'conduct.appeal_overdue_hr': (d) => row('needsLook', desk(d), 'Decide this appeal now', `The appeal on ${label(d)} is ${num(d, 'days') ?? 1} ${num(d, 'days') === 1 ? 'day' : 'days'} overdue. The Director has been told.`),
};
