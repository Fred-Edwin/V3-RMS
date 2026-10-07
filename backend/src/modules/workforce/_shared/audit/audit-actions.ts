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
} as const satisfies Record<string, readonly AuditCategoryCode[]>;

export type AuditActionCode = keyof typeof AUDIT_ACTIONS;
