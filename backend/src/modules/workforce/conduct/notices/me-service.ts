import { conductActor } from '../_shared/conduct-context';
import { dayMonthYear, shortDay } from '../_shared/conduct-format';
import { ABOUT_LABELS, hasLetter, noticeNumberLabel, type ConductStatus } from '../_shared/conduct-model';
import { conductNoticesRepository, type ConductNotice } from '../_shared/conduct-notices-repository';
import { legacyRepository } from '../rollout/legacy-repository';
import type { AccessSubject } from '../../_shared/workforce-access';
import { effectiveStatus, staffStatusWord, subjectActions, titleOf } from './notice-view';

export interface StaffItem {
  id: string;
  level: string;
  number: string | null;
  title: string;
  aboutLabel: string;
  issuedAt: string;
  validUntil: string;
  validUntilLabel: string;
  status: ConductStatus;
  statusWord: string;
  headline: string;
  canSign: boolean;
  canAppeal: boolean;
  hasLetter: boolean;
  replacedById: string | null;
}

export interface StaffList {
  /** Three figures, chosen by the state of the file (S7). */
  counts: { toSign: number; canAppeal: number; ended: number; appealed: number; replaced: number; withdrawn: number };
  columns: { key: string; label: string; value: number }[];
  headline: string;
  items: StaffItem[];
  legacy: { id: string; level: string; actionDate: string; label: string }[];
}

const PRIORITY = ['canAppeal', 'appealed', 'replaced', 'withdrawn', 'ended'] as const;
const LABELS: Record<string, string> = { toSign: 'TO SIGN', canAppeal: 'CAN APPEAL', appealed: 'APPEALED', replaced: 'REPLACED', withdrawn: 'WITHDRAWN', ended: 'ENDED' };

/** The three stat columns (S7): TO SIGN first when something waits; then the highest non-zero of the rest; filled with TO SIGN and CAN APPEAL. */
export function chooseColumns(counts: StaffList['counts']): StaffList['columns'] {
  const keys: string[] = [];
  if (counts.toSign > 0) keys.push('toSign');
  for (const key of [...PRIORITY].sort((a, b) => counts[b] - counts[a])) if (counts[key] > 0 && keys.length < 3) keys.push(key);
  for (const key of ['toSign', 'canAppeal', 'ended']) if (!keys.includes(key) && keys.length < 3) keys.push(key);
  return keys.slice(0, 3).map((key) => ({ key, label: LABELS[key] ?? key, value: counts[key as keyof StaffList['counts']] }));
}

const headlineOf = (notice: ConductNotice | undefined): string => (notice ? `active · ${notice.level === 'VERBAL_NOTE' ? 'verbal note' : titleOf(notice).split(' · ')[0]?.toLowerCase()} until ${dayMonthYear(notice.validUntil)}` : 'nothing active on your file');

/**
 * The staff member's own notices (S1, S7), newest first, a notice waiting to be signed on top. Never the issuer's own line, the facts
 * or the appeal text. Old HR records appear below, read only, marked "Before the new system", and never count.
 */
export async function myNotices(subject: AccessSubject, now: Date = new Date()): Promise<StaffList> {
  const ctx = await conductActor(subject, 'discipline.read_own');
  const notices = await conductNoticesRepository.forUser(ctx.companyId, subject.id);
  const rank = (notice: ConductNotice): number => (subjectActions(notice, now).canSign ? 0 : 1);
  const ordered = [...notices].sort((a, b) => rank(a) - rank(b) || b.issuedAt.getTime() - a.issuedAt.getTime());
  const counts = { toSign: 0, canAppeal: 0, ended: 0, appealed: 0, replaced: 0, withdrawn: 0 };
  const items = ordered.map<StaffItem>((notice) => {
    const status = effectiveStatus(notice, now);
    const actions = subjectActions(notice, now);
    if (actions.canSign) counts.toSign += 1;
    if (actions.canAppeal) counts.canAppeal += 1;
    if (status === 'ENDED') counts.ended += 1;
    if (status === 'APPEALED') counts.appealed += 1;
    if (status === 'REPLACED') counts.replaced += 1;
    if (status === 'WITHDRAWN') counts.withdrawn += 1;
    return {
      id: notice.id,
      level: notice.level,
      number: noticeNumberLabel(notice.number),
      title: titleOf(notice),
      aboutLabel: ABOUT_LABELS[notice.about],
      issuedAt: notice.issuedAt.toISOString(),
      validUntil: notice.validUntil.toISOString().slice(0, 10),
      validUntilLabel: dayMonthYear(notice.validUntil),
      status,
      statusWord: staffStatusWord(status),
      headline: `${ABOUT_LABELS[notice.about]} · ${shortDay(notice.issuedAt)} · ends ${dayMonthYear(notice.validUntil)}${hasLetter(notice.level) ? '' : ' · no letter'}`,
      canSign: actions.canSign,
      canAppeal: actions.canAppeal,
      hasLetter: actions.canDownload,
      replacedById: notice.replacedById,
    };
  });
  const live = ordered.find((notice) => ['SIGNED', 'RECORDED', 'ISSUED', 'GIVEN_NOT_SIGNED', 'KEPT'].includes(effectiveStatus(notice, now)));
  return {
    counts,
    columns: chooseColumns(counts),
    headline: headlineOf(live),
    items,
    legacy: await legacyRepository.forUser(subject.id),
  };
}
