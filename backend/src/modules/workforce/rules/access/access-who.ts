import type { UserRole } from '@prisma/client';
import { ROLE_GRANTS, scopeOf, workforceCan, type AccessSubject, type Capability, type Scope } from '../../_shared/workforce-access';
import type { RuleGroupCode } from '../rules-schemas';
import { policyOf } from '../rules-values';

/** Roles are listed in this order wherever a list is shown, so the screen and the table never reorder themselves. */
const ROLE_ORDER: UserRole[] = ['DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT', 'MANAGER', 'STORE_MANAGER', 'SYSTEM_ADMIN'];

export interface Holder {
  role: UserRole;
  scope: Scope;
}

/** Everyone the access table gives this capability to, with how wide. Read from ROLE_GRANTS, never typed again. */
export const holdersOf = (capability: Capability): Holder[] =>
  ROLE_ORDER.flatMap((role) => {
    const scope = ROLE_GRANTS[role]?.[capability];
    return scope ? [{ role, scope }] : [];
  });

/** Does the person hold any edit right in this tab, wide enough to write the scope (the company rule, or one site's override)? */
export const mayEditTab = (actor: AccessSubject, group: RuleGroupCode, siteId: string | null): boolean =>
  Object.values(policyOf(group)).some((field) => {
    if (field.edit === null || field.derived === true) return false;
    const scope = scopeOf(actor, field.edit);
    if (scope === null) return false;
    return scope === 'all' || (siteId !== null && siteId === actor.siteId && field.site);
  });

export const mayEditField = (actor: AccessSubject, capability: Capability | null): boolean => capability !== null && workforceCan(actor, capability);
