import { dayLabel } from '../../notifications';
import { plural } from '../leave-words';
import { slipCode, type SlipSnapshot } from './slip-snapshot';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

/** 'Monday 26 October 2026' from a Nairobi date. */
export function longDate(date: string, withYear = true): string {
  const [weekday = 'Mon'] = dayLabel(date).split(' ');
  return `${WEEKDAYS[weekday] ?? weekday} ${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}${withYear ? ` ${date.slice(0, 4)}` : ''}`;
}

/** '9 Oct 2026, 16:05' from an ISO instant, in Nairobi time (fixed UTC+3). */
export function stampLine(iso: string): string {
  const at = new Date(new Date(iso).getTime() + 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]?.slice(0, 3)} ${at.getUTCFullYear()}, ${p(at.getUTCHours())}:${p(at.getUTCMinutes())}`;
}

export interface SlipLines {
  heading: string;
  paragraphs: string[];
  signedLine: string;
  roleLine: string;
  footerRight: string;
}

/** The fixed slip template filled from the snapshot (spec section 7). No titles: the person is addressed by name. */
export function slipLines(s: SlipSnapshot): SlipLines {
  const lower = s.type.label.toLowerCase();
  const onBalance = s.days - s.unpaidTailDays;
  const heading = `${s.type.label} approved: ${longDate(s.start, false)} to ${longDate(s.end)}`;
  const p1 = `Your request for ${lower}, received on ${longDate(s.askedAt.slice(0, 10))}, has been approved. You will be on leave for ${plural(s.days, 'day', 'days')}, from ${longDate(s.start)} to ${longDate(s.end)}, and you return to work on ${longDate(s.returnOn)}.`;
  const split = s.unpaidTailDays > 0 ? ` This is ${plural(onBalance, `${s.type.label.split(' ')[0]?.toLowerCase()} day`, `${s.type.label.split(' ')[0]?.toLowerCase()} days`)} and ${plural(s.unpaidTailDays, 'unpaid day', 'unpaid days')}.` : '';
  const balance = s.balanceBefore !== null && s.balanceAfter !== null ? `Your ${lower} balance was ${plural(s.balanceBefore, 'day', 'days')} and is now ${plural(s.balanceAfter, 'day', 'days')}.` : '';
  const pay = s.unpaidTailDays > 0 || !s.type.paid ? 'These days are not paid.' : 'Leave days are paid at your normal pay.';
  const head = s.head ? `Your department head, ${s.head.name}, ${s.head.roleLabel}, has been told, and your shifts will show leave on those days.` : 'Your department head has been told, and your shifts will show leave on those days.';
  const note = s.sickNoteNeeded ? ' A sick note is needed.' : '';
  const p2 = [balance, pay, head].filter(Boolean).join(' ') + split + note;
  const approverWord = s.approver.role === 'HR_MANAGER' ? 'HR' : s.approver.roleLabel;
  const p3 = `If your plans change, please tell your ${approverWord} before the leave begins, and the days will be returned to your balance.`;
  return {
    heading,
    paragraphs: [p1, p2, p3, 'Yours sincerely,'],
    signedLine: `Signed with PIN · ${stampLine(s.signature.signedAt)}`,
    roleLine: `${s.approver.name} · ${s.approver.roleLabel}`,
    footerRight: `Approved by ${s.approver.role === 'HR_MANAGER' ? 'HR' : `the ${s.approver.roleLabel}`}`,
  };
}

export const slipDocCode = slipCode;
