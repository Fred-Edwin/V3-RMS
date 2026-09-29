import * as React from 'react';

import type { DeliveryNote } from '../types';

/**
 * Printable Delivery Note (`15QW-0` clean / `15SU-0` discrepancy) — A4
 * print layout. Mirrors `printable-requisition.tsx`'s standalone-document
 * convention: Times New Roman serif, not the app's Geist sans, per Paper's
 * own print artboards. One `Dispatch` record, two renderers (this + the
 * on-screen `DeliveryNoteScreen`) — see session-a-plan.md decision #5.
 */
export interface PrintableDeliveryNoteProps {
  note: DeliveryNote;
  requisitionLabel: string;
}

const DEPARTMENT_LABEL: Record<string, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

function formatDateLabel(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function statusLabel(status: DeliveryNote['status']): string {
  if (status === 'CONFIRMED') return 'Received';
  if (status === 'DISCREPANCY_OPEN') return 'Received with discrepancy';
  return 'In transit';
}

export function PrintableDeliveryNote({ note, requisitionLabel }: PrintableDeliveryNoteProps) {
  const isConfirmed = note.status === 'CONFIRMED' || note.status === 'DISCREPANCY_OPEN';
  const shortLines = note.lines.filter((l) => l.confirmedQty !== null && Number(l.confirmedQty) < Number(l.dispatchedQty));

  return (
    <div className="mx-auto flex w-[794px] min-h-[1123px] flex-col bg-white font-['Times_New_Roman',serif] text-[#111111] print:w-full">
      <div className="flex flex-col gap-5 px-12 pt-10">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="text-[30px] leading-9 font-bold tracking-tight">Wendo Coffee Bistro</div>
            <div className="text-caption tracking-[0.02em] text-[#555555]">Central Store</div>
          </div>
          <div className="flex flex-col items-end gap-[3px]">
            <div className="text-[20px] leading-6 font-bold tracking-tight">DELIVERY NOTE</div>
            <div className="text-body-sm text-[#333333]">{note.sequenceLabel}</div>
            <div className="text-caption text-[#777777]">{formatDateLabel(note.dispatchedAt)}</div>
          </div>
        </div>
        <div className="h-[2px] shrink-0 bg-[#111111]" />
      </div>

      <div className="flex gap-8 border-b border-[#CCCCCC] px-12 py-5">
        <div className="flex grow basis-0 flex-col gap-[5px]">
          <div className="text-label font-bold uppercase tracking-[0.06em] text-[#777777]">From</div>
          <div className="text-body font-bold">Central Store (Hub)</div>
          <div className="text-body-sm text-[#555555]">Dispatched by {note.dispatchedByName ?? '—'}, Store Manager</div>
        </div>
        <div className="flex grow basis-0 flex-col gap-[5px]">
          <div className="text-label font-bold uppercase tracking-[0.06em] text-[#777777]">To</div>
          <div className="text-body font-bold">
            {note.branchName} Branch — {DEPARTMENT_LABEL[note.departmentTag] ?? note.departmentTag}
          </div>
          <div className="text-body-sm text-[#555555]">Against {requisitionLabel}</div>
        </div>
        <div className="flex grow basis-0 flex-col gap-[5px]">
          <div className="text-label font-bold uppercase tracking-[0.06em] text-[#777777]">Status</div>
          <div className="text-body-sm font-bold uppercase tracking-[0.04em] text-[#1F3A5F]">{statusLabel(note.status)}</div>
        </div>
      </div>

      <div className="flex flex-col px-12 py-5">
        <div className="flex gap-3 bg-[#1F3A5F] px-3 py-[9px]">
          <div className="grow-[3] basis-0 text-caption font-bold uppercase tracking-[0.06em] text-white">Item</div>
          <div className="grow basis-0 text-right text-caption font-bold uppercase tracking-[0.06em] text-white">Requested</div>
          <div className="grow basis-0 text-right text-caption font-bold uppercase tracking-[0.06em] text-white">Dispatched</div>
          <div className="grow-[1.5] basis-0 text-right text-caption font-bold uppercase tracking-[0.06em] text-white">Note</div>
        </div>
        {note.lines.map((line) => {
          const short = line.confirmedQty !== null && Number(line.confirmedQty) < Number(line.dispatchedQty);
          const shortBy = short ? Number(line.dispatchedQty) - Number(line.confirmedQty!) : 0;
          return (
            <div key={line.inventoryItemId} className="flex gap-3 border-b border-[#DDDDDD] px-3 py-[11px]">
              <div className="grow-[3] basis-0 text-body-sm">{line.itemName}</div>
              <div className="grow basis-0 text-right text-body-sm">
                {line.requestedQty ?? '—'} {line.usageUnit}
              </div>
              <div className={'grow basis-0 text-right text-body-sm ' + (short ? 'font-bold' : 'text-[#555555]')}>
                {line.dispatchedQty} {line.usageUnit}
              </div>
              <div className={'grow-[1.5] basis-0 text-right text-body-sm ' + (short ? 'font-bold' : '')}>
                {short ? `Short ${shortBy} ${line.usageUnit}` : line.isSubstitute ? (line.substituteNote ?? 'Substitute') : '—'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-12 mt-2 flex flex-col gap-1 border-l-[3px] border-[#1F3A5F] bg-[#F5F5F5] px-4 py-3">
        <div className="text-label font-bold uppercase tracking-[0.06em] text-[#777777]">Notes</div>
        <div className="text-caption leading-[17px] text-[#555555]">
          This copy carries no cost figures. Confirm each line on receipt — any difference against the dispatched
          quantity raises a transit discrepancy.
          {shortLines.length > 0
            ? ` ${shortLines.map((l) => `${l.itemName} short by ${Number(l.dispatchedQty) - Number(l.confirmedQty)} ${l.usageUnit}`).join('; ')} against the dispatched amount; shortfall recorded as a discrepancy for the Store Manager to resolve.`
            : ''}
        </div>
      </div>

      <div className="mx-12 my-6 flex gap-10">
        <div className="flex grow basis-0 flex-col gap-1">
          <div className="text-label font-bold uppercase tracking-[0.06em] text-[#777777]">Dispatched by</div>
          <div className="flex h-[34px] shrink-0 items-end pb-0.5">
            <div className="font-wds-signature text-[26px] leading-8">{note.dispatchedByName ?? '—'}</div>
          </div>
          <div className="flex flex-col gap-0.5 border-t border-[#111111] pt-[5px]">
            <div className="text-caption font-bold">{note.dispatchedByName ?? '—'}, Store Manager</div>
            <div className="text-label text-[#777777]">{formatDateTime(note.dispatchedAt)}</div>
          </div>
        </div>
        <div className="flex grow basis-0 flex-col gap-1">
          <div className="text-label font-bold uppercase tracking-[0.06em] text-[#777777]">Received by</div>
          <div className="flex h-[34px] shrink-0 items-end pb-0.5">
            {isConfirmed ? (
              <div className="font-wds-signature text-[26px] leading-8">{note.confirmedByName ?? '—'}</div>
            ) : (
              <div className="text-body-sm text-[#999999]">— not yet received —</div>
            )}
          </div>
          <div className="flex flex-col gap-0.5 border-t border-[#111111] pt-[5px]">
            <div className="text-caption font-bold">
              {isConfirmed ? `${note.confirmedByName ?? '—'}, ${DEPARTMENT_LABEL[note.departmentTag] ?? note.departmentTag} — ${note.branchName}` : `${DEPARTMENT_LABEL[note.departmentTag] ?? note.departmentTag}, ${note.branchName}`}
            </div>
            <div className="text-label text-[#777777]">{isConfirmed ? formatDateTime(note.confirmedAt) : '—'}</div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-[#CCCCCC] px-12 py-3">
        <div className="text-label text-[#999999]">Generated by Wendo RMS</div>
        <div className="text-label text-[#999999]">Page 1 of 1</div>
      </div>
    </div>
  );
}
