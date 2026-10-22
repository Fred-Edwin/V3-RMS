import type { StatusTagTone } from '../../../_shared';
import type { TeamFilter, TeamMember, TeamQuery } from '../types/team-types';
import type { TableQuery } from '@/components/ui2/data-table/table-query';

const FILTERS: readonly TeamFilter[] = ['on_shift', 'not_on_shift'];

/** The table's URL state as the endpoint's query. Anything but the two chips means everyone. */
export function toTeamQuery(q: TableQuery): TeamQuery {
  const chosen = q.filters['filter'] ?? '';
  return { page: q.page, perPage: q.perPage, q: q.search || undefined, status: FILTERS.includes(chosen as TeamFilter) ? (chosen as TeamFilter) : 'all' };
}

/** Today's status cell: "On shift" in green, "Not on shift" plain. */
export function statusCell(member: Pick<TeamMember, 'status'>): { label: string; tone: StatusTagTone } {
  return member.status === 'ON_SHIFT' ? { label: 'On shift', tone: 'success' } : { label: 'Not on shift', tone: 'neutral' };
}

export const SHIFT_NONE = 'No shift today';
export const shiftCell = (member: Pick<TeamMember, 'shift'>): string => member.shift ?? SHIFT_NONE;
