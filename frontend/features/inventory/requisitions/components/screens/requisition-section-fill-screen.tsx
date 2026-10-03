'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { ErrorState, LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { useAuthStore } from '@/store/authStore';
import { CategoryGroupedLineGrid } from '../category-grouped-line-grid';
import { AddItemSheet, type AddItemPick } from '../add-item-sheet';
import { useRequisitionSection } from '../../hooks/use-requisition-section';
import type { DepartmentTag } from '../../types';

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

export interface RequisitionSectionFillScreenProps {
  requisitionId: string;
  departmentTag: DepartmentTag;
}

/**
 * Screen 2a — Department requisition section (fill), six states
 * (`10PT-0`/`10J9-0`/`10LE-0`/`10NJ-0`/`10RO-0`/`10TV-0`), mobile-only
 * full-screen route. Structure and copy match the real Paper nodes read
 * live this session (session-a-plan.md's "Resolved this session via live
 * Paper inspection").
 *
 * No "on hand" text, no par-minus-on-hand pre-fill — the approved deviation
 * for this milestone (no branch-department ledger exists yet). Lines start
 * at `requestedQty: null`; the caption reads "par N unit" only.
 */
export function RequisitionSectionFillScreen({ requisitionId, departmentTag }: RequisitionSectionFillScreenProps) {
  const router = useRouter();
  const isDepartmentHead = useAuthStore((s) => s.isDepartmentHead);
  const actorDepartmentTag = useAuthStore((s) => s.departmentTag);
  const [addItemOpen, setAddItemOpen] = React.useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = React.useState(false);
  const [noteDraft, setNoteDraft] = React.useState('');
  const [recallConfirmOpen, setRecallConfirmOpen] = React.useState(false);

  const {
    section,
    lines,
    setQty,
    deleteLine,
    canDeleteLine,
    addItem,
    setNewLineQty,
    managerNote,
    setManagerNote,
    isDirty,
    changedCount,
    originalQtyByLineId,
    save,
    saving,
    saveError,
    submit,
    submitting,
    submitError,
    recall,
    recalling,
    status,
    error,
    reload,
  } = useRequisitionSection(requisitionId, departmentTag);

  const isOwnDepartment = isDepartmentHead && actorDepartmentTag === departmentTag;

  if (!isOwnDepartment) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader title="Requisition" subtitle="" trailingAction="Cancel" onBack={() => router.back()} onTrailingAction={() => router.back()} />
        <div className="flex flex-1 items-center justify-center p-4">
          <PermissionDeniedState description="This section belongs to a different department." />
        </div>
      </div>
    );
  }

  const departmentLabel = DEPARTMENT_LABEL[departmentTag];
  const readOnly = section?.status === 'SUBMITTED';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleQtyChange = (lineId: string, value: string | null) => {
    if (lineId.startsWith('draft-')) {
      setNewLineQty(lineId, value);
    } else {
      setQty(lineId, value);
    }
  };

  const handleDeleteLine = (lineId: string) => {
    deleteLine(lineId);
  };

  const handleAddItem = (item: AddItemPick) => {
    addItem(item);
    setAddItemOpen(false);
  };

  const handleSaveNote = async () => {
    setManagerNote(noteDraft);
    setNoteEditorOpen(false);
    await save({ managerNote: noteDraft });
  };

  const handleSubmit = async () => {
    const ok = await submit();
    if (ok) router.push('/app/requisitions/list');
  };

  const handleRecall = async () => {
    await recall();
    setRecallConfirmOpen(false);
  };

  const noteBody = (() => {
    if (!managerNote && !noteEditorOpen) {
      return (
        <button
          type="button"
          onClick={() => {
            setNoteDraft('');
            setNoteEditorOpen(true);
          }}
          disabled={readOnly}
          className="flex items-center gap-2 border-t border-wds-border py-3 px-1 disabled:opacity-60"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
              stroke="#635E57"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-wds-sans text-wds-body-sm text-wds-neutral-700">Add a note for the manager</span>
        </button>
      );
    }

    if (noteEditorOpen) {
      return (
        <div className="flex flex-col gap-2 rounded-wds-sm border border-wds-neutral-100 bg-wds-warning-bg p-3.5">
          <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-warning-fg">
            NOTE FOR THE MANAGER
          </span>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            className="rounded-wds-sm border border-wds-border bg-wds-surface p-2 font-wds-sans text-wds-body-sm text-wds-text-ink"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNoteEditorOpen(false)} className="font-wds-sans text-wds-caption text-wds-text-muted">
              Cancel
            </button>
            <button type="button" onClick={handleSaveNote} className="font-wds-sans text-wds-caption font-medium text-wds-warning-fg">
              Save
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5 rounded-wds-sm border border-wds-neutral-100 bg-wds-warning-bg p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                stroke="#8A5A16"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-warning-fg">
              NOTE FOR THE MANAGER
            </span>
          </div>
          {readOnly ? (
            <span className="font-wds-sans text-wds-caption text-wds-text-faint">Locked while submitted</span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNoteDraft(managerNote ?? '');
                setNoteEditorOpen(true);
              }}
              className="font-wds-sans text-wds-caption font-medium text-wds-warning-fg underline underline-offset-2"
            >
              Edit
            </button>
          )}
        </div>
        <p className="font-wds-sans text-wds-body-sm text-wds-neutral-700">{managerNote}</p>
      </div>
    );
  })();

  const returnedBanner =
    section?.status === 'RETURNED' && section.returnedNote ? (
      <div className="flex flex-col gap-1.5 rounded-wds-sm border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 14l-4-4 4-4M5 10h10a4 4 0 0 1 0 8h-1"
              stroke="#8A5A16"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-warning-fg">
            RETURNED BY YOUR MANAGER
          </span>
        </div>
        <p className="font-wds-sans text-wds-body-sm text-wds-neutral-700">&ldquo;{section.returnedNote}&rdquo;</p>
      </div>
    ) : null;

  const offlineBanner = isOffline ? (
    <div className="mb-1 flex w-full items-start gap-2 rounded-wds-sm border border-wds-error-border bg-wds-error-bg px-3 py-2.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-px shrink-0">
        <path d="M12 8v5M12 16.5v.5" stroke="#97281D" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="#97281D" strokeWidth="1.75" fill="none" />
      </svg>
      <p className="font-wds-sans text-wds-caption text-wds-error-fg">
        Couldn&apos;t reach the branch — you&apos;re offline. Your section is saved on this phone and will submit
        automatically when you&apos;re back.
      </p>
    </div>
  ) : null;

  const footerStatusLabel = (() => {
    if (!section) return '';
    switch (section.status) {
      case 'NOT_STARTED':
        return 'Not started';
      case 'DRAFT':
        return section.submittedAt ? '' : 'Draft';
      case 'SUBMITTED':
        return 'Awaiting approval';
      case 'RETURNED':
        return 'Returned';
      default:
        return '';
    }
  })();

  const footerLeftLabel = !isDirty && lines.length === 0 ? 'Nothing changed yet' : `${lines.length} items${managerNote ? ' · 1 note' : ''}`;

  const submitLabel = submitting ? 'Submitting…' : section?.status === 'RETURNED' ? 'Resubmit section' : 'Submit section';

  const body = (() => {
    if (status === 'loading' || status === 'idle') return <LoadingState className="mx-auto" />;
    if (status === 'error') {
      return <ErrorState title="Couldn't load your section" description={error ?? 'Try again.'} onRetry={reload} className="mx-auto" />;
    }
    // A brand-new section legitimately starts with zero lines — no
    // auto-pre-fill this milestone (the §0 deviation). "+ Add an item" must
    // stay reachable even with nothing filled yet, so this is not routed
    // through the generic EmptyState.
    return (
      <div className="mx-4 flex flex-col gap-4">
        {lines.length > 0 ? (
          <CategoryGroupedLineGrid
            lines={lines}
            originalQtyByLineId={originalQtyByLineId}
            onQtyChange={handleQtyChange}
            onDeleteLine={handleDeleteLine}
            canDeleteLine={canDeleteLine}
            readOnly={Boolean(readOnly)}
          />
        ) : (
          <p className="font-wds-sans text-wds-caption text-wds-text-muted">No items in this section yet.</p>
        )}
        {!readOnly ? (
          <button type="button" onClick={() => setAddItemOpen(true)} className="flex items-center gap-2 py-3 px-1">
            <span className="font-sans text-wds-body text-wds-warning-fg">+</span>
            <span className="font-wds-sans text-wds-body-sm text-wds-warning-fg">Add an item</span>
          </button>
        ) : null}
        {noteBody}
        {saveError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{saveError}</p> : null}
      </div>
    );
  })();

  // A true full-viewport overlay (fixed inset-0, above the shell's z-40
  // bottom nav), matching RestockLevelsDrawer's mobile variant — not
  // min-h-screen. This screen's primary action ("Submit section"/"Recall
  // section") is always pinned at the bottom, which the shell's own fixed
  // bottom tab bar would otherwise sit on top of and intercept clicks for.
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-wds-canvas">
      <MobileStatusBar />
      <MobileTaskHeader
        title={`${departmentLabel} · my section`}
        subtitle=""
        trailingAction="Cancel"
        onBack={() => router.back()}
        onTrailingAction={() => router.back()}
      />
      <div className="flex flex-col gap-1 px-4 pb-3 pt-4">
        {returnedBanner}
        {section?.status !== 'RETURNED' ? (
          <p className="font-wds-sans text-wds-body-sm text-wds-neutral-600">
            {section?.status === 'SUBMITTED'
              ? "Submitted to the branch manager. You can recall it while it's still waiting for approval."
              : 'Enter your quantities against the par reference, add a note if needed, then submit.'}
          </p>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto pb-4">{body}</div>
      <div className="flex flex-col gap-2.5 border-t border-wds-border bg-wds-surface px-4 pb-5 pt-3.5">
        {offlineBanner}
        <div className="flex items-center justify-between">
          <span className="font-wds-sans text-wds-caption text-wds-neutral-600">{footerLeftLabel}</span>
          {section?.status === 'SUBMITTED' ? (
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-wds-warning-fg" aria-hidden />
              <span className="font-wds-sans text-wds-caption text-wds-warning-fg">{footerStatusLabel}</span>
            </span>
          ) : (
            <span className="font-wds-mono text-wds-label text-wds-neutral-500">{footerStatusLabel}</span>
          )}
        </div>
        {submitError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{submitError}</p> : null}
        {readOnly ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRecallConfirmOpen(true)}
            disabled={recalling}
            className="h-11 w-full font-wds-body"
          >
            Recall section
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || changedCount < 0}
            className="h-11 w-full font-wds-body"
          >
            {submitLabel}
          </Button>
        )}
      </div>
      <AddItemSheet open={addItemOpen} onClose={() => setAddItemOpen(false)} departmentTag={departmentTag} onPick={handleAddItem} />
      <ConfirmDialog
        open={recallConfirmOpen}
        onOpenChange={setRecallConfirmOpen}
        title="Recall this section?"
        description="It will go back to Draft and you'll need to resubmit it."
        confirmLabel="Recall section"
        destructive={false}
        confirming={recalling}
        onConfirm={handleRecall}
      />
    </div>
  );
}
