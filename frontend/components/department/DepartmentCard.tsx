'use client';

import { Avatar } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { DepartmentSummaryDto } from '@/services/departmentService';

/** The roster-line label per department (Paper: "9 chefs", "6 waiters", "5 people"). */
const memberNoun: Record<DepartmentSummaryDto['departmentTag'], [string, string]> = {
  KITCHEN: ['chef', 'chefs'],
  PASTRY: ['chef', 'chefs'],
  BARISTA: ['barista', 'baristas'],
  SERVICE: ['waiter', 'waiters'],
  HOUSEKEEPING: ['person', 'people'],
};

/** The small tag chip after the title (Paper: "Chefs", "Waiters", …). */
const roleTag: Record<DepartmentSummaryDto['departmentTag'], string> = {
  KITCHEN: 'Chefs',
  PASTRY: 'Chefs',
  BARISTA: 'Baristas',
  SERVICE: 'Waiters',
  HOUSEKEEPING: 'Stewards + housekeeping',
};

const blurb: Record<DepartmentSummaryDto['departmentTag'], string> = {
  KITCHEN: 'One head covers both. Appoint a separate Pastry head later to split — no data change.',
  PASTRY: '',
  BARISTA: 'Coffee bar.',
  SERVICE: 'Front-of-house waiters.',
  HOUSEKEEPING: 'Cleaning and stewarding.',
};

interface DepartmentCardProps {
  title: string;
  department: DepartmentSummaryDto;
  /** How many names to show before "+N" in the roster line. */
  previewCount?: number;
  onAssign: () => void;
  onChange: () => void;
  onViewAll: () => void;
}

export function DepartmentCard({
  title,
  department,
  previewCount = 4,
  onAssign,
  onChange,
  onViewAll,
}: DepartmentCardProps): JSX.Element {
  const { departmentTag, head } = department;
  const members = department.members ?? [];
  const [singular, plural] = memberNoun[departmentTag];
  const count = members.length;
  const preview = members.slice(0, previewCount).map((m) => m.name);
  const remainder = count - preview.length;

  return (
    <div className="flex flex-col overflow-clip rounded-[10px] border border-stone-200 bg-white">
      <div className="flex items-start justify-between gap-8 px-[22px] py-7">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[16px] font-bold leading-7 text-stone-900">{title}</h3>
            <span className="rounded-sm bg-parchment px-4 py-1 text-micro font-semibold text-espresso">
              {roleTag[departmentTag]}
            </span>
          </div>
          {blurb[departmentTag] && (
            <p className="text-caption text-stone-500">{blurb[departmentTag]}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-6">
          {head ? (
            <>
              <div className="flex items-center gap-2.5">
                <Avatar name={head.name} size="md" className="size-[38px]" />
                <div className="flex flex-col gap-px">
                  <p className="text-body-sm font-semibold text-stone-900">{head.name}</p>
                  <p className="text-caption text-stone-500">{title} head</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onChange}
                className="flex h-[34px] items-center rounded-md border border-stone-200 bg-white px-6 text-[13px] font-semibold text-stone-600 transition-colors duration-fast hover:bg-stone-100"
              >
                Change
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-warning-bg text-[16px] font-semibold text-warning">
                  !
                </span>
                <div className="flex flex-col gap-px">
                  <p className="text-body-sm font-semibold text-warning">No head assigned</p>
                  <p className="text-caption text-warning/80">
                    Shifts can&rsquo;t be scheduled until a head is set
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onAssign}
                className="flex h-[34px] items-center rounded-md bg-espresso px-6 text-[13px] font-semibold text-crema transition-colors duration-fast hover:bg-espresso-light"
              >
                Assign head
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-stone-100 bg-stone-50 px-[22px] py-5">
        <span className="text-caption font-semibold text-stone-600">
          {count} {count === 1 ? singular : plural}
        </span>
        {preview.length > 0 && (
          <>
            <span className="size-[3px] shrink-0 rounded-full bg-stone-300" />
            <span className={cn('truncate text-caption text-stone-500')}>
              {preview.join(', ')}
              {remainder > 0 ? `, +${remainder}` : ''}
            </span>
          </>
        )}
        <span className="grow" />
        {count > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 text-caption font-semibold text-espresso hover:underline"
          >
            View all
          </button>
        )}
      </div>
    </div>
  );
}
