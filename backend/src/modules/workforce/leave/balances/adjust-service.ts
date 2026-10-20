import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { applicationsRepository } from '../data/applications-repository';
import { ledgerRepository } from '../data/ledger-repository';
import { dbOf, peopleRepository, type LeavePerson } from '../data/people-repository';
import { leaveYearOf } from '../engine/leave-days';
import { asJson, leaveEntry } from '../leave-audit';
import { tell } from '../leave-notify';
import type { AdjustBody } from '../leave-validators';
import { nameAndRole } from '../leave-words';
import { resolveActor } from '../../people/people-context';
import { balancesOf } from './balance-service';

export interface AdjustPreview {
  employeeId: string;
  typeCode: string;
  typeLabel: string;
  /** Days left now and what they would be after (the preview with no `add` returns the same figure twice). */
  now: number;
  new: number;
  /** Who is told, as "Name, Role". */
  told: { name: string; label: string }[];
  errors: { code: string; message: string }[];
}

export interface AdjustResult {
  employeeId: string;
  typeCode: string;
  before: number;
  after: number;
  repeat: boolean;
}

async function target(subject: AccessSubject, employeeId: string): Promise<{ person: LeavePerson; companyId: string }> {
  const ctx = await resolveActor(subject);
  const person = await peopleRepository.byId(ctx.companyId, employeeId);
  if (!person) throw new NotFoundError('That person was not found', 'PERSON_NOT_FOUND');
  return { person, companyId: ctx.companyId };
}

/** The days left now for one adjustable type, or an error code when the type cannot be adjusted for this person. */
async function leftOf(person: LeavePerson, typeCode: string, now: Date, tx?: Parameters<typeof balancesOf>[3]): Promise<{ left: number; label: string } | { error: { code: string; message: string } }> {
  if (person.isCasual) return { error: { code: 'CASUAL_NO_LEAVE', message: 'Leave starts when the contract starts.' } };
  const balances = await balancesOf(person, leaveYearOf(nairobiToday(now)), now, tx);
  const type = balances.requestable.find((entry) => entry.code === typeCode);
  if (!type || type.left === null) return { error: { code: 'TYPE_NOT_ADJUSTABLE', message: 'This person has no balance for that kind of leave.' } };
  return { left: type.left, label: type.label };
}

/** The preview (B3): the figure now and after, who is told, and what would be refused. Writes nothing. */
export async function previewAdjust(subject: AccessSubject, body: { employeeId: string; typeCode: string; add?: number | undefined }, now: Date = new Date()): Promise<AdjustPreview> {
  const { person } = await target(subject, body.employeeId);
  const found = await leftOf(person, body.typeCode, now);
  if ('error' in found) return { employeeId: person.id, typeCode: body.typeCode, typeLabel: body.typeCode, now: 0, new: 0, told: [], errors: [found.error] };
  const add = body.add ?? 0;
  const errors: AdjustPreview['errors'] = [];
  if (body.add !== undefined && found.left + add < 0) errors.push({ code: 'BALANCE_BELOW_ZERO', message: 'That would leave the balance below 0 days.' });
  if (person.userId === subject.id) errors.push({ code: 'OWN_BALANCE', message: 'Another person adjusts your balance.' });
  return { employeeId: person.id, typeCode: body.typeCode, typeLabel: found.label, now: found.left, new: Math.max(0, found.left + add), told: person.userId ? [{ name: person.name, label: nameAndRole(person.name, person.positionName, person.role) }] : [], errors };
}

/**
 * Adjust a balance (B3, L25 and L26): HR only, a signed act. Whole days from -60 to +60, never below 0 days after. A reason chip is
 * required (a note too for "Other"). Writes one ADJUSTMENT ledger line (never edits one) and the audit entry in one transaction, after
 * a lock on the person so two adjustments cannot both pass. `expectedNow` stops a stale screen from overwriting a newer figure. The
 * same Idempotency-Key returns the first result. Nothing already taken is changed.
 */
export async function adjustBalance(subject: AccessSubject, body: AdjustBody, key: string, now: Date = new Date()): Promise<AdjustResult> {
  const { person, companyId } = await target(subject, body.employeeId);
  const earlier = await ledgerRepository.byKey(dbOf(), person.id, key);
  if (earlier) return { employeeId: person.id, typeCode: earlier.typeCode, before: 0, after: 0, repeat: true };
  if (person.userId === subject.id) throw new ForbiddenError('Another person adjusts your balance.', 'OWN_BALANCE');

  const found = await leftOf(person, body.typeCode, now);
  if ('error' in found) throw new ConflictError(found.error.message, found.error.code);
  if (found.left + body.add < 0) throw new ConflictError('That would leave the balance below 0 days.', 'BALANCE_BELOW_ZERO', { now: found.left });
  if (body.expectedNow !== undefined && body.expectedNow !== found.left) throw new ConflictError('This balance changed a moment ago. Check the new figure.', 'BALANCE_CHANGED', { now: found.left });
  await verifySignerPin(subject.id, body.pin, now.getTime());

  const ctx = await resolveActor(subject);
  const today = nairobiToday(now);
  const done = await runAudited<AdjustResult>(async (tx) => {
    await applicationsRepository.lockPerson(tx, person.id);
    const again = await ledgerRepository.byKey(tx, person.id, key);
    if (again) return { result: { employeeId: person.id, typeCode: again.typeCode, before: 0, after: 0, repeat: true }, entries: [] };
    const fresh = await leftOf(person, body.typeCode, now, tx);
    if ('error' in fresh) throw new ConflictError(fresh.error.message, fresh.error.code);
    if (fresh.left + body.add < 0) throw new ConflictError('That would leave the balance below 0 days.', 'BALANCE_BELOW_ZERO', { now: fresh.left });
    if (body.expectedNow !== undefined && body.expectedNow !== fresh.left) throw new ConflictError('This balance changed a moment ago. Check the new figure.', 'BALANCE_CHANGED', { now: fresh.left });
    if (body.reasonCode === 'OTHER' && !body.note) throw new ValidationError('Say why, in a few words.', 'NOTE_REQUIRED');
    await ledgerRepository.add(tx, { companyId, employeeId: person.id, typeCode: body.typeCode, year: leaveYearOf(today), kind: 'ADJUSTMENT', days: body.add, asOf: today, reasonCode: body.reasonCode, reasonNote: body.note || null, byUser: subject.id, idempotencyKey: key });
    const entry = leaveEntry({
      companyId, siteId: person.siteId, actor: ctx.auditActor, action: 'leave.balance_adjusted', subjectType: 'LeaveBalance', subjectId: person.id, userId: person.userId,
      before: asJson({ type: body.typeCode, left: fresh.left }),
      after: asJson({ type: body.typeCode, left: fresh.left + body.add, add: body.add, reasonCode: body.reasonCode, noteGiven: Boolean(body.note), method: 'PIN' }),
      reason: body.reasonCode,
    });
    return { result: { employeeId: person.id, typeCode: body.typeCode, before: fresh.left, after: fresh.left + body.add, repeat: false }, entries: [entry] };
  });

  if (!done.repeat) await tell([person.userId], 'leave.balance_adjusted', { id: person.id });
  return done;
}
