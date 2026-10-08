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
import { cn } from '@/lib/cn';
import { formatApiErrorMessage } from '@/types/api';
import { LoadingAnnouncer } from '../../_shared/components/scw-states';
import { useLoader } from '../../_shared/hooks/use-async';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import type { ApproveResult, Addition, RequisitionFile } from '../_shared/types/requisitions-contract';
import { clock, dayLabel, errorWords, fileChip, kes, nextStepWords, trackerWords } from '../_shared/lib/requisitions-words';
import { AdditionsPanel, ApproveAdditionDialog } from './additions-panel';
import { ApproveDrawer } from './approve-drawer';
import { CancelDialog } from './cancel-dialog';
import { ActivityTab, DocumentsTab } from './file-extra-tabs';
import { FileItems } from './file-items';
import { FillForHeadSheet } from './fill-for-head-sheet';
import { MonoLabel, ReqTabs, StatusChip, UrgentTag } from './req-parts';

type View = 'items' | 'documents' | 'activity';

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
  const [approved, setApproved] = React.useState<{ at: string; reference: string; heads: number } | null>(null);
  const [additionToApprove, setAdditionToApprove] = React.useState<Addition | null>(null);
  const [fillFor, setFillFor] = React.useState<string | null>(null);
  const [menuFailure, setMenuFailure] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const data = file.data;
  const reload = file.reload;
  // Dialogs and sheets opened from a menu return focus to the control that opened the menu (the menu item is gone by then).
  const moreRef = React.useRef<HTMLButtonElement>(null);
  const caretRef = React.useRef<HTMLButtonElement>(null);
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

  // Another person's change (a head sends, the store packs) shows when the person comes back to the tab.
  React.useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

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
    setApproved({ at: result.approvedAt, reference: result.reference, heads: data?.sections.filter((s) => s.status === 'SUBMITTED').length ?? 0 });
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
      const name = data.sections.find((s) => s.departmentId === data.nextStep.departmentId)?.departmentName ?? 'the department';
      void run(() => requisitionsApi.nudge(id, data.nextStep.departmentId ?? ''), { title: 'Nudge sent', description: `${name} has been told.` });
    } else if (action === 'APPROVE_AND_SIGN') setParam({ drawer: 'approve' });
    else if (action === 'APPROVE_ADDITION') setAdditionToApprove(data.additions.find((a) => a.status === 'PENDING') ?? null);
    else if (action === 'PRINT') window.open(printHref, '_blank', 'noopener');
    else if (action === 'START_A_NEW_ONE') router.push(base);
  };

  const sendWithoutMissing = (): void => {
    void run(() => requisitionsApi.skip(id, { departmentIds: missing.map((m) => m.departmentId) }), { title: 'Sent without the missing section', description: missing.map((m) => m.departmentName).join(', ') });
  };

  const subline = data
    ? [
        data.reference,
        data.branch.name,
        data.status === 'APPROVED' || data.status === 'CLOSED' ? (data.approvedAt ? `approved ${clock(data.approvedAt)}` : null) : `started ${clock(data.openedAt)}`,
        data.status === 'OPEN' || data.status === 'PENDING_APPROVAL' ? `${data.nextStep.facts.sectionsIn === data.nextStep.facts.sectionsTotal ? `all ${data.nextStep.facts.sectionsTotal}` : `${data.nextStep.facts.sectionsIn} of ${data.nextStep.facts.sectionsTotal}`} sections in` : null,
        `${data.lineCount} lines${data.additions.length ? ` + ${data.additions.reduce((n, a) => n + a.lines.length, 0)} added` : ''}`,
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
                    You signed {approved.reference} at {clock(approved.at)}. {approved.heads === 1 ? 'The head has' : `The ${approved.heads} heads have`} been told.
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
                {approved ? <Button variant="secondary" onClick={() => router.push(base)}>Back to requisitions</Button> : null}
                {data.can.print || data.can.setUrgent || data.can.cancel ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button ref={moreRef} variant="secondary" size="icon" aria-label="More actions" disabled={busy}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {data.can.print ? <DropdownMenuItem onSelect={() => window.open(printHref, '_blank', 'noopener')}>Print</DropdownMenuItem> : null}
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

            <ol aria-label="Progress" className="grid grid-cols-3 gap-x-4 gap-y-5 lg:grid-cols-6">
              {trackerWords(data.tracker, data.can.approve).map((step, index, all) => (
                <li key={step.key} aria-current={step.state === 'CURRENT' ? 'step' : undefined} className="relative flex flex-col gap-1 pt-6 max-lg:[&:nth-child(3n)>span:nth-child(2)]:hidden">
                  <span aria-hidden className={cn('absolute left-0 top-0 z-10 size-3.5 rounded-full border-2', step.state === 'DONE' ? 'border-wds-success-fg bg-wds-success-fg' : step.state === 'CURRENT' ? 'border-wds-caramel-700 bg-wds-surface' : 'border-wds-border-strong bg-wds-surface')} />
                  {index < all.length - 1 ? <span aria-hidden className={cn('absolute left-3.5 right-[-16px] top-[6px] h-[2px]', step.state === 'DONE' ? 'bg-wds-success-fg' : 'bg-wds-border')} /> : null}
                  <span className={cn('font-wds-sans text-[14px] leading-[18px]', step.state === 'TODO' ? 'text-wds-text-secondary' : 'font-semibold text-wds-text-ink')}>{step.label}</span>
                  <span className={cn('font-wds-sans text-[13px] leading-4', step.state === 'TODO' ? 'text-wds-text-faint' : 'text-wds-text-secondary')}>{step.second}</span>
                </li>
              ))}
            </ol>

            <section aria-label="Next step" className="flex flex-col items-stretch justify-between gap-5 border border-wds-border border-l-[3px] sm:flex-row sm:items-center sm:gap-8 border-l-wds-caramel-500 bg-wds-surface px-6 py-5">
              <div className="flex max-w-[860px] flex-col gap-1.5">
                <MonoLabel>Next step</MonoLabel>
                <h2 className="font-wds-sans text-[18px] font-semibold leading-6 tracking-[-0.01em] text-wds-text-ink">{words.title}</h2>
                <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{words.body}</p>
              </div>
              {words.action && words.actionLabel ? (
                data.nextStep.action === 'NUDGE' ? (
                  <div className="flex shrink-0">
                    <Button size="lg" onClick={doNextStep} disabled={busy} className="h-[46px] rounded-r-none px-6 text-[16px]">{words.actionLabel}</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button ref={caretRef} size="lg" aria-label="More ways to deal with the missing section" disabled={busy} className="h-[46px] rounded-l-none border-l border-wds-primary-fg/30 px-3">▾</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[340px]">
                        {data.sections.find((s) => s.departmentId === data.nextStep.departmentId)?.can.fillMyself ? (
                          <DropdownMenuItem className="flex-col items-start gap-0.5 py-2.5" onSelect={() => { fillTrigger.current = caretRef.current; setFillFor(data.nextStep.departmentId); }}>
                            <span className="text-[16px]">Fill it myself</span>
                            <span className="text-[14px] text-wds-text-secondary">Start {missing[0]?.departmentName}&apos;s section for them</span>
                          </DropdownMenuItem>
                        ) : null}
                        {data.can.skip ? (
                          <DropdownMenuItem className="flex-col items-start gap-0.5 py-2.5" onSelect={sendWithoutMissing}>
                            <span className="text-[16px]">Send without this section</span>
                            <span className="text-[14px] text-wds-text-secondary">{data.nextStep.facts.sectionsIn === 1 ? 'Approve the 1 section that is in' : `Approve the ${data.nextStep.facts.sectionsIn} sections that are in`}</span>
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <Button size="lg" variant={data.nextStep.action === 'PRINT' || data.nextStep.action === 'START_A_NEW_ONE' ? 'secondary' : 'primary'} onClick={doNextStep} disabled={busy} className="h-[46px] shrink-0 px-6 text-[16px]">
                    {words.actionLabel}
                  </Button>
                )
              ) : null}
            </section>
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
                  { key: 'items', label: data.dispatches.length > 0 ? 'Items and dispatches' : 'Items', count: data.dispatches.length > 0 ? undefined : data.lineCount },
                  { key: 'documents', label: 'Documents' },
                  { key: 'activity', label: 'Activity' },
                ]}
              />
              <div role="tabpanel" aria-labelledby={`req-tab-${view}`}>
              {view === 'items' ? (
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
