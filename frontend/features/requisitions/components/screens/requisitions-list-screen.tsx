'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { useAuthStore } from '@/store/authStore';
import { useRequisitionsList } from '../../hooks/use-requisitions-list';
import { recallRequisitionSection } from '../../services';
import type { DepartmentTag, RequisitionListRow } from '../../types';

const TYPE_LABEL: Record<RequisitionListRow['type'], string> = {
  MORNING: 'Morning requisition',
  AFTERNOON: 'Afternoon requisition',
  EVENING: 'Evening requisition',
  AD_HOC: 'Ad-hoc requisition',
};

function statusTone(status: RequisitionListRow['mySectionStatus']): { dot: string; text: string; label: string } {
  switch (status) {
    case 'SUBMITTED':
      return { dot: 'bg-wds-warning-fg', text: 'text-wds-warning-fg', label: 'Awaiting approval' };
    case 'RETURNED':
      return { dot: 'bg-wds-error-fg', text: 'text-wds-error-fg', label: 'Returned' };
    case 'DRAFT':
      return { dot: 'bg-wds-neutral-500', text: 'text-wds-text-muted', label: 'Draft' };
    default:
      return { dot: 'bg-wds-neutral-500', text: 'text-wds-text-muted', label: 'Not started' };
  }
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Screen 1 — "Requisitions" list (`10HO-0`). Groups by "NEEDS YOUR SECTION"
 * (not-started/draft/returned — primary CTA) vs. "EARLIER TODAY" (submitted
 * -> "View my section" + inline "Recall"). Recall is reachable directly from
 * here, not only from inside the fill screen (session-a-plan.md's resolved
 * finding on `10HO-0`).
 */
export function RequisitionsListScreen() {
  const router = useRouter();
  const isDepartmentHead = useAuthStore((s) => s.isDepartmentHead);
  const departmentTag = useAuthStore((s) => s.departmentTag) as DepartmentTag | undefined;
  const { needsSection, earlierToday, status, error, reload } = useRequisitionsList();
  const [recallingId, setRecallingId] = React.useState<string | null>(null);
  const [recallTargetId, setRecallTargetId] = React.useState<string | null>(null);

  if (!isDepartmentHead || !departmentTag) {
    return (
      <div className="flex min-h-screen flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader title="Requisitions" subtitle="" trailingAction="Cancel" onBack={() => router.back()} onTrailingAction={() => router.back()} />
        <div className="flex flex-1 items-center justify-center p-4">
          <PermissionDeniedState description="Requisitions are for department heads only." />
        </div>
      </div>
    );
  }

  const openFillScreen = (id: string) => router.push(`/app/requisitions/${id}/${departmentTag}`);

  const handleRecall = async (id: string) => {
    setRecallingId(id);
    try {
      await recallRequisitionSection(id, departmentTag);
      await reload();
    } finally {
      setRecallingId(null);
      setRecallTargetId(null);
    }
  };

  const body = (() => {
    if (status === 'loading' || status === 'idle') return <LoadingState className="mx-auto" />;
    if (status === 'error') {
      return <ErrorState title="Couldn't load requisitions" description={error ?? 'Try again.'} onRetry={reload} className="mx-auto" />;
    }
    if (needsSection.length === 0 && earlierToday.length === 0) {
      return <EmptyState title="Nothing here yet" description="No requisitions for your branch yet today." className="mx-auto" />;
    }
    return (
      <div className="flex flex-col gap-5">
        {needsSection.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-neutral-500">
              NEEDS YOUR SECTION
            </span>
            {needsSection.map((row) => {
              const tone = statusTone(row.mySectionStatus);
              return (
                <div key={row.id} className="flex flex-col gap-3 rounded-wds-sm border border-wds-border bg-wds-surface p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-0.75">
                      <span className="font-wds-sans text-[16px] font-semibold text-wds-text-ink">{TYPE_LABEL[row.type]}</span>
                      <span className="font-wds-mono text-wds-label text-wds-neutral-500">Opened {timeOf(row.openedAt)}</span>
                    </div>
                    <div className="mt-0.75 flex items-center gap-1.5">
                      <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                      <span className={`font-wds-sans text-wds-caption ${tone.text}`}>{tone.label}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => openFillScreen(row.id)}
                    className="h-10 w-full font-wds-body"
                  >
                    {row.mySectionStatus === 'RETURNED' ? 'Resubmit section' : 'Start requisition'}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}

        {earlierToday.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-neutral-500">
              EARLIER TODAY
            </span>
            {earlierToday.map((row) => {
              const tone = statusTone(row.mySectionStatus);
              return (
                <div key={row.id} className="flex flex-col gap-3 rounded-wds-sm border border-wds-border bg-wds-surface p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-0.75">
                      <span className="font-wds-sans text-wds-body font-semibold text-wds-neutral-700">{TYPE_LABEL[row.type]}</span>
                      <span className="font-wds-mono text-wds-label text-wds-neutral-500">Submitted {timeOf(row.openedAt)}</span>
                    </div>
                    <div className="mt-0.75 flex items-center gap-1.5">
                      <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                      <span className={`font-wds-sans text-wds-caption ${tone.text}`}>{tone.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => openFillScreen(row.id)}
                      className="h-9 grow font-wds-body-sm"
                    >
                      View my section
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setRecallTargetId(row.id)}
                      disabled={recallingId === row.id}
                      className="h-9 grow font-wds-body-sm"
                    >
                      Recall
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  })();

  return (
    <div className="flex min-h-screen flex-col bg-wds-canvas">
      <MobileStatusBar />
      <MobileTaskHeader title="Requisitions" subtitle="" trailingAction="Cancel" onBack={() => router.back()} onTrailingAction={() => router.back()} />
      <div className="flex-1 overflow-y-auto px-4 py-5">{body}</div>
      <ConfirmDialog
        open={recallTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setRecallTargetId(null);
        }}
        title="Recall this section?"
        description="It will go back to Draft and you'll need to resubmit it."
        confirmLabel="Recall section"
        destructive={false}
        confirming={recallingId !== null}
        onConfirm={() => {
          if (recallTargetId) void handleRecall(recallTargetId);
        }}
      />
    </div>
  );
}
