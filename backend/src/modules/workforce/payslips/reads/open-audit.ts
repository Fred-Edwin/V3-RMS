import { runAudited } from '../../_shared/audit/audit-writer';
import type { AuditActor } from '../../_shared/audit/audit.types';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { employeesRepository } from '../../people/employees/employees-repository';
import { told } from '../../people/people-context';
import { claimAlertWindow, insertAlertForEntry, securityEntry, tellAdminsOfAlert, type AlertFacts } from '../../security';
import { payslipEntry } from '../payslips-context';
import type { MonthRecord } from './records';
import { readsRepository, type EmployeeFacts } from './reads-repository';

export type OpenPurpose = 'view' | 'download' | 'share';

export interface OpenFacts {
  companyId: string;
  actor: AuditActor;
  employee: EmployeeFacts;
  record: MonthRecord;
  version: number;
  purpose: OpenPurpose;
  /** The person looking is the person the payslip is about. */
  ownerOpened: boolean;
  deviceLabel: string | null;
  confirmed: boolean | null;
  placeLabel?: string | null;
}

/**
 * Records an opening in the audit log (`payslip.opened`), in its own transaction: who, which payslip number and version, why (view,
 * download, share), on which phone, and whether it was the owner. Never an amount. The person sees every opening under Activity on
 * my record (the entry names them as `subjectUserId`).
 *
 * When someone else opens it (HR, the Accountant), the Director's daily digest is bumped in the same transaction (PD5): one row per
 * opener per day. The Director is told once a day per opener (on the first opening); the running count is on the digest.
 */
export async function recordOpening(f: OpenFacts, now: Date = new Date()): Promise<void> {
  const day = nairobiToday(now);
  const ownerId = f.employee.userId;
  const unconfirmed = f.ownerOpened && f.confirmed === false && ownerId !== null;
  const alertFacts: AlertFacts = { companyId: f.companyId, siteId: f.employee.siteId, kind: 'UNCONFIRMED_PHONE', subjectUserId: f.employee.userId, deviceLabel: f.deviceLabel, placeLabel: f.placeLabel ?? null, detail: f.record.monthKey, at: now };
  let raised: boolean = false;
  const count = await runAudited<number>(async (tx) => {
    const n = f.ownerOpened ? 0 : await readsRepository.bumpDigest(tx, f.companyId, f.actor.id ?? '', day, now);
    // 6a S1: an opening on an unconfirmed phone raises one alert per person and 15 minutes, written with its own entry here.
    raised = unconfirmed && ownerId !== null && (await claimAlertWindow(tx, ownerId, 'UNCONFIRMED_PHONE', now));
    const alertEntry = raised && ownerId !== null
      ? [securityEntry({ companyId: f.companyId, siteId: f.employee.siteId, actor: f.actor, action: 'security.payslip_unconfirmed_phone', subjectType: 'User', subjectId: ownerId, subjectUserId: ownerId, after: { month: f.record.monthKey, device: f.deviceLabel }, deviceLabel: f.deviceLabel, placeLabel: f.placeLabel ?? null })]
      : [];
    return {
      result: n,
      afterWrite: async (inner, records) => {
        const entry = records[1];
        if (raised && entry) await insertAlertForEntry(inner, alertFacts, entry.id);
      },
      entries: [
        payslipEntry({
          companyId: f.companyId, siteId: f.employee.siteId, actor: f.actor, action: 'payslip.opened', category: 'PAYSLIP_ACCESS', subjectType: 'Payslip', subjectId: f.record.first.id, subjectUserId: f.employee.userId,
          after: { number: f.record.first.documentNumber, month: f.record.monthKey, version: f.version, purpose: f.purpose, openerRole: f.actor.role, ownerOpened: f.ownerOpened, confirmed: f.confirmed === true, unconfirmed: f.confirmed === false },
          deviceLabel: f.deviceLabel,
        }),
        ...alertEntry,
      ],
    };
  });
  if (raised as boolean) {
    // Gated by "Start alerts" (SD13): until it is pressed the opening is recorded and flagged, and nobody is told.
    if (await tellAdminsOfAlert(alertFacts)) await told([f.employee.userId], 'payslip.on_unconfirmed_phone', { device: f.deviceLabel, at: now.toISOString() });
  }
  if (count === 1) {
    const directors = await employeesRepository.userIdsByRole(f.companyId, 'DIRECTOR');
    await told(directors, 'payslip.opened_by_staff', { openerId: f.actor.id, openerRole: f.actor.role, day });
  }
}
