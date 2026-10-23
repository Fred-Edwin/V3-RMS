/** My team (frames 9.2 and 9.5): read only. No pay, no ID number, no contract. */
export type TeamStatus = 'ON_SHIFT' | 'NOT_ON_SHIFT';

export interface TeamMember {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
  status: TeamStatus;
  /** "06:00 to 14:00", or null with no shift today. */
  shift: string | null;
  /** The viewer may write a probation report on this person. */
  canReport: boolean;
}

export interface TeamCounts {
  all: number;
  onShift: number;
  notOnShift: number;
}

export type TeamFilter = 'all' | 'on_shift' | 'not_on_shift';

export interface TeamQuery {
  page: number;
  perPage: number;
  q?: string;
  status: TeamFilter;
}
