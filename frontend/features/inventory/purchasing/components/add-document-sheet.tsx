'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Input } from '@/components/ui2/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { FormErrorBanner } from '../../_shared/components/stock-states';
import { useAction } from '../../_shared/hooks/use-async';
import { useIsNarrow } from '../hooks/use-order';
import { usePurchasing } from '../hooks/use-purchasing';
import type { FileRef, Order } from '../types';
import { FieldLabel } from './parts';
import { PhotoSlot } from './photo-slot';

/** "+ Add a document" on the purchase file (Paper `22`): a name and a photo or PDF, kept with the purchase and shown in Documents. */
export function AddDocumentSheet({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { service } = usePurchasing();
  const narrow = useIsNarrow();
  const addToast = useWdsToastStore((s) => s.addToast);
  const [title, setTitle] = React.useState('');
  const [file, setFile] = React.useState<FileRef | null>(null);

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setFile(null);
      save.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the drawer opens
  }, [open]);

  const save = useAction(async () => {
    const doc = await service.addDocument(order.id, { title, fileId: (file as FileRef).id });
    addToast({ variant: 'success', title: 'Document added', description: `${doc.title} is in the documents of ${order.reference}.` });
    onOpenChange(false);
    return doc;
  }, 'We could not add the document. Try again.');

  return (
    <Sheet open={open} onOpenChange={(o) => (!save.saving ? onOpenChange(o) : undefined)}>
      <SheetContent side={narrow ? 'bottom' : 'right'} className={cn(narrow ? 'max-h-[92vh] rounded-t-wds-lg' : 'w-[460px] max-w-full')}>
        <SheetHeader>
          <SheetTitle className="flex items-baseline gap-2.5 font-wds-sans text-wds-section font-semibold text-wds-neutral-950">
            Add a document
            <span className="font-wds-mono text-wds-caption font-normal text-wds-text-secondary">{order.reference}</span>
          </SheetTitle>
          <SheetDescription className="font-wds-sans text-wds-caption text-wds-text-secondary">{order.supplier.name} · photos and PDFs, up to 10 MB</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-wds-6 py-wds-5">
          {save.failure ? <FormErrorBanner title="We couldn't add the document" description={save.failure.message} /> : null}
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="doc-title">What is it?</FieldLabel>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Supplier’s receipt" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Photo or PDF</FieldLabel>
            <PhotoSlot idPrefix="doc" value={file} onChange={setFile} label="Drop the document here" />
          </div>
        </div>
        <SheetFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={save.saving}>
            Cancel
          </Button>
          <Button onClick={() => void save.run()} disabled={save.saving || !title.trim() || !file}>
            {save.saving ? 'Adding…' : 'Add document'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
