'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Skeleton } from '@/components/ui2/skeleton';
import { ErrorState } from '@/components/app/shell/shell-states';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { ApiError } from '@/types/api';
import { useLoader } from '../../../_shared/hooks/use-async';
import { describePrepError } from '../../_shared/lib/prep-errors';
import { formatDayAndClock, formatKes, withUnit } from '../../_shared/lib/prep-format';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { prepApi } from '../../_shared/services/prep-api';
import type { RunDetail } from '../../_shared/types/prep-contract';
import { refreshNeedsLookCount } from '../../review/hooks/use-needs-look-count';
import { drawerSubtitle, unitCostText } from '../lib/run-copy';
import { RunDrawerBody } from './run-drawer-body';

export interface RunDrawerProps {
  /** The run to show; `null` keeps the drawer shut. Drive it from `useRunParam` so `?run=<id>` deep-links. */
  runId: string | null;
  onClose: () => void;
  /** Opens a linked run (replaces / replaced by). */
  onOpenRun?: (id: string) => void;
  /** Called after anything in here changed the data behind the screen (Mark reviewed), so the band, table and KPIs reload. */
  onChanged?: () => void;
  /**
   * Seams for Slice 3 (Fix a slip). The buttons appear only when the server says this caller may (`run.can.correct` / `.cancel`)
   * AND the screen passed a handler; without one there is no button, never a dead one.
   */
  onCorrect?: (run: RunDetail) => void;
  onCancel?: (run: RunDetail) => void;
}

function DrawerContents({ runId, onClose, onOpenRun, onChanged, onCorrect, onCancel }: Omit<RunDrawerProps, 'runId'> & { runId: string }) {
  const { data: run, status, error, reload, setData } = useLoader(`prep-run:${runId}`, () => prepApi.getRun(runId), PREP_STATES_COPY.drawer.errorTitle);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const busy = React.useRef(false);
  const [reviewing, setReviewing] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const markReviewed = async (): Promise<void> => {
    if (busy.current) return; // a double click reviews once
    busy.current = true;
    setReviewing(true);
    setFailure(null);
    try {
      const updated = await prepApi.reviewRun(runId);
      setData(updated);
      useWdsToastStore.getState().addToast({ variant: 'success', title: PREP_STATES_COPY.needsLook.reviewed, description: `${updated.reference} · ${updated.outputName}` });
      onChanged?.();
      refreshNeedsLookCount();
      // The button that was focused has just gone; keep the keyboard user inside the drawer.
      titleRef.current?.focus();
    } catch (err) {
      setFailure(describePrepError(err, PREP_STATES_COPY.needsLook.reviewFailed));
      if (err instanceof ApiError && err.code === 'RUN_NOT_OPEN') void reload();
    } finally {
      busy.current = false;
      setReviewing(false);
    }
  };

  const loaded = status !== 'error' && run && run.id === runId ? run : null;
  const costNote = loaded?.totalInputCost !== undefined ? `Input cost ${formatKes(loaded.totalInputCost)} ÷ ${withUnit(loaded.made, loaded.unit)}. ` : '';
  const unitCost = loaded ? unitCostText(loaded) : null;

  return (
    <>
      <SheetHeader className="flex-row items-start justify-between gap-3 pb-4 pr-14 pt-[22px]">
        <div className="flex min-w-0 flex-col gap-1">
          <SheetTitle ref={titleRef} tabIndex={-1} className="truncate text-[17px] font-semibold leading-[22px] outline-none">
            {loaded ? `Prep run · ${loaded.outputName}` : 'Prep run'}
          </SheetTitle>
          <SheetDescription className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.04em] text-wds-text-copy-muted">
            {loaded ? drawerSubtitle(loaded) : 'Loading'}
          </SheetDescription>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
        {failure ? (
          <div role="alert" className="mb-4 border border-wds-error-border bg-wds-error-bg px-3 py-2.5 font-wds-sans text-wds-body-sm text-wds-error-fg">
            {failure}
          </div>
        ) : null}
        {status === 'error' ? (
          <ErrorState title={PREP_STATES_COPY.drawer.errorTitle} description={error ?? PREP_STATES_COPY.drawer.errorDescription} onRetry={reload} />
        ) : loaded ? (
          <RunDrawerBody run={loaded} onOpenRun={onOpenRun} />
        ) : (
          <div className="flex flex-col gap-[18px]" aria-busy="true" aria-label="Loading the run">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[62px] w-full" />
            <Skeleton className="h-[120px] w-full" />
          </div>
        )}
      </div>

      {loaded ? (
        <div className="flex flex-col gap-3 border-t border-wds-border px-6 pb-5 pt-4">
          {unitCost ? (
            <div className="flex items-baseline justify-between">
              <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted">Output unit cost</span>
              <span className="font-wds-mono text-[16px] leading-5 text-wds-text-ink">{unitCost}</span>
            </div>
          ) : null}
          <p className="m-0 font-wds-sans text-wds-caption leading-4 text-wds-text-copy-muted">
            {costNote}Recorded runs are never edited; they are corrected or cancelled with a reason.
          </p>
          {loaded.can.lockedReason ? (
            <p className="m-0 border border-wds-border bg-wds-neutral-50 px-3 py-2 font-wds-sans text-wds-body-sm text-wds-text-ink">
              <strong className="font-semibold">{loaded.can.lockedReason}.</strong> {PREP_STATES_COPY.locked.description}
            </p>
          ) : null}
          {loaded.windowEndsAt ? (
            <p className="m-0 font-wds-sans text-wds-caption leading-4 text-wds-text-copy-muted">You can correct or cancel this run until {formatDayAndClock(loaded.windowEndsAt)}.</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {loaded.can.correct && onCorrect ? (
              <Button variant="secondary" size="lg" className="max-sm:h-11" onClick={() => onCorrect(loaded)}>
                Correct
              </Button>
            ) : null}
            {loaded.can.cancel && onCancel ? (
              <Button variant="secondary" size="lg" className="border-wds-error-border text-wds-error-fg max-sm:h-11" onClick={() => onCancel(loaded)}>
                Cancel run
              </Button>
            ) : null}
            <div className="flex-1" />
            {loaded.can.review ? (
              <Button className={cn('h-[38px] px-[18px] max-sm:h-11')} disabled={reviewing} aria-busy={reviewing} onClick={() => void markReviewed()}>
                {reviewing ? 'Marking…' : 'Mark reviewed'}
              </Button>
            ) : (
              <Button variant="secondary" size="lg" className="max-sm:h-11" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * The run drawer (Paper step 11 `7JS-0`): one right-hand sheet that every desktop role and the Attendant open from a table row, the
 * band's Review button, or a `?run=<id>` link. It shows what the server sends for the caller's role and offers Mark reviewed with
 * `prep.review`. Escape, the × and a click on the backdrop close it; focus returns to the row that opened it (the sheet does that).
 */
export function RunDrawer({ runId, ...rest }: RunDrawerProps) {
  // Keep the last run on screen while the sheet slides shut, so it does not collapse to an empty frame first.
  const [shown, setShown] = React.useState<string | null>(runId);
  React.useEffect(() => {
    if (runId) setShown(runId);
  }, [runId]);
  return (
    <Sheet open={runId !== null} onOpenChange={(open) => !open && rest.onClose()}>
      <SheetContent className="w-[460px] max-w-full gap-0">{shown ? <DrawerContents key={shown} runId={shown} {...rest} /> : null}</SheetContent>
    </Sheet>
  );
}
