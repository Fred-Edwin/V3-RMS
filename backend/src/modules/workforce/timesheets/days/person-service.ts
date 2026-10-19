import { NotFoundError } from '../../../../utils/errors';
import type { AccessSubject } from '../../_shared/workforce-access';
import { personInScope } from '../../attendance/attendance-scope';
import { dayHistory, type DayHistory } from '../../attendance/fixes/history-service';
import { overtimeRepository } from '../overtime/overtime-repository';
import { requestsRepository } from '../requests/requests-repository';
import type { DayRow, OvertimeRow, RequestRow } from '../timesheets.types';
import { timesheetDaysRepository } from './timesheet-days-repository';

export interface DayDetailView {
  day: DayRow & { siteId: string };
  person: { id: string; name: string; departmentName: string | null };
  history: DayHistory;
  overtime: OvertimeRow | null;
  requests: RequestRow[];
}

/** One day with every clock event (replaced and removed ones included), its overtime evidence and any request on it. */
export async function dayDetail(subject: AccessSubject, dayId: string, now: Date = new Date()): Promise<DayDetailView> {
  const row = await timesheetDaysRepository.byIdAnywhere(dayId);
  if (!row) throw new NotFoundError('Day not found');
  const person = await personInScope(subject, 'timesheet.read', row.employeeId, 'read');
  const [history, item, requests] = await Promise.all([
    dayHistory(subject, { employeeId: row.employeeId, date: row.shiftDate }, now),
    overtimeRepository.byPersonDate(row.siteId, row.employeeId, row.shiftDate),
    requestsRepository.ofPersonOnDates(row.siteId, row.employeeId, row.shiftDate, row.shiftDate),
  ]);
  return {
    day: row,
    person: { id: person.id, name: person.name, departmentName: person.departmentName },
    history,
    overtime: item,
    requests,
  };
}
