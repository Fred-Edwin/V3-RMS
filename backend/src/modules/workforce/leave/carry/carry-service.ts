import type { LeaveStatus, Prisma } from '@prisma/client';
import type { AuditActor, AuditEntryInput } from '../../_shared/audit/audit.types';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { rulesToday } from '../balances/rules-loader';
import { applicationsRepository } from '../data/applications-repository';
import { ledgerRepository, type NewEntry } from '../data/ledger-repository';
import { leaveYearOf, yearStart } from '../engine/leave-days';
import { routeFor } from '../engine/leave-routing';
import { asJson, leaveEntry } from '../leave-audit';
import { snapshotOfType } from '../leave-words';
import { legacyLeaveRepository } from './legacy-repository';

export interface CarryResult {
  requests: number;
  updated: number;
  openings: number;
  entry: AuditEntryInput | null;
}

const STATUS_OF: Record<LeaveStatus, 'WAITING' | 'APPROVED' | 'DECLINED' | 'CANCELLED'> = { PENDING: 'WAITING', APPROVED: 'APPROVED', REJECTED: 'DECLINED', CANCELLED: 'CANCELLED' };
const CODE_OF = { ANNUAL: 'ANNUAL', SICK: 'SICK', EMERGENCY: 'EMERGENCY', UNPAID: 'UNPAID' } as const;

/**
 * Switch-on carry (spec section 1, L3 and L4), called by the attendance switch in its transaction. Repeatable: a legacy request is
 * copied once (unique `legacy_request_id`); a copy still waiting is brought up to date if the old row was decided in the gap; one
 * OPENING ledger line per person and type is written once per year. Old tables are only read. Waiting requests keep their ask time, so
 * the 72 hours keeps counting.
 */
export async function carryLegacyLeave(tx: Prisma.TransactionClient, siteId: string, companyId: string, actor: AuditActor, now: Date): Promise<CarryResult> {
  const today = nairobiToday(now);
  const year = leaveYearOf(today);
  const [people, rules, old] = await Promise.all([legacyLeaveRepository.people(tx, siteId), rulesToday(siteId, now), legacyLeaveRepository.requests(tx, siteId, today, yearStart(year))]);
  const byProfile = new Map(people.map((p) => [p.legacyProfileId as string, p] as const));

  const carried = await legacyLeaveRepository.carriedIds(tx, old.map((r) => r.id));
  let requests = 0;
  for (const row of old) {
    const person = byProfile.get(row.employeeProfileId);
    const typeRule = rules.leaveTypes.find((t) => t.code === CODE_OF[row.leaveType]);
    if (!person || !typeRule || carried.has(row.id)) continue;
    const route = routeFor(person.user?.role ?? 'WAITER', person.site.type === 'CENTRAL_STORE' ? 'CENTRAL_STORE' : 'BRANCH', typeRule.approvedBy);
    const status = STATUS_OF[row.status];
    requests += await legacyLeaveRepository.copyIn(tx, {
        companyId, siteId, employeeId: person.id, typeCode: typeRule.code, typeSnapshot: snapshotOfType(typeRule) as unknown as Prisma.InputJsonValue,
        startDate: row.startDate, endDate: row.endDate, days: Math.max(1, Math.round(Number(row.totalDays))), unpaidTailDays: 0, note: row.reason || null,
        status, stage: route.stage, routedToRole: route.role, askedAt: row.createdAt,
        decidedAt: status === 'APPROVED' || status === 'DECLINED' ? (row.reviewedAt ?? row.createdAt) : null, decidedBy: status === 'APPROVED' || status === 'DECLINED' ? row.reviewedById : null,
        cancelledAt: status === 'CANCELLED' ? (row.cancelledAt ?? row.createdAt) : null, cancelledBy: status === 'CANCELLED' ? row.cancelledById : null,
        origin: 'LEGACY', legacyRequestId: row.id, countedIn: 'WORKING_DAYS',
    });
  }

  // A copy still waiting whose old row was decided in the gap between the switch and this run.
  let updated = 0;
  const copies = await legacyLeaveRepository.waitingCopies(tx, old.filter((r) => r.status !== 'PENDING').map((r) => r.id));
  for (const copy of copies) {
    const row = old.find((r) => r.id === copy.legacyRequestId);
    if (!row) continue;
    const status = STATUS_OF[row.status];
    const ok = await applicationsRepository.update(tx, copy.id, copy.version, {
      status, decidedAt: row.reviewedAt ?? now, decidedBy: row.reviewedById, ...(status === 'CANCELLED' ? { cancelledAt: row.cancelledAt ?? now, cancelledBy: row.cancelledById } : {}),
    });
    if (ok) updated += 1;
  }

  // One OPENING line per person and type: what was left on the old balance the day of the carry.
  const balances = await legacyLeaveRepository.balances(tx, people.map((p) => p.legacyProfileId as string), year);
  const openings: NewEntry[] = [];
  for (const balance of balances) {
    const person = byProfile.get(balance.employeeProfileId);
    const code = CODE_OF[balance.leaveType];
    if (!person || balance.leaveType === 'UNPAID' || !rules.leaveTypes.some((t) => t.code === code && t.paid)) continue;
    openings.push({ companyId, employeeId: person.id, typeCode: code, year, kind: 'OPENING', days: Math.max(0, Math.floor(balance.totalDays - Number(balance.usedDays))), asOf: today, reasonCode: 'LEGACY_OPENING' });
  }
  const opened = await ledgerRepository.addOnce(tx, openings);

  const changed = requests + updated + opened;
  const entry = changed === 0 ? null : leaveEntry({ companyId, siteId, actor, channel: 'SYSTEM', action: 'leave.legacy_carried', subjectType: 'LeaveCarry', subjectId: siteId, userId: null, after: asJson({ direction: 'TO_NEW', requests, updated, openings: opened }) });
  return { requests, updated, openings: opened, entry };
}

/**
 * Switch-off (L5): requests made in the new system that are waiting or approved and have not ended are written back as marked old
 * rows so the old screens show them, and the new row remembers the old id so a later switch-on never carries it again. A person with
 * no old balance row for the type cannot be mirrored and is counted, not guessed at.
 */
export async function mirrorLegacyLeave(tx: Prisma.TransactionClient, siteId: string, companyId: string, actor: AuditActor, now: Date): Promise<{ mirrored: number; notMirrored: number; entry: AuditEntryInput | null }> {
  const today = nairobiToday(now);
  const open = (await applicationsRepository.openForSite(siteId, today, tx)).filter((a) => a.origin === 'NEW');
  const profiles = await legacyLeaveRepository.profileIds(tx, open.map((a) => a.employeeId));
  let mirrored = 0;
  let notMirrored = 0;
  for (const app of open) {
    const profileId = profiles.get(app.employeeId);
    const leaveType = (['ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID'] as const).find((t) => t === app.typeCode);
    const balance = profileId && leaveType ? await legacyLeaveRepository.balanceFor(tx, profileId, leaveType, leaveYearOf(app.start)) : null;
    if (!profileId || !leaveType || !balance) {
      notMirrored += 1;
      continue;
    }
    const made = await legacyLeaveRepository.insertMirror(tx, { profileId, balanceId: balance.id, siteId, leaveType, start: app.start, end: app.end, days: app.days - app.unpaidTailDays, reason: app.note ?? app.type.label, status: app.status === 'APPROVED' ? 'APPROVED' : 'PENDING', reviewedById: app.decidedBy, reviewedAt: app.decidedAt });
    await legacyLeaveRepository.linkLegacy(tx, app.id, made.id);
    mirrored += 1;
  }
  const entry = mirrored + notMirrored === 0 ? null : leaveEntry({ companyId, siteId, actor, channel: 'SYSTEM', action: 'leave.legacy_carried', subjectType: 'LeaveCarry', subjectId: siteId, userId: null, after: asJson({ direction: 'TO_LEGACY', mirrored, notMirrored }) });
  return { mirrored, notMirrored, entry };
}
