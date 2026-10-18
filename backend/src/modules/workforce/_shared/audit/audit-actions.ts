import type { AuditCategoryCode } from './audit.types';

/**
 * Every action code and the categories it may be filed under. The writer refuses a code that is not here, or a
 * category the code does not allow, so an entry cannot be filed where the wrong roles can read it. Each slice adds
 * its own codes in the same commit as the behaviour. Slice 0 registers these three.
 */
export const AUDIT_ACTIONS = {
  'rules.version_created': ['RULES_OPERATING', 'RULES_PAY'], // PAY when the change touches statutory, multipliers or holiday pay
  'rules.version_confirmed': ['RULES_PAY'],
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
  // someone looked at something sensitive (written when it is not the person's own)
  'people.sensitive_revealed': ['SENSITIVE_VIEW'],
  'people.pay_opened': ['SENSITIVE_VIEW'],
  'people.document_opened': ['SENSITIVE_VIEW'],
} as const satisfies Record<string, readonly AuditCategoryCode[]>;

export type AuditActionCode = keyof typeof AUDIT_ACTIONS;
