'use client';

import * as React from 'react';

import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

import { EmptyState, ErrorBlock, ListSkeleton, PhoneScreen, useRemote } from '../../../_shared';
import { OldPayslipsCard } from '../../_shared/components/old-payslips-card';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { monthLong, monthName, rowLine } from '../../_shared/lib/pay-words';
import { nameAndRole } from '../../_shared/lib/role-words';
import { payslipReads } from '../../_shared/services/payslip-services';
import { useCodeEntry } from '../hooks/use-code-entry';
import { chosenRow } from '../lib/unlock-logic';
import { CodeBlock } from './code-block';

/**
 * Getting in (spec S1): the locked list (months and pay days, a "locked" word, no amounts) and the code. A month appears only when it
 * is published. `onOpened` gets the chosen month's id so the payslip opens at once; with nothing to choose the code still opens the section.
 */
export function UnlockScreen({ onOpened, back = '/app/workforce' }: { onOpened: (chosenId: string | null) => void; back?: string }) {
  const user = useAuthStore((s) => s.user);
  const list = useRemote(payslipReads.list, 'locked-list');
  const [chosenId, setChosenId] = React.useState<string | null>(null);
  const items = list.data?.items ?? [];
  const chosen = chosenRow(items, chosenId);
  const entry = useCodeEntry(() => onOpened(chosen?.id ?? null));

  let body: React.ReactNode;
  if (list.status === 'loading') body = <ListSkeleton rows={2} columns={['fill', 60]} label="Opening your payslips" />;
  else if (list.status === 'error' && !list.data) {
    body = <ErrorBlock title="Your payslips did not load" line={list.error.code === 'NETWORK' ? PAYSLIP_COPY.offline : PAYSLIP_COPY.loadError} onRetry={list.reload} />;
  } else if (list.data) {
    const { legacy, hasCode } = list.data;
    body = (
      <>
        {legacy.card ? <OldPayslipsCard /> : null}
        {items.length === 0 && !legacy.card ? (
          <EmptyState kind="nothingYet" {...(legacy.emptyReason === 'BRANCH_NOT_MOVED' ? PAYSLIP_COPY.emptyBranchNotMoved : PAYSLIP_COPY.empty)} />
        ) : null}
        {items.length > 0 ? (
          <>
            <ul role="radiogroup" aria-label="Choose a payslip" className="m-0 flex list-none flex-col gap-2.5 p-0">
              {items.map((p) => {
                const on = p.id === chosen?.id;
                const line = rowLine(p);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${monthLong(p.month)}, locked`}
                      onClick={() => setChosenId(p.id)}
                      className={cn('flex min-h-[56px] w-full items-center justify-between gap-3 border bg-wds-neutral-50 p-3.5 text-left focus-visible:outline-none focus-visible:shadow-wds-ring', on ? 'border-wds-selected-edge' : 'border-wds-border')}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className={cn('font-wds-sans text-[15px] leading-[18px] text-wds-text-ink', on ? 'font-semibold' : 'font-medium')}>{monthLong(p.month)}</span>
                        <span className={cn('font-wds-sans text-[12px] leading-4', line.paid ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>{line.text}</span>
                      </span>
                      <span aria-hidden className="font-wds-mono text-[13px] leading-4 text-wds-text-faint">
                        locked
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <CodeBlock
              hasCode={hasCode}
              monthLabel={chosen ? monthName(chosen.month) : 'payslips'}
              who={nameAndRole(user?.name ?? 'the owner', user?.role)}
              busy={entry.busy}
              problem={entry.problem}
              wait={entry.wait}
              onUnlock={entry.unlock}
              onSetCode={entry.setCode}
              onEdit={entry.clearProblem}
            />
          </>
        ) : null}
      </>
    );
  }

  return (
    <PhoneScreen screen={PAYSLIP_COPY.screen} kicker="MY PAYSLIPS" back={back} desktopTitle="My payslips">
      {body}
    </PhoneScreen>
  );
}
