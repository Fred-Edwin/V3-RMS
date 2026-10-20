'use client';

import Link from 'next/link';
import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { Callout, ErrorBlock, ListSkeleton, PhoneButton, WorkforcePinDialog, useRemote } from '../../../_shared';
import { CASUAL_COPY, clockOf, dayShort, kes } from '../../_shared/lib/casual-words';
import { casualReads } from '../../_shared/services/casual-services';
import type { Sheet, SheetCard } from '../../_shared/types/casual-types';
import { useDecision } from '../hooks/use-decision';
import { SendBackDialog } from './send-back-dialog';
import { VoidButton } from './void-button';

/**
 * One sheet waiting for the approver (spec S8): the workers and the total, then Approve (PIN) or Send back. The sheet is read in full
 * when the card opens, so the PIN signs exactly the total on screen. The number is issued at approval, so before it the card says so.
 */
export function ApprovalCard({ card, onChanged }: { card: SheetCard; onChanged: () => void }) {
  const me = useAuthStore((s) => s.user?.id);
  const remote = useRemote(() => casualReads.sheet(card.id), `approve:${card.id}`);
  const [local, setLocal] = React.useState<Sheet | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [backOpen, setBackOpen] = React.useState(false);
  const sheet = local ?? remote.data;

  if (!sheet) {
    return remote.status === 'error' ? <ErrorBlock title="This sheet did not load" line="Nothing was changed." onRetry={remote.reload} /> : <ListSkeleton rows={2} columns={['fill', 60]} label="Opening the sheet" />;
  }
  return <Decided sheet={sheet} me={me ?? null} note={note} pinOpen={pinOpen} backOpen={backOpen} setPinOpen={setPinOpen} setBackOpen={setBackOpen} setLocal={setLocal} setNote={setNote} refresh={() => { setLocal(null); remote.reload(); onChanged(); }} />;
}

interface DecidedProps {
  sheet: Sheet;
  me: string | null;
  note: string | null;
  pinOpen: boolean;
  backOpen: boolean;
  setPinOpen: (open: boolean) => void;
  setBackOpen: (open: boolean) => void;
  setLocal: (sheet: Sheet) => void;
  setNote: (note: string) => void;
  refresh: () => void;
}

function Decided({ sheet, me, note, pinOpen, backOpen, setPinOpen, setBackOpen, setLocal, setNote, refresh }: DecidedProps) {
  const decision = useDecision(
    sheet,
    (next, message) => {
      setLocal(next);
      setNote(message);
      setPinOpen(false);
      setBackOpen(false);
    },
    refresh
  );
  const waiting = sheet.status === 'SENT';
  const mine = sheet.recordedBy?.id === me;
  const holder = sheet.cashHolder?.name;
  const recorder = sheet.recordedBy && ['MANAGER', 'STORE_MANAGER'].includes(sheet.recordedBy.role) ? roleOf(sheet.recordedBy.role) : `${sheet.departmentName} head`;
  return (
    <article aria-label={`${sheet.departmentName} casuals, ${dayShort(sheet.date)}`} className="flex flex-col gap-3 border border-l-[3px] border-wds-border border-l-wds-caramel-600 bg-wds-surface p-3.5">
      <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-warning-fg">CASUAL PAY · {dayShort(sheet.date).toUpperCase()}</span>
      <h2 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">
        {sheet.departmentName} casuals, {dayShort(sheet.date)}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {sheet.lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink">
            <span>
              {l.name} · {l.start} to {l.end}{l.endsNextDay ? ' +1' : ''}
            </span>
            <span className="font-wds-mono">{kes(l.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-wds-text-ink pt-2 font-wds-sans text-[14px] font-semibold text-wds-text-ink">
        <span>Total</span>
        <span className="font-wds-mono">KES {kes(sheet.total)}</span>
      </div>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        Recorded by the {recorder}.{waiting && !sheet.number ? 'The pay sheet gets its number when you approve.' : ''}
      </p>
      {note ? <Callout tone="success" role="status">{note}</Callout> : null}
      {decision.error && !pinOpen && !backOpen ? <Callout tone="warning" role="alert">{decision.error}</Callout> : null}
      {waiting ? (
        <>
          <PhoneButton size="sm" disabled={mine} onClick={() => setPinOpen(true)}>
            Approve and print the pay sheet
          </PhoneButton>
          {mine ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">You recorded this sheet. The Director approves it.</p> : null}
          <PhoneButton kind="outlined" size="sm" onClick={() => setBackOpen(true)}>
            Send back to the {recorder}
          </PhoneButton>
          <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">
            You sign with your PIN. The cash comes from the petty cash{holder ? ` held by ${holder}` : ' you hold'}. The head is told.
          </p>
        </>
      ) : null}
      {sheet.status === 'APPROVED' ? (
        <>
          <Link href={`/app/workforce/casuals/${sheet.id}/document`} className="inline-flex min-h-[44px] items-center justify-center border border-wds-border-strong font-wds-sans text-[14px] font-medium text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring">
            Open the pay sheet{sheet.number ? `, ${sheet.number}` : ''}
          </Link>
          <VoidButton sheet={sheet} onVoided={(next, message) => { setLocal(next); setNote(message); }} onStale={refresh} />
          {sheet.approvedAt ? <p className="m-0 font-wds-sans text-[12px] text-wds-text-secondary">Approved at {clockOf(sheet.approvedAt)}.</p> : null}
        </>
      ) : null}
      {sheet.status === 'SENT_BACK' || sheet.status === 'VOID' ? <p className="m-0 font-wds-sans text-[12px] text-wds-text-secondary">{CASUAL_COPY.screen}: {sheet.status === 'VOID' ? 'void' : 'sent back'}.</p> : null}
      <WorkforcePinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Approve and print"
        summaryRows={[
          { label: 'Department', value: sheet.departmentName },
          { label: 'Day', value: dayShort(sheet.date) },
          { label: 'Workers', value: String(sheet.lines.length), mono: true },
          { label: 'Total KES', value: kes(sheet.total), mono: true },
        ]}
        caption="You sign with your PIN. The head is told."
        confirmLabel="Approve and print"
        submitting={decision.busy}
        error={decision.error ?? undefined}
        onSubmit={(pin) => void decision.approve(pin)}
      />
      <SendBackDialog open={backOpen} onOpenChange={setBackOpen} role={recorder} busy={decision.busy} error={decision.error} onSend={(reason) => void decision.sendBack(reason)} />
    </article>
  );
}

const roleOf = (role: string): string => (role === 'MANAGER' ? 'Branch Manager' : 'Store Manager');
