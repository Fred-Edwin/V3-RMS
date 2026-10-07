'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { Button } from '@/components/ui2/button';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { FormErrorBanner } from '../../_shared/components/stock-states';
import { useAction, useLoader } from '../../_shared/hooks/use-async';
import { usePurchasing } from '../hooks/use-purchasing';
import type { Order } from '../types';

/**
 * Send on WhatsApp (Paper `08`): the message and the PDF, then "Download PDF and open WhatsApp". Continuing marks the order Sent.
 * Nothing is sent from the server: the person's browser opens the printable LPO and a WhatsApp link, and the order is recorded as sent.
 */
export function SendWhatsappDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { service } = usePurchasing();
  const addToast = useWdsToastStore((s) => s.addToast);
  const loader = useLoader(open ? `wa:${order.id}` : null, () => service.getWhatsapp(order.id), 'We could not prepare the message.');
  const go = useAction(async () => {
    const msg = loader.data;
    // Open both windows before awaiting, while the click still counts as a user action.
    window.open(`/app/inventory/purchasing-print/${order.id}`, '_blank', 'noopener');
    if (msg?.phone) window.open(`https://wa.me/${msg.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg.message)}`, '_blank', 'noopener');
    const sent = await service.sendOrder(order.id, 'WHATSAPP');
    addToast({ variant: 'success', title: `${sent.reference} marked as sent`, description: 'The PDF is open for you to attach.' });
    onOpenChange(false);
    return sent;
  }, 'We could not mark the order as sent. Try again.');

  React.useEffect(() => {
    if (open) go.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear the last error each time the dialog opens
  }, [open]);

  const msg = loader.data;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (!go.saving ? onOpenChange(o) : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-wds-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-wds-lg border border-wds-border bg-wds-surface shadow-wds-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex items-start justify-between border-b border-wds-border px-6 pb-4 pt-5">
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className="font-wds-sans text-wds-section font-semibold text-wds-neutral-950">Send {order.reference} on WhatsApp</DialogPrimitive.Title>
              <DialogPrimitive.Description className="font-wds-sans text-wds-caption text-wds-text-secondary">{msg ? `To ${msg.to}` : 'Preparing the message…'}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="text-[16px] leading-5 text-wds-text-faint outline-none hover:opacity-70 focus-visible:shadow-wds-ring" aria-label="Close">
              &times;
            </DialogPrimitive.Close>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5">
            {loader.status === 'error' ? <FormErrorBanner title="We couldn't prepare the message" description={loader.error ?? 'Close this and try again.'} /> : null}
            {go.failure ? <FormErrorBanner title="We couldn't finish" description={go.failure.message} /> : null}
            <div className="flex flex-col gap-1.5">
              <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">Message</span>
              <p className="rounded-wds-sm border border-wds-border bg-wds-surface-sunken px-3 py-2.5 font-wds-sans text-wds-body-sm text-wds-neutral-950">{msg?.message ?? '…'}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">Attachment</span>
              <div className="flex items-center gap-3 rounded-wds-sm border border-wds-border px-3 py-2.5">
                <span className="flex h-10 w-8 items-center justify-center rounded-[2px] bg-wds-error-bg font-wds-mono text-[9px] font-semibold text-wds-error-fg">PDF</span>
                <div className="flex flex-col">
                  <span className="font-wds-sans text-wds-body-sm text-wds-neutral-950">{msg?.pdfFileName ?? '—'}</span>
                  <span className="font-wds-sans text-[11px] text-wds-text-secondary">{msg?.pdfSizeLabel ?? ''}</span>
                </div>
              </div>
            </div>
            <ol className="flex flex-col gap-2 font-wds-sans text-wds-caption text-wds-text-secondary">
              {['The PDF opens in a new tab to save or print.', 'WhatsApp opens on the supplier’s chat with the message filled in. Attach the PDF and press send.', 'On a phone, the PDF and the message are shared together from the share sheet.'].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-wds-neutral-100 font-wds-mono text-[10px] text-wds-neutral-950">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-wds-border px-6 py-4">
            <span className="font-wds-sans text-wds-caption text-wds-text-secondary">The order is marked Sent when you continue.</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={go.saving}>
                Cancel
              </Button>
              <Button onClick={() => void go.run()} disabled={go.saving || loader.status !== 'ready'}>
                {go.saving ? 'Marking as sent…' : 'Download PDF and open WhatsApp'}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
