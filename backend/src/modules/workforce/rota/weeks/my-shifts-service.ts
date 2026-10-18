import { addDays, fromDateColumn, nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { NotFoundError } from '../../../../utils/errors';
import { paidMinutes } from '../rota-days';
import { weeksRepository } from './weeks-repository';
import type { MyShiftsQuery } from './weeks-validators';

export interface MyShift {
  entryId: string;
  date: NairobiDate;
  shiftName: string;
  letter: string | null;
  colour: string;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
  paidMinutes: number;
}

const DEFAULT_DAYS_AHEAD = 28;
const MAX_RANGE_DAYS = 120;

/** R-mine: a person's own upcoming shifts. Always their own file, never anyone else's, whatever their role. */
export const myShiftsService = {
  async list(subject: AccessSubject, query: MyShiftsQuery, now: Date = new Date()): Promise<{ from: NairobiDate; to: NairobiDate; shifts: MyShift[] }> {
    const me = await weeksRepository.employeeOfUser(subject.id);
    if (!me) throw new NotFoundError('You have no employee file');
    const today = nairobiToday(now);
    const from = (query.from as NairobiDate | undefined) ?? today;
    const wanted = (query.to as NairobiDate | undefined) ?? addDays(from, DEFAULT_DAYS_AHEAD);
    const to = wanted > addDays(from, MAX_RANGE_DAYS) ? addDays(from, MAX_RANGE_DAYS) : wanted;
    const rows = await weeksRepository.shiftsOfEmployee(me.id, toDateColumn(from), toDateColumn(to));
    return {
      from,
      to,
      shifts: rows.map((r) => ({
        entryId: r.id,
        date: fromDateColumn(r.date),
        shiftName: r.template.name,
        letter: r.template.letter,
        colour: r.template.colour,
        startTime: r.template.startTime,
        endTime: r.template.endTime,
        unpaidBreakMinutes: r.template.unpaidBreakMinutes,
        paidMinutes: paidMinutes(r.template),
      })),
    };
  },
};
