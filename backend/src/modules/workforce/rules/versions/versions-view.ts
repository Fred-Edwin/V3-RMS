import type { RuleGroup } from '@prisma/client';
import { fromDateColumn, nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { rulesRepository, type RuleVersionRow } from '../resolve/rules-repository';
import { RULE_DEFAULTS } from '../rules-defaults';
import type { RuleGroupCode } from '../rules-schemas';
import { asValues, fieldsOf, policyOf, requiredScopesOf, same, siteFieldsOf, type Values } from '../rules-values';

export type VersionStatus = 'SCHEDULED' | 'IN_FORCE' | 'REPLACED' | 'WITHDRAWN';

export interface RuleVersionView {
  id: string;
  group: RuleGroupCode;
  siteId: string | null;
  version: number;
  effectiveFrom: NairobiDate;
  createdAt: string;
  createdBy: { id: string; name: string; role: string };
  reason: string;
  values: unknown;
  changedFields: string[]; // against the version before it in the same scope
  requiredConfirmations: string[];
  confirmations: { scope: string; by: { id: string; name: string }; at: string; note: string | null }[];
  status: VersionStatus;
  withdrawn: { by: { id: string; name: string; role: string }; at: string; reason: string } | null;
}

export const statusOf = (row: RuleVersionRow, today: NairobiDate, inForceId: string | null): VersionStatus => {
  if (row.withdrawal) return 'WITHDRAWN';
  if (fromDateColumn(row.effectiveFrom) > today) return 'SCHEDULED';
  return row.id === inForceId ? 'IN_FORCE' : 'REPLACED';
};

/** The fields a version changed against the one before it (nothing before it: the code defaults for the company, no own fields for a site). */
export const changedAgainst = (group: RuleGroupCode, siteId: string | null, row: RuleVersionRow, previous: RuleVersionRow | null): string[] => {
  const keys = (siteId ? siteFieldsOf(group) : fieldsOf(group)).filter((key) => policyOf(group)[key]?.derived !== true);
  const before = previous ? asValues(previous.values) : siteId ? {} : asValues(RULE_DEFAULTS[group]);
  const after = asValues(row.values);
  return keys.filter((key) => !same(before[key], after[key]));
};

/** Rows to views. `previousOf` finds the row before one (same scope), so a page of history needs no extra queries for the rows it holds. */
export async function toViews(
  companyId: string,
  group: RuleGroupCode,
  siteId: string | null,
  rows: RuleVersionRow[],
  previousOf: (row: RuleVersionRow) => RuleVersionRow | null,
  now: Date,
): Promise<RuleVersionView[]> {
  const today = nairobiToday(now);
  const inForce = await rulesRepository.findEffective(companyId, siteId, group as RuleGroup, toDateColumn(today));
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.createdById);
    if (row.withdrawal) ids.add(row.withdrawal.withdrawnById);
    for (const confirmation of row.confirmations) ids.add(confirmation.confirmedById);
  }
  const names = await rulesRepository.findUserNames(companyId, [...ids]);
  const nameOf = (id: string): string => names.get(id) ?? 'Unknown';

  return rows.map((row) => ({
    id: row.id,
    group,
    siteId: row.siteId,
    version: row.version,
    effectiveFrom: fromDateColumn(row.effectiveFrom),
    createdAt: row.createdAt.toISOString(),
    createdBy: { id: row.createdById, name: nameOf(row.createdById), role: row.createdByRole },
    reason: row.reason,
    values: row.values,
    changedFields: changedAgainst(group, siteId, row, previousOf(row)),
    requiredConfirmations: siteId ? [] : requiredScopesOf(group, asValues(row.values) as Values),
    confirmations: row.confirmations.map((c) => ({ scope: c.scope, by: { id: c.confirmedById, name: nameOf(c.confirmedById) }, at: c.confirmedAt.toISOString(), note: c.note })),
    status: statusOf(row, today, inForce?.id ?? null),
    withdrawn: row.withdrawal
      ? { by: { id: row.withdrawal.withdrawnById, name: nameOf(row.withdrawal.withdrawnById), role: row.withdrawal.withdrawnByRole }, at: row.withdrawal.withdrawnAt.toISOString(), reason: row.withdrawal.reason }
      : null,
  }));
}

/** One version as a view, looking up the version before it. */
export async function viewOf(row: RuleVersionRow, now: Date = new Date()): Promise<RuleVersionView> {
  const group = row.group as RuleGroupCode;
  const previous = row.version > 1 ? await rulesRepository.findByNumber(row.companyId, row.siteId, row.group, row.version - 1) : null;
  const [view] = await toViews(row.companyId, group, row.siteId, [row], () => previous, now);
  if (!view) throw new Error('Version view could not be built');
  return view;
}
