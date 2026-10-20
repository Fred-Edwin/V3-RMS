import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AuditEntryInput } from '../../_shared/audit/audit.types';
import { carryLegacyLeave, mirrorLegacyLeave } from '../../leave/carry/carry-service';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { eventOf, timeEntry } from '../attendance-audit';
import { daysRepository } from '../days/days-repository';
import { carryLegacyIn, mirrorBack, openLegacyClockIns } from './switch-carry';
import { assertMaySwitchOff } from './switch-off-check';
import { switchRepository, type SwitchRow } from './switch-repository';

export interface SwitchView {
  siteId: string;
  siteName: string;
  enabled: boolean;
  enabledAt: string | null;
  changedAt: string | null;
  /** Set by the call that changed the switch: what crossed over. */
  carriedFromLegacy?: number;
  mirroredToLegacy?: number;
  /** People whose clock today the legacy tables cannot show (they clocked on a shift only the new rota knows). */
  notMirrored?: string[];
}

const viewOf = (siteId: string, siteName: string, row: SwitchRow | null): SwitchView => ({
  siteId,
  siteName,
  enabled: row?.enabled ?? false,
  enabledAt: row?.enabledAt?.toISOString() ?? null,
  changedAt: row?.changedAt.toISOString() ?? null,
});

async function siteOr404(siteId: string) {
  const site = await daysRepository.siteFacts(siteId);
  if (!site) throw new NotFoundError('Site not found');
  return site;
}

export async function getSwitch(siteId: string): Promise<SwitchView> {
  const site = await siteOr404(siteId);
  return viewOf(siteId, site.name, await switchRepository.get(siteId));
}

/**
 * S3: the switch of every site the caller can read the board for (a company-wide role sees all active sites, everyone else just
 * their own). The menu uses it to show the new pages only where a site is on, and the Director's switch screen lists it.
 */
export async function listSwitches(subject: AccessSubject): Promise<SwitchView[]> {
  const scope = scopeOf(subject, 'today.read');
  if (scope === null || scope === 'own') throw new ForbiddenError('You do not have permission to perform this action');
  if (scope !== 'all' && !subject.siteId) throw new ForbiddenError('You do not have permission to perform this action');
  const rows = await switchRepository.sitesWithSwitch(scope === 'all' ? null : [subject.siteId as string]);
  return rows.map(({ site, row }) => viewOf(site.id, site.name, row));
}

/**
 * Turn a site's new clock on or off (decision A1). On: refused while anyone is clocked in on the legacy clock today;
 * today's finished legacy records are carried across as events. Off: today's new clocks that map to a legacy
 * assignment are written as legacy records so the legacy clock can carry on from them. Asking for the state a site is
 * already in changes nothing and writes nothing. The audit entry and the carry happen in one transaction.
 */
export async function setSwitch(subject: AccessSubject, siteId: string, enabled: boolean, now: Date = new Date()): Promise<SwitchView> {
  const ctx = await resolveActor(subject);
  const site = await siteOr404(siteId);
  const today = nairobiToday(now);

  return runAudited(async (tx) => {
    const current = await switchRepository.get(siteId, tx);
    if ((current?.enabled ?? false) === enabled) return { result: viewOf(siteId, site.name, current), entries: [] };

    let carried = 0;
    let mirrored = 0;
    let notMirrored: string[] = [];
    let leaveCarry: AuditEntryInput | null = null;
    if (enabled) {
      const open = await openLegacyClockIns(siteId, today, tx);
      if (open > 0) {
        throw new ConflictError(`${open} ${open === 1 ? 'person is' : 'people are'} clocked in on the old clock. Switch after they clock out.`, 'OPEN_LEGACY_CLOCK_IN', { open });
      }
      carried = (await carryLegacyIn(tx, siteId, today)).carried;
      leaveCarry = (await carryLegacyLeave(tx, siteId, site.companyId, ctx.auditActor, now)).entry;
    } else {
      await assertMaySwitchOff(siteId); // Payroll: not while a month that includes this site is unpaid
      const result = await mirrorBack(tx, siteId, today);
      mirrored = result.mirrored;
      notMirrored = result.notMirrored;
      leaveCarry = (await mirrorLegacyLeave(tx, siteId, site.companyId, ctx.auditActor, now)).entry;
    }

    const row = await switchRepository.set(tx, siteId, enabled, subject.id, now);
    const about = { subjectType: 'AttendanceSwitch', subjectId: siteId, subjectUserId: null };
    const base = { companyId: site.companyId, siteId, actor: ctx.auditActor, employeeId: siteId, userId: null };
    const entry = {
      ...timeEntry({ ...base, action: 'attendance.switch_changed', before: { enabled: current?.enabled ?? false }, after: { enabled, carriedFromLegacy: carried, mirroredToLegacy: mirrored, notMirrored: notMirrored.length } }),
      ...about,
    };
    const carry =
      carried + mirrored > 0
        ? { ...timeEntry({ ...base, action: 'attendance.legacy_carried', after: { direction: enabled ? 'TO_NEW' : 'TO_LEGACY', records: carried + mirrored } }), ...about }
        : null;
    return {
      result: { ...viewOf(siteId, site.name, row), carriedFromLegacy: carried, mirroredToLegacy: mirrored, notMirrored },
      entries: [entry, ...(carry ? [carry] : []), ...(leaveCarry ? [leaveCarry] : [])],
      events: [eventOf('attendance.switch_changed', { siteId, enabled, changedById: subject.id }, now)],
    };
  });
}
