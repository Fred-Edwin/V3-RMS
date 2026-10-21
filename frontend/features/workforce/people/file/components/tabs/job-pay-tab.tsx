'use client';

import * as React from 'react';

import { ErrorBlock, KeyValueRows, ListSkeleton, useWorkforcePermissions } from '../../../../_shared';
import { PANEL_ROWS, PanelLink, PanelReadOnlyTag, TitledPanel } from '../../../_shared/components/titled-panel';
import { useEmployeePay } from '../../../_shared/hooks/use-people-data';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { jobRows } from '../../lib/file-rows';
import { SensitivePanel } from '../sensitive/sensitive-panel';
import { IDS_BANK_RESTRICTED, PAY_RESTRICTED, RestrictedCard } from './restricted-card';
import { PayHistory, PayPanel, PendingPayChange } from './pay-panels';
import type { OpenDialog } from './overview-parts';

/**
 * Job and pay (Paper `YKO-0`). The pay is fetched only when this tab opens, because opening it is written to the audit log. The Job
 * panel never waits for it. A viewer who may not see pay never reaches this tab (it is not drawn).
 */
export function JobPayTab({ file, today, open, reloadKey }: { file: EmployeeFile; today: string; open: OpenDialog; reloadKey: number }) {
  const permissions = useWorkforcePermissions();
  // A viewer who may not see pay (the Branch Manager) never asks for it: the right column is two locked cards (frame 12.1).
  const payLocked = file.locked.includes('pay');
  const pay = useEmployeePay(file.id, !payLocked);
  const reloadPay = pay.reload;
  const lastKey = React.useRef(reloadKey);
  React.useEffect(() => {
    // A change made in a dialog reloads the file; the pay shown must follow it.
    if (lastKey.current !== reloadKey) {
      lastKey.current = reloadKey;
      reloadPay();
    }
  }, [reloadKey, reloadPay]);

  const canDecide = permissions.can('payprofile.approve');
  return (
    <div className="grid grid-cols-[minmax(0,480px)_minmax(0,1fr)] items-start gap-6 max-lg:grid-cols-1">
      <div className="flex flex-col gap-5">
        <TitledPanel title="Job" aside={file.actions.editJob ? <PanelLink onClick={() => open('edit-job')}>Edit</PanelLink> : <PanelReadOnlyTag>EDITED BY HR</PanelReadOnlyTag>}>
          <KeyValueRows rows={jobRows(file)} aria-label="Job" topRule={false} className={PANEL_ROWS} />
          {!file.actions.editJob && file.status !== 'EXITED' ? (
            <p className="m-0 border-t border-wds-border px-[18px] py-3 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Ask HR to change this.</p>
          ) : null}
        </TitledPanel>
        <SensitivePanel file={file} onEdit={file.actions.editIds || file.actions.editBank ? () => open('ids-bank') : undefined} />
      </div>
      <div className="flex flex-col gap-4">
        {payLocked ? (
          <>
            <RestrictedCard title="IDs and bank" line={IDS_BANK_RESTRICTED} />
            <RestrictedCard title="Pay" line={PAY_RESTRICTED} />
          </>
        ) : pay.status === 'error' && !pay.data ? (
          <ErrorBlock title="The pay did not load" line="Nothing was changed. Try again." onRetry={pay.reload} />
        ) : pay.data ? (
          <>
            {pay.data.pending ? <PendingPayChange change={pay.data.pending} canDecide={canDecide} onDecide={() => open('pay-decision', pay.data?.pending?.id)} /> : null}
            <PayPanel pay={pay.data} file={file} today={today} onEdit={file.actions.changePay ? () => open('change-pay') : undefined} />
            <PayHistory history={pay.data.history} />
            <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
              A pay change asks for the date it starts and goes to the Director to approve. The Branch Manager never sees these amounts. Opening this card is written to the audit log.
            </p>
          </>
        ) : (
          <ListSkeleton rows={4} columns={[120, 'fill']} label="Loading pay" />
        )}
      </div>
    </div>
  );
}
