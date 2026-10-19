import { scopeOf, type AccessSubject, type Capability } from '../../_shared/workforce-access';
import type { RuleGroupCode } from '../rules-schemas';
import { policyOf } from '../rules-values';
import { holdersOf } from './access-who';
import { ROWS } from './access-catalogue';

export interface RowAnswer {
  fields: string[];
  kind: 'EDITABLE' | 'FIXED';
  canChange: boolean; // Change is active for this viewer and the site they are looking at
  lockedReason: { whoCan: { role: string; siteName?: string }[] } | null; // the padlock's answer; null when Change is active or the row is Fixed
  confirmedBy: { name: string; role: string; at: string } | null;
  waitingForConfirmation: boolean; // a newer value waits; the older confirmed one stays in use (D2)
  ownRule: boolean; // the viewed site has made this row its own
}

export interface RowContext {
  site: { id: string; name: string; type: 'BRANCH' | 'CENTRAL_STORE' } | null; // the site being looked at; null = the company rule
  ownFields: Set<string>; // fields the viewed site has made its own
  confirmed: Map<string, { name: string; role: string; at: string }>; // by confirmation scope
  waiting: Set<string>; // scopes waiting for a confirmation
}

/** Can this person write this field, for the company rule (siteId null) or for one site's override? */
const mayWrite = (actor: AccessSubject, capability: Capability, siteField: boolean, siteId: string | null): boolean => {
  const scope = scopeOf(actor, capability);
  return scope === 'all' || (scope === 'unit' && siteField && siteId !== null && siteId === actor.siteId);
};

/** One answer per row of a tab for this viewer, from the access table and the field policy: no separate call per click. */
export function answerRows(actor: AccessSubject, group: RuleGroupCode, context: RowContext): Record<string, RowAnswer> {
  const policy = policyOf(group);
  const answers: Record<string, RowAnswer> = {};
  for (const row of ROWS[group]) {
    const editable = row.fixed ? [] : row.fields.filter((field) => policy[field]?.edit != null && policy[field]?.derived !== true);
    const capabilities = [...new Set(editable.map((field) => policy[field]?.edit as Capability))];
    const whoCan = capabilities.flatMap((capability): { role: string; siteName?: string }[] =>
      holdersOf(capability).flatMap((holder) => {
        if (holder.scope === 'all') return [{ role: holder.role }];
        const siteLevel = editable.some((field) => policy[field]?.edit === capability && policy[field]?.site === true);
        if (!siteLevel || !context.site) return [];
        const wanted = context.site.type === 'CENTRAL_STORE' ? 'STORE_MANAGER' : 'MANAGER';
        return holder.role === wanted ? [{ role: holder.role, siteName: context.site.name }] : [];
      }),
    );
    const unique = whoCan.filter((who, index) => whoCan.findIndex((other) => other.role === who.role && other.siteName === who.siteName) === index);
    const fixed = editable.length === 0 || unique.length === 0;
    const canChange = !fixed && editable.every((field) => mayWrite(actor, policy[field]?.edit as Capability, policy[field]?.site === true, context.site?.id ?? null));
    const scope = row.fields.map((field) => policy[field]?.confirm?.scope).find((s): s is string => s !== undefined);
    answers[row.id] = {
      fields: row.fields,
      kind: fixed ? 'FIXED' : 'EDITABLE',
      canChange,
      lockedReason: fixed || canChange ? null : { whoCan: unique },
      confirmedBy: scope ? (context.confirmed.get(scope) ?? null) : null,
      waitingForConfirmation: scope ? context.waiting.has(scope) : false,
      ownRule: context.site !== null && row.fields.some((field) => context.ownFields.has(field)),
    };
  }
  return answers;
}
