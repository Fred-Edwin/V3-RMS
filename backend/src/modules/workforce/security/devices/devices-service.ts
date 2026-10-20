import type { WorkforceDevice } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AccessSubject } from '../../_shared/workforce-access';
import { notify } from '../../notifications';
import { securityActor, securityEntry } from '../security-context';
import { ONCE_CONFIRMATION_MS } from '../security-types';
import { devicesRepository, hashDeviceId } from './devices-repository';

export const FIVE_PHONES = 5;
const UNUSED_MS = 365 * 86_400_000;

/** Confirmed means the person said yes, and a "just once" yes has not run out. A phone that was removed is never confirmed. */
export function isConfirmedDevice(d: Pick<WorkforceDevice, 'confirmedAt' | 'confirmedMode' | 'removedAt'>, now: Date): boolean {
  if (d.removedAt !== null || d.confirmedAt === null) return false;
  return d.confirmedMode !== 'ONCE' || now.getTime() - d.confirmedAt.getTime() < ONCE_CONFIRMATION_MS;
}

const present = (d: WorkforceDevice, currentHash: string | null, now: Date) => ({
  id: d.id,
  label: d.label,
  placeLabel: d.placeLabel,
  firstSeenAt: d.firstSeenAt.toISOString(),
  lastSeenAt: d.lastSeenAt.toISOString(),
  confirmed: isConfirmedDevice(d, now),
  confirmedMode: d.confirmedMode as 'REMEMBER' | 'ONCE' | null,
  isThisPhone: currentHash !== null && d.deviceIdHash === currentHash,
  notUsedFor12Months: now.getTime() - d.lastSeenAt.getTime() > UNUSED_MS,
});

export interface SeenInput {
  deviceId: string;
  label: string;
  placeLabel: string | null;
}

/**
 * A phone calls this after it signs in. A phone not seen before (or removed and back) is recorded, written to Activity on my
 * record (`security.phone_first_seen`) and, when the person already has other phones, they are told. The answer says whether to show
 * "Is this your phone?" (the shell blocks until it is answered). Sign-in itself is the old auth code, so this is a separate call.
 */
export async function phoneSeen(subject: AccessSubject, input: SeenInput, now: Date = new Date()) {
  const ctx = await securityActor(subject, 'security.phones.own');
  const others = await devicesRepository.countActive(subject.id);
  const seen = await runAudited<Awaited<ReturnType<typeof devicesRepository.seen>>>(async (tx) => {
    const result = await devicesRepository.seen(tx, subject.id, input.deviceId, input.label, input.placeLabel, now);
    return {
      result,
      entries: result.created
        ? [securityEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'security.phone_first_seen', subjectType: 'Device', subjectId: result.device.id, subjectUserId: subject.id, after: { label: input.label }, deviceLabel: input.label, placeLabel: input.placeLabel })]
        : [],
    };
  });
  if (seen.created && others > 0) await notify(subject.id, 'security.new_phone', { device: input.label, place: input.placeLabel, at: now.toISOString() }, { dedupeKey: `new-phone:${seen.device.id}:${now.toISOString().slice(0, 10)}` });
  const confirmed = isConfirmedDevice(seen.device, now);
  return { phone: present(seen.device, hashDeviceId(input.deviceId), now), phoneQuestion: !confirmed, firstPhone: seen.created && others === 0 };
}

/** "My phones": this phone first, then by last use. A person with five or more phones gets a count to warn on. */
export async function listPhones(subject: AccessSubject, currentDeviceId: string | null, now: Date = new Date()) {
  await securityActor(subject, 'security.phones.own');
  const rows = await devicesRepository.listActive(subject.id);
  const currentHash = currentDeviceId ? hashDeviceId(currentDeviceId) : null;
  const phones = rows.map((d) => present(d, currentHash, now)).sort((a, b) => Number(b.isThisPhone) - Number(a.isThisPhone));
  return { phones, total: phones.length, manyPhones: phones.length >= FIVE_PHONES ? phones.length : null };
}

async function confirmDevice(subject: AccessSubject, device: WorkforceDevice, mode: 'REMEMBER' | 'ONCE', now: Date) {
  const ctx = await securityActor(subject, 'security.phones.own');
  if (device.confirmedAt !== null && device.confirmedMode === mode && isConfirmedDevice(device, now)) return device; // already so: nothing to write
  return runAudited<WorkforceDevice>(async (tx) => ({
    result: await devicesRepository.confirm(tx, device.id, mode, now),
    entries: [securityEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'security.phone_confirmed', subjectType: 'Device', subjectId: device.id, subjectUserId: subject.id, after: { label: device.label, mode }, deviceLabel: device.label })],
  }));
}

/** The answer to "Is this your phone?": REMEMBER keeps it confirmed, ONCE counts only for this session. Idempotent. */
export async function answerCurrentPhone(subject: AccessSubject, deviceId: string, answer: 'REMEMBER' | 'ONCE', now: Date = new Date()) {
  const device = await devicesRepository.findByHash(subject.id, deviceId);
  if (!device || device.removedAt !== null) throw new NotFoundError('We could not find that phone.', 'PHONE_NOT_FOUND');
  return present(await confirmDevice(subject, device, answer, now), hashDeviceId(deviceId), now);
}

/** "Yes, this is my phone" on a listed phone. Another person's phone id is a 404. */
export async function confirmPhone(subject: AccessSubject, id: string, currentDeviceId: string | null, now: Date = new Date()) {
  const device = await devicesRepository.findOwn(subject.id, id);
  if (!device) throw new NotFoundError('We could not find that phone.', 'PHONE_NOT_FOUND');
  return present(await confirmDevice(subject, device, 'REMEMBER', now), currentDeviceId ? hashDeviceId(currentDeviceId) : null, now);
}

/**
 * Removes a phone: from then on every Workforce call from it is refused (`PHONE_REMOVED`, see the session gate) and it is asked
 * again when it comes back. This phone cannot be removed from itself ("Sign out instead"). Removing a removed phone is a no-op.
 */
export async function removePhone(subject: AccessSubject, id: string, currentDeviceId: string | null, now: Date = new Date()): Promise<{ removed: true }> {
  const ctx = await securityActor(subject, 'security.phones.own');
  const device = await devicesRepository.findOwn(subject.id, id);
  if (!device) throw new NotFoundError('We could not find that phone.', 'PHONE_NOT_FOUND');
  if (currentDeviceId && hashDeviceId(currentDeviceId) === device.deviceIdHash) throw new ConflictError('Sign out instead of removing the phone you are using.', 'THIS_PHONE');
  await runAudited<void>(async (tx) => {
    const done = await devicesRepository.remove(tx, subject.id, id, now);
    return {
      result: undefined,
      entries: done.count === 1 ? [securityEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'security.phone_removed', subjectType: 'Device', subjectId: id, subjectUserId: subject.id, after: { label: device.label }, deviceLabel: device.label })] : [],
    };
  });
  return { removed: true };
}

/** What the payslip code asks: true confirmed, false a phone that is not (known or not). An absent id is an unconfirmed phone. */
export async function confirmationOf(userId: string, deviceId: string, now: Date = new Date()): Promise<boolean> {
  const device = await devicesRepository.findByHash(userId, deviceId);
  return device !== null && isConfirmedDevice(device, now);
}
