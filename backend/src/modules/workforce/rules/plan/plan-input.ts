import type { ZodType } from 'zod';
import { UnprocessableEntityError, ValidationError } from '../../../../utils/errors';
import { RULE_SCHEMAS, RULE_SITE_SCHEMAS, type RuleGroupCode } from '../rules-schemas';
import { asValues, fieldsOf, isSiteGroup, pick, siteFieldsOf, withDerived, type Values } from '../rules-values';
import type { ChangeRequest } from './plan.types';

export interface InForce {
  company: Values; // the company values in force on the date (the stored version, or the code defaults)
  site: Values; // the site's own fields in force on the date (empty for the company scope)
}

const rejectUnknown = (group: RuleGroupCode, values: Values): void => {
  const known = new Set(fieldsOf(group));
  const unknown = Object.keys(values).filter((key) => !known.has(key));
  if (unknown.length > 0) throw new ValidationError(`Not a setting of this tab: ${unknown.join(', ')}`, 'RULE_FIELD_UNKNOWN');
};

/** The screen edits only the months of a conduct level; the label, the letter and who may issue stay as they are. */
const mergeConductLevels = (supplied: unknown, current: unknown): unknown => {
  if (!Array.isArray(supplied) || !Array.isArray(current)) return supplied;
  return current.map((level: Values) => {
    const edit = supplied.find((item): item is Values => item !== null && typeof item === 'object' && (item as Values).level === level.level);
    return edit && 'validForMonths' in edit ? { ...level, validForMonths: edit.validForMonths } : level;
  });
};

export interface Normalised {
  stored: Values; // what the new version row holds
  before: Values; // the effective values (company + site) in force on the date
  after: Values; // the effective values once the new version applies
}

/** Company scope: the supplied fields laid over what is in force, then the whole group is validated. */
const companyChange = (group: RuleGroupCode, request: ChangeRequest, inForce: InForce): Normalised => {
  rejectUnknown(group, request.values);
  const supplied = { ...request.values };
  if (group === 'CONDUCT' && 'levels' in supplied) supplied.levels = mergeConductLevels(supplied.levels, inForce.company.levels);
  const merged = withDerived(group, { ...inForce.company, ...supplied });
  const stored = asValues((RULE_SCHEMAS[group] as ZodType<unknown>).parse(merged));
  return { stored, before: inForce.company, after: stored };
};

/** Site scope: the fields the site makes its own, added to the ones it already has, minus the ones handed back (D21). */
const siteChange = (group: RuleGroupCode, request: ChangeRequest, inForce: InForce): Normalised => {
  const siteSchema = (RULE_SITE_SCHEMAS as Partial<Record<RuleGroupCode, ZodType<unknown>>>)[group];
  if (!siteSchema || !isSiteGroup(group)) throw new UnprocessableEntityError('This tab is one company rule: a site cannot have its own', 'RULE_SITE_FIELD_NOT_OVERRIDABLE');
  const allowed = siteFieldsOf(group);
  const outside = [...Object.keys(request.values), ...(request.useCompanyRuleFor ?? [])].filter((key) => !allowed.includes(key));
  if (outside.length > 0) throw new UnprocessableEntityError(`A site cannot have its own: ${outside.join(', ')}`, 'RULE_SITE_FIELD_NOT_OVERRIDABLE');

  const clearAll = Object.keys(request.values).length === 0 && (request.useCompanyRuleFor ?? []).length === 0;
  const handedBack = new Set(request.useCompanyRuleFor ?? []);
  const combined = clearAll ? {} : pick({ ...inForce.site, ...request.values }, allowed.filter((key) => !handedBack.has(key)));
  const stored = asValues(siteSchema.parse(combined));

  const before = { ...inForce.company, ...pick(inForce.site, allowed) };
  const after = withDerived(group, { ...inForce.company, ...stored });
  RULE_SCHEMAS[group].parse(after); // the whole group must still make sense with the site's rows laid over the company's
  return { stored, before: withDerived(group, before), after };
};

export const normaliseChange = (group: RuleGroupCode, request: ChangeRequest, inForce: InForce): Normalised =>
  request.siteId === null ? companyChange(group, request, inForce) : siteChange(group, request, inForce);
