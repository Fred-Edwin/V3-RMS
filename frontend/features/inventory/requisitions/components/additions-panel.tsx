'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { DecisionDialog } from '../../_shared/components/decision-dialog';
import { useAction } from '../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../_shared/hooks/use-idempotency-key';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import type { Addition, ApproveAdditionResult, RequisitionFile } from '../_shared/types/requisitions-contract';
import { clock, errorWords, kes } from '../_shared/lib/requisitions-words';
import { MonoLabel, PinField } from './req-parts';

/** "Already approved" is the department's approved quantity for the same item before this addition; none for a new item. */
function alreadyApproved(file: RequisitionFile, addition: Addition, itemId: string): string | null {
  const section = file.sections.find((s) => s.departmentId === addition.departmentId);
  const line = section?.lines.find((l) => l.itemId === itemId && l.additionId === null);
  return line ? (line.approvedQty ?? line.requestedQty) : null;
}

/** The block Paper draws under the Next step card while an addition waits, and its approved record afterwards. */
export function AdditionsPanel({ file, onApprove }: { file: RequisitionFile; onApprove: (addition: Addition) => void }) {
  if (file.additions.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {file.additions.map((addition) => {
        const pending = addition.status === 'PENDING';
        return (
          <section key={addition.id} aria-label={`Added after approval, ${addition.departmentName}`} className="border border-wds-warning-border">
            <div className="flex items-center justify-between gap-4 border-b border-wds-warning-border bg-wds-caramel-300/40 px-4 py-3">
              <h3 className="font-wds-sans text-[16px] font-semibold text-wds-warning-fg">
                Added after approval · {addition.departmentName}
                <span className="ml-2 font-normal">
                  {pending ? `waiting since ${clock(addition.addedAt)}` : addition.approvedAt ? `approved ${clock(addition.approvedAt)}` : ''}
                </span>
              </h3>
              <div className="flex items-center gap-4">
                {addition.valueKes !== undefined ? <span className="font-wds-mono text-[16px] text-wds-text-ink">KES {kes(addition.valueKes)}</span> : null}
                {pending && addition.can.approve ? (
                  <Button onClick={() => onApprove(addition)}>
                    Approve addition<span className="sr-only"> for {addition.departmentName}</span>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_120px_96px_84px] xl:grid-cols-[minmax(0,1fr)_170px_130px_110px] gap-4 border-b border-wds-border px-4 py-2.5">
              <MonoLabel>Item</MonoLabel>
              <MonoLabel className="text-right">Already approved</MonoLabel>
              <MonoLabel className="text-right">Added</MonoLabel>
              <MonoLabel className="text-right">{addition.valueKes !== undefined ? 'Value (KES)' : ''}</MonoLabel>
            </div>
            <ul>
              {addition.lines.map((line) => {
                const before = alreadyApproved(file, addition, line.itemId);
                return (
                  <li key={line.id} className="grid grid-cols-[minmax(0,1fr)_120px_96px_84px] xl:grid-cols-[minmax(0,1fr)_170px_130px_110px] items-center gap-4 border-b border-wds-border px-4 py-3 last:border-b-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-wds-sans text-[15px] font-medium text-wds-text-ink">{line.itemName}</span>
                      <span className="font-wds-sans text-[14px] text-wds-text-secondary">
                        {before === null ? 'New item' : 'More of an approved item'}
                        {line.onHand !== undefined ? ` · On hand ${line.onHand} ${line.unit}` : ''}
                      </span>
                    </div>
                    <span className="text-right font-wds-mono text-[15px] text-wds-text-secondary">{before === null ? 'none' : `${before} ${line.unit}`}</span>
                    <span className="text-right font-wds-mono text-[15px] font-semibold text-wds-text-ink">
                      {before === null ? '' : '+'}
                      {line.requestedQty} {line.unit}
                    </span>
                    <span className="text-right font-wds-mono text-[15px] text-wds-text-ink">{line.valueKes === undefined ? '' : kes(line.valueKes)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Paper step 16's dialog: one PIN approves the addition and sends its lines to the Central Store. */
export function ApproveAdditionDialog({ file, addition, onOpenChange, onApproved }: {
  file: RequisitionFile;
  addition: Addition | null;
  onOpenChange: (open: boolean) => void;
  onApproved: (result: ApproveAdditionResult) => void;
}) {
  const [pin, setPin] = React.useState('');
  const idem = useIdempotencyKey();
  const open = addition !== null;
  const approve = useAction((input: { pin: string }) => requisitionsApi.approveAddition(file.id, addition?.id ?? '', input, idem.key()), 'Could not approve the addition. Nothing was signed. Try again.');
  const approvedLines = file.sections.find((s) => s.departmentId === addition?.departmentId)?.lines.filter((l) => l.additionId === null).length ?? 0;
  const failure = approve.failure ? errorWords(approve.failure.code, 'manager', approve.failure.message, approve.failure.message) : null;

  React.useEffect(() => {
    if (open) {
      setPin('');
      approve.clear();
      idem.renew();
    }
    // Reset only when the dialog opens; the helpers are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (): Promise<void> => {
    if (pin.length !== 4) return;
    const result = await approve.run({ pin });
    if (result) onApproved(result);
    else setPin('');
  };

  return (
    <DecisionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Approve the addition"
      description={addition ? `${file.reference} · ${addition.departmentName} · ${addition.lines.length} ${addition.lines.length === 1 ? 'line' : 'lines'}${addition.valueKes !== undefined ? ` · KES ${kes(addition.valueKes)}` : ''}` : ''}
      error={failure}
      busy={approve.saving}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={approve.saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={pin.length !== 4 || approve.saving}>
            {approve.saving ? 'Signing…' : 'Approve and sign'}
          </Button>
        </>
      }
    >
      <p className="font-wds-sans text-[15px] leading-[22px] text-wds-text-ink">
        Your signature adds {addition?.lines.length === 1 ? 'this 1 line' : `these ${addition?.lines.length ?? 0} lines`} to the {addition?.departmentName}&apos;s part of the requisition and sends {addition?.lines.length === 1 ? 'it' : 'them'} to the Central Store. The {approvedLines} approved {approvedLines === 1 ? 'line stays' : 'lines stay'} as {approvedLines === 1 ? 'it is' : 'they are'}.
      </p>
      <PinField value={pin} onChange={setPin} onSubmit={() => void submit()} invalid={approve.failure?.code === 'INVALID_PIN'} id="addition-pin" />
    </DecisionDialog>
  );
}
