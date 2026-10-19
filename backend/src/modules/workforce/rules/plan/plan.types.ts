import type { AuditCategoryCode } from '../../_shared/audit/audit.types';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { RuleNoticeAudience } from '../rules-field-policy';
import type { RuleGroupCode } from '../rules-schemas';
import type { Values } from '../rules-values';

/** What the dialog sends (create and preview). `reason`, `pin` and `idempotencyKey` are added by create. */
export interface ChangeRequest {
  siteId: string | null; // null = the company rule
  effectiveFrom: NairobiDate;
  /**
   * Company scope: the fields to set, laid over what is in force (a full group works too). Conduct `levels` may be only
   * `{ level, validForMonths }`. Site scope: the fields to make the site's own, added to the site's existing own fields.
   */
  values: Values;
  /** Site scope: fields to hand back to the company rule. Site scope with no values and no list: every own field goes back (D21). */
  useCompanyRuleFor?: string[];
  expectedVersion?: number; // the highest version number of this scope the screen saw (D8)
}

export interface ConfirmationToCreate {
  scope: string;
  confirmedById: string;
  confirmerRole: string;
  note: string | null;
}

export interface PlannedChange {
  companyId: string;
  actorName: string;
  group: RuleGroupCode;
  siteId: string | null;
  effectiveFrom: NairobiDate;
  stored: Values; // what the new version row holds: the full group (company) or the site's own fields (site)
  changedFields: string[];
  before: Values; // changed fields only, as they were in force on the date
  after: Values; // changed fields only, as they will be
  becomesVersion: number; // the number the new version gets
  latestVersion: number; // the highest number in the scope now (what expectedVersion is compared with)
  requiredScopes: string[];
  confirmations: ConfirmationToCreate[];
  waitingScopes: string[]; // scopes nobody has confirmed: someone with the capability still has to
  audiences: Set<RuleNoticeAudience>;
  category: AuditCategoryCode;
  pay: boolean; // a changed field is a pay field: told without figures (D1)
  approvedMonthsAffected: boolean;
  earliestEffectiveFrom: NairobiDate;
  defaultEffectiveFrom: NairobiDate;
}

export interface ImpactRow {
  label: string;
  value: string;
}
