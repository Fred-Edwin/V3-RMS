'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { Button } from '@/components/ui2/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { Skeleton } from '@/components/ui2/skeleton';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { formatApiErrorMessage } from '@/types/api';
import { LoadingAnnouncer } from '../../_shared/components/scw-states';
import { useLoader } from '../../_shared/hooks/use-async';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import type { ApproveResult, Addition, RequisitionFile } from '../_shared/types/requisitions-contract';
import { clock, dayLabel, errorWords, fileChip, kes, nextStepWords } from '../_shared/lib/requisitions-words';
import { AdditionsPanel, ApproveAdditionDialog } from './additions-panel';
import { ApproveDrawer } from './approve-drawer';
import { CancelDialog } from './cancel-dialog';
import { ActivityTab, DocumentsTab } from './file-extra-tabs';
import { FileItems } from './file-items';
import { FillForHeadSheet } from './fill-for-head-sheet';
import { MonoLabel, ReqTabs, StatusChip, UrgentTag } from './req-parts';
import { useBadgesNudge } from '../hooks/use-badges-nudge';
import { requisitionProgress } from '../_shared/lib/requisition-progress';
import { ProgressTracker } from '../../dispatch/components/desktop/progress-tracker';
import { RequisitionDispatchesPanel } from '../../dispatch/components/desktop/requisition-dispatches-panel';

type View = 'items' | 'documents' | 'activity';

/** "1 of 5 sections in", "all 5 sections in", or "1 of 5 sections in, 4 sent without" once the manager skipped some. */
function sectionsText(data: RequisitionFile): string {
  const { sectionsIn, sectionsTotal } = data.nextStep.facts;
  const skipped = data.sections.filter((s) => s.status === 'SKIPPED').length;
  if (skipped > 0) return `${sectionsTotal - skipped} of ${sectionsTotal} sections in, ${skipped} sent without`;
  return `${sectionsIn === sectionsTotal ? `all ${sectionsTotal}` : `${sectionsIn} of ${sectionsTotal}`} sections in`;
}

/** "Kitchen", "Kitchen and Barista", "the 3 sections that are in". */
function namesIn(data: RequisitionFile): string {
  const names = data.sections.filter((s) => s.status === 'SUBMITTED').map((s) => s.departmentName);
  if (names.length <= 2) return names.join(' and ');
  return `the ${names.length} sections that are in`;
}

/** The first names of the heads who sent a section, so the banner says who was told. */
function toldNames(data: RequisitionFile | null | undefined): string[] {
  return (data?.sections ?? []).filter((s) => s.status === 'SUBMITTED').map((s) => s.sentBy?.name.split(' ')[0] ?? `The ${s.departmentName} head`);
}

/** "Kelvin has been told", "Kelvin and Amina have been told", "Kelvin and 3 others have been told". */
function toldSentence(told: string[]): string {
  const [first, second] = told;
  if (!first) return 'The heads have been told.';
  if (!second) return `${first} has been told.`;
  if (told.length === 2) return `${first} and ${second} have been told.`;
  return `${first} and ${told.length - 1} others have been told.`;
}

function FileSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-4 w-[520px]" />
      <div className="grid grid-cols-6 gap-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-[300px_1fr] gap-5"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  );
}

/** The one requisition file, drawn the same in every state (Paper steps 8, 9, 11, 12, 13, 16): status, tracker and the one main button change. */
export function RequisitionFileScreen({ id, base, printBase, section: crumb }: { id: string; base: string; printBase: string; section: 'Branch' | 'Central Store' }) {
  const router = useRouter();
  const params = useSearchParams();
  const file = useLoader(`file:${id}`, () => requisitionsApi.file(id), 'Could not load this requisition.');
  const [approved, setApproved] = React.useState<{ at: string; reference: string; told: string[] } | null>(null);
  const [additionToApprove, setAdditionToApprove] = React.useState<Addition | null>(null);
  const [fillFor, setFillFor] = React.useState<string | null>(null);
  const [menuFailure, setMenuFailure] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmSkip, setConfirmSkip] = React.useState(false);
  const data = file.data;
  const reload = file.reload;
  // Dialogs and sheets opened from a menu return focus to the control that opened the menu (the menu item is gone by then).
  const moreRef = React.useRef<HTMLButtonElement>(null);
  const fillTrigger = React.useRef<HTMLElement | null>(null);

  const view: View = params.get('view') === 'documents' ? 'documents' : params.get('view') === 'activity' ? 'activity' : 'items';
  const drawer = params.get('drawer') === 'approve';
  const cancelling = params.get('dialog') === 'cancel';
  const selected = params.get('department') ?? data?.sections.find((s) => s.status === 'SUBMITTED')?.departmentId ?? data?.sections[0]?.departmentId ?? '';
  const printHref = `${printBase}/${id}`;

  const setParam = React.useCallback(
    (changes: Record<string, string | null>, push = false): void => {
      const q = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) q.delete(key);
        else q.set(key, value);
      }
      const url = `${base}/${id}${q.toString() ? `?${q}` : ''}`;
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, router, base, id],
  );

  // Another person's change (a head sends, the store packs) shows at once (socket nudge) or when the person comes back to the tab.
  useBadgesNudge(() => void reload());

  const toast = (variant: 'success' | 'error', title: string, description?: string): void => {
    useWdsToastStore.getState().addToast({ variant, title, description });
  };
  const run = async (work: () => Promise<unknown>, success?: { title: string; description?: string }): Promise<boolean> => {
    setBusy(true);
    setMenuFailure(null);
    try {
      await work();
      if (success) toast('success', success.title, success.description);
      await reload();
      return true;
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : null;
      setMenuFailure(errorWords(code, 'manager', formatApiErrorMessage(err, 'Something went wrong. Try again.'), 'Something went wrong. Try again.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onApproved = (result: ApproveResult): void => {
    setApproved({ at: result.approvedAt, reference: result.reference, told: toldNames(data) });
    setParam({ drawer: null });
    void reload();
  };

  const words = data ? nextStepWords(data) : null;
  const chip = data ? fileChip(data) : null;
  const missing = data?.sections.filter((s) => s.status === 'NOT_STARTED' || s.status === 'DRAFT') ?? [];

  const doNextStep = (): void => {
    if (!data) return;
    const action = data.nextStep.action;
    if (action === 'NUDGE' && data.nextStep.departmentId) {
      // Everyone who has not sent is told, not only the first one.
      const targets = missing.length > 0 ? missing : data.sections.filter((s) => s.departmentId === data.nextStep.departmentId);
      void run(() => Promise.all(targets.map((t) => requisitionsApi.nudge(id, t.departmentId))), {
        title: targets.length > 1 ? 'Nudges sent' : 'Nudge sent',
        description: `${targets.map((t) => t.departmentName).join(', ')} ${targets.length > 1 ? 'have' : 'has'} been told.`,
      });
    } else if (action === 'APPROVE_AND_SIGN') setParam({ drawer: 'approve' });
    else if (action === 'APPROVE_ADDITION') setAdditionToApprove(data.additions.find((a) => a.status === 'PENDING') ?? null);
    else if (action === 'PRINT') window.open(printHref, '_blank', 'noopener');
    else if (action === 'START_A_NEW_ONE') router.push(base);
  };

  const sendWithoutMissing = (): void => {
    setConfirmSkip(false);
    void run(() => requisitionsApi.skip(id, { departmentIds: missing.map((m) => m.departmentId) }), { title: missing.length === 1 ? 'Sent without the missing section' : `Sent without ${missing.length} sections`, description: missing.map((m) => m.departmentName).join(', ') });
  };
  const fillable = data?.sections.find((s) => s.departmentId === data.nextStep.departmentId && s.can.fillMyself) ?? null;
  const canApproveWithoutMissing = Boolean(data?.can.skip) && (data?.nextStep.facts.sectionsIn ?? 0) > 0 && missing.length > 0;

  const subline = data
    ? [
        data.reference,
        data.branch.name,
        data.status === 'APPROVED' || data.status === 'CLOSED' ? (data.approvedAt ? `approved ${clock(data.approvedAt)}` : null) : `started ${clock(data.openedAt)}`,
        data.status === 'OPEN' || data.status === 'PENDING_APPROVAL' ? sectionsText(data) : null,
        // An approved addition's lines are already in `lineCount`; only the ones still waiting are "added" on top of it.
        `${data.lineCount} ${data.lineCount === 1 ? 'line' : 'lines'}${data.additions.some((a) => a.status === 'PENDING') ? ` + ${data.additions.filter((a) => a.status === 'PENDING').reduce((n, a) => n + a.lines.length, 0)} added` : ''}`,
        data.valueKes !== undefined ? `KES ${kes(data.valueKes)}${data.status === 'OPEN' ? ' so far' : ''}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar hideSearch breadcrumb={{ root: crumb, section: 'Requisitions', sectionHref: base, screen: data?.reference ?? 'Requisition' }} />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        {file.status === 'error' ? (
          <ErrorState title="Couldn't load this requisition" description="Check your connection and try again." onRetry={() => void reload()} />
        ) : !data || !words || !chip ? (
          <>
            <LoadingAnnouncer text="Getting the requisition" />
            <FileSkeleton />
          </>
        ) : (
          <>
            {approved ? (
              <div role="status" className="flex items-center gap-4 border border-wds-success-border bg-wds-success-bg px-5 py-4">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-wds-success-fg text-wds-surface">
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <div className="flex flex-col">
                  <p className="font-wds-sans text-[17px] font-semibold text-wds-success-fg">Approved and sent to the Central Store</p>
                  <p className="font-wds-sans text-[15px] text-wds-text-ink">
                    You signed {approved.reference} at {clock(approved.at)}. {toldSentence(approved.told)}
                  </p>
                </div>
              </div>
            ) : null}

            <header className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-wds-sans text-wds-mobile-title tracking-[-0.01em] text-wds-text-ink">{data.cycleLabel.split(' · ')[0]} · {dayLabel(data.openedAt)}</h1>
                  <StatusChip chip={chip} />
                  {data.urgent ? <UrgentTag /> : null}
                </div>
                <p className="font-wds-mono text-[13px] leading-[18px] text-wds-text-secondary">{subline}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {data.can.print ? <Button variant="secondary" onClick={() => window.open(printHref, '_blank', 'noopener')}>Print</Button> : null}
                {approved ? <Button onClick={() => router.push(base)}>Back to requisitions</Button> : null}
                {data.can.setUrgent || data.can.cancel ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button ref={moreRef} variant="secondary" size="icon" aria-label="More actions" disabled={busy}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {data.can.setUrgent ? (
                        <DropdownMenuItem onSelect={() => void run(() => requisitionsApi.setUrgent(id, { urgent: !data.urgent }), { title: data.urgent ? 'Urgent cleared' : 'Marked as urgent', description: data.urgent ? undefined : 'The Branch Manager is told at once, the Director after 1 hour.' })}>
                          {data.urgent ? 'Clear urgent' : 'Mark as urgent'}
                        </DropdownMenuItem>
                      ) : null}
                      {data.can.cancel ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-wds-error-fg" onSelect={() => setParam({ dialog: 'cancel' })}>Cancel requisition</DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </header>

            <ProgressTracker steps={requisitionProgress(data.tracker, data.can.approve)} />

            <section aria-label="Next step" className="flex flex-col items-stretch justify-between gap-5 border border-wds-border border-l-[3px] sm:flex-row sm:items-center sm:gap-8 border-l-wds-caramel-500 bg-wds-surface px-6 py-5">
              <div className="flex max-w-[860px] flex-col gap-1.5">
                <MonoLabel>Next step</MonoLabel>
                <h2 className="font-wds-sans text-[18px] font-semibold leading-6 tracking-[-0.01em] text-wds-text-ink">{words.title}</h2>
                <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{words.body}</p>
                {data.nextStep.action === 'NUDGE' && fillable ? (
                  <button
                    type="button"
                    onClick={(event) => { fillTrigger.current = event.currentTarget; setFillFor(fillable.departmentId); }}
                    disabled={busy}
                    className="mt-1 self-start font-wds-sans text-[14px] font-medium text-wds-text-ink underline underline-offset-4 outline-none hover:text-wds-primary focus-visible:shadow-wds-ring"
                  >
                    Fill {fillable.departmentName} in myself
                  </button>
                ) : null}
              </div>
              {words.action && words.actionLabel ? (
                data.nextStep.action === 'NUDGE' ? (
                  <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
                    <Button size="lg" onClick={doNextStep} disabled={busy} className="h-[46px] px-6 text-[16px]">{words.actionLabel}</Button>
                    {canApproveWithoutMissing ? (
                      <Button size="lg" variant="secondary" onClick={() => setConfirmSkip(true)} disabled={busy} className="h-[46px] px-5 text-[16px]">
                        Approve with {namesIn(data)} only
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <Button size="lg" variant={data.nextStep.action === 'PRINT' || data.nextStep.action === 'START_A_NEW_ONE' ? 'secondary' : 'primary'} onClick={doNextStep} disabled={busy} className="h-[46px] shrink-0 px-6 text-[16px]">
                    {words.actionLabel}
                  </Button>
                )
              ) : null}
            </section>
            {confirmSkip && canApproveWithoutMissing ? (
              <section role="alertdialog" aria-labelledby="req-skip-title" className="flex flex-col items-stretch justify-between gap-4 border border-wds-warning-border bg-wds-warning-bg px-6 py-4 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex max-w-[860px] flex-col gap-1">
                  <h2 id="req-skip-title" className="font-wds-sans text-[16px] font-semibold leading-6 text-wds-warning-fg">
                    Send without {missing.map((m) => m.departmentName).join(', ')}?
                  </h2>
                  <p className="font-wds-sans text-[14px] leading-5 text-wds-text-ink">
                    {missing.length === 1 ? 'That head' : 'Those heads'} will be told and can start an Extra requisition if they still need something. Then you sign for {namesIn(data)}.
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <Button variant="secondary" onClick={() => setConfirmSkip(false)} disabled={busy}>Keep waiting</Button>
                  <Button onClick={sendWithoutMissing} disabled={busy}>Send without them</Button>
                </div>
              </section>
            ) : null}
            {menuFailure ? <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-4 py-2.5 font-wds-sans text-[14px] text-wds-error-fg">{menuFailure}</p> : null}
            {data.cancelled ? (
              <p className="border border-wds-border-strong bg-wds-neutral-50 px-4 py-3 font-wds-sans text-[15px] text-wds-text-ink">
                Cancelled {dayLabel(data.cancelled.at)} at {clock(data.cancelled.at)} by {data.cancelled.by.roleLabel}: {data.cancelled.reason}
              </p>
            ) : null}

            <AdditionsPanel file={data} onApprove={setAdditionToApprove} />

            <div className="flex flex-col">
              <ReqTabs
                label="Requisition contents"
                active={view}
                onChange={(next) => setParam({ view: next === 'items' ? null : next })}
                tabs={[
                  { key: 'items', label: data.dispatches.length > 0 ? 'Items and dispatches' : 'Items' },
                  { key: 'documents', label: 'Documents' },
                  { key: 'activity', label: 'Activity' },
                ]}
              />
              <div role="tabpanel" aria-labelledby={`req-tab-${view}`}>
              {view === 'items' && data.dispatches.length > 0 ? (
                <RequisitionDispatchesPanel file={data} selected={params.get('department') ?? data.dispatches[0]?.departmentId ?? ''} onSelect={(departmentId) => setParam({ department: departmentId })} base={base} onChanged={() => void reload()} />
              ) : view === 'items' ? (
                <FileItems file={data} selected={selected} onSelect={(departmentId) => setParam({ department: departmentId })} onChanged={() => void reload()} onFillMyself={(departmentId, trigger) => { fillTrigger.current = trigger; setFillFor(departmentId); }} />
              ) : view === 'documents' ? (
                <DocumentsTab requisitionId={id} printHref={printHref} canPrint={data.can.print} />
              ) : (
                <ActivityTab requisitionId={id} recordHref={(kind, rid) => (kind === 'REQUISITION' ? `${base}/${rid}` : null)} />
              )}
              </div>
            </div>
          </>
        )}
      </main>

      <ApproveDrawer requisitionId={id} open={drawer && Boolean(data?.can.approve)} onOpenChange={(open) => setParam({ drawer: open ? 'approve' : null })} onApproved={onApproved} />
      {data ? (
        <CancelDialog
          requisitionId={id}
          reference={data.reference}
          cycleLabel={data.cycleLabel}
          lineCount={data.lineCount}
          returnFocus={() => moreRef.current}
          open={cancelling && data.can.cancel}
          onOpenChange={(open) => setParam({ dialog: open ? 'cancel' : null })}
          onCancelled={() => {
            setParam({ dialog: null });
            toast('success', 'Requisition cancelled', 'It stays on record as Cancelled and the heads are told.');
            void reload();
          }}
        />
      ) : null}
      {data ? (
        <ApproveAdditionDialog
          file={data}
          addition={additionToApprove}
          onOpenChange={(open) => !open && setAdditionToApprove(null)}
          onApproved={() => {
            setAdditionToApprove(null);
            toast('success', 'Addition approved', 'The added lines went to the Central Store.');
            void reload();
          }}
        />
      ) : null}
      <FillForHeadSheet
        requisitionId={id}
        departmentId={fillFor}
        departmentName={data?.sections.find((s) => s.departmentId === fillFor)?.departmentName ?? 'the department'}
        returnFocus={() => fillTrigger.current}
        onOpenChange={(open) => !open && setFillFor(null)}
        onSent={() => {
          setFillFor(null);
          toast('success', 'List sent', 'Recorded as sent by the Branch Manager. The head has been told.');
          void reload();
        }}
      />
    </div>
  );
}

export type { RequisitionFile };
