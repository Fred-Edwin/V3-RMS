import { appealDeadline, isInsideEndDate, signLimitDate } from '../_shared/conduct-dates';
import { shortDay } from '../_shared/conduct-format';
import { ABOUT_LABELS, hasLetter, LEVEL_LABELS, noticeNumberLabel, type ConductStatus } from '../_shared/conduct-model';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import { APPEALABLE_STATUSES, isLive, tryNextStatus } from '../_shared/conduct-status';

/** The status a reader sees: a live notice past its end date reads as Ended even before the 00:10 job stores it. An appeal stands until decided. */
export function effectiveStatus(notice: Pick<ConductNotice, 'status' | 'validUntil'>, now: Date): ConductStatus {
  if (notice.status === 'APPEALED') return 'APPEALED';
  return isLive(notice.status) && !isInsideEndDate(notice.validUntil, now) ? 'ENDED' : notice.status;
}

export const isActiveNow = (notice: Pick<ConductNotice, 'status' | 'validUntil'>, now: Date): boolean => isLive(effectiveStatus(notice, now));

/** The word on a row for the manager and HR (spec S8). */
export const STATUS_WORDS: Record<ConductStatus, string> = {
  ISSUED: 'Issued',
  RECORDED: 'Recorded',
  SIGNED: 'Signed',
  GIVEN_NOT_SIGNED: 'Given, not signed',
  APPEALED: 'Appealed',
  KEPT: 'Kept on appeal',
  REPLACED: 'Replaced',
  WITHDRAWN: 'Withdrawn',
  ENDED: 'Ended',
};

/** The word on a row for the staff member (spec S1): "To sign" instead of "Issued". */
export const staffStatusWord = (status: ConductStatus): string => (status === 'ISSUED' ? 'To sign' : STATUS_WORDS[status]);

export interface NoticeActions {
  canSign: boolean;
  canAppeal: boolean;
  canDownload: boolean;
}

/** What the subject may do now. A notice made by a reduction gives no appeal; a replaced or withdrawn one gives nothing. */
export function subjectActions(notice: ConductNotice, now: Date): NoticeActions {
  const status = effectiveStatus(notice, now);
  const live = isLive(status) && notice.personUserId !== null;
  return {
    canSign: live && hasLetter(notice.level) && !notice.signedAt && tryNextStatus(notice.status, 'SIGN') !== null,
    canAppeal:
      isLive(status) &&
      notice.appealedAt === null &&
      notice.replacesNoticeId === null &&
      notice.appealDays > 0 &&
      APPEALABLE_STATUSES.includes(notice.status) &&
      now <= appealDeadline(notice.issuedAt, notice.appealDays),
    canDownload: hasLetter(notice.level),
  };
}

/** The headline of a notice for lists: "Late arrival", "Written warning · WRN-0007". */
export const titleOf = (notice: Pick<ConductNotice, 'level' | 'number'>): string => {
  const number = noticeNumberLabel(notice.number);
  return number ? `${LEVEL_LABELS[notice.level]} · ${number}` : LEVEL_LABELS[notice.level];
};

export const aboutLabelOf = (notice: Pick<ConductNotice, 'about'>): string => ABOUT_LABELS[notice.about];

/** "Until Fri 16 Oct": the appeal window's last day. */
export const appealUntilLabel = (notice: ConductNotice): string => shortDay(appealDeadline(notice.issuedAt, notice.appealDays));

/** "By Mon 12 Oct": the last day to sign. */
export const signByLabel = (notice: ConductNotice): string => {
  const limit = signLimitDate(notice.issuedAt, notice.ackDays);
  return shortDay(new Date(`${limit}T12:00:00+03:00`));
};
