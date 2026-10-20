import { NotFoundError } from '../../../../utils/errors';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';

/** What a caller may list: everything, one site's notices (their own people now, or issued at their site), or nothing beyond their own. */
export type ReadScope = { kind: 'all' } | { kind: 'site'; siteId: string } | { kind: 'none' };

export function readScopeOf(subject: AccessSubject): ReadScope {
  const scope = scopeOf(subject, 'discipline.read');
  if (scope === 'all') return { kind: 'all' };
  if (scope === 'unit' && subject.siteId) return { kind: 'site', siteId: subject.siteId };
  return { kind: 'none' };
}

/** The facts about a notice that decide who may see it. */
export interface NoticeAccessFacts {
  personUserId: string | null;
  siteId: string; // the person's site on the day of issue
  personSiteNow: string; // where the person works now (a transferred person's notices follow them, C26)
}

/** Whether the caller may read this notice: their own, or in their site's scope, or any for HR and the Director. */
export function canReadNotice(subject: AccessSubject, notice: NoticeAccessFacts): boolean {
  if (notice.personUserId !== null && notice.personUserId === subject.id && scopeOf(subject, 'discipline.read_own') !== null) return true;
  const read = readScopeOf(subject);
  if (read.kind === 'all') return true;
  return read.kind === 'site' && (notice.siteId === read.siteId || notice.personSiteNow === read.siteId);
}

/** Reading out of scope answers 404 so a notice's existence is never confirmed (spec section 12). */
export function assertCanRead(subject: AccessSubject, notice: NoticeAccessFacts): void {
  if (!canReadNotice(subject, notice)) throw new NotFoundError('We could not find that notice.', 'NOTICE_NOT_FOUND');
}

/** Whether the caller is the subject of the notice (the person it is about). */
export const isSubject = (subject: AccessSubject, notice: { personUserId: string | null }): boolean => notice.personUserId !== null && notice.personUserId === subject.id;
