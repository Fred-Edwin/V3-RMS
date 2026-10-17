import { fromDateColumn, toDateColumn, type NairobiDate } from '../_shared/time/nairobi-time';
import { employeesRepository } from './employees/employees-repository';
import { lifecycleRepository } from './lifecycle/lifecycle-repository';
import { payService } from './pay/pay-service';

/** What the rest of the system may ask about a person (exported through the Workforce door). */
export interface EmployeeSummary {
  employeeId: string;
  userId: string | null;
  name: string;
  siteId: string;
  departmentId: string | null;
  positionName: string | null;
  tracksTime: boolean;
  status: string;
}

export async function getEmployee(userId: string): Promise<EmployeeSummary | null> {
  const row = await employeesRepository.findSummaryByUserId(userId);
  if (!row) return null;
  return {
    employeeId: row.id,
    userId: row.userId,
    name: row.name,
    siteId: row.siteId,
    departmentId: row.departmentId,
    positionName: row.position?.name ?? null,
    tracksTime: row.tracksTime,
    status: row.status,
  };
}

export interface ActiveLoan {
  employeeId: string;
  userId: string | null;
  name: string;
  homeSiteId: string;
  from: NairobiDate;
  until: NairobiDate | null;
}

/** People on loan into a site on a date, for the rota and the Today board. */
export async function getActiveLoans(siteId: string, date: NairobiDate): Promise<ActiveLoan[]> {
  const rows = await lifecycleRepository.activeLoansInto(siteId, toDateColumn(date));
  return rows.map((m) => ({
    employeeId: m.employee.id,
    userId: m.employee.userId,
    name: m.employee.name,
    homeSiteId: m.fromSiteId,
    from: fromDateColumn(m.startsOn),
    until: m.endsOn ? fromDateColumn(m.endsOn) : null,
  }));
}

/** The pay amount in force on a date (a money string), for payroll. Null when nothing was ever approved. */
export const payAmountOn = (employeeId: string, date: NairobiDate): Promise<string | null> => payService.amountOn(employeeId, date);
