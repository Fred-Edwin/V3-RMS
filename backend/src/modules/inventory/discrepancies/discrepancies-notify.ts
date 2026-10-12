import { logger } from '../../../utils/logger';
import { defaultBranchNoticeDeps, discrepancyLink, type BranchNoticeDeps } from '../deliveries/deliveries-notify';
import { FINDING_TEXT, type Finding } from './_shared/discrepancies-contract';

/**
 * The notices of the store side of a discrepancy (docs/features/inventory/dispatch-contract.md §7; notification map rows 14, 17, 18 and 19
 * on Paper "Inventory · Final design pass: map"), sent AFTER the transaction commits and never failing the write. All through
 * `_shared/notify.ts`; no Inbox row, titles not names.
 *
 *   Finding recorded   -> Director (push, row 17); Accountant (push with the value, only when stock is written off, row 18)
 *   Finding reversed   -> Director (push, row 17)
 *   24 hours, then daily -> Store Manager (push, row 19)
 * and `discrepancy:changed` (+ `dispatch:changed`) to the branch, the hub and everyone who reads every site: the department's result
 * chip on My deliveries (row 14, chip only, no push) refreshes from it.
 */

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

const kesText = (value: string): string => `KES ${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export interface FindingNotice {
  hubId: string;
  branchId: string;
  discrepancyId: string;
  reference: string;
  dispatchId: string;
  dispatchReference: string | null;
  finding: Finding;
  /** The written-off value in KES; set only for a LOSS finding. */
  lossValueKes: string | null;
}

export const createDiscrepancyNotices = (deps: BranchNoticeDeps = defaultBranchNoticeDeps) => {
  const changed = (n: Pick<FindingNotice, 'hubId' | 'branchId' | 'discrepancyId' | 'reference' | 'dispatchId' | 'dispatchReference'>, reason: string): void => {
    try {
      deps.emitDiscrepancyChanged(n.hubId, { id: n.discrepancyId, reference: n.reference, siteId: n.branchId, reason });
      deps.emitDispatchChanged(n.hubId, { id: n.dispatchId, reference: n.dispatchReference, siteId: n.branchId, reason });
    } catch (error) {
      logger.warn({ error, reason }, 'discrepancy:changed socket event failed');
    }
  };

  return {
    /** Q4 committed. */
    recorded: async (n: FindingNotice): Promise<void> => {
      changed(n, 'discrepancy.finding_recorded');
      await deps.send({
        audiences: [{ kind: 'directors' }],
        message: {
          title: 'A finding was recorded',
          body: `A finding was recorded on ${n.reference}: ${lower(FINDING_TEXT[n.finding])}.`,
          link: discrepancyLink(n.discrepancyId),
          tag: `discrepancy-finding-${n.discrepancyId}`,
          data: { type: 'discrepancy_finding_recorded', discrepancyId: n.discrepancyId },
          urgency: 'normal',
        },
        badgeSites: [n.branchId, n.hubId],
        reason: 'discrepancy.finding_recorded',
      });
      if (n.lossValueKes === null) return;
      await deps.send({
        audiences: [{ kind: 'roles', siteId: n.hubId, roles: ['ACCOUNTANT'] }],
        message: {
          title: 'Stock was written off',
          body: `${kesText(n.lossValueKes)} written off: ${lower(FINDING_TEXT[n.finding])} (${n.reference}).`,
          link: discrepancyLink(n.discrepancyId),
          tag: `discrepancy-loss-${n.discrepancyId}`,
          data: { type: 'discrepancy_loss_written_off', discrepancyId: n.discrepancyId },
          urgency: 'normal',
        },
        badgeSites: [],
        reason: 'discrepancy.loss_written_off',
      });
    },

    /** Q5 committed. */
    reversed: async (n: FindingNotice): Promise<void> => {
      changed(n, 'discrepancy.finding_reversed');
      await deps.send({
        audiences: [{ kind: 'directors' }],
        message: {
          title: 'A finding was reversed',
          body: `The finding on ${n.reference} was reversed. The gap is open again.`,
          link: discrepancyLink(n.discrepancyId),
          tag: `discrepancy-reversed-${n.discrepancyId}-${Date.now()}`,
          data: { type: 'discrepancy_finding_reversed', discrepancyId: n.discrepancyId },
          urgency: 'normal',
        },
        badgeSites: [n.branchId, n.hubId],
        reason: 'discrepancy.finding_reversed',
      });
    },

    /** The 24-hour job, once per gap per day. */
    reminder: async (n: { hubId: string; discrepancyId: string; reference: string; hours: number }): Promise<void> => {
      const waited = n.hours < 48 ? '24 hours' : `${Math.floor(n.hours / 24)} days`;
      await deps.send({
        audiences: [{ kind: 'roles', siteId: n.hubId, roles: ['STORE_MANAGER'] }],
        message: {
          title: 'A gap is waiting for a finding',
          body: `${n.reference} has waited ${waited} for a finding.`,
          link: discrepancyLink(n.discrepancyId),
          tag: `discrepancy-reminder-${n.discrepancyId}-${Math.floor(n.hours / 24)}`,
          data: { type: 'discrepancy_reminder', discrepancyId: n.discrepancyId },
          urgency: 'normal',
        },
        badgeSites: [n.hubId],
        reason: 'discrepancy.reminder',
      });
    },
  };
};

export const discrepancyNotices = createDiscrepancyNotices();
