'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { Topbar } from '@/components/app/shell/topbar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { OutputPicker } from '../../_shared/components/output-picker';
import { RunSummaryPanel } from '../../_shared/components/run-summary-panel';
import { WarningBox } from '../../_shared/components/expected-yield-note';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { formatDayAndClock, formatQuantity } from '../../_shared/lib/prep-format';
import { prepApi } from '../../_shared/services/prep-api';
import { useRecordForm } from '../hooks/use-record-form';
import { ConfirmSheet, yieldIsOff } from './confirm-sheet';
import { IngredientPicker } from './ingredient-picker';
import { RunFormBody } from './run-form-body';
import { RunFormHeader } from './run-form-header';
import { RunRecorded } from './run-recorded';
import { YieldReasonChips } from './yield-reason-chips';

const PREP_HOME = '/app/inventory/prep';

const initialsOf = (name: string | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : parts[0]!.slice(0, 2)).toUpperCase();
};

/**
 * Record a run, for the Store Attendant (and anyone who opens it by URL with `prep.record`). One component for every width:
 *  - phone (Paper steps 3, 6, 39, 40): the dark task header, the form, a "Review and confirm" button and the confirm sheet;
 *  - tablet, 768 and up (steps 38): the form and the live "This run" panel side by side, no confirm sheet;
 *  - computer, 1024 and up (steps 37): the shell top bar with Cancel, a title, and the same two columns.
 * `?item=<id>` opens the run filled in as last time; without it the "What did you make?" picker opens first.
 */
export function RecordRunScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const itemId = params.get('item') ?? undefined;
  const user = useAuthStore((s) => s.user);
  const { open: openMobileNav } = useMobileNavDrawer();
  const { matches: wide, hydrated } = useMediaQuery('(min-width: 768px)');
  const { matches: desktop } = useMediaQuery('(min-width: 1024px)');

  const outputs = useLoader('prep-outputs', () => prepApi.outputs().then((r) => r.items), PREP_STATES_COPY.record.outputsErrorTitle);
  const form = useRecordForm({ outputItemId: itemId, outputs: outputs.data });

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [ingredientOpen, setIngredientOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [repeatOpen, setRepeatOpen] = React.useState(false);

  // No item chosen yet: ask what was made. (Once outputs have loaded, so an empty list shows its own message.)
  React.useEffect(() => {
    if (!itemId && outputs.status === 'ready') setPickerOpen(true);
  }, [itemId, outputs.status]);

  const goHome = (): void => router.push(PREP_HOME);
  const pick = (id: string): void => {
    setPickerOpen(false);
    router.replace(`${PREP_HOME}/new?item=${encodeURIComponent(id)}`);
  };

  const recordNow = async (): Promise<void> => {
    const run = await form.record();
    if (run) setConfirmOpen(false);
  };
  /** Review and confirm / Confirm run: a repeat asks first; a phone then shows the confirm sheet; a tablet or computer records. */
  const requestConfirm = (): void => {
    if (!form.canReview) return;
    if (form.check?.repeat.duplicate) {
      setRepeatOpen(true);
      return;
    }
    proceed();
  };
  const proceed = (): void => {
    if (wide) void recordNow();
    else setConfirmOpen(true);
  };

  if (!hydrated) return null;

  const initials = initialsOf(user?.name);
  const output = form.output;

  // ── Recorded ──
  if (form.recorded) {
    const run = form.recorded;
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        {desktop ? (
          <Topbar breadcrumb={{ root: 'Central Store', section: 'Prep', sectionHref: PREP_HOME, screen: 'Recorded' }} hideSearch className="shrink-0" />
        ) : (
          <MobileHubHeader title="Recorded" subtitle={`${run.outputName} · ${formatDayAndClock(run.at)}`} userInitials={initials} orgLabel="Hub" onMenuClick={openMobileNav} />
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <RunRecorded run={run} onDone={goHome} onAgain={form.reset} />
        </div>
      </div>
    );
  }

  const header = desktop ? (
    <Topbar
      breadcrumb={{ root: 'Central Store', section: 'Prep', sectionHref: PREP_HOME, screen: 'New run' }}
      hideSearch
      className="shrink-0"
      actions={
        <Button variant="secondary" onClick={goHome}>
          Cancel
        </Button>
      }
    />
  ) : (
    <RunFormHeader
      title={output?.name ?? 'New prep run'}
      subtitle={output ? (output.lastRun ? "Filled in as last time · change what's different" : 'Add what you used and what you made') : 'Choose what you made'}
      initials={initials}
      onBack={goHome}
      onCancel={goHome}
    />
  );

  // ── Loading, error, empty, not found ──
  let body: React.ReactNode;
  if (outputs.status === 'error') {
    body = <ErrorState title={PREP_STATES_COPY.record.outputsErrorTitle} description={outputs.error ?? ''} onRetry={outputs.reload} />;
  } else if (outputs.status === 'loading' || outputs.status === 'idle') {
    body = (
      <div className="flex flex-col gap-wds-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-[52px] w-full" />
        <Skeleton className="h-[120px] w-full" />
        <Skeleton className="h-[64px] w-full" />
      </div>
    );
  } else if ((outputs.data ?? []).length === 0) {
    body = <EmptyState title={PREP_STATES_COPY.record.outputsEmptyTitle} description={PREP_STATES_COPY.record.outputsEmptyDescription} />;
  } else if (itemId && !output) {
    body = (
      <EmptyState
        title={PREP_STATES_COPY.record.outputNotFoundTitle}
        description={PREP_STATES_COPY.record.outputNotFoundDescription}
        action={
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            Pick another item
          </Button>
        }
      />
    );
  } else if (!output) {
    body = (
      <div className="flex flex-col items-start gap-wds-3">
        <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Choose the item you made to start a run.</p>
        <Button onClick={() => setPickerOpen(true)}>Choose item</Button>
      </div>
    );
  } else {
    body = <RunFormBody form={form} mode="attendant" onAddClick={() => setIngredientOpen(true)} />;
  }

  const used = form.lines.filter((l) => Number(l.quantity) > 0).map((l) => ({ name: l.name, quantity: l.quantity, unit: l.unit }));
  const confirmLabel = form.saving ? 'Recording…' : 'Confirm run';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
      {header}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto grid w-full max-w-[1120px] flex-1 content-start gap-wds-6 p-wds-4 md:grid-cols-[minmax(0,1fr)_320px] md:p-wds-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-wds-8 lg:py-wds-7">
          <div className="flex min-w-0 flex-col gap-wds-4">
            {desktop && output ? (
              <div className="flex flex-col gap-1">
                <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">{output.name}</h1>
                <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{output.lastRun ? 'Filled in as last time. Change what is different.' : 'Add what you used and what you made.'}</p>
              </div>
            ) : null}
            {body}
          </div>
          {output && outputs.status === 'ready' ? (
            <aside className="hidden md:block">
              <RunSummaryPanel variant="panel" made={{ name: output.name, quantity: form.made, unit: output.unit }} used={used} check={form.check}>
                {yieldIsOff(form) ? <YieldReasonChips value={form.yieldReason} onChange={form.setYieldReason} /> : null}
                {form.saveError ? <WarningBox>{form.saveError}</WarningBox> : null}
                <Button className="h-11 w-full text-[15px]" disabled={!form.canReview || form.saving} onClick={requestConfirm}>
                  {confirmLabel}
                </Button>
                <p className="text-center font-wds-sans text-wds-caption text-wds-text-copy-muted">
                  {desktop ? 'This writes one entry to the record. Nothing is saved until you confirm.' : 'Nothing is saved until you confirm.'}
                </p>
              </RunSummaryPanel>
            </aside>
          ) : null}
        </div>
      </div>

      {/* Phone: the one action sits at the bottom, outside the scrolling form. */}
      {output && outputs.status === 'ready' ? (
        <div className="flex shrink-0 flex-col gap-wds-2 border-t border-wds-border bg-wds-canvas p-wds-4 md:hidden">
          <Button className="h-12 w-full text-[15px]" disabled={!form.canReview} onClick={requestConfirm}>
            Review and confirm
          </Button>
          <p className="text-center font-wds-sans text-wds-caption text-wds-text-copy-muted">Nothing is saved until you confirm.</p>
        </div>
      ) : null}

      <OutputPicker open={pickerOpen} onOpenChange={setPickerOpen} outputs={outputs.data} loading={outputs.status === 'loading'} error={outputs.error} onRetry={outputs.reload} onPick={pick} />
      <IngredientPicker
        open={ingredientOpen}
        onOpenChange={setIngredientOpen}
        excludeItemIds={[...(output ? [output.itemId] : []), ...form.lines.map((l) => l.itemId)]}
        onPick={(item) => {
          form.addLine(item);
          setIngredientOpen(false);
        }}
      />
      {!wide ? <ConfirmSheet open={confirmOpen} onOpenChange={setConfirmOpen} form={form} onConfirm={() => void recordNow()} /> : null}
      <ConfirmDialog
        open={repeatOpen}
        onOpenChange={setRepeatOpen}
        title="Looks like a repeat"
        description={
          form.check?.repeat.of
            ? `${form.check.repeat.of.reference} was recorded today at ${formatDayAndClock(form.check.repeat.of.at).replace(/^today /, '')} with the same amounts${output ? ` of ${output.name}` : ''}. Record it again?`
            : 'This matches a run recorded today. Record it again?'
        }
        confirmLabel="Record again"
        cancelLabel="Go back"
        destructive={false}
        onConfirm={() => {
          setRepeatOpen(false);
          proceed();
        }}
      />
      <span className="sr-only" aria-live="polite">
        {output ? `${output.name}, ${formatQuantity(form.made)} ${output.unit}` : ''}
      </span>
    </div>
  );
}
