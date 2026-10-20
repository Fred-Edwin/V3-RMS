'use client';

import * as React from 'react';

import { Callout, EmptyState, PhoneButton, SavedOnPhoneMarker } from '../../../_shared';
import { draftTotal, firstUnfinished } from '../../_shared/lib/casual-pay';
import { CASUAL_COPY, dayMonth, kes } from '../../_shared/lib/casual-words';
import type { DraftLine, Sheet } from '../../_shared/types/casual-types';
import { LineDrawer } from './line-drawer';
import { SheetStatusBlock } from './sheet-status';
import { WorkerCard } from './worker-card';

/**
 * The day under the header (spec S7): worker cards, "+ Add a casual", the total, Preview and Send. Recording, editing and preview work
 * with no signal (the lines are saved on the phone); Send waits for one. A day that is sent, approved or void is read-only here.
 */
export function DayBody({
  sheet,
  lines,
  pending,
  busy,
  today,
  onEdit,
  onSend,
  onTakeBack,
  onPreview,
}: {
  sheet: Sheet;
  lines: DraftLine[];
  pending: boolean;
  busy: boolean;
  /** True when the day shown is today: the window rule is the server's, this only words the empty state. */
  today: boolean;
  onEdit: (next: DraftLine[]) => void;
  onSend: () => void;
  onTakeBack: () => void;
  onPreview: () => void;
}) {
  const [drawer, setDrawer] = React.useState<{ open: boolean; line: DraftLine | null }>({ open: false, line: null });
  const editable = sheet.status === 'NONE' || sheet.status === 'DRAFT' || sheet.status === 'SENT_BACK';
  const rate = sheet.rate ?? '0';
  const unfinished = editable ? firstUnfinished(sheet.date, lines, Date.now()) : null;
  const sendReason = sheet.noRate ? CASUAL_COPY.noRate(sheet.departmentName) : lines.length === 0 ? CASUAL_COPY.sendNeedsOne : unfinished ? CASUAL_COPY.sendAfter(unfinished.name, unfinished.end) : null;
  const total = pending ? String(draftTotal(rate, lines) + sheet.corrections.reduce((sum, c) => sum + Math.round(Number(c.amount)), 0)) : sheet.total;
  const taken = React.useMemo(() => new Set(lines.map((l) => l.casualId)), [lines]);
  const save = (line: DraftLine) => {
    const others = lines.filter((l) => l.casualId !== line.casualId);
    onEdit([...others, line].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name)));
    setDrawer({ open: false, line: null });
  };

  return (
    <>
      <SheetStatusBlock sheet={sheet} busy={busy} onTakeBack={onTakeBack} />
      {sheet.noRate ? (
        <Callout tone="warning" role="alert">
          {CASUAL_COPY.noRate(sheet.departmentName)}
        </Callout>
      ) : null}
      {pending ? <SavedOnPhoneMarker what={CASUAL_COPY.saved} /> : null}
      {lines.length === 0 && !editable ? <EmptyState kind="nothingYet" title={CASUAL_COPY.empty.title} /> : null}
      {lines.length === 0 && editable && !sheet.noRate ? <EmptyState kind="nothingYet" title={today ? CASUAL_COPY.empty.title : 'No casuals recorded for this day.'} line={CASUAL_COPY.empty.line} /> : null}
      <ul aria-label="Casuals on this day" className="m-0 flex list-none flex-col gap-2.5 p-0">
        {lines.map((l) => (
          <WorkerCard key={l.casualId} line={l} rate={rate} onEdit={editable && !sheet.noRate ? () => setDrawer({ open: true, line: l }) : undefined} />
        ))}
      </ul>
      {editable && !sheet.noRate ? (
        <button type="button" onClick={() => setDrawer({ open: true, line: null })} className="flex min-h-[52px] w-full items-center justify-center border border-dashed border-wds-text-faint font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary focus-visible:outline-none focus-visible:shadow-wds-ring">
          + Add a casual
        </button>
      ) : null}
      {lines.length > 0 || sheet.corrections.length > 0 ? (
        <div role="status" aria-live="polite" className="flex items-baseline justify-between border-t border-wds-text-ink pt-3">
          <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">Total for today</span>
          <span className="font-wds-mono text-[15px] font-semibold leading-[18px] text-wds-text-ink">KES {kes(total.includes('.') ? total : `${total}.00`)}</span>
        </div>
      ) : null}
      {sheet.corrections.map((c) => (
        <p key={c.id} className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          Correction for {dayMonth(c.originalDate)}, KES {kes(c.amount)}, {c.reason}
        </p>
      ))}
      {lines.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <PhoneButton kind="outlined" size="sm" onClick={onPreview}>
            Preview the pay sheet
          </PhoneButton>
          {editable ? (
            <>
              <PhoneButton size="sm" disabled={busy || sendReason !== null} onClick={onSend}>
                {busy ? 'Sending…' : 'Send to the Branch Manager'}
              </PhoneButton>
              {sendReason ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{sendReason}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}
      <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{CASUAL_COPY.footer}</p>
      <LineDrawer
        open={drawer.open}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
        siteId={sheet.organizationId}
        departmentId={sheet.departmentId}
        rate={rate}
        taken={taken}
        editing={drawer.line}
        onSave={save}
        onRemove={(id) => {
          onEdit(lines.filter((l) => l.casualId !== id));
          setDrawer({ open: false, line: null });
        }}
      />
    </>
  );
}
