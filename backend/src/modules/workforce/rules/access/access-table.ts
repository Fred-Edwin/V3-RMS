import type { Capability } from '../../_shared/workforce-access';
import { AUDIENCE_ROLE, toldAudiencesOf } from '../plan/plan-notice';
import type { RuleGroupCode } from '../rules-schemas';
import { GROUPS, policyOf } from '../rules-values';
import { ROWS } from './access-catalogue';
import { holdersOf } from './access-who';

/**
 * The "Who edits what" table (D30), built from the access table, the field policy and the audience map, never typed twice.
 * Structured parts are for the screen; `text` is the one-line wording of each column. A test fails if a tab has no row.
 */
export interface AccessTableRow {
  group: RuleGroupCode;
  slug: string;
  label: string;
  changedBy: { role: string; scope: 'ALL' | 'OWN_SITE'; rows: string[] | null }[]; // rows null = every row of the tab
  confirmedBy: { role: string; what: string | null }[];
  told: { role: string }[];
  text: { changedBy: string; confirmedBy: string; told: string };
}

const TABS: Record<RuleGroupCode, { slug: string; label: string }> = {
  LATENESS: { slug: 'lateness', label: 'Lateness' },
  OVERTIME: { slug: 'overtime', label: 'Overtime' },
  ATTENDANCE: { slug: 'attendance', label: 'Attendance' },
  LEAVE: { slug: 'leave', label: 'Leave' },
  PROBATION: { slug: 'probation', label: 'Probation' },
  CASUAL_WORK: { slug: 'casual', label: 'Casual work' },
  CONDUCT: { slug: 'conduct', label: 'Conduct' },
  STATUTORY: { slug: 'statutory', label: 'Statutory' },
  HOLIDAYS: { slug: 'holidays', label: 'Holidays' },
  WEEK_AND_BREAKS: { slug: 'week', label: 'Week and breaks' },
};

const ROLE_ORDER = ['DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT', 'BRANCH_MANAGER', 'SYSTEM_ADMIN', 'DEPARTMENT_HEAD'];
const ROLE_WORDS: Record<string, string> = {
  DIRECTOR: 'Director',
  HR_MANAGER: 'HR',
  ACCOUNTANT: 'Accountant',
  BRANCH_MANAGER: 'Branch Manager',
  SYSTEM_ADMIN: 'System Admin',
  DEPARTMENT_HEAD: 'department heads',
};
const byRole = (a: string, b: string): number => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b);
// The Store Manager of the Central Store is a Branch Manager of that site for every rule.
const merged = (role: string): string => (role === 'MANAGER' || role === 'STORE_MANAGER' ? 'BRANCH_MANAGER' : role);

const rowName = (group: RuleGroupCode, id: string): string => ROWS[group].find((row) => row.id === id)?.short ?? id;

/** "(tail, caps)" for a few rows, "(all but the deduction cap)" when a role has most of the tab. */
const rowsText = (group: RuleGroupCode, rows: string[]): string => {
  const editable = ROWS[group].filter((row) => !row.fixed && row.fields.length > 0).map((row) => row.id);
  const left = editable.filter((id) => !rows.includes(id));
  return rows.length > left.length ? `all but ${left.map((id) => rowName(group, id)).join(', ')}` : rows.map((id) => rowName(group, id)).join(', ');
};

const changedByOf = (group: RuleGroupCode): AccessTableRow['changedBy'] => {
  const policy = policyOf(group);
  const editableRows = ROWS[group].filter((row) => !row.fixed && row.fields.some((f) => policy[f]?.edit != null && policy[f]?.derived !== true));
  const reach = new Map<string, Map<string, 'ALL' | 'OWN_SITE'>>(); // role -> row id -> scope
  for (const row of editableRows) {
    const fields = row.fields.filter((f) => policy[f]?.edit != null && policy[f]?.derived !== true);
    const capabilities = new Set(fields.map((f) => policy[f]?.edit as Capability));
    for (const capability of capabilities) {
      const siteLevel = fields.some((f) => policy[f]?.edit === capability && policy[f]?.site === true);
      for (const holder of holdersOf(capability)) {
        const scope = holder.scope === 'all' ? 'ALL' : siteLevel ? 'OWN_SITE' : null;
        if (!scope) continue;
        const role = merged(holder.role);
        const perRow = reach.get(role) ?? new Map<string, 'ALL' | 'OWN_SITE'>();
        if (perRow.get(row.id) !== 'ALL') perRow.set(row.id, scope);
        reach.set(role, perRow);
      }
    }
  }
  const entries: AccessTableRow['changedBy'] = [];
  for (const role of [...reach.keys()].sort(byRole)) {
    const perRow = reach.get(role) ?? new Map();
    for (const scope of ['ALL', 'OWN_SITE'] as const) {
      const ids = [...perRow.entries()].filter(([, s]) => s === scope).map(([id]) => id);
      if (ids.length === 0) continue;
      entries.push({ role, scope, rows: ids.length === editableRows.length ? null : ids });
    }
  }
  return entries;
};

const confirmedByOf = (group: RuleGroupCode): AccessTableRow['confirmedBy'] => {
  const policy = policyOf(group);
  const entries: AccessTableRow['confirmedBy'] = [];
  for (const row of ROWS[group]) {
    const confirm = row.fields.map((f) => policy[f]?.confirm).find((c) => c !== undefined);
    if (!confirm) continue;
    for (const holder of holdersOf(confirm.capability)) entries.push({ role: merged(holder.role), what: row.short ?? row.id });
  }
  return entries;
};

const words = (roles: string[]): string => roles.map((role) => ROLE_WORDS[role] ?? role).join(', ');

export function buildAccessTable(): AccessTableRow[] {
  return GROUPS.map((group) => {
    const changedBy = changedByOf(group);
    const confirmedBy = confirmedByOf(group);
    const told = [...new Set(toldAudiencesOf(group).map((audience) => AUDIENCE_ROLE[audience]).map(merged))].map((role) => ({ role }));
    const changedText = changedBy
      .map((entry) => `${ROLE_WORDS[entry.role] ?? entry.role}${entry.scope === 'OWN_SITE' ? ' for own site' : ''}${entry.rows ? ` (${rowsText(group, entry.rows)})` : ''}`)
      .join(' · ');
    const confirmedText = confirmedBy.length === 0 ? 'No one, starts on its date' : confirmedBy.map((entry) => `${ROLE_WORDS[entry.role] ?? entry.role} (${entry.what})`).join(' · ');
    return { group, ...TABS[group], changedBy, confirmedBy, told, text: { changedBy: changedText, confirmedBy: confirmedText, told: words(told.map((t) => t.role)) } };
  });
}
