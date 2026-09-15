'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { SearchInput } from '@/components/ui2/search-input';
import { useAuthStore } from '@/store/authStore';
import { RestockLevelGrid, RestockLevelHelperNote, type RestockLevelRow as GridRow } from '../restock-level-grid';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { useRestockLevels } from '../../hooks/use-restock-levels';
import type { DepartmentTag, RestockLevelRow } from '../../types';

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

function toGridRow(row: RestockLevelRow): GridRow {
  return {
    id: row.inventoryItemId,
    name: row.itemName,
    unit: row.usageUnit,
    onHand: Number.parseFloat(row.onHandQty),
    restockLevel: row.level != null ? Number.parseFloat(row.level) : 0,
  };
}

/**
 * Restock levels · department — screen 6, mobile-only full-screen route
 * (`TD1-0`). Not a drawer: the plan table lists no desktop counterpart, so
 * this is its own page a Department Head lands on directly, unlike screen 5
 * which is a drawer over the (out-of-scope) Central Store dashboard.
 */
export function DepartmentRestockLevelsScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const isDepartmentHead = useAuthStore((s) => s.isDepartmentHead);
  const departmentTag = useAuthStore((s) => s.departmentTag);
  const [search, setSearch] = React.useState('');

  const { rows, isDirty, setLevel, save, saving, saveError, status, error, reload } = useRestockLevels(undefined, {
    role: 'DEPARTMENT_HEAD',
  });

  const departmentLabel = departmentTag ? DEPARTMENT_LABEL[departmentTag] : 'Your department';

  if (!isDepartmentHead) {
    return (
      <div className="flex min-h-screen flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader
          title="Restock levels"
          subtitle="Department"
          trailingAction="Done"
          onBack={() => router.back()}
          onTrailingAction={() => router.back()}
        />
        <div className="flex flex-1 items-center justify-center p-4">
          <PermissionDeniedState description={`Restock levels here are set by each department's head, not by ${role ?? 'this role'}.`} />
        </div>
      </div>
    );
  }

  const filteredRows = search
    ? rows.filter((row) => row.itemName.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;
  const gridRows = filteredRows.map(toGridRow);

  const handleSave = async () => {
    const ok = await save();
    if (ok) router.back();
  };

  const body = (() => {
    if (status === 'loading' || status === 'idle') return <LoadingState className="mx-auto" />;
    if (status === 'error') {
      return (
        <ErrorState title="Couldn't load restock levels" description={error ?? 'Try again.'} onRetry={reload} className="mx-auto" />
      );
    }
    if (gridRows.length === 0) {
      return <EmptyState title="Nothing here yet" description="No items scoped to your department yet." className="mx-auto" />;
    }
    return (
      <div className="flex flex-col gap-4">
        <RestockLevelGrid
          variant="mobile"
          rows={gridRows}
          onRestockLevelChange={(id, value) => setLevel(id, value === '' ? null : value)}
        />
        <RestockLevelHelperNote variant="mobile">
          Setting your department's restock level flags an item low for your team. This does not change the Central
          Store's own level.
        </RestockLevelHelperNote>
        {saveError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{saveError}</p> : null}
      </div>
    );
  })();

  return (
    <div className="flex min-h-screen flex-col bg-wds-canvas">
      <MobileStatusBar />
      <MobileTaskHeader
        title="Restock levels"
        subtitle={`${departmentLabel} items only — drives your low-stock signal`}
        trailingAction="Done"
        onBack={() => router.back()}
        onTrailingAction={handleSave}
      />
      <div className="flex-1 overflow-y-auto p-4">
        <SearchInput
          className="mb-4"
          placeholder="Search an item"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {body}
      </div>
      {isDirty ? (
        <div className="border-t border-wds-border p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-11 w-full items-center justify-center rounded-wds-md bg-wds-gradient-primary font-wds-sans text-wds-body font-medium text-wds-primary-fg disabled:opacity-60"
          >
            Save restock levels
          </button>
        </div>
      ) : null}
    </div>
  );
}
