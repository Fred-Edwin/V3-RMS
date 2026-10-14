'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { useAction } from '../../../_shared/hooks/use-async';
import { useAttendantData } from '../../hooks/use-attendant';
import { kes, qty } from '../../lib/format';
import { useRestockList } from '../../store/restock-list-store';
import type { TrackerItem, TrackerStep } from '../../types';
import type { ReviewGroup } from '../../types/attendant';
import { CompactTracker } from '../compact-tracker';
import { PURCHASING, orderHref } from './order-cards';
import { Card, Label, PhoneBar, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, PrimaryButton, StatusLine, WriteError, plural, roleText, useGoBack, withRole } from './phone-kit';

const STEPS: TrackerStep[] = ['RAISED', 'APPROVED', 'SENT', 'DELIVERED', 'INVOICED', 'PAID'];
const RAISING: TrackerItem[] = STEPS.map((step, i) => ({ step, state: i === 0 ? 'CURRENT' : 'TODO', at: null, note: null }));

type Outcome = { kind: 'sent' } | { kind: 'failed'; message: string };

function GroupCard({ group, outcome, approver }: { group: ReviewGroup; outcome?: Outcome; approver: Parameters<typeof withRole>[0] }) {
  const blocked = group.problem !== null; // an open order only warns (it is confirmed at send); a missing price blocks
  return (
    <li>
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-3">
          <div className="min-w-0">
            <p className="truncate font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{group.supplier.name}</p>
            <p className="font-wds-mono text-[11px] uppercase leading-[14px] text-wds-text-secondary">
              ORDER {group.orderNumber} · {plural(group.itemCount, 'ITEM')}
            </p>
          </div>
          <p className="shrink-0 font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{Number.parseFloat(group.estimatedTotal || '0') > 0 ? kes(group.estimatedTotal) : '—'}</p>
        </div>
        <ul>
          {group.lines.map((l) => (
            <li key={l.inventoryItemId} className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-2.5 last:border-b-0">
              <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{l.itemName}</span>
              <span className="shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">
                {qty(l.qty)} {l.buyUnit}
              </span>
            </li>
          ))}
        </ul>
        {blocked ? (
          <div className="border-t border-wds-warning-border bg-wds-warning-bg px-3.5 py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
            {group.problem === 'SUPPLIER_ORDER_OPEN' && group.openOrder ? (
              <>
                {group.supplier.name} already has {group.openOrder.reference ?? 'an order'} open. Sending adds another order.{' '}
                <Link href={orderHref(group.openOrder.id)} className="font-medium underline underline-offset-2 outline-none focus-visible:shadow-wds-ring">
                  Open it
                </Link>
              </>
            ) : (
              <>Some of these items are not set up to buy from {group.supplier.name} yet (a price is missing), so this one is not sent. Ask {withRole(approver)} to finish the setup in Catalog.</>
            )}
          </div>
        ) : null}
        {outcome?.kind === 'sent' ? <StatusLine tone="success" className="border-t border-wds-border px-3.5 py-2.5">Sent for approval</StatusLine> : null}
        {outcome?.kind === 'failed' ? (
          <p role="alert" className="border-t border-wds-error-border bg-wds-error-bg px-3.5 py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
            {outcome.message}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

/** 28C: review the list, one order per supplier, and send it to the Store Manager for approval. */
export function ReviewScreen() {
  const router = useRouter();
  const back = useGoBack(`${PURCHASING}/restock`);
  const list = useRestockList();
  const addToast = useWdsToastStore((s) => s.addToast);
  const [note, setNote] = React.useState('');
  const [outcomes, setOutcomes] = React.useState<Record<string, Outcome>>({});
  // After a full send the list is emptied a moment before My orders opens; this keeps the screen from flashing "0 items" or an empty list.
  const [leaving, setLeaving] = React.useState(false);
  const wire = React.useMemo(() => list.lines.map((l) => ({ inventoryItemId: l.inventoryItemId, qty: l.qty, ...(l.supplierId ? { supplierId: l.supplierId } : {}) })), [list.lines]);
  const key = wire.length === 0 ? null : `review:${wire.map((l) => `${l.inventoryItemId}:${l.qty}:${l.supplierId ?? ''}`).join(',')}`;
  const { data, status, error, reload, service } = useAttendantData(key, (s) => s.reviewRestockList(wire), 'We could not review your list.');
  const send = useAction((lines: typeof wire, text: string | null, another: boolean) => service.sendRestockList(lines, text, another), 'We could not send the list. Nothing was changed.');
  const [askAnother, setAskAnother] = React.useState(false);

  // A supplier with an open order is still sent, after one question (training fix 6); only a missing price stops a group.
  const sendable = data?.groups.filter((g) => g.problem !== 'ITEM_SETUP_INCOMPLETE' && outcomes[g.supplier.id]?.kind !== 'sent') ?? [];
  const approverName = data?.approver?.name.split(' ')[0] ?? 'the Store Manager';
  const approverRole = data?.approver ? roleText(data.approver.role) : 'Store Manager';

  const onSend = async (confirmedAnother = false): Promise<void> => {
    if (!data || sendable.length === 0) return;
    if (!confirmedAnother && sendable.some((g) => g.openOrder)) {
      setAskAnother(true);
      return;
    }
    const lines = sendable.flatMap((g) => g.lines.map((l) => ({ inventoryItemId: l.inventoryItemId, qty: l.qty, supplierId: g.supplier.id })));
    const result = await send.run(lines, note.trim() === '' ? null : note.trim(), sendable.some((g) => g.openOrder !== null));
    if (!result) return;
    const next: Record<string, Outcome> = { ...outcomes };
    for (const s of result.sent) next[s.supplier.id] = { kind: 'sent' };
    for (const f of result.failed) next[f.supplier.id] = { kind: 'failed', message: f.message };
    setOutcomes(next);
    // Fully sent: the list is done. Partly sent: the list stays whole so every card keeps its own result ("Sent", or the server's words)
    // and a second tap only sends the suppliers that are not sent yet.
    if (result.failed.length === 0) {
      setLeaving(true);
      list.clear();
      addToast({ variant: 'success', title: `${plural(result.sent.length, 'order')} sent to ${withRole(data.approver)}`, description: 'They will tell you as soon as it is decided.' });
      router.replace(`${PURCHASING}/my-orders`);
    }
  };

  return (
    <PhoneScreen
      header={<B2Header title="Review your list" subtitle={
        leaving
          ? 'Sent for approval'
          : data
            ? `${plural(sendable.reduce((n, g) => n + g.itemCount, 0), 'item')} to send · each supplier gets its own order`
            : `${plural(list.count, 'item')} · each supplier gets its own order`
      } leading="back" onBack={back} place="HUB" />}
      bar={
        data && data.groups.length > 0 ? (
          <PhoneBar gap={10}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{plural(sendable.length, 'order')} · estimated total</p>
              <p className="font-wds-mono text-[16px] leading-5 text-wds-text-ink">{(() => {
                  const sum = sendable.reduce((s, g) => s + Number.parseFloat(g.estimatedTotal || '0'), 0);
                  return sum > 0 ? `KES ${kes(sum)}` : '—';
                })()}</p>
            </div>
            <PrimaryButton onClick={() => void onSend(false)} disabled={sendable.length === 0 || send.saving} aria-busy={send.saving}>
              {send.saving ? 'Sending…' : 'Send for approval'}
            </PrimaryButton>
          </PhoneBar>
        ) : undefined
      }
    >
      <CompactTracker tracker={RAISING} strip />
      {leaving ? (
        <div className="min-h-[200px]" />
      ) : list.count === 0 && Object.keys(outcomes).length === 0 ? (
        <PhoneEmpty title="Nothing on your list" line="Add the items you want to restock first." action={{ label: 'Build restock list', href: `${PURCHASING}/restock` }} />
      ) : status === 'loading' || status === 'idle' ? (
        <PhoneLoading rows={2} card label="Reviewing your list" />
      ) : (
        <div className="flex flex-col gap-3.5 px-5 py-4">
          {status === 'error' ? <PhoneError onRetry={() => void reload()} message={error} /> : null}
          {send.failure ? <WriteError>{send.failure.message}</WriteError> : null}
          {data ? (
            <>
              {data.unsupplied.length > 0 ? (
                <div role="status" className="border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
                  <p className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-warning-fg">{plural(data.unsupplied.length, 'item')} {data.unsupplied.length === 1 ? 'has' : 'have'} no supplier</p>
                  <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
                    {data.unsupplied.map((u) => u.itemName).join(', ')}. Ask {withRole(data.approver)} to set one in Catalog. {data.unsupplied.length === 1 ? 'It is' : 'They are'} left out of this send.
                  </p>
                </div>
              ) : null}
              <ul className="flex flex-col gap-3.5">
                {data.groups.map((g) => (
                  <GroupCard key={g.supplier.id} group={g} outcome={outcomes[g.supplier.id]} approver={data.approver} />
                ))}
              </ul>
              {data.groups.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <Label>
                    NOTE FOR {approverName}, {approverRole} (OPTIONAL)
                  </Label>
                  <textarea
                    aria-label={`Note for ${approverName}, ${approverRole}, optional`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full resize-none rounded-[2px] border border-wds-border-strong bg-white px-3 py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink outline-none focus-visible:border-[var(--wds-primary-btn-start)] focus-visible:shadow-wds-ring"
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
      <ConfirmDialog
        open={askAnother}
        onOpenChange={setAskAnother}
        title="Add another order?"
        description="There is already an open order to this supplier. Add another?"
        confirmLabel="Continue"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={() => {
          setAskAnother(false);
          void onSend(true);
        }}
      />
    </PhoneScreen>
  );
}
