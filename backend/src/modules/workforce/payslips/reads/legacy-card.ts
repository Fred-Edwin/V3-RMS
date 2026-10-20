import { readsRepository } from './reads-repository';

export interface LegacyState {
  /** The person's branch pays and shows payslips from the new system. */
  onNewSystem: boolean;
  hasOldPayslips: boolean;
  /** Show the card "Your payslips are still on the old screen" with Open old payslips. */
  card: boolean;
  /** Show the last History row "Before October 2026" that opens the old page. */
  historyRow: boolean;
  /** Why the list is empty when there is nothing to show: the branch has not moved yet. */
  emptyReason: 'BRANCH_NOT_MOVED' | null;
}

/** PD12: what the phone shows for a person whose branch may not be on the new payslips yet. Old payslips are those the old system published (locked). */
export async function legacyStateOf(userId: string, siteId: string | null): Promise<LegacyState> {
  const [oldCount, switchRow, inPayroll] = await Promise.all([readsRepository.legacyPublishedCount(userId), siteId ? readsRepository.siteSwitch(siteId) : null, siteId ? readsRepository.siteInPayroll(siteId) : false]);
  const onNewSystem = switchRow?.enabled === true || inPayroll;
  const hasOldPayslips = oldCount > 0;
  return { onNewSystem, hasOldPayslips, card: !onNewSystem && hasOldPayslips, historyRow: onNewSystem && hasOldPayslips, emptyReason: !onNewSystem && !hasOldPayslips ? 'BRANCH_NOT_MOVED' : null };
}
