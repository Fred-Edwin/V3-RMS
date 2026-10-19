import { daysRepository } from '../../attendance/days/days-repository';
import type { RequestRow } from '../timesheets.types';
import { waitingDays } from './requests-rules';

export interface RequestView extends RequestRow {
  /** "Waiting on Faith Njeri": the person, or the role when nobody holds it yet. */
  waitingOnName: string | null;
  waitingDays: number;
  escalatedToHr: boolean;
  decidedByName: string | null;
}

/** Adds the names a screen shows. One read for all the people named in a list. */
export async function viewRequests(rows: readonly RequestRow[], now: Date): Promise<RequestView[]> {
  const ids = [...new Set(rows.flatMap((r) => [r.waitingOnUserId, r.decidedById]).filter((id): id is string => id !== null))];
  const names = await daysRepository.userNames(ids);
  return rows.map((row) => ({
    ...row,
    waitingOnName: row.waitingOnUserId ? (names.get(row.waitingOnUserId) ?? null) : null,
    waitingDays: row.state === 'WAITING' ? waitingDays(row.createdAt, now) : 0,
    escalatedToHr: row.escalatedAt !== null,
    decidedByName: row.decidedById ? (names.get(row.decidedById) ?? null) : null,
  }));
}
