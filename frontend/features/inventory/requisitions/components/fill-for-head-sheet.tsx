'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Input } from '@/components/ui2/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { Skeleton } from '@/components/ui2/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { ErrorState } from '@/components/app/shell/shell-states';
import { useAction, useLoader } from '../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../_shared/hooks/use-idempotency-key';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import type { AddableItem, RequisitionLine } from '../_shared/types/requisitions-contract';
import { errorWords } from '../_shared/lib/requisitions-words';
import { MonoLabel, PinField } from './req-parts';

interface Draft {
  itemId: string;
  itemName: string;
  unit: string;
  qty: string;
}

const fromLine = (l: RequisitionLine): Draft => ({ itemId: l.itemId, itemName: l.itemName, unit: l.unit, qty: l.requestedQty });

/**
 * "Fill it myself" (Amendment 2; not drawn in Paper, built in the drawer style). The Branch Manager edits a section that is Not
 * started or Draft, then sends it with their own PIN. It is recorded as sent by the Branch Manager for that department and the head is told.
 */
export function FillForHeadSheet({ requisitionId, departmentId, departmentName, onOpenChange, onSent }: {
  requisitionId: string;
  departmentId: string | null;
  departmentName: string;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}) {
  const open = departmentId !== null;
  const edit = useLoader(open ? `section:${requisitionId}:${departmentId}` : null, () => requisitionsApi.section(requisitionId, departmentId ?? ''), 'Could not load the section.');
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [pin, setPin] = React.useState('');
  const [adding, setAdding] = React.useState('');
  const idem = useIdempotencyKey();
  const save = useAction(async (lines: Draft[]) => requisitionsApi.saveLines(requisitionId, departmentId ?? '', { lines: lines.map((l) => ({ itemId: l.itemId, requestedQty: l.qty })) }), 'Could not save the list. Try again.');
  const send = useAction(async (lines: Draft[], code: string) => {
    await requisitionsApi.saveLines(requisitionId, departmentId ?? '', { lines: lines.map((l) => ({ itemId: l.itemId, requestedQty: l.qty })) });
    return requisitionsApi.send(requisitionId, departmentId ?? '', { pin: code }, idem.key());
  }, 'Could not send the list. Nothing was signed. Try again.');

  React.useEffect(() => {
    if (edit.data) setDrafts(edit.data.section.lines.map(fromLine));
  }, [edit.data]);
  React.useEffect(() => {
    if (open) {
      setPin('');
      setAdding('');
      save.clear();
      send.clear();
      idem.renew();
    }
    // Reset only when the sheet opens; the helpers are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addable: AddableItem[] = (edit.data?.addable ?? []).filter((a) => !drafts.some((d) => d.itemId === a.itemId));
  const valid = drafts.length > 0 && drafts.every((d) => Number(d.qty) > 0);
  const failure = send.failure ?? save.failure;
  const failureText = failure ? errorWords(failure.code, 'manager', failure.message, failure.message) : null;
  const busy = save.saving || send.saving;

  const submit = async (): Promise<void> => {
    if (!valid || pin.length !== 4) return;
    const result = await send.run(drafts, pin);
    if (result) onSent();
    else setPin('');
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <SheetContent side="right" className="w-[560px]">
        <SheetHeader>
          <SheetTitle>Fill {departmentName}&apos;s list</SheetTitle>
          <SheetDescription>You send it for them with your own PIN. It is recorded as sent by the Branch Manager, and the {departmentName} head is told.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {edit.status === 'error' ? (
            <ErrorState title="Couldn't load the section" description="Check your connection and try again." onRetry={() => void edit.reload()} />
          ) : !edit.data ? (
            <div aria-hidden className="flex flex-col gap-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_120px_32px] gap-3">
                <MonoLabel>Item</MonoLabel>
                <MonoLabel className="text-right">Requested</MonoLabel>
                <span />
              </div>
              <ul className="flex flex-col">
                {drafts.map((d, index) => (
                  <li key={d.itemId} className="grid grid-cols-[1fr_120px_32px] items-center gap-3 border-b border-wds-border py-2">
                    <span className="font-wds-sans text-[15px] text-wds-text-ink">
                      {d.itemName} <span className="text-wds-text-secondary">· {d.unit}</span>
                    </span>
                    <Input
                      aria-label={`Quantity of ${d.itemName}`}
                      inputMode="decimal"
                      value={d.qty}
                      onChange={(event) => setDrafts((all) => all.map((x, i) => (i === index ? { ...x, qty: event.target.value } : x)))}
                      className="h-9 text-right font-wds-mono"
                    />
                    <button type="button" aria-label={`Remove ${d.itemName}`} onClick={() => setDrafts((all) => all.filter((_, i) => i !== index))} className="size-8 text-[18px] text-wds-text-faint outline-none hover:text-wds-text-ink focus-visible:shadow-wds-ring">
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
              {drafts.length === 0 ? <p className="font-wds-sans text-[14px] text-wds-text-secondary">Nothing in the list yet. Add an item below.</p> : null}
              {addable.length > 0 ? (
                <Select
                  value={adding}
                  onValueChange={(itemId) => {
                    const item = addable.find((a) => a.itemId === itemId);
                    if (item) setDrafts((all) => [...all, { itemId: item.itemId, itemName: item.itemName, unit: item.unit, qty: item.suggestedQty || '1' }]);
                    setAdding('');
                  }}
                >
                  <SelectTrigger aria-label="Add an item" className="h-10"><SelectValue placeholder="Add an item" /></SelectTrigger>
                  <SelectContent>
                    {addable.map((a) => (
                      <SelectItem key={a.itemId} value={a.itemId}>{a.itemName} · {a.unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <PinField value={pin} onChange={setPin} onSubmit={() => void submit()} invalid={failure?.code === 'INVALID_PIN'} id="fill-pin" />
              {failureText ? <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-2.5 font-wds-sans text-[13px] text-wds-error-fg">{failureText}</p> : null}
            </>
          )}
        </div>
        <SheetFooter>
          <Button variant="secondary" onClick={() => void save.run(drafts).then((r) => r && onOpenChange(false))} disabled={busy || drafts.length === 0 || !valid}>
            Save as draft
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !valid || pin.length !== 4}>
            {send.saving ? 'Sending…' : `Send ${departmentName}'s list`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
