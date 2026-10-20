import { ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { conductActor } from '../_shared/conduct-context';
import { dayMonthYear } from '../_shared/conduct-format';
import { jobLabelOf } from '../_shared/conduct-load';
import { ABOUT_LABELS, LEVEL_LABELS, noticeNumberLabel } from '../_shared/conduct-model';
import { conductPeopleRepository } from '../_shared/conduct-people-repository';
import { readScopeOf } from '../_shared/conduct-scope';
import { effectiveStatus, STATUS_WORDS } from './notice-view';
import { listRepository, type ListScope } from './list-repository';
import type { ListQuery } from './notices-validators';

export interface DeskRow {
  id: string;
  personId: string;
  personName: string;
  jobLabel: string;
  level: string;
  levelLabel: string;
  number: string | null;
  aboutLabel: string;
  issuedAt: string;
  status: string;
  statusWord: string;
  siteId: string;
  siteName: string;
  /** Set when the person was issued the notice at another site and works here now (C26). */
  issuedAtSite: string | null;
}

export interface DeskList {
  counts: { active: number; written: number; endingIn30: number; appealsWithHr: number; appealed: number; ended: number };
  nextEnding: { jobLabel: string; date: string } | null;
  items: DeskRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** The scope a reader's list covers. A site reader sees their own site; HR and the Director see all, or one site they pick. */
async function scopeFor(subject: AccessSubject, companyId: string, requestedSite: string | undefined, q: string): Promise<ListScope> {
  const read = readScopeOf(subject);
  if (read.kind === 'none') throw new ForbiddenError('You do not have permission to perform this action');
  if (read.kind === 'site' && requestedSite && requestedSite !== read.siteId) throw new NotFoundError('We could not find that site.', 'SITE_NOT_FOUND');
  const siteId = read.kind === 'site' ? read.siteId : (requestedSite ?? null);
  const nameMatchIds = q ? await conductPeopleRepository.employeeIdsByName(companyId, q) : null;
  return {
    companyId,
    siteId,
    employeeIdsAtSite: siteId ? await conductPeopleRepository.employeeIdsAtSite(companyId, siteId) : null,
    nameMatchIds,
  };
}

/** The Conduct list for managers, HR and the Director (S8, S12): chips, KPI counts, and a page of rows. */
export async function listNotices(subject: AccessSubject, query: ListQuery, now: Date = new Date()): Promise<DeskList> {
  const ctx = await conductActor(subject, 'discipline.read');
  const scope = await scopeFor(subject, ctx.companyId, query.site, query.q);
  const [{ rows, total }, counts] = await Promise.all([listRepository.page(scope, query.status, now, query.page, query.pageSize), listRepository.counts(scope, now)]);
  const people = new Map((await conductPeopleRepository.peopleByIds(ctx.companyId, [...new Set([...rows.map((r) => r.employeeId), ...(counts.next ? [counts.next.employeeId] : [])])])).map((p) => [p.employeeId, p]));
  const items = rows.map<DeskRow>((notice) => {
    const person = people.get(notice.employeeId);
    const status = effectiveStatus(notice, now);
    return {
      id: notice.id,
      personId: notice.employeeId,
      personName: person?.name ?? 'Former staff member',
      jobLabel: person ? jobLabelOf(person) : 'Staff',
      level: notice.level,
      levelLabel: LEVEL_LABELS[notice.level],
      number: noticeNumberLabel(notice.number),
      aboutLabel: ABOUT_LABELS[notice.about],
      issuedAt: notice.issuedAt.toISOString(),
      status,
      statusWord: STATUS_WORDS[status],
      siteId: notice.siteId,
      siteName: notice.siteName,
      issuedAtSite: person && person.siteId !== notice.siteId ? notice.siteName : null,
    };
  });
  const next = counts.next ? people.get(counts.next.employeeId) : undefined;
  return {
    counts: { active: counts.active, written: counts.written, endingIn30: counts.endingIn30, appealsWithHr: counts.appealed, appealed: counts.appealed, ended: counts.ended },
    nextEnding: counts.next ? { jobLabel: next ? jobLabelOf(next) : 'Staff', date: dayMonthYear(counts.next.validUntil) } : null,
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** Whether a role may use the all-sites select (HR and the Director). */
export const mayPickSite = (subject: AccessSubject): boolean => scopeOf(subject, 'discipline.read') === 'all';
