'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { useAuthStore } from '@/store/authStore';
import { PhoneErrorNote, PhoneHeader, PhonePrimaryButton } from '../../../_shared/components/phone-parts';
import { formatHistoryWhen } from '../../../catalog/lib/item-price';
import { useRestockHistory } from '../../hooks/use-restock-history';
import { useRestockLevels } from '../../hooks/use-restock-levels';
import { changeCountLabel, stepLevel } from '../../lib/department-levels';
import { DepartmentLevelCard } from '../phone/department-level-card';
import { DepartmentReviewSheet, type DepartmentChange } from '../phone/department-review-sheet';
import { DepartmentSavedView } from '../phone/department-saved-view';
import type { DepartmentTag } from '../../../types';

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const ACTOR = { role: 'DEPARTMENT_HEAD' } as const;

/**
 * Restock levels · Department Head phone — Paper chapter 7, steps 27–29 (Kitchen, and the Housekeeping head
 * on the same screens). Big − / + steppers with the suggestion under each item, "Review changes" opens the
 * check sheet, saving shows the saved state with "Your recent changes" and Put back.
 */
export function DepartmentRestockLevelsScreen() {
  const router = useRouter();
  const isDepartmentHead = useAuthStore((s) => s.isDepartmentHead);
  const departmentTag = useAuthStore((s) => s.departmentTag);
  const departmentLabel = departmentTag ? DEPARTMENT_LABEL[departmentTag] : 'Your department';

  const { rows, savedRows, changedIds, setLevel, revert, save, saving, saveError, status, error, reload } = useRestockLevels(undefined, ACTOR, isDepartmentHead);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [saved, setSaved] = React.useState<{ count: number; at: string } | null>(null);
  const history = useRestockHistory(saved ? {} : null);
  const { putBack, reload: reloadHistory } = history;

  const savedById = React.useMemo(() => new Map(savedRows.map((r) => [r.inventoryItemId, r.level])), [savedRows]);
  const changes: DepartmentChange[] = React.useMemo(
    () =>
      rows
        .filter((r) => changedIds.includes(r.inventoryItemId))
        .map((row) => ({ row, saved: savedById.get(row.inventoryItemId) ?? null, next: row.level })),
    [rows, changedIds, savedById]
  );

  const handleStep = React.useCallback(
    (itemId: string, direction: 1 | -1) => {
      const row = rows.find((r) => r.inventoryItemId === itemId);
      if (!row) return;
      const next = stepLevel(row.level, direction, row.suggestedLevel);
      // Stepping back to what is on file is not a change.
      if (next === (savedById.get(itemId) ?? null)) revert(itemId);
      else setLevel(itemId, next);
    },
    [rows, savedById, setLevel, revert]
  );

  const handleSave = React.useCallback(async () => {
    const count = changedIds.length;
    const ok = await save();
    if (!ok) return;
    setReviewOpen(false);
    setSaved({ count, at: formatHistoryWhen(new Date().toISOString()) });
  }, [changedIds.length, save]);

  const handlePutBack = React.useCallback(
    async (changeId: string) => {
      const entry = await putBack(changeId);
      if (entry) void reload();
    },
    [putBack, reload]
  );

  if (!isDepartmentHead) {
    return (
      <div className="flex min-h-dvh flex-col bg-wds-canvas">
        <PhoneHeader title="Restock levels" subtitle="Department" leading="back" onLeading={() => router.back()} />
        <div className="flex flex-1 items-center justify-center p-4">
          <PermissionDeniedState description="Restock levels here are set by each department's head." />
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex min-h-dvh flex-col bg-wds-canvas">
        <PhoneHeader title="Restock levels" subtitle={`${departmentLabel} · saved ${saved.at}`} leading="back" onLeading={() => router.back()} />
        <DepartmentSavedView
          savedCount={saved.count}
          entries={history.entries}
          historyStatus={history.status}
          historyError={history.error}
          onRetryHistory={reloadHistory}
          puttingBackId={history.puttingBackId}
          putBackError={history.putBackError}
          onPutBack={handlePutBack}
          onDone={() => router.back()}
        />
      </div>
    );
  }

  const body = (() => {
    if (status === 'loading' || status === 'idle') return <LoadingState className="mx-auto" />;
    if (status === 'error') {
      return <ErrorState title="Couldn't load restock levels" description={error ?? 'Try again.'} onRetry={reload} className="mx-auto" />;
    }
    if (rows.length === 0) {
      return <EmptyState title="Nothing here yet" description={`No items are tagged for ${departmentLabel} yet. The Store Manager adds them.`} className="mx-auto" />;
    }
    return (
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <DepartmentLevelCard
            key={row.inventoryItemId}
            row={row}
            saved={savedById.get(row.inventoryItemId) ?? null}
            typed={row.level}
            onStep={(direction) => handleStep(row.inventoryItemId, direction)}
          />
        ))}
      </ul>
    );
  })();

  return (
    <div className="flex min-h-dvh flex-col bg-wds-canvas">
      <PhoneHeader title="Restock levels" subtitle={`${departmentLabel} · how much to keep, set by you`} leading="back" onLeading={() => router.back()} />
      <div className="flex grow flex-col gap-2.5 px-4 py-3.5">
        {saveError && !reviewOpen ? <PhoneErrorNote>{saveError}</PhoneErrorNote> : null}
        {body}
        <div className="grow" />
        {changedIds.length > 0 ? (
          <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2.5 border-t border-wds-border bg-wds-canvas px-4 py-3">
            <span className="shrink-0 whitespace-nowrap font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{changeCountLabel(changedIds.length)}</span>
            <PhonePrimaryButton className="h-[50px] grow" onClick={() => setReviewOpen(true)}>
              Review changes
            </PhonePrimaryButton>
          </div>
        ) : null}
      </div>
      <DepartmentReviewSheet open={reviewOpen} onOpenChange={setReviewOpen} changes={changes} saving={saving} saveError={saveError} onSave={handleSave} />
    </div>
  );
}
