/**
 * The public face of the rules store. The rest of Workforce imports from here (or from `rules-service`, which re-exports the
 * same resolver); nothing outside this folder reaches into `resolve/`, `plan/`, `versions/` and the others.
 */
export { getEffectiveRules, getEffectiveRuleGroup, isPayConfirmed } from './resolve/rules-resolve';
export { RULE_DEFAULTS } from './rules-defaults';
export { setApprovedMonthGuard, type ApprovedMonthGuard } from './plan/plan-months';
export type { EffectiveRules, EffectiveRuleGroup, PayReadiness } from './rules.types';
export type { RuleGroupCode, RuleValues, LatenessRules, OvertimeRules, AttendanceRules, WeekAndBreaksRules } from './rules-schemas';
