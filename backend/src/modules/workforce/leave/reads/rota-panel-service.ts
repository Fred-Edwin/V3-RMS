import { NotFoundError } from '../../../../utils/errors';
import { nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { loadCover } from '../applications/cover-service';
import { balancesOf } from '../balances/balance-service';
import { applicationsRepository } from '../data/applications-repository';
import { peopleRepository } from '../data/people-repository';
import { leaveYearOf } from '../engine/leave-days';
import { assertCanOpen } from './read-scope';

export type RotaCellKind = 'SHIFT' | 'LEAVE' | 'ASKED' | 'OFF';

export interface RotaPanel {
  department: string | null;
  head: { name: string; role: string } | null;
  days: {
    date: NairobiDate;
    /** True when the rota is planned for that day; false = "usual shifts, rota not planned yet". */
    planned: boolean;
    minimum: number | null;
    working: number;
    tight: boolean;
    rows: { employeeId: string; name: string; cell: RotaCellKind; templateName: string | null }[];
  }[];
  balanceBefore: number | null;
  balanceAfter: number | null;
}

/**
 * D2: the department's strip for the days of one request. Only readers in scope get it (the person asking sees only a yes or no on
 * the request screen, never the team), so the person's own call answers 404. Cover counts the team without the person.
 */
export async function rotaPanel(subject: AccessSubject, id: string, now: Date = new Date()): Promise<RotaPanel> {
  const ctx = await resolveActor(subject);
  const app = await applicationsRepository.byId(ctx.companyId, id);
  const person = app ? await peopleRepository.byId(ctx.companyId, app.employeeId) : null;
  if (!app || !person) throw new NotFoundError('That leave request was not found', 'LEAVE_NOT_FOUND');
  if (assertCanOpen(subject, person) === 'own') throw new NotFoundError('That leave request was not found', 'LEAVE_NOT_FOUND');

  const cover = await loadCover(person, app.start, app.end, now);
  const first = new Map<string, string>();
  for (const cell of cover.cells) if (!first.has(`${cell.date}|${cell.employeeId}`)) first.set(`${cell.date}|${cell.employeeId}`, cell.templateName);
  const head = person.departmentId ? await peopleRepository.headOf(person.departmentId, nairobiToday(now)) : null;

  let before = app.balanceBefore;
  let after = app.balanceAfter;
  if (app.status === 'WAITING') {
    const left = (await balancesOf(person, leaveYearOf(app.start), now)).requestable.find((type) => type.code === app.typeCode)?.left ?? null;
    before = left;
    after = left === null ? null : Math.max(0, left - (app.days - app.unpaidTailDays));
  }

  return {
    department: person.departmentName,
    head: head && head.employeeId !== person.id ? { name: head.name, role: `Head of ${person.departmentName ?? 'the department'}` } : null,
    days: cover.days.map((day) => ({
      date: day.date, planned: day.planned, minimum: day.minimum, working: day.working, tight: day.tight,
      rows: cover.team.map((member) => {
        const templateName = first.get(`${day.date}|${member.id}`) ?? null;
        const cell: RotaCellKind = member.id === person.id ? (app.status === 'WAITING' ? 'ASKED' : app.status === 'APPROVED' ? 'LEAVE' : 'OFF') : cover.leaveByDay.get(day.date)?.has(member.id) ? 'LEAVE' : templateName ? 'SHIFT' : 'OFF';
        return { employeeId: member.id, name: member.name, cell, templateName: cell === 'SHIFT' ? templateName : null };
      }),
    })),
    balanceBefore: before,
    balanceAfter: after,
  };
}
