import { clockLabel, dayLabel, monthName, num, plural, text } from './notification-format';
import type { NotifyData, RenderedNotification } from '../notification-types';

export type Wording = (data: NotifyData) => RenderedNotification;

/** The person a notice is about: the name the caller put in the data, else "A person" (older notices carry none). */
const who = (d: NotifyData): string => text(d, 'name', 'A person');

const row = (tone: RenderedNotification['tone'], area: RenderedNotification['area'], href: string | null, title: string, body: string, push = true): RenderedNotification => ({
  tone,
  area,
  href,
  title,
  body,
  push,
});

/**
 * The words for every "told" the built segments already send (kinds are the dotted names the callers use). Roles, not names,
 * unless the caller put a name in the data. No row has a pay figure: a month, a count of people, a document state only.
 */
export const BUILT_WORDING: Record<string, Wording> = {
  'attendance.clocked_for': (d) => row('changed', 'TIME', '/app/workforce/my-time', 'Your clock was recorded for you', `Your clock-${d.type === 'OUT' ? 'out' : 'in'} was recorded at ${clockLabel(text(d, 'at', ''))} by someone on your site. Dispute it in My time.`),
  'attendance.fixed': (d) => row('changed', 'TIME', '/app/workforce/my-time', 'A clock time was corrected', `${dayLabel(text(d, 'date', ''))}: your clock record was ${text(d, 'action', 'changed').toLowerCase()}. Open My time to see it.`),
  'attendance.auto_closed': (d) => row('needsLook', 'TIME', '/app/workforce/today', 'A shift was closed by the system', `The ${dayLabel(text(d, 'date', ''))} shift${d.shift ? ` (${text(d, 'shift', '')})` : ''} was closed because nobody answered. Please check it.`),
  'casual.sent': (d) => row('needsLook', 'PAY', '/app/workforce/casuals/approve', 'Casual pay is waiting', `Casuals for ${dayLabel(text(d, 'date', ''))} are waiting for you.`, false),
  'casual.approved': (d) => row('done', 'PAY', '/app/workforce/casuals', 'Casual pay approved', `Your casuals for ${dayLabel(text(d, 'date', ''))} are approved. The cash holder pays each worker, then each signs on your phone.`),
  'casual.to_pay': (d) => row('needsLook', 'PAY', '/app/workforce/casuals', 'Casuals to pay', `Casuals for ${dayLabel(text(d, 'date', ''))} are approved. Pay each worker from the petty cash you hold.`),
  'casual.sent_back': (d) => row('changed', 'PAY', '/app/workforce/casuals', 'Casual pay sent back', `Your casuals for ${dayLabel(text(d, 'date', ''))} were sent back. Open the sheet to see why, change it and send it again.`),
  'casual.voided': (d) => row('changed', 'PAY', '/app/workforce/casuals', 'Casual pay voided', `The casual pay sheet for ${dayLabel(text(d, 'date', ''))} was voided.`),
  'overtime.decided': (d) => {
    const outcome = text(d, 'outcome', '');
    const minutes = num(d, 'authorisedMinutes');
    const lead = outcome === 'DECLINED' ? 'Overtime not approved' : outcome === 'APPROVED_PART' ? 'Overtime partly approved' : 'Overtime approved';
    return row(outcome === 'DECLINED' ? 'changed' : 'done', 'TIME', '/app/workforce/my-time', lead, `${dayLabel(text(d, 'date', text(d, 'shiftDate', '')))}: ${lead.toLowerCase()}${minutes ? `, ${Math.floor(minutes / 60)} h ${minutes % 60} min` : ''}.`);
  },
  'timesheet.day_decided': (d) => row('changed', 'TIME', '/app/workforce/my-time', 'A timesheet day was decided', `${dayLabel(text(d, 'date', ''))}: ${text(d, 'outcome', 'decided').toLowerCase()}.`),
  'timesheet.month_approved': (d) => row('done', 'TIME', '/app/workforce/timesheets', 'Timesheets approved', `${monthName(text(d, 'month', ''))} timesheets${d.site ? ` for ${text(d, 'site', '')}` : ''} were approved.`),
  'time_request.created': (d) => row('needsLook', 'TIME', '/app/workforce/requests', 'A time request is waiting', `A ${text(d, 'kind', 'time').replace(/_/g, ' ').toLowerCase()} request for ${dayLabel(text(d, 'date', ''))} needs your answer.`, false),
  'time_request.decided': (d) => row(text(d, 'outcome', '') === 'DECLINED' ? 'changed' : 'done', 'TIME', '/app/workforce/my-time/requests', 'Your request was answered', `Your ${text(d, 'kind', 'time').replace(/_/g, ' ').toLowerCase()} request was ${text(d, 'outcome', 'answered').toLowerCase()}.`),
  'time_request.escalated': (d) => row('needsLook', 'TIME', '/app/workforce/requests', 'A request moved up', `A ${text(d, 'kind', 'time').replace(/_/g, ' ').toLowerCase()} request moved to HR. No answer in 3 days.`),
  'rota.shifts_changed': (d) => {
    const days = num(d, 'days') ?? 1;
    return row('changed', 'TIME', '/app/workforce/my-time/rota', 'Your rota changed', `${plural(days, 'day', 'days')} changed, ${dayLabel(text(d, 'firstDate', ''))}${days > 1 ? ` to ${dayLabel(text(d, 'lastDate', ''))}` : ''}. Open your rota to see it.`);
  },
  'payroll.ready_to_approve': (d) => row('needsLook', 'PAY', '/app/workforce/payroll', `${monthName(text(d, 'month', ''))} payroll is ready`, `The ${monthName(text(d, 'month', ''))} payroll is ready for your approval.`, false),
  'payroll.sent_back': (d) => row('changed', 'PAY', '/app/workforce/payroll', 'Payroll sent back', `The ${monthName(text(d, 'month', ''))} payroll was sent back. Open it to see why.`),
  'payroll.approved': (d) => row('needsLook', 'PAY', '/app/workforce/payroll', 'Payroll approved', `The ${monthName(text(d, 'month', ''))} payroll was approved. It is ready for you to publish.`),
  'payroll.month_calculated': (d) => row('information', 'PAY', '/app/workforce/payroll', 'Payroll calculated', `The ${monthName(text(d, 'month', ''))} payroll was calculated. It is ready for review.`),
  'payroll.payslip_corrected': (d) => row('changed', 'PAY', '/app/workforce/my-payslips', 'Your payslip was corrected', `A mistake was found and fixed. Your ${monthName(text(d, 'month', ''))} payslip is now version ${num(d, 'version') ?? 2}. Open it to see what changed.`),
  'payroll.bank_file_voided': (d) => row('changed', 'PAY', '/app/workforce/payroll', 'Bank file voided', `A correction was made, so the ${monthName(text(d, 'month', ''))} bank file you downloaded is void. Download the new file.`),
  'payroll.timesheets_waiting': (d) => row('needsLook', 'PAY', '/app/workforce/timesheets', 'Timesheets are waiting', `${monthName(text(d, 'month', ''))} timesheets for ${text(d, 'site', 'your site')} are waiting for you.`),
  'payroll.timesheets_approved_for_you': (d) => row('information', 'PAY', '/app/workforce/timesheets', 'Timesheets approved for your site', `${monthName(text(d, 'month', ''))} timesheets for ${text(d, 'site', 'your site')} were approved for you.`),
  'payroll.payslip_published': (d) => row('done', 'PAY', '/app/workforce/my-payslips', 'Your payslip is ready', `Your ${monthName(text(d, 'month', ''))} payslip is ready. You need your own code to open it.`),
  'payroll.published': (d) => row('done', 'PAY', '/app/workforce/payroll', 'Payroll published', `The ${monthName(text(d, 'month', ''))} payroll was published.`),
  'payroll.month_paid': (d) => row('done', 'PAY', '/app/workforce/payroll', 'Payroll paid', `The ${monthName(text(d, 'month', ''))} payroll was marked as paid.`),
  'p9.no_kra_pin': (d) => row('needsLook', 'PEOPLE', '/app/workforce/employees', 'A tax number is missing', `${who(d)} has no KRA number on file, so a P9 cannot be built. Add it to the file.`, false),
  // The department head gets this one, and a head opens My team, not Employees.
  'employee.hired': (d) => row('information', 'PEOPLE', '/app/workforce/team', `${who(d)} joined your department`, `${who(d)} was added to your department.`),
  'employee.transferred': (d) => row('information', 'PEOPLE', '/app/workforce/employees', `${who(d)} was transferred`, `${who(d)} moved between sites.`),
  'employee.transfer_scheduled': (d) => row('information', 'PEOPLE', '/app/workforce/employees', `A transfer is scheduled for ${who(d)}`, `A transfer between sites was scheduled for ${who(d)}.`),
  'employee.loaned': (d) => row('information', 'PEOPLE', '/app/workforce/employees', `${who(d)} was loaned`, `${who(d)} was loaned to another site.`),
  'employee.exit_recorded': (d) => row('information', 'PEOPLE', '/app/workforce/employees', `${who(d)}'s exit was recorded`, `${who(d)}'s exit was recorded.`),
  'employee.exit_undone': (d) => row('information', 'PEOPLE', '/app/workforce/employees', `${who(d)}'s exit was undone`, `${who(d)}'s recorded exit was undone.`),
  'probation.extended': (d) => row('changed', 'PEOPLE', '/app/workforce/my-file', 'Your probation was extended', `Your probation was extended by ${plural(num(d, 'months') ?? 1, 'month', 'months')}.`),
  'file_request.asked': () => row('needsLook', 'PEOPLE', '/app/workforce/my-file', 'HR asks for a detail', 'HR asks you to add a detail to your file.'),
  'file_request.reminded': () => row('needsLook', 'PEOPLE', '/app/workforce/my-file', 'A reminder from HR', 'HR reminds you to add a detail to your file.'),
  // No pay notice carries an amount: the person and the action only.
  'pay.bank_changed': (d) => row('information', 'PAY', '/app/workforce/employees', `Bank details changed for ${who(d)}`, `${who(d)}'s bank details were changed. The next bank file uses them.`, false),
  'pay.change_requested': (d) => row('needsLook', 'PAY', '/app/workforce/employees', `A pay change for ${who(d)} waits`, `A pay change for ${who(d)} waits for your decision.`),
  'pay.changed_by_director': (d) => row('information', 'PAY', '/app/workforce/employees', `The Director changed ${who(d)}'s pay`, `The Director changed ${who(d)}'s pay. It applies on the date set.`, false),
  'pay.change_decided': (d) => row('changed', 'PAY', '/app/workforce/employees', `The pay change for ${who(d)} was ${text(d, 'decision', 'decided').toLowerCase()}`, `Your pay change request for ${who(d)} was ${text(d, 'decision', 'decided').toLowerCase()}.`),
  'department.head_changed': () => row('changed', 'PEOPLE', '/app/workforce/organisation', 'A department head changed', 'The head of a department changed.'),
};
