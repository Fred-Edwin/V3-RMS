'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';

import { DialogButton, ErrorBlock, KeyValueRows, KitDialog, ListSkeleton, PIN_LENGTH, PinField, type KeyValueRow } from '../../../_shared';
import { useMonth } from '../../_shared/hooks/use-month-data';
import { monthLabel, monthName, payrollWaitingNote, plural, rangeWords } from '../../_shared/lib/month-words';
import { monthWrites } from '../../_shared/services/month-services';
import { hmWords, wholeHours } from '../../_shared/lib/timesheet-words';
import type { MonthView } from '../../_shared/types/month-types';
import { approveBlock, approveWords } from '../lib/approve-view';

/**
 * Approve the month (spec S7): the hours go to payroll and are locked. The totals are read again from the server on open; the same
 * totals travel with the PIN so the server can refuse if anything moved ("changed underneath"). Blocked while things are undecided
 * (D1) with a way back to them. The last PIN digit enables the button; Enter never signs.
 */
export function ApproveDialog({ monthKey, siteId, onClose, onDone, onShowNeeds }: { monthKey: string; siteId: string | undefined; onClose: () => void; onDone: (message: string) => void; onShowNeeds: () => void }) {
  const [tick, setTick] = React.useState(0);
  const fresh = useMonth(monthKey, siteId, undefined, undefined, tick, true);
  const [pin, setPin] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef<string>(crypto.randomUUID());
  const month: MonthView | null = fresh.data;
  const block = month ? approveBlock(month) : null;
  const name = monthName(monthKey);

  const sign = async (): Promise<void> => {
    if (!month || block) return;
    setBusy(true);
    setError(null);
    try {
      await monthWrites.approve(monthKey, {
        pin,
        idempotencyKey: key.current,
        expectedTotals: { workedMinutes: month.kpis.workedMinutes, overtimeAuthorisedMinutes: month.kpis.overtime.approvedMinutes, headcount: month.kpis.headcount },
        ...(siteId ? { site: siteId } : {}),
      });
      onDone(`${name} approved. HR and the Accountant are told.`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setPin('');
      if (code === 'ALREADY_APPROVED') {
        onDone(`${name} was approved a moment ago.`);
        return;
      }
      setError(approveWords(code, err instanceof Error ? err.message : ''));
      if (code === 'CHANGED_UNDERNEATH' || code === 'NEEDS_YOU_REMAINS') {
        key.current = crypto.randomUUID();
        setTick((n) => n + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  const rows: KeyValueRow[] = month
    ? [
        { label: 'Hours worked', value: `${wholeHours(month.kpis.workedMinutes)} · plan ${wholeHours(month.kpis.plannedMinutes)}`, mono: true },
        { label: 'Overtime authorised', value: `${hmWords(month.kpis.overtime.approvedMinutes)}${month.kpis.overtime.partNotApprovedMinutes > 0 ? ` · ${hmWords(month.kpis.overtime.partNotApprovedMinutes)} not approved` : ''}`, mono: true },
        { label: 'Late marks, absent days', value: `${month.kpis.lateCount} · ${month.kpis.absentDays} (payroll applies the Rules)`, mono: true },
        month.needsYou.total > 0 ? { label: 'Still to decide', value: String(month.needsYou.total), mono: true, tone: 'warning' } : { label: 'Still to decide', value: 'Nothing', tone: 'success' },
        ...(month.needsYou.requestsWithHr > 0 ? [{ label: 'With HR', value: plural(month.needsYou.requestsWithHr, 'request'), tone: 'muted' as const }] : []),
      ]
    : [];

  return (
    <KitDialog
      open
      plain
      onOpenChange={(o) => !o && onClose()}
      busy={busy}
      width={600}
      title={`Approve ${monthLabel(monthKey)}?`}
      description={month ? `${month.organization.name} · ${rangeWords(month.window.start, month.window.end)} · ${plural(month.kpis.headcount, 'person', 'people')}. After this, the hours go to payroll and are locked.` : undefined}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={() => void sign()} disabled={busy || !month || block !== null || pin.length < PIN_LENGTH}>
            {busy ? 'Approving…' : `Approve ${name}`}
          </DialogButton>
        </>
      }
    >
      {fresh.status === 'loading' && !month ? <ListSkeleton rows={4} columns={['fill', 120]} label="Loading the totals" /> : null}
      {fresh.status === 'error' && !month ? <ErrorBlock title="We could not read the totals." line={fresh.error.message} onRetry={fresh.reload} /> : null}
      {month ? (
        <>
          <KeyValueRows aria-label="What you are approving" rows={rows} />
          {month.needsYou.total > 0 ? (
            <p role="alert" className="m-0 flex flex-wrap items-center gap-2 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
              {block}
              <button type="button" onClick={() => { onClose(); onShowNeeds(); }} className="font-medium underline underline-offset-2">
                Show them
              </button>
            </p>
          ) : block ? (
            <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">{block}</p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">Your PIN</span>
            <PinField value={pin} onChange={setPin} label="Your PIN" disabled={busy || block !== null} invalid={error !== null} autoFocus={block === null} className="max-w-[240px]" />
          </div>
          {error ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{error}</p> : null}
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            {payrollWaitingNote(name, month.otherSites)} HR and the Accountant are told. Your name, the time and these totals are kept in the audit log.
          </p>
        </>
      ) : null}
    </KitDialog>
  );
}
