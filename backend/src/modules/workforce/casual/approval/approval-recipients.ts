import { employeesRepository } from '../../people/employees/employees-repository';
import { isUnitManager } from './approval-rules';

/**
 * Who is told that a sheet waits: the site's managers (not the sender), or the Directors when a manager recorded it or the site has
 * no manager (PD24: a Branch Manager who is also the head sends it to the Director).
 */
export async function approverRecipients(companyId: string, siteId: string, recordedByRole: string, exceptUserId: string): Promise<string[]> {
  if (!isUnitManager(recordedByRole)) {
    const managers = (await employeesRepository.siteManagerUserIds(siteId)).filter((id) => id !== exceptUserId);
    if (managers.length > 0) return managers;
  }
  return (await employeesRepository.userIdsByRole(companyId, 'DIRECTOR')).filter((id) => id !== exceptUserId);
}
