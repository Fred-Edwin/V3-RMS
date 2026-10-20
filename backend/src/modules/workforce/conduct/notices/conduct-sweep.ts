import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nudgeUsers } from '../../notifications';
import { conductEntry, directorUserIds, hrUserIds, SYSTEM_ACTOR, tellAbout } from '../_shared/conduct-context';
import { overdueDays } from '../_shared/conduct-dates';
import { LEVEL_LABELS, noticeNumberLabel, WITNESS_WAIT_DAYS } from '../_shared/conduct-model';
import { conductNoticesRepository, type ConductNotice } from '../_shared/conduct-notices-repository';
import { statusesAllowing } from '../_shared/conduct-status';
import { sweepRepository } from './sweep-repository';
import { tellWitnessUnconfirmed } from './witness-service';

const BATCH = 200;

export interface ConductSweepReport {
  ended: number;
  directorTold: number;
  witnessesUnconfirmed: number;
}

/** A notice past its end date becomes ENDED, written by the system with its own audit entry. Nobody is told (no noise, spec section 6). */
async function endOne(notice: ConductNotice, now: Date): Promise<boolean> {
  return runAudited<boolean>(async (tx) => {
    const ended = await conductNoticesRepository.transition(tx, notice.companyId, notice.id, statusesAllowing('END'), 'ENDED', { endedAt: now });
    if (!ended) return { result: false, entries: [] };
    await conductNoticesRepository.addEvent(tx, { noticeId: notice.id, at: now, kind: 'ENDED', payload: { validUntil: notice.validUntil.toISOString().slice(0, 10) } });
    return {
      result: true,
      entries: [
        {
          ...conductEntry({ ctx: { companyId: notice.companyId, auditActor: SYSTEM_ACTOR }, siteId: notice.siteId, action: 'conduct.ended', noticeId: notice.id, subjectUserId: notice.personUserId, after: { number: noticeNumberLabel(notice.number), level: notice.level } }),
          channel: 'SYSTEM' as const,
        },
      ],
    };
  });
}

/** The Director is told once that an appeal HR has not decided is overdue; HR is told too (spec C20). */
async function tellOverdue(notice: ConductNotice, now: Date): Promise<boolean> {
  const marked = await runAudited<boolean>(async (tx) => ({ result: (await conductNoticesRepository.patch(tx, notice.companyId, notice.id, { overdueToldAt: null, status: 'APPEALED' }, { overdueToldAt: now })) !== null, entries: [] }));
  if (!marked) return false;
  const [directors, hr] = await Promise.all([directorUserIds(notice.companyId), hrUserIds(notice.companyId)]);
  const late = notice.appealDecisionDueBy ? overdueDays(notice.appealDecisionDueBy, now) : 1;
  const data = { level: LEVEL_LABELS[notice.level], number: noticeNumberLabel(notice.number), days: late, site: notice.siteName, noticeId: notice.id };
  await tellAbout(directors, 'conduct.appeal_overdue', data, `conduct.appeal_overdue:${notice.id}`);
  await tellAbout(hr, 'conduct.appeal_overdue_hr', data, `conduct.appeal_overdue_hr:${notice.id}`);
  nudgeUsers([...directors, ...hr], 'workforce:needs-you');
  return true;
}

/**
 * The daily job (00:10 Nairobi, and safe to run any time): ends notices past their end date, tells the Director about appeals HR left
 * past their day, and tells the issuer and HR about a witness who has been silent for 3 days. Each step is idempotent and one bad
 * notice never stops the rest.
 */
export async function sweepConduct(now: Date = new Date()): Promise<ConductSweepReport> {
  const report: ConductSweepReport = { ended: 0, directorTold: 0, witnessesUnconfirmed: 0 };
  for (const notice of await sweepRepository.endable(now, BATCH)) {
    try {
      if (await endOne(notice, now)) report.ended += 1;
    } catch (error) {
      logger.error({ err: error, noticeId: notice.id }, 'conduct: ending a notice failed');
    }
  }
  for (const notice of await sweepRepository.overdueAppeals(now, BATCH)) {
    try {
      if (await tellOverdue(notice, now)) report.directorTold += 1;
    } catch (error) {
      logger.error({ err: error, noticeId: notice.id }, 'conduct: telling about an overdue appeal failed');
    }
  }
  const cutoff = new Date(now.getTime() - WITNESS_WAIT_DAYS * 86_400_000);
  for (const notice of await sweepRepository.silentWitnesses(cutoff, BATCH)) {
    try {
      await tellWitnessUnconfirmed(notice.companyId, notice);
      report.witnessesUnconfirmed += 1;
    } catch (error) {
      logger.error({ err: error, noticeId: notice.id }, 'conduct: telling about a silent witness failed');
    }
  }
  return report;
}
