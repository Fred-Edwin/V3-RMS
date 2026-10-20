import { scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import type { NeedsYouContext, NeedsYouRow, NeedsYouSource } from '../../needs-you';
import { directorUserIds, hrUserIds } from '../_shared/conduct-context';
import { recordableFrom } from '../_shared/conduct-dates';
import { LEVEL_LABELS, noticeNumberLabel } from '../_shared/conduct-model';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import { issuedByHr } from '../_shared/conduct-roles';
import { conductNeedsYouRepository as repo } from './needs-you-repository';

const label = (notice: ConductNotice): string => {
  const number = noticeNumberLabel(notice.number);
  return number ? `${LEVEL_LABELS[notice.level]} ${number}` : LEVEL_LABELS[notice.level];
};

const row = (kind: string, notice: ConductNotice, text: string, opens: string, since: Date, waitingOnRole: string, canRemind: boolean): NeedsYouRow => ({
  id: `${kind}:${notice.id}`,
  kind,
  text,
  opens,
  badge: 'workforce-conduct',
  since: since.toISOString(),
  siteId: notice.siteId,
  siteName: notice.siteName,
  waitingOnRole,
  personUserId: notice.personUserId,
  canRemind,
});

/** The sites a viewer's rows may come from: the sites whose new clock is on, narrowed by their scope. */
function visibleSites(subject: AccessSubject, ctx: NeedsYouContext, capability: 'discipline.read_own' | 'discipline.issue' | 'discipline.decide'): string[] {
  const scope = scopeOf(subject, capability);
  if (scope === null) return [];
  if (scope === 'all' || scope === 'own') return [...ctx.enabledSiteIds];
  return ctx.enabledSiteIds.filter((id) => id === subject.siteId);
}

/**
 * The Conduct card rows (spec section 11): notices a person has to sign, notices a manager has to record as not signed, appeals
 * waiting for HR, and appeals on HR-issued notices waiting for the Director. Day 8 of an appeal also lands in the Director's Overdue
 * list. Text names a level, a number and a role: never the reason, the facts or the own line.
 */
export const conductNeedsYouSource: NeedsYouSource = {
  id: 'conduct',
  kinds: ['conduct-sign', 'conduct-record', 'conduct-appeal'],

  async list(subject, ctx) {
    const rows: NeedsYouRow[] = [];
    if (workforceCan(subject, 'discipline.read_own')) {
      const sites = visibleSites(subject, ctx, 'discipline.read_own');
      for (const notice of sites.length ? await repo.toSign(subject.id, sites) : []) {
        rows.push(row('conduct-sign', notice, `${label(notice)} is waiting for you to sign`, `/app/conduct/${notice.id}/sign`, notice.issuedAt, 'SELF', false));
      }
    }
    if (workforceCan(subject, 'discipline.issue')) {
      const sites = visibleSites(subject, ctx, 'discipline.issue');
      for (const notice of sites.length ? await repo.toRecord(subject.id, sites) : []) {
        const ready = notice.personUserId === null || ctx.now >= recordableFrom(notice.issuedAt, notice.ackDays);
        if (ready) rows.push(row('conduct-record', notice, `${label(notice)} was not signed in time: record it`, `/app/workforce/conduct?id=${notice.id}`, recordableFrom(notice.issuedAt, notice.ackDays), 'SELF', false));
      }
    }
    if (workforceCan(subject, 'discipline.decide')) {
      const sites = visibleSites(subject, ctx, 'discipline.decide');
      const byHr = subject.role === 'DIRECTOR';
      for (const notice of sites.length ? await repo.appealsWaiting({ byHr, siteIds: sites, excludeUserId: subject.id }) : []) {
        rows.push(row('conduct-appeal', notice, `An appeal on ${label(notice)} at ${notice.siteName} is waiting for a decision`, `/app/workforce/conduct?status=appealed&id=${notice.id}`, notice.appealedAt ?? notice.issuedAt, byHr ? 'DIRECTOR' : 'HR_MANAGER', false));
      }
    }
    return rows;
  },

  async overdue(ctx) {
    const notices = await repo.overdueAppeals(ctx.enabledSiteIds, ctx.now);
    return notices.map((notice) => row('conduct-appeal', notice, `The appeal on ${label(notice)} at ${notice.siteName} is past its 7 days`, `/app/workforce/conduct?status=appealed&id=${notice.id}`, notice.appealDecisionDueBy ?? notice.issuedAt, issuedByHr(notice) ? 'DIRECTOR' : 'HR_MANAGER', true));
  },

  /** A reminder goes to whoever decides: the Director for an HR-issued notice, HR otherwise. */
  async remindees(needsRow, ctx) {
    const rowKind = needsRow.waitingOnRole;
    return rowKind === 'DIRECTOR' ? directorUserIds(ctx.companyId) : hrUserIds(ctx.companyId);
  },
};
