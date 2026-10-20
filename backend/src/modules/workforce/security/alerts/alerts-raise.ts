import type { Prisma } from '@prisma/client';
import { employeesRepository } from '../../people/employees/employees-repository';
import { nudgeUsers, notifyMany } from '../../notifications';
import { ALERT_WINDOW_MS, ALERT_WORDING, type AlertKind } from '../security-types';
import { alertsRepository } from './alerts-repository';

export interface AlertFacts {
  companyId: string;
  siteId: string | null;
  kind: AlertKind;
  subjectUserId: string | null;
  deviceId?: string | null;
  deviceLabel?: string | null;
  placeLabel?: string | null;
  /** A month name or an entry number. Never an amount, a code or a payslip number. */
  detail?: string | null;
  at: Date;
}

/**
 * Step 1 of raising an alert, inside the transaction that writes the audit entry: is this person and kind free inside the 15 minute
 * window? False = an alert for it already exists, so write neither a second alert nor its entry. Holds a lock until commit.
 */
export const claimAlertWindow = (tx: Prisma.TransactionClient, subjectUserId: string, kind: AlertKind, at: Date): Promise<boolean> =>
  alertsRepository.claimWindow(tx, subjectUserId, kind, new Date(at.getTime() - ALERT_WINDOW_MS));

/** Step 2, in the same transaction after the entry is written: the alert row, carrying the entry's id. */
export async function insertAlertForEntry(tx: Prisma.TransactionClient, f: AlertFacts, auditEntryId: string): Promise<void> {
  await alertsRepository.insert(tx, {
    companyId: f.companyId,
    siteId: f.siteId,
    kind: f.kind,
    subjectUserId: f.subjectUserId,
    deviceId: f.deviceId ?? null,
    deviceLabel: f.deviceLabel ?? null,
    placeLabel: f.placeLabel ?? null,
    detail: f.detail ?? null,
    occurredAt: f.at,
    auditEntryId,
  });
}

/** Has the System Admin pressed "Start alerts"? Until then an unconfirmed-phone opening is recorded and flagged but nobody is told (SD13). */
export const alertsStarted = async (companyId: string): Promise<boolean> => (await alertsRepository.settingOf(companyId))?.alertsStartedAt != null;

/**
 * Step 3, after the transaction has committed: tell the System Admins (an Inbox row with a push) and nudge their Needs you card.
 * One notification per person, kind and 15 minutes. Best effort, never throws. Returns false when the gate held it back.
 */
export async function tellAdminsOfAlert(f: AlertFacts): Promise<boolean> {
  try {
    if (f.kind === 'UNCONFIRMED_PHONE' && !(await alertsStarted(f.companyId))) return false;
    const [admins, names] = await Promise.all([employeesRepository.userIdsByRole(f.companyId, 'SYSTEM_ADMIN'), f.subjectUserId ? alertsRepository.namesOf([f.subjectUserId]) : Promise.resolve(new Map())]);
    const person = f.subjectUserId ? names.get(f.subjectUserId) : undefined;
    const data = { name: person?.name ?? null, role: person?.role ?? null, month: f.detail ?? null, seq: f.detail ?? null, device: f.deviceLabel ?? null, place: f.placeLabel ?? null, at: f.at.toISOString() };
    const bucket = Math.floor(f.at.getTime() / ALERT_WINDOW_MS);
    await notifyMany(admins, ALERT_WORDING[f.kind], data, { dedupeKey: `alert:${f.kind}:${f.subjectUserId ?? 'company'}:${bucket}` });
    nudgeUsers(admins, 'workforce:needs-you');
    return true;
  } catch {
    return false;
  }
}
