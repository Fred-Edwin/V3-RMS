import { ZodError } from 'zod';
import { prisma } from '../../../../config/database';
import { AppError } from '../../../../utils/errors';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { holdersOf } from '../access/access-who';
import { planChange, startWindow } from '../plan/plan-build';
import { impactRows } from '../plan/plan-impact';
import { resolveNotice, toldCounts } from '../plan/plan-notice';
import type { ImpactRow } from '../plan/plan.types';
import { actorCompany } from '../resolve/rules-context';
import { confirmCapabilityOf, requireGroup } from '../rules-values';
import { requestOf } from './versions-create';
import type { ChangeBody } from './versions-validators';

export interface PreviewError {
  code: string;
  message: string; // plain words, shown under the field or the date
  field: string | null;
  details?: unknown;
}

export interface Preview {
  canSave: boolean;
  errors: PreviewError[];
  changedFields: string[];
  becomes: { version: number; from: NairobiDate } | null;
  impact: ImpactRow[];
  told: { role: string; count: number }[];
  /** D1: true when a pay field changes, so the caption says "told it changed" and no figures go in the notice. */
  toldWithoutFigures: boolean;
  needsConfirmation: { scope: string; whoCan: { role: string }[] }[];
  confirmsWithYourPin: string[]; // scopes this very save confirms, because the signer holds the right
  approvedMonthsAffected: boolean;
  earliestEffectiveFrom: NairobiDate;
  defaultEffectiveFrom: NairobiDate;
  expectedVersion: number; // send this back with the save; a newer version in the scope makes the save stale
}

const DATE_ERRORS = new Set(['RULE_BACKDATED', 'RULE_MONTH_APPROVED', 'RULE_DATE_TOO_FAR', 'RULE_DATE_NOT_WEEK_START', 'RULE_FUTURE_VERSION_EXISTS']);

/** A refusal the person can fix is an error line; being refused outright (403, 404) or a fault is not, and goes up as it is. */
const asErrors = (error: unknown): PreviewError[] => {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => ({ code: 'RULE_INVALID_VALUE', message: issue.message, field: typeof issue.path[0] === 'string' ? issue.path[0] : null }));
  }
  if (error instanceof AppError && [400, 409, 422].includes(error.statusCode)) {
    return [{ code: error.code, message: error.message, field: DATE_ERRORS.has(error.code) ? 'effectiveFrom' : null, details: error.details }];
  }
  throw error;
};

/**
 * Everything the Change dialog shows before Save, with no side effects: the rows the change would touch, who is told, what
 * waits for a confirmation, the earliest and suggested start day, and every reason Save is not allowed yet. Needs the same
 * rights as saving (a person who may not change the tab gets 403, not an error list).
 */
export async function previewVersion(actor: AccessSubject, groupInput: string, body: ChangeBody, now: Date = new Date()): Promise<Preview> {
  const group = requireGroup(groupInput);
  const request = requestOf(body);
  try {
    const plan = await planChange(actor, group, request, prisma, now);
    const notice = await resolveNotice(plan.companyId, plan.siteId, actor, plan.audiences);
    return {
      canSave: true,
      errors: [],
      changedFields: plan.changedFields,
      becomes: { version: plan.becomesVersion, from: plan.effectiveFrom },
      impact: impactRows(group, plan.changedFields, plan.before, plan.after, plan.effectiveFrom),
      told: toldCounts(notice),
      toldWithoutFigures: plan.pay,
      needsConfirmation: plan.waitingScopes.map((scope) => {
        const capability = confirmCapabilityOf(group, scope);
        return { scope, whoCan: capability ? holdersOf(capability).map((holder) => ({ role: holder.role })) : [] };
      }),
      confirmsWithYourPin: plan.confirmations.filter((c) => c.confirmedById === actor.id).map((c) => c.scope),
      approvedMonthsAffected: plan.approvedMonthsAffected,
      earliestEffectiveFrom: plan.earliestEffectiveFrom,
      defaultEffectiveFrom: plan.defaultEffectiveFrom,
      expectedVersion: plan.latestVersion,
    };
  } catch (error) {
    const errors = asErrors(error);
    const { companyId } = await actorCompany(actor);
    const window = await startWindow(companyId, group, request.siteId, [], now, prisma);
    return {
      canSave: false,
      errors,
      changedFields: [],
      becomes: null,
      impact: [],
      told: [],
      toldWithoutFigures: false,
      needsConfirmation: [],
      confirmsWithYourPin: [],
      approvedMonthsAffected: false,
      earliestEffectiveFrom: window.earliest,
      defaultEffectiveFrom: window.suggested,
      expectedVersion: window.latestVersion,
    };
  }
}
