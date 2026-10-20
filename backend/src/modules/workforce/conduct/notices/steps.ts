import { appealDeadline } from '../_shared/conduct-dates';
import { dayMonthYear, shortDay, shortDayTime } from '../_shared/conduct-format';
import { hasLetter } from '../_shared/conduct-model';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import { effectiveStatus, signByLabel } from './notice-view';

export type StepState = 'done' | 'current' | 'todo' | 'amber';

export interface NoticeStep {
  key: 'issued' | 'sign' | 'appeal' | 'decided' | 'ends' | 'recorded' | 'replaced';
  state: StepState;
  title: string;
  line: string;
}

export interface DecisionLine {
  outcome: 'KEEP' | 'REDUCE_TO_WRITTEN' | 'REDUCE_TO_VERBAL' | 'WITHDRAW';
  decidedAt: Date;
}

const OUTCOME_WORDS: Record<DecisionLine['outcome'], string> = {
  KEEP: 'kept the notice',
  REDUCE_TO_WRITTEN: 'reduced it to a written warning',
  REDUCE_TO_VERBAL: 'reduced it to a verbal note',
  WITHDRAW: 'withdrew the notice',
};

/**
 * The stepper the staff phone draws (S2), derived from the status machine on the server so the dates are never computed on the phone.
 * Issued (always done) → sign (letters only) → appeal → HR decided → ends by itself. A verbal note has no sign step.
 */
export function buildSteps(notice: ConductNotice, decision: DecisionLine | null, now: Date): NoticeStep[] {
  const status = effectiveStatus(notice, now);
  const steps: NoticeStep[] = [];
  const finished = status === 'REPLACED' || status === 'WITHDRAWN' || status === 'ENDED';

  if (hasLetter(notice.level)) {
    steps.push({ key: 'issued', state: 'done', title: 'Issued to you', line: `${shortDayTime(notice.issuedAt)} · signed by your ${notice.issuerRole}` });
    if (notice.signedAt) {
      steps.push({ key: 'sign', state: 'done', title: 'You signed that you received it', line: `${shortDayTime(notice.signedAt)} · with your code` });
    } else if (notice.notSignedRecordedAt) {
      steps.push({ key: 'sign', state: 'amber', title: 'Given, not signed', line: `Recorded on ${shortDay(notice.notSignedRecordedAt)} by your ${notice.issuerRole}, with a witness` });
    } else {
      steps.push({ key: 'sign', state: finished ? 'todo' : 'current', title: 'Sign that you received it', line: `By ${signByLabel(notice)} · this does not mean you agree` });
    }
  } else {
    steps.push({ key: 'recorded', state: 'done', title: 'Recorded on your file', line: `${shortDayTime(notice.issuedAt)} · by your ${notice.issuerRole}` });
  }

  if (notice.replacesNoticeId === null && notice.appealDays > 0) {
    const closes = appealDeadline(notice.issuedAt, notice.appealDays);
    if (notice.appealedAt) {
      steps.push({ key: 'appeal', state: 'done', title: 'You appealed', line: `${shortDayTime(notice.appealedAt)} · HR has it` });
    } else if (now > closes || finished) {
      steps.push({ key: 'appeal', state: 'todo', title: 'Appeal days ended', line: `Ended ${shortDay(closes)}` });
    } else {
      steps.push({ key: 'appeal', state: 'current', title: 'You can appeal', line: `Until ${shortDay(closes)} · HR decides, not your manager` });
    }
  }

  if (decision) {
    steps.push({ key: 'decided', state: 'done', title: 'HR decided', line: `${shortDayTime(decision.decidedAt)} · HR ${OUTCOME_WORDS[decision.outcome]}` });
  } else if (notice.appealedAt && status === 'APPEALED') {
    steps.push({ key: 'decided', state: 'current', title: 'HR will decide', line: 'You will be told here' });
  }

  if (status === 'REPLACED') steps.push({ key: 'replaced', state: 'done', title: 'Replaced on appeal', line: 'A new notice took its place' });
  else if (status === 'WITHDRAWN') steps.push({ key: 'ends', state: 'done', title: 'Withdrawn', line: 'It no longer counts and stays on your file' });
  else steps.push({ key: 'ends', state: status === 'ENDED' ? 'done' : 'todo', title: status === 'ENDED' ? 'Ended' : 'Ends by itself', line: `${dayMonthYear(notice.validUntil)} · ${notice.validForMonths} months, kept on your file` });
  return steps;
}
