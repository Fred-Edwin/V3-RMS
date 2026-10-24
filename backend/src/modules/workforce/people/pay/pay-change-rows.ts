import { fromDateColumn, nairobiDateOf } from '../../_shared/time/nairobi-time';
import { employeesRepository } from '../employees/employees-repository';
import { todayOf } from '../people-context';
import type { PayChangeReason } from '../people.constants';
import type { PayChangeRow } from '../people.types';
import type { payRepository } from './pay-repository';

export type ChangeRow = Awaited<ReturnType<typeof payRepository.historyOf>>[number];

export const money = (amount: { toFixed(places: number): string }): string => amount.toFixed(2);

async function askerBriefs(userIds: readonly string[]): Promise<Map<string, { position: string | null; site: string | null }>> {
  const rows = await employeesRepository.findBriefsByUserIds(userIds);
  return new Map(rows.flatMap((r) => (r.userId ? [[r.userId, { position: r.position?.name ?? null, site: r.site.name }] as const] : [])));
}

/** Pay-change rows as the screens show them: who asked and who decided, by name, position and branch. `employeeName` is one name for a
 *  person's own history, or a function when the rows belong to different people (the Director's list). */
export async function changeRows<R extends ChangeRow>(rows: readonly R[], employeeName: string | ((row: R) => string)): Promise<PayChangeRow[]> {
  const ids = [...new Set(rows.flatMap((r) => [r.requestedById, r.decidedById]).filter((id): id is string => !!id))];
  const names = new Map((await employeesRepository.findUserNames(ids)).map((u) => [u.id, u.name]));
  const briefs = await askerBriefs(ids);
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: typeof employeeName === 'string' ? employeeName : employeeName(r),
    amount: money(r.amount),
    effectiveFrom: fromDateColumn(r.effectiveFrom),
    startsInFuture: fromDateColumn(r.effectiveFrom) > todayOf(),
    reason: r.reason as PayChangeReason,
    status: r.status,
    requestedByName: r.requestedById ? (names.get(r.requestedById) ?? null) : null,
    requestedByPosition: r.requestedById ? (briefs.get(r.requestedById)?.position ?? null) : null,
    requestedBySite: r.requestedById ? (briefs.get(r.requestedById)?.site ?? null) : null,
    requestedOn: nairobiDateOf(r.requestedAt),
    decidedByName: r.decidedById ? (names.get(r.decidedById) ?? null) : null,
    decidedOn: r.decidedAt ? nairobiDateOf(r.decidedAt) : null,
    decisionNote: r.decisionNote,
  }));
}
