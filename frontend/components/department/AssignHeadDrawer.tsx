'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Search } from 'lucide-react';
import { Avatar, Button, EmptyState, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { AppRole } from '@/types/auth';
import type { DepartmentHeadDto, EligibleStaffDto } from '@/services/departmentService';
import { Drawer } from './Drawer';

const roleLabel: Partial<Record<AppRole, string>> = {
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
  STEWARD: 'Steward',
  HOUSEKEEPING: 'Housekeeping',
};

interface AssignHeadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** e.g. "Kitchen & Pastry" — the merged label the manager sees. */
  departmentLabel: string;
  branchName: string;
  /** Copy for the "…only · N eligible" line, e.g. "Kitchen & Pastry chefs". */
  eligibleNoun: string;
  currentHead: DepartmentHeadDto | null;
  eligibleStaff: EligibleStaffDto[];
  isLoadingStaff: boolean;
  isSubmitting: boolean;
  /** Assign `userId` as head, or (change mode) replace the current head with them. */
  onConfirm: (userId: string) => void;
  /** Change mode only: remove the current head, leaving the department headless. */
  onRemove: () => void;
}

export function AssignHeadDrawer({
  isOpen,
  onClose,
  departmentLabel,
  branchName,
  eligibleNoun,
  currentHead,
  eligibleStaff,
  isLoadingStaff,
  isSubmitting,
  onConfirm,
  onRemove,
}: AssignHeadDrawerProps): JSX.Element {
  const isChange = currentHead !== null;
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');

  // Reset transient state whenever the drawer opens for a different department.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedId('');
    }
  }, [isOpen, departmentLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligibleStaff;
    return eligibleStaff.filter((s) => s.name.toLowerCase().includes(q));
  }, [eligibleStaff, query]);

  const selectedName = eligibleStaff.find((s) => s.id === selectedId)?.name ?? '';

  const consequence = isChange
    ? selectedName
      ? `${currentHead?.name} stops being ${departmentLabel} head; ${selectedName} becomes head. Both keep their ${roleLabel[currentHead?.role ?? 'CHEF']?.toLowerCase() ?? 'base'} role.`
      : `Removing ${currentHead?.name} leaves ${departmentLabel} without a head — its shifts can't be scheduled until you assign one. ${currentHead?.name} keeps their ${roleLabel[currentHead?.role ?? 'CHEF']?.toLowerCase() ?? 'base'} role.`
    : selectedName
      ? `${selectedName} will be the ${departmentLabel} head. They keep their ${roleLabel[eligibleStaff.find((s) => s.id === selectedId)?.role ?? 'CHEF']?.toLowerCase() ?? 'base'} role and can schedule ${departmentLabel} shifts. You can remove this anytime.`
      : `Pick someone to lead ${departmentLabel}. They keep their normal role and gain the ability to schedule this department's shifts.`;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isChange ? 'Change the head' : 'Assign a head'}
      subtitle={`${departmentLabel} · ${branchName}`}
      footer={
        <div className="flex flex-col gap-5">
          <div className="flex gap-2.5 rounded-md bg-warning-bg px-3.5 py-5">
            <AlertTriangle size={16} className="mt-px shrink-0 text-warning" />
            <p className="text-caption leading-[17px] text-espresso">{consequence}</p>
          </div>
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              className="grow"
              onClick={() => selectedId && onConfirm(selectedId)}
              isLoading={isSubmitting}
              disabled={!selectedId || isLoadingStaff}
            >
              {isChange ? `Make ${selectedName || departmentLabel} head` : `Make ${departmentLabel} head`}
            </Button>
          </div>
        </div>
      }
    >
      {isChange && currentHead && (
        <div className="px-8 pt-6">
          <div className="mb-2 flex items-center gap-5 rounded-md border border-stone-200 bg-stone-50 px-3.5 py-5">
            <Avatar name={currentHead.name} size="md" className="size-9" />
            <div className="flex grow flex-col gap-px">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-stone-500">
                Current head
              </span>
              <span className="text-body-sm font-semibold text-stone-900">{currentHead.name}</span>
            </div>
            <button
              type="button"
              onClick={onRemove}
              disabled={isSubmitting}
              className="flex h-[30px] shrink-0 items-center rounded-md border border-danger-border px-5 text-caption font-semibold text-danger transition-colors duration-fast hover:bg-danger-bg disabled:opacity-50"
            >
              Remove
            </button>
          </div>
          <p className="pb-1 pt-2.5 text-micro font-semibold uppercase tracking-[0.05em] text-stone-500">
            Or pick a replacement
          </p>
        </div>
      )}

      <div className="mx-8 mb-2 mt-6 flex items-center gap-4 rounded-md border border-stone-200 bg-stone-50 px-5 py-2.5">
        <Search size={14} className="shrink-0 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${departmentLabel} staff…`}
          className="w-full bg-transparent text-body-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
        />
      </div>

      <p className="px-8 pb-3 pt-4 text-micro font-medium text-stone-500">
        {eligibleNoun} only · {eligibleStaff.length} eligible
      </p>

      {isLoadingStaff ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={24} />}
          heading={query ? 'No match' : 'No eligible staff'}
          body={
            query
              ? `No ${departmentLabel} staff match "${query}".`
              : `No active ${departmentLabel} staff at this branch can be made head.`
          }
        />
      ) : (
        <ul>
          {filtered.map((staff) => {
            const selected = staff.id === selectedId;
            return (
              <li key={staff.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(selected ? '' : staff.id)}
                  className={cn(
                    'flex w-full items-center gap-5 border-b border-stone-100 px-8 py-5 text-left transition-colors duration-fast',
                    selected ? 'border-l-2 border-l-espresso bg-[#FBF7F3]' : 'hover:bg-stone-50',
                  )}
                >
                  <Avatar name={staff.name} size="sm" className="size-[34px] bg-parchment text-espresso" />
                  <div className="flex grow flex-col gap-px">
                    <span className="text-body-sm font-semibold text-stone-900">{staff.name}</span>
                    <span className="text-caption text-stone-500">{roleLabel[staff.role] ?? staff.role}</span>
                  </div>
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full',
                      selected ? 'bg-espresso' : 'border-[1.5px] border-stone-300',
                    )}
                  >
                    {selected && <Check size={11} strokeWidth={2.5} className="text-white" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
