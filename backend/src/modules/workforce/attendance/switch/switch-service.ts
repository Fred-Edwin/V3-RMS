import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { eventOf, timeEntry } from '../attendance-audit';
import { daysRepository } from '../days/days-repository';
import { carryLegacyIn, mirrorBack, openLegacyClockIns } from './switch-carry';
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
    if (enabled) {
      const open = await openLegacyClockIns(siteId, today, tx);
      if (open > 0) {
        throw new ConflictError(`${open} ${open === 1 ? 'person is' : 'people are'} clocked in on the old clock. Switch after they clock out.`, 'OPEN_LEGACY_CLOCK_IN', { open });
      }
      carried = (await carryLegacyIn(tx, siteId, today)).carried;
    } else {
      const result = await mirrorBack(tx, siteId, today);
      mirrored = result.mirrored;
      notMirrored = result.notMirrored;
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
      entries: carry ? [entry, carry] : [entry],
      events: [eventOf('attendance.switch_changed', { siteId, enabled, changedById: subject.id }, now)],
    };
  });
}
