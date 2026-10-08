'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { ErrorState } from '@/components/app/shell/shell-states';
import { useAction, useLoader } from '../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../_shared/hooks/use-idempotency-key';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import type { ApproveResult } from '../_shared/types/requisitions-contract';
import { changesSentence, errorWords, kes } from '../_shared/lib/requisitions-words';
import { MonoLabel, PinField } from './req-parts';

const SAYS = {
  one: 'One signature covers the whole requisition.',
  told: (heads: number) => `${heads === 1 ? 'The head is' : `The ${NUMBER_WORDS[heads] ?? heads} heads are`} told, and it goes to the Central Store's queue.`,
};
const NUMBER_WORDS: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight' };

/** Paper step 11. The summary is the server's (R10), so what is shown is what signing does. Focus is trapped and restored by the Sheet. */
export function ApproveDrawer({ requisitionId, open, onOpenChange, onApproved }: { requisitionId: string; open: boolean; onOpenChange: (open: boolean) => void; onApproved: (result: ApproveResult) => void }) {
  const summary = useLoader(open ? `approve-summary:${requisitionId}` : null, () => requisitionsApi.approveSummary(requisitionId), 'Could not load the summary.');
  const [pin, setPin] = React.useState('');
  const idem = useIdempotencyKey();
  const approve = useAction((input: { pin: string }) => requisitionsApi.approve(requisitionId, input, idem.key()), 'Could not approve. Nothing was signed. Try again.');
  const pinRef = React.useRef<HTMLInputElement>(null);
  const wrongPin = approve.failure?.code === 'INVALID_PIN';

  React.useEffect(() => {
    if (open) {
      setPin('');
      approve.clear();
      idem.renew();
    }
    // Reset only when the drawer opens; the helpers are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The PIN field mounts once the summary has loaded; focus it then, so a keyboard user can type straight away.
  React.useEffect(() => {
    if (open && summary.data) pinRef.current?.focus();
  }, [open, summary.data]);

  const submit = async (): Promise<void> => {
    if (pin.length !== 4) return;
    const result = await approve.run({ pin });
    if (result) {
      onApproved(result);
      return;
    }
    setPin('');
    pinRef.current?.focus();
  };

  const data = summary.data;
  const sent = data?.departments.filter((d) => d.status === 'SUBMITTED').length ?? 0;
  const failure = approve.failure ? errorWords(approve.failure.code, 'manager', approve.failure.message, approve.failure.message) : null;

  return (
    <Sheet open={open} onOpenChange={(next) => (approve.saving ? undefined : onOpenChange(next))}>
      <SheetContent
        side="right"
        className="w-[540px] max-w-full border-l border-wds-border-strong shadow-[-16px_0_48px_rgba(23,21,18,0.2)]"
        onOpenAutoFocus={(event) => { event.preventDefault(); pinRef.current?.focus(); }}
        onCloseAutoFocus={(event) => {
          // Opened from the list or a link there is no opener to return to: land on the Next step button, where signing starts.
          const button = document.querySelector<HTMLElement>('section[aria-label="Next step"] button');
          if (button) {
            event.preventDefault();
            button.focus();
          }
        }}
      >
        <SheetHeader className="!px-7 !pb-5 !pt-6">
          <SheetTitle className="text-[22px] font-semibold leading-7 tracking-[-0.01em]">Approve and sign</SheetTitle>
          <SheetDescription className="font-wds-mono">{data ? `${data.reference} · ${data.departments.length} departments` : 'Loading the summary'}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-7 py-6">
          {summary.status === 'error' ? (
            <ErrorState title="Couldn't load the summary" description="Check your connection and try again." onRetry={() => void summary.reload()} />
          ) : !data ? (
            <div aria-hidden className="flex flex-col gap-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>
          ) : (
            <>
              <section aria-label="What you are sending" className="border border-wds-border-strong bg-wds-surface">
                <div className="flex items-end justify-between border-b border-wds-neutral-950 px-5 pb-4 pt-[18px]">
                  <div className="flex flex-col gap-1">
                    <MonoLabel>What you are sending</MonoLabel>
                    <span className="font-wds-sans text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-wds-text-ink">{data.lineCount} lines</span>
                  </div>
                  {data.valueKes !== undefined ? <span className="font-wds-mono text-[22px] leading-7 text-wds-text-ink">KES {kes(data.valueKes)}</span> : null}
                </div>
                <ul>
                  {data.departments.map((d) => (
                    <li key={d.departmentId} className="flex items-center gap-3 border-b border-wds-border px-5 py-3 last:border-b-0">
                      <span className="grow font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{d.departmentName}</span>
                      <span className="w-[70px] shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{d.status === 'SKIPPED' ? 'sent without' : `${d.lineCount} ${d.lineCount === 1 ? 'line' : 'lines'}`}</span>
                      {d.valueKes !== undefined ? <span className="w-[90px] shrink-0 text-right font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{kes(d.valueKes)}</span> : null}
                    </li>
                  ))}
                </ul>
                {data.changes.length > 0 ? (
                  <p className="flex gap-2.5 border-t border-wds-warning-border bg-wds-warning-bg px-4 py-3 font-wds-sans text-[14px] leading-5 text-wds-warning-fg">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-wds-warning-fg" />
                    {changesSentence(data.changes)}
                  </p>
                ) : null}
              </section>
              <div className="flex flex-col gap-1.5 font-wds-sans text-[15px] leading-[22px] text-wds-text-ink">
                <p>{data.signatureLine || SAYS.one}</p>
                <p className="text-wds-text-secondary">{SAYS.told(sent)}</p>
                {data.signingAs !== 'BRANCH_MANAGER' ? <p className="text-wds-text-secondary">You are signing as {data.signingAs === 'DIRECTOR' ? 'the Director' : 'the System Admin'}. The file records who approved it.</p> : null}
              </div>
              <PinField ref={pinRef} value={pin} onChange={setPin} invalid={wrongPin} onSubmit={() => void submit()} />
              {failure ? (
                <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
                  {failure}
                </p>
              ) : null}
            </>
          )}
        </div>
        <SheetFooter className="!gap-2.5 !px-7 !py-[18px]">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={approve.saving} className="h-11 min-w-[88px] px-6 text-[15px]">
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!data || pin.length !== 4 || approve.saving} className="h-11 min-w-[162px] px-6 text-[15px]">
            {approve.saving ? 'Signing…' : 'Approve and sign'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
