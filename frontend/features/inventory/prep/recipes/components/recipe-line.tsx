'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import type { RecipeDetail } from '../../_shared/types/prep-contract';
import { useRecipeDetail } from '../hooks/use-recipes';
import { HOVER_UNDERLINE, PRESS } from '../lib/press';
import { formatAmount, trimNumber } from '../lib/recipe-scaling';

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });
const monoLabel = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary';
const ROW = 'flex justify-between gap-4 px-3.5 py-2.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink';

export interface RecipeLineViewProps {
  detail: RecipeDetail | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  canEdit: boolean;
}

/** The read-only recipe block (Paper step 27, `1TVK-0`), without data fetching. */
export function RecipeLineView({ detail, status, canEdit }: RecipeLineViewProps) {
  return (
    <section aria-label="Usual recipe" className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <span className={monoLabel}>USUAL RECIPE</span>
        <Link href="/app/inventory/prep/recipes" className={cn('rounded-wds-sm font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700', HOVER_UNDERLINE, PRESS)}>
          Open in Prep →
        </Link>
      </div>
      {status === 'loading' || status === 'idle' ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-2.5 border border-wds-border px-3.5 py-3">
          <span className="sr-only">Loading the usual recipe</span>
          <Skeleton className="h-3 w-[60%]" />
          <Skeleton className="h-3 w-[40%]" />
        </div>
      ) : status === 'error' || !detail ? (
        <p role="alert" className="border border-wds-border px-3.5 py-3 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
          Couldn’t load the usual recipe. Open Prep to try again.
        </p>
      ) : detail.current === null ? (
        <p className="border border-dashed border-wds-border-strong px-3.5 py-3 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
          No usual recipe yet. Runs of this item are judged on the average of past runs.
        </p>
      ) : (
        <>
          <ul className="border border-wds-border">
            {detail.current.lines.map((line) => (
              <li key={line.itemId} className={cn(ROW, 'border-b border-wds-border')}>
                <span>{line.itemName}</span>
                <span className="font-wds-mono">
                  {trimNumber(line.amount)} {line.unit}
                  {line.isMain ? ' · main' : ''}
                </span>
              </li>
            ))}
            <li className={cn(ROW, 'bg-wds-neutral-50 font-medium')}>
              <span>Should give</span>
              <span className="font-wds-mono">
                {formatAmount(detail.current.targetYield, detail.unit)} {detail.unit}
              </span>
            </li>
          </ul>
          <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            Changed {dayMonth.format(new Date(detail.current.changedAt))} by {detail.current.changedBy.name}.{' '}
            {canEdit ? 'You can edit it in Prep.' : 'Only the Store Manager and the System Admin can edit it, in Prep.'}
          </p>
        </>
      )}
    </section>
  );
}

/** The usual recipe of a prepped Catalog item. Renders nothing for a role without `prep.read`. */
export function RecipeLine({ itemId }: { itemId: string }) {
  const { can, ready } = usePermissions();
  const canRead = ready && can('prep.read');
  const { detail, status } = useRecipeDetail(itemId, canRead);
  if (!canRead) return null;
  return <RecipeLineView detail={detail} status={status} canEdit={can('prep.recipes_write')} />;
}
