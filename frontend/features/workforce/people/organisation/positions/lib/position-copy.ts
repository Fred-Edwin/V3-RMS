import type { WorkforceKpiCell } from '../../../../_shared';
import type { PositionDetail, PositionUpdateBody, PositionView } from '../../_shared/types/org-types';

/** The words, numbers and checks of the Positions tab (Paper Chapter 3 steps 06 to 09). Pure. */

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "STORE_MANAGER" becomes "Store Manager". */
export const roleLabel = (role: string | null): string => (role ? role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'No login needed');

/** What a position may name as its login role (the API's list); the blank one means no login. */
export const LOGIN_ROLE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'No login needed' },
  ...['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT', 'MANAGER', 'STORE_MANAGER', 'ACCOUNTANT', 'HR_MANAGER', 'DIRECTOR'].map((value) => ({ value, label: roleLabel(value) })),
];

export function positionKpis(list: readonly PositionView[], onNobody: () => void): WorkforceKpiCell[] {
  const active = list.filter((p) => p.isActive);
  const departments = new Set(active.flatMap((p) => p.departments.map((d) => d.id)));  const idle = active.filter((p) => p.holderCount === 0);
  const clocks = active.filter((p) => p.defaultTracksTime);
  const doNot = active.filter((p) => !p.defaultTracksTime);
  return [
    { key: 'positions', label: 'POSITIONS', value: String(active.length), detail: `used in ${plural(departments.size, 'department')}` },
    { key: 'idle', label: 'NOBODY HOLDS IT', value: String(idle.length), detail: idle.length === 0 ? 'every position is in use' : `${idle.slice(0, 2).map((p) => p.name).join(', ')}, safe to retire`, actionable: idle.length > 0, onSelect: onNobody },
    { key: 'clocks', label: 'CLOCK IN AND OUT', value: String(clocks.length), detail: 'positions that track time' },
    { key: 'noclock', label: 'DO NOT CLOCK', value: String(doNot.length), detail: doNot.slice(0, 3).map((p) => p.name).join(', ') || 'none' },
  ];
}

/** The second line of a list row: how it clocks and its login role. */
export const positionRowLine = (p: PositionView): string => (!p.defaultTracksTime ? 'Does not clock in' : p.loginRole ? `Clocks in · login role ${roleLabel(p.loginRole)}` : 'Clocks in · no login needed');

export const positionRowTone = (p: PositionView): 'default' | 'warning' => (p.isActive && p.holderCount === 0 ? 'warning' : 'default');

/** "12 people · used in the Barista department at 2 sites" */
export function positionSubtitle(p: PositionView): string {
  const names = Array.from(new Set(p.departments.map((d) => d.name)));
  const sites = new Set(p.departments.map((d) => d.organizationId)).size;
  const where = names.length === 0 ? 'not offered by any department yet' : `used in the ${names.slice(0, 2).join(' and ')} department${names.length > 1 ? 's' : ''}${names.length > 2 ? ` and ${names.length - 2} more` : ''} at ${plural(sites, 'site')}`;
  return `${plural(p.holderCount, 'person', 'people')} · ${where}`;
}

/** The people on a position's "People who hold it" line: department and site names resolved from the position's own departments. */
export function holderLine(holder: PositionDetail['holders'][number], position: PositionDetail, siteName: (id: string) => string, headIds: ReadonlySet<string>): string {
  const dept = position.departments.find((d) => d.id === holder.departmentId)?.name ?? position.name;
  return [dept, siteName(holder.organizationId), headIds.has(holder.employeeId) ? 'head' : null].filter(Boolean).join(' · ');
}

// ---- the edit form -----------------------------------------------------------------------------------
export interface PositionForm {
  name: string;
  tracksTime: boolean;
  loginRole: string;
  casualsAllowed: boolean;
  departmentIds: string[];
}

export const formOf = (p: PositionView): PositionForm => ({ name: p.name, tracksTime: p.defaultTracksTime, loginRole: p.loginRole ?? '', casualsAllowed: p.casualsAllowed, departmentIds: p.departments.map((d) => d.id) });

export function validatePosition(f: PositionForm): { name?: string } {
  const name = f.name.trim();
  if (!name) return { name: 'Give the position a name.' };
  if (name.length > 60) return { name: 'Keep the name under 60 letters.' };
  return {};
}

/** Only what changed. Null when nothing did. `acknowledgedPeople` is added when "clocks in" changes (the server needs the impact count). */
export function toPositionPatch(before: PositionView, f: PositionForm, acknowledgedPeople?: number): PositionUpdateBody | null {
  const body: PositionUpdateBody = {};
  if (f.name.trim() !== before.name) body.name = f.name.trim();
  if (f.tracksTime !== before.defaultTracksTime) body.defaultTracksTime = f.tracksTime;
  if ((f.loginRole || null) !== before.loginRole) body.loginRole = f.loginRole || null;
  if (f.casualsAllowed !== before.casualsAllowed) body.casualsAllowed = f.casualsAllowed;
  if ([...f.departmentIds].sort().join() !== before.departments.map((d) => d.id).sort().join()) body.departmentIds = f.departmentIds;
  if (Object.keys(body).length === 0) return null;
  if (body.defaultTracksTime !== undefined) body.acknowledgedPeople = acknowledgedPeople ?? 0;
  return body;
}

/** The clocking change needs a second look (who it affects) before it is saved. */
export const clockingChanged = (before: PositionView, f: PositionForm): boolean => f.tracksTime !== before.defaultTracksTime;

export function impactHeadline(name: string, stops: boolean): string {
  return stops ? `Stop tracking time for ${name}?` : `Start tracking time for ${name}?`;
}

export function impactWhatChanges(stops: boolean): string {
  return stops
    ? 'From tomorrow they have no clock card, lateness or overtime, and they leave Shifts. Their pay becomes a fixed monthly amount. Past timesheets stay as they are.'
    : 'From tomorrow they have a clock card and appear on Shifts, and lateness and overtime count. Past timesheets stay as they are.';
}
