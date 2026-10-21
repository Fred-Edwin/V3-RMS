import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { addDays, nairobiClockOf, nairobiDateOf, nairobiToday } from '../../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { wasntMe } from '../../security';
import { rangeOf } from '../audit-range';
import type { MyRecordQuery } from '../audit-validators';
import { myRecordRepository, type RecordFilter } from './my-record-repository';
import { cardRows, categoriesOfChip, chipOfCategory, needsAnswer, whenWords, wordForPerson, type CardRow, type RecordChip } from './my-record-wording';
import type { AuditCategoryCode } from '../../_shared/audit/audit.types';

export interface RecordItem {
  id: string;
  occurredAt: string;
  title: string;
  line: string;
  event: Exclude<RecordChip, 'all'>;
  flagged: boolean;
  needsAnswer: boolean;
  answered?: 'ME' | 'NOT_ME';
}

export interface RecordPage {
  total: number;
  page: number;
  pageSize: number;
  range: { from: string; to: string };
  items: RecordItem[];
}

const allow = (subject: AccessSubject): void => {
  if (!workforceCan(subject, 'audit.read_own')) throw new ForbiddenError('You do not have permission to perform this action');
};

/** The default range of A8 is this month (Nairobi), not the log's 30 days. */
function recordRange(q: Pick<MyRecordQuery, 'from' | 'to'>, now: Date) {
  if (q.from || q.to) return rangeOf(q.from, q.to, now);
  const today = nairobiToday(now);
  return rangeOf(`${today.slice(0, 8)}01`, today, now);
}

/** A8. What was done to my own file. Reading it writes nothing. Another person's rows are never reachable: the user comes from the token. */
export async function myRecord(subject: AccessSubject, q: MyRecordQuery, now: Date = new Date()): Promise<RecordPage> {
  allow(subject);
  const ctx = await resolveActor(subject);
  const range = recordRange(q, now);
  const filter: RecordFilter = { companyId: ctx.companyId, userId: subject.id, categories: categoriesOfChip(q.event), from: range.start, before: range.end };
  const [ids, total] = await Promise.all([myRecordRepository.pageIds(filter, (q.page - 1) * q.pageSize, q.pageSize), myRecordRepository.count(filter)]);
  const [entries, answers] = await Promise.all([myRecordRepository.entries(ctx.companyId, ids), myRecordRepository.answersOf(subject.id, ids)]);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const items = ids.flatMap((id): RecordItem[] => {
    const e = byId.get(id);
    if (!e) return [];
    const word = wordForPerson(e, subject.id);
    const answered = answers.get(id);
    return [{ id, occurredAt: e.occurredAt.toISOString(), title: word.title, line: word.line, event: chipOfCategory(e.category as AuditCategoryCode), flagged: word.flagged, needsAnswer: word.needsAnswer && !answered, ...(answered ? { answered } : {}) }];
  });
  return { total, page: q.page, pageSize: q.pageSize, range: { from: range.from, to: range.to }, items };
}

export interface RecordCard {
  id: string;
  title: string;
  flagged: boolean;
  rows: CardRow[];
  needsAnswer: boolean;
  answered?: 'ME' | 'NOT_ME';
  note: string | null;
}

const NOT_ME_NOTE = 'If this was not you, we sign out every device, you choose a new password, and the System Admin is told straight away.';

/** One entry's card. Own entries only; anything else is the same 404 as a missing id. */
export async function myRecordEntry(subject: AccessSubject, id: string): Promise<RecordCard> {
  allow(subject);
  const ctx = await resolveActor(subject);
  const entry = await myRecordRepository.ownEntry(ctx.companyId, subject.id, id);
  if (!entry) throw new NotFoundError('We could not find that entry.', 'ENTRY_NOT_FOUND');
  const word = wordForPerson(entry, subject.id);
  const answered = (await myRecordRepository.answersOf(subject.id, [id])).get(id);
  const today = nairobiToday(new Date());
  const when = whenWords(nairobiDateOf(entry.occurredAt), nairobiClockOf(entry.occurredAt), today, addDays(today, -1));
  return { id, title: word.title, flagged: word.flagged, rows: cardRows(entry, subject.id, when), needsAnswer: word.needsAnswer && !answered, ...(answered ? { answered } : {}), note: word.needsAnswer ? NOT_ME_NOTE : null };
}

export interface AnswerResult {
  answered: 'ME' | 'NOT_ME';
  alreadyAnswered: boolean;
  signedOut: boolean;
}

export interface AnswerBody {
  answer: 'ME' | 'NOT_ME';
  idempotencyKey: string;
  deviceId?: string | undefined;
}

/**
 * A8. "That was me" stores the answer and one `audit.record_answered` entry in one transaction. "This wasn't me" runs back end A's
 * `wasntMe` (sessions revoked, password and code reset, System Admin alerted), then stores the answer. One answer per entry: pressing
 * again, or the other button, returns the first answer. The same key replays the same result.
 */
export async function answerEntry(subject: AccessSubject, id: string, body: AnswerBody, labels: { deviceLabel: string | null; placeLabel: string | null }): Promise<AnswerResult> {
  allow(subject);
  const ctx = await resolveActor(subject);
  const entry = await myRecordRepository.ownEntry(ctx.companyId, subject.id, id);
  if (!entry || !needsAnswer(entry)) throw new NotFoundError('We could not find that entry.', 'ENTRY_NOT_FOUND');
  const keyed = await myRecordRepository.answerByKey(subject.id, body.idempotencyKey);
  if (keyed) {
    if (keyed.entryId !== id) throw new ConflictError('That key was used for another entry.', 'IDEMPOTENCY_KEY_REUSED');
    return { answered: keyed.answer as 'ME' | 'NOT_ME', alreadyAnswered: true, signedOut: keyed.answer === 'NOT_ME' };
  }
  const existing = await myRecordRepository.answerFor(subject.id, id);
  if (existing) return { answered: existing.answer as 'ME' | 'NOT_ME', alreadyAnswered: true, signedOut: existing.answer === 'NOT_ME' };

  if (body.answer === 'NOT_ME') {
    await wasntMe(subject, { idempotencyKey: body.idempotencyKey, entryId: id, deviceId: body.deviceId }, labels);
    await myRecordRepository.insertAnswerLoose({ entryId: id, userId: subject.id, answer: 'NOT_ME', answerKey: body.idempotencyKey });
    return { answered: 'NOT_ME', alreadyAnswered: false, signedOut: true };
  }
  try {
    await runAudited<void>(async (tx) => {
      await myRecordRepository.insertAnswer(tx, { entryId: id, userId: subject.id, answer: 'ME', answerKey: body.idempotencyKey });
      return {
        result: undefined,
        entries: [{ companyId: ctx.companyId, siteId: subject.siteId ?? null, actor: ctx.auditActor, action: 'audit.record_answered', category: 'SECURITY', subjectType: 'AuditEntry', subjectId: id, subjectUserId: subject.id, after: { answer: 'ME', action: entry.action } }],
      };
    });
  } catch (error) {
    // Two presses at once: the unique key let one through; the other returns that answer.
    if ((error as { code?: string }).code !== 'P2002') throw error;
    const first = await myRecordRepository.answerFor(subject.id, id);
    if (!first) throw error;
    return { answered: first.answer as 'ME' | 'NOT_ME', alreadyAnswered: true, signedOut: first.answer === 'NOT_ME' };
  }
  return { answered: 'ME', alreadyAnswered: false, signedOut: false };
}
