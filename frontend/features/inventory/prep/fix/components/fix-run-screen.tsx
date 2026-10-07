'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Skeleton } from '@/components/ui2/skeleton';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useLoader } from '../../../_shared/hooks/use-async';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { formatDayAndClock } from '../../_shared/lib/prep-format';
import { prepApi } from '../../_shared/services/prep-api';
import type { RunDetail } from '../../_shared/types/prep-contract';
import { CancelRunDialog } from './cancel-run-dialog';
import { CorrectRunForm } from './correct-run-form';
import { FixHeader } from './fix-header';
import { FixRunView, fixModeOf } from './fix-run-view';

const PREP_HOME = '/app/inventory/prep';

const initialsOf = (name: string | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : parts[0]!.slice(0, 2)).toUpperCase();
};

export type FixStep = 'detail' | 'correct';

export interface FixRunScreenProps {
  run: RunDetail;
  /** Called after a correction or a cancel has been saved (the toast has already been shown). */
  onDone: (result: RunDetail) => void;
  /** Called to leave Fix a slip without changing anything (the back chevron on the detail step). */
  onClose: () => void;
  /** Which step shows. Controlled when given (the route keeps it in the URL); the screen keeps it itself otherwise. */
  step?: FixStep;
  onStepChange?: (step: FixStep) => void;
}

/**
 * Fix a slip for one run, start to finish (Paper steps 13 to 16 and 22): the run's detail with Correct and Cancel, the correct form
 * with its check sheet, and the cancel sheet. The same screen at every width (a phone's dark header, a tablet's bar, a computer's
 * top bar with the content centred); Paper draws only the phone, so tablet and computer are the phone reflowed. A run that cannot
 * be fixed shows the locked state, whether the server said so up front (`can.lockedReason`) or answered 403 while saving.
 */
export function FixRunScreen({ run, onDone, onClose, step: stepProp, onStepChange }: FixRunScreenProps) {
  const user = useAuthStore((s) => s.user);
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const [ownStep, setOwnStep] = React.useState<FixStep>('detail');
  const step = stepProp ?? ownStep;
  const setStep = React.useCallback(
    (next: FixStep) => {
      setOwnStep(next);
      onStepChange?.(next);
    },
    [onStepChange]
  );
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [lockedByServer, setLockedByServer] = React.useState(false);
  const dirty = React.useRef(false);
  const onDirtyChange = React.useCallback((next: boolean) => {
    dirty.current = next;
  }, []);

  const mode = fixModeOf(run, lockedByServer);
  // The correct form only exists while the run is open for fixing; if it stops being open the detail step takes over.
  const inCorrect = step === 'correct' && mode === 'open';

  const leaveCorrect = (): void => {
    if (dirty.current) setDiscardOpen(true);
    else setStep('detail');
  };
  const handleLocked = React.useCallback(() => {
    setLockedByServer(true);
    setCancelOpen(false);
    setStep('detail');
  }, [setStep]);

  if (!hydrated) return null;

  const subtitle = `${run.reference} · ${formatDayAndClock(run.at)}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
      {inCorrect ? (
        <FixHeader title="Correct run" subtitle={`${run.outputName} · ${run.reference}`} initials={initialsOf(user?.name)} screen="Correct run" desktop={desktop} onBack={leaveCorrect} onLeave={leaveCorrect} />
      ) : (
        <FixHeader title={run.outputName} subtitle={subtitle} initials={initialsOf(user?.name)} screen="Fix run" desktop={desktop} onBack={onClose} />
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-wds-4 pb-5 pt-[18px] md:px-wds-6 md:pt-wds-6">
          {inCorrect ? (
            <CorrectRunForm key={run.id} run={run} onDone={onDone} onLocked={handleLocked} onDirtyChange={onDirtyChange} />
          ) : (
            <FixRunView run={run} mode={mode} onCorrect={() => setStep('correct')} onCancel={() => setCancelOpen(true)} />
          )}
        </div>
      </div>

      <CancelRunDialog run={run} open={cancelOpen} onClose={() => setCancelOpen(false)} onDone={onDone} onLocked={handleLocked} />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={PREP_STATES_COPY.fix.discardTitle}
        description={PREP_STATES_COPY.fix.discardBody}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          dirty.current = false;
          setStep('detail');
        }}
      />
    </div>
  );
}

/** The loading frame: the same dark header and the table's outline, so the page does not jump when the run arrives. */
function FixRunLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-wds-canvas" aria-busy="true" aria-label="Loading the run">
      <div className="shrink-0 bg-wds-sidebar-top px-wds-4 pb-[18px] pt-wds-4 lg:hidden">
        <Skeleton className="h-[22px] w-48 bg-wds-espresso-800" />
        <Skeleton className="mt-2 h-4 w-32 bg-wds-espresso-800" />
      </div>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-wds-4 pt-[18px] md:px-wds-6">
        <Skeleton className="h-[52px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  );
}

/**
 * `/app/inventory/prep/runs/[id]/fix`: loads the run, then shows Fix a slip. The step lives in the URL (`?step=correct`) so Back
 * from the correct form returns to the run, and a refresh keeps the place. A saved correction or cancel returns to Prep.
 */
export function FixRunRoute({ runId }: { runId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const step: FixStep = params.get('step') === 'correct' ? 'correct' : 'detail';
  const run = useLoader(`prep-fix-run:${runId}`, () => prepApi.getRun(runId), PREP_STATES_COPY.fix.loadErrorTitle);

  const setStep = React.useCallback(
    (next: FixStep) => {
      router.push(next === 'correct' ? `${pathname}?step=correct` : pathname);
    },
    [router, pathname]
  );
  const [missing, setMissing] = React.useState(false);
  React.useEffect(() => {
    setMissing(run.status === 'error' && run.error !== null && /not found/i.test(run.error));
  }, [run.status, run.error]);

  if (run.status === 'error') {
    return missing ? (
      <EmptyState title={PREP_STATES_COPY.fix.notFoundTitle} description={PREP_STATES_COPY.fix.notFoundDescription} />
    ) : (
      <ErrorState title={PREP_STATES_COPY.fix.loadErrorTitle} description={run.error ?? ''} onRetry={run.reload} />
    );
  }
  if (run.status !== 'ready' || !run.data) return <FixRunLoading />;
  return <FixRunScreen run={run.data} step={step} onStepChange={setStep} onDone={() => router.push(PREP_HOME)} onClose={() => router.push(PREP_HOME)} />;
}
