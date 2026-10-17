'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { Panel } from '../../../_shared';
import { usePendingPayChanges } from '../../_shared/hooks/use-people-data';
import { formatDayMonth, formatKes } from '../../_shared/lib/people-dates';
import { PayDecisionDialog } from '../../file/components/dialogs/pay/pay-decision-dialog';

/**
 * Pay changes waiting for the Director (R11). Shown only to someone who may approve; a change shows who asked, the amount and the day
 * it starts, and "Review" opens the decision dialog. Nothing here shows to a viewer without the capability.
 */
export function PendingPayChanges({ canDecide }: { canDecide: boolean }) {
  const pending = usePendingPayChanges(canDecide);
  const [open, setOpen] = React.useState<{ id: string; name: string } | null>(null);
  const rows = canDecide ? (pending.data ?? []) : [];
  if (rows.length === 0 && !open) return null;
  return (
    <>
      <Panel title="Pay changes waiting" caption={`${rows.length} WAITING`} padded={false}>
        <ul className="m-0 flex list-none flex-col p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 border-t border-wds-border px-4 py-3 first:border-t-0">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{r.employeeName}: {formatKes(r.amount)} from {formatDayMonth(r.effectiveFrom)}</span>
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Asked by {r.requestedByName ?? 'HR'}</span>
              </span>
              <Button type="button" variant="flat" size="sm" aria-label={`Review pay change for ${r.employeeName}`} onClick={() => setOpen({ id: r.id, name: r.employeeName })}>
                Review
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
      {open ? (
        <PayDecisionDialog
          file={{ name: open.name }}
          requestId={open.id}
          onClose={() => setOpen(null)}
          done={() => {
            setOpen(null);
            pending.reload();
          }}
        />
      ) : null}
    </>
  );
}
