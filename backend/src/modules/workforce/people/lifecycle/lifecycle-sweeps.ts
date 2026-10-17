import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { applyTransfer, endLoan, finalizeExitFor, SYSTEM_DOER, startLoan } from './lifecycle-engine';
import { lifecycleRepository } from './lifecycle-repository';

/**
 * The moves and exits that are due, applied by the daily scheduler. Each one re-reads the row and claims it with a
 * guarded update, so running the sweep twice on the same day changes nothing the second time.
 */
export const lifecycleSweeps = {
  async startDueMoves(today: NairobiDate, now: Date): Promise<number> {
    let changed = 0;
    for (const move of await lifecycleRepository.dueStarts(toDateColumn(today))) {
      if (move.kind === 'TRANSFER') {
        if (await applyTransfer(move, today, now, SYSTEM_DOER, 'people.transfer_applied')) changed += 1;
      } else if (await startLoan(move, now)) changed += 1;
    }
    return changed;
  },

  async endDueLoans(today: NairobiDate, now: Date): Promise<number> {
    let changed = 0;
    for (const move of await lifecycleRepository.dueLoanEnds(toDateColumn(today))) {
      if (await endLoan(move, today, now, SYSTEM_DOER)) changed += 1;
    }
    return changed;
  },

  async finalizeDueExits(today: NairobiDate, now: Date): Promise<number> {
    let changed = 0;
    for (const spell of await lifecycleRepository.dueExits(toDateColumn(today))) {
      const emp = await lifecycleRepository.findEmployeeTop(spell.employee.companyId, spell.employeeId);
      if (await finalizeExitFor(emp, today, now, SYSTEM_DOER)) changed += 1;
    }
    return changed;
  },
};
