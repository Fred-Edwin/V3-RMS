import { NotFoundError, ValidationError } from '../../../../utils/errors';
import { addDays, daysBetween, nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { payAmountOn } from '../../people/people-door';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { MAX_WEEKS_AHEAD, MAX_WEEKS_BACK } from '../rota.constants';
import { assertWeekStart } from '../rota-days';
import { departmentAllowed, gridScope, type RotaReadScope } from '../rota-scope';
import type { WeekView } from '../rota.types';
import { toTemplateView } from '../templates/template-rules';
import { templatesRepository } from '../templates/templates-repository';
import { approvedLeave } from '../warnings/leave-lookup';
import { resolveActor } from '../../people/people-context';
import { COST_BASIS, formatCents, weekCostCents } from './week-cost';
import { assembleWeek } from './week-grid';
import type { WeekQuery } from './weeks-validators';
import { weeksRepository, type GridEmployee } from './weeks-repository';

export interface WeekRequest extends Omit<WeekQuery, 'weekStart'> {
  weekStart: NairobiDate;
}

/** Which departments the grid covers: the caller's scope, narrowed by a department filter that must be inside it. */
function departmentFilter(scope: RotaReadScope, departmentId: string | undefined): readonly string[] | null {
  if (departmentId) {
    if (!departmentAllowed(scope, departmentId)) throw new NotFoundError('Not found');
    return [departmentId];
  }
  return scope.kind === 'site' ? null : scope.departmentIds;
}

function assertWeekInRange(weekStart: NairobiDate, today: NairobiDate): void {
  const weeks = Math.floor(daysBetween(today, weekStart) / 7);
  if (weeks > MAX_WEEKS_AHEAD || weeks < -MAX_WEEKS_BACK) throw new ValidationError('That week is too far from today', 'WEEK_OUT_OF_RANGE');
}

/** The cost line, only for a caller who reads everyone's pay in this scope. */
async function planned(subject: AccessSubject, view: Omit<WeekView, 'cost'>, employees: readonly GridEmployee[]): Promise<WeekView['cost']> {
  if (scopeOf(subject, 'payprofile.read') !== 'all') return null;
  const payTypeOf = new Map(employees.map((e) => [e.id, e.payType] as const));
  const people = await Promise.all(
    view.people.map(async (p) => ({
      payType: payTypeOf.get(p.employeeId) ?? 'MONTHLY_SALARY',
      shiftDays: Object.keys(p.cells).length,
      amount: await payAmountOn(p.employeeId, view.weekStart),
    })),
  );
  return { amount: formatCents(weekCostCents(people)), basis: COST_BASIS };
}

export const weeksReadService = {
  /** T6: the whole grid for one site, one week, optionally one department; the printed rota reads the same view. */
  async getWeek(subject: AccessSubject, request: WeekRequest, now: Date = new Date(), includeCost = true): Promise<WeekView> {
    await resolveActor(subject);
    const scope = gridScope(subject, 'rota.read', request.siteId);
    const { siteId } = scope;
    const { weekStart } = request;
    const today = nairobiToday(now);
    assertWeekInRange(weekStart, today);
    await assertWeekStart(siteId, weekStart);
    const weekEnd = addDays(weekStart, 6);
    const [from, to] = [toDateColumn(weekStart), toDateColumn(weekEnd)];
    const filter = departmentFilter(scope, request.departmentId);

    const [onRota, entries, departments] = await Promise.all([
      weeksRepository.employeesOnRota(siteId, filter, from, to),
      weeksRepository.entriesInRange(siteId, from, to),
      weeksRepository.departmentsWithHeads(siteId, filter, toDateColumn(today)),
    ]);
    const known = new Set(onRota.map((e) => e.id));
    const stray = [...new Set(entries.map((e) => e.employeeId))].filter((id) => !known.has(id));
    const strayPeople = stray.length > 0 ? (await weeksRepository.employeesByIds(siteId, stray)).filter((e) => !filter || (e.departmentId !== null && filter.includes(e.departmentId))) : [];
    const employees = [...onRota, ...strayPeople];
    const ids = new Set(employees.map((e) => e.id));
    const mine = entries.filter((e) => ids.has(e.employeeId));

    const actor = await resolveActor(subject);
    const [usable, referenced, leave, leaveRules] = await Promise.all([
      templatesRepository.list(actor.companyId, { kind: 'site', siteId }, false),
      templatesRepository.findManyByIds(actor.companyId, [...new Set(mine.map((e) => e.templateId))]),
      approvedLeave([...ids], weekStart, weekEnd),
      getEffectiveRuleGroup(siteId, weekStart, 'LEAVE'),
    ]);
    const used = new Map<string, number>();
    for (const e of mine) used.set(e.templateId, (used.get(e.templateId) ?? 0) + 1);
    const templates = [...new Map([...usable, ...referenced].map((t) => [t.id, t] as const)).values()].map((t) => toTemplateView(t, used.get(t.id) ?? 0));

    const view = assembleWeek({
      siteId,
      weekStart,
      today,
      employees,
      entries: mine,
      templates,
      departments: departments.map((d) => ({ id: d.id, name: d.name, headName: d.heads[0]?.employee.name ?? null })),
      leave,
      minimumCover: leaveRules.values.minimumCover,
      can: {
        write: workforceCan(subject, 'rota.write'),
        writeTemplates: workforceCan(subject, 'rota.template_write'),
        readCost: scopeOf(subject, 'payprofile.read') === 'all',
      },
    });
    return { ...view, cost: includeCost ? await planned(subject, view, employees) : null };
  },
};
