import type { Lookups } from '../../_shared/types/people-types';
import type { HireState } from './hire-model';
import { isCasual } from './hire-model';

/**
 * The choices the Job and Login steps offer, and the defaults that follow from a choice. Pure: the form asks, these answer.
 * `lookups` is the server's list for this person, so a Branch Manager already sees only their own site.
 */
const HIRE_LOGIN_ROLES: readonly string[] = ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT'];

type Site = Lookups['organizations'][number];
type Department = Lookups['departments'][number];
type Position = Lookups['positions'][number];

export const sitesFor = (lookups: Lookups): Site[] => lookups.organizations;

export const departmentsFor = (lookups: Lookups, siteId: string): Department[] => lookups.departments.filter((d) => d.isActive && d.organizationId === siteId);

/** Positions of the chosen department; a casual only sees positions that take casuals. A position with no department list fits any. */
export function positionsFor(lookups: Lookups, state: Pick<HireState, 'departmentId' | 'employment'>): Position[] {
  return lookups.positions.filter(
    (p) => p.isActive && (p.departmentIds.length === 0 || p.departmentIds.includes(state.departmentId)) && (!isCasual(state) || p.casualsAllowed)
  );
}

/** The login roles a position may start from, among those a hire may give (the rest are made in Access and adopted). */
export const loginRolesFor = (lookups: Lookups): string[] => lookups.assignableLoginRoles.filter((r) => HIRE_LOGIN_ROLES.includes(r));

export const ROLE_LABELS: Record<string, string> = {
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
  STEWARD: 'Steward',
  HOUSEKEEPING: 'Housekeeping',
  STORE_ATTENDANT: 'Store Attendant',
};

/** Everything that must change when one job choice changes, so the form never holds a department from another site. */
export function afterJobChoice(state: HireState, patch: Partial<HireState>, lookups: Lookups): HireState {
  const next = { ...state, ...patch };
  if ('siteId' in patch && !departmentsFor(lookups, next.siteId).some((d) => d.id === next.departmentId)) {
    next.departmentId = '';
    next.reportsToId = '';
  }
  if ('departmentId' in patch) next.reportsToId = '';
  if (('departmentId' in patch || 'employment' in patch) && !positionsFor(lookups, next).some((p) => p.id === next.positionId)) next.positionId = '';
  if ('positionId' in patch) {
    const position = lookups.positions.find((p) => p.id === next.positionId);
    next.loginRole = position?.loginRole && loginRolesFor(lookups).includes(position.loginRole) ? position.loginRole : next.loginRole;
  }
  return next;
}

/** One site: choose it for them. One department at that site is not auto-chosen: the head and rota depend on it. */
export function withSingleSite(state: HireState, lookups: Lookups): HireState {
  const sites = sitesFor(lookups);
  return state.siteId === '' && sites.length === 1 && sites[0] ? { ...state, siteId: sites[0].id } : state;
}

/** Whether the position tracks time when the form says nothing: the position's default. */
export function tracksTimeOf(state: Pick<HireState, 'positionId' | 'tracksTime'>, lookups: Lookups): boolean {
  if (state.tracksTime !== null) return state.tracksTime;
  return lookups.positions.find((p) => p.id === state.positionId)?.defaultTracksTime ?? true;
}

/** The sign-in email starts as the one given on step one, until the person types a different one. */
export function loginEmailDefault(state: Pick<HireState, 'email' | 'loginEmail'>): string {
  return state.loginEmail === '' ? state.email.trim() : state.loginEmail;
}
