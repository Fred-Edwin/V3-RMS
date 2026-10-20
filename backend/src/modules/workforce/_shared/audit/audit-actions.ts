import type { AuditCategoryCode } from './audit.types';

/**
 * Every action code and the categories it may be filed under. The writer refuses a code that is not here, or a
 * category the code does not allow, so an entry cannot be filed where the wrong roles can read it. Each slice adds
 * its own codes in the same commit as the behaviour. Slice 0 registers these three.
 */
export const AUDIT_ACTIONS = {
  'rules.version_created': ['RULES_OPERATING', 'RULES_PAY'], // PAY when the change touches statutory, multipliers or holiday pay
  'rules.version_confirmed': ['RULES_PAY'],
  'rules.version_withdrawn': ['RULES_OPERATING', 'RULES_PAY'], // a scheduled version cancelled before its day (1B); the version row stays
  'audit.log_viewed': ['LOG_ACCESS'], // written by the slice-7 read side; declared now so the visibility rule is complete
  // slice 1 (People). Never an amount, ID number, bank number, password or PIN in an entry: field names and "changed" only.
  'people.hired': ['PEOPLE'],
  'people.adopted': ['PEOPLE'], // an existing account filed as an employee
  'people.updated': ['PEOPLE'], // changed fields only; ID fields by name, never value
  'people.self_updated': ['PEOPLE'], // the person edited their own details
  'people.login_created': ['PEOPLE'],
  'people.statutory_verified': ['PEOPLE'],
  'people.document_uploaded': ['PEOPLE'],
  'people.payprofile_updated': ['PAY_SETUP'],
  'people.pay_change_requested': ['PAY_SETUP'],
  'people.pay_change_decided': ['PAY_SETUP'],
  'people.pay_change_applied': ['PAY_SETUP'], // by the scheduler, channel SYSTEM
  'people.contract_created': ['PAY_SETUP'],
  'people.probation_decided': ['PEOPLE'],
  'people.probation_noted': ['PEOPLE'],
  'people.transferred': ['PEOPLE'],
  'people.transfer_applied': ['PEOPLE'], // by the scheduler, channel SYSTEM
  'people.loan_created': ['PEOPLE'],
  'people.loan_ended': ['PEOPLE'],
  'people.move_cancelled': ['PEOPLE'],
  'people.exit_recorded': ['PEOPLE'],
  'people.exit_finalized': ['PEOPLE'], // by the scheduler, channel SYSTEM
  'people.exit_undone': ['PEOPLE'],
  'people.rehired': ['PEOPLE'],
  'people.activated': ['PEOPLE'], // by the scheduler: onboarding became active on the start date, channel SYSTEM
  // slice 1b (Organisation). Names and counts only.
  'org.department_created': ['PEOPLE'],
  'org.department_updated': ['PEOPLE'],
  'org.department_retired': ['PEOPLE'],
  'org.department_restored': ['PEOPLE'],
  'org.head_changed': ['PEOPLE'], // assigned, replaced or acting
  'org.head_ended': ['PEOPLE'],
  'org.head_claims_reconciled': ['PEOPLE'], // by the scheduler, channel SYSTEM
  'org.position_created': ['PEOPLE'],
  'org.position_updated': ['PEOPLE'],
  'org.position_retired': ['PEOPLE'],
  'org.position_restored': ['PEOPLE'],
  // slice 2 (Rota). Names, shift names and dates only; never a pay figure. One entry per request, never one per cell.
  'rota.template_created': ['TIME'],
  'rota.template_updated': ['TIME'],
  'rota.template_retired': ['TIME'],
  'rota.template_restored': ['TIME'],
  'rota.cells_changed': ['TIME'], // set, clear and fill; the reason is required for today and tomorrow
  'rota.week_copied': ['TIME'], // "start from last week"
  'rota.legacy_carried': ['TIME'], // the carry-over from the legacy shifts, channel SYSTEM
  // slice 3 (Attendance). Times, shift names and reasons; never a pay figure.
  'attendance.clocked_in': ['TIME'],
  'attendance.clocked_out': ['TIME'], // also an early leave, with its reason chip
  'attendance.undone': ['TIME'], // the person undid their own tap inside the window
  'attendance.shift_end_answered': ['TIME'], // "Stay on" with its reason
  'attendance.auto_closed': ['TIME'], // no answer to the prompt, or a forgotten clock-out; channel SYSTEM
  'attendance.clocked_for': ['TIME'], // a head or manager clocked someone in or out, with a reason
  'attendance.time_fixed': ['TIME'], // a correction: before and after, and why
  'attendance.switch_changed': ['TIME'], // a site's new clock was turned on or off
  'attendance.legacy_carried': ['TIME'], // today's legacy clock records copied across at switch-on, or back at switch-off
  // slice 4a (Timesheets). Minutes, dates and reasons; never a pay figure.
  'timesheet.auto_approved': ['TIME'], // the system approved days and weeks that matched the rota; channel SYSTEM
  'timesheet.day_decided': ['TIME'], // accept, excuse lateness or hold, with a reason
  'timesheet.overtime_decided': ['TIME'], // authorises the time only; payroll decides pay
  'timesheet.period_closed': ['TIME'], // RETIRED (Segment 1A): the automatic or early close; old entries stay readable
  'timesheet.period_reopened': ['TIME'], // RETIRED (Segment 1A): HR reopen; old entries stay readable
  'timesheet.period_signed': ['TIME'], // RETIRED (Segment 1A): the report PIN signature; old entries stay readable
  'timesheet.month_approved': ['TIME'], // the site's manager approved the month with a PIN: hours, overtime, document number, never pay
  'timesheet.overtime_noted': ['TIME'], // a department head's one-line note on an overtime item (evidence, not a decision)
  'timesheet.exported': ['TIME'], // a month was exported as PDF or Excel: who, format, month, range, document number or draft
  'timesheet.request_created': ['TIME'], // Report a problem or clocked out by mistake
  'timesheet.request_decided': ['TIME'], // accepted (with the correction made) or declined with a reason
  'timesheet.request_withdrawn': ['TIME'],
  'timesheet.request_escalated': ['TIME'], // no answer for 3 days: moved to HR; channel SYSTEM
  // Segment 2A (Payroll, part 1). Counts, document numbers and reasons; never a PIN or a bank account number. Totals appear only as counts of people.
  'payroll.calculated': ['PAY_RUN_PREPARE'], // run n, headcount; by the system (SYSTEM) or HR
  'payroll.review_checked': ['PAY_RUN_PREPARE'], // a review line ticked or un-ticked (one entry per request, also for "tick all of a kind")
  'payroll.adjustment_added': ['PAY_RUN_PREPARE'], // kind, label, who; the amount is stored on the adjustment, not here
  'payroll.adjustment_removed': ['PAY_RUN_PREPARE'],
  'payroll.person_left_out': ['PAY_RUN_PREPARE'],
  'payroll.sent_to_accountant': ['PAY_RUN_PREPARE'],
  'payroll.sent_back': ['PAY_RUN_DECIDE'], // the Accountant's reason, no figures
  'payroll.approved': ['PAY_RUN_DECIDE'], // document number, hand-check flag
  'payroll.hand_check_confirmed': ['PAY_RUN_DECIDE'],
  'payroll.site_approved_late': ['PAY_RUN_DECIDE'], // the Director approved a site's timesheet month for it (P4)
  'payroll.reminder_sent': ['PAY_RUN_PREPARE'],
  // Segment 2B (Payroll part 2). Entries about money carry the figures (E9); a PIN and an account number never appear.
  'payroll.published': ['PAY_RUN_PREPARE'], // HR published the approved month: document number, payslips issued
  'payroll.payslip_corrected': ['PAY_RUN_PREPARE', 'PAY_RUN_DECIDE'], // HR or the Accountant: kind, old and new figures, reason
  'payroll.bank_file_downloaded': ['PAY_RUN_DECIDE'], // version, file name, people, total, hash; a repeat after Paid is marked `again`
  'payroll.bank_file_voided': ['PAY_RUN_PREPARE', 'PAY_RUN_DECIDE'], // a correction (by HR or the Accountant) or a changed account moved the file
  'payroll.marked_paid': ['PAY_RUN_DECIDE'], // the Accountant locked the month
  'payroll.exported': ['PAY_RUN_PREPARE', 'PAY_RUN_DECIDE'], // kind, format, month, document number or draft, revision
  // Segment 3 (Payslips, casual pay, the P9). Document numbers, counts, device labels and reasons; never a pay figure, a code or a PIN.
  'payslip.code_tried': ['PAYSLIP_ACCESS', 'SECURITY'], // a try at the payslip code: success is PAYSLIP_ACCESS, a wrong one SECURITY (the System Admin reads it)
  'payslip.code_set': ['SECURITY'], // the person chose their first code
  'payslip.opened': ['PAYSLIP_ACCESS'], // number, version, purpose, device, confirmed, opener role, ownerOpened
  'payslip.p9_opened': ['PAYSLIP_ACCESS'],
  'p9.format_confirmed': ['PAY_RUN_DECIDE'], // the Accountant vouched for the P9 layout (PD14)
  'p9.generated': ['DOCUMENTS'], // a P9 was built and stored: year, number, who for
  'casual.person_added': ['PAY_RUN_PREPARE'], // a casual worker record; initials only
  'casual.sheet_sent': ['PAY_RUN_PREPARE'],
  'casual.sheet_taken_back': ['PAY_RUN_PREPARE'], // the head took a waiting sheet back
  'casual.sheet_approved': ['PAY_RUN_DECIDE'], // CPS number, department, worker count, method PIN
  'casual.sheet_sent_back': ['PAY_RUN_DECIDE'],
  'casual.sheet_voided': ['PAY_RUN_DECIDE'],
  'casual.received': ['PAY_RUN_PREPARE'], // a worker signed for cash: initials and time
  'casual.correction_added': ['PAY_RUN_PREPARE'],
  // ── Segment 4 (Leave). Dates, day counts, type codes and reason chips; never a note, a PIN or a balance figure beyond days. ──
  'leave.requested': ['LEAVE'],
  'leave.moved_to_hr': ['LEAVE'], // no answer for 72 hours; channel SYSTEM
  'leave.approved': ['LEAVE'], // slip number, method PIN
  'leave.declined': ['LEAVE'], // reason chip
  'leave.cancelled': ['LEAVE'], // by the person, or by a manager with a PIN
  'leave.balance_adjusted': ['LEAVE'], // HR: type, signed days, reason chip, PIN
  'leave.legacy_carried': ['LEAVE'], // open old requests and balances copied at switch-on; channel SYSTEM
  'leave.slip_cancelled_stamped': ['LEAVE'], // an approved slip was voided: the CANCELLED stamp applies
  // ── end Segment 4 ──
  // someone looked at something sensitive (written when it is not the person's own)
  'people.sensitive_revealed': ['SENSITIVE_VIEW'],
  'people.pay_opened': ['SENSITIVE_VIEW'],
  'people.document_opened': ['SENSITIVE_VIEW'],
  // Segment 6a (Shared parts). Device and place labels, month names, counts; never an amount, a code, a PIN or a password.
  'security.phone_first_seen': ['SECURITY'], // a phone signed in as the person for the first time
  'security.phone_confirmed': ['SECURITY'], // "Yes, this is my phone" (REMEMBER or ONCE)
  'security.phone_removed': ['SECURITY'],
  'security.wasnt_me': ['SECURITY'], // sessions revoked, password and code reset; raises the alert
  'security.password_reset': ['SECURITY'], // the person chose a new password after "This wasn't me"
  'security.payslip_unconfirmed_phone': ['SECURITY'], // the System Admin's copy of an opening on an unconfirmed phone: month name only
  'security.signing_pin_wrong': ['SECURITY'], // the 3rd wrong signing PIN inside the window (flagged)
  'security.alert_cleared': ['SECURITY'], // the System Admin cleared an alert, with a one-line note
  'security.alerts_started': ['SECURITY'], // the System Admin pressed "Start alerts"
  'audit.chain_failed': ['SECURITY'], // the chain check found a break (flagged)
  'needs_you.reminder_sent': ['LOG_ACCESS'], // the Director reminded the person an item waits on: item and day, never a figure
  // Segment 5 (Conduct). Level, number, status and the reason fields roles with audit.read.discipline may read; never a PIN, a code or the own line.
  'conduct.issued': ['DISCIPLINE'],
  'conduct.signed': ['DISCIPLINE'], // the person signed that they received it (late is marked)
  'conduct.sign_try_failed': ['DISCIPLINE'], // a wrong receipt code: device only, never the digits
  'conduct.not_signed_recorded': ['DISCIPLINE'],
  'conduct.witness_confirmed': ['DISCIPLINE'],
  'conduct.witness_declined': ['DISCIPLINE'],
  'conduct.appealed': ['DISCIPLINE'],
  'conduct.decided': ['DISCIPLINE'], // outcome and reason
  'conduct.changed_by_hr': ['DISCIPLINE'], // a reduce or withdraw with no appeal
  'conduct.ended': ['DISCIPLINE'], // by the daily job, channel SYSTEM
  'conduct.document_read': ['DISCIPLINE'], // a manager, HR or the Director opened the letter (not the person)
  'conduct.file_read': ['DISCIPLINE'], // the Conduct tab was read: one entry per person per viewer per day
} as const satisfies Record<string, readonly AuditCategoryCode[]>;

export type AuditActionCode = keyof typeof AUDIT_ACTIONS;
