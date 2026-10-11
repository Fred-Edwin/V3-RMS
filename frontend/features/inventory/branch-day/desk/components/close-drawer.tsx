'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { roleLabel } from '@/components/app/shell/role-label';
import { useAuthStore } from '@/store/authStore';
import { ErrorState } from '@/components/app/shell/shell-states';
import { DrawerShell } from '../../../_shared/components/drawer-shell';
import { PinField, RefLink } from '../../../_shared/components/block2-phone-parts';
import { useAction, useLoader } from '../../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_ERROR_COPY, BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import type { BranchDayErrorCode, CloseDayResult, DepartmentFigures } from '../../_shared/types/branch-day-contract';
import { branchDayDeskApi } from '../services/branch-day-desk-api';
import { itemsText, kes, qty } from '../lib/desk-format';
import { MonoLabel, PRIMARY_LINK } from './day-parts';

const isCode = (code: string | null): code is BranchDayErrorCode => code !== null && code in BRANCH_DAY_ERROR_COPY;

/**
 * Paper B8: Close the day, the summary and the PIN. A receipt: the figures cannot be edited here, "See every line" opens the lines in place
 * (gap G10). The PIN box takes focus when the drawer opens; a wrong PIN clears it and says so under it (G3); a department that changed since
 * the page loaded closes the drawer back to Today with the card flagged (G7). One idempotency key per opening of the drawer.
 */
export function CloseDayDrawer({ dayId, branchName, dateLabel, reference, referenceHref, open, onOpenChange, onClosed, onStale }: {
  dayId: string;
  branchName: string;
  dateLabel: string;
  reference: string;
  /** Where the day number in the header goes (the day's own page). */
  referenceHref: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: (result: CloseDayResult) => void;
  /** The day moved under the drawer (a department changed, or it is already closed): Today reloads and says why. */
  onStale: (message: string) => void;
}) {
  const summary = useLoader(open ? `close:${dayId}` : null, () => branchDayDeskApi.closeSummary(dayId), BRANCH_DAY_STATES_COPY.close.error);
  const user = useAuthStore((s) => s.user);
  const [pin, setPin] = React.useState('');
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [lines, setLines] = React.useState<DepartmentFigures[] | null>(null);
  const [showLines, setShowLines] = React.useState(false);
  const [linesFailed, setLinesFailed] = React.useState(false);
  const pinRef = React.useRef<HTMLInputElement>(null);
  const idem = useIdempotencyKey();

  // A fresh walk each time the drawer opens.
  const renewKey = idem.renew;
  React.useEffect(() => {
    if (open) {
      setPin('');
      setPinError(null);
      setShowLines(false);
      setLines(null);
      setLinesFailed(false);
      renewKey();
    }
  }, [open, renewKey]);

  const data = summary.data;
  React.useEffect(() => {
    if (open && data) pinRef.current?.focus();
  }, [open, data]);

  const close = useAction((code: string) => branchDayDeskApi.close(dayId, { pin: code, idempotencyKey: idem.key() }), BRANCH_DAY_ERROR_COPY.DAY_NOT_READY);

  const toggleLines = async (): Promise<void> => {
    if (showLines) {
      setShowLines(false);
      return;
    }
    setShowLines(true);
    if (lines || !data) return;
    try {
      setLinesFailed(false);
      setLines(await Promise.all(data.departments.map((d) => branchDayDeskApi.figures(dayId, d.departmentId))));
    } catch {
      setLinesFailed(true);
    }
  };

  const submit = async (): Promise<void> => {
    if (pin.length !== 4 || close.saving || !data?.canClose) return;
    const result = await close.run(pin);
    if (result) {
      onClosed(result);
      return;
    }
  };

  // Show a failure from the last attempt: a wrong PIN stays in the drawer; a stale day sends the Branch Manager back to Today.
  React.useEffect(() => {
    const failure = close.failure;
    if (!failure) return;
    const code = isCode(failure.code) ? failure.code : null;
    if (code === 'INVALID_PIN') {
      setPin('');
      setPinError(BRANCH_DAY_ERROR_COPY.INVALID_PIN);
    } else if (code === 'DAY_NOT_READY') {
      const blockers = (failure.details as { blockers?: { department?: { name: string } | null }[] } | null)?.blockers ?? [];
      const name = blockers.find((b) => b.department)?.department?.name;
      onStale(name ? `${name} changed after you opened this. Review it and close again.` : BRANCH_DAY_ERROR_COPY.DAY_NOT_READY);
    } else if (code === 'DAY_ALREADY_CLOSED') {
      onStale(BRANCH_DAY_ERROR_COPY.DAY_ALREADY_CLOSED);
    } else {
      setPinError(BRANCH_DAY_STATES_COPY.close.error);
    }
    // onStale is a stable callback from the screen; the effect reacts to a new failure only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close.failure]);

  const body = (() => {
    if (summary.status === 'error') return <ErrorState title="Could not load the summary" description={BRANCH_DAY_STATES_COPY.close.error} onRetry={summary.reload} className="my-6" />;
    if (!data) {
      return (
        <div className="flex flex-col gap-4" aria-hidden="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      );
    }
    return (
      <>
        <section aria-label="Used today" className="border-t-2 border-wds-text-ink">
          <div className="flex flex-col gap-0.5 px-4 pb-3 pt-3.5">
            <MonoLabel>Used today (KES)</MonoLabel>
            <span className="font-wds-mono text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-wds-text-ink">{kes(data.usedValueKes)}</span>
          </div>
          <ul className="m-0 list-none p-0">
            {data.departments.map((d) => (
              <li key={d.departmentId} className="flex items-center gap-3 border-t border-wds-border px-4 py-[9px]">
                <span className="grow font-wds-sans text-[13px] font-medium leading-[18px] text-wds-text-ink">{d.name}</span>
                <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{itemsText(d.itemCount)}</span>
                <span className="w-[76px] text-right font-wds-mono text-[13px] leading-[18px] text-wds-text-ink">{kes(d.usedValueKes)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-wds-border px-4 py-2.5">
            <button type="button" onClick={() => void toggleLines()} aria-expanded={showLines} className={PRIMARY_LINK}>
              {showLines ? 'Hide the lines' : BRANCH_DAY_BUTTONS.seeEveryLine}
            </button>
          </div>
          {showLines ? (
            <div className="border-t border-wds-border px-4 py-3" aria-live="polite">
              {linesFailed ? (
                <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">Could not load the lines. Close and open this again.</p>
              ) : !lines ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex max-h-[260px] flex-col gap-3 overflow-y-auto">
                  {lines.map((f) => (
                    <div key={f.department.id} className="flex flex-col gap-1">
                      <MonoLabel>{f.department.name}</MonoLabel>
                      {f.department.lines.map((l) => (
                        <div key={l.itemId} className="flex items-baseline gap-3 font-wds-sans text-[13px] leading-[18px]">
                          <span className="grow text-wds-text-ink">{l.itemName}</span>
                          <span className="font-wds-mono text-wds-text-secondary">{qty(l.usedQty)} {l.unit.toLowerCase()}</span>
                          <span className="w-[68px] text-right font-wds-mono text-wds-text-ink">{kes(l.usedValueKes ?? null)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>

        <div className="flex flex-col gap-1.5">
          <MonoLabel>What closing does</MonoLabel>
          <p className="m-0 font-wds-sans text-[13px] leading-[19px] text-wds-text-ink">{BRANCH_DAY_MESSAGES.closeDoes(data.entryCount, data.day.reference)}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <MonoLabel id="close-signed-by">Signed by</MonoLabel>
          <div aria-labelledby="close-signed-by" className="flex h-10 items-center border border-wds-border bg-wds-neutral-50 px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{roleLabel(user?.role)}</div>
        </div>

        <PinField id="close-pin" size="paper" value={pin} onChange={(v) => { setPin(v); if (pinError) setPinError(null); }} onSubmit={() => void submit()} error={pinError} disabled={close.saving} inputRef={pinRef} />
      </>
    );
  })();

  return (
    <DrawerShell
      variant="day"
      open={open}
      onOpenChange={(next) => {
        if (!close.saving) onOpenChange(next);
      }}
      title="Close the day"
      description={
        <>
          {branchName} · {dateLabel} · <RefLink reference={reference} href={referenceHref} className="text-[13px]" />
        </>
      }
      primaryLabel={close.saving ? 'Closing the day' : BRANCH_DAY_BUTTONS.closeDay}
      onPrimaryAction={() => void submit()}
      primaryDisabled={close.saving || pin.length !== 4 || !data?.canClose}
    >
      <div className={cn('flex flex-col gap-[18px]')} aria-busy={close.saving}>
        {body}
      </div>
    </DrawerShell>
  );
}
