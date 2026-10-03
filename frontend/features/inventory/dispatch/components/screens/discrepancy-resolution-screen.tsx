'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Textarea } from '@/components/ui2/textarea';
import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { useDiscrepancyResolve } from '../../hooks/use-discrepancy-resolve';
import type { DiscrepancyDetail, DiscrepancyOutcome } from '../../types';

const DEPARTMENT_LABEL: Record<string, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const OUTCOME_OPTIONS: { value: DiscrepancyOutcome; label: string; describe: (d: DiscrepancyDetail) => string }[] = [
  {
    value: 'FOUND_REDELIVERED',
    label: 'Found & re-delivered',
    describe: (d) => `The ${Math.abs(Number(d.gapQty))} ${d.usageUnit} turned up — spawn a follow-up dispatch cycle for the shortfall. No adjustment.`,
  },
  {
    value: 'TRANSIT_LOSS_WRITEOFF',
    label: 'Transit loss — write off',
    describe: (d) =>
      `Records an adjustment of ${d.gapQty} ${d.usageUnit} at the Central Store, reason "transit loss". ${d.branchName} keeps the ${d.confirmedQty ?? '0'} ${d.usageUnit} it confirmed.`,
  },
  {
    value: 'MISCOUNT_CORRECTED',
    label: 'Miscount corrected',
    describe: (d) =>
      `The branch recounted and found all ${d.dispatchedQty} ${d.usageUnit} — adjustment at ${d.branchName} · ${DEPARTMENT_LABEL[d.departmentTag] ?? d.departmentTag} to the corrected quantity, reason "receiving miscount".`,
  },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

interface GapCardProps {
  detail: DiscrepancyDetail;
}

/** Shared "The gap" summary — dispatched/confirmed/gap/value-at-cost, identical across the populated and resolved states. */
function GapCard({ detail }: GapCardProps) {
  const valueAtCost = Math.abs(Number(detail.gapQty)) * Number(detail.costAtDispatch);
  return (
    <div className="flex flex-col overflow-hidden rounded-wds-sm border border-wds-border bg-wds-surface">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-4">
        <div className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">The gap</div>
        <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
          confirmed by {detail.confirmedByName ?? '—'} · {formatDateTime(detail.confirmedAt)}
        </div>
      </div>
      <div className="flex">
        <div className="flex grow flex-col gap-1.5 border-r border-wds-border p-4">
          <div className="font-wds-mono text-wds-label text-wds-text-copy-muted">DISPATCHED</div>
          <div className="font-wds-sans text-wds-kpi font-medium text-wds-text-ink">{detail.dispatchedQty}</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            {detail.itemName} · {detail.usageUnit}
          </div>
        </div>
        <div className="flex grow flex-col gap-1.5 border-r border-wds-border p-4">
          <div className="font-wds-mono text-wds-label text-wds-text-copy-muted">CONFIRMED</div>
          <div className="font-wds-sans text-wds-kpi font-medium text-wds-text-ink">{detail.confirmedQty ?? '—'}</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            at {detail.branchName} · {DEPARTMENT_LABEL[detail.departmentTag] ?? detail.departmentTag}
          </div>
        </div>
        <div className="flex grow flex-col gap-1.5 border-r border-wds-border bg-wds-error-bg p-4">
          <div className="font-wds-mono text-wds-label text-wds-error-fg">GAP</div>
          <div className="font-wds-sans text-wds-kpi font-medium text-wds-error-fg">{detail.gapQty}</div>
          <div className="font-wds-sans text-wds-caption text-wds-error-fg">{detail.usageUnit} missing</div>
        </div>
        <div className="flex grow flex-col gap-1.5 p-4">
          <div className="font-wds-mono text-wds-label text-wds-text-copy-muted">VALUE AT FROZEN COST</div>
          <div className="font-wds-mono text-wds-kpi font-medium text-wds-text-ink">KES {valueAtCost.toFixed(0)}</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            KES {Number(detail.costAtDispatch).toFixed(0)} / {detail.usageUnit}, carried
          </div>
        </div>
      </div>
    </div>
  );
}

export interface DiscrepancyResolutionScreenProps {
  discrepancyId: string;
}

/**
 * Store Manager desktop — Resolve transit discrepancy (`16GW-0` populated /
 * `16LI-0` resolved). Explicit variant (not a shared component with
 * DiscrepancyDetailScreen's read-only Branch Manager view) per
 * vercel-composition-patterns' avoid-boolean-props guidance — this screen
 * owns the outcome-selection + sign flow, DiscrepancyDetailScreen owns the
 * read-only view; both compose GapCard.
 */
export function DiscrepancyResolutionScreen({ discrepancyId }: DiscrepancyResolutionScreenProps) {
  const router = useRouter();
  const { detail, resolve, resolving, resolveError, status, error, reload } = useDiscrepancyResolve(discrepancyId);
  const [outcome, setOutcome] = React.useState<DiscrepancyOutcome>('TRANSIT_LOSS_WRITEOFF');
  const [note, setNote] = React.useState('');
  const [signOpen, setSignOpen] = React.useState(false);

  if (status === 'loading' || !detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Dispatch', screen: 'Discrepancy' }} className="shrink-0" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Dispatch', screen: 'Discrepancy' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <ErrorState title="Couldn't load this discrepancy" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    );
  }

  const isResolved = detail.status === 'RESOLVED';
  const selectedOption = OUTCOME_OPTIONS.find((o) => o.value === (detail.outcome ?? outcome));

  const handleSign = async (pin: string) => {
    const ok = await resolve(outcome, note.trim(), pin);
    if (ok) setSignOpen(false);
  };

  if (isResolved) {
    const outcomeLabel = OUTCOME_OPTIONS.find((o) => o.value === detail.outcome)?.label ?? detail.outcome ?? '—';
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar
          breadcrumb={{ section: 'Dispatch', screen: `Discrepancies · ${detail.referenceNumber}` }}
          actions={
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-wds-success-fg" />
              <span className="font-wds-sans text-wds-caption text-wds-success-fg">Resolved · {formatDateTime(detail.resolvedAt)}</span>
            </div>
          }
          className="shrink-0"
        />
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pb-24 pt-7">
          <div className="flex flex-col gap-1">
            <div className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">Discrepancy resolved</div>
            <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
              {DEPARTMENT_LABEL[detail.departmentTag] ?? detail.departmentTag} · {detail.branchName} · {detail.referenceNumber}. The signed outcome
              below is recorded and the ledger entry written.
            </div>
          </div>
          <GapCard detail={detail} />
          <div className="flex flex-col overflow-hidden rounded-wds-sm border border-wds-border bg-wds-surface">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-4">
              <span className="size-1.5 shrink-0 rounded-full bg-wds-success-fg" />
              <div className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">Outcome — {outcomeLabel}</div>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="font-wds-sans text-wds-body-sm text-wds-text-ink">{selectedOption?.describe(detail) ?? ''}</div>
              {detail.resolutionNote ? (
                <div className="flex flex-col gap-1 rounded-wds-sm bg-wds-neutral-50 px-3 py-2.5">
                  <div className="font-wds-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted">RESOLUTION NOTE</div>
                  <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{detail.resolutionNote}</div>
                </div>
              ) : null}
            </div>
            <div className="flex gap-12 border-t border-wds-border px-4 pb-5 pt-4">
              <div className="flex flex-col gap-[5px]">
                <div className="font-wds-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted">RESOLVED &amp; SIGNED BY</div>
                <div className="font-wds-signature text-[30px]/8 text-wds-text-ink">{detail.resolvedByName ?? '—'}</div>
                <div className="mt-0.5 h-px w-[220px] shrink-0 bg-wds-border-strong" />
                <div className="font-wds-sans text-wds-label text-wds-text-copy-muted">Store Manager · PIN verified {formatDateTime(detail.resolvedAt)}</div>
              </div>
              {detail.followUpDispatchId ? (
                <div className="flex flex-col gap-[5px]">
                  <div className="font-wds-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted">FOLLOW-UP</div>
                  <button
                    type="button"
                    onClick={() => router.push(`/app/inventory/dispatch/${detail.followUpDispatchId}`)}
                    className="text-left font-wds-sans text-wds-body-sm text-wds-primary underline decoration-wds-primary underline-offset-2"
                  >
                    View follow-up dispatch
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-[68px] shrink-0 items-center gap-4 border-t border-wds-border bg-wds-surface px-8">
          <div className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-wds-success-fg" />
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Resolved {formatDateTime(detail.resolvedAt)} · immutable</span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <Button variant="secondary" onClick={() => router.push('/app/inventory/dispatch')}>
              Back to dispatch
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Dispatch', screen: `Discrepancies · ${detail.referenceNumber}` }}
        actions={
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 shrink-0 rounded-full bg-wds-error-fg" />
            <span className="font-wds-sans text-wds-caption text-wds-error-fg">Discrepancy open · dispatch held</span>
          </div>
        }
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 grow flex-col gap-5 overflow-y-auto px-8 pb-24 pt-7">
          <div className="flex flex-col gap-1">
            <div className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">Resolve transit discrepancy</div>
            <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
              {DEPARTMENT_LABEL[detail.departmentTag] ?? detail.departmentTag} · {detail.branchName} received less than was dispatched. Record a
              signed outcome — it writes the matching ledger entry and closes the loop to the branch manager.
            </div>
          </div>
          <GapCard detail={detail} />
          <div className="flex flex-col gap-2.5">
            <div className="font-wds-mono text-wds-label text-wds-text-copy-muted">CHOOSE AN OUTCOME</div>
            {OUTCOME_OPTIONS.map((opt) => {
              const selected = outcome === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOutcome(opt.value)}
                  className={
                    'flex items-start gap-3 rounded-wds-sm border bg-wds-surface px-4 py-3.5 text-left transition-colors hover:bg-wds-neutral-50 ' +
                    (selected ? 'border-[1.5px] border-wds-primary shadow-[0_0_0_3px_rgba(105,60,27,0.08)]' : 'border-wds-border-strong')
                  }
                >
                  <span
                    className={
                      'mt-px size-4 shrink-0 rounded-full border-solid ' +
                      (selected ? 'border-[5px] border-wds-primary' : 'border-[1.5px] border-wds-border-strong')
                    }
                  />
                  <div className="flex flex-col gap-0.5">
                    <div className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{opt.label}</div>
                    <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{opt.describe(detail)}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-wds-mono text-wds-label text-wds-text-copy-muted">RESOLUTION NOTE — required</div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain what happened and why this outcome fits." />
          </div>
          {resolveError ? (
            <div className="rounded-wds-sm border border-wds-error-border bg-wds-error-bg px-3.5 py-2.5">
              <div className="font-wds-sans text-wds-caption text-wds-error-fg">{resolveError}</div>
            </div>
          ) : null}
        </div>
        <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-wds-border bg-wds-neutral-50 px-6 py-7">
          <div className="overflow-hidden rounded-wds-sm border border-wds-border-strong bg-wds-surface">
            <div className="border-b border-wds-border bg-wds-gradient-surface-raise px-3.5 py-3">
              <div className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">What signing does</div>
            </div>
            <div className="flex flex-col gap-2.5 px-3.5 py-3">
              {selectedOption ? <div className="font-wds-sans text-wds-caption leading-[17px] text-wds-text-copy-muted">{selectedOption.describe(detail)}</div> : null}
            </div>
          </div>
          <div className="font-wds-sans text-wds-caption leading-[17px] text-wds-text-copy-muted">
            No one is auto-attributed. If you and the branch manager can&apos;t agree, leave it open — a director adjudicates.
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 right-80 flex h-[68px] shrink-0 items-center gap-4 border-t border-wds-border bg-wds-surface px-8">
        <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
          Outcome: {selectedOption?.label} {note.trim() ? '· reason recorded' : ''}
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <Button variant="secondary" onClick={() => router.push('/app/inventory/dispatch')}>
            Leave open
          </Button>
          <Button disabled={!note.trim()} onClick={() => setSignOpen(true)}>
            Sign resolution
          </Button>
        </div>
      </div>

      <SignSheetDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        title="Sign this resolution"
        subtitle={`${selectedOption?.label} · ${detail.referenceNumber}. Enter your PIN to commit.`}
        helperText="Signing writes the ledger entry and closes this discrepancy."
        confirmLabel="Sign resolution"
        onSubmit={handleSign}
        submitting={resolving}
        error={resolveError ?? undefined}
      />
    </div>
  );
}
