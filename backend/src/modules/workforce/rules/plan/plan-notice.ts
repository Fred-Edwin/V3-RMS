import type { UserRole } from '@prisma/client';
import type { AccessSubject } from '../../_shared/workforce-access';
import { rulesRepository } from '../resolve/rules-repository';
import type { RuleNoticeAudience } from '../rules-field-policy';
import type { RuleGroupCode } from '../rules-schemas';
import type { RuleChangeNotice } from '../rules.types';

/** The TOLD column of the "Who edits what" table (spec section 16). The person who made the change is never told. */
const TOLD: Record<RuleGroupCode, RuleNoticeAudience[]> = {
  LATENESS: ['ALL_BRANCH_MANAGERS', 'HR', 'ACCOUNTANT'],
  OVERTIME: ['ACCOUNTANT', 'HR'],
  ATTENDANCE: ['ALL_BRANCH_MANAGERS', 'HR'],
  LEAVE: ['ALL_BRANCH_MANAGERS', 'HR'],
  PROBATION: ['HR', 'ALL_BRANCH_MANAGERS'],
  CASUAL_WORK: ['ALL_BRANCH_MANAGERS', 'ACCOUNTANT'],
  CONDUCT: ['HR', 'ALL_BRANCH_MANAGERS'],
  STATUTORY: ['DIRECTOR', 'HR'],
  HOLIDAYS: ['ACCOUNTANT', 'HR'],
  WEEK_AND_BREAKS: ['ALL_BRANCH_MANAGERS', 'DEPARTMENT_HEADS'],
};

export const toldAudiencesOf = (group: RuleGroupCode): RuleNoticeAudience[] => TOLD[group];

const BRANCH_MANAGER_ROLES: UserRole[] = ['MANAGER', 'STORE_MANAGER'];
const AUDIENCE_ROLES: Partial<Record<RuleNoticeAudience, UserRole[]>> = {
  DIRECTOR: ['DIRECTOR'],
  DIRECTOR_TO_CONFIRM: ['DIRECTOR'],
  ALL_BRANCH_MANAGERS: BRANCH_MANAGER_ROLES,
  BRANCH_MANAGER_OF_SITE: BRANCH_MANAGER_ROLES,
  HR: ['HR_MANAGER'],
  ACCOUNTANT: ['ACCOUNTANT'],
  ACCOUNTANT_TO_CONFIRM: ['ACCOUNTANT'],
};

/** The role word the screen shows for an audience ("The 4 Branch Managers, HR and the Accountant are told"). */
export const AUDIENCE_ROLE: Record<RuleNoticeAudience, string> = {
  DIRECTOR: 'DIRECTOR',
  DIRECTOR_TO_CONFIRM: 'DIRECTOR',
  ALL_BRANCH_MANAGERS: 'BRANCH_MANAGER',
  BRANCH_MANAGER_OF_SITE: 'BRANCH_MANAGER',
  HR: 'HR_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  ACCOUNTANT_TO_CONFIRM: 'ACCOUNTANT',
  DEPARTMENT_HEADS: 'DEPARTMENT_HEAD',
};

/** Who is told of a version, from the tab's table: a site version tells that site's manager, a Branch Manager's own change also tells the Director. */
export const audiencesFor = (group: RuleGroupCode, siteId: string | null, actor: AccessSubject, minimumCoverOnly: boolean): Set<RuleNoticeAudience> => {
  const audiences = new Set<RuleNoticeAudience>(TOLD[group]);
  if (siteId) {
    audiences.delete('ALL_BRANCH_MANAGERS');
    audiences.add('BRANCH_MANAGER_OF_SITE');
  }
  if (minimumCoverOnly) {
    audiences.delete('ALL_BRANCH_MANAGERS');
    audiences.add('DEPARTMENT_HEADS'); // the head is told on every minimum-cover change
  }
  if (actor.role === 'MANAGER' || actor.role === 'STORE_MANAGER') audiences.add('DIRECTOR');
  return audiences;
};

/** Resolve audiences to people. Nobody is listed twice for the same audience, and the actor is never told. */
export const resolveNotice = async (companyId: string, siteId: string | null, actor: AccessSubject, audiences: Set<RuleNoticeAudience>): Promise<RuleChangeNotice> => {
  const recipients: { userId: string; audience: string }[] = [];
  const seen = new Set<string>();
  for (const audience of audiences) {
    const ids =
      audience === 'DEPARTMENT_HEADS'
        ? await rulesRepository.findHeadUserIds(companyId, siteId)
        : (await rulesRepository.findActiveUsers(companyId, AUDIENCE_ROLES[audience] ?? [], audience === 'BRANCH_MANAGER_OF_SITE' ? siteId : null)).map((user) => user.id);
    for (const userId of ids) {
      const key = `${userId}:${audience}`;
      if (userId === actor.id || seen.has(key)) continue;
      seen.add(key);
      recipients.push({ userId, audience });
    }
  }
  return { recipients };
};

/** "The 4 Branch Managers, HR and the Accountant are told": how many people per role, each person counted once. */
export const toldCounts = (notice: RuleChangeNotice): { role: string; count: number }[] => {
  const people = new Map<string, Set<string>>();
  for (const { userId, audience } of notice.recipients) {
    const role = AUDIENCE_ROLE[audience as RuleNoticeAudience] ?? audience;
    const set = people.get(role) ?? new Set<string>();
    set.add(userId);
    people.set(role, set);
  }
  return [...people.entries()].map(([role, set]) => ({ role, count: set.size }));
};
