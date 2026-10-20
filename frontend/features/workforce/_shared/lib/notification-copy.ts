/**
 * The notification wording table, from Paper "Shared · Notifications" (page
 * "Workforce · B. Schedule and time", node 19TC-0). One row per event: who is
 * told, the kind (which sets the coloured bar), and the exact wording. The names
 * and numbers in `wording` are the sample from the table; a real notification
 * fills them from data, but keeps the sentence shape.
 *
 * A notification only informs (rule 07). Anything that needs a decision goes to
 * Waiting for you, and its row here says so in `whoIsTold`.
 *
 * Where a row has one wording per audience (staff, manager), they are separated
 * by "Staff:", "Manager:" and so on, exactly as the table writes them.
 */
export type NotificationKind = 'information' | 'changed' | 'needsLook' | 'done' | 'problem';

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  information: 'Information',
  changed: 'Changed',
  needsLook: 'Needs a look',
  done: 'Done',
  problem: 'Problem',
};

/** The legend on the Paper template: four colours for five kinds (Changed and Needs a look share one). */
export type NotificationTone = 'info' | 'amber' | 'success' | 'error';

export const NOTIFICATION_KIND_TONE: Record<NotificationKind, NotificationTone> = {
  information: 'info',
  changed: 'amber',
  needsLook: 'amber',
  done: 'success',
  problem: 'error',
};

export interface NotificationRow {
  key: string;
  event: string;
  whoIsTold: string;
  kind: NotificationKind;
  wording: string;
}

export const NOTIFICATION_ROWS: NotificationRow[] = [
  { key: 'rotaPublished', event: 'Branch Manager publishes a rota', whoIsTold: 'Every person on it', kind: 'information', wording: 'Your rota for 12 to 18 October is ready. 5 shifts, 40 h.' },
  { key: 'headPublishesRota', event: 'Department head publishes', whoIsTold: 'Their team, and the Branch Manager', kind: 'information', wording: 'Staff: Your rota ... is ready. Manager: Lucia Wanjiru published the Pastry rota for 12 to 18 October. 3 people, 1 thin day.' },
  { key: 'shiftChanged', event: 'Shift changed after publishing', whoIsTold: 'The person affected; their head', kind: 'changed', wording: 'Sat 17 changed: day off is now Morning. Changed by Faith Njeri. Reason: cover for a gap.' },
  { key: 'shiftRemoved', event: 'Shift removed', whoIsTold: 'The person affected', kind: 'changed', wording: 'Sat 17: your Afternoon shift was removed. You are off that day.' },
  { key: 'shiftWithin24h', event: 'Shift within 24 hours changes', whoIsTold: 'The person (as a push, loud); the Today board', kind: 'changed', wording: 'Tomorrow changed: Morning 06:00 is now Afternoon 14:00.' },
  { key: 'shiftAutoClosed', event: 'Shift ends unanswered (auto-closed)', whoIsTold: 'The person; the Branch Manager', kind: 'needsLook', wording: 'Your Monday shift was closed at 14:00. Amina Hassan did not answer: please check.' },
  { key: 'clockedOutByMistake', event: 'Clocked-out-by-mistake request', whoIsTold: 'Branch Manager and System Admin; answer to the person', kind: 'needsLook', wording: 'Amina Hassan asks to fix a 11:20 clock-out. (Answer: Your clock-out was corrected to 14:00.)' },
  { key: 'overtimeAnswered', event: 'Overtime approved or declined', whoIsTold: 'The person', kind: 'done', wording: '1 h 30 min overtime approved. It will be on your October payslip. (Declined: ... was not approved. Ask Faith Njeri why.)' },
  { key: 'managerClocksIn', event: 'Manager clocks someone in', whoIsTold: 'The person', kind: 'changed', wording: 'Faith Njeri recorded your clock-in at 06:25. Reason: phone had no signal. Dispute it in My time.' },
  { key: 'clockEventEdited', event: 'Clock event edited', whoIsTold: 'The person', kind: 'changed', wording: 'Thu 8 Oct: your clock-out changed from 22:00 to 22:40 by Faith Njeri. Reason: I saw him working.' },
  { key: 'payRunForApproval', event: 'Pay run sent for approval', whoIsTold: 'The Accountant (in Waiting for you)', kind: 'needsLook', wording: 'October pay run is ready for your approval. Prepared by Mercy Achieng. 85 people, net KES 3,168,500.' },
  { key: 'payRunApproved', event: 'Pay run approved', whoIsTold: 'The person who prepared it (HR)', kind: 'needsLook', wording: 'October pay run approved by Anne Muthoni. It is ready for you to publish.' },
  { key: 'payRunPublished', event: 'Pay run published', whoIsTold: 'Every person paid; the Accountant', kind: 'done', wording: 'Staff: Your October payslip is ready. Paid on Friday 23 October. You need your own code to open it. Accountant: October pay run published by Mercy Achieng.' },
  { key: 'payRunReopened', event: 'Pay run reopened', whoIsTold: 'Every person paid; HR; the Accountant', kind: 'changed', wording: 'Staff: Your October payslip is being corrected. You will be told when it is ready again. HR and Accountant: The Director reopened the October run. Reason: a mistake in a payslip.' },
  { key: 'casualPayForApproval', event: 'Casual pay sent for approval', whoIsTold: 'The Branch Manager (on the Casual pay page)', kind: 'needsLook', wording: 'Service casuals for Mon 19 Oct are waiting.' },
  { key: 'casualPayApproved', event: 'Casual pay approved', whoIsTold: 'The department head', kind: 'done', wording: 'Your Service casuals for Mon 19 Oct are approved. Pay sheet CPS-0318. The cash holder pays each worker, then each signs on your phone.' },
  { key: 'casualPaySentBack', event: 'Casual pay sent back', whoIsTold: 'The department head', kind: 'changed', wording: 'Your Service casuals for Mon 19 Oct were sent back. Open the sheet to see why, then change it and send it again.' },
  { key: 'casualPayToPay', event: 'Casual pay approved, cash to pay', whoIsTold: 'The cash holder named in Rules (when not the approver)', kind: 'needsLook', wording: 'Service casuals for Mon 19 Oct are approved. Pay each worker from the petty cash you hold.' },
  { key: 'warningIssued', event: 'Warning issued', whoIsTold: 'The person (to read and sign); HR', kind: 'needsLook', wording: 'Person: Written warning from Faith Njeri. Late arrival for work, WRN-0007. Please read it and sign that you received it. HR: Faith Njeri issued a written warning to Mark Njoroge.' },
  { key: 'warningSigned', event: 'Warning signed by the person', whoIsTold: 'The issuer; HR', kind: 'done', wording: 'Mark Njoroge signed WRN-0007 on his phone, 9 Oct, 17:02. He can appeal until Fri 16 Oct.' },
  { key: 'warningNotSigned', event: 'Warning given, not signed', whoIsTold: 'The person; the witness; HR', kind: 'changed', wording: 'Faith Njeri recorded that Mark Njoroge did not sign WRN-0007. Witness: Victor Maina. The warning stands and he can appeal until Fri 16 Oct.' },
  { key: 'appealSent', event: 'Appeal sent', whoIsTold: 'HR (in Waiting for you); the issuer', kind: 'needsLook', wording: 'HR: Mark Njoroge appeals WRN-0007: a good reason for being late. Issuer: Mark Njoroge appealed WRN-0007. HR will decide.' },
  { key: 'appealDecided', event: 'Appeal decided', whoIsTold: 'The person; the issuer', kind: 'changed', wording: 'WRN-0007 changed from a written warning to a verbal note by Mercy Achieng. Reason: the bus breakdown on 9 and 23 September is accepted.' },
  { key: 'noticeEnded', event: 'Notice ended by itself', whoIsTold: 'The person; the issuer; HR', kind: 'information', wording: "Mark Njoroge's verbal note ended on 12 Jan 2027. It stays on the file as ended." },
  { key: 'leaveAsked', event: 'Leave asked', whoIsTold: "Nobody told; it appears in Waiting for you for the Branch Manager (HR for a manager's own)", kind: 'needsLook', wording: 'In Waiting for you: Annual leave, Cynthia Wairimu, 26 to 28 Oct, 3 days. Barista would have 4 of 6 working.' },
  { key: 'leaveApproved', event: 'Leave approved', whoIsTold: 'The person; their department head', kind: 'done', wording: 'Leave approved: 26 to 28 October. Approved by Faith Njeri. Back at work Thu 29 October. 9 days left. (Head: Cynthia Wairimu is on leave 26 to 28 Oct.)' },
  { key: 'leaveDeclined', event: 'Leave declined', whoIsTold: 'The person; their department head', kind: 'changed', wording: 'Leave not approved: 26 to 28 October. Declined by Faith Njeri. Reason: too few people that week. Your balance is still 12 days.' },
  { key: 'leaveCancelled', event: 'Leave cancelled by the person', whoIsTold: 'Whoever it was waiting on; the head if approved', kind: 'changed', wording: 'Cynthia Wairimu cancelled her leave request for 26 to 28 Oct. (If it was approved: the days are back in her balance and the rota is open again.)' },
  { key: 'leaveUnanswered', event: 'Leave not answered in 3 days', whoIsTold: 'The person; HR', kind: 'needsLook', wording: "Person: Your leave request moved to HR. No answer in 3 days. HR: Lucy Wambui's request for 2 to 4 Nov has waited 3 days for Faith Njeri." },
  { key: 'leaveBalanceAdjusted', event: 'Leave balance adjusted by HR', whoIsTold: 'The person', kind: 'changed', wording: 'Annual leave balance changed from 5 to 7 days by Mercy Achieng. Reason: granted by the Director.' },
  { key: 'payslipOnUnconfirmedPhone', event: 'Payslip opened on a phone you have not confirmed', whoIsTold: 'The person (a loud push)', kind: 'problem', wording: "Your September payslip was opened on a phone you have not confirmed. Tecno phone, Nairobi, 14:05. If it was you, tap Yes, this is my phone. If not, press This wasn't me." },
  { key: 'thisWasntMe', event: '"This wasn\'t me" pressed', whoIsTold: 'The System Admin', kind: 'problem', wording: "Joy Chebet, Waiter pressed This wasn't me for a payslip opening at 14:09. Every session was signed out. The audit row is open beside this." },
  { key: 'payslipCorrected', event: 'A payslip was corrected', whoIsTold: 'The person', kind: 'changed', wording: 'A mistake was found and fixed. Your payslip is now version 2. Open it to see what changed.' },
  { key: 'payslipOpenedByStaff', event: 'HR or the Accountant opened payslips', whoIsTold: 'The Director (one row a day)', kind: 'information', wording: 'HR opened 12 payslips today.' },
  { key: 'threeWrongCodes', event: 'Three wrong payslip codes', whoIsTold: 'The person; the System Admin', kind: 'problem', wording: "3 wrong codes on your payslips. Tecno phone, 08:06. Nothing is locked. If it was not you, open Activity on my record and press This wasn't me." },
  { key: 'ruleChanged', event: 'Rule changed', whoIsTold: 'Branch Managers; HR; the Accountant', kind: 'changed', wording: 'Lateness grace changes from 5 min to 10 min from Mon 2 Nov. Changed by the Director. Reason: morning traffic.' },
  { key: 'statutoryRateChanged', event: 'Statutory rate changed', whoIsTold: 'The Director; HR', kind: 'changed', wording: 'NSSF changes from 5% to 6% from 1 Feb 2026. Confirmed by Anne Muthoni. Pay runs use it from that date.' },
  { key: 'overdueReminder', event: 'Reminder on an overdue request', whoIsTold: 'The person it waits on', kind: 'needsLook', wording: "Mark Njoroge's clock fix for Tue 6 Oct has waited 13 days for you. Reminder sent by the Director." },
  { key: 'requestMovedUp', event: 'Request moved up after 3 days', whoIsTold: 'The person who asked; the next approver', kind: 'needsLook', wording: "Person: Your overtime request moved to Faith Njeri. No answer in 3 days. Approver: Cynthia Wairimu's 35 min overtime has waited 3 days for Victor Maina." },
  { key: 'clockInNotSent', event: 'Clock-in still not sent at shift end', whoIsTold: 'The department head; the Branch Manager', kind: 'needsLook', wording: "Amina Hassan's clock-in at 06:02 was not sent and the shift has ended. Please check." },
  { key: 'printedCopyMismatch', event: 'Printed copy does not match', whoIsTold: 'The person who issued it; the Director', kind: 'problem', wording: 'Voucher CPV-0318 was checked on a phone and the printed total does not match the record. Do not pay from that copy.' },
  { key: 'newPhoneSignedIn', event: 'New phone signed in', whoIsTold: 'The person', kind: 'information', wording: 'Your account was signed in on a new phone: Tecno, Nairobi, 14:05. If it was not you, press This wasn\'t me.' },
  { key: 'tablesConfirmed', event: 'Accountant confirms the tables', whoIsTold: 'HR; the Director', kind: 'information', wording: 'Anne Muthoni confirmed the PAYE, NSSF, SHA and housing levy tables (version 4) on 19 Oct at 09:15. The October run can now be prepared.' },
  { key: 'payslipOnUnconfirmedPhoneAdmin', event: 'Payslip opened on an unconfirmed phone', whoIsTold: 'The person (a loud push); the System Admin', kind: 'problem', wording: "Joy Chebet, Waiter's September payslip was opened on a phone that is not confirmed: Tecno, Nairobi, 14:05. Nothing is locked. The audit row is open beside this." },
];

/** The table's last row: where and when notifications arrive. It is a rule, not an event. */
export const NOTIFICATION_DELIVERY = {
  where: 'Phone push (when allowed), then Inbox',
  wording:
    'Quiet hours 22:00 to 05:00: only changes within 24 hours push; the rest wait in the Inbox. Desktop shows a bell with a count in the top bar.',
} as const;

/** The five parts of the template, in order, for documentation and the gallery. */
export const NOTIFICATION_PARTS = [
  { n: 1, name: 'Area and kind', rule: 'Small mono label, for example ROTA CHANGE. The coloured bar on the left shows the kind.' },
  { n: 2, name: 'When', rule: 'now, 3 min, 1 h, Yesterday. Exact time on hover and in the audit log.' },
  { n: 3, name: 'Title: what changed', rule: 'One line, old to new where something changed. No jargon, no "Dear".' },
  { n: 4, name: 'Who and why', rule: 'The person who did it, and the reason if they gave one.' },
  { n: 5, name: 'One action, optional', rule: 'Opens the exact screen. A notification never asks for a decision; that goes to Waiting for you.' },
] as const;

export function notificationRow(key: string): NotificationRow | undefined {
  return NOTIFICATION_ROWS.find((r) => r.key === key);
}
