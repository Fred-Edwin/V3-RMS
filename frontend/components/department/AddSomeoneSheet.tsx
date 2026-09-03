'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { BottomSheet, Button, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { StaffDto } from '@/services/staffService';

export interface SchedulerPerson {
  id: string;
  name: string;
  role: string;
  /** e.g. "Chef", "Chef · Pastry" — the sub-line in the row. */
  roleLine: string;
}

interface AddSomeoneSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** e.g. "Morning". */
  shiftName: string;
  /** e.g. "Tuesday, 19 Aug · 6:00 AM – 2:00 PM". */
  contextLine: string;
  /** e.g. "Kitchen & Pastry chefs". */
  eligibleNoun: string;
  /** Department staff eligible for this shift. */
  people: SchedulerPerson[];
  /** Ids already on this shift+day (shown disabled). */
  alreadyOnIds: Set<string>;
  onConfirm: (ids: string[]) => void;
  isLoading?: boolean;
}

export function AddSomeoneSheet({
  isOpen,
  onClose,
  shiftName,
  contextLine,
  eligibleNoun,
  people,
  alreadyOnIds,
  onConfirm,
  isLoading = false,
}: AddSomeoneSheetProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelected(new Set());
    }
  }, [isOpen, shiftName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
    // Available first, already-scheduled sink to the bottom.
    return [...list].sort((a, b) => {
      const aOn = alreadyOnIds.has(a.id) ? 1 : 0;
      const bOn = alreadyOnIds.has(b.id) ? 1 : 0;
      return aOn - bOn || a.name.localeCompare(b.name);
    });
  }, [people, query, alreadyOnIds]);

  const availableCount = people.filter((p) => !alreadyOnIds.has(p.id)).length;

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} className="max-h-[86vh]">
      <div className="-mx-5 border-b border-stone-100 px-5 pb-5">
        <h2 className="text-heading-sm font-bold text-stone-900">Add to {shiftName}</h2>
        <p className="mt-0.5 text-caption text-stone-500">{contextLine}</p>
      </div>

      <div className="mt-5 flex items-center gap-4 rounded-lg border border-stone-200 bg-stone-50 px-5 py-2.5">
        <Search size={14} className="shrink-0 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${eligibleNoun.toLowerCase()}…`}
          className="w-full bg-transparent text-body-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
        />
      </div>

      <p className="py-3 text-micro font-medium text-stone-500">
        {eligibleNoun} only · {availableCount} available
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-body-sm text-stone-500">
          {query ? `Nobody matches "${query}".` : 'No eligible staff in your department.'}
        </p>
      ) : (
        <ul className="-mx-5">
          {filtered.map((person) => {
            const disabled = alreadyOnIds.has(person.id);
            const isSelected = selected.has(person.id);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(person.id)}
                  className={cn(
                    'flex w-full items-center gap-5 border-b border-[#F2EFEC] px-5 py-5 text-left transition-colors duration-fast',
                    disabled ? 'opacity-50' : 'hover:bg-stone-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-[34px] shrink-0 items-center justify-center rounded-full text-caption font-semibold',
                      disabled ? 'bg-stone-100 text-stone-500' : 'bg-parchment text-espresso',
                    )}
                  >
                    {initials(person.name)}
                  </span>
                  <span className="flex grow flex-col gap-px">
                    <span className="text-body-sm font-medium text-stone-900">{person.name}</span>
                    <span className="text-caption text-stone-500">
                      {disabled ? `Already on ${shiftName}` : person.roleLine}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'flex size-[22px] shrink-0 items-center justify-center rounded-full',
                      disabled
                        ? ''
                        : isSelected
                          ? 'bg-espresso'
                          : 'border-[1.5px] border-stone-300',
                    )}
                  >
                    {!disabled && isSelected && (
                      <Check size={12} strokeWidth={2.5} className="text-white" />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2.5 pt-3.5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="grow"
          disabled={selected.size === 0}
          onClick={() => onConfirm(Array.from(selected))}
        >
          {selected.size === 0
            ? `Add to ${shiftName}`
            : `Add ${selected.size} to ${shiftName}`}
        </Button>
      </div>
    </BottomSheet>
  );
}

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Build the row list for one department from the raw staff list. */
export const toSchedulerPeople = (
  staff: StaffDto[],
  roleLabel: (role: string) => string,
): SchedulerPerson[] =>
  staff.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    roleLine: roleLabel(s.role),
  }));
