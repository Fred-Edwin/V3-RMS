/**
 * What the rest of Workforce imports. The rules store itself is split by what the user does:
 * `resolve/` (what is in force), `page/` (a tab), `versions/` (change, preview, withdraw), `history/`, `confirm/`, `access/`.
 */
export { getEffectiveRules, getEffectiveRuleGroup, isPayConfirmed } from './resolve/rules-resolve';
