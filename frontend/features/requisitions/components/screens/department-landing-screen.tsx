'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { Button } from '@/components/ui2/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { useAuthStore } from '@/store/authStore';
import { useRequisitionsList } from '../../hooks/use-requisitions-list';
import { openRequisition } from '../../services';
import type { DepartmentTag, RequisitionListRow } from '../../types';

const REQUISITION_TYPE_OPTIONS: { type: RequisitionListRow['type']; label: string }[] = [
  { type: 'MORNING', label: 'Morning requisition' },
  { type: 'AFTERNOON', label: 'Afternoon requisition' },
  { type: 'EVENING', label: 'Evening requisition' },
  { type: 'AD_HOC', label: 'Ad-hoc requisition' },
];

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting approval',
  RETURNED: 'Returned',
};

/**
 * Screen 0 — "Requisitions" landing (`122U-0`), a cross-milestone hub. Only
 * the REQUISITION card is real this session; the other three (INCOMING
 * DISPATCH, THIS MORNING, QUICK ACTIONS) render statically per the mock's
 * layout but disabled — their milestones haven't shipped yet
 * (session-a-plan.md's resolved finding on `122U-0`).
 */
export function DepartmentLandingScreen() {
  const router = useRouter();
  const isDepartmentHead = useAuthStore((s) => s.isDepartmentHead);
  const departmentTag = useAuthStore((s) => s.departmentTag) as DepartmentTag | undefined;
  const user = useAuthStore((s) => s.user);
  const userInitials = user?.name ? user.name.slice(0, 2).toUpperCase() : 'GW';
  const { rows, status, reload } = useRequisitionsList();
  const [opening, setOpening] = React.useState(false);
  const [typePickerOpen, setTypePickerOpen] = React.useState(false);

  if (!isDepartmentHead || !departmentTag) {
    return (
      <div className="flex min-h-screen flex-col bg-wds-neutral-50">
        <MobileStatusBar />
        <MobileHubHeader title="Requisitions" subtitle="" userInitials={userInitials} />
        <div className="flex flex-1 items-center justify-center p-4">
          <PermissionDeniedState description="Requisitions are for department heads only." />
        </div>
      </div>
    );
  }

  const departmentLabel = DEPARTMENT_LABEL[departmentTag];

  const handlePickType = async (type: RequisitionListRow['type']) => {
    setTypePickerOpen(false);
    setOpening(true);
    try {
      const created = await openRequisition({ type });
      await reload();
      router.push(`/app/requisitions/${created.id}/${departmentTag}`);
    } finally {
      setOpening(false);
    }
  };

  const openRow = (row: RequisitionListRow) => router.push(`/app/requisitions/${row.id}/${departmentTag}`);

  const rowActionLabel = (row: RequisitionListRow) =>
    row.mySectionStatus === 'SUBMITTED' ? 'View my section' : row.mySectionStatus === 'RETURNED' ? 'Resubmit section' : 'Continue';

  return (
    <div className="flex min-h-screen flex-col bg-wds-neutral-50">
      <MobileStatusBar />
      <MobileHubHeader title="Requisitions" subtitle={`${departmentLabel} · your branch`} userInitials={userInitials} />
      <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
        <div className="flex flex-col gap-2.5">
          <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-neutral-500">REQUISITION</span>
          <div className="flex flex-col gap-3 rounded-wds-sm border border-wds-border bg-wds-surface p-4">
            {status === 'loading' ? (
              <LoadingState className="mx-auto" />
            ) : (
              <>
                {rows.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {rows.map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-3 border-b border-wds-neutral-100 pb-2.5 last:border-b-0 last:pb-0">
                        <div className="flex flex-col gap-0.75">
                          <span className="font-wds-sans text-wds-body font-medium text-wds-text-ink">
                            {row.type.charAt(0) + row.type.slice(1).toLowerCase().replace('_', '-')} requisition
                          </span>
                          <span className="font-wds-mono text-wds-label text-wds-neutral-500">
                            Opened {new Date(row.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                            {STATUS_LABEL[row.mySectionStatus] ?? 'Not started'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openRow(row)}
                          className="shrink-0 font-wds-sans text-wds-body-sm font-medium text-wds-primary underline underline-offset-2"
                        >
                          {rowActionLabel(row)}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="font-wds-sans text-wds-body-sm text-wds-text-muted">No requisitions opened today yet.</span>
                )}
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setTypePickerOpen(true)}
                  disabled={opening}
                  className="h-10 w-full font-wds-body"
                >
                  {opening ? 'Opening…' : 'Start requisition'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Static, disabled placeholders — their milestones haven't shipped. */}
        <div className="flex flex-col gap-2.5 opacity-60">
          <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-neutral-500">INCOMING DISPATCH</span>
          <div className="flex flex-col gap-3 rounded-wds-sm border border-wds-border bg-wds-surface p-4">
            <div className="flex flex-col gap-0.75">
              <span className="font-wds-sans text-[16px] font-semibold text-wds-text-ink">Opening dispatch</span>
              <span className="font-wds-mono text-wds-label text-wds-neutral-500">Coming in a later milestone</span>
            </div>
            <div className="flex h-10 shrink-0 cursor-not-allowed items-center justify-center rounded-wds-sm border border-wds-border-strong">
              <span className="font-wds-sans text-wds-body-sm text-wds-neutral-500">Confirm receipt</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 opacity-60">
          <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-neutral-500">THIS MORNING</span>
          <div className="flex flex-col gap-3 rounded-wds-sm border border-wds-border bg-wds-surface p-4">
            <div className="flex flex-col gap-0.75">
              <span className="font-wds-sans text-[16px] font-semibold text-wds-text-ink">Opening count</span>
              <span className="font-wds-mono text-wds-label text-wds-neutral-500">Coming in a later milestone</span>
            </div>
            <div className="flex h-9 shrink-0 cursor-not-allowed items-center justify-center rounded-wds-sm border border-wds-border-strong">
              <span className="font-wds-sans text-wds-body-sm text-wds-neutral-500">Review opening</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 opacity-60">
          <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-neutral-500">QUICK ACTIONS</span>
          <div className="flex gap-2.5">
            <div className="flex h-11 grow cursor-not-allowed items-center justify-center rounded-wds-sm border border-wds-border-strong">
              <span className="font-wds-sans text-wds-body text-wds-neutral-500">Log waste</span>
            </div>
            <div className="flex h-11 grow cursor-not-allowed items-center justify-center rounded-wds-sm border border-wds-border-strong">
              <span className="font-wds-sans text-wds-body text-wds-neutral-500">View history</span>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <SheetContent side="bottom" className="rounded-t-wds-md">
          <SheetHeader>
            <SheetTitle>Start a requisition</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col p-4">
            {REQUISITION_TYPE_OPTIONS.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => handlePickType(option.type)}
                className="flex items-center border-b border-wds-border py-3.5 text-left last:border-b-0"
              >
                <span className="font-wds-sans text-wds-body text-wds-text-ink">{option.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
